"use client";

import React, { useState } from "react";
import axios from "axios";

type Props = {
  areaM2: number;
  centroid: { lat: number; lon: number } | null;
  onSimulationResult: (data: any) => void;
};

const SimulationPanel: React.FC<Props> = ({ areaM2, centroid, onSimulationResult }) => {
  const [loading, setLoading] = useState(false);
  const [price, setPrice] = useState(0.20);
  const [kwp, setKwp] = useState(3);
  const [hasSocial, setHasSocial] = useState(false);
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

  const runSimulation = async () => {
    if (!centroid) return;
    setLoading(true);
    try {
      const payload = {
        theme: "Simulação de Mercado P2P Solar em Portugal",
        area_m2: areaM2,
        installed_power_kwp: kwp,
        panel_efficiency: 0.205,
        performance_ratio: 0.75,
        electricity_price_eur_kwh: price,
        has_social_tariff: hasSocial,
        region_type: "continent", // poderias inferir via GeoIP no backend
        latitude: centroid.lat,
        longitude: centroid.lon
      };
      const res = await axios.post(`${backendUrl}/api/v1/simulation/`, payload);
      onSimulationResult(res.data);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-card text-slate-100 p-4 rounded-xl space-y-3">
      <div className="text-sm text-slate-400">Área selecionada: {areaM2.toFixed(2)} m²</div>
      <label className="flex flex-col text-sm">
        Potência instalada (kWp)
        <input
          type="number"
          value={kwp}
          onChange={e => setKwp(parseFloat(e.target.value))}
          className="mt-1 bg-slate-900 border border-slate-700 rounded px-2 py-1"
        />
      </label>
      <label className="flex flex-col text-sm">
        Preço eletricidade (€/kWh)
        <input
          type="number"
          step="0.01"
          value={price}
          onChange={e => setPrice(parseFloat(e.target.value))}
          className="mt-1 bg-slate-900 border border-slate-700 rounded px-2 py-1"
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={hasSocial}
          onChange={e => setHasSocial(e.target.checked)}
        />
        Tarifa Social de Energia (desconto 33.8%)
      </label>
      <button
        onClick={runSimulation}
        disabled={loading || !centroid || areaM2 <= 0}
        className="w-full bg-accent text-black font-semibold py-2 rounded disabled:opacity-50"
      >
        {loading ? "A simular..." : "Simular sistema"}
      </button>
    </div>
  );
};

export default SimulationPanel;
