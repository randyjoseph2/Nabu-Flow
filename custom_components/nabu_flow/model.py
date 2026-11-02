"""Config model and sanitizers for Nabu Flow.

Pure Python: no Home Assistant imports, so it can be unit tested anywhere.
Everything that comes from the panel or an import goes through these
cleaners before it is stored.
"""

from __future__ import annotations

import copy
from typing import Any

from .alerts_model import clean_alerts, default_alerts
from .cleaners import (  # noqa: F401
    _ENTITY_RE,
    _NOTIFY_RE,
    _SLUG_RE,
    _bool,
    _choice,
    _digits,
    _int,
    _text,
    clean_who,
    slugify,
)
from .const import (
    HISTORY_MAX,
    MAX_CHANNELS,
    MAX_PEOPLE,
    MAX_ROUTES,
    PHONE_MODES,
    PRESENCE_MODES,
    SECTIONS,
    SEVERITIES,
)

DEFAULT_SETTINGS: dict[str, Any] = {
    "notify_service": "notify.nabu",
    "quiet_entity": "input_boolean.nabu_quiet_mode",
    "default_channel": "server_and_ha",
    "digest_channel": "digest",
    "critical_log_channel": "critical_log",
    "announce_service": "",
    "snapshot_path": "",
    "history_size": HISTORY_MAX,
}

DEFAULT_CHANNELS: dict[str, dict[str, str]] = {
    "doors": {"name": "Doors and locks", "discord_id": ""},
    "garage": {"name": "Garage", "discord_id": ""},
    "appliances": {"name": "Appliances", "discord_id": ""},
    "cameras": {"name": "Cameras", "discord_id": ""},
    "server_and_ha": {"name": "Server and HA", "discord_id": ""},
    "network": {"name": "Network", "discord_id": ""},
    "updates": {"name": "Updates", "discord_id": ""},
    "chore_quest": {"name": "Chore Quest", "discord_id": ""},
    "groceries": {"name": "Groceries and todo", "discord_id": ""},
    "reminders": {"name": "Reminders", "discord_id": ""},
    "digest": {"name": "Digest", "discord_id": ""},
    "critical_log": {"name": "Critical log", "discord_id": ""},
}


def default_config() -> dict[str, Any]:
    """A fresh config with the standard channel keys and no people or routes."""
    return {
        "settings": dict(DEFAULT_SETTINGS),
        "people": {},
        "channels": copy.deepcopy(DEFAULT_CHANNELS),
        "routes": {},
        "alerts": default_alerts(),
    }


def clean_settings(raw: Any) -> dict[str, Any]:
    raw = raw if isinstance(raw, dict) else {}
    out = dict(DEFAULT_SETTINGS)

    def service(key: str) -> str:
        value = _text(raw.get(key, out[key]), 80).lower()
        return value if _NOTIFY_RE.match(value) else ("" if key == "announce_service" else out[key])

    out["notify_service"] = service("notify_service")
    out["announce_service"] = service("announce_service") if raw.get("announce_service") else ""
    quiet = _text(raw.get("quiet_entity", out["quiet_entity"]), 80).lower()
    out["quiet_entity"] = quiet if (quiet == "" or _ENTITY_RE.match(quiet)) else out["quiet_entity"]
    for key in ("default_channel", "digest_channel", "critical_log_channel"):
        out[key] = slugify(raw.get(key, out[key])) or DEFAULT_SETTINGS[key]
    path = _text(raw.get("snapshot_path", ""), 200)
    out["snapshot_path"] = path if path.startswith("/") else ""
    out["history_size"] = _int(raw.get("history_size"), HISTORY_MAX, 10, 500)
    return out


def clean_people(raw: Any) -> dict[str, dict[str, str]]:
    raw = raw if isinstance(raw, dict) else {}
    out: dict[str, dict[str, str]] = {}
    for key, val in raw.items():
        slug = slugify(key)
        if not slug or slug in ("all", "both", "everyone") or len(out) >= MAX_PEOPLE:
            continue
        val = val if isinstance(val, dict) else {}
        entity = _text(val.get("person_entity"), 80).lower()
        phone = _text(val.get("phone_service"), 80).lower()
        out[slug] = {
            "name": _text(val.get("name"), 60) or slug.replace("_", " ").title(),
            "person_entity": entity if entity.startswith("person.") and _ENTITY_RE.match(entity) else "",
            "phone_service": phone if _NOTIFY_RE.match(phone) else "",
            "discord_id": _digits(val.get("discord_id")),
        }
    return out


def clean_channels(raw: Any) -> dict[str, dict[str, str]]:
    raw = raw if isinstance(raw, dict) else {}
    out: dict[str, dict[str, str]] = {}
    for key, val in raw.items():
        slug = slugify(key)
        if not slug or len(out) >= MAX_CHANNELS:
            continue
        val = val if isinstance(val, dict) else {}
        out[slug] = {
            "name": _text(val.get("name"), 60) or slug.replace("_", " ").title(),
            "discord_id": _digits(val.get("discord_id")),
        }
    return out


def clean_routes(raw: Any) -> dict[str, dict[str, Any]]:
    raw = raw if isinstance(raw, dict) else {}
    out: dict[str, dict[str, Any]] = {}
    for key, val in raw.items():
        slug = slugify(key)
        if not slug or len(out) >= MAX_ROUTES:
            continue
        val = val if isinstance(val, dict) else {}
        out[slug] = {
            "name": _text(val.get("name"), 80) or slug.replace("_", " ").title(),
            "channel": slugify(val.get("channel")),
            "who": clean_who(val.get("who")),
            "severity": _choice(val.get("severity"), SEVERITIES, "info"),
            "discord": _bool(val.get("discord"), True),
            "phone": _choice(val.get("phone"), PHONE_MODES, "auto"),
            "presence": _choice(val.get("presence"), PRESENCE_MODES, "aware"),
            "announce": _bool(val.get("announce"), False),
            "cooldown": _int(val.get("cooldown"), 0, 0, 86400),
            "enabled": _bool(val.get("enabled"), True),
        }
    return out


_CLEANERS = {
    "settings": clean_settings,
    "people": clean_people,
    "channels": clean_channels,
    "routes": clean_routes,
    "alerts": clean_alerts,
}


def clean_section(section: str, raw: Any) -> Any:
    if section not in SECTIONS:
        raise ValueError(f"Unknown section: {section}")
    return _CLEANERS[section](raw)


def merge_config(raw: Any) -> dict[str, Any]:
    """Build a complete, sanitized config from whatever was stored or imported."""
    raw = raw if isinstance(raw, dict) else {}
    config = default_config()
    for section in SECTIONS:
        if section in raw:
            config[section] = clean_section(section, raw[section])
    return config
