"use client";

import React from "react";

type Props = {
  simulation: any | null;
};

const AgentAnalysisPanel: React.FC<Props> = ({ simulation }) => {
  if (!simulation) {
    return (
      <div className="bg-card text-slate-400 p-4 rounded-xl text-sm">
        Executa uma simulação para ver as análises dos agentes.
      </div>
    );
  }

  const { annual_energy_kwh, fiscal, orchestrator_output } = simulation;

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="bg-card p-4 rounded-xl text-sm space-y-2">
        <h2 className="text-lg font-semibold text-slate-100">Resultados físicos e fiscais</h2>
        <div>Energia anual estimada: <span className="font-mono">{annual_energy_kwh.toFixed(1)} kWh/ano</span></div>
        <div>Poupança anual: <span className="font-mono">{fiscal.annual_savings_eur.toFixed(2)} €/ano</span></div>
        <div>Payback: <span className="font-mono">{fiscal.payback_years.toFixed(1)} anos</span></div>
        <div>IVA painéis: {(fiscal.vat_panels_rate * 100).toFixed(1)}%</div>
        <div>IVA baterias: {(fiscal.vat_battery_rate * 100).toFixed(1)}%</div>
        <div>Custo total com IVA: {fiscal.total_cost_with_vat.toFixed(2)} €</div>
      </div>
      <div className="bg-card p-4 rounded-xl text-sm space-y-3">
        <h2 className="text-lg font-semibold text-slate-100">Análises dos agentes</h2>
        <section>
          <h3 className="font-semibold text-slate-200">Agente Físico-Químico</h3>
          <p className="text-slate-300 whitespace-pre-wrap">
            {orchestrator_output.physics_analysis.content}
          </p>
        </section>
        <section>
          <h3 className="font-semibold text-slate-200">Agente Financeiro/Fiscal</h3>
          <p className="text-slate-300 whitespace-pre-wrap">
            {orchestrator_output.financial_analysis.content}
          </p>
        </section>
        <section>
          <h3 className="font-semibold text-slate-200">Agente Sustentabilidade</h3>
          <p className="text-slate-300 whitespace-pre-wrap">
            {orchestrator_output.sustainability_analysis.content}
          </p>
        </section>
        <section>
          <h3 className="font-semibold text-slate-200">Resumo do Orquestrador</h3>
          <p className="text-slate-300 whitespace-pre-wrap">
            {orchestrator_output.summary}
          </p>
        </section>
      </div>
    </div>
  );
};

export default AgentAnalysisPanel;
