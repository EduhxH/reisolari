"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import {
  onAuthStateChanged,
  signOut as firebaseSignOut,
  type User
} from "firebase/auth";
import { auth } from "@/lib/firebase";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, nextUser => {
      setUser(nextUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      signOut: () => firebaseSignOut(auth),
      getIdToken: async () => (user ? user.getIdToken() : null)
    }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}

/** Human-friendly label for the current user across all providers. */
export function displayNameFor(user: User | null): string {
  if (!user) return "";
  if (user.isAnonymous) return "Convidado";
  return user.displayName || user.email || user.phoneNumber || "Conta";
}
