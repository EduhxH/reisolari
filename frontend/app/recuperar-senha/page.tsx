"use client";

import React, { useState } from "react";
import Link from "next/link";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { translateAuthError } from "@/lib/authErrors";

export default function PasswordResetPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleReset = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setSent(true);
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
          <p className="text-sm text-slate-400">Redefinir palavra-passe</p>
        </div>

        {sent ? (
          <div className="rounded-xl border border-slate-800 bg-card p-5 space-y-3 text-center">
            <div className="text-3xl">📧</div>
            <p className="text-sm text-slate-200">
              Enviámos um email para <strong>{email}</strong> com instruções para
              redefinir a sua palavra-passe.
            </p>
            <p className="text-xs text-slate-500">
              Verifique também a pasta de spam. O link é gerido pelo Firebase.
            </p>
            <Link
              href="/login"
              className="inline-block text-sm font-semibold text-emerald-400 hover:text-emerald-300"
            >
              Voltar ao login
            </Link>
          </div>
        ) : (
          <form
            onSubmit={handleReset}
            className="space-y-3 rounded-xl border border-slate-800 bg-card p-5"
          >
            <p className="text-xs text-slate-400">
              Introduza o email da sua conta e enviaremos um link para criar uma
              nova palavra-passe.
            </p>
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
              {busy ? "A enviar..." : "Enviar link de redefinição"}
            </button>

            <Link
              href="/login"
              className="block text-center text-xs text-slate-500 hover:text-slate-300"
            >
              ← Voltar ao login
            </Link>
          </form>
        )}
      </div>
    </main>
  );
}
