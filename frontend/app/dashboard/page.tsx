"use client";

import Link from "next/link";
import React from "react";
import AuthHeaderButtons from "@/components/AuthHeaderButtons";
import { useRequireQuestionnaire } from "@/lib/useRequireQuestionnaire";
import { AuthChecking } from "@/lib/useRequireAuth";

export default function DashboardPage() {
  // Gate: utilizadores sem questionário concluído são levados para /questionario.
  const { ready } = useRequireQuestionnaire();

  if (!ready) return <AuthChecking />;

  return (
    <main className="min-h-screen bg-bg text-slate-100 p-6 space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">Reisolari</h1>
          <p className="text-sm text-slate-400">Marketplace P2P e simulador solar para Portugal</p>
        </div>
        <AuthHeaderButtons />
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <HubCard
          href="/ideais"
          title="Propostas ideais"
          body="Veja as suas três propostas, o orçamento e os painéis reais à venda."
        />
        <HubCard
          href="/questionario"
          title="Refazer questionário"
          body="Atualize o consumo, o telhado ou os objetivos e recalcule."
        />
        <HubCard
          href="/marketplace"
          title="Marketplace"
          body="Compre e venda painéis e equipamento solar entre particulares."
        />
      </div>
    </main>
  );
}

function HubCard({ href, title, body }: { href: string; title: string; body: string }) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-slate-800 bg-card p-5 hover:border-emerald-700 transition-colors block"
    >
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      <p className="text-sm text-slate-400 mt-1">{body}</p>
    </Link>
  );
}
