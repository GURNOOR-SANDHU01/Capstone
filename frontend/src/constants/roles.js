/**
 * Central Role Model Definitions
 * Strictly scoped user roles for SentiMed Platform.
 */

export const ROLES = {
  PATIENT: "patient",
  DOCTOR: "doctor",
  ADMIN: "admin"
};

export const ROLE_LABELS = {
  [ROLES.PATIENT]: "Patient",
  [ROLES.DOCTOR]: "Doctor / Care Coordinator",
  [ROLES.ADMIN]: "Platform Administrator"
};
