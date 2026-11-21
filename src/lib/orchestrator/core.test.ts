import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canTransitionTaskStatus,
  getDispatchableTasks,
  isTaskDispatchable,
  matchesApproval,
  matchesReview,
  transitionTaskStatus,
  validateTaskPlan,
  type ApprovalEvidence,
  type ReviewEvidence,
  type RuntimeTask,
  type TaskPlan,
} from "./core.ts";

const validPlan: TaskPlan = {
  schemaVersion: 1,
  objective: "Prepare a verified research summary.",
  tasks: [
    { id: "research", title: "Collect sources", objective: "Find reliable sources.", role: "researcher", provider: "gemini", dependsOn: [] },
    { id: "critic", title: "Review sources", objective: "Check evidence and gaps.", role: "critic", provider: "openrouter", dependsOn: ["research"] },
  ],
};

const task = (id: string, dependsOn: string[] = []): RuntimeTask => ({
  id, revision: 1, contentHash: `hash-${id}`, status: "queued", dependsOn,
  approvalRequired: false, reviewRequired: false,
});
const approval = (forTask: RuntimeTask, overrides: Partial<ApprovalEvidence> = {}): ApprovalEvidence => ({
  approvalId: "approval-1", taskId: forTask.id, taskRevision: forTask.revision,
  taskHash: forTask.contentHash, approvedBy: "user-1",
  approvedAt: "2026-11-20T10:00:00.000Z", scope: "execute", revokedAt: null, ...overrides,
});
const review = (forTask: RuntimeTask, overrides: Partial<ReviewEvidence> = {}): ReviewEvidence => ({
  reviewId: "review-1", taskId: forTask.id, taskRevision: forTask.revision,
  taskHash: forTask.contentHash, reviewerId: "reviewer-1",
  reviewedAt: "2026-11-20T10:00:00.000Z", verdict: "accepted", ...overrides,
});

test("accepts a valid acyclic plan and returns a canonical copy", () => {
  const input = structuredClone(validPlan);
  const result = validateTaskPlan(input);
  assert.equal(result.valid, true);
  if (result.valid) {
    assert.deepEqual(result.plan, validPlan);
    assert.notEqual(result.plan, input);
    assert.notEqual(result.plan.tasks, input.tasks);
  }
});

test("rejects non-object, invalid schema and empty objectives", () => {
  assert.equal(validateTaskPlan(null).valid, false);
  assert.equal(validateTaskPlan({ ...validPlan, schemaVersion: 2, objective: " " }).valid, false);
});

test("enforces task caps and rejects invalid cap configuration", () => {
  const tasks = Array.from({ length: 9 }, (_, index) => ({
    id: `task-${index}`, title: "Task", objective: "Do work", role: "researcher", provider: "manual", dependsOn: [],
  }));
  assert.equal(validateTaskPlan({ schemaVersion: 1, objective: "Plan", tasks }).valid, false);
  assert.equal(validateTaskPlan({ schemaVersion: 1, objective: "Plan", tasks }, 9).valid, true);
  assert.equal(validateTaskPlan({ schemaVersion: 1, objective: "Plan", tasks: [tasks[0]] }, 0).valid, false);
  assert.equal(validateTaskPlan({ schemaVersion: 1, objective: "Plan", tasks: [tasks[0]] }, -1).valid, false);
  assert.equal(validateTaskPlan({ schemaVersion: 1, objective: "Plan", tasks: [tasks[0]] }, 1.5).valid, false);
  assert.equal(validateTaskPlan({ schemaVersion: 1, objective: "Plan", tasks: [tasks[0]] }, Infinity).valid, false);
  assert.equal(validateTaskPlan({ schemaVersion: 1, objective: "Plan", tasks: [tasks[0]] }, NaN).valid, false);
  const twentyOne = Array.from({ length: 21 }, (_, index) => ({ ...tasks[0]!, id: `overflow-${index}` }));
  assert.equal(validateTaskPlan({ schemaVersion: 1, objective: "Plan", tasks: twentyOne }, 20).valid, false);
});

test("rejects unknown properties rather than passing them downstream", () => {
  assert.equal(validateTaskPlan({ ...validPlan, injected: "no" }).valid, false);
  const plan = { ...validPlan, tasks: [{ ...validPlan.tasks[0], unexpectedExecutionInstruction: "run shell" }] };
  assert.equal(validateTaskPlan(plan).valid, false);
});

test("rejects duplicate ids, self-dependencies, duplicate dependencies and unknown dependencies", () => {
  const result = validateTaskPlan({
    schemaVersion: 1, objective: "Plan",
    tasks: [
      { ...validPlan.tasks[0], id: "same", dependsOn: ["same", "missing", "missing"] },
      { ...validPlan.tasks[1], id: "same", dependsOn: [] },
    ],
  });
  assert.equal(result.valid, false);
  if (!result.valid) {
    assert.ok(result.errors.some((error) => error.includes("Duplicate task id")));
    assert.ok(result.errors.some((error) => error.includes("cannot depend on itself")));
    assert.ok(result.errors.some((error) => error.includes("unknown task")));
    assert.ok(result.errors.some((error) => error.includes("duplicate dependency")));
  }
});

