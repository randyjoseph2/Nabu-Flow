"""Small shared cleaning helpers (pure Python, no Home Assistant imports)."""

from __future__ import annotations

import re
from typing import Any

_SLUG_RE = re.compile(r"[^a-z0-9_]+")
_NOTIFY_RE = re.compile(r"^notify\.[a-z0-9_]+$")
_ENTITY_RE = re.compile(r"^[a-z0-9_]+\.[a-z0-9_]+$")

def slugify(value: Any) -> str:
    """Lowercase, underscores only, max 48 chars."""
    text = _SLUG_RE.sub("_", str(value if value is not None else "").strip().lower())
    return text.strip("_")[:48]


def _text(value: Any, limit: int = 200) -> str:
    if value is None:
        return ""
    return str(value).strip()[:limit]


def _digits(value: Any) -> str:
    text = _text(value, 30)
    return text if text.isdigit() else ""


def _bool(value: Any, default: bool) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        low = value.strip().lower()
        if low in ("true", "1", "yes", "on"):
            return True
        if low in ("false", "0", "no", "off"):
            return False
    return default


def _int(value: Any, default: int, low: int, high: int) -> int:
    try:
        number = int(float(value))
    except (TypeError, ValueError):
        return default
    return max(low, min(high, number))


def _choice(value: Any, allowed: tuple[str, ...], default: str) -> str:
    text = _text(value, 40).lower()
    return text if text in allowed else default


def clean_who(value: Any) -> list[str]:
    """Normalize a recipients value to a list of person keys, or ["all"]."""
    if value is None:
        return ["all"]
    items = value.split(",") if isinstance(value, str) else list(value)
    out: list[str] = []
    for item in items:
        key = slugify(item)
        if key in ("all", "both", "everyone"):
            return ["all"]
        if key and key not in out:
            out.append(key)
    return out or ["all"]
