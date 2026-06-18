"use client";

import Link from "next/link";
import React from "react";
import { useAuth, displayNameFor } from "@/lib/auth";

// Public welcome landing. Visitors are no longer dropped straight onto the
// login/register screen — they get an explanation and a clear call to action.
// The questionnaire CTA routes through login/registo and then to /questionario.
export default function HomeLanding() {
  const { user, loading } = useAuth();
  const ctaHref = user ? "/questionario" : "/login?redirect=%2Fquestionario";

  return (
    <main className="min-h-screen bg-bg text-slate-100">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
        <Link href="/" className="text-xl font-bold text-white">
          Reisolari
        </Link>
        <nav className="flex items-center gap-2">
          {loading ? null : user ? (
            <>
              <Link
                href="/ideais"
                className="px-3 py-1.5 rounded-lg text-sm font-semibold text-slate-200 hover:text-emerald-300"
              >
                Propostas
              </Link>
              <Link
                href="/conta"
                className="px-3 py-1.5 rounded-lg text-sm font-semibold text-slate-950 bg-emerald-500 hover:bg-emerald-400"
              >
                {displayNameFor(user)}
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="px-3 py-1.5 rounded-lg text-sm font-semibold text-slate-200 border border-slate-700 hover:border-emerald-600"
              >
                Entrar
              </Link>
              <Link
                href="/criar-conta"
                className="px-3 py-1.5 rounded-lg text-sm font-semibold text-slate-950 bg-emerald-500 hover:bg-emerald-400"
              >
                Criar conta
              </Link>
            </>
          )}
        </nav>
      </header>

      {/* Hero */}
      <section className="max-w-3xl mx-auto px-6 py-20 text-center space-y-6">
        <span className="inline-block text-xs font-semibold text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-3 py-1">
          Energia solar para Portugal
        </span>
        <h1 className="text-4xl md:text-5xl font-bold text-white leading-tight">
          Descubra o sistema solar ideal para a sua casa
        </h1>
        <p className="text-base md:text-lg text-slate-400">
          Responda a um questionário rápido e preciso — opcionalmente a partir da sua fatura de
          luz — e receba três propostas dimensionadas ao seu consumo, telhado e região, com custos,
          poupança, retorno do investimento e painéis reais à venda em Portugal.
        </p>
        <div className="pt-2">
          <Link
            href={ctaHref}
            className="inline-block px-8 py-3 rounded-xl text-base font-semibold text-slate-950 bg-emerald-500 hover:bg-emerald-400 transition-colors"
          >
            Realizar questionário
          </Link>
        </div>
        <p className="text-xs text-slate-500">Gratuito · demora cerca de 2 minutos</p>
      </section>

      {/* Como funciona */}
      <section className="max-w-5xl mx-auto px-6 pb-20 grid sm:grid-cols-3 gap-4">
        <Feature
          title="Questionário preciso"
          body="Consumo, região, telhado e objetivo de autossuficiência. Pode enviar a fatura e lemos os dados por si."
        />
        <Feature
          title="Três propostas ideais"
          body="Económica, equilibrada e premium — com potência, número de painéis, produção anual, custo com IVA e payback."
        />
        <Feature
          title="Painéis reais em Portugal"
          body="Comparamos ofertas reais do nosso marketplace, do OLX e de lojas portuguesas, à medida das suas specs."
        />
      </section>
    </main>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-card p-5">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      <p className="text-sm text-slate-400 mt-1">{body}</p>
    </div>
  );
}
