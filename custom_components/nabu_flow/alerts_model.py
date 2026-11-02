"""Alerts Flow model: rule and settings cleaning, matching and evaluation.

Pure Python (no Home Assistant imports) so it can be unit tested anywhere.
The runtime that watches states lives in alerts.py.
"""

from __future__ import annotations

import fnmatch
import json
import re
from typing import Any

from .cleaners import _ENTITY_RE, _bool, _choice, _int, _text, clean_who, slugify

PRIORITIES = ("critical", "warning", "info", "low")
PRIORITY_RANK = {name: index for index, name in enumerate(PRIORITIES)}
OPERATORS = ("=", "!=", ">", "<", ">=", "<=", "contains", "not_contains")
MODES = ("state", "on_change", "persistent")
TAP_ACTIONS = ("default", "none", "more-info", "navigate", "url", "call-service")
TRANSITIONS = ("fold", "slide", "fade", "none")
CLEAR_MODES = ("hidden", "message", "clock", "weather", "weather_clock")
PLACEHOLDERS = ("name", "state", "entity", "device", "area", "trigger_state", "trigger_time", "rule")

MAX_RULES = 200
LOG_MAX = 100
ON_CHANGE_DEFAULT_SECONDS = 60

DEFAULT_ALERT_SETTINGS: dict[str, Any] = {
    "enabled": True,
    "cycle_seconds": 6,
    "transition": "fold",
    "severity_border": True,
    "show_count": False,
    "allow_user_actions": True,
    "snooze_hours": [1, 4, 8, 24],
    "clear_mode": "message",
    "clear_message": "All systems clear",
    "clear_weather_entity": "",
    "clock_24h": True,
    "clock_show_date": True,
}

_TIME_RE = re.compile(r"^([01]?\d|2[0-3]):([0-5]\d)$")
_PLACEHOLDER_RE = re.compile(r"\{(" + "|".join(PLACEHOLDERS) + r")\}")
_COLOR_RE = re.compile(r"^#[0-9a-fA-F]{3,8}$")
_ICON_RE = re.compile(r"^[a-z0-9_-]+:[a-z0-9_-]+$")
_SERVICE_RE = re.compile(r"^[a-z0-9_]+\.[a-z0-9_]+$")


# ---------- cleaning ----------
def default_alerts() -> dict[str, Any]:
    return {"settings": dict(DEFAULT_ALERT_SETTINGS), "rules": {}}


def clean_alert_settings(raw: Any) -> dict[str, Any]:
    raw = raw if isinstance(raw, dict) else {}
    out = dict(DEFAULT_ALERT_SETTINGS)
    out["enabled"] = _bool(raw.get("enabled"), out["enabled"])
    out["cycle_seconds"] = _int(raw.get("cycle_seconds"), out["cycle_seconds"], 3, 120)
    out["transition"] = _choice(raw.get("transition"), TRANSITIONS, out["transition"])
    for key in ("severity_border", "show_count", "allow_user_actions", "clock_24h", "clock_show_date"):
        out[key] = _bool(raw.get(key), out[key])
    hours = raw.get("snooze_hours", out["snooze_hours"])
    if isinstance(hours, str):
        hours = [h for h in re.split(r"[,\s]+", hours) if h]
    cleaned: list[int] = []
    for item in hours if isinstance(hours, (list, tuple)) else []:
        number = _int(item, 0, 0, 168)
        if number and number not in cleaned:
            cleaned.append(number)
    out["snooze_hours"] = sorted(cleaned)[:6] or list(DEFAULT_ALERT_SETTINGS["snooze_hours"])
    out["clear_mode"] = _choice(raw.get("clear_mode"), CLEAR_MODES, out["clear_mode"])
    out["clear_message"] = _text(raw.get("clear_message", out["clear_message"]), 80) or out["clear_message"]
    weather = _text(raw.get("clear_weather_entity"), 80).lower()
    out["clear_weather_entity"] = weather if weather.startswith("weather.") and _ENTITY_RE.match(weather) else ""
    return out


def _entity(value: Any) -> str:
    text = _text(value, 80).lower()
    return text if _ENTITY_RE.match(text) else ""


