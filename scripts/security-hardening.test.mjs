import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { APP_ENV_ROUTE, appEnvPlugin } from "./app-env-plugin.mjs";

function invokeEnvRoute(remoteAddress) {
  let middleware;
  appEnvPlugin().configureServer({
    config: { env: { VITE_AUTH_ENABLED: "false" } },
    middlewares: { use(handler) { middleware = handler; } },
  });
  const headers = new Map();
  const response = {
    statusCode: 200,
    body: "",
    setHeader(name, value) { headers.set(name.toLowerCase(), value); },
    end(value = "") { this.body += value; },
  };
  let nextCalled = false;
  middleware(
    { url: APP_ENV_ROUTE, method: "GET", socket: { remoteAddress } },
    response,
    () => { nextCalled = true; },
  );
  return { response, headers, nextCalled };
}

test("dev app-env endpoint refuses non-loopback clients", () => {
  const { response, headers, nextCalled } = invokeEnvRoute("192.168.1.20");
  assert.equal(response.statusCode, 403);
  assert.equal(response.body, "");
  assert.equal(headers.get("cache-control"), "no-store");
  assert.equal(nextCalled, false);
});

test("dev app-env endpoint remains available to IPv4 and IPv6 loopback", () => {
  for (const address of ["127.0.0.1", "::1", "::ffff:127.0.0.1"]) {
    const { response, nextCalled } = invokeEnvRoute(address);
    assert.equal(response.statusCode, 200);
    assert.deepEqual(JSON.parse(response.body), { VITE_AUTH_ENABLED: "false" });
    assert.equal(nextCalled, false);
  }
});

test("connector readiness server function requires the verified auth middleware", () => {
  const source = readFileSync(new URL("../src/lib/app-data/readiness.ts", import.meta.url), "utf8");
  assert.match(source, /import \{ authMiddleware \} from ["']@\/lib\/auth\/middleware["']/);
  assert.match(source, /\.middleware\(\[authMiddleware\]\)/);
});

test("auth diagnostics do not log cookie previews or raw error objects", () => {
  const source = readFileSync(new URL("../src/lib/auth/gate-session.server.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /cookiePreview/);
  assert.match(source, /function safeErrorType\(error: unknown\)/);
  assert.doesNotMatch(source, /console\.error\([^;]*,\s*err\s*\)/s);
  assert.doesNotMatch(source, /error:\s*result\.error/);
});

test("OAuth popup and migration failures expose stable details only", () => {
  const popup = readFileSync(new URL("../src/lib/auth/popup.server.ts", import.meta.url), "utf8");
  const migration = readFileSync(new URL("./migrate.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(popup, /await apiRes\.text\(\)/);
  assert.doesNotMatch(popup, /err\.message/);
  assert.doesNotMatch(migration, /err\?\.message|err\[key\]/);
  assert.match(migration, /errorType, code/);
});
