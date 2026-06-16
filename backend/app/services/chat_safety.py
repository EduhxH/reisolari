"""Anti-scam scanning for chat messages.

Detects attempts to move the deal off-platform (phone numbers, emails, external
messaging apps, "pay outside" phrasing). Messages are never blocked — free
speech between users is preserved — but a flagged message triggers an inline
system warning so the buyer is reminded to keep the deal inside the platform,
mirroring OLX/Mercado Livre safety nudges.
"""

from __future__ import annotations

import re

# Portuguese mobile (9xx xxx xxx), +351 prefixes, or any 9+ digit run.
_PHONE = re.compile(
    r"(?:\+?351[\s.\-]?)?9\d{2}[\s.\-]?\d{3}[\s.\-]?\d{3}|\b\d{9,}\b"
)
_EMAIL = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")
_APPS = re.compile(
    r"\b(whats?app|whatsapp|zap|telegram|signal|insta(?:gram)?|messenger|wechat|viber|skype)\b",
    re.IGNORECASE,
)
_OFF_PLATFORM = re.compile(
    r"\b(fora da plataforma|por fora|liga[\s\-]?me|chama[\s\-]?me|"
    r"o?\s*meu\s*(n[uú]mero|contacto|contato|email|e-?mail)|"
    r"manda(?:r)?\s*(?:mensagem|sms)|paga(?:mento|r)?\s*(?:por|em)\s*(?:mbway|mb way|transfer[eê]ncia|dinheiro))\b",
    re.IGNORECASE,
)

WARNING_TEXT = (
    "⚠️ Por segurança, mantenha a conversa e o pagamento dentro da Reisolari. "
    "Pedir contactos ou pagar fora da plataforma foge às nossas diretrizes e é "
    "um sinal comum de burla. Saiba mais em /diretrizes."
)


def scan_message(content: str) -> dict:
    """Return {flagged: bool, categories: list[str]} for a message body."""
    text = content or ""
    categories: list[str] = []
    if _PHONE.search(text):
        categories.append("telefone")
    if _EMAIL.search(text):
        categories.append("email")
    if _APPS.search(text):
        categories.append("app_externa")
    if _OFF_PLATFORM.search(text):
        categories.append("fora_plataforma")
    return {"flagged": bool(categories), "categories": categories}
