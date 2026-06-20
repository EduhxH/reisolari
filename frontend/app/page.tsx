"use client";

import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import React, { useEffect, useRef, useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { fetchProduct, formatPrice, type Product } from "@/lib/api";
import {
  ArrowRight,
  ClipboardList,
  LayoutGrid,
  ShoppingBag,
  Sun,
  Receipt,
  Leaf,
  Gauge
} from "lucide-react";
import { useAuth, displayNameFor } from "@/lib/auth";

const ease = [0.16, 1, 0.3, 1] as const;

const SolarPanel3D = dynamic(() => import("@/components/SolarPanel3D"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full place-items-center text-sm font-medium text-supaste-muted">
      A preparar o modelo 3D…
    </div>
  )
});

// O modelo 3D representa um módulo real do catálogo (N-TOPCon, 22,8%).
const SHOWCASE_PANEL_SLUG = "trina-vertex-s-plus-445";

/** Nome real do painel do modelo 3D + ligação à sua página na loja. */
function ShowcasePanelCard() {
  const [product, setProduct] = useState<Product | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchProduct(SHOWCASE_PANEL_SLUG)
      .then(p => {
        if (!cancelled) setProduct(p);
      })
      .catch(() => {
        /* loja offline — mostramos na mesma o nome e a ligação */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const name = product?.name ?? "Trina Solar Vertex S+ 445 W";

  return (
    <Link
      href={`/loja/${SHOWCASE_PANEL_SLUG}`}
      className="mt-5 flex items-center gap-4 rounded-[22px] bg-white p-4 shadow-soft-float transition-transform hover:-translate-y-0.5"
    >
      <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-supaste-section">
        {product?.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.image_url} alt={name} referrerPolicy="no-referrer" className="h-full w-full object-contain p-1" />
        ) : (
          <Sun className="h-7 w-7 text-supaste-blue" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-mono text-[11px] uppercase tracking-wide text-supaste-muted">
          O modelo acima é este painel real
        </div>
        <div className="truncate font-display text-base font-semibold tracking-tight text-supaste-ink">{name}</div>
        {product ? (
          <div className="text-sm text-supaste-muted">
            {product.panel_type} ·{" "}
            <span className="font-semibold text-supaste-ink">{formatPrice(product.price_cents, product.currency)}</span>{" "}
            <span className="text-supaste-muted">sem IVA</span>
          </div>
        ) : null}
      </div>
      <span className="shrink-0 rounded-full bg-supaste-black px-4 py-2 text-sm font-semibold text-white">
        Ver na loja →
      </span>
    </Link>
  );
}

function FadeUp({
  children,
  delay = 0,
  className = ""
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, delay, ease }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

const steps = [
  {
    icon: ClipboardList,
    title: "Responda ao questionário",
    body: "Consumo, região e telhado — opcionalmente a partir da sua fatura, que lemos por si. Demora cerca de dois minutos."
  },
  {
    icon: LayoutGrid,
    title: "Receba três propostas",
    body: "Económica, equilibrada e premium, dimensionadas ao seu consumo com potência, produção, custo e retorno."
  },
  {
    icon: ShoppingBag,
    title: "Compre painéis reais",
    body: "Comparamos ofertas reais do nosso marketplace, do OLX e de lojas portuguesas, à medida das suas especificações."
  }
];

const rigor = [
  {
    icon: Sun,
    title: "Irradiação real, por localização",
    body: "Cruzamos a produção específica regional do guião com os dados do PVGIS da Comissão Europeia para as coordenadas exatas do seu telhado."
  },
  {
    icon: Receipt,
    title: "Fiscalidade de Portugal",
    body: "Calculamos com a taxa reduzida real de IVA para painéis (6/5/4%) e mostramos, lado a lado, o cenário de taxa normal — sem surpresas."
  },
  {
    icon: Gauge,
    title: "Retorno e payback",
    body: "Poupança anual, VAL, TIR e tempo de retorno a 25 anos, com degradação e tarifa social consideradas no cálculo."
  },
  {
    icon: Leaf,
    title: "Impacto ambiental",
    body: "Estimamos o CO₂ evitado ao longo da vida do sistema e o seu equivalente em árvores plantadas."
  }
];

export default function HomeLanding() {
  const { user, loading } = useAuth();
  const ctaHref = user ? "/questionario" : "/login?redirect=%2Fquestionario";

  const heroRef = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"]
  });
  const bgY = useTransform(scrollYProgress, [0, 1], ["0%", "16%"]);
  const bgScale = useTransform(scrollYProgress, [0, 1], [1.05, 1.15]);

  return (
    <main className="bg-white text-supaste-ink">
      {/* Nav */}
      <header className="fixed inset-x-0 top-0 z-50 px-4 pt-4">
        <nav className="supaste-glass-strong mx-auto flex max-w-5xl items-center justify-between rounded-full px-4 py-2.5">
          <Link href="/" className="flex items-center gap-2.5">
            <Image
              src="/images/reisolari-logo.jpeg"
              alt="Reisolari"
              width={32}
              height={32}
              className="rounded-full"
            />
            <span className="font-display text-base font-semibold tracking-tight">Reisolari</span>
          </Link>
          <div className="hidden items-center gap-7 text-sm font-medium text-supaste-muted md:flex">
            <a href="#como-funciona" className="transition-colors hover:text-supaste-ink">Como funciona</a>
            <a href="#rigor" className="transition-colors hover:text-supaste-ink">Rigor</a>
            <Link href="/marketplace" className="transition-colors hover:text-supaste-ink">Marketplace</Link>
          </div>
          <div className="flex items-center gap-2">
            {loading ? null : user ? (
              <Link
                href="/conta"
                className="supaste-button rounded-full bg-supaste-black px-4 py-2 text-sm font-semibold text-white"
              >
                {displayNameFor(user)}
              </Link>
            ) : (
              <>
                <Link href="/login" className="px-3 py-2 text-sm font-semibold text-supaste-ink">
                  Entrar
                </Link>
                <Link
                  href="/criar-conta"
                  className="supaste-button rounded-full bg-supaste-black px-4 py-2 text-sm font-semibold text-white"
                >
                  Criar conta
                </Link>
              </>
            )}
          </div>
        </nav>
      </header>

      {/* Hero */}
      <section ref={heroRef} className="relative h-[92vh] min-h-[620px] w-full overflow-hidden">
        <motion.div style={{ y: bgY, scale: bgScale }} className="absolute inset-0">
          <Image
            src="/images/landing-background-top.jpeg"
            alt=""
            fill
            priority
            className="object-cover"
          />
        </motion.div>
        <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/10 to-white" />

        <div className="relative z-10 flex h-full flex-col items-center justify-center px-6 text-center">
          <motion.span
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease }}
            className="supaste-glass-strong mb-6 rounded-full px-4 py-1.5 text-xs font-medium text-supaste-ink"
          >
            Energia solar para Portugal
          </motion.span>
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.05, ease }}
            className="max-w-3xl font-display text-4xl font-semibold leading-[1.05] tracking-tight text-white text-balance md:text-6xl"
          >
            O sistema solar ideal para a sua casa,{" "}
            <span className="font-serif italic font-normal">calculado ao detalhe</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.12, ease }}
            className="mt-5 max-w-xl text-base text-white/90 md:text-lg text-balance"
          >
            Responda a um questionário rápido e preciso e receba três propostas dimensionadas ao
            seu consumo, telhado e região — com custos, poupança e painéis reais à venda.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.18, ease }}
            className="mt-8 flex flex-col items-center gap-3 sm:flex-row"
          >
            <Link
              href={ctaHref}
              className="supaste-button inline-flex min-h-[52px] items-center gap-2 rounded-full bg-supaste-black px-7 text-sm font-semibold text-white"
            >
              Realizar questionário
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/marketplace"
              className="supaste-button inline-flex min-h-[52px] items-center rounded-full bg-white px-7 text-sm font-semibold text-supaste-ink"
            >
              Ver marketplace
            </Link>
          </motion.div>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.3, ease }}
            className="mt-6 text-xs font-medium text-white/80"
          >
            Gratuito · cerca de 2 minutos · dados reais do PVGIS
          </motion.p>
        </div>
      </section>

      {/* Como funciona */}
      <section id="como-funciona" className="mx-auto max-w-5xl px-6 py-24">
        <FadeUp className="mx-auto max-w-2xl text-center">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-supaste-blue">Como funciona</p>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight md:text-4xl text-balance">
            De uma pergunta a um sistema dimensionado
          </h2>
          <p className="mt-4 text-base text-supaste-muted text-balance">
            Sem jargão e sem instaladores a insistir. Três passos simples, com cálculo rigoroso por trás.
          </p>
        </FadeUp>

        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <FadeUp key={step.title} delay={i * 0.08}>
                <article className="h-full rounded-[26px] bg-supaste-section p-7">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white shadow-soft-float">
                    <Icon className="h-5 w-5 text-supaste-blue" />
                  </div>
                  <div className="mt-5 font-mono text-xs text-supaste-muted">0{i + 1}</div>
                  <h3 className="mt-1 font-display text-xl font-semibold tracking-tight">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-supaste-muted">{step.body}</p>
                </article>
              </FadeUp>
            );
          })}
        </div>
      </section>

      {/* Painel 3D interativo */}
      <section className="mx-auto max-w-5xl px-6 py-24">
        <FadeUp className="mx-auto max-w-2xl text-center">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-supaste-blue">O painel</p>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight md:text-4xl text-balance">
            Explore um painel <span className="font-serif italic font-normal">ao detalhe</span>
          </h2>
          <p className="mt-4 text-base text-supaste-muted text-balance">
            Arraste para rodar e conheça cada componente — do vidro temperado às células e à moldura de alumínio.
          </p>
        </FadeUp>
        <FadeUp delay={0.1} className="mt-10">
          <div className="relative mx-auto h-[440px] max-w-3xl cursor-grab overflow-hidden rounded-[32px] bg-supaste-section shadow-soft-float active:cursor-grabbing sm:h-[500px]">
            <SolarPanel3D />
            <span className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-black/5 bg-white/85 px-3 py-1 text-[11px] font-medium text-supaste-muted backdrop-blur">
              Arraste para rodar
            </span>
          </div>
          <div className="mx-auto max-w-3xl">
            <ShowcasePanelCard />
          </div>
        </FadeUp>
      </section>

      {/* Rigor */}
      <section id="rigor" className="bg-supaste-section py-24">
        <div className="mx-auto max-w-5xl px-6">
          <FadeUp className="mx-auto max-w-2xl text-center">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-supaste-blue">Rigor</p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight md:text-4xl text-balance">
              Cálculo a sério, não estimativas vagas
            </h2>
            <p className="mt-4 text-base text-supaste-muted text-balance">
              Cada número é auditável e segue a metodologia de dimensionamento fotovoltaico, com dados reais.
            </p>
          </FadeUp>

          <div className="mt-14 grid gap-5 sm:grid-cols-2">
            {rigor.map((item, i) => {
              const Icon = item.icon;
              return (
                <FadeUp key={item.title} delay={i * 0.06}>
                  <article className="flex h-full gap-4 rounded-[26px] bg-white p-7 shadow-soft-float">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-supaste-section">
                      <Icon className="h-5 w-5 text-supaste-blue" />
                    </div>
                    <div>
                      <h3 className="font-display text-lg font-semibold tracking-tight">{item.title}</h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-supaste-muted">{item.body}</p>
                    </div>
                  </article>
                </FadeUp>
              );
            })}
          </div>
        </div>
      </section>

      {/* Três propostas */}
      <section className="mx-auto max-w-5xl px-6 py-24">
        <div className="grid items-center gap-12 md:grid-cols-2">
          <FadeUp>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-supaste-blue">Propostas ideais</p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight md:text-4xl text-balance">
              Três caminhos, <span className="font-serif italic font-normal">um para si</span>
            </h2>
            <p className="mt-4 text-base leading-relaxed text-supaste-muted">
              Apresentamos sempre uma proposta económica, uma equilibrada e uma premium — e recomendamos
              a que melhor encaixa nas suas respostas. Cada uma traz número de painéis, potência, produção
              anual, custo com IVA, poupança e payback.
            </p>
            <Link
              href={ctaHref}
              className="supaste-button mt-7 inline-flex min-h-[48px] items-center gap-2 rounded-full bg-supaste-black px-6 text-sm font-semibold text-white"
            >
              Ver as minhas propostas
              <ArrowRight className="h-4 w-4" />
            </Link>
          </FadeUp>

          <FadeUp delay={0.1} className="space-y-3">
            {[
              { name: "Económica", note: "Menor investimento", accent: "text-supaste-ink" },
              { name: "Equilibrada", note: "Melhor relação preço/produção", accent: "text-supaste-blue" },
              { name: "Premium", note: "Mais produção, menos área", accent: "text-supaste-ink" }
            ].map((p, i) => (
              <div
                key={p.name}
                className={`flex items-center justify-between rounded-[22px] p-5 ${
                  i === 1 ? "bg-supaste-black text-white" : "bg-supaste-section"
                }`}
              >
                <div>
                  <div className="font-display text-lg font-semibold tracking-tight">{p.name}</div>
                  <div className={`text-sm ${i === 1 ? "text-white/70" : "text-supaste-muted"}`}>{p.note}</div>
                </div>
                <ArrowRight className={`h-5 w-5 ${i === 1 ? "text-white" : "text-supaste-muted"}`} />
              </div>
            ))}
          </FadeUp>
        </div>
      </section>

      {/* CTA final */}
      <section className="px-4 pb-20">
        <FadeUp className="mx-auto max-w-5xl overflow-hidden rounded-[32px] bg-supaste-black px-8 py-16 text-center text-white">
          <h2 className="mx-auto max-w-2xl font-display text-3xl font-semibold tracking-tight md:text-4xl text-balance">
            Descubra quanto pode poupar com energia solar
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-white/70 text-balance">
            Responda ao questionário e receba o seu orçamento detalhado em PDF, gratuito.
          </p>
          <Link
            href={ctaHref}
            className="supaste-button mt-8 inline-flex min-h-[52px] items-center gap-2 rounded-full bg-white px-7 text-sm font-semibold text-supaste-black"
          >
            Realizar questionário
            <ArrowRight className="h-4 w-4" />
          </Link>
        </FadeUp>
      </section>

      {/* Footer */}
      <footer className="border-t border-black/5 px-6 py-10">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 text-sm text-supaste-muted sm:flex-row">
          <div className="flex items-center gap-2.5">
            <Image src="/images/reisolari-logo.jpeg" alt="" width={26} height={26} className="rounded-full" />
            <span className="font-display font-semibold text-supaste-ink">Reisolari</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/marketplace" className="transition-colors hover:text-supaste-ink">Marketplace</Link>
            <Link href="/diretrizes" className="transition-colors hover:text-supaste-ink">Diretrizes</Link>
            <Link href={ctaHref} className="transition-colors hover:text-supaste-ink">Questionário</Link>
          </div>
          <span>© {new Date().getFullYear()} Reisolari</span>
        </div>
      </footer>
    </main>
  );
}
