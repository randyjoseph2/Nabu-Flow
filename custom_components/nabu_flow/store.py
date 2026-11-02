"""Persistent storage for Nabu Flow (config and notification history)."""

from __future__ import annotations

from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

from .const import HISTORY_KEY, STORAGE_KEY, STORAGE_VERSION
from .model import clean_section, default_config, merge_config


class NabuStore:
    """Holds the sanitized config and a short history ring buffer."""

    def __init__(self, hass: HomeAssistant) -> None:
        self._config_store: Store = Store(hass, STORAGE_VERSION, STORAGE_KEY)
        self._history_store: Store = Store(hass, STORAGE_VERSION, HISTORY_KEY)
        self.config: dict[str, Any] = default_config()
        self.history: list[dict[str, Any]] = []

    async def async_load(self) -> None:
        raw = await self._config_store.async_load()
        self.config = merge_config(raw or {})
        saved = await self._history_store.async_load()
        items = (saved or {}).get("items", [])
        self.history = items if isinstance(items, list) else []

    async def async_save_config(self) -> None:
        await self._config_store.async_save(self.config)

    async def async_set_section(self, section: str, raw: Any) -> None:
        self.config[section] = clean_section(section, raw)
        await self.async_save_config()

    async def async_replace(self, raw: Any) -> None:
        self.config = merge_config(raw)
        await self.async_save_config()

    async def async_merge(self, raw: Any) -> None:
        """Overlay imported sections (and keys within people/channels/routes)."""
        raw = raw if isinstance(raw, dict) else {}
        for section, value in raw.items():
            if section not in self.config or not isinstance(value, dict):
                continue
            if section == "settings":
                merged = {**self.config["settings"], **value}
            else:
                merged = {**self.config[section], **value}
            self.config[section] = clean_section(section, merged)
        await self.async_save_config()

    def add_history(self, entry: dict[str, Any]) -> None:
        size = int(self.config["settings"].get("history_size", 100))
        self.history.insert(0, entry)
        del self.history[size:]
        self._history_store.async_delay_save(lambda: {"items": self.history}, 30)

    async def async_clear_history(self) -> None:
        self.history = []
        await self._history_store.async_save({"items": []})