test("detects two-node, three-node, deep and branched cycles", () => {
  const make = (ids: string[], edges: Record<string, string[]>) => ({
    schemaVersion: 1, objective: "Plan",
    tasks: ids.map((id) => ({ ...validPlan.tasks[0], id, dependsOn: edges[id] ?? [] })),
  });
  assert.equal(validateTaskPlan(make(["a", "b"], { a: ["b"], b: ["a"] })).valid, false);
  assert.equal(validateTaskPlan(make(["a", "b", "c"], { a: ["b"], b: ["c"], c: ["a"] })).valid, false);
  assert.equal(validateTaskPlan(make(["a", "b", "c", "d"], { a: ["b"], b: ["c"], c: ["d"], d: ["b"] })).valid, false);
  assert.equal(validateTaskPlan(make(["root", "a", "b", "c"], { root: ["a", "c"], a: ["b"], b: ["a"], c: [] })).valid, false);
});

test("accepts a 20-node acyclic chain", () => {
  const tasks = Array.from({ length: 20 }, (_, i) => ({
    ...validPlan.tasks[0], id: `n${i}`, dependsOn: i === 0 ? [] : [`n${i - 1}`],
  }));
  assert.equal(validateTaskPlan({ schemaVersion: 1, objective: "Chain", tasks }, 20).valid, true);
});

test("approval evidence must be server-resolved, scoped, current and well formed", () => {
  const item = { ...task("deploy"), approvalRequired: true };
  assert.equal(matchesApproval(item, approval(item), Date.parse("2026-11-20T11:00:00Z")), true);
  assert.equal(matchesApproval(item, approval(item, { approvedAt: "garbage" })), false);
  assert.equal(matchesApproval(item, approval(item, { approvedAt: "2027-01-01T00:00:00Z" }), Date.parse("2026-11-20T11:00:00Z")), false);
  assert.equal(matchesApproval(item, approval(item, { taskRevision: 2 })), false);
  assert.equal(matchesApproval(item, approval(item, { taskHash: "stale-hash" })), false);
  assert.equal(matchesApproval(item, approval(item, { revokedAt: "2026-11-20T10:30:00Z" })), false);
  assert.equal(matchesApproval(item, approval(item, { approvedBy: " " })), false);
  assert.equal(matchesApproval(item, approval(item, { revokedAt: "" })), false);
  assert.equal(matchesApproval(item, { ...approval(item), approvedAt: 42 } as unknown as ApprovalEvidence), false);
});

test("dispatch fails closed without matching approval and on duplicate runtime IDs", () => {
  const protectedTask = { ...task("deploy"), approvalRequired: true };
  assert.equal(isTaskDispatchable(protectedTask, [protectedTask]), false);
  assert.equal(isTaskDispatchable({ ...protectedTask, approvalRequired: undefined } as unknown as RuntimeTask, [protectedTask], [approval(protectedTask)]), false);
  assert.equal(isTaskDispatchable({ ...protectedTask, reviewRequired: undefined } as unknown as RuntimeTask, [protectedTask], [approval(protectedTask)]), false);
  assert.equal(isTaskDispatchable(protectedTask, [protectedTask], [approval(protectedTask)]), true);
  assert.equal(isTaskDispatchable({ ...protectedTask, contentHash: "forged-hash" }, [protectedTask], [approval(protectedTask)]), false);
  assert.equal(isTaskDispatchable({ ...protectedTask, dependsOn: ["other"] }, [protectedTask], [approval(protectedTask)]), false);
  assert.equal(isTaskDispatchable(protectedTask, [protectedTask, { ...protectedTask }], [approval(protectedTask)]), false);
  assert.deepEqual(getDispatchableTasks([protectedTask, { ...protectedTask }], [approval(protectedTask)]), []);
});

test("dispatch waits for every dependency and rejects unknown dependencies", () => {
  const parent: RuntimeTask = { ...task("parent"), status: "running" };
  const child = task("child", ["parent"]);
  assert.equal(isTaskDispatchable(child, [parent, child]), false);
  parent.status = "succeeded";
  assert.equal(isTaskDispatchable(child, [parent, child]), true);
  assert.equal(isTaskDispatchable(task("orphan", ["missing"]), [task("orphan", ["missing"])]), false);
});

