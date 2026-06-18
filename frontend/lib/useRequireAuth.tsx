"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

/**
 * Client-side guard for authenticated routes. Redirects unauthenticated users to
 * /login with a return path once the Firebase auth state has resolved. Returns
 * `ready` — true only when a signed-in user is confirmed — so pages can hold
 * their render until then.
 */
export function useRequireAuth() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      const here = window.location.pathname + window.location.search;
      router.replace(`/login?redirect=${encodeURIComponent(here)}`);
    }
  }, [user, loading, router]);

  return { user, loading, ready: !loading && !!user };
}

export function AuthChecking() {
  return (
    <main className="min-h-screen bg-bg text-slate-100 grid place-items-center p-6">
      <p className="text-sm text-slate-400">A verificar sessão…</p>
    </main>
  );
}
