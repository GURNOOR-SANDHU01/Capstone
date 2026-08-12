import { hasPermission } from '../constants/permissions';
import { ROLES } from '../constants/roles';

export function usePermissions(currentUser) {
  const userRole = currentUser?.role || ROLES.PATIENT;

  const can = (permission) => {
    return hasPermission(userRole, permission);
  };

  return {
    userRole,
    can
  };
}
