import { randomUUID } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import type { Sql } from "@/lib/db";
import { requireOwnerUserId } from "@/lib/auth/owner.server";
import type { Snapshot } from "@/lib/store";
import type { Proposal, Task } from "@/lib/types";
import {
  applyAuthoritativeWorkspaceRecords,
  proposalPayloadHash,
  resultContentHash,
  sanitizeClientSnapshot,
  taskCompletionHash,
} from "@/lib/workspace-integrity.server";

const snapshotSchema = z.object({
  staffOver: z.record(z.string(), z.unknown()),
  projects: z.array(z.unknown()).max(1000),
  missions: z.array(z.unknown()).max(2000),
  tasks: z.array(z.unknown()).max(5000),
  activity: z.array(z.unknown()).max(2000),
  messages: z.array(z.unknown()).max(1000),
  proposals: z.array(z.unknown()).max(1000),
  settings: z.record(z.string(), z.unknown()),
});

const ownerDecisionInput = z.object({
  proposalId: z.string().min(1).max(128),
  action: z.enum(["approved", "rejected"]),
});

const completeTaskInput = z.object({
  taskId: z.string().min(1).max(128),
});

function requireWorkspaceDatabase(): void {
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error("WORKSPACE_DATABASE_NOT_CONFIGURED");
  }
}

async function readSnapshotForUser(userId: string, sql: Sql): Promise<Snapshot> {
  const rows = await sql.query<{ snapshot: unknown }>(
    "select snapshot from app_state where user_id = $1 limit 1",
    [userId],
  );
  if (!rows[0]) throw new Error("WORKSPACE_SNAPSHOT_NOT_FOUND");
  return sanitizeClientSnapshot(snapshotSchema.parse(rows[0].snapshot) as Snapshot);
}

export const loadWorkspaceSnapshot = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    if (!process.env.DATABASE_URL?.trim()) return null;
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const rows = await sql.query<{ snapshot: unknown }>(
      "select snapshot from app_state where user_id = $1 limit 1",
      [context.userId],
    );
    if (!rows[0]) return null;

    const snapshot = sanitizeClientSnapshot(snapshotSchema.parse(rows[0].snapshot) as Snapshot);
    const decisions = await sql.query<{
      proposal_id: string;
      action: "approved" | "rejected";
      payload_hash: string;
      actor_user_id: string;
      created_at: string;
    }>(
      "select proposal_id, action, payload_hash, actor_user_id, created_at::text as created_at from proposal_decisions where user_id = $1",
      [context.userId],
    );
    const completions = await sql.query<{
      task_id: string;
      task_hash: string;
      result_hash: string;
      actor_user_id: string;
      created_at: string;
    }>(
      "select task_id, task_hash, result_hash, actor_user_id, created_at::text as created_at from task_completion_attestations where user_id = $1",
      [context.userId],
    );
    return applyAuthoritativeWorkspaceRecords(snapshot, decisions, completions);
  });

export const saveWorkspaceSnapshot = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((input: unknown) =>
    z.object({ snapshot: snapshotSchema }).parse(input),
  )
  .handler(async ({ data, context }) => {
    requireWorkspaceDatabase();
    const safeSnapshot = sanitizeClientSnapshot(data.snapshot as Snapshot);
    const serialized = JSON.stringify(safeSnapshot);
    if (new TextEncoder().encode(serialized).byteLength > 1_000_000) {
      throw new Error("Workspace snapshot exceeds the 1 MB storage limit");
    }

    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    await sql.query(
      `insert into app_state (user_id, snapshot, updated_at)
       values ($1, $2::jsonb, now())
       on conflict (user_id) do update
       set snapshot = excluded.snapshot, updated_at = now()`,
      [context.userId, serialized],
    );
    return { saved: true };
  });

export const decideProposal = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((input: unknown) => ownerDecisionInput.parse(input))
  .handler(async ({ data, context }) => {
    requireOwnerUserId(context.userId);
    requireWorkspaceDatabase();
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const snapshot = await readSnapshotForUser(context.userId, sql);
    const proposal = snapshot.proposals.find((item) => item.id === data.proposalId) as Proposal | undefined;
    if (!proposal) throw new Error("PROPOSAL_NOT_FOUND");

    const payloadHash = proposalPayloadHash(proposal);
    const nonce = randomUUID();
    const inserted = await sql.query<{ proposal_id: string }>(
      `insert into proposal_decisions
        (user_id, proposal_id, action, payload_hash, staff_id, to_rank, title, actor_user_id, nonce)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       on conflict (user_id, proposal_id) do nothing
       returning proposal_id`,
      [context.userId, proposal.id, data.action, payloadHash, proposal.staffId, proposal.toRank, proposal.title, context.userId, nonce],
    );
    if (!inserted[0]) {
      const existing = await sql.query<{ action: string; payload_hash: string }>(
        "select action, payload_hash from proposal_decisions where user_id = $1 and proposal_id = $2 limit 1",
        [context.userId, proposal.id],
      );
      if (existing[0]?.action === data.action && existing[0]?.payload_hash === payloadHash) {
        return { decided: true, idempotent: true, action: data.action };
      }
      throw new Error("PROPOSAL_ALREADY_DECIDED");
    }
    return { decided: true, idempotent: false, action: data.action };
  });

export const completeTask = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((input: unknown) => completeTaskInput.parse(input))
  .handler(async ({ data, context }) => {
    requireOwnerUserId(context.userId);
    requireWorkspaceDatabase();
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const snapshot = await readSnapshotForUser(context.userId, sql);
    const task = snapshot.tasks.find((item) => item.id === data.taskId) as Task | undefined;
    if (!task) throw new Error("TASK_NOT_FOUND");
    if (task.status !== "running" && task.status !== "review") {
      throw new Error("TASK_NOT_READY_FOR_ATTESTATION");
    }
    const result = task.result?.trim() ?? "";
    if (!result) throw new Error("TASK_RESULT_REQUIRED");

    const taskHash = taskCompletionHash(task);
    const resultHash = resultContentHash(result);
    const nonce = randomUUID();
    const inserted = await sql.query<{ task_id: string }>(
      `insert into task_completion_attestations
        (user_id, task_id, task_hash, result_hash, actor_user_id, nonce)
       values ($1, $2, $3, $4, $5, $6)
       on conflict (user_id, task_id, task_hash) do nothing
       returning task_id`,
      [context.userId, task.id, taskHash, resultHash, context.userId, nonce],
    );
    if (!inserted[0]) {
      const existing = await sql.query<{ result_hash: string }>(
        "select result_hash from task_completion_attestations where user_id = $1 and task_id = $2 and task_hash = $3 limit 1",
        [context.userId, task.id, taskHash],
      );
      if (existing[0]?.result_hash !== resultHash) throw new Error("TASK_ATTESTATION_CONFLICT");
      return { completed: true, idempotent: true, attestationType: "owner_manual" as const };
    }
    return { completed: true, idempotent: false, attestationType: "owner_manual" as const };
  });
