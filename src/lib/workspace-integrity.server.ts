import { createHash } from "node:crypto";
import type { Snapshot } from "./store";
import type { Proposal, Task } from "./types";

export type ProposalDecisionRecord = {
  proposal_id: string;
  action: "approved" | "rejected";
  payload_hash: string;
  actor_user_id: string;
  created_at: string;
};

export type TaskCompletionRecord = {
  task_id: string;
  task_hash: string;
  result_hash: string;
  actor_user_id: string;
  created_at: string;
};

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/** Hash only immutable proposal content; mutable status/approval metadata is excluded. */
export function proposalPayloadHash(proposal: Proposal): string {
  return sha256(JSON.stringify({
    id: proposal.id,
    at: proposal.at,
    staffId: proposal.staffId,
    fromRank: proposal.fromRank,
    toRank: proposal.toRank,
    title: proposal.title,
    reason: proposal.reason,
  }));
}

/** Bind a manual completion attestation to the exact task definition and submitted result. */
export function taskCompletionHash(task: Task): string {
  return sha256(JSON.stringify({
    id: task.id,
    projectId: task.projectId,
    missionId: task.missionId,
    phase: task.phase,
    title: task.title,
    detail: task.detail,
    assigneeId: task.assigneeId,
    context: task.context,
    result: task.result?.trim() ?? "",
  }));
}

export function resultContentHash(result: string): string {
  return sha256(result.trim());
}

/**
 * Client snapshots are editable input, never an authority for promotions,
 * approvals, or task completion. Those fields are rehydrated from server tables.
 */
export function sanitizeClientSnapshot(snapshot: Snapshot): Snapshot {
  const staffOver = Object.fromEntries(
    Object.entries(snapshot.staffOver).map(([id, value]) => {
      const clean = { ...value };
      delete clean.rank;
      delete clean.title;
      return [id, clean];
    }),
  );
  const proposals = snapshot.proposals.map((proposal) => ({
    ...proposal,
    status: "pending" as const,
  }));
  const tasks = snapshot.tasks.map((task) =>
    task.status === "done"
      ? { ...task, status: "review" as const, progress: Math.min(task.progress, 90) }
      : task,
  );
  return { ...snapshot, staffOver, proposals, tasks };
}

export function applyAuthoritativeWorkspaceRecords(
  input: Snapshot,
  decisions: readonly ProposalDecisionRecord[],
  completions: readonly TaskCompletionRecord[],
): Snapshot {
  const snapshot = sanitizeClientSnapshot(input);
  const decisionById = new Map(decisions.map((decision) => [decision.proposal_id, decision]));
  const proposals = snapshot.proposals.map((proposal) => {
    const decision = decisionById.get(proposal.id);
    if (!decision || proposalPayloadHash(proposal) !== decision.payload_hash) {
      return { ...proposal, status: "pending" as const };
    }
    return { ...proposal, status: decision.action };
  });

  const staffOver = { ...snapshot.staffOver };
  for (const proposal of snapshot.proposals) {
    const decision = decisionById.get(proposal.id);
    if (
      decision?.action === "approved" &&
      proposalPayloadHash(proposal) === decision.payload_hash
    ) {
      staffOver[proposal.staffId] = {
        ...staffOver[proposal.staffId],
        rank: proposal.toRank,
        title: proposal.title,
      };
    }
  }

  const completionByTask = new Map(completions.map((completion) => [completion.task_id, completion]));
  const tasks = snapshot.tasks.map((task) => {
    const completion = completionByTask.get(task.id);
    if (completion && taskCompletionHash(task) === completion.task_hash && resultContentHash(task.result ?? "") === completion.result_hash) {
      return { ...task, status: "done" as const, progress: 100 };
    }
    return task;
  });

  return { ...snapshot, proposals, staffOver, tasks };
}
