"""Alerts Flow runtime: watches states, keeps the active alert list, pushes it to dashboards.

Rules live in the Nabu Flow config (section "alerts"). Snooze and dismiss are
kept here, on the server, so every phone, tablet and kitchen display agrees.
"""

from __future__ import annotations

import logging
import time
from datetime import timedelta
from typing import Any, Callable

from homeassistant.const import EVENT_STATE_CHANGED
from homeassistant.core import Event, HomeAssistant, callback
from homeassistant.helpers.event import async_call_later, async_track_time_interval
from homeassistant.helpers.storage import Store
from homeassistant.helpers.template import Template
from homeassistant.util import dt as dt_util

from .alerts_model import (
    LOG_MAX,
    ON_CHANGE_DEFAULT_SECONDS,
    PRIORITY_RANK,
    clean_rule,
    evaluate_rule,
    has_source,
    in_time_range,
    match_entities,
    render_placeholders,
    slugify,
    visible_to,
)
from .const import ALERTS_STATE_KEY, EVENT_ALERT

_LOGGER = logging.getLogger(__name__)

DEFAULT_ICONS = {
    "critical": "mdi:alert-octagon",
    "warning": "mdi:alert",
    "info": "mdi:information",
    "low": "mdi:bell-outline",
}
PREVIEW_MAX = 50


