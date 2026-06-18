"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRequireQuestionnaire } from "@/lib/useRequireQuestionnaire";
import { AuthChecking } from "@/lib/useRequireAuth";
import {
  QuestionnaireResult,
  SolutionArchetype,
  IdealPanel,
  getLatestResult,
  downloadOrcamento
} from "@/lib/questionnaire";

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
  p2p: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  olx: "bg-sky-500/20 text-sky-300 border-sky-500/30",
  loja: "bg-amber-500/20 text-amber-300 border-amber-500/30"
};

function SolutionCard({ s, recommended }: { s: SolutionArchetype; recommended: boolean }) {
  return (
    <article
      className={`rounded-xl border p-4 space-y-2 bg-slate-950/50 ${
        recommended ? "border-emerald-500" : "border-slate-800"
      }`}
    >
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-100">{ARCH_LABEL[s.archetype]}</h3>
        {recommended ? (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500 text-slate-950">IDEAL</span>
        ) : null}
      </div>
      <div className="text-xs text-slate-400">{s.panel.name}</div>
      <dl className="text-sm space-y-1">
        <div className="flex justify-between"><dt className="text-slate-400">Painéis</dt><dd>{s.panels_feasible}</dd></div>
        <div className="flex justify-between"><dt className="text-slate-400">Potência</dt><dd>{s.installed_power_kwp.toFixed(2)} kWp</dd></div>
        <div className="flex justify-between"><dt className="text-slate-400">Produção/ano</dt><dd>{kwh(s.annual_production_kwh)}</dd></div>
        <div className="flex justify-between"><dt className="text-slate-400">Custo (IVA real)</dt><dd>{money(s.fiscal_real.total_cost_with_vat)}</dd></div>
        <div className="flex justify-between text-slate-500"><dt>Custo (IVA guião)</dt><dd>{money(s.fiscal_guiao.total_cost_with_vat)}</dd></div>
        <div className="flex justify-between"><dt className="text-slate-400">Retorno</dt><dd className="text-emerald-300">{years(s.fiscal_real.payback_years)}</dd></div>
      </dl>
      {!s.fits_in_area ? (
        <p className="text-[11px] text-amber-300">Limitado pela área do telhado.</p>
      ) : null}
    </article>
  );
}

function PanelCard({ p }: { p: IdealPanel }) {
  return (
    <a
      href={p.url}
      target="_blank"
      rel="noopener noreferrer"
      className="rounded-xl border border-slate-800 bg-card overflow-hidden hover:border-emerald-700 transition-colors flex flex-col"
    >
      <div className="h-32 bg-slate-950 grid place-items-center overflow-hidden">
        {p.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.image_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-slate-700 text-xs">Sem imagem</span>
        )}
      </div>
      <div className="p-3 space-y-1 flex-1 flex flex-col">
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${SOURCE_BADGE[p.source]}`}>
            {p.source_label}
          </span>
          {p.power_w ? <span className="text-[10px] text-slate-400">{p.power_w} W</span> : null}
        </div>
        <div className="text-sm text-slate-100 line-clamp-2 flex-1">{p.title}</div>
        <div className="flex items-center justify-between">
          <span className="text-emerald-400 font-bold text-sm">{p.price_display}</span>
          {p.location ? <span className="text-[10px] text-slate-500">{p.location}</span> : null}
        </div>
      </div>
    </a>
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
      <main className="min-h-screen bg-bg text-slate-100 grid place-items-center p-6">
        <div className="text-center space-y-3">
          <p className="text-slate-400">Ainda não tem uma simulação.</p>
          <Link href="/questionario" className="text-emerald-400 font-semibold">
            Fazer o questionário →
          </Link>
        </div>
      </main>
    );
  }

  const a = result.analysis;
  const rec = result.solutions.find(s => s.archetype === result.recommended_archetype);

  return (
    <main className="min-h-screen bg-bg text-slate-100 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-2xl font-bold text-white">As suas propostas ideais</h1>
            <p className="text-sm text-slate-400">
              Recomendado: <span className="text-emerald-300 font-semibold">{ARCH_LABEL[result.recommended_archetype]}</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={download}
              disabled={downloading}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-950 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50"
            >
              {downloading ? "A gerar…" : "Descarregar orçamento (PDF)"}
            </button>
            <Link href="/questionario" className="text-sm text-slate-300 hover:text-emerald-300">
              Refazer questionário
            </Link>
            <Link href="/marketplace" className="text-sm text-slate-300 hover:text-emerald-300">
              Marketplace
            </Link>
          </div>
        </header>

        {/* Resumo de números */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
          <Metric label="≈ árvores" value={`${a.sustainability.equivalent_trees.toFixed(0)}`} />
        </section>

        {/* Fórmulas do guião */}
        <section className="rounded-xl border border-slate-800 bg-card p-4 space-y-2">
          <h2 className="text-base font-semibold">Como foi calculado</h2>
          <div className="space-y-1 text-sm font-mono text-slate-300">
            {result.formula_steps.map(step => (
              <div key={step.label}>
                {step.expression} ={" "}
                <span className="text-emerald-300">
                  {step.value.toFixed(2)} {step.unit}
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500">
            Produção específica regional (guião): {result.region_yield_kwh_kwp_year.toFixed(0)} kWh/kWp/ano
            {result.pvgis_yield_kwh_kwp_year
              ? ` · PVGIS (localização): ${result.pvgis_yield_kwh_kwp_year.toFixed(0)} kWh/kWp/ano`
              : ""}
          </p>
        </section>

        {/* As 3 soluções */}
        <section className="space-y-3">
          <h2 className="text-base font-semibold">As três propostas</h2>
          <div className="grid md:grid-cols-3 gap-3">
            {result.solutions.map(s => (
              <SolutionCard key={s.archetype} s={s} recommended={s.archetype === result.recommended_archetype} />
            ))}
          </div>
        </section>

        {/* Painéis reais à venda */}
        <section className="space-y-3">
          <h2 className="text-base font-semibold">Painéis reais à venda em Portugal</h2>
          {result.ideal_panels.length === 0 ? (
            <p className="text-sm text-slate-400">
              Não encontrámos ofertas que correspondam às specs neste momento.
            </p>
          ) : (
            <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {result.ideal_panels.map((p, i) => (
                <PanelCard key={`${p.url}-${i}`} p={p} />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-card p-3">
      <div className="text-[11px] text-slate-400">{label}</div>
      <div className="text-lg font-bold text-slate-100">{value}</div>
    </div>
  );
}
