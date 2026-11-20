import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { aiChatInputSchema, runAiChat, testAiConnection } from "./ai.server";

export const sendAiMessage = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((input: unknown) => aiChatInputSchema.parse(input))
  .handler(async ({ data }) => runAiChat(data));

export const checkAiConnection = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async () => testAiConnection());
