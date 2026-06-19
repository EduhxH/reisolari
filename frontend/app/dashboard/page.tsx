"use client";

import Link from "next/link";
import Image from "next/image";
import React from "react";
import { ArrowRight } from "lucide-react";
import AuthHeaderButtons from "@/components/AuthHeaderButtons";
import { useRequireQuestionnaire } from "@/lib/useRequireQuestionnaire";
import { AuthChecking } from "@/lib/useRequireAuth";

export default function DashboardPage() {
  // Gate: utilizadores sem questionário concluído são levados para /questionario.
  const { ready } = useRequireQuestionnaire();

  if (!ready) return <AuthChecking />;

  return (
    <main className="min-h-screen bg-supaste-mist text-supaste-ink">
      <header className="px-4 pt-5">
        <nav className="supaste-glass-strong mx-auto flex max-w-5xl items-center justify-between rounded-full px-4 py-2.5">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/images/reisolari-logo.jpeg" alt="Reisolari" width={30} height={30} className="rounded-full" />
            <span className="font-display text-base font-semibold tracking-tight">Reisolari</span>
          </Link>
          <AuthHeaderButtons />
        </nav>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-12">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Bem-vindo de volta</h1>
        <p className="mt-1 text-sm text-supaste-muted">Marketplace P2P e simulador solar para Portugal.</p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
      </div>
    </main>
  );
}

function HubCard({ href, title, body }: { href: string; title: string; body: string }) {
  return (
    <Link
      href={href}
      className="group block rounded-[26px] bg-white p-6 shadow-soft-float transition-transform hover:-translate-y-0.5"
    >
      <div className="flex items-start justify-between">
        <h2 className="font-display text-lg font-semibold tracking-tight">{title}</h2>
        <ArrowRight className="h-5 w-5 text-supaste-muted transition-colors group-hover:text-supaste-blue" />
      </div>
      <p className="mt-1.5 text-sm text-supaste-muted">{body}</p>
    </Link>
  );
}
