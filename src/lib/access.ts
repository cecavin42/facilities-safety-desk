export type Role = "user" | "admin";
export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
};
export const ROLE_LABELS: Record<Role, string> = {
  user: "Employee",
  admin: "Safety manager / admin",
};
export function isAdmin(user: CurrentUser) {
  return user.role === "admin";
}
