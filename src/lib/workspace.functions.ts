import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import type { Snapshot } from "@/lib/store";

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

export const loadWorkspaceSnapshot = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const rows = await sql.query<{ snapshot: unknown }>(
      "select snapshot from app_state where user_id = $1 limit 1",
      [context.userId],
    );
    if (!rows[0]) return null;
    return snapshotSchema.parse(rows[0].snapshot) as Snapshot;
  });

export const saveWorkspaceSnapshot = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((input: unknown) =>
    z.object({ snapshot: snapshotSchema }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const serialized = JSON.stringify(data.snapshot);
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
