/** Only Vercel-managed deployment hosts are covered by this project's SSO protection policy. */
export function isProtectedVercelHostname(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase().replace(/\.$/, "");
  return normalized.endsWith(".vercel.app");
}
