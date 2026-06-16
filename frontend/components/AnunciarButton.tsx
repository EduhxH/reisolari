"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { ANUNCIAR_ROUTE, markSellerIntent } from "@/lib/onboarding";

export default function AnunciarButton({
  className
}: {
  className?: string;
}) {
  const router = useRouter();
  const { user } = useAuth();

  const handleClick = () => {
    if (user) {
      router.push(ANUNCIAR_ROUTE);
    } else {
      // Remember the intent so post-onboarding routes straight to the wizard.
      markSellerIntent();
      router.push("/criar-conta");
    }
  };

  return (
    <button
      onClick={handleClick}
      className={
        className ??
        "px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 transition-colors"
      }
    >
      Anunciar
    </button>
  );
}
