"use client";

import Link from "next/link";
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, LayoutGrid, LogOut, Settings, UserRound } from "lucide-react";
import { displayNameFor, useAuth } from "@/lib/auth";

export default function AuthHeaderButtons() {
  const { user, loading, signOut } = useAuth();
  const [open, setOpen] = useState(false);

  if (loading) {
    return <div className="h-10 w-28 animate-pulse rounded-full bg-black/10" />;
  }

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Link
          href="/login"
          className="supaste-button rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-semibold text-supaste-black"
        >
          Login
        </Link>
        <Link
          href="/criar-conta"
          className="supaste-button rounded-full bg-supaste-black px-4 py-2 text-xs font-semibold text-white"
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
        className="supaste-button flex items-center gap-2 rounded-full border border-black/10 bg-white px-2 py-1.5 text-xs font-semibold text-supaste-black"
      >
        <span className="grid h-7 w-7 place-items-center rounded-full bg-supaste-blue text-[11px] font-bold text-white">
          {initial}
        </span>
        <span className="hidden max-w-[130px] truncate sm:inline">{label}</span>
        <ChevronDown className="h-3.5 w-3.5 text-supaste-muted" />
      </button>

      <AnimatePresence>
        {open ? (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="supaste-glass-strong absolute right-0 z-20 mt-2 w-64 rounded-[24px] p-2"
            >
              <div className="flex items-center gap-3 border-b border-black/10 px-3 py-2.5">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-supaste-blue text-sm font-bold text-white">
                  {initial}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-supaste-black">{label}</p>
                  {user.email ? <p className="truncate text-[11px] text-supaste-muted">{user.email}</p> : null}
                  {user.isAnonymous ? (
                    <p className="text-[11px] font-semibold text-supaste-blue">Sessão de convidado</p>
                  ) : null}
                </div>
              </div>

              <nav className="py-1">
                <MenuLink href={`/perfil/${user.uid}`} icon={<UserRound className="h-4 w-4" />} onClick={() => setOpen(false)}>
                  Perfil público
                </MenuLink>
                <MenuLink href="/ideais" icon={<LayoutGrid className="h-4 w-4" />} onClick={() => setOpen(false)}>
                  Propostas ideais
                </MenuLink>
                <MenuLink href="/conta" icon={<Settings className="h-4 w-4" />} onClick={() => setOpen(false)}>
                  Definições
                </MenuLink>
              </nav>

              <div className="border-t border-black/10 pt-1">
                <button
                  onClick={async () => {
                    setOpen(false);
                    await signOut();
                  }}
                  className="flex w-full items-center gap-2.5 rounded-[18px] px-3 py-2.5 text-left text-sm font-semibold text-supaste-muted transition-colors hover:bg-supaste-section hover:text-red-600"
                >
                  <LogOut className="h-4 w-4" />
                  Terminar sessão
                </button>
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function MenuLink({
  href,
  icon,
  children,
  onClick
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-2.5 rounded-[18px] px-3 py-2.5 text-sm font-semibold text-supaste-ink transition-colors hover:bg-supaste-section"
    >
      <span className="text-supaste-muted">{icon}</span>
      {children}
    </Link>
  );
}
