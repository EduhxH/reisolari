"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  updateProfile,
  sendEmailVerification
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/lib/auth";
import { getRedirectTarget, translateAuthError } from "@/lib/authErrors";
import { ANUNCIAR_ROUTE, consumeSellerIntent, hasSellerIntent } from "@/lib/onboarding";
import { upsertSellerProfile } from "@/lib/seller";
import AuthExtraMethods from "@/components/AuthExtraMethods";

export default function CreateAccountPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Post-onboarding interceptor: a new seller is routed straight to the wizard.
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
          // non-fatal
        }
        if (!cancelled) router.replace(ANUNCIAR_ROUTE);
      } else if (!cancelled) {
        router.replace(getRedirectTarget());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, loading, router]);

  // Routing is handled by the interceptor effect once auth state updates.
  const onSuccess = () => {};

  const handleRegister = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("A palavra-passe deve ter pelo menos 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("As palavras-passe não coincidem.");
      return;
    }
    setBusy(true);
    try {
      const credential = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );
      if (name.trim()) {
        await updateProfile(credential.user, { displayName: name.trim() });
      }
      // Best-effort verification email; never blocks account creation.
      sendEmailVerification(credential.user).catch(() => undefined);
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
          <p className="text-sm text-slate-400">Crie a sua conta gratuita</p>
        </div>

        <form
          onSubmit={handleRegister}
          className="space-y-3 rounded-xl border border-slate-800 bg-card p-5"
        >
          <div className="space-y-1">
            <label className="text-xs text-slate-400">Nome</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-emerald-600"
              placeholder="Maria Silva"
            />
          </div>
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
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-slate-400">Palavra-passe</label>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-emerald-600"
                placeholder="••••••••"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-400">Confirmar</label>
              <input
                type="password"
                required
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-emerald-600"
                placeholder="••••••••"
              />
            </div>
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
            {busy ? "A criar conta..." : "Criar conta"}
          </button>

          <AuthExtraMethods onSuccess={onSuccess} onError={setError} />
        </form>

        <p className="text-center text-sm text-slate-400">
          Já tem conta?{" "}
          <Link href="/login" className="text-emerald-400 hover:text-emerald-300 font-semibold">
            Iniciar sessão
          </Link>
        </p>
      </div>
    </main>
  );
}
