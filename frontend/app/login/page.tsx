"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/lib/auth";
import { getRedirectTarget, translateAuthError } from "@/lib/authErrors";
import { ANUNCIAR_ROUTE, consumeSellerIntent, hasSellerIntent } from "@/lib/onboarding";
import { upsertSellerProfile } from "@/lib/seller";
import { getQuestionnaireStatus } from "@/lib/questionnaire";
import AuthExtraMethods from "@/components/AuthExtraMethods";

export default function LoginPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Post-auth interceptor: sellers go to the ad wizard, everyone else to target.
  useEffect(() => {
    if (loading || !user) return;
    let cancelled = false;
    (async () => {
      if (hasSellerIntent()) {
        consumeSellerIntent();
        try {
          const token = await user.getIdToken();
          await upsertSellerProfile(token);
        } catch {
          // non-fatal: profile mark can be retried from the wizard
        }
        if (!cancelled) router.replace(ANUNCIAR_ROUTE);
      } else {
        // Onboarding obrigatório: encaminha para o questionário se ainda não o fez.
        try {
          const token = await user.getIdToken();
          const done = await getQuestionnaireStatus(token);
          if (!cancelled) router.replace(done ? getRedirectTarget() : "/questionario");
        } catch {
          if (!cancelled) router.replace(getRedirectTarget());
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, loading, router]);

  // Routing is handled by the interceptor effect once auth state updates.
  const onSuccess = () => {};

  const handleEmailLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      onSuccess();
    } catch (err) {
      setError(translateAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-bg text-slate-100 grid place-items-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <Link href="/" className="text-2xl font-bold text-white">
            Reisolari
          </Link>
          <p className="text-sm text-slate-400">Inicie sessão na sua conta</p>
        </div>

        <form
          onSubmit={handleEmailLogin}
          className="space-y-3 rounded-xl border border-slate-800 bg-card p-5"
        >
          <div className="space-y-1">
            <label className="text-xs text-slate-400">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-emerald-600"
              placeholder="email@exemplo.pt"
            />
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs text-slate-400">Palavra-passe</label>
              <Link
                href="/recuperar-senha"
                className="text-[11px] text-emerald-400 hover:text-emerald-300"
              >
                Esqueci a palavra-passe
              </Link>
            </div>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-emerald-600"
              placeholder="••••••••"
            />
          </div>

          {error ? (
            <div className="text-xs text-red-300 bg-red-950/40 border border-red-900/50 rounded-lg p-2.5">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-semibold rounded-lg py-2.5 text-sm transition-colors"
          >
            {busy ? "A entrar..." : "Entrar"}
          </button>

          <AuthExtraMethods onSuccess={onSuccess} onError={setError} />
        </form>

        <p className="text-center text-sm text-slate-400">
          Ainda não tem conta?{" "}
          <Link href="/criar-conta" className="text-emerald-400 hover:text-emerald-300 font-semibold">
            Criar conta
          </Link>
        </p>
      </div>
    </main>
  );
}
