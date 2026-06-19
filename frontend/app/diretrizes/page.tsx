import React from "react";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Diretrizes de Segurança · Reisolari",
  description:
    "Como comprar e vender painéis solares em segurança na Reisolari e evitar burlas."
};

const SECTIONS: { title: string; body: string; items: string[] }[] = [
  {
    title: "1. Mantenha a conversa e o pagamento na plataforma",
    body: "Toda a negociação deve acontecer no chat da Reisolari. É o único sítio onde conseguimos ajudar em caso de problema.",
    items: [
      "Desconfie de quem pede para falar por WhatsApp, Telegram, SMS, email ou telefone.",
      "“Pagar por fora”, por MB WAY ou transferência a um desconhecido, é o sinal de burla mais comum.",
      "O sistema avisa automaticamente quando alguém tenta levar a conversa para fora da plataforma."
    ]
  },
  {
    title: "2. Nunca pague adiantado a desconhecidos",
    body: "Pagamentos antecipados sem garantias são a principal forma de fraude em marketplaces.",
    items: [
      "Não envie dinheiro antes de confirmar que o produto existe e está como descrito.",
      "Prefira pagamento na entrega em mãos, num local público, após verificar o artigo.",
      "Nunca partilhe códigos de confirmação (MB WAY, SMS) — nenhum vendedor legítimo os pede."
    ]
  },
  {
    title: "3. Desconfie de preços bons demais",
    body: "Um painel ou inversor muito abaixo do mercado costuma ser isco para um esquema.",
    items: [
      "Compare com outros anúncios semelhantes antes de avançar.",
      "Pressão para decidir “já” ou histórias de urgência são táticas de burla.",
      "Peça fotos reais adicionais e o número de série do equipamento."
    ]
  },
  {
    title: "4. Proteja os seus dados",
    body: "Os seus dados pessoais e bancários nunca são necessários para negociar.",
    items: [
      "Não partilhe NIF, IBAN, morada exata, fotos de documentos ou dados de cartão.",
      "O anúncio público mostra apenas a localidade (cidade), nunca a rua ou o número.",
      "Crie sempre palavras-passe fortes e não as reutilize."
    ]
  },
  {
    title: "5. Encontros e entregas em segurança",
    body: "Para negócios presenciais, escolha sempre locais públicos e movimentados.",
    items: [
      "Combine em locais com câmaras (estações, centros comerciais, esquadras com ponto de troca).",
      "Leve companhia e evite encontros à noite ou em moradas privadas.",
      "Verifique o equipamento (potência, estado, ligações) antes de pagar."
    ]
  },
  {
    title: "6. Sinais de alerta",
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
    <main className="min-h-screen bg-supaste-mist text-supaste-ink p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="flex items-center justify-between border-b border-black/10 pb-4">
          <div>
            <h1 className="text-2xl font-bold text-supaste-ink">Diretrizes de Segurança</h1>
            <p className="text-sm text-supaste-muted">
              Como comprar e vender em segurança na Reisolari e evitar burlas.
            </p>
          </div>
          <Link href="/marketplace" className="text-xs font-semibold text-supaste-muted hover:text-supaste-blue">
            ← Marketplace
          </Link>
        </header>

        <div className="rounded-lg border border-supaste-green/30 bg-supaste-black/5 p-4 text-sm text-supaste-blue">
          🔒 Regra de ouro: <strong>mantenha tudo dentro da Reisolari</strong>. Conversas e
          pagamentos fora da plataforma não podem ser protegidos por nós.
        </div>

        <div className="space-y-5">
          {SECTIONS.map(section => (
            <section key={section.title} className="rounded-xl border border-black/10 bg-white p-5 space-y-2">
              <h2 className="text-base font-semibold text-supaste-ink">{section.title}</h2>
              <p className="text-sm text-supaste-muted">{section.body}</p>
              <ul className="list-disc pl-5 space-y-1 text-sm text-supaste-muted">
                {section.items.map(item => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <p className="text-[11px] text-supaste-muted">
          Encontrou um comportamento suspeito? Termine a conversa e evite qualquer pagamento.
          Estas diretrizes existem para o proteger — ao usar a Reisolari, concorda em segui-las.
        </p>
      </div>
    </main>
  );
}