def _entity_list(value: Any) -> list[str]:
    items = re.split(r"[,\n]+", value) if isinstance(value, str) else list(value or [])
    out: list[str] = []
    for item in items:
        text = _text(item, 80).lower()
        if text and re.match(r"^[a-z0-9_*.?]+$", text) and text not in out:
            out.append(text)
    return out[:20]


def _clock(value: Any) -> str:
    text = _text(value, 5)
    match = _TIME_RE.match(text)
    return f"{int(match.group(1)):02d}:{match.group(2)}" if match else ""


def clean_action(raw: Any) -> dict[str, Any]:
    raw = raw if isinstance(raw, dict) else {}
    action = _choice(raw.get("action"), TAP_ACTIONS, "default")
    out: dict[str, Any] = {"action": action}
    if action == "navigate":
        path = _text(raw.get("navigation_path"), 200)
        out["navigation_path"] = path if path.startswith("/") else ""
    elif action == "url":
        url = _text(raw.get("url_path"), 300)
        out["url_path"] = url if url.startswith(("http://", "https://", "/")) else ""
    elif action == "more-info":
        out["entity"] = _entity(raw.get("entity"))
    elif action == "call-service":
        service = _text(raw.get("service"), 80).lower()
        out["service"] = service if _SERVICE_RE.match(service) else ""
        data = raw.get("service_data")
        if isinstance(data, str) and data.strip():
            try:
                data = json.loads(data)
            except ValueError:
                data = {}
        out["service_data"] = data if isinstance(data, dict) and len(json.dumps(data, default=str)) < 2000 else {}
        out["confirm"] = _bool(raw.get("confirm"), False)
    needed = {"navigate": "navigation_path", "url": "url_path", "call-service": "service"}
    if action in needed and not out.get(needed[action]):
        return {"action": "default"}
    return out


def clean_rule(raw: Any) -> dict[str, Any]:
    raw = raw if isinstance(raw, dict) else {}
    priority = raw.get("priority")
    if isinstance(priority, (int, float)) and 1 <= int(priority) <= 4:
        priority = PRIORITIES[int(priority) - 1]
    color = _text(raw.get("color"), 9)
    icon = _text(raw.get("icon"), 60).lower()
    name = _text(raw.get("name"), 80)
    return {
        "name": name or "Alert",
        "enabled": _bool(raw.get("enabled"), True),
        "entity": _entity(raw.get("entity")),
        "entity_filter": _text(raw.get("entity_filter"), 80).lower() if re.match(r"^[A-Za-z0-9_*.?]*$", _text(raw.get("entity_filter"), 80)) else "",
        "exclude": _entity_list(raw.get("exclude")),
        "device_class": slugify(raw.get("device_class")),
        "attribute": _text(raw.get("attribute"), 60) if re.match(r"^[A-Za-z0-9_.]*$", _text(raw.get("attribute"), 60)) else "",
        "operator": _choice(raw.get("operator"), OPERATORS, "="),
        "state": _text(raw.get("state"), 120),
        "ignore_unavailable": _bool(raw.get("ignore_unavailable"), True),
        "template": _text(raw.get("template"), 600),
        "time_from": _clock(raw.get("time_from")),
        "time_to": _clock(raw.get("time_to")),
        "priority": _choice(priority, PRIORITIES, "warning"),
        "message": _text(raw.get("message"), 300) or "{name} is {state}",
        "secondary": _text(raw.get("secondary"), 200),
        "icon": icon if _ICON_RE.match(icon) else "",
        "color": color if _COLOR_RE.match(color) else "",
        "mode": _choice(raw.get("mode"), MODES, "state"),
        "auto_dismiss": _int(raw.get("auto_dismiss"), 0, 0, 86400),
        "visible_to": clean_who(raw.get("visible_to")),
        "camera_entity": _entity(raw.get("camera_entity")) if _text(raw.get("camera_entity"), 80).lower().startswith("camera.") else "",
        "tap_action": clean_action(raw.get("tap_action")),
        "hold_action": clean_action(raw.get("hold_action")),
        "snoozable": _bool(raw.get("snoozable"), True),
        "route": slugify(raw.get("route")),
    }


def clean_alerts(raw: Any) -> dict[str, Any]:
    raw = raw if isinstance(raw, dict) else {}
    rules: dict[str, dict[str, Any]] = {}
    source = raw.get("rules")
    for key, val in (source.items() if isinstance(source, dict) else []):
        slug = slugify(key)
        if slug and len(rules) < MAX_RULES:
            rules[slug] = clean_rule(val)
    return {"settings": clean_alert_settings(raw.get("settings")), "rules": rules}


