import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canTransitionTaskStatus,
  getDispatchableTasks,
  isTaskDispatchable,
  transitionTaskStatus,
  validateTaskPlan,
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

test("accepts a valid acyclic task plan", () => {
  assert.deepEqual(validateTaskPlan(validPlan), { valid: true, errors: [] });
});

test("rejects a planner response that is not an object", () => {
  assert.equal(validateTaskPlan(null).valid, false);
});

test("rejects unsupported schema versions and empty objectives", () => {
  const result = validateTaskPlan({ ...validPlan, schemaVersion: 2, objective: " " });
  assert.equal(result.valid, false);
  if (!result.valid) {
    assert.ok(result.errors.some((error) => error.includes("schemaVersion")));
    assert.ok(result.errors.some((error) => error.includes("objective")));
  }
});

test("enforces the default eight-task limit and hard cap of twenty", () => {
  const tasks = Array.from({ length: 9 }, (_, index) => ({
    id: `task-${index}`, title: "Task", objective: "Do work", role: "researcher", provider: "manual", dependsOn: [],
  }));
  assert.equal(validateTaskPlan({ schemaVersion: 1, objective: "Plan", tasks }).valid, false);
  assert.equal(validateTaskPlan({ schemaVersion: 1, objective: "Plan", tasks }, 20).valid, true);
  assert.equal(validateTaskPlan({ schemaVersion: 1, objective: "Plan", tasks: tasks.slice(0, 21) }, 99).valid, false);
});

test("rejects duplicate ids, self-dependencies and unknown dependencies", () => {
  const result = validateTaskPlan({
    schemaVersion: 1,
    objective: "Plan",
    tasks: [
      { ...validPlan.tasks[0], id: "same", dependsOn: ["same", "missing"] },
      { ...validPlan.tasks[1], id: "same", dependsOn: [] },
    ],
  });
  assert.equal(result.valid, false);
  if (!result.valid) {
    assert.ok(result.errors.some((error) => error.includes("Duplicate task id")));
    assert.ok(result.errors.some((error) => error.includes("cannot depend on itself")));
    assert.ok(result.errors.some((error) => error.includes("unknown task")));
  }
});

test("rejects dependency cycles", () => {
  const result = validateTaskPlan({
    schemaVersion: 1,
    objective: "Plan",
    tasks: [
      { ...validPlan.tasks[0], id: "a", dependsOn: ["b"] },
      { ...validPlan.tasks[1], id: "b", dependsOn: ["a"] },
    ],
  });
  assert.equal(result.valid, false);
  if (!result.valid) assert.ok(result.errors.some((error) => error.includes("cycle")));
});

test("rejects unsupported roles, providers and malformed dependency arrays", () => {
  const result = validateTaskPlan({
    schemaVersion: 1,
    objective: "Plan",
    tasks: [{ ...validPlan.tasks[0], role: "admin", provider: "unknown", dependsOn: "not-an-array" }],
  });
  assert.equal(result.valid, false);
});

const runtimeTasks = (): RuntimeTask[] => [
  { id: "a", status: "succeeded", dependsOn: [] },
  { id: "b", status: "queued", dependsOn: ["a"] },
  { id: "c", status: "queued", dependsOn: ["missing"] },
  { id: "d", status: "queued", dependsOn: [], approvalRequired: true, approvedAt: null },
  { id: "e", status: "queued", dependsOn: [], approvalRequired: true, approvedAt: "2026-11-20T10:00:00.000Z" },
];

test("dispatches only queued tasks with successful dependencies and required approval", () => {
  const tasks = runtimeTasks();
  assert.deepEqual(getDispatchableTasks(tasks).map((task) => task.id), ["b", "e"]);
  assert.equal(isTaskDispatchable(tasks[3]!, tasks), false);
});

test("does not dispatch a dependent task until every dependency succeeds", () => {
  const tasks: RuntimeTask[] = [
    { id: "parent", status: "running", dependsOn: [] },
    { id: "child", status: "queued", dependsOn: ["parent"] },
  ];
  assert.deepEqual(getDispatchableTasks(tasks), []);
});

test("allows only explicitly defined status transitions", () => {
  assert.equal(canTransitionTaskStatus("queued", "dispatched"), true);
  assert.equal(canTransitionTaskStatus("queued", "running"), false);
  assert.equal(canTransitionTaskStatus("succeeded", "queued"), false);
  assert.equal(transitionTaskStatus("running", "review_required"), "review_required");
  assert.throws(() => transitionTaskStatus("succeeded", "queued"), /Invalid task transition/);
});

test("terminal states cannot be reopened", () => {
  for (const status of ["succeeded", "failed", "cancelled"] as const) {
    assert.equal(canTransitionTaskStatus(status, "queued"), false);
  }
});
