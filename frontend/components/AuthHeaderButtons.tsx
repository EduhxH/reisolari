"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useAuth, displayNameFor } from "@/lib/auth";

export default function AuthHeaderButtons() {
  const { user, loading, signOut } = useAuth();
  const [open, setOpen] = useState(false);

  if (loading) {
    return <div className="h-8 w-24 rounded-lg bg-slate-900 animate-pulse" />;
  }

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Link
          href="/login"
          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-200 bg-slate-900 border border-slate-800 hover:border-emerald-700 hover:text-emerald-300 transition-colors"
        >
          Login
        </Link>
        <Link
          href="/criar-conta"
          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-950 bg-emerald-500 hover:bg-emerald-400 transition-colors"
        >
          Criar conta
        </Link>
      </div>
    );
  }

  const label = displayNameFor(user);
  const initial = label.charAt(0).toUpperCase();

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(value => !value)}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-200 bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors"
      >
        <span className="grid place-items-center h-5 w-5 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-bold">
          {initial}
        </span>
        <span className="max-w-[140px] truncate">{label}</span>
        <span className="text-slate-500">▾</span>
      </button>

      {open ? (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-56 z-20 rounded-lg border border-slate-800 bg-slate-950 shadow-xl p-1.5">
            <div className="px-3 py-2 border-b border-slate-800">
              <p className="text-xs text-slate-200 truncate">{label}</p>
              {user.email ? (
                <p className="text-[10px] text-slate-500 truncate">{user.email}</p>
              ) : null}
              {user.isAnonymous ? (
                <p className="text-[10px] text-amber-400/80">Sessão anónima</p>
              ) : null}
            </div>
            <button
              onClick={async () => {
                setOpen(false);
                await signOut();
              }}
              className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-slate-900 rounded-md transition-colors"
            >
              Terminar sessão
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
