"""Lightweight, dependency-free input sanitization for free-text fields.

The marketplace description is plain text (rendered escaped by the client), but
we also strip HTML server-side so stored values are safe in any consumer (emails,
admin, other apps). The tag regex only matches ``<`` immediately followed by a
letter or ``/``, so legitimate text like ``potência < 500W`` or ``<3`` is kept,
while ``<b>``, ``<img onerror=...>`` and ``<script>…</script>`` are removed.
"""

from __future__ import annotations

import re

_SCRIPT_STYLE = re.compile(r"<(script|style)\b[^>]*>.*?</\1>", re.IGNORECASE | re.DOTALL)
_HTML_TAG = re.compile(r"</?[a-zA-Z][^<>]*>")


def strip_html(text: str | None) -> str | None:
    """Remove script/style blocks and HTML tags, preserving plain text."""
    if not text:
        return text
    cleaned = _SCRIPT_STYLE.sub("", text)
    cleaned = _HTML_TAG.sub("", cleaned)
    return cleaned.strip()
