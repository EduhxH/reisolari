// Maps Firebase Auth error codes to friendly Portuguese messages.
const MESSAGES: Record<string, string> = {
  "auth/invalid-email": "Email inválido.",
  "auth/user-disabled": "Esta conta foi desativada.",
  "auth/user-not-found": "Não existe nenhuma conta com este email.",
  "auth/wrong-password": "Email ou palavra-passe incorretos.",
  "auth/invalid-credential": "Email ou palavra-passe incorretos.",
  "auth/email-already-in-use": "Este email já está registado. Inicie sessão.",
  "auth/weak-password": "A palavra-passe deve ter pelo menos 6 caracteres.",
  "auth/missing-password": "Introduza a palavra-passe.",
  "auth/too-many-requests":
    "Demasiadas tentativas. Tente novamente mais tarde.",
  "auth/popup-closed-by-user": "Janela fechada antes de concluir o login.",
  "auth/cancelled-popup-request": "Pedido de login cancelado.",
  "auth/popup-blocked":
    "O navegador bloqueou a janela. Permita popups e tente de novo.",
  "auth/account-exists-with-different-credential":
    "Já existe uma conta com este email usando outro método de login.",
  "auth/operation-not-allowed":
    "Este método de login não está ativado no projeto Firebase.",
  "auth/invalid-phone-number": "Número de telemóvel inválido.",
  "auth/missing-phone-number": "Introduza o número de telemóvel.",
  "auth/invalid-verification-code": "Código de verificação incorreto.",
  "auth/code-expired": "O código expirou. Peça um novo.",
  "auth/network-request-failed": "Falha de rede. Verifique a ligação."
};

export function translateAuthError(error: unknown): string {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code: unknown }).code)
      : "";
  if (code && MESSAGES[code]) return MESSAGES[code];
  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message: unknown }).message)
      : "";
  return message || "Ocorreu um erro. Tente novamente.";
}

/** Resolve an internal-only redirect target from the current URL. */
export function getRedirectTarget(fallback = "/marketplace"): string {
  if (typeof window === "undefined") return fallback;
  const target = new URLSearchParams(window.location.search).get("redirect");
  return target && target.startsWith("/") ? target : fallback;
}
