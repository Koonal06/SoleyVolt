import type { ProfileRow } from "../../lib/supabase-data";

export type AppRole = ProfileRow["role"];

export const roleHomePath: Record<AppRole, string> = {
  user: "/app/dashboard",
  admin: "/admin/dashboard",
  superadmin: "/super-admin/dashboard",
};

export const roleLoginPath: Record<AppRole, string> = {
  user: "/login",
  admin: "/admin/login",
  superadmin: "/super-admin/login",
};

export function isElevatedRole(role: AppRole | null | undefined) {
  return role === "admin" || role === "superadmin";
}

export function isSuperAdminRole(role: AppRole | null | undefined) {
  return role === "superadmin";
}

export function canAccessRole(role: AppRole | null | undefined, allowedRoles: readonly AppRole[]) {
  return role ? allowedRoles.includes(role) : false;
}

export function getDefaultRouteForRole(role: AppRole | null | undefined) {
  return role ? roleHomePath[role] : roleHomePath.user;
}
