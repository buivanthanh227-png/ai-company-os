/**
 * Server-side owner authorization. Never accept a role or actor from the client.
 * Shared "dev-user" identity is intentionally rejected because it cannot
 * distinguish the owner from other visitors in single-user deployment mode.
 */
export function requireOwnerUserId(userId: string): void {
  if (!userId || userId === "dev-user") {
    throw new Error("OWNER_IDENTITY_NOT_UNIQUE");
  }
  const allowed = (process.env.AI_COMPANY_OWNER_USER_IDS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (allowed.length === 0) {
    throw new Error("OWNER_AUTHORIZATION_NOT_CONFIGURED");
  }
  if (!allowed.includes(userId)) {
    throw new Error("OWNER_FORBIDDEN");
  }
}