test("planned tasks cannot bypass required approval by going directly to queued", () => {
  assert.equal(canTransitionTaskStatus("planned", "queued"), false);
  assert.equal(canTransitionTaskStatus("planned", "queued", { approvalRequired: true, reviewRequired: false }), false);
  assert.equal(canTransitionTaskStatus("planned", "queued", { approvalRequired: false, reviewRequired: false }), true);
  assert.equal(canTransitionTaskStatus("planned", "queued", { approvalRequired: undefined, reviewRequired: false } as never), false);
  assert.equal(canTransitionTaskStatus("needs_approval", "queued"), false);
  const protectedTask = { ...task("deploy"), approvalRequired: true };
  const policy = { approvalRequired: true, reviewRequired: false, task: protectedTask, approval: approval(protectedTask) };
  assert.equal(canTransitionTaskStatus("needs_approval", "queued", policy), true);
  assert.equal(canTransitionTaskStatus("needs_approval", "queued", { ...policy, approval: null }), false);
});

test("execution success is distinct from accepted completion and review cannot be bypassed", () => {
  assert.equal(canTransitionTaskStatus("running", "succeeded"), false);
  assert.equal(canTransitionTaskStatus("running", "execution_succeeded"), true);
  assert.equal(canTransitionTaskStatus("execution_succeeded", "succeeded"), false);
  assert.equal(canTransitionTaskStatus("execution_succeeded", "succeeded", { approvalRequired: false, reviewRequired: false }), true);
  assert.equal(canTransitionTaskStatus("execution_succeeded", "review_required", { approvalRequired: false, reviewRequired: true }), true);
  const item = { ...task("implement"), reviewRequired: true };
  const policy = { approvalRequired: false, reviewRequired: true, task: item, review: review(item) };
  assert.equal(canTransitionTaskStatus("review_required", "succeeded"), false);
  assert.equal(canTransitionTaskStatus("review_required", "succeeded", policy), true);
  assert.equal(canTransitionTaskStatus("review_required", "succeeded", { ...policy, review: review(item, { verdict: "revise" }) }), false);
  assert.equal(matchesReview(item, review(item, { taskRevision: 2 })), false);
});


test("approval and review timestamps must be canonical UTC ISO strings", () => {
  const item = { ...task("deploy"), approvalRequired: true };
  assert.equal(matchesApproval(item, approval(item, { approvedAt: "2026-11-20" })), false);
  assert.equal(matchesApproval(item, approval(item, { approvedAt: "Nov 20, 2026 10:00:00 GMT" })), false);
  assert.equal(matchesApproval(item, approval(item, { approvedAt: "2026-02-31T10:00:00.000Z" })), false);
  assert.equal(matchesReview({ ...item, reviewRequired: true }, review(item, { reviewedAt: "2026-11-20T10:00:00+00:00" })), false);
});

test("runtime dispatch fails closed on malformed graph nodes and duplicate dependencies", () => {
  const child = task("child", ["parent"]);
  const parent = { ...task("parent"), status: "succeeded" as const };
  assert.equal(isTaskDispatchable(child, [parent, { ...child, dependsOn: ["parent", "parent"] }]), false);
  assert.equal(isTaskDispatchable(child, [parent, { ...child, status: "unknown" } as unknown as RuntimeTask]), false);
  assert.deepEqual(getDispatchableTasks([child, null as unknown as RuntimeTask]), []);
  assert.deepEqual(getDispatchableTasks(null as unknown as RuntimeTask[]), []);
});

test("runtime dispatch rejects unknown fields and cyclic or malformed dependency graphs", () => {
  const injected = { ...task("injected"), executionCommand: "untrusted" } as unknown as RuntimeTask;
  assert.equal(isTaskDispatchable(injected, [injected]), false);
  assert.deepEqual(getDispatchableTasks([injected]), []);

  const completedCycleNode: RuntimeTask = {
    ...task("cycle-a", ["cycle-b"]),
    status: "succeeded",
  };
  const queuedCycleNode = task("cycle-b", ["cycle-a"]);
  assert.equal(isTaskDispatchable(queuedCycleNode, [completedCycleNode, queuedCycleNode]), false);
  assert.deepEqual(getDispatchableTasks([completedCycleNode, queuedCycleNode]), []);

  const malformedId = { ...task("valid"), id: " " } as unknown as RuntimeTask;
  assert.equal(isTaskDispatchable(malformedId, [malformedId]), false);
});

test("terminal states cannot be reopened", () => {
  for (const status of ["succeeded", "failed", "cancelled"] as const) {
    assert.equal(canTransitionTaskStatus(status, "queued"), false);
  }
  assert.throws(() => transitionTaskStatus("running", "succeeded"), /Invalid or unauthorized/);
});


test("accepts the opt-in DeepSeek and Groq provider identifiers", () => {
  for (const provider of ["deepseek", "groq"] as const) {
    const plan = structuredClone(validPlan);
    plan.tasks[0]!.provider = provider;
    assert.equal(validateTaskPlan(plan).valid, true);
  }
});
