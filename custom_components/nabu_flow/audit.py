"""Automation audit: which automations send notifications, and by what path.

`scan_automations` is pure. `async_audit` loads automations.yaml (where the
UI saves automations) and feeds it in. Automations defined elsewhere (YAML
packages) and blueprint-based ones are not scanned in v0.1.
"""

from __future__ import annotations

import os
from typing import Any

from .model import slugify

KIND_LABELS = {
    "nabu": "Nabu route",
    "nabu_inline": "Nabu (no route)",
    "nabu_dynamic": "Nabu (templated route)",
    "nabu_unknown_route": "Nabu (unknown route)",
    "legacy_script": "Legacy notify_house script",
    "discord_direct": "Discord direct",
    "phone_direct": "Phone direct",
    "persistent": "Persistent notification",
    "other_notify": "Other notify",
}


def _walk(node: Any, found: list[tuple[str, dict[str, Any]]]) -> None:
    if isinstance(node, dict):
        service = node.get("action") or node.get("service")
        if isinstance(service, str) and "." in service and "{{" not in service:
            data = node.get("data")
            found.append((service.strip().lower(), data if isinstance(data, dict) else {}))
        for value in node.values():
            _walk(value, found)
    elif isinstance(node, list):
        for value in node:
            _walk(value, found)


def classify(service: str, data: dict[str, Any], routes: dict[str, Any], notify_service: str) -> dict[str, Any] | None:
    if service == "nabu_flow.notify":
        raw = data.get("route")
        if not raw:
            return {"kind": "nabu_inline", "service": service, "route": None}
        if "{{" in str(raw):
            return {"kind": "nabu_dynamic", "service": service, "route": None}
        route = slugify(raw)
        kind = "nabu" if route in routes else "nabu_unknown_route"
        return {"kind": kind, "service": service, "route": route}
    if service == "script.notify_house":
        return {"kind": "legacy_script", "service": service, "route": None}
    if service == notify_service:
        return {"kind": "discord_direct", "service": service, "route": None}
    if service.startswith("notify.mobile_app_"):
        return {"kind": "phone_direct", "service": service, "route": None}
    if service == "notify.persistent_notification":
        return {"kind": "persistent", "service": service, "route": None}
    if service.startswith("notify."):
        return {"kind": "other_notify", "service": service, "route": None}
    return None


def scan_automations(items: Any, routes: dict[str, Any], notify_service: str = "notify.nabu") -> dict[str, Any]:
    automations: list[dict[str, Any]] = []
    skipped_blueprints = 0
    if not isinstance(items, list):
        items = []
    for item in items:
        if not isinstance(item, dict):
            continue
        if "use_blueprint" in item:
            skipped_blueprints += 1
            continue
        found: list[tuple[str, dict[str, Any]]] = []
        _walk(item.get("actions", item.get("action")), found)
        calls = []
        for service, data in found:
            info = classify(service, data, routes, notify_service)
            if info:
                calls.append(info)
        if calls:
            auto_id = item.get("id")
            automations.append(
                {
                    "id": str(auto_id) if auto_id is not None else None,
                    "alias": str(item.get("alias") or auto_id or "Unnamed automation"),
                    "calls": calls,
                }
            )
    automations.sort(key=lambda a: a["alias"].lower())
    return {"automations": automations, "skipped_blueprints": skipped_blueprints}


def summarize(result: dict[str, Any]) -> dict[str, int]:
    routed = 0
    unrouted = 0
    for automation in result["automations"]:
        if all(call["kind"] == "nabu" for call in automation["calls"]):
            routed += 1
        else:
            unrouted += 1
    return {"total": len(result["automations"]), "routed": routed, "not_routed": unrouted}


def _load_yaml(path: str) -> Any:
    from homeassistant.util.yaml import load_yaml  # imported lazily so tests need no HA

    return load_yaml(path)


async def async_audit(hass: Any, routes: dict[str, Any], notify_service: str) -> dict[str, Any]:
    path = hass.config.path("automations.yaml")
    note = ""
    items: Any = []
    if await hass.async_add_executor_job(os.path.isfile, path):
        try:
            items = await hass.async_add_executor_job(_load_yaml, path)
        except Exception as err:  # noqa: BLE001
            note = "Could not read automations.yaml: " + str(err)
    else:
        note = "No automations.yaml found. Only UI-created automations are scanned."
    result = scan_automations(items, routes, notify_service)
    result["summary"] = summarize(result)
    result["labels"] = KIND_LABELS
    result["note"] = note
    return result
