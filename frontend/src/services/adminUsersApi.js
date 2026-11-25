/** Admin user & role management (live backend only; the server enforces the admin role). */
import { isRealFirebaseConfigured } from "./firebase";
import { api } from "./apiClient";

export const adminUsersLive = () => isRealFirebaseConfigured;

export async function listAllUsers(role) {
  const { data } = await api.get("/admin/users", role ? { role } : undefined);
  return data || [];
}

/** The user must sign in again for the new role to apply (their tokens are revoked). */
export async function changeUserRole(uid, role) {
  const { data } = await api.post(`/admin/users/${encodeURIComponent(uid)}/role`, { role });
  return data;
}

/** Deactivating disables sign-in and ends all of the user's sessions immediately. */
export async function setUserActive(uid, active) {
  const { data } = await api.post(`/admin/users/${encodeURIComponent(uid)}/status`, { active });
  return data;
}
