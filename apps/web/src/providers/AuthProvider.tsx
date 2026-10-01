"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  beginGoogleSignIn,
  getStoredCognitoSession,
  signOutCognito,
  type CognitoUser,
} from "@/lib/auth/cognito";
import { isCognitoConfigured } from "@/lib/auth/config";

type AuthContextValue = {
  user: CognitoUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isConfigured: boolean;
  loginWithGoogle: (nextPath?: string) => Promise<void>;
  logout: () => void;
  refreshSession: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CognitoUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConfigured, setIsConfigured] = useState(false);

  const refreshSession = useCallback(() => {
    setUser(getStoredCognitoSession());
  }, []);

  useEffect(() => {
    setIsConfigured(isCognitoConfigured());
    refreshSession();
    setIsLoading(false);
  }, [refreshSession]);

  const loginWithGoogle = useCallback(async (nextPath = "/home") => {
    await beginGoogleSignIn(nextPath);
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    signOutCognito();
  }, []);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      isAuthenticated: Boolean(user),
      isConfigured,
      loginWithGoogle,
      logout,
      refreshSession,
    }),
    [user, isLoading, isConfigured, loginWithGoogle, logout, refreshSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
