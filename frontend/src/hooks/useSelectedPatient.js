import { useState } from 'react';

/** Selected patient id, defaulting to the first patient in the roster. */
export function useSelectedPatient(roster) {
  const [patientId, setPatientId] = useState("");
  return [patientId || roster.data?.[0]?.id || "", setPatientId];
}
