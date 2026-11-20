import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { aiChatInputSchema } from "./ai.shared";

export const sendAiMessage = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((input: unknown) => aiChatInputSchema.parse(input))
  .handler(async ({ data }) => {
    const { runAiChat } = await import("./ai.server");
    return runAiChat(data);
  });

export const checkAiConnection = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async () => {
    const { testAiConnection } = await import("./ai.server");
    return testAiConnection();
  });
