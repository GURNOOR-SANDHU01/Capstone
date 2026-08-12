import { useState, useEffect } from 'react';
import { onAuthStateChange, logoutUser } from '../services/firebase';

export function useAuth() {
  const [currentUser, setCurrentUser] = useState(null);
  const [authInitialized, setAuthInitialized] = useState(false);

  useEffect(() => {
    let isSubscribed = true;

    const unsubscribe = onAuthStateChange((user) => {
      if (!isSubscribed) return;
      setCurrentUser(user);
      setAuthInitialized(true);
    });

    const fallbackTimer = setTimeout(() => {
      if (isSubscribed) {
        setAuthInitialized(true);
      }
    }, 1500);

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

  return {
    currentUser,
    setCurrentUser,
    authInitialized,
    logout
  };
}
