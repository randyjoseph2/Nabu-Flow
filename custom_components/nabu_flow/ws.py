"""WebSocket API used by the Nabu Flow panel (admin only)."""

from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback

from .audit import async_audit
from .const import DATA_WS_REGISTERED, DOMAIN, SECTIONS
from .manager import NabuManager


def _manager(hass: HomeAssistant) -> NabuManager:
    return hass.data[DOMAIN]


@websocket_api.require_admin
@websocket_api.websocket_command({vol.Required("type"): "nabu_flow/get"})
@callback
def ws_get(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    connection.send_result(msg["id"], _manager(hass).snapshot())


@websocket_api.require_admin
@websocket_api.websocket_command(
    {
        vol.Required("type"): "nabu_flow/update",
        vol.Required("section"): vol.In(SECTIONS),
        vol.Required("data"): dict,
    }
)
@websocket_api.async_response
async def ws_update(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    manager = _manager(hass)
    await manager.store.async_set_section(msg["section"], msg["data"])
    connection.send_result(msg["id"], manager.snapshot())


@websocket_api.require_admin
@websocket_api.websocket_command({vol.Required("type"): "nabu_flow/audit"})
@websocket_api.async_response
async def ws_audit(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    manager = _manager(hass)
    config = manager.store.config
    result = await async_audit(hass, config["routes"], config["settings"]["notify_service"])
    connection.send_result(msg["id"], result)


@websocket_api.require_admin
@websocket_api.websocket_command({vol.Required("type"): "nabu_flow/history"})
@callback
def ws_history(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    connection.send_result(msg["id"], {"items": _manager(hass).store.history})


@websocket_api.websocket_command(
    {vol.Required("type"): "nabu_flow/recent", vol.Optional("limit", default=8): vol.All(int, vol.Range(min=1, max=30))}
)
@callback
def ws_recent(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """Read-only feed for the dashboard card. Open to every user, no config exposed."""
    manager = _manager(hass)
    items = []
    for item in manager.store.history[: msg["limit"]]:
        ok = not item.get("errors") and item.get("suppressed") is None
        items.append(
            {
                "ts": item.get("ts"),
                "title": item.get("title"),
                "severity": item.get("severity"),
                "channel": item.get("channel"),
                "route": item.get("route"),
                "suppressed": item.get("suppressed"),
                "ok": ok,
            }
        )
    connection.send_result(msg["id"], {"items": items, "quiet_entity": manager.store.config["settings"].get("quiet_entity")})


@websocket_api.require_admin
@websocket_api.websocket_command({vol.Required("type"): "nabu_flow/clear_history"})
@websocket_api.async_response
async def ws_clear_history(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    await _manager(hass).store.async_clear_history()
    connection.send_result(msg["id"], {"items": []})


@websocket_api.require_admin
@websocket_api.websocket_command({vol.Required("type"): "nabu_flow/test", vol.Required("data"): dict})
@websocket_api.async_response
async def ws_test(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    entry = await _manager(hass).async_notify(dict(msg["data"]), source="panel test")
    connection.send_result(msg["id"], entry)


@websocket_api.require_admin
@websocket_api.websocket_command({vol.Required("type"): "nabu_flow/export"})
@callback
def ws_export(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    config = _manager(hass).store.config
    connection.send_result(msg["id"], {"nabu_flow": 1, **{key: config[key] for key in SECTIONS}})


@websocket_api.require_admin
@websocket_api.websocket_command(
    {
        vol.Required("type"): "nabu_flow/import",
        vol.Required("data"): dict,
        vol.Optional("mode", default="merge"): vol.In(("merge", "replace")),
    }
)
@websocket_api.async_response
async def ws_import(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    manager = _manager(hass)
    if msg["mode"] == "replace":
        await manager.store.async_replace(msg["data"])
    else:
        await manager.store.async_merge(msg["data"])
    connection.send_result(msg["id"], manager.snapshot())


def async_register(hass: HomeAssistant) -> None:
    """Register the commands once per HA run."""
    if hass.data.get(DATA_WS_REGISTERED):
        return
    for handler in (
        ws_get,
        ws_update,
        ws_audit,
        ws_history,
        ws_recent,
        ws_clear_history,
        ws_test,
        ws_export,
        ws_import,
    ):
        websocket_api.async_register_command(hass, handler)
    hass.data[DATA_WS_REGISTERED] = True
