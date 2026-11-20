import { z } from "zod";

const env = (name: string): string | undefined => {
  const value = process.env[name]?.trim();
  return value || undefined;
};

const REQUEST_TIMEOUT_MS = 45_000;
const MAX_OUTPUT_TOKENS = 2048;

export const aiChatInputSchema = z.object({
  message: z.string().trim().min(1).max(12_000),
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
export type AiProvider = "gemini" | "openrouter";

export type AiReply = {
  text: string;
  provider: AiProvider;
  model: string;
  fallbackUsed: boolean;
};

type ProviderFailure = Error & {
  status?: number;
  retryable?: boolean;
};

function providerFailure(message: string, status?: number): ProviderFailure {
  const error = new Error(message) as ProviderFailure;
  error.status = status;
  error.retryable =
    status === undefined ||
    status === 408 ||
    status === 409 ||
    status === 429 ||
    status >= 500;
  return error;
}

async function postJson(url: string, headers: HeadersInit, body: unknown): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw providerFailure("Provider network or timeout failure");
  }

  if (!response.ok) {
    // Do not propagate provider response bodies: they can contain internal details.
    throw providerFailure("Provider request failed", response.status);
  }

  try {
    return await response.json();
  } catch {
    throw providerFailure("Provider returned invalid JSON");
  }
}

function extractGeminiText(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const candidates = (payload as { candidates?: unknown[] }).candidates;
  if (!Array.isArray(candidates)) return "";
  const first = candidates[0] as
    | { content?: { parts?: Array<{ text?: unknown }> } }
    | undefined;
  return (
    first?.content?.parts
      ?.map((part) => (typeof part.text === "string" ? part.text : ""))
      .join("")
      .trim() ?? ""
  );
}

function extractOpenRouterText(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const choices = (payload as {
    choices?: Array<{ message?: { content?: unknown } }>;
  }).choices;
  const content = choices?.[0]?.message?.content;
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((part) =>
        part && typeof part === "object" && "text" in part && typeof part.text === "string"
          ? part.text
          : "",
      )
      .join("")
      .trim();
  }
  return "";
}

const SYSTEM_INSTRUCTION =
  "Bạn là CEO trợ lý của AI COMPANY OS. Trả lời bằng tiếng Việt, rõ ràng, có cấu trúc. " +
  "Phân biệt đề xuất với hành động đã thực hiện. Không tuyên bố đã sửa mã, tạo PR, triển khai " +
  "hay gọi công cụ nếu yêu cầu hiện tại chưa thực sự thực hiện các hành động đó.";

async function callGemini(input: AiChatInput): Promise<AiReply> {
  const apiKey = env("GEMINI_API_KEY");
  if (!apiKey) throw providerFailure("Gemini API key is not configured");

  const model = env("GEMINI_MODEL") ?? "gemini-2.5-flash";
  const contents = [
    ...input.history.map((item) => ({
      role: item.role === "assistant" ? "model" : "user",
      parts: [{ text: item.content }],
    })),
    { role: "user", parts: [{ text: input.message }] },
  ];

  const payload = await postJson(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    {
      systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
      contents,
      generationConfig: { maxOutputTokens: MAX_OUTPUT_TOKENS, temperature: 0.4 },
    },
  );
  const text = extractGeminiText(payload);
  if (!text) throw providerFailure("Gemini returned an empty response");
  return { text, provider: "gemini", model, fallbackUsed: false };
}

async function callOpenRouter(input: AiChatInput): Promise<AiReply> {
  const apiKey = env("OPENROUTER_API_KEY");
  if (!apiKey) throw providerFailure("OpenRouter API key is not configured");

  const model = env("OPENROUTER_MODEL") ?? "openrouter/free";
  const messages = [
    { role: "system", content: SYSTEM_INSTRUCTION },
    ...input.history.map((item) => ({
      role: item.role === "assistant" ? "assistant" : "user",
      content: item.content,
    })),
    { role: "user", content: input.message },
  ];
  const payload = await postJson(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "X-Title": "AI COMPANY OS",
    },
    { model, messages, max_tokens: MAX_OUTPUT_TOKENS, temperature: 0.4 },
  );
  const text = extractOpenRouterText(payload);
  if (!text) throw providerFailure("OpenRouter returned an empty response");
  return { text, provider: "openrouter", model, fallbackUsed: true };
}

export async function runAiChat(rawInput: unknown): Promise<AiReply> {
  const input = aiChatInputSchema.parse(rawInput);
  const hasGeminiKey = Boolean(env("GEMINI_API_KEY"));
  const hasOpenRouterKey = Boolean(env("OPENROUTER_API_KEY"));

  if (!hasGeminiKey && !hasOpenRouterKey) {
    throw new Error("AI_NOT_CONFIGURED");
  }

  if (!hasGeminiKey && hasOpenRouterKey) {
    return callOpenRouter(input);
  }

  try {
    return await callGemini(input);
  } catch (error) {
    const failure = error as ProviderFailure;
    if (!hasOpenRouterKey || failure.retryable === false) {
      throw new Error("AI_PROVIDER_UNAVAILABLE");
    }
    const reply = await callOpenRouter(input);
    return { ...reply, fallbackUsed: true };
  }
}

export async function testAiConnection(): Promise<Omit<AiReply, "text">> {
  const reply = await runAiChat({
    message: "Trả lời đúng một câu: Kết nối AI COMPANY OS đã hoạt động.",
    history: [],
  });
  return {
    provider: reply.provider,
    model: reply.model,
    fallbackUsed: reply.fallbackUsed,
  };
}
