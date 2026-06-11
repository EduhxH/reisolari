"use client";

import React, { useState } from "react";
import MapSolar from "@/components/MapSolar";
import SimulationPanel from "@/components/SimulationPanel";
import AgentAnalysisPanel from "@/components/AgentAnalysisPanel";
import GdprConsent from "@/components/GdprConsent";

export default function DashboardPage() {
  const [areaM2, setAreaM2] = useState(0);
  const [centroid, setCentroid] = useState<{ lat: number; lon: number } | null>(null);
  const [simulation, setSimulation] = useState<any | null>(null);
  const [consent, setConsent] = useState(false);

  const handlePolygonChange = (area: number, c: { lat: number; lon: number }) => {
    setAreaM2(area);
    setCentroid(c);
  };

  return (
    <main className="min-h-screen bg-bg text-slate-100 p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Marketplace P2P & Simulador Solar – Portugal</h1>
      <div className="grid lg:grid-cols-[2fr,1fr] gap-6">
        <MapSolar onPolygonChange={handlePolygonChange} />
        <div className="space-y-4">
          <GdprConsent checked={consent} onChange={setConsent} />
          <SimulationPanel
            areaM2={consent ? areaM2 : 0}
            centroid={consent ? centroid : null}
            onSimulationResult={setSimulation}
          />
        </div>
      </div>
      <AgentAnalysisPanel simulation={simulation} />
    </main>
  );
}
