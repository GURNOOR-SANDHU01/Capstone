import React from 'react';
import { usePermissions } from '../../hooks/usePermissions';

export function PermissionGate({ currentUser, permission, fallback = null, children }) {
  const { can } = usePermissions(currentUser);

  if (!can(permission)) {
    return fallback;
  }

  return <>{children}</>;
}
