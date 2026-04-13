"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { getFirebaseAuth, isFirebaseConfigured } from "@/lib/firebase/clientApp";
import { isAllowedAppUser } from "@/lib/authPolicy";

export const AUTH_ERROR_DOMAIN = "AUTH_DOMAIN_NOT_ALLOWED";

type AuthState = {
  user: User | null;
  loading: boolean;
  configured: boolean;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = isFirebaseConfigured();
  const [user, setUser] = useState<User | null>(null);
  /** When Firebase is not configured, treat auth as "ready" immediately (no spinner). */
  const [authReady, setAuthReady] = useState(!configured);

  useEffect(() => {
    if (!configured) return;
    const auth = getFirebaseAuth();
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u && !isAllowedAppUser(u.email)) {
        await signOut(auth);
        setUser(null);
      } else {
        setUser(u);
      }
      setAuthReady(true);
    });
    return () => unsub();
  }, [configured]);

  const loading = configured && !authReady;

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      configured,
      signInWithGoogle: async () => {
        const auth = getFirebaseAuth();
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: "select_account" });
        const { user: signedIn } = await signInWithPopup(auth, provider);
        if (!isAllowedAppUser(signedIn.email)) {
          await signOut(auth);
          const err = new Error(AUTH_ERROR_DOMAIN);
          err.name = AUTH_ERROR_DOMAIN;
          throw err;
        }
      },
      signOutUser: async () => {
        await signOut(getFirebaseAuth());
      },
    }),
    [user, loading, configured]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
