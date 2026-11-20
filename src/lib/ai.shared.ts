import { z } from "zod";

export const aiChatInputSchema = z.object({
  message: z.string().trim().min(1).max(12_000),
  context: z.string().max(6_000).optional(),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(12_000),
      }),
    )
    .max(12)
    .default([]),
});

export type AiChatInput = z.infer<typeof aiChatInputSchema>;