def has_source(rule: dict[str, Any]) -> bool:
    return bool(rule.get("entity") or rule.get("entity_filter") or rule.get("device_class") or rule.get("template"))


# ---------- matching and evaluation ----------
def _num(value: Any) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def compare(actual: Any, operator: str, target: Any) -> bool:
    a = "" if actual is None else str(actual)
    t = "" if target is None else str(target)
    if operator in ("contains", "not_contains"):
        hit = t.lower() in a.lower()
        return hit if operator == "contains" else not hit
    na, nt = _num(a), _num(t)
    if operator in ("=", "!="):
        same = (na == nt) if (na is not None and nt is not None) else a.lower() == t.lower()
        return same if operator == "=" else not same
    if na is None or nt is None:
        return False
    return {">": na > nt, "<": na < nt, ">=": na >= nt, "<=": na <= nt}.get(operator, False)


def in_time_range(minute_of_day: int, start: str, end: str) -> bool:
    """True when no range is set, or the minute falls inside it (midnight crossing allowed)."""
    if not start or not end:
        return True
    s = int(start[:2]) * 60 + int(start[3:])
    e = int(end[:2]) * 60 + int(end[3:])
    if s == e:
        return True
    if s < e:
        return s <= minute_of_day < e
    return minute_of_day >= s or minute_of_day < e


def get_path(attrs: Any, path: str) -> Any:
    node = attrs
    for part in path.split("."):
        if isinstance(node, dict) and part in node:
            node = node[part]
        elif isinstance(node, (list, tuple)) and part.isdigit() and int(part) < len(node):
            node = node[int(part)]
        else:
            return None
    return node


def match_entities(rule: dict[str, Any], entities: dict[str, dict[str, Any]]) -> list[str]:
    """Entity ids a rule watches. `entities` maps entity_id to its attributes."""
    ids: list[str] = []
    if rule.get("entity"):
        ids.append(rule["entity"])
    pattern = rule.get("entity_filter") or ""
    device_class = rule.get("device_class") or ""
    if pattern or device_class:
        if pattern and "*" not in pattern and "?" not in pattern and "." not in pattern:
            pattern = "*" + pattern + "*"
        for entity_id, attrs in entities.items():
            if pattern and not fnmatch.fnmatchcase(entity_id, pattern):
                continue
            if device_class and (attrs or {}).get("device_class") != device_class:
                continue
            if entity_id not in ids:
                ids.append(entity_id)
    excluded = rule.get("exclude") or []
    return [e for e in ids if not any(fnmatch.fnmatchcase(e, x) for x in excluded)]


def evaluate_rule(rule: dict[str, Any], state: str, attrs: Any, minute_of_day: int) -> bool:
    """Condition for one entity (template is handled by the runtime)."""
    if not in_time_range(minute_of_day, rule.get("time_from", ""), rule.get("time_to", "")):
        return False
    value: Any = state
    if rule.get("attribute"):
        value = get_path(attrs, rule["attribute"])
        if value is None:
            return False
    target = rule.get("state", "")
    if rule.get("ignore_unavailable", True) and str(value) in ("unavailable", "unknown") and target not in ("unavailable", "unknown"):
        return False
    return compare(value, rule.get("operator", "="), target)


def render_placeholders(text: str, context: dict[str, Any]) -> str:
    return _PLACEHOLDER_RE.sub(lambda m: str(context.get(m.group(1), "")), text or "")


def visible_to(rule: dict[str, Any], user_key: str, is_admin: bool) -> bool:
    who = rule.get("visible_to") or ["all"]
    if "all" in who:
        return True
    if user_key and user_key in who:
        return True
    if "admin" in who and is_admin:
        return True
    return "non_admin" in who and not is_admin


# ---------- AlertTicker import ----------
_AT_CLEAR = {"message": "message", "clock": "clock", "weather": "weather", "weather_clock": "weather_clock", "forecast": "weather", "weather_forecast": "weather"}
_AT_KNOWN = {
    "entity", "entity_filter", "entity_filter_exclude", "exclude", "device_class", "attribute", "operator", "state", "name",
    "message", "priority", "icon", "icon_color", "camera_entity", "persistent", "on_change", "auto_dismiss_after",
    "time_range", "visible_to", "tap_action", "hold_action", "secondary_text", "theme", "enabled",
}


