"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRequireQuestionnaire } from "@/lib/useRequireQuestionnaire";
import { AuthChecking } from "@/lib/useRequireAuth";
import {
  QuestionnaireResult,
  SolutionArchetype,
  IdealPanel,
  getLatestResult,
  downloadOrcamento
} from "@/lib/questionnaire";
import { RevealStagger, RevealItem } from "@/components/Reveal";
import PanelGraphic from "@/components/PanelGraphic";

const money = (v: number | null | undefined) =>
  v == null ? "—" : new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
const years = (v: number) => (v && isFinite(v) ? `${v.toFixed(1)} anos` : "—");
const kwh = (v: number) => `${new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 0 }).format(v)} kWh`;

const ARCH_LABEL: Record<string, string> = {
  economica: "Económica",
  equilibrada: "Equilibrada",
  premium: "Premium"
};
const SOURCE_BADGE: Record<string, string> = {
  p2p: "bg-supaste-blue/10 text-supaste-blue",
  olx: "bg-supaste-iris/10 text-supaste-iris",
  loja: "bg-supaste-green/10 text-supaste-green"
};

function SolutionCard({ s, recommended }: { s: SolutionArchetype; recommended: boolean }) {
  const storeUrl = `/loja/${s.panel.code}`;
  const vatBox = recommended ? "bg-white/10" : "bg-supaste-section";
  return (
    <article
      className={`flex flex-col rounded-[26px] p-6 ${
        recommended ? "bg-supaste-black text-white" : "bg-white shadow-soft-float"
      }`}
    >
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold tracking-tight">{ARCH_LABEL[s.archetype]}</h3>
        {recommended ? (
          <span className="rounded-full bg-white px-2.5 py-0.5 text-[10px] font-bold tracking-wide text-supaste-black">
            IDEAL
          </span>
        ) : null}
      </div>

      {/* Foto real do painel recomendado para este modo */}
      <Link
        href={storeUrl}
        className="mt-4 grid h-32 place-items-center overflow-hidden rounded-2xl bg-white"
        title={`Ver ${s.panel.name} na loja`}
      >
        {s.panel.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={s.panel.image_url} alt={s.panel.name} referrerPolicy="no-referrer" className="h-full w-full object-contain p-2" />
        ) : (
          <PanelGraphic
            widthMm={s.panel.width_mm}
            heightMm={s.panel.height_mm}
            cellCount={s.panel.cell_count ?? 108}
            powerW={s.panel.power_w}
            className="h-28 w-auto"
          />
        )}
      </Link>

      <div className={`mt-3 text-sm font-semibold ${recommended ? "text-white" : "text-supaste-ink"}`}>{s.panel.name}</div>
      <div className={`text-xs ${recommended ? "text-white/60" : "text-supaste-muted"}`}>
        {money(s.panel.avg_price_eur)} / painel · sem IVA
      </div>

      <dl className={`mt-4 space-y-2 text-sm ${recommended ? "text-white/90" : "text-supaste-ink"}`}>
        <Row recommended={recommended} label="Painéis" value={`${s.panels_feasible}`} />
        <Row recommended={recommended} label="Potência" value={`${s.installed_power_kwp.toFixed(2)} kWp`} />
        <Row recommended={recommended} label="Produção/ano" value={kwh(s.annual_production_kwh)} />
      </dl>

      {/* Os 4 valores de IVA do sistema completo */}
      <div className={`mt-4 space-y-1.5 rounded-2xl ${vatBox} p-3 text-[13px]`}>
        <Row recommended={recommended} label="Sem IVA" value={money(s.fiscal_real.net_cost_eur)} muted />
        <Row recommended={recommended} label="IVA reduzido" value={money(s.fiscal_reduzido.total_cost_with_vat)} />
        <Row recommended={recommended} label="IVA real" value={money(s.fiscal_real.total_cost_with_vat)} accent />
        <Row recommended={recommended} label="IVA guião" value={money(s.fiscal_guiao.total_cost_with_vat)} muted />
        <p className={`pt-0.5 text-[10px] ${recommended ? "text-white/45" : "text-supaste-muted"}`}>
          reduzido 6/5/4% · guião 23/22/16% · referência: IVA real
        </p>
      </div>

      <dl className={`mt-3 space-y-2 text-sm ${recommended ? "text-white/90" : "text-supaste-ink"}`}>
        <Row recommended={recommended} label="Retorno (real)" value={years(s.fiscal_real.payback_years)} accent />
      </dl>

      {!s.fits_in_area ? (
        <p className={`mt-3 text-[11px] ${recommended ? "text-white/70" : "text-supaste-muted"}`}>
          Limitado pela área do telhado.
        </p>
      ) : null}

      <Link
        href={storeUrl}
        className={`mt-5 inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold transition-colors ${
          recommended ? "bg-white text-supaste-black hover:bg-white/90" : "bg-supaste-black text-white hover:bg-black"
        }`}
      >
        Ver / comprar na loja →
      </Link>
    </article>
  );
}

