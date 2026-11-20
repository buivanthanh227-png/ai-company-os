export type OrchestratorStatus =
  | "planned" | "needs_approval" | "queued" | "dispatched" | "running"
  | "execution_succeeded" | "review_required" | "succeeded"
  | "failed" | "cancelled" | "retry_wait";

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

export type TaskPlan = { schemaVersion: 1; objective: string; tasks: PlannedTask[] };

export type ValidationResult =
  | { valid: true; errors: []; plan: TaskPlan }
  | { valid: false; errors: string[] };

const ROLES = new Set<TaskRole>(["researcher", "planner", "implementer", "critic", "synthesizer"]);
const PROVIDERS = new Set<TaskProvider>(["gemini", "openrouter", "manual"]);
const PLAN_KEYS = new Set(["schemaVersion", "objective", "tasks"]);
const TASK_KEYS = new Set(["id", "title", "objective", "role", "provider", "dependsOn"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: Set<string>): boolean {
  return Object.keys(value).every((key) => allowed.has(key));
}

/** Parse untrusted planner output into a canonical object; never pass the original object downstream. */
export function validateTaskPlan(value: unknown, maxTasks = 8): ValidationResult {
  const errors: string[] = [];
  if (!Number.isInteger(maxTasks) || maxTasks < 1 || maxTasks > 20) {
    errors.push("maxTasks must be an integer between 1 and 20.");
  }
  const cap = Number.isInteger(maxTasks) && maxTasks >= 1 && maxTasks <= 20 ? maxTasks : 8;
  if (!isRecord(value)) return { valid: false, errors: ["Plan must be an object.", ...errors] };
  if (!hasOnlyKeys(value, PLAN_KEYS)) errors.push("Plan contains unsupported properties.");
  if (value.schemaVersion !== 1) errors.push("schemaVersion must equal 1.");
  if (typeof value.objective !== "string" || !value.objective.trim() || value.objective.length > 4000) {
    errors.push("objective must contain 1–4000 characters.");
  }
  if (!Array.isArray(value.tasks)) {
    errors.push("tasks must be an array.");
    return { valid: false, errors };
  }
  if (value.tasks.length === 0 || value.tasks.length > cap) errors.push(`tasks must contain between 1 and ${cap} items.`);

  const ids = new Set<string>();
  const parsedTasks: PlannedTask[] = [];
  value.tasks.forEach((item, index) => {
    if (!isRecord(item)) {
      errors.push(`tasks[${index}] must be an object.`);
      return;
    }
    if (!hasOnlyKeys(item, TASK_KEYS)) errors.push(`tasks[${index}] contains unsupported properties.`);
    const id = item.id;
    const title = item.title;
    const objective = item.objective;
    const role = item.role;
    const provider = item.provider;
    const dependsOn = item.dependsOn;
    if (typeof id !== "string" || !/^[a-zA-Z0-9_-]{1,64}$/.test(id)) {
      errors.push(`tasks[${index}].id is invalid.`);
    } else if (ids.has(id)) {
      errors.push(`Duplicate task id: ${id}.`);
    } else {
      ids.add(id);
    }
    if (typeof title !== "string" || !title.trim() || title.length > 160) errors.push(`tasks[${index}].title must contain 1–160 characters.`);
    if (typeof objective !== "string" || !objective.trim() || objective.length > 4000) errors.push(`tasks[${index}].objective must contain 1–4000 characters.`);
    if (typeof role !== "string" || !ROLES.has(role as TaskRole)) errors.push(`tasks[${index}].role is unsupported.`);
    if (typeof provider !== "string" || !PROVIDERS.has(provider as TaskProvider)) errors.push(`tasks[${index}].provider is unsupported.`);
    if (!Array.isArray(dependsOn) || dependsOn.some((dep) => typeof dep !== "string")) {
      errors.push(`tasks[${index}].dependsOn must be an array of task ids.`);
    }
    if (
      typeof id === "string" && /^[a-zA-Z0-9_-]{1,64}$/.test(id) &&
      typeof title === "string" && typeof objective === "string" &&
      typeof role === "string" && ROLES.has(role as TaskRole) &&
      typeof provider === "string" && PROVIDERS.has(provider as TaskProvider) &&
      Array.isArray(dependsOn) && dependsOn.every((dep) => typeof dep === "string")
    ) {
      parsedTasks.push({ id, title, objective, role: role as TaskRole, provider: provider as TaskProvider, dependsOn: [...dependsOn] as string[] });
    }
  });

  const byId = new Map(parsedTasks.map((task) => [task.id, task]));
  for (const task of parsedTasks) {
    const seen = new Set<string>();
    for (const dep of task.dependsOn) {
      if (dep === task.id) errors.push(`Task ${task.id} cannot depend on itself.`);
      if (seen.has(dep)) errors.push(`Task ${task.id} has duplicate dependency ${dep}.`);
      seen.add(dep);
      if (!byId.has(dep)) errors.push(`Task ${task.id} depends on unknown task ${dep}.`);
    }
  }

  // Three-colour DFS: visiting is the active recursion stack; visited is fully explored.
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string): boolean => {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    for (const dep of byId.get(id)?.dependsOn ?? []) {
      if (byId.has(dep) && visit(dep)) return true;
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

  if (errors.length || typeof value.objective !== "string") return { valid: false, errors };
  return {
    valid: true,
    errors: [],
    plan: { schemaVersion: 1, objective: value.objective, tasks: parsedTasks },
  };
}

export type ApprovalEvidence = {
  approvalId: string;
  taskId: string;
  taskRevision: number;
  taskHash: string;
  approvedBy: string;
  approvedAt: string;
  scope: "execute";
  revokedAt?: string | null;
};

export type ReviewEvidence = {
  reviewId: string;
  taskId: string;
  taskRevision: number;
  taskHash: string;
  reviewerId: string;
  reviewedAt: string;
  verdict: "accepted" | "revise" | "rejected";
};

export type RuntimeTask = {
  id: string;
  revision: number;
  contentHash: string;
  status: OrchestratorStatus;
  dependsOn: string[];
  approvalRequired: boolean;
  reviewRequired: boolean;
};

function isValidTimestamp(value: string, nowMs: number): boolean {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp <= nowMs;
}

/**
 * Evidence must be loaded from trusted server-side persistence by the caller.
 * This function checks binding/freshness, but is NOT an identity/authentication system.
 */
export function matchesApproval(
  task: RuntimeTask,
  evidence: ApprovalEvidence | null | undefined,
  nowMs = Date.now(),
): boolean {
  return Boolean(
    evidence &&
    evidence.approvalId.trim() &&
    evidence.taskId === task.id &&
    evidence.taskRevision === task.revision &&
    evidence.taskHash === task.contentHash &&
    evidence.approvedBy.trim() &&
    evidence.scope === "execute" &&
    !evidence.revokedAt &&
    isValidTimestamp(evidence.approvedAt, nowMs)
  );
}

export function matchesReview(
  task: RuntimeTask,
  evidence: ReviewEvidence | null | undefined,
  nowMs = Date.now(),
): boolean {
  return Boolean(
    evidence &&
    evidence.reviewId.trim() &&
    evidence.taskId === task.id &&
    evidence.taskRevision === task.revision &&
    evidence.taskHash === task.contentHash &&
    evidence.reviewerId.trim() &&
    evidence.verdict === "accepted" &&
    isValidTimestamp(evidence.reviewedAt, nowMs)
  );
}

/** Fail closed on duplicate runtime IDs and require server-resolved, revision-bound approval evidence. */
export function isTaskDispatchable(
  task: RuntimeTask,
  allTasks: RuntimeTask[],
  approvals: readonly ApprovalEvidence[] = [],
  nowMs = Date.now(),
): boolean {
  if (task.status !== "queued") return false;
  if (!Array.isArray(task.dependsOn) || !Number.isInteger(task.revision) || task.revision < 1 || !task.contentHash) return false;
  if (new Set(allTasks.map((item) => item.id)).size !== allTasks.length) return false;
  if (!allTasks.some((item) => item === task)) return false;
  if (task.approvalRequired && !approvals.some((approval) => matchesApproval(task, approval, nowMs))) return false;
  const byId = new Map(allTasks.map((item) => [item.id, item]));
  return task.dependsOn.every((id) => byId.get(id)?.status === "succeeded");
}

export function getDispatchableTasks(
  tasks: RuntimeTask[],
  approvals: readonly ApprovalEvidence[] = [],
  nowMs = Date.now(),
): RuntimeTask[] {
  if (new Set(tasks.map((task) => task.id)).size !== tasks.length) return [];
  return tasks.filter((task) => isTaskDispatchable(task, tasks, approvals, nowMs));
}

export type TransitionPolicy = {
  approvalRequired: boolean;
  approval?: ApprovalEvidence | null;
  reviewRequired: boolean;
  review?: ReviewEvidence | null;
  task?: RuntimeTask;
  nowMs?: number;
};

const TRANSITIONS: Record<OrchestratorStatus, readonly OrchestratorStatus[]> = {
  planned: ["needs_approval", "queued", "cancelled"],
  needs_approval: ["queued", "cancelled"],
  queued: ["dispatched", "cancelled"],
  dispatched: ["running", "retry_wait", "failed", "cancelled"],
  running: ["execution_succeeded", "retry_wait", "failed", "cancelled"],
  execution_succeeded: ["review_required", "succeeded", "failed"],
  review_required: ["succeeded", "failed"],
  retry_wait: ["queued", "failed", "cancelled"],
  succeeded: [],
  failed: [],
  cancelled: [],
};

function policyAllows(current: OrchestratorStatus, next: OrchestratorStatus, policy?: TransitionPolicy): boolean {
  if (current === "planned" && next === "queued") return Boolean(policy && !policy.approvalRequired);
  if (current === "needs_approval" && next === "queued") {
    return Boolean(policy?.task && policy.approvalRequired && matchesApproval(policy.task, policy.approval, policy.nowMs));
  }
  if (current === "execution_succeeded" && next === "succeeded") return Boolean(policy && !policy.reviewRequired);
  if (current === "execution_succeeded" && next === "review_required") return Boolean(policy?.reviewRequired);
  if (current === "review_required" && next === "succeeded") {
    return Boolean(policy?.task && policy.reviewRequired && matchesReview(policy.task, policy.review, policy.nowMs));
  }
  return true;
}

export function transitionTaskStatus(
  current: OrchestratorStatus,
  next: OrchestratorStatus,
  policy?: TransitionPolicy,
): OrchestratorStatus {
  if (!canTransitionTaskStatus(current, next, policy)) {
    throw new Error(`Invalid or unauthorized task transition: ${current} -> ${next}`);
  }
  return next;
}

export function canTransitionTaskStatus(
  current: OrchestratorStatus,
  next: OrchestratorStatus,
  policy?: TransitionPolicy,
): boolean {
  return Object.hasOwn(TRANSITIONS, current) &&
    Object.hasOwn(TRANSITIONS, next) &&
    TRANSITIONS[current].includes(next) &&
    policyAllows(current, next, policy);
}
