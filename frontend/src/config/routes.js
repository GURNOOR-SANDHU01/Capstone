/**
 * URL <-> tab mapping per role, so every portal page has a real, bookmarkable path:
 *   patient  /dashboard, /dashboard/google-fit, /dashboard/journal, ...
 *   doctor   /doctor, /doctor/wellness, ...
 *   admin    /admin, /admin/users, ...
 * A path that belongs to another role resolves to the user's own home page. This is a UI
 * convenience only: the API enforces the role on every request.
 */
import { ROLES } from "../constants/roles";
import { getNavigationForRole } from "./navigationConfig";

const BASE = { [ROLES.PATIENT]: "/dashboard", [ROLES.DOCTOR]: "/doctor", [ROLES.ADMIN]: "/admin" };
const HOME = { [ROLES.PATIENT]: "dashboard", [ROLES.DOCTOR]: "doctor-dashboard", [ROLES.ADMIN]: "admin-dashboard" };
const PREFIX = { [ROLES.PATIENT]: "", [ROLES.DOCTOR]: "doctor-", [ROLES.ADMIN]: "admin-" };

const roleOf = (role) => (BASE[role] ? role : ROLES.PATIENT);

export const homeTabFor = (role) => HOME[roleOf(role)];

export function tabToPath(role, tab) {
  const r = roleOf(role);
  if (!tab || tab === HOME[r]) return BASE[r];
  const slug = PREFIX[r] && tab.startsWith(PREFIX[r]) ? tab.slice(PREFIX[r].length) : tab;
  return `${BASE[r]}/${slug}`;
}

export function pathToTab(role, pathname) {
  const r = roleOf(role);
  const valid = new Set(getNavigationForRole(r).map((n) => n.id));
  const path = (pathname || "/").replace(/\/+$/, "") || "/";
  if (path === BASE[r]) return HOME[r];
  if (path.startsWith(`${BASE[r]}/`)) {
    const slug = path.slice(BASE[r].length + 1);
    for (const candidate of [`${PREFIX[r]}${slug}`, slug]) if (valid.has(candidate)) return candidate;
  }
  return HOME[r];
}
