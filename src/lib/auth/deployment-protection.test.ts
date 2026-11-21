import assert from "node:assert/strict";
import { test } from "node:test";
import { isProtectedVercelHostname } from "./deployment-protection.server.ts";

test("single-user mode accepts only Vercel-managed deployment hostnames", () => {
  assert.equal(isProtectedVercelHostname("ai-company-os-ivory.vercel.app"), true);
  assert.equal(isProtectedVercelHostname("ai-company-h8dauiaz5-buivanthanh227-9771.vercel.app"), true);
  assert.equal(isProtectedVercelHostname("ai-company.example.com"), false);
  assert.equal(isProtectedVercelHostname("localhost"), false);
  assert.equal(isProtectedVercelHostname("vercel.app"), false);
  assert.equal(isProtectedVercelHostname(" ai-company-os-ivory.vercel.app. "), true);
});
