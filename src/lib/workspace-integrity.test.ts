import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyAuthoritativeWorkspaceRecords,
  proposalPayloadHash,
  sanitizeClientSnapshot,
  taskCompletionHash,
} from "./workspace-integrity.server.ts";
import type { Snapshot } from "./store.ts";
import type { Proposal, Task } from "./types.ts";

const proposal: Proposal = {
  id: "proposal-1",
  at: "2026-11-21T00:00:00.000Z",
  staffId: "staff-1",
  fromRank: "specialist",
  toRank: "lead",
  title: "Trưởng phòng",
  reason: "Đạt tiêu chí",
  status: "pending",
};

const task: Task = {
  id: "task-1",
  projectId: "project-1",
  missionId: "mission-1",
  phase: "implementation",
  title: "Implement feature",
  detail: "Implement and test",
  skill: "P",
  assigneeId: "staff-1",
  triedIds: [],
  status: "done",
  progress: 100,
  context: "Requirement",
  result: "Test output",
  priority: "P1",
  attempts: 1,
  history: [],
  updatedAt: "2026-11-21T00:00:00.000Z",
};

const snapshot = (): Snapshot => ({
  staffOver: { "staff-1": { rank: "director", title: "Forged title", budget: 50 } },
  projects: [],
  missions: [],
  tasks: [structuredClone(task)],
  activity: [],
  messages: [],
  proposals: [structuredClone({ ...proposal, status: "approved" as const })],
  settings: { orgName: "AI COMPANY OS", keys: {} },
});

test("client snapshot cannot grant rank, approve proposals, or mark tasks done", () => {
  const clean = sanitizeClientSnapshot(snapshot());
  assert.equal(clean.staffOver["staff-1"]?.rank, undefined);
  assert.equal(clean.staffOver["staff-1"]?.title, undefined);
  assert.equal(clean.proposals[0]?.status, "pending");
  assert.equal(clean.tasks[0]?.status, "review");
  assert.equal(clean.tasks[0]?.progress, 90);
});

test("only a matching server decision restores proposal approval and rank", () => {
  const current = snapshot();
  const decision = {
    proposal_id: proposal.id,
    action: "approved" as const,
    payload_hash: proposalPayloadHash(proposal),
    actor_user_id: "authenticated-owner",
    created_at: "2026-11-21T00:01:00.000Z",
  };
  const result = applyAuthoritativeWorkspaceRecords(current, [decision], []);
  assert.equal(result.proposals[0]?.status, "approved");
  assert.equal(result.staffOver["staff-1"]?.rank, "lead");
  assert.equal(result.staffOver["staff-1"]?.title, "Trưởng phòng");
});

test("a changed proposal payload invalidates an earlier approval", () => {
  const current = snapshot();
  current.proposals[0]!.reason = "Changed after approval";
  const decision = {
    proposal_id: proposal.id,
    action: "approved" as const,
    payload_hash: proposalPayloadHash(proposal),
    actor_user_id: "authenticated-owner",
    created_at: "2026-11-21T00:01:00.000Z",
  };
  const result = applyAuthoritativeWorkspaceRecords(current, [decision], []);
  assert.equal(result.proposals[0]?.status, "pending");
  assert.equal(result.staffOver["staff-1"]?.rank, undefined);
});

test("task completion is restored only for the exact task/result hash", () => {
  const current = snapshot();
  const completion = {
    task_id: task.id,
    task_hash: taskCompletionHash(task),
    result_hash: "result-hash",
    actor_user_id: "authenticated-owner",
    created_at: "2026-11-21T00:01:00.000Z",
  };
  const result = applyAuthoritativeWorkspaceRecords(current, [], [completion]);
  assert.equal(result.tasks[0]?.status, "done");
  current.tasks[0]!.result = "tampered result";
  const changed = applyAuthoritativeWorkspaceRecords(current, [], [completion]);
  assert.equal(changed.tasks[0]?.status, "review");
});
