"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useRequireAuth, AuthChecking } from "@/lib/useRequireAuth";
import {
  listOpenReports,
  resolveReport,
  REASON_LABELS,
  type ReportGroup
} from "@/lib/reports";

export default function AdminReportsPage() {
  const { user } = useAuth();
  const { ready } = useRequireAuth();
  const [groups, setGroups] = useState<ReportGroup[]>([]);
  const [denied, setDenied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const token = await user.getIdToken();
      setGroups(await listOpenReports(token));
      setDenied(false);
    } catch (error: any) {
      if (error?.response?.status === 403) setDenied(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (ready) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const resolve = async (group: ReportGroup, action: "dismiss" | "remove") => {
    if (!user) return;
    setBusy(group.key);
    try {
      const token = await user.getIdToken();
      await resolveReport(token, group.target_type, group.target_id, action);
      setGroups(prev => prev.filter(item => item.key !== group.key));
    } catch {
      // ignore
    } finally {
      setBusy(null);
    }
  };

  if (!ready) return <AuthChecking />;

  if (denied) {
    return (
      <main className="min-h-screen bg-bg text-slate-100 grid place-items-center p-6">
        <div className="text-center space-y-3">
          <p className="text-slate-300">Acesso restrito a moderadores.</p>
          <Link href="/marketplace" className="text-emerald-400 font-semibold">← Marketplace</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-bg text-slate-100 p-6">
      <div className="max-w-3xl mx-auto space-y-5">
        <header className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Moderação · Denúncias</h1>
            <p className="text-sm text-slate-400">Fila de denúncias pendentes, por alvo.</p>
          </div>
          <Link href="/marketplace" className="text-xs font-semibold text-slate-300 hover:text-emerald-300">
            ← Marketplace
          </Link>
        </header>

        {loading ? <p className="text-sm text-slate-400">A carregar…</p> : null}

        {!loading && groups.length === 0 ? (
          <div className="text-sm text-slate-400 py-12 text-center border border-dashed border-slate-800 rounded-lg">
            Sem denúncias pendentes. 🎉
          </div>
        ) : (
          <ul className="space-y-3">
            {groups.map(group => {
              const isListing = group.target_type === "listing";
              const href = isListing ? `/anuncio/${group.target_id}` : `/perfil/${group.target_id}`;
              const title = isListing ? group.info.title ?? "Anúncio" : group.info.name ?? "Utilizador";
              const reasons = Array.from(new Set(group.reasons)).map(r => REASON_LABELS[r] ?? r);
              return (
                <li key={group.key} className="rounded-xl border border-slate-800 bg-card p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <Link href={href} className="text-sm font-semibold text-slate-100 hover:text-emerald-300">
                        {title}
                      </Link>
                      <span className="text-[11px] text-slate-500 ml-2">
                        {isListing ? "anúncio" : "utilizador"}
                      </span>
                      {isListing && group.info.active === false ? (
                        <span className="ml-2 text-[10px] font-bold text-red-300">removido</span>
                      ) : null}
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 text-[10px] font-bold">
                      {group.count} {group.count === 1 ? "denúncia" : "denúncias"}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-400">{reasons.join(" · ")}</p>

                  {group.details.length > 0 ? (
                    <ul className="space-y-1">
                      {group.details.slice(0, 5).map((detail, index) => (
                        <li key={index} className="text-[11px] text-slate-500 italic">“{detail}”</li>
                      ))}
                    </ul>
                  ) : null}

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => resolve(group, "dismiss")}
                      disabled={busy === group.key}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-300 bg-slate-900 border border-slate-800 hover:border-emerald-700 disabled:opacity-50"
                    >
                      Dispensar
                    </button>
                    {isListing ? (
                      <button
                        onClick={() => resolve(group, "remove")}
                        disabled={busy === group.key}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-950 bg-red-500 hover:bg-red-400 disabled:opacity-50"
                      >
                        Remover anúncio
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
