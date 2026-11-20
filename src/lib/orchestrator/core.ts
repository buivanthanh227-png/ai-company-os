export type OrchestratorStatus =
  | "planned"
  | "needs_approval"
  | "queued"
  | "dispatched"
  | "running"
  | "succeeded"
  | "review_required"
  | "failed"
  | "cancelled"
  | "retry_wait";

export type TaskRole = "researcher" | "planner" | "implementer" | "critic" | "synthesizer";
export type TaskProvider = "gemini" | "openrouter" | "manual";

export type PlannedTask = {
  id: string;
  title: string;
  objective: string;
  role: TaskRole;
  provider: TaskProvider;
  dependsOn: string[];
};

export type TaskPlan = {
  schemaVersion: 1;
  objective: string;
  tasks: PlannedTask[];
};

export type ValidationResult =
  | { valid: true; errors: [] }
  | { valid: false; errors: string[] };

const STATUSES = new Set<OrchestratorStatus>([
  "planned", "needs_approval", "queued", "dispatched", "running",
  "succeeded", "review_required", "failed", "cancelled", "retry_wait",
]);

const TRANSITIONS: Record<OrchestratorStatus, readonly OrchestratorStatus[]> = {
  planned: ["needs_approval", "queued", "cancelled"],
  needs_approval: ["queued", "cancelled"],
  queued: ["dispatched", "cancelled"],
  dispatched: ["running", "retry_wait", "failed", "cancelled"],
  running: ["succeeded", "review_required", "retry_wait", "failed", "cancelled"],
  retry_wait: ["queued", "failed", "cancelled"],
  review_required: ["succeeded", "failed"],
  succeeded: [],
  failed: [],
  cancelled: [],
};

const ROLES = new Set<TaskRole>(["researcher", "planner", "implementer", "critic", "synthesizer"]);
const PROVIDERS = new Set<TaskProvider>(["gemini", "openrouter", "manual"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Validate an untrusted planner response before any task is persisted or queued.
 * The default cap is eight tasks; callers may raise it, but never above twenty.
 */
export function validateTaskPlan(value: unknown, maxTasks = 8): ValidationResult {
  const errors: string[] = [];
  const requestedCap = Number.isFinite(maxTasks) ? Math.floor(maxTasks) : 8;\n  const cap = Math.max(1, Math.min(20, requestedCap));

  if (!isRecord(value)) return { valid: false, errors: ["Plan must be an object."] };
  if (value.schemaVersion !== 1) errors.push("schemaVersion must equal 1.");
  if (typeof value.objective !== "string" || !value.objective.trim() || value.objective.length > 4000) {
    errors.push("objective must contain 1–4000 characters.");
  }
  if (!Array.isArray(value.tasks)) {
    errors.push("tasks must be an array.");
    return { valid: false, errors };
  }
  if (value.tasks.length === 0 || value.tasks.length > cap) {
    errors.push(`tasks must contain between 1 and ${cap} items.`);
  }

  const ids = new Set<string>();
  const tasks: Record<string, unknown>[] = [];
  value.tasks.forEach((item, index) => {
    if (!isRecord(item)) {
      errors.push(`tasks[${index}] must be an object.`);
      return;
    }
    tasks.push(item);
    const id = item.id;
    if (typeof id !== "string" || !/^[a-zA-Z0-9_-]{1,64}$/.test(id)) {
      errors.push(`tasks[${index}].id is invalid.`);
    } else if (ids.has(id)) {
      errors.push(`Duplicate task id: ${id}.`);
    } else {
      ids.add(id);
    }
    if (typeof item.title !== "string" || !item.title.trim() || item.title.length > 160) {
      errors.push(`tasks[${index}].title must contain 1–160 characters.`);
    }
    if (typeof item.objective !== "string" || !item.objective.trim() || item.objective.length > 4000) {
      errors.push(`tasks[${index}].objective must contain 1–4000 characters.`);
    }
    if (typeof item.role !== "string" || !ROLES.has(item.role as TaskRole)) {
      errors.push(`tasks[${index}].role is unsupported.`);
    }
    if (typeof item.provider !== "string" || !PROVIDERS.has(item.provider as TaskProvider)) {
      errors.push(`tasks[${index}].provider is unsupported.`);
    }
    if (!Array.isArray(item.dependsOn) || item.dependsOn.some((dep) => typeof dep !== "string")) {
      errors.push(`tasks[${index}].dependsOn must be an array of task ids.`);
    }
  });

  const byId = new Map<string, Record<string, unknown>>();
  for (const task of tasks) {
    if (typeof task.id === "string" && !byId.has(task.id)) byId.set(task.id, task);
  }
  for (const task of tasks) {
    if (typeof task.id !== "string" || !Array.isArray(task.dependsOn)) continue;
    const seen = new Set<string>();
    for (const dep of task.dependsOn) {
      if (typeof dep !== "string") continue;
      if (dep === task.id) errors.push(`Task ${task.id} cannot depend on itself.`);
      if (seen.has(dep)) errors.push(`Task ${task.id} has duplicate dependency ${dep}.`);
      seen.add(dep);
      if (!byId.has(dep)) errors.push(`Task ${task.id} depends on unknown task ${dep}.`);
    }
  }

  // Three-colour DFS detects cycles without relying on task order.
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string): boolean => {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    const task = byId.get(id);
    if (task && Array.isArray(task.dependsOn)) {
      for (const dep of task.dependsOn) {
        if (typeof dep === "string" && byId.has(dep) && visit(dep)) return true;
      }
    }
    visiting.delete(id);
    visited.add(id);
    return false;
  };
  for (const id of byId.keys()) {
    if (visit(id)) {
      errors.push("Task dependencies contain a cycle.");
      break;
    }
  }

  return errors.length ? { valid: false, errors } : { valid: true, errors: [] };
}

export type RuntimeTask = {
  id: string;
  status: OrchestratorStatus;
  dependsOn: string[];
  approvalRequired?: boolean;
  approvedAt?: string | null;
};

/** A task is dispatchable only after approval (when required) and successful dependencies. */
export function isTaskDispatchable(task: RuntimeTask, allTasks: RuntimeTask[]): boolean {
  if (task.status !== "queued") return false;
  if (task.approvalRequired && !task.approvedAt) return false;
  const byId = new Map(allTasks.map((item) => [item.id, item]));
  return task.dependsOn.every((id) => byId.get(id)?.status === "succeeded");
}

/** Return queued tasks whose dependencies succeeded and whose approval gate is satisfied. */
export function getDispatchableTasks(tasks: RuntimeTask[]): RuntimeTask[] {
  return tasks.filter((task) => isTaskDispatchable(task, tasks));
}

/** Return the legal next state; invalid transitions throw rather than silently mutating state. */
export function transitionTaskStatus(
  current: OrchestratorStatus,
  next: OrchestratorStatus,
): OrchestratorStatus {
  if (!STATUSES.has(current) || !STATUSES.has(next) || !TRANSITIONS[current].includes(next)) {
    throw new Error(`Invalid task transition: ${current} -> ${next}`);
  }
  return next;
}

export function canTransitionTaskStatus(
  current: OrchestratorStatus,
  next: OrchestratorStatus,
): boolean {
  return STATUSES.has(current) && STATUSES.has(next) && TRANSITIONS[current].includes(next);
}
