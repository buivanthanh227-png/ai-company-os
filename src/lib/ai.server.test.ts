import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { postJson } from "./ai.server.ts";

const originalFetch = globalThis.fetch;
const diagnostic = { provider: "gemini" as const, model: "test-model" };

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("retries a 429 response once and accepts the next successful response", async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return calls === 1
      ? new Response(JSON.stringify({ error: { code: 429 } }), { status: 429 })
      : new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "ok" }] } }] }), { status: 200 });
  };

  const result = await postJson("https://provider.test", {}, {}, diagnostic);
  assert.equal(calls, 2);
  assert.deepEqual(result, { candidates: [{ content: { parts: [{ text: "ok" }] } }] });
});

test("retries a 5xx response once", async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return calls === 1
      ? new Response("temporary", { status: 503 })
      : new Response(JSON.stringify({ choices: [] }), { status: 200 });
  };

  await postJson("https://provider.test", {}, {}, diagnostic);
  assert.equal(calls, 2);
});

test("detects an error embedded in an HTTP 200 response", async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response(JSON.stringify({ error: { code: 401, message: "redacted" } }), { status: 200 });
  };

  await assert.rejects(
    postJson("https://provider.test", {}, {}, diagnostic),
    /Provider returned an error payload/,
  );
  assert.equal(calls, 1);
});

test("retries a transient network failure once", async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    if (calls === 1) throw new TypeError("network unavailable");
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };

  const result = await postJson("https://provider.test", {}, {}, diagnostic);
  assert.equal(calls, 2);
  assert.deepEqual(result, { ok: true });
});

test("does not retry non-retryable authentication failures", async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response("unauthorized", { status: 401 });
  };

  await assert.rejects(postJson("https://provider.test", {}, {}, diagnostic), /Provider request failed/);
  assert.equal(calls, 1);
});


test("does not retry HTTP 403 or 404 responses", async () => {
  for (const status of [403, 404]) {
    let calls = 0;
    globalThis.fetch = async () => {
      calls += 1;
      return new Response("rejected", { status });
    };

    await assert.rejects(
      postJson("https://provider.test", {}, {}, diagnostic),
      /Provider request failed/,
    );
    assert.equal(calls, 1);
  }
});

test("does not retry an HTTP 200 error with string status 401", async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response(JSON.stringify({ error: { status: "401" } }), { status: 200 });
  };

  await assert.rejects(
    postJson("https://provider.test", {}, {}, diagnostic),
    /Provider returned an error payload/,
  );
  assert.equal(calls, 1);
});

test("retries an HTTP 200 error with string status 429", async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return calls === 1
      ? new Response(JSON.stringify({ error: { status: "429" } }), { status: 200 })
      : new Response(JSON.stringify({ ok: true }), { status: 200 });
  };

  const result = await postJson("https://provider.test", {}, {}, diagnostic);
  assert.deepEqual(result, { ok: true });
  assert.equal(calls, 2);
});

test("retries invalid or empty JSON responses once", async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return calls === 1
      ? new Response("", { status: 200 })
      : new Response(JSON.stringify({ ok: true }), { status: 200 });
  };

  const result = await postJson("https://provider.test", {}, {}, diagnostic);
  assert.deepEqual(result, { ok: true });
  assert.equal(calls, 2);
});
