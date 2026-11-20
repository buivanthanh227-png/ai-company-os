import { z } from "zod";

export const aiChatInputSchema = z.object({
  message: z.string().trim().min(1).max(8_000),
  context: z.string().max(4_000).optional(),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(4_000),
      }),
    )
    .max(8)
    .default([]),
});

export type AiChatInput = z.infer<typeof aiChatInputSchema>;