def _convert_action(raw: Any) -> dict[str, Any]:
    if not isinstance(raw, dict):
        return {"action": "default"}
    action = str(raw.get("action") or "")
    if action in ("perform-action", "call-service"):
        return {
            "action": "call-service",
            "service": raw.get("perform_action") or raw.get("service") or "",
            "service_data": raw.get("data") or raw.get("service_data") or {},
        }
    return {
        "action": action or "default",
        "navigation_path": raw.get("navigation_path", ""),
        "url_path": raw.get("url_path", ""),
        "entity": raw.get("entity", ""),
    }


def convert_alertticker(config: Any) -> dict[str, Any]:
    """Best-effort conversion of an AlertTicker card config. Review the result before saving."""
    warnings: list[str] = []
    if isinstance(config, list):
        config = {"alerts": config}
    if not isinstance(config, dict):
        return {"rules": {}, "settings": {}, "warnings": ["That is not an AlertTicker card config."]}

    settings: dict[str, Any] = {}
    if config.get("cycle_interval"):
        settings["cycle_seconds"] = config["cycle_interval"]
    if config.get("show_when_clear") is False:
        settings["clear_mode"] = "hidden"
    elif config.get("clear_display_mode"):
        mode = str(config["clear_display_mode"])
        settings["clear_mode"] = _AT_CLEAR.get(mode, "message")
        if mode in ("forecast", "weather_forecast"):
            warnings.append("Forecast display is not supported yet; used the weather widget instead.")
    if config.get("clear_weather_entity"):
        settings["clear_weather_entity"] = config["clear_weather_entity"]

    rules: dict[str, dict[str, Any]] = {}
    for index, alert in enumerate(config.get("alerts") or []):
        if not isinstance(alert, dict):
            continue
        raw: dict[str, Any] = {k: alert.get(k) for k in ("entity", "device_class", "attribute", "operator", "state", "message", "icon", "camera_entity") if alert.get(k) is not None}
        label = str(alert.get("name") or alert.get("entity") or alert.get("entity_filter") or alert.get("device_class") or f"Alert {index + 1}")
        raw["name"] = label
        pattern = alert.get("entity_filter")
        if isinstance(pattern, dict):
            pattern = pattern.get("pattern") or pattern.get("include") or ""
        if pattern:
            raw["entity_filter"] = str(pattern)
        raw["exclude"] = alert.get("entity_filter_exclude") or alert.get("exclude") or []
        raw["color"] = alert.get("icon_color") or ""
        raw["secondary"] = alert.get("secondary_text") or ""
        raw["priority"] = alert.get("priority", "warning")
        if alert.get("persistent"):
            raw["mode"] = "persistent"
        elif alert.get("on_change"):
            raw["mode"] = "on_change"
            raw["auto_dismiss"] = alert.get("auto_dismiss_after") or 0
        window = alert.get("time_range")
        if isinstance(window, dict):
            raw["time_from"], raw["time_to"] = window.get("from", ""), window.get("to", "")
        visible = alert.get("visible_to")
        if visible:
            raw["visible_to"] = visible if isinstance(visible, list) else [visible]
            if any(slugify(v) not in ("admin", "non_admin", "all") for v in raw["visible_to"]):
                warnings.append(f"{label}: visible_to uses names; set Visible to in the editor to match your Nabu people.")
        raw["tap_action"] = _convert_action(alert.get("tap_action"))
        raw["hold_action"] = _convert_action(alert.get("hold_action"))
        if alert.get("conditions"):
            warnings.append(f"{label}: multi-entity conditions are not converted; add a template condition instead.")
        skipped = sorted(k for k in alert if k not in _AT_KNOWN and k != "conditions" and k != "conditions_logic")
        if skipped:
            warnings.append(f"{label}: skipped " + ", ".join(skipped[:6]) + ("..." if len(skipped) > 6 else ""))
        key = slugify(label) or f"alert_{index + 1}"
        base, n = key, 2
        while key in rules:
            key = f"{base}_{n}"
            n += 1
        rules[key] = clean_rule(raw)
    return {"rules": rules, "settings": settings, "warnings": warnings}
