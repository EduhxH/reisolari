"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { getQuestionnaireStatus } from "@/lib/questionnaire";

/**
 * Guard for pages that require a completed questionnaire (the primary onboarding
 * action). Redirects unauthenticated users to /login and authenticated-but-not-
 * yet-onboarded users to /questionario. If the backend is unreachable, it fails
 * open so the user is never trapped.
 */
export function useRequireQuestionnaire() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      const here = window.location.pathname + window.location.search;
      router.replace(`/login?redirect=${encodeURIComponent(here)}`);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const token = await user.getIdToken();
        const done = await getQuestionnaireStatus(token);
        if (cancelled) return;
        setCompleted(done);
        if (!done) router.replace("/questionario");
      } catch {
        if (!cancelled) setCompleted(true); // backend down — don't trap the user
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, loading, router]);

  return { user, ready: !loading && !!user && !checking && completed };
}
