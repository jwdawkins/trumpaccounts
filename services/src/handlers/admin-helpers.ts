/** Admin-authorization helper shared by the admin ops handlers (§7.3, §8). */
export interface AdminIdentity {
  adminId: string;
}

/**
 * Require the JWT caller to be in the Cognito `admins` group. The
 * `cognito:groups` claim may arrive as an array or a bracketed string
 * depending on the token/authorizer, so handle both.
 */
export function requireAdmin(
  claims: Record<string, unknown> | undefined,
): AdminIdentity | null {
  const sub = claims?.sub;
  const groups = claims?.["cognito:groups"];
  const inAdmins = Array.isArray(groups)
    ? groups.includes("admins")
    : typeof groups === "string" && /\badmins\b/.test(groups);
  if (!inAdmins || typeof sub !== "string") return null;
  return { adminId: sub };
}