class AlertEngine:
    """Evaluates alert rules and publishes the visible alert list."""

    def __init__(self, hass: HomeAssistant, store: Any, manager: Any) -> None:
        self.hass = hass
        self.store = store
        self.manager = manager
        self._state_store: Store = Store(hass, 1, ALERTS_STATE_KEY)
        self.active: dict[str, dict[str, Any]] = {}
        self.snoozed: dict[str, float] = {}
        self.dismissed: set[str] = set()
        self.log: list[dict[str, Any]] = []
        self._events: dict[str, float] = {}  # on_change key -> expires (epoch)
        self._persist: dict[str, str] = {}  # persistent key -> since (iso)
        self._manual: dict[str, dict[str, Any]] = {}
        self._listeners: list[Callable[[], None]] = []
        self._unsubs: list[Callable[[], None]] = []
        self._pending: Callable[[], None] | None = None
        self._seeded = False
        self._found: dict[str, dict[str, Any]] = {}
        self._watch_key = -1
        self._watch_ids: set[str] = set()
        self._watch_broad = False

    # ---------- lifecycle ----------
    async def async_start(self) -> None:
        saved = await self._state_store.async_load() or {}
        now = time.time()
        self.snoozed = {k: float(v) for k, v in (saved.get("snoozed") or {}).items() if float(v) > now}
        self.dismissed = set(saved.get("dismissed") or [])
        self.log = list(saved.get("log") or [])[:LOG_MAX]
        self._unsubs.append(self.hass.bus.async_listen(EVENT_STATE_CHANGED, self._on_state_changed))
        self._unsubs.append(async_track_time_interval(self.hass, self._on_tick, timedelta(seconds=30)))
        await self._async_recompute()

    @callback
    def async_stop(self) -> None:
        for unsub in self._unsubs:
            unsub()
        self._unsubs = []
        if self._pending:
            self._pending()
            self._pending = None

    @callback
    def add_listener(self, listener: Callable[[], None]) -> Callable[[], None]:
        self._listeners.append(listener)

        @callback
        def remove() -> None:
            if listener in self._listeners:
                self._listeners.remove(listener)

        return remove

    @callback
    def config_changed(self) -> None:
        """Call after the alerts section was saved."""
        self._schedule()

    # ---------- state handling ----------
    def _settings(self) -> dict[str, Any]:
        return self.store.config["alerts"]["settings"]

    def _rules(self) -> dict[str, dict[str, Any]]:
        return self.store.config["alerts"]["rules"]

    def _rebuild_watch(self) -> None:
        rules = self._rules()
        if id(rules) == self._watch_key:
            return
        self._watch_key = id(rules)
        ids: set[str] = set()
        broad = False
        for rule in rules.values():
            if not rule["enabled"]:
                continue
            if rule["entity"]:
                ids.add(rule["entity"])
            if rule["entity_filter"] or rule["device_class"] or rule["template"]:
                broad = True
        self._watch_ids, self._watch_broad = ids, broad

    @callback
    def _on_state_changed(self, event: Event) -> None:
        self._rebuild_watch()
        entity_id = event.data.get("entity_id", "")
        if not (self._watch_broad or entity_id in self._watch_ids):
            return
        old, new = event.data.get("old_state"), event.data.get("new_state")
        if old is not None and new is not None and old.state != new.state:
            for rid, rule in self._rules().items():
                if rule["enabled"] and rule["mode"] == "on_change" and entity_id in match_entities(rule, {entity_id: dict(new.attributes)}):
                    seconds = rule["auto_dismiss"] or ON_CHANGE_DEFAULT_SECONDS
                    self._events[f"{rid}|{entity_id}"] = time.time() + seconds
        self._schedule()

    @callback
    def _on_tick(self, _now: Any) -> None:
        self._schedule()

    @callback
    def _schedule(self) -> None:
        if self._pending is not None:
            return

        async def run(_now: Any) -> None:
            self._pending = None
            await self._async_recompute()

        self._pending = async_call_later(self.hass, 0.5, run)

    def _all_attrs(self) -> dict[str, dict[str, Any]]:
        return {st.entity_id: dict(st.attributes) for st in self.hass.states.async_all()}

    def _rule_entities(self, rule: dict[str, Any], attrs: dict[str, dict[str, Any]] | None = None) -> list[str]:
        if rule["entity_filter"] or rule["device_class"]:
            attrs = attrs if attrs is not None else self._all_attrs()
            return match_entities(rule, attrs)
        return match_entities(rule, {})

    # ---------- evaluation ----------
    def _render(self, text: str, context: dict[str, Any]) -> str:
        if "{{" in text or "{%" in text:
            try:
                return Template(text, self.hass).async_render(context, parse_result=False)
            except Exception as err:  # noqa: BLE001
                _LOGGER.debug("Alert template failed: %s", err)
        return render_placeholders(text, context)

    def _truthy(self, template: str, context: dict[str, Any]) -> bool:
        try:
            value = Template(template, self.hass).async_render(context, parse_result=True)
        except Exception as err:  # noqa: BLE001
            _LOGGER.debug("Alert condition template failed: %s", err)
            return False
        if isinstance(value, str):
            return value.strip().lower() in ("true", "on", "yes", "1")
        return bool(value)

    def _where(self, entity_id: str) -> tuple[str, str]:
        """Device name and area name for an entity (best effort)."""
        try:
            from homeassistant.helpers import area_registry as ar
            from homeassistant.helpers import device_registry as dr
            from homeassistant.helpers import entity_registry as er

            entry = er.async_get(self.hass).async_get(entity_id)
            if entry is None:
                return "", ""
            device = dr.async_get(self.hass).async_get(entry.device_id) if entry.device_id else None
            area_id = entry.area_id or (device.area_id if device else None)
            area = ar.async_get(self.hass).async_get_area(area_id) if area_id else None
            return (device.name_by_user or device.name or "") if device else "", area.name if area else ""
        except Exception:  # noqa: BLE001
            return "", ""

    def _context(self, rule: dict[str, Any], entity_id: str, state: Any, since: str) -> dict[str, Any]:
        device, area = self._where(entity_id) if entity_id else ("", "")
        friendly = state.name if state is not None else rule["name"]
        return {
            "name": friendly,
            "state": state.state if state is not None else "",
            "entity": entity_id,
            "device": device,
            "area": area,
            "trigger_state": state.state if state is not None else "",
            "trigger_time": dt_util.as_local(dt_util.parse_datetime(since) or dt_util.utcnow()).strftime("%H:%M"),
            "rule": rule["name"],
        }

    def _build(self, rid: str, rule: dict[str, Any], entity_id: str, state: Any, since: str) -> dict[str, Any]:
        context = self._context(rule, entity_id, state, since)
        icon = rule["icon"] or (state.attributes.get("icon") if state is not None else "") or DEFAULT_ICONS[rule["priority"]]
        return {
            "key": f"{rid}|{entity_id or 'template'}",
            "rule_id": rid,
            "name": rule["name"],
            "entity_id": entity_id,
            "message": self._render(rule["message"], context),
            "secondary": self._render(rule["secondary"], context) if rule["secondary"] else "",
            "priority": rule["priority"],
            "icon": icon,
            "color": rule["color"],
            "camera_entity": rule["camera_entity"],
            "tap_action": rule["tap_action"],
            "hold_action": rule["hold_action"],
            "snoozable": rule["snoozable"],
            "since": since,
        }

    def _compute(self) -> tuple[dict[str, dict[str, Any]], set[str]]:
        """Returns (visible-before-snooze alerts, raw-true keys)."""
        found: dict[str, dict[str, Any]] = {}
        raw_true: set[str] = set()
        settings = self._settings()
        if not settings["enabled"]:
            return found, raw_true
        local = dt_util.now()
        minute = local.hour * 60 + local.minute
        now_iso = dt_util.utcnow().isoformat()
        attrs: dict[str, dict[str, Any]] | None = None
        now = time.time()
        for rid, rule in self._rules().items():
            if not rule["enabled"] or not has_source(rule):
                continue
            if attrs is None and (rule["entity_filter"] or rule["device_class"]):
                attrs = self._all_attrs()
            entities = self._rule_entities(rule, attrs) or ([] if (rule["entity"] or rule["entity_filter"] or rule["device_class"]) else [""])
            for entity_id in entities:
                key = f"{rid}|{entity_id or 'template'}"
                state = self.hass.states.get(entity_id) if entity_id else None
                if entity_id and state is None:
                    cond = False
                elif rule["mode"] == "on_change":
                    cond = self._events.get(key, 0) > now and in_time_range(minute, rule["time_from"], rule["time_to"])
                elif entity_id:
                    cond = evaluate_rule(rule, state.state, state.attributes, minute)
                else:
                    cond = in_time_range(minute, rule["time_from"], rule["time_to"])
                if cond and rule["template"] and rule["mode"] != "on_change":
                    cond = self._truthy(rule["template"], self._context(rule, entity_id, state, now_iso))
                if cond:
                    raw_true.add(key)
                    if rule["mode"] == "persistent":
                        self._persist.setdefault(key, now_iso)
                if rule["mode"] == "persistent" and key in self._persist:
                    found[key] = self._build(rid, rule, entity_id, state, self._persist[key])
                elif cond:
                    old = self.active.get(key)
                    found[key] = self._build(rid, rule, entity_id, state, old["since"] if old else now_iso)

        for key, item in self._manual.items():
            if item["expires"] and item["expires"] <= now:
                continue
            found[key] = item["alert"]
            raw_true.add(key)
        return found, raw_true

    async def _async_recompute(self) -> None:
        now = time.time()
        found, raw_true = self._compute()
        # Forget expired events, snoozes, manual alerts.
        self._events = {k: v for k, v in self._events.items() if v > now}
        self._manual = {k: v for k, v in self._manual.items() if not v["expires"] or v["expires"] > now}
        self.snoozed = {k: v for k, v in self.snoozed.items() if v > now}
        # A dismissed alert stays hidden only while its condition is still true.
        self.dismissed = {k for k in self.dismissed if k in raw_true or k in self._persist}
        self._persist = {k: v for k, v in self._persist.items() if k in found and k not in self.dismissed}
        previous = set(self._found)
        self._found = found
        visible = {k: a for k, a in found.items() if k not in self.dismissed and k not in self.snoozed}

        old = self.active
        self.active = visible
        if self._seeded:
            # New means the condition just became true, not "came back from snooze".
            for key in visible:
                if key not in previous:
                    await self._on_triggered(visible[key])
            for key in old:
                if key not in found:
                    self._record("cleared", old[key])
        self._seeded = True
        self._save()
        self._push()

    async def _on_triggered(self, alert: dict[str, Any]) -> None:
        self._record("triggered", alert)
        rule = self._rules().get(alert["rule_id"])
        route = rule["route"] if rule else alert.get("route", "")
        if not route:
            return
        try:
            await self.manager.async_notify(
                {"route": route, "title": alert["name"], "message": alert["message"], "dedupe_key": "alert:" + alert["key"]},
                source="alert",
            )
        except Exception as err:  # noqa: BLE001
            _LOGGER.warning("Alert route %s failed: %s", route, err)

    def _record(self, event: str, alert: dict[str, Any]) -> None:
        entry = {
            "ts": dt_util.utcnow().isoformat(),
            "event": event,
            "key": alert["key"],
            "name": alert["name"],
            "message": alert["message"],
            "priority": alert["priority"],
        }
        self.log.insert(0, entry)
        del self.log[LOG_MAX:]
        self.hass.bus.async_fire(EVENT_ALERT, entry)

    def _save(self) -> None:
        self._state_store.async_delay_save(
            lambda: {"snoozed": self.snoozed, "dismissed": sorted(self.dismissed), "log": self.log}, 10
        )

    # ---------- output ----------
    @callback
    def _push(self) -> None:
        for listener in list(self._listeners):
            try:
                listener()
            except Exception:  # noqa: BLE001
                _LOGGER.debug("Alert listener failed", exc_info=True)

    def user_key(self, user_id: str) -> str:
        for key, person in self.store.config["people"].items():
            state = self.hass.states.get(person.get("person_entity") or "")
            if state is not None and state.attributes.get("user_id") == user_id:
                return key
        return ""

    def payload(self, user_key: str, is_admin: bool) -> dict[str, Any]:
        rules = self._rules()

        def allowed(item: dict[str, Any]) -> bool:
            rule = rules.get(item["rule_id"])
            return True if rule is None else visible_to(rule, user_key, is_admin)

        alerts = [a for a in self.active.values() if allowed(a)]
        alerts.sort(key=lambda a: (PRIORITY_RANK.get(a["priority"], 9), a["since"]))
        snoozed = []
        for key, until in self.snoozed.items():
            alert = self._snoozed_alert(key)
            if alert and allowed(alert):
                snoozed.append({"key": key, "name": alert["name"], "message": alert["message"], "until": until})
        settings = self._settings()
        display = {k: settings[k] for k in settings if k not in ("enabled",)}
        display["can_act"] = bool(is_admin or settings["allow_user_actions"])
        return {"alerts": alerts, "snoozed": snoozed, "display": display, "ts": time.time()}

    def _snoozed_alert(self, key: str) -> dict[str, Any] | None:
        return self._found.get(key)

    # ---------- user actions ----------
    async def async_snooze(self, key: str, hours: float) -> None:
        alert = self.active.get(key)
        if alert is None or not alert.get("snoozable", True):
            return
        self.snoozed[key] = time.time() + max(0.1, min(float(hours), 168)) * 3600
        self._record("snoozed", alert)
        await self._async_recompute()

    async def async_dismiss(self, key: str) -> None:
        alert = self.active.get(key)
        if alert is None:
            return
        self.dismissed.add(key)
        self._events.pop(key, None)
        self._persist.pop(key, None)
        self._manual.pop(key, None)
        self._record("dismissed", alert)
        await self._async_recompute()

    async def async_resume(self, key: str | None = None) -> None:
        if key:
            self.snoozed.pop(key, None)
        else:
            self.snoozed = {}
        await self._async_recompute()

    # ---------- manual alerts, tests, preview ----------
    async def async_raise(self, data: dict[str, Any]) -> None:
        ident = slugify(data.get("id")) or "manual"
        rule = clean_rule(
            {
                "name": data.get("name") or ident.replace("_", " ").title(),
                "message": data.get("message") or "",
                "priority": data.get("priority"),
                "icon": data.get("icon"),
                "camera_entity": data.get("camera_entity"),
                "tap_action": {"action": "navigate", "navigation_path": data["tap_url"]} if data.get("tap_url") else {},
            }
        )
        key = f"manual|{ident}"
        alert = self._build(f"manual_{ident}", rule, "", None, dt_util.utcnow().isoformat())
        alert["key"] = key
        duration = int(data.get("duration") or 0)
        self._manual[key] = {"alert": alert, "expires": time.time() + duration if duration else 0}
        self.dismissed.discard(key)
        self.snoozed.pop(key, None)
        await self._async_recompute()
        if duration:
            async_call_later(self.hass, duration + 1, lambda _now: self._schedule())

    async def async_clear(self, ident: str) -> None:
        key = f"manual|{slugify(ident)}"
        self._manual.pop(key, None)
        self.dismissed.discard(key)
        await self._async_recompute()

    async def async_test(self, rule_id: str) -> bool:
        rule = self._rules().get(rule_id)
        if rule is None:
            return False
        entities = self._rule_entities(rule)
        entity_id = entities[0] if entities else ""
        state = self.hass.states.get(entity_id) if entity_id else None
        alert = self._build(rule_id, rule, entity_id, state, dt_util.utcnow().isoformat())
        alert["key"] = f"test|{rule_id}"
        alert["name"] = rule["name"] + " (test)"
        self._manual[alert["key"]] = {"alert": alert, "expires": time.time() + 30}
        await self._async_recompute()
        async_call_later(self.hass, 31, lambda _now: self._schedule())
        return True

    def preview(self, raw_rule: Any) -> dict[str, Any]:
        """Live match counter for the rule editor."""
        rule = clean_rule(raw_rule)
        if not has_source(rule):
            return {"entities": [], "count": 0, "active": 0, "note": "Pick an entity, a filter, a device class or a template."}
        local = dt_util.now()
        minute = local.hour * 60 + local.minute
        entities = self._rule_entities(rule)
        rows = []
        active = 0
        for entity_id in entities:
            state = self.hass.states.get(entity_id)
            on = bool(state is not None and evaluate_rule(rule, state.state, state.attributes, minute))
            active += on
            rows.append({"entity_id": entity_id, "state": state.state if state is not None else "missing", "active": on})
        rows.sort(key=lambda r: (not r["active"], r["entity_id"]))
        note = ""
        if rule["template"]:
            context = self._context(rule, "", None, dt_util.utcnow().isoformat())
            note = "Template is " + ("true" if self._truthy(rule["template"], context) else "false") + " right now."
        return {"entities": rows[:PREVIEW_MAX], "count": len(rows), "active": active, "note": note}
