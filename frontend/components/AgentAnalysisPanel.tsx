"use client";

import React from "react";

type Recommendation = {
  panel: {
    name: string;
    power_w: number;
    efficiency: number;
    category: string;
  };
  panels_fit: number;
  recommended_count: number;
  installed_power_kwp: number;
  roof_coverage_ratio: number;
  annual_energy_kwh: number;
  estimated_equipment_cost_eur: number;
  simple_payback_years: number;
  rationale: string;
};

type Props = {
  simulation: any | null;
};

const money = (value: number) =>
  new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(value);

const AgentAnalysisPanel: React.FC<Props> = ({ simulation }) => {
  if (!simulation) {
    return (
      <section className="bg-card text-slate-400 p-4 rounded-lg text-sm border border-slate-800">
        Executa uma simulacao para ver resultados fisicos, fiscais e recomendacoes.
      </section>
    );
  }

  const { annual_energy_kwh, fiscal, orchestrator_output, recommendations = [] } = simulation;

  return (
    <div className="space-y-4">
      <section className="grid md:grid-cols-3 gap-4">
        <div className="bg-card p-4 rounded-lg text-sm space-y-2 border border-slate-800">
          <h2 className="text-base font-semibold text-slate-100">Fisica</h2>
          <div>Energia anual: <span className="font-mono">{annual_energy_kwh.toFixed(1)} kWh/ano</span></div>
          <div>Preco efetivo: <span className="font-mono">{money(fiscal.effective_electricity_price_eur_kwh)}/kWh</span></div>
        </div>
        <div className="bg-card p-4 rounded-lg text-sm space-y-2 border border-slate-800">
          <h2 className="text-base font-semibold text-slate-100">Fiscal</h2>
          <div>Poupanca anual: <span className="font-mono">{money(fiscal.annual_savings_eur)}</span></div>
          <div>IVA paineis: {(fiscal.vat_panels_rate * 100).toFixed(1)}%</div>
          <div>IVA baterias: {(fiscal.vat_battery_rate * 100).toFixed(1)}%</div>
        </div>
        <div className="bg-card p-4 rounded-lg text-sm space-y-2 border border-slate-800">
          <h2 className="text-base font-semibold text-slate-100">ROI</h2>
          <div>Payback: <span className="font-mono">{fiscal.payback_years.toFixed(1)} anos</span></div>
          <div>NPV: <span className="font-mono">{money(fiscal.npv_eur)}</span></div>
          <div>IRR: <span className="font-mono">{typeof fiscal.irr_percent === "number" ? `${fiscal.irr_percent.toFixed(1)}%` : "n/a"}</span></div>
        </div>
      </section>

      <section className="bg-card p-4 rounded-lg border border-slate-800">
        <h2 className="text-base font-semibold text-slate-100 mb-3">Recomendacoes de paineis</h2>
        <div className="grid md:grid-cols-3 gap-3">
          {recommendations.map((item: Recommendation) => (
            <article key={item.panel.name} className="border border-slate-700 rounded-lg p-3 text-sm space-y-2 bg-slate-950/60">
              <div className="font-semibold text-slate-100">{item.panel.name}</div>
              <div className="text-slate-300">
                {item.recommended_count} de {item.panels_fit} paineis fisicamente possiveis
              </div>
              <div className="font-mono text-slate-200">{item.installed_power_kwp.toFixed(2)} kWp</div>
              <div className="text-slate-300">{item.annual_energy_kwh.toFixed(0)} kWh/ano</div>
              <div className="text-slate-300">{Math.round(item.roof_coverage_ratio * 100)}% do telhado</div>
              <div className="text-slate-300">Custo estimado: {money(item.estimated_equipment_cost_eur)}</div>
              <div className="text-emerald-300">Payback painel: {item.simple_payback_years.toFixed(1)} anos</div>
              <p className="text-slate-400">{item.rationale}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-card p-4 rounded-lg text-sm space-y-3 border border-slate-800">
        <h2 className="text-base font-semibold text-slate-100">Analises dos agentes</h2>
        <section>
          <h3 className="font-semibold text-slate-200">Agente fisico-quimico</h3>
          <p className="text-slate-300 whitespace-pre-wrap">{orchestrator_output.physics_analysis.content}</p>
        </section>
        <section>
          <h3 className="font-semibold text-slate-200">Agente financeiro/fiscal</h3>
          <p className="text-slate-300 whitespace-pre-wrap">{orchestrator_output.financial_analysis.content}</p>
        </section>
        <section>
          <h3 className="font-semibold text-slate-200">Agente sustentabilidade</h3>
          <p className="text-slate-300 whitespace-pre-wrap">{orchestrator_output.sustainability_analysis.content}</p>
        </section>
        <section>
          <h3 className="font-semibold text-slate-200">Resumo do orquestrador</h3>
          <p className="text-slate-300 whitespace-pre-wrap">{orchestrator_output.summary}</p>
        </section>
      </section>
    </div>
  );
};

export default AgentAnalysisPanel;
