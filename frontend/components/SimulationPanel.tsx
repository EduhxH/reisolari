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
  const [error, setError] = useState<string | null>(null);
  const [price, setPrice] = useState(0.2);
  const [kwp, setKwp] = useState(3);
  const [tilt, setTilt] = useState(35);
  const [aspect, setAspect] = useState(0);
  const [region, setRegion] = useState<"continent" | "madeira" | "azores">("continent");
  const [hasSocial, setHasSocial] = useState(false);
  const [costPerKwp, setCostPerKwp] = useState(900);
  const [batteryCost, setBatteryCost] = useState(2000);
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, "") ?? "";

  const runSimulation = async () => {
    if (!centroid) return;
    setLoading(true);
    setError(null);
    try {
      const payload = {
        theme: "Simulacao de mercado P2P solar em Portugal",
        area_m2: areaM2,
        installed_power_kwp: kwp,
        panel_efficiency: 0.205,
        performance_ratio: 0.75,
        electricity_price_eur_kwh: price,
        has_social_tariff: hasSocial,
        region_type: region,
        latitude: centroid.lat,
        longitude: centroid.lon,
        tilt_degrees: tilt,
        aspect_degrees: aspect,
        cost_per_kwp_eur: costPerKwp,
        battery_cost_eur: batteryCost
      };
      const endpoint = `${backendUrl || ""}/api/v1/simulation/`;
      const res = await axios.post(endpoint, payload);
      if (centroid) {
        localStorage.setItem("reisolari_lat", centroid.lat.toString());
        localStorage.setItem("reisolari_lon", centroid.lon.toString());
        localStorage.setItem("reisolari_region", region);
      }
      onSimulationResult(res.data);
    } catch {
      setError("Nao foi possivel executar a simulacao. Verifica se o backend esta ativo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="bg-card text-slate-100 p-4 rounded-lg space-y-3 border border-slate-800">
      <div className="text-sm text-slate-400">Area selecionada: {areaM2.toFixed(2)} m2</div>

      <label className="flex flex-col text-sm gap-1">
        Potencia pretendida (kWp)
        <input
          type="number"
          min={0}
          step={0.1}
          value={kwp}
          onChange={event => setKwp(parseFloat(event.target.value) || 0)}
          className="bg-slate-950 border border-slate-700 rounded-md px-2 py-1"
        />
      </label>

      <label className="flex flex-col text-sm gap-1">
        Preco eletricidade (EUR/kWh)
        <input
          type="number"
          min={0}
          step="0.01"
          value={price}
          onChange={event => setPrice(parseFloat(event.target.value) || 0)}
          className="bg-slate-950 border border-slate-700 rounded-md px-2 py-1"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col text-sm gap-1">
          Inclinacao
          <input
            type="number"
            min={0}
            max={90}
            value={tilt}
            onChange={event => setTilt(parseFloat(event.target.value) || 0)}
            className="bg-slate-950 border border-slate-700 rounded-md px-2 py-1"
          />
        </label>
        <label className="flex flex-col text-sm gap-1">
          Orientacao
          <input
            type="number"
            min={-180}
            max={180}
            value={aspect}
            onChange={event => setAspect(parseFloat(event.target.value) || 0)}
            className="bg-slate-950 border border-slate-700 rounded-md px-2 py-1"
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col text-sm gap-1">
          Custo sistema (EUR/kWp)
          <input
            type="number"
            min={0}
            step={10}
            value={costPerKwp}
            onChange={event => setCostPerKwp(parseFloat(event.target.value) || 0)}
            className="bg-slate-950 border border-slate-700 rounded-md px-2 py-1"
          />
        </label>
        <label className="flex flex-col text-sm gap-1">
          Custo bateria (EUR)
          <input
            type="number"
            min={0}
            step={100}
            value={batteryCost}
            onChange={event => setBatteryCost(parseFloat(event.target.value) || 0)}
            className="bg-slate-950 border border-slate-700 rounded-md px-2 py-1"
          />
        </label>
      </div>

      <label className="flex flex-col text-sm gap-1">
        Regiao fiscal
        <select
          value={region}
          onChange={event => setRegion(event.target.value as "continent" | "madeira" | "azores")}
          className="bg-slate-950 border border-slate-700 rounded-md px-2 py-1"
        >
          <option value="continent">Continente</option>
          <option value="madeira">Madeira</option>
          <option value="azores">Acores</option>
        </select>
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={hasSocial}
          onChange={event => setHasSocial(event.target.checked)}
        />
        Tarifa Social de Energia
      </label>

      {error ? <div className="text-sm text-red-300">{error}</div> : null}
      <button
        onClick={runSimulation}
        disabled={loading || !centroid || areaM2 <= 0}
        className="w-full bg-accent text-black font-semibold py-2 rounded-md disabled:opacity-50"
      >
        {loading ? "A simular..." : "Simular sistema"}
      </button>
    </section>
  );
};

export default SimulationPanel;
