import { createContext, useContext, useMemo, useState, useCallback } from 'react';
import { createUserId } from '../utils/ids';
import { loadProfile, saveProfile } from '../services/userStorage';

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [userId] = useState(createUserId);
  const [profile, setProfileState] = useState(() => loadProfile());

  const setProfile = useCallback((patch) => {
    setProfileState((prev) => {
      const next = { ...prev, ...patch };
      saveProfile(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      userId,
      profile,
      setProfile,
      isReady: Boolean(profile.nickname?.trim()),
    }),
    [userId, profile, setProfile]
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser must be used within UserProvider');
  return ctx;
}
