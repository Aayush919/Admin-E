import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { User } from '../types';
import {
  clearSession,
  getSiteTag,
  getToken,
  getUser,
  setSiteTag,
  setToken,
  setUser,
} from '../lib/storage';

interface AuthState {
  token: string | null;
  siteTag: string | null;
  user: User | null;
  isAuthenticated: boolean;
  login: (payload: { token: string; siteTag: string; user: User }) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() => getToken());
  const [siteTag, setSiteTagState] = useState<string | null>(() => getSiteTag());
  const [user, setUserState] = useState<User | null>(() => getUser<User>());

  useEffect(() => {
    setTokenState(getToken());
    setSiteTagState(getSiteTag());
    setUserState(getUser<User>());
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      token,
      siteTag,
      user,
      isAuthenticated: Boolean(token && siteTag),
      login: ({ token, siteTag, user }) => {
        setToken(token);
        setSiteTag(siteTag);
        setUser(user);
        setTokenState(token);
        setSiteTagState(siteTag);
        setUserState(user);
      },
      logout: () => {
        clearSession();
        setTokenState(null);
        setSiteTagState(null);
        setUserState(null);
      },
    }),
    [token, siteTag, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
