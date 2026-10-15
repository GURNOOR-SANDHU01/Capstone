import { isRealFirebaseConfigured, toAppUser, auth, saveSandboxUser } from "./firebase";
import { api } from "./apiClient";

/**
 * Saves editable profile fields and returns the refreshed app user.
 * Live: PATCH /api/users/me (the backend rejects role or other protected fields).
 */
export async function updateMyProfile(currentUser, { name, mobile }) {
  if (!isRealFirebaseConfigured) {
    const updated = { ...currentUser, profile: { ...(currentUser.profile || {}), name, mobile } };
    saveSandboxUser(updated);
    return updated;
  }
  const body = {};
  if (name) body.full_name = name;
  if (mobile) body.phone = mobile;
  const { data } = await api.patch("/users/me", body);
  return toAppUser(auth?.currentUser, data);
}
