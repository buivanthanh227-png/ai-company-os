import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { aiChatInputSchema } from "./ai.shared";

export const sendAiMessage = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((input: unknown) => aiChatInputSchema.parse(input))
  .handler(async ({ data }) => {
    const { runAiChat, toPublicAiError } = await import("./ai.server");
    try {
      return await runAiChat(data);
    } catch (error) {
      throw toPublicAiError(error);
    }
  });

export const checkAiConnection = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { assertLiveDiagnosticsAllowed, testAiConnection, toPublicAiError } = await import("./ai.server");
    try {
      assertLiveDiagnosticsAllowed(context.userId);
      return await testAiConnection();
    } catch (error) {
      throw toPublicAiError(error);
    }
  });

export const getAiProviderReadiness = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async () => {
    const { getAiProviderReadiness } = await import("./ai.server");
    return getAiProviderReadiness();
  });
