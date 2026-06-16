"use client";

import React, { useRef, useState } from "react";
import {
  RecaptchaVerifier,
  signInAnonymously,
  signInWithPhoneNumber,
  signInWithPopup,
  type ConfirmationResult
} from "firebase/auth";
import { auth, githubProvider, googleProvider } from "@/lib/firebase";
import { translateAuthError } from "@/lib/authErrors";

type Props = {
  onSuccess: () => void;
  onError: (message: string) => void;
};

export default function AuthExtraMethods({ onSuccess, onError }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [phoneStep, setPhoneStep] = useState<"idle" | "phone" | "code">("idle");
  const [phone, setPhone] = useState("+351");
  const [code, setCode] = useState("");
  const confirmationRef = useRef<ConfirmationResult | null>(null);
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);

  const getRecaptcha = () => {
    if (!recaptchaRef.current) {
      recaptchaRef.current = new RecaptchaVerifier(auth, "recaptcha-container", {
        size: "invisible"
      });
    }
    return recaptchaRef.current;
  };

  const resetRecaptcha = () => {
    try {
      recaptchaRef.current?.clear();
    } catch {
      // ignore
    }
    recaptchaRef.current = null;
  };

  const runPopup = async (provider: typeof googleProvider, key: string) => {
    onError("");
    setBusy(key);
    try {
      await signInWithPopup(auth, provider);
      onSuccess();
    } catch (err) {
      onError(translateAuthError(err));
    } finally {
      setBusy(null);
    }
  };

  const runAnonymous = async () => {
    onError("");
    setBusy("anon");
    try {
      await signInAnonymously(auth);
      onSuccess();
    } catch (err) {
      onError(translateAuthError(err));
    } finally {
      setBusy(null);
    }
  };

  const sendCode = async () => {
    onError("");
    if (!/^\+\d{6,15}$/.test(phone.replace(/\s/g, ""))) {
      onError("Número inválido. Use o formato internacional, ex.: +351912345678.");
      return;
    }
    setBusy("phone");
    try {
      confirmationRef.current = await signInWithPhoneNumber(
        auth,
        phone.replace(/\s/g, ""),
        getRecaptcha()
      );
      setPhoneStep("code");
    } catch (err) {
      resetRecaptcha();
      onError(translateAuthError(err));
    } finally {
      setBusy(null);
    }
  };

  const confirmCode = async () => {
    onError("");
    if (!confirmationRef.current) return;
    setBusy("phone");
    try {
      await confirmationRef.current.confirm(code.trim());
      onSuccess();
    } catch (err) {
      onError(translateAuthError(err));
    } finally {
      setBusy(null);
    }
  };

  const btn =
    "w-full flex items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-100 text-sm font-medium py-2.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-3 py-1">
        <div className="h-px flex-1 bg-slate-800" />
        <span className="text-[11px] uppercase tracking-wider text-slate-500">
          ou continue com
        </span>
        <div className="h-px flex-1 bg-slate-800" />
      </div>

      <button
        type="button"
        onClick={() => runPopup(googleProvider, "google")}
        disabled={busy !== null}
        className={btn}
      >
        <span className="font-bold text-base text-[#4285F4]">G</span> Google
      </button>

      <button
        type="button"
        onClick={() => runPopup(githubProvider, "github")}
        disabled={busy !== null}
        className={btn}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
        </svg>
        GitHub
      </button>

      {phoneStep === "idle" ? (
        <button
          type="button"
          onClick={() => {
            onError("");
            setPhoneStep("phone");
          }}
          disabled={busy !== null}
          className={btn}
        >
          📱 Telemóvel (SMS)
        </button>
      ) : (
        <div className="space-y-2 rounded-lg border border-slate-700 bg-slate-900 p-3">
          {phoneStep === "phone" ? (
            <>
              <label className="text-xs text-slate-400">Número de telemóvel</label>
              <input
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+351912345678"
                className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-600"
              />
              <button
                type="button"
                onClick={sendCode}
                disabled={busy === "phone"}
                className="w-full rounded-md bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-sm font-semibold py-2 disabled:opacity-50"
              >
                {busy === "phone" ? "A enviar..." : "Enviar código SMS"}
              </button>
            </>
          ) : (
            <>
              <label className="text-xs text-slate-400">
                Código recebido por SMS
              </label>
              <input
                value={code}
                onChange={e => setCode(e.target.value)}
                inputMode="numeric"
                placeholder="123456"
                className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-600 tracking-widest"
              />
              <button
                type="button"
                onClick={confirmCode}
                disabled={busy === "phone"}
                className="w-full rounded-md bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-sm font-semibold py-2 disabled:opacity-50"
              >
                {busy === "phone" ? "A confirmar..." : "Confirmar e entrar"}
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => {
              setPhoneStep("idle");
              setCode("");
              resetRecaptcha();
            }}
            className="w-full text-[11px] text-slate-500 hover:text-slate-300"
          >
            Cancelar
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={runAnonymous}
        disabled={busy !== null}
        className={btn}
      >
        👤 Continuar como anónimo
      </button>

      {/* Invisible reCAPTCHA target for phone auth */}
      <div id="recaptcha-container" />
    </div>
  );
}
