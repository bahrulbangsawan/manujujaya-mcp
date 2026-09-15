export const SCOPES = {
  READ: "qasir:read",
  WRITE: "qasir:write",
  ADMIN: "qasir:admin",
} as const;

export type Scope = (typeof SCOPES)[keyof typeof SCOPES];

export function hasScope(granted: string[] | undefined, needed: Scope): boolean {
  if (!granted) return false;
  if (granted.includes(SCOPES.ADMIN)) return true;
  if (needed === SCOPES.READ) {
    return (
      granted.includes(SCOPES.READ) ||
      granted.includes(SCOPES.WRITE) ||
      granted.includes(SCOPES.ADMIN)
    );
  }
  return granted.includes(needed);
}
