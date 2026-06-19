"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { createReport, REPORT_REASONS, type ReportReason } from "@/lib/reports";

export default function ReportDialog({
  targetType,
  targetId,
  label,
  alreadyReported = false
}: {
  targetType: "listing" | "user";
  targetId: string;
  label?: string;
  alreadyReported?: boolean;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>("fraude");
  const [detail, setDetail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(alreadyReported);

  const submit = async () => {
    if (!user) {
      router.push("/login");
      return;
    }
    setSubmitting(true);
    try {
      const token = await user.getIdToken();
      await createReport(token, targetType, targetId, reason, detail.trim() || undefined);
      setDone(true);
      setOpen(false);
    } catch {
      // ignore — backend dedupes; re-submitting is harmless
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return <span className="text-[11px] text-supaste-muted">✓ Denúncia enviada</span>;
  }

  return (
    <>
      <button
        onClick={() => (user ? setOpen(true) : router.push("/login"))}
        className="text-[11px] text-supaste-muted hover:text-red-400"
      >
        {label ?? "🚩 Denunciar"}
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-black/10 bg-white p-5 space-y-3"
            onClick={event => event.stopPropagation()}
          >
            <h3 className="text-sm font-semibold text-white">
              Denunciar {targetType === "listing" ? "anúncio" : "utilizador"}
            </h3>
            <p className="text-[11px] text-supaste-muted">
              A sua denúncia é anónima e ajuda a manter a Reisolari segura.
            </p>
            <select
              value={reason}
              onChange={event => setReason(event.target.value as ReportReason)}
              className="w-full rounded-lg bg-white border border-black/10 px-3 py-2 text-sm text-supaste-ink outline-none focus:border-supaste-blue cursor-pointer"
            >
              {REPORT_REASONS.map(item => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <textarea
              value={detail}
              onChange={event => setDetail(event.target.value)}
              rows={3}
              maxLength={600}
              placeholder="Detalhes (opcional)…"
              className="w-full rounded-lg bg-white border border-black/10 px-3 py-2 text-sm text-supaste-ink outline-none focus:border-supaste-blue"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setOpen(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-supaste-muted bg-supaste-section border border-black/10"
              >
                Cancelar
              </button>
              <button
                onClick={submit}
                disabled={submitting}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-950 bg-red-500 hover:bg-red-400 disabled:opacity-50"
              >
                {submitting ? "A enviar…" : "Enviar denúncia"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
