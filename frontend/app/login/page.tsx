"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { LockKeyhole, Mail } from "lucide-react";
import AuthExtraMethods from "@/components/AuthExtraMethods";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/lib/auth";
import { getRedirectTarget, translateAuthError } from "@/lib/authErrors";
import { ANUNCIAR_ROUTE, consumeSellerIntent, hasSellerIntent } from "@/lib/onboarding";
import { upsertSellerProfile } from "@/lib/seller";
import { getQuestionnaireStatus } from "@/lib/questionnaire";

export default function LoginPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

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
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-white px-5 py-12 text-supaste-ink">
      <div
        className="absolute inset-0 -z-10 bg-cover bg-center opacity-85"
        style={{ backgroundImage: "url('/images/landing-background-top.jpeg')" }}
      />
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-white/62 via-white/88 to-white" />

      <Link
        href="/"
        className="supaste-glass-strong fixed left-5 top-5 z-10 flex items-center gap-3 rounded-full px-4 py-2 text-sm font-bold text-supaste-black"
      >
        <span className="relative h-8 w-8 overflow-hidden rounded-full border border-black/10 bg-white">
          <Image src="/images/reisolari-logo.jpeg" alt="Reisolari" fill className="object-cover" />
        </span>
        Reisolari
      </Link>

      <section className="supaste-glass-strong w-full max-w-[430px] rounded-[32px] p-6 shadow-supaste-frame sm:p-8">
        <div className="text-center">
          <p className="font-mono text-xs uppercase text-supaste-blue">Acesso seguro</p>
          <h1 className="mt-3 font-display text-4xl font-bold tracking-[-0.04em] text-supaste-black">
            Iniciar sessao
          </h1>
          <p className="mt-3 text-sm leading-6 text-supaste-muted">
            Entre para guardar simulacoes, falar com vendedores e continuar o marketplace solar.
          </p>
        </div>

        <form onSubmit={handleEmailLogin} className="mt-7 space-y-3">
          <label className="block space-y-1.5">
            <span className="flex items-center gap-2 text-xs font-semibold text-supaste-muted">
              <Mail className="h-3.5 w-3.5" /> Email
            </span>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-supaste-black outline-none transition-colors duration-300 placeholder:text-supaste-muted/70 focus:border-supaste-blue"
              placeholder="email@exemplo.pt"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="flex items-center justify-between gap-2 text-xs font-semibold text-supaste-muted">
              <span className="flex items-center gap-2">
                <LockKeyhole className="h-3.5 w-3.5" /> Palavra-passe
              </span>
              <Link href="/recuperar-senha" className="text-supaste-blue hover:text-supaste-black">
                Recuperar
              </Link>
            </span>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-supaste-black outline-none transition-colors duration-300 placeholder:text-supaste-muted/70 focus:border-supaste-blue"
              placeholder="Introduza a sua palavra-passe"
            />
          </label>

          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            className="supaste-button min-h-[48px] w-full rounded-full bg-supaste-black px-5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? "A entrar..." : "Entrar"}
          </button>

          <AuthExtraMethods onSuccess={onSuccess} onError={setError} />
        </form>

        <p className="mt-6 text-center text-sm text-supaste-muted">
          Ainda nao tem conta?{" "}
          <Link href="/criar-conta" className="font-semibold text-supaste-blue hover:text-supaste-black">
            Criar conta
          </Link>
        </p>
      </section>
    </main>
  );
}
