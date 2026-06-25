import React from "react";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import {
  AlertTriangle,
  ArrowLeft,
  Lock,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Tag,
  Wallet,
  type LucideIcon
} from "lucide-react";

export const metadata: Metadata = {
  title: "Diretrizes de Segurança · Reisolari",
  description:
    "Como comprar e vender painéis solares em segurança na Reisolari e evitar burlas."
};

type Section = { icon: LucideIcon; title: string; body: string; items: string[] };

const SECTIONS: Section[] = [
  {
    icon: MessageCircle,
    title: "Mantenha a conversa e o pagamento na plataforma",
    body: "Toda a negociação deve acontecer no chat da Reisolari. É o único sítio onde conseguimos ajudar em caso de problema.",
    items: [
      "Desconfie de quem pede para falar por WhatsApp, Telegram, SMS, email ou telefone.",
      "“Pagar por fora”, por MB WAY ou transferência a um desconhecido, é o sinal de burla mais comum.",
      "O sistema avisa automaticamente quando alguém tenta levar a conversa para fora da plataforma."
    ]
  },
  {
    icon: Wallet,
    title: "Nunca pague adiantado a desconhecidos",
    body: "Pagamentos antecipados sem garantias são a principal forma de fraude em marketplaces.",
    items: [
      "Não envie dinheiro antes de confirmar que o produto existe e está como descrito.",
      "Prefira pagamento na entrega em mãos, num local público, após verificar o artigo.",
      "Nunca partilhe códigos de confirmação (MB WAY, SMS) — nenhum vendedor legítimo os pede."
    ]
  },
  {
    icon: Tag,
    title: "Desconfie de preços bons demais",
    body: "Um painel ou inversor muito abaixo do mercado costuma ser isco para um esquema.",
    items: [
      "Compare com outros anúncios semelhantes antes de avançar.",
      "Pressão para decidir “já” ou histórias de urgência são táticas de burla.",
      "Peça fotos reais adicionais e o número de série do equipamento."
    ]
  },
  {
    icon: ShieldCheck,
    title: "Proteja os seus dados",
    body: "Os seus dados pessoais e bancários nunca são necessários para negociar.",
    items: [
      "Não partilhe NIF, IBAN, morada exata, fotos de documentos ou dados de cartão.",
      "O anúncio público mostra apenas a localidade (cidade), nunca a rua ou o número.",
      "Crie sempre palavras-passe fortes e não as reutilize."
    ]
  },
  {
    icon: MapPin,
    title: "Encontros e entregas em segurança",
    body: "Para negócios presenciais, escolha sempre locais públicos e movimentados.",
    items: [
      "Combine em locais com câmaras (estações, centros comerciais, esquadras com ponto de troca).",
      "Leve companhia e evite encontros à noite ou em moradas privadas.",
      "Verifique o equipamento (potência, estado, ligações) antes de pagar."
    ]
  },
  {
    icon: AlertTriangle,
    title: "Sinais de alerta",
    body: "Termine a conversa e denuncie se encontrar qualquer um destes sinais:",
    items: [
      "Pedido para sair da plataforma ou pagar por fora.",
      "Pedido de pagamento por transferência, cripto ou cartões-presente.",
      "Vendedor que recusa chamada de vídeo ou fotos adicionais do artigo real.",
      "Links suspeitos ou pedidos para instalar aplicações."
    ]
  }
];

export default function DiretrizesPage() {
  return (
    <main className="min-h-screen bg-supaste-mist pb-16 text-supaste-ink">
      <header className="px-4 pt-5">
        <nav className="supaste-glass-strong mx-auto flex max-w-3xl items-center justify-between rounded-full px-4 py-2.5">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/images/reisolari-logo.jpeg" alt="Reisolari" width={30} height={30} className="rounded-full" />
            <span className="font-display text-base font-semibold tracking-tight">Reisolari</span>
          </Link>
          <Link
            href="/marketplace"
            className="flex items-center gap-1.5 text-sm font-medium text-supaste-muted transition-colors hover:text-supaste-ink"
          >
            <ArrowLeft className="h-4 w-4" /> Marketplace
          </Link>
        </nav>
      </header>

      <div className="mx-auto max-w-3xl space-y-7 px-6 py-10">
        {/* Hero */}
        <div className="space-y-3">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-supaste-blue">Segurança</p>
          <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl text-balance">
            Diretrizes de <span className="font-serif italic font-normal">segurança</span>
          </h1>
          <p className="text-base text-supaste-muted text-balance">
            Como comprar e vender em segurança na Reisolari e evitar burlas.
          </p>
        </div>

        {/* Regra de ouro */}
        <div className="flex items-start gap-3.5 rounded-[22px] border border-supaste-blue/15 bg-supaste-blue/5 p-5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-supaste-blue/10 text-supaste-blue">
            <Lock className="h-5 w-5" />
          </span>
          <p className="text-sm leading-relaxed text-supaste-ink">
            <span className="font-semibold">Regra de ouro: mantenha tudo dentro da Reisolari.</span>{" "}
            <span className="text-supaste-muted">
              Conversas e pagamentos fora da plataforma não podem ser protegidos por nós.
            </span>
          </p>
        </div>

        {/* Secções */}
        <div className="space-y-4">
          {SECTIONS.map((section, i) => {
            const Icon = section.icon;
            return (
              <section key={section.title} className="rounded-[26px] bg-white p-6 shadow-soft-float">
                <div className="flex items-center gap-3.5">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-supaste-section text-supaste-blue">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <div className="font-mono text-[11px] text-supaste-muted">0{i + 1}</div>
                    <h2 className="font-display text-lg font-semibold leading-tight tracking-tight">{section.title}</h2>
                  </div>
                </div>
                <p className="mt-4 text-sm leading-relaxed text-supaste-muted">{section.body}</p>
                <ul className="mt-3 space-y-2">
                  {section.items.map(item => (
                    <li key={item} className="flex items-start gap-2.5 text-sm leading-relaxed text-supaste-muted">
                      <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-supaste-blue/50" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>

        <p className="px-1 text-xs leading-relaxed text-supaste-muted">
          Encontrou um comportamento suspeito? Termine a conversa e evite qualquer pagamento. Estas
          diretrizes existem para o proteger — ao usar a Reisolari, concorda em segui-las.
        </p>
      </div>
    </main>
  );
}
