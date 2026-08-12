import { useMemo } from 'react';
import { getProfileCompletion } from '../services/screeningService';

export function useProfileCompletion(currentUser) {
  const completionData = useMemo(() => {
    return getProfileCompletion(currentUser);
  }, [currentUser]);

  return completionData;
}
