"use client";

import React, { useRef, useState } from "react";
import {
  RecaptchaVerifier,
  signInAnonymously,
  signInWithPhoneNumber,
  signInWithPopup,
  type ConfirmationResult
} from "firebase/auth";
import { ArrowLeft, Hash, Phone, User } from "lucide-react";
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
    setBusy("guest");
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
      onError("Numero invalido. Use o formato internacional, ex.: +351912345678.");
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
    "supaste-button flex min-h-[46px] w-full items-center justify-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2.5 text-sm font-semibold text-supaste-black transition-all duration-400 ease-in-out hover:border-supaste-blue/30 disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-3 py-1">
        <div className="h-px flex-1 bg-black/10" />
        <span className="font-mono text-[11px] uppercase tracking-wider text-supaste-muted">
          ou continue com
        </span>
        <div className="h-px flex-1 bg-black/10" />
      </div>

      <button
        type="button"
        onClick={() => runPopup(googleProvider, "google")}
        disabled={busy !== null}
        className={btn}
      >
        <GoogleIcon /> Google
      </button>

      <button
        type="button"
        onClick={() => runPopup(githubProvider, "github")}
        disabled={busy !== null}
        className={btn}
      >
        <GitHubIcon /> GitHub
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
          <Phone className="h-4 w-4" /> Telemovel por SMS
        </button>
      ) : (
        <div className="supaste-glass-strong space-y-3 rounded-[24px] p-4">
          {phoneStep === "phone" ? (
            <>
              <label className="flex items-center gap-2 text-xs font-semibold text-supaste-muted">
                <Phone className="h-3.5 w-3.5" /> Numero de telemovel
              </label>
              <input
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+351912345678"
                className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm text-supaste-black outline-none transition-colors duration-300 focus:border-supaste-blue"
              />
              <button
                type="button"
                onClick={sendCode}
                disabled={busy === "phone"}
                className="supaste-button w-full rounded-full bg-supaste-black py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {busy === "phone" ? "A enviar..." : "Enviar codigo SMS"}
              </button>
            </>
          ) : (
            <>
              <label className="flex items-center gap-2 text-xs font-semibold text-supaste-muted">
                <Hash className="h-3.5 w-3.5" /> Codigo recebido por SMS
              </label>
              <input
                value={code}
                onChange={e => setCode(e.target.value)}
                inputMode="numeric"
                placeholder="123456"
                className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-center font-mono text-sm tracking-[0.35em] text-supaste-black outline-none transition-colors duration-300 focus:border-supaste-blue"
              />
              <button
                type="button"
                onClick={confirmCode}
                disabled={busy === "phone"}
                className="supaste-button w-full rounded-full bg-supaste-black py-2.5 text-sm font-semibold text-white disabled:opacity-50"
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
            className="flex w-full items-center justify-center gap-1 text-[11px] font-semibold text-supaste-muted transition-colors duration-300 hover:text-supaste-black"
          >
            <ArrowLeft className="h-3 w-3" />
            Cancelar
          </button>
        </div>
      )}

      <button type="button" onClick={runAnonymous} disabled={busy !== null} className={btn}>
        <User className="h-4 w-4" /> Continuar como convidado
      </button>

      <div id="recaptcha-container" />
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 18 18" aria-hidden>
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.33-1.58-5.04-3.71H.94v2.33A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.96 10.71A5.41 5.41 0 0 1 3.68 9c0-.59.1-1.16.28-1.71V4.96H.94A9 9 0 0 0 0 9c0 1.45.35 2.82.94 4.04l3.02-2.33z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.42 0 9 0A9 9 0 0 0 .94 4.96l3.02 2.33C4.67 5.16 6.66 3.58 9 3.58z"
      />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}
