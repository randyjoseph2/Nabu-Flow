"""Runtime for Nabu Flow: builds a plan, runs it, records history."""

from __future__ import annotations

import logging
import time
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.util import dt as dt_util

from .const import EVENT_SENT, VERSION
from .router import build_plan
from .store import NabuStore

_LOGGER = logging.getLogger(__name__)


class NabuManager:
    """Executes notifications according to the saved config."""

    def __init__(self, hass: HomeAssistant, store: NabuStore) -> None:
        self.hass = hass
        self.store = store
        self._last_sent: dict[str, float] = {}

    # ---------- helpers ----------
    def _away(self) -> set[str]:
        away: set[str] = set()
        for key, person in self.store.config["people"].items():
            entity = person.get("person_entity")
            if not entity:
                continue
            state = self.hass.states.get(entity)
            if state is not None and state.state not in ("home", "unknown", "unavailable"):
                away.add(key)
        return away

    def _quiet(self) -> bool:
        entity = self.store.config["settings"].get("quiet_entity")
        if not entity:
            return False
        state = self.hass.states.get(entity)
        return state is not None and state.state == "on"

    def _snapshot_path(self) -> str:
        configured = self.store.config["settings"].get("snapshot_path")
        return configured or self.hass.config.path("www", "nabu_snapshot.jpg")

    def _snapshot_url(self, path: str) -> str:
        """Local URL for the saved snapshot, only when it lives under /config/www."""
        if not path:
            return ""
        www = self.hass.config.path("www") + "/"
        if not path.startswith(www):
            return ""
        return "/local/" + path[len(www):] + "?t=" + str(int(time.time()))

    async def _call(self, service: str, data: dict[str, Any], label: str, errors: list[str]) -> bool:
        domain, _, name = service.partition(".")
        if not name or not self.hass.services.has_service(domain, name):
            errors.append(label + ": service " + service + " not found")
            return False
        try:
            await self.hass.services.async_call(domain, name, data, blocking=True)
        except Exception as err:  # noqa: BLE001
            _LOGGER.warning("Nabu Flow %s failed: %s", label, err)
            errors.append(label + ": " + str(err))
            return False
        return True

    # ---------- public ----------
    async def async_notify(self, data: dict[str, Any], source: str = "service") -> dict[str, Any]:
        config = self.store.config
        plan = build_plan(config, data, away=self._away(), quiet=self._quiet())
        plan["actions"] = [dict(a) for a in (data.get("actions") or [])]
        errors: list[str] = []
        entry: dict[str, Any] = {
            "ts": dt_util.utcnow().isoformat(),
            "source": source,
            "route": plan["route"],
            "title": plan["title"],
            "message": plan["message"],
            "severity": plan["severity"],
            "channel": plan["discord"]["channel_key"] if plan["discord"] else None,
            "recipients": plan["recipients"],
            "discord": None,
            "pushes": [],
            "announce": None,
            "suppressed": plan["suppressed"],
            "warnings": list(plan["warnings"]),
            "errors": errors,
        }

        dedupe = plan["dedupe"]
        if plan["suppressed"] is None and dedupe:
            now = time.monotonic()
            last = self._last_sent.get(dedupe["key"])
            if last is not None and now - last < dedupe["cooldown"]:
                entry["suppressed"] = "cooldown"
            else:
                self._last_sent[dedupe["key"]] = now

        if entry["suppressed"] is None:
            await self._run(plan, entry, errors)

        self.store.add_history(entry)
        self.hass.bus.async_fire(EVENT_SENT, entry)
        return entry

    async def _run(self, plan: dict[str, Any], entry: dict[str, Any], errors: list[str]) -> None:
        discord = plan["discord"]
        snap_path = ""
        camera = plan.get("camera_entity") or ""
        if camera and (discord or plan["pushes"]):
            path = self._snapshot_path()
            if await self._call(
                "camera.snapshot",
                {"entity_id": camera, "filename": path},
                "camera snapshot",
                errors,
            ):
                snap_path = path
        if discord:
            payload: dict[str, Any] = {"embed": discord["embed"]}
            if snap_path:
                payload["images"] = [snap_path]
            ok = await self._call(
                discord["service"],
                {"message": discord["message"], "target": [discord["channel_id"]], "data": payload},
                "discord",
                errors,
            )
            entry["discord"] = ok
            if discord["mirror_channel_id"]:
                await self._call(
                    discord["service"],
                    {"message": "", "target": [discord["mirror_channel_id"]], "data": {"embed": discord["embed"]}},
                    "discord critical log",
                    errors,
                )

        for push in plan["pushes"]:
            data: dict[str, Any] = {
                "title": push["title"],
                "message": push["message"],
                "data": {
                    "group": push["group"],
                    "push": {"thread-id": push["group"], "interruption-level": push["level"]},
                },
            }
            if plan.get("actions"):
                data["data"]["actions"] = plan["actions"]
                data["data"]["tag"] = push["group"] + "-" + str(int(time.time()))
            if camera:
                # The companion app fetches the picture itself through the authenticated
                # camera proxy, so there is no /local file to 404 on.
                data["data"]["entity_id"] = camera
            if push["level"] == "critical":
                data["data"]["push"]["sound"] = {"name": "default", "critical": 1, "volume": 1.0}
            ok = await self._call(push["service"], data, "push " + push["person"], errors)
            entry["pushes"].append({"person": push["person"], "level": push["level"], "ok": ok})

        announce = plan["announce"]
        if announce:
            entry["announce"] = await self._call(
                announce["service"],
                {"message": "TTS", "data": {"tts_text": announce["text"], "media_stream": announce["stream"]}},
                "announce",
                errors,
            )

    # ---------- discovery for the panel ----------
    def discovery(self) -> dict[str, Any]:
        getter = getattr(self.hass.services, "async_services_for_domain", None)
        services = getter("notify") if getter else self.hass.services.async_services().get("notify", {})
        persons = [
            {"entity_id": st.entity_id, "name": st.name}
            for st in self.hass.states.async_all("person")
        ]
        return {
            "notify_services": sorted("notify." + name for name in services),
            "persons": sorted(persons, key=lambda p: p["entity_id"]),
        }

    def snapshot(self) -> dict[str, Any]:
        return {
            "version": VERSION,
            "settings": self.store.config["settings"],
            "people": self.store.config["people"],
            "channels": self.store.config["channels"],
            "routes": self.store.config["routes"],
            "discovery": self.discovery(),
        }
