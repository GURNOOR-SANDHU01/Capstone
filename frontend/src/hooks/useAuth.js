import { useState, useEffect, useCallback } from 'react';
import { onAuthStateChange, logoutUser, fetchAppUser, isRealFirebaseConfigured } from '../services/firebase';
import { describeError } from '../services/apiClient';

export function useAuth() {
  const [currentUser, setCurrentUser] = useState(null);
  const [authInitialized, setAuthInitialized] = useState(false);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    let isSubscribed = true;

    const unsubscribe = onAuthStateChange(
      (user) => {
        if (!isSubscribed) return;
        setCurrentUser(user);
        if (user) setAuthError("");
        setAuthInitialized(true);
      },
      (err) => {
        if (isSubscribed) setAuthError(describeError(err));
      }
    );

    const fallbackTimer = setTimeout(() => {
      if (isSubscribed) {
        setAuthInitialized(true);
      }
    }, isRealFirebaseConfigured ? 8000 : 1500);

    return () => {
      isSubscribed = false;
      clearTimeout(fallbackTimer);
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  const logout = async () => {
    await logoutUser();
    setCurrentUser(null);
  };

  /** Re-reads the profile from the backend (live mode) after a server-side change. */
  const refreshUser = useCallback(async () => {
    if (!isRealFirebaseConfigured) return null;
    const user = await fetchAppUser();
    setCurrentUser(user);
    return user;
  }, []);

  return {
    currentUser,
    setCurrentUser,
    authInitialized,
    authError,
    setAuthError,
    refreshUser,
    logout
  };
}