function Row({
  label,
  value,
  recommended,
  muted = false,
  accent = false
}: {
  label: string;
  value: string;
  recommended: boolean;
  muted?: boolean;
  accent?: boolean;
}) {
  const labelColor = recommended ? "text-white/55" : "text-supaste-muted";
  const valueColor = accent
    ? recommended
      ? "text-white"
      : "text-supaste-blue"
    : muted
    ? recommended
      ? "text-white/50"
      : "text-supaste-muted"
    : "";
  return (
    <div className="flex justify-between">
      <dt className={labelColor}>{label}</dt>
      <dd className={`font-medium ${valueColor}`}>{value}</dd>
    </div>
  );
}

function PanelCard({ p }: { p: IdealPanel }) {
  return (
    <a
      href={p.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex flex-col overflow-hidden rounded-[22px] bg-white shadow-soft-float transition-transform hover:-translate-y-0.5"
    >
      <div className="grid h-32 place-items-center overflow-hidden bg-supaste-section">
        {p.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.image_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-xs text-supaste-muted">Sem imagem</span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${SOURCE_BADGE[p.source]}`}>
            {p.source_label}
          </span>
          {p.power_w ? <span className="text-[10px] text-supaste-muted">{p.power_w} W</span> : null}
        </div>
        <div className="line-clamp-2 flex-1 text-sm text-supaste-ink">{p.title}</div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-supaste-ink">{p.price_display}</span>
          {p.location ? <span className="text-[10px] text-supaste-muted">{p.location}</span> : null}
        </div>
      </div>
    </a>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] bg-white p-4 shadow-soft-float">
      <div className="text-[11px] text-supaste-muted">{label}</div>
      <div className="mt-0.5 font-display text-lg font-semibold tracking-tight">{value}</div>
    </div>
  );
}

export default function IdeaisPage() {
  const { user, ready } = useRequireQuestionnaire();
  const [result, setResult] = useState<QuestionnaireResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!ready || !user) return;
    let cancelled = false;
    (async () => {
      const token = await user.getIdToken();
      const data = await getLatestResult(token);
      if (!cancelled) {
        setResult(data);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, user]);

  const download = async () => {
    if (!user) return;
    setDownloading(true);
    try {
      const token = await user.getIdToken();
      await downloadOrcamento(token);
    } catch {
      // ignore
    } finally {
      setDownloading(false);
    }
  };

  if (!ready || loading) return <AuthChecking />;

  if (!result) {
    return (
      <main className="grid min-h-screen place-items-center bg-supaste-mist p-6">
        <div className="space-y-3 text-center">
          <p className="text-supaste-muted">Ainda não tem uma simulação.</p>
          <Link href="/questionario" className="font-semibold text-supaste-blue">
            Fazer o questionário →
          </Link>
        </div>
      </main>
    );
  }

  const a = result.analysis;
  const rec = result.solutions.find(s => s.archetype === result.recommended_archetype);

  return (
    <main className="min-h-screen bg-supaste-mist text-supaste-ink">
      <header className="px-4 pt-5">
        <nav className="supaste-glass-strong mx-auto flex max-w-5xl items-center justify-between rounded-full px-4 py-2.5">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/images/reisolari-logo.jpeg" alt="Reisolari" width={30} height={30} className="rounded-full" />
            <span className="font-display text-base font-semibold tracking-tight">Reisolari</span>
          </Link>
          <div className="flex items-center gap-5 text-sm font-medium text-supaste-muted">
            <Link href="/questionario" className="transition-colors hover:text-supaste-ink">Refazer</Link>
            <Link href="/marketplace" className="transition-colors hover:text-supaste-ink">Marketplace</Link>
            <Link href="/conta" className="transition-colors hover:text-supaste-ink">Conta</Link>
          </div>
        </nav>
      </header>

      <div className="mx-auto max-w-5xl space-y-8 px-6 py-10">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight">As suas propostas ideais</h1>
            <p className="mt-1 text-sm text-supaste-muted">
              Recomendado: <span className="font-semibold text-supaste-blue">{ARCH_LABEL[result.recommended_archetype]}</span>
            </p>
          </div>
          <button
            onClick={download}
            disabled={downloading}
            className="supaste-button inline-flex items-center rounded-full bg-supaste-black px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {downloading ? "A gerar…" : "Descarregar orçamento (PDF)"}
          </button>
        </div>

        {/* Resumo de números */}
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {rec ? (
            <>
              <Metric label="Potência" value={`${rec.installed_power_kwp.toFixed(2)} kWp`} />
              <Metric label="Nº de painéis" value={`${rec.panels_feasible}`} />
              <Metric label="Produção anual" value={kwh(rec.annual_production_kwh)} />
              <Metric label="Poupança anual" value={money(rec.fiscal_real.annual_savings_eur)} />
            </>
          ) : null}
          <Metric label="Retorno (real)" value={years(a.finance.payback_years_real)} />
          <Metric label="VAL (real)" value={money(a.finance.npv_eur_real)} />
          <Metric label="CO₂ evitado/ano" value={`${a.sustainability.co2_annual_kg.toFixed(0)} kg`} />
          <Metric label="Equivale a" value={`${a.sustainability.equivalent_trees.toFixed(0)} árvores`} />
        </section>

        {/* Fórmulas do guião */}
        <section className="rounded-[26px] bg-white p-6 shadow-soft-float">
          <h2 className="font-display text-lg font-semibold tracking-tight">Como foi calculado</h2>
          <div className="mt-3 space-y-1.5 font-mono text-sm text-supaste-ink">
            {result.formula_steps.map(step => (
              <div key={step.label}>
                {step.expression} ={" "}
                <span className="text-supaste-blue">
                  {step.value.toFixed(2)} {step.unit}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-supaste-muted">
            Produção específica regional (guião): {result.region_yield_kwh_kwp_year.toFixed(0)} kWh/kWp/ano
            {result.pvgis_yield_kwh_kwp_year
              ? ` · PVGIS (localização): ${result.pvgis_yield_kwh_kwp_year.toFixed(0)} kWh/kWp/ano`
              : ""}
          </p>
        </section>

        {/* As 3 soluções */}
        <section className="space-y-4">
          <h2 className="font-display text-xl font-semibold tracking-tight">As três propostas</h2>
          <RevealStagger className="grid gap-4 md:grid-cols-3">
            {result.solutions.map(s => (
              <RevealItem key={s.archetype}>
                <SolutionCard s={s} recommended={s.archetype === result.recommended_archetype} />
              </RevealItem>
            ))}
          </RevealStagger>
        </section>

        {/* Painéis reais à venda */}
        <section className="space-y-4">
          <h2 className="font-display text-xl font-semibold tracking-tight">Painéis reais à venda em Portugal</h2>
          {result.ideal_panels.length === 0 ? (
            <p className="text-sm text-supaste-muted">
              Não encontrámos ofertas que correspondam às especificações neste momento.
            </p>
          ) : (
            <RevealStagger className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {result.ideal_panels.map((p, i) => (
                <RevealItem key={`${p.url}-${i}`}>
                  <PanelCard p={p} />
                </RevealItem>
              ))}
            </RevealStagger>
          )}
        </section>
      </div>
    </main>
  );
}
