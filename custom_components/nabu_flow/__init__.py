"""Nabu Flow: notification routing and control panel for Home Assistant."""

from __future__ import annotations

import logging
from pathlib import Path

import voluptuous as vol

from homeassistant.components import frontend, panel_custom
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.typing import ConfigType

from . import ws
from .const import (
    DATA_STATIC_REGISTERED,
    DOMAIN,
    PANEL_ELEMENT,
    PANEL_FILE,
    PANEL_URL_PATH,
    PHONE_MODES,
    PRESENCE_MODES,
    SERVICE_NOTIFY,
    SEVERITIES,
    CARD_FILE,
    STATIC_URL,
    TOPBAR_FILE,
    VERSION,
)
from .manager import NabuManager
from .store import NabuStore

_LOGGER = logging.getLogger(__name__)

CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)

SERVICE_SCHEMA = vol.Schema(
    {
        vol.Optional("route"): cv.string,
        vol.Optional("who"): vol.Any(cv.string, [cv.string]),
        vol.Optional("channel"): cv.string,
        vol.Optional("title"): cv.string,
        vol.Optional("message"): cv.string,
        vol.Optional("severity"): vol.In(SEVERITIES),
        vol.Optional("discord"): cv.boolean,
        vol.Optional("phone"): vol.In(PHONE_MODES),
        vol.Optional("presence"): vol.In(PRESENCE_MODES),
        vol.Optional("announce"): cv.boolean,
        vol.Optional("camera_entity"): cv.entity_id,
        vol.Optional("link"): cv.string,
        vol.Optional("tap_url"): cv.string,
        vol.Optional("actions"): [
            vol.Schema(
                {
                    vol.Required("action"): cv.string,
                    vol.Required("title"): cv.string,
                    vol.Optional("destructive"): cv.boolean,
                    vol.Optional("authenticationRequired"): cv.boolean,
                    vol.Optional("uri"): cv.string,
                }
            )
        ],
        vol.Optional("dedupe_key"): cv.string,
        vol.Optional("cooldown"): vol.All(vol.Coerce(int), vol.Range(min=0, max=86400)),
    }
)


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    return True


async def _async_register_static(hass: HomeAssistant) -> None:
    if hass.data.get(DATA_STATIC_REGISTERED):
        return
    folder = str(Path(__file__).parent / "frontend")
    await hass.http.async_register_static_paths([StaticPathConfig(STATIC_URL, folder, False)])
    hass.data[DATA_STATIC_REGISTERED] = True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    store = NabuStore(hass)
    await store.async_load()
    manager = NabuManager(hass, store)
    hass.data[DOMAIN] = manager

    ws.async_register(hass)
    await _async_register_static(hass)
    if not hass.data.get("nabu_flow_card_registered"):
        # Modern browsers load the module list, older WebViews (some tablets and
        # displays) only load the es5 list, so register both. A browser reads one.
        for card_file in (CARD_FILE, TOPBAR_FILE):
            card_url = f"{STATIC_URL}/{card_file}?v={VERSION}"
            frontend.add_extra_js_url(hass, card_url)
            frontend.add_extra_js_url(hass, card_url, es5=True)
        hass.data["nabu_flow_card_registered"] = True

    try:
        await panel_custom.async_register_panel(
            hass,
            frontend_url_path=PANEL_URL_PATH,
            webcomponent_name=PANEL_ELEMENT,
            sidebar_title="Nabu Flow",
            sidebar_icon="mdi:bell-ring-outline",
            module_url=f"{STATIC_URL}/{PANEL_FILE}?v={VERSION}",
            embed_iframe=False,
            require_admin=True,
            config={},
        )
    except ValueError:
        _LOGGER.debug("Nabu Flow panel was already registered")

    async def _handle_notify(call: ServiceCall) -> None:
        await manager.async_notify(dict(call.data), source="service")

    hass.services.async_register(DOMAIN, SERVICE_NOTIFY, _handle_notify, schema=SERVICE_SCHEMA)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    hass.services.async_remove(DOMAIN, SERVICE_NOTIFY)
    frontend.async_remove_panel(hass, PANEL_URL_PATH)
    hass.data.pop(DOMAIN, None)
    return True
