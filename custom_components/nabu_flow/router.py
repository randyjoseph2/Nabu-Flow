"""Routing engine for Nabu Flow.

`build_plan` is a pure function: given the saved config, one notify call's data,
who is away and whether quiet mode is on, it returns a plan describing what to
send. The manager executes the plan. No Home Assistant imports here.
"""

from __future__ import annotations

from typing import Any

from .const import COLORS, PHONE_MODES, PRESENCE_MODES, SEVERITIES
from .model import clean_who, slugify


def _present(data: dict[str, Any], key: str) -> bool:
    return key in data and data[key] is not None and data[key] != ""


def _to_bool(value: Any, default: bool) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        low = value.strip().lower()
        if low in ("true", "1", "yes", "on"):
            return True
        if low in ("false", "0", "no", "off"):
            return False
    if isinstance(value, (int, float)):
        return bool(value)
    return default


def resolve_people(who: Any, people: dict[str, Any]) -> tuple[list[str], list[str]]:
    """Return (recipient keys, warnings)."""
    everyone = list(people)
    items = clean_who(who)
    if "all" in items:
        return everyone, []
    chosen = [key for key in items if key in people]
    unknown = [key for key in items if key not in people]
    warnings = []
    if unknown:
        warnings.append("Unknown recipient: " + ", ".join(unknown))
    if not chosen:
        if everyone:
            warnings.append("No valid recipients, sending to everyone")
        return everyone, warnings
    return chosen, warnings


def build_plan(
    config: dict[str, Any],
    data: dict[str, Any],
    away: set[str] | frozenset[str] = frozenset(),
    quiet: bool = False,
) -> dict[str, Any]:
    settings = config["settings"]
    people = config["people"]
    channels = config["channels"]
    routes = config["routes"]
    warnings: list[str] = []

    route_id = slugify(data.get("route")) if _present(data, "route") else ""
    route = routes.get(route_id) if route_id else None
    if route_id and route is None:
        warnings.append("Unknown route: " + route_id + " (using the call's own fields)")
    route = route or {}

    plan: dict[str, Any] = {
        "route": route_id or None,
        "severity": "info",
        "title": "",
        "message": "",
        "recipients": [],
        "suppressed": None,
        "discord": None,
        "pushes": [],
        "camera_entity": "",
        "announce": None,
        "dedupe": None,
        "warnings": warnings,
    }

    if route and not route.get("enabled", True):
        plan["suppressed"] = "route_disabled"
        return plan

    def pick(key: str, default: Any) -> Any:
        if _present(data, key):
            return data[key]
        if key in route and route[key] is not None and route[key] != "":
            return route[key]
        return default

    sev = str(pick("severity", "info")).lower()
    if sev not in SEVERITIES:
        warnings.append("Unknown severity " + sev + ", using info")
        sev = "info"
    phone = str(pick("phone", "auto")).lower()
    if phone not in PHONE_MODES:
        warnings.append("Unknown phone mode " + phone + ", using auto")
        phone = "auto"
    presence = str(pick("presence", "aware")).lower()
    if presence not in PRESENCE_MODES:
        warnings.append("Unknown presence mode " + presence + ", using aware")
        presence = "aware"

    discord_on = _to_bool(pick("discord", True), True)
    announce_on = _to_bool(pick("announce", False), False)
    title = str(data.get("title") or "").strip()
    message = str(data.get("message") or "").strip()
    link = str(pick("link", "") or "").strip()
    camera = str(pick("camera_entity", "") or "").strip()

    plan["severity"] = sev
    plan["camera_entity"] = camera
    plan["title"] = title
    plan["message"] = message

    away = set(away) & set(people)
    chosen, who_warn = resolve_people(pick("who", ["all"]), people)
    warnings.extend(who_warn)

    push_mode = phone
    if phone == "auto":
        push_mode = "critical" if sev == "critical" else "none"

    if presence == "home_only" and push_mode != "critical":
        home = [key for key in chosen if key not in away]
        recipients = home or chosen
    else:
        recipients = chosen
    plan["recipients"] = recipients

    # ---- Discord ----
    requested_channel = slugify(pick("channel", settings["default_channel"])) or settings["default_channel"]
    if requested_channel not in channels:
        warnings.append("Unknown channel " + requested_channel + ", using " + settings["default_channel"])
        requested_channel = settings["default_channel"]
    channel_key = requested_channel
    if sev == "info" and quiet and settings["digest_channel"] in channels:
        channel_key = settings["digest_channel"]

    if discord_on:
        channel_id = channels.get(channel_key, {}).get("discord_id", "")
        if not channel_id:
            warnings.append("Channel " + channel_key + " has no Discord ID yet")
        else:
            mentions = []
            if sev != "info":
                for key in recipients:
                    did = people[key].get("discord_id", "")
                    if did and (presence == "ignore" or sev == "critical" or key not in away):
                        mentions.append("<@" + did + ">")
            embed: dict[str, Any] = {
                "title": title,
                "description": message,
                "color": COLORS[sev],
            }
            if link:
                embed["url"] = link
            mirror = None
            log_id = channels.get(settings["critical_log_channel"], {}).get("discord_id", "")
            if sev == "critical" and log_id and log_id != channel_id:
                mirror = log_id
            plan["discord"] = {
                "service": settings["notify_service"],
                "channel_key": channel_key,
                "channel_id": channel_id,
                "message": " ".join(mentions),
                "embed": embed,
                "camera_entity": camera,
                "mirror_channel_id": mirror,
            }

    # ---- Phone pushes ----
    if push_mode != "none":
        for key in recipients:
            service = people[key].get("phone_service", "")
            if not service:
                warnings.append(people[key].get("name", key) + " has no phone service set")
                continue
            if push_mode == "critical":
                level = "critical"
            elif push_mode == "urgent":
                level = "time-sensitive"
            else:
                level = "passive" if (presence == "aware" and key in away) else "active"
            plan["pushes"].append(
                {
                    "person": key,
                    "service": service,
                    "level": level,
                    "title": title or ("Critical alert" if push_mode == "critical" else ""),
                    "message": message,
                    "group": requested_channel or "nabu",
                }
            )

    # ---- Spoken announcement (only if someone is home) ----
    if announce_on:
        someone_home = bool(set(people) - away)
        if not settings["announce_service"]:
            warnings.append("Announce requested but no announce service is set")
        elif someone_home:
            text = (title + ". " + message).strip(". ").strip() if title else message
            plan["announce"] = {
                "service": settings["announce_service"],
                "text": text,
                "stream": "alarm_stream_max" if sev == "critical" else "music_stream",
            }

    # ---- Cooldown / dedupe ----
    key = str(data.get("dedupe_key") or route_id or "").strip()
    try:
        cooldown = int(data["cooldown"]) if _present(data, "cooldown") else int(route.get("cooldown", 0) or 0)
    except (TypeError, ValueError):
        cooldown = 0
    if key and cooldown > 0:
        plan["dedupe"] = {"key": key, "cooldown": cooldown}

    return plan
