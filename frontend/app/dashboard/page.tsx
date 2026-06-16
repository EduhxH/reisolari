"use client";

import Link from "next/link";
import React, { useState } from "react";
import AgentAnalysisPanel from "@/components/AgentAnalysisPanel";
import GdprConsent from "@/components/GdprConsent";
import MapSolar from "@/components/MapSolar";
import SimulationPanel from "@/components/SimulationPanel";
import AuthHeaderButtons from "@/components/AuthHeaderButtons";

export default function DashboardPage() {
  const [areaM2, setAreaM2] = useState(0);
  const [centroid, setCentroid] = useState<{ lat: number; lon: number } | null>(null);
  const [simulation, setSimulation] = useState<any | null>(null);
  const [consent, setConsent] = useState(false);

  const handlePolygonChange = (area: number, c: { lat: number; lon: number }) => {
    setAreaM2(area);
    setCentroid(area > 0 ? c : null);
  };

  return (
    <main className="min-h-screen bg-bg text-slate-100 p-6 space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">Reisolari</h1>
          <p className="text-sm text-slate-400">Marketplace P2P e simulador solar para Portugal</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/marketplace" className="text-sm text-emerald-300 hover:text-emerald-200">
            Ver marketplace
          </Link>
          <AuthHeaderButtons />
        </div>
      </div>
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
