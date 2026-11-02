"""Exercise the AlertEngine against a tiny fake of Home Assistant."""

import asyncio
import sys
import types
from datetime import datetime, timezone
from types import SimpleNamespace


def _install_stubs():
    def mod(name, **attrs):
        m = types.ModuleType(name)
        m.__dict__.update(attrs)
        sys.modules[name] = m
        return m

    class Store:
        def __init__(self, *a, **k):
            pass

        async def async_load(self):
            return None

        def async_delay_save(self, *a, **k):
            pass

    class Template:
        def __init__(self, text, hass):
            self.text = text

        def async_render(self, variables=None, parse_result=True):
            return "true" if "true" in self.text else "false"

    now = datetime(2026, 11, 2, 12, 0, tzinfo=timezone.utc)
    dt = types.SimpleNamespace(
        now=lambda: now,
        utcnow=lambda: now,
        parse_datetime=lambda s: datetime.fromisoformat(s),
        as_local=lambda d: d,
    )
    mod("homeassistant")
    mod("homeassistant.const", EVENT_STATE_CHANGED="state_changed")
    mod("homeassistant.core", Event=object, HomeAssistant=object, callback=lambda f: f)
    mod("homeassistant.helpers")
    mod("homeassistant.helpers.event", async_call_later=lambda hass, delay, cb: (lambda: None), async_track_time_interval=lambda *a, **k: (lambda: None))
    mod("homeassistant.helpers.storage", Store=Store)
    mod("homeassistant.helpers.template", Template=Template)
    mod("homeassistant.util")
    mod("homeassistant.util.dt", **dt.__dict__)
    sys.modules["homeassistant.util"].dt = sys.modules["homeassistant.util.dt"]


_install_stubs()

from nabu_flow_pure.alerts import AlertEngine  # noqa: E402
from nabu_flow_pure.model import default_config, merge_config  # noqa: E402


class FakeState:
    def __init__(self, entity_id, state, **attrs):
        self.entity_id, self.state, self.attributes = entity_id, state, attrs
        self.name = attrs.get("friendly_name", entity_id)


class FakeHass:
    def __init__(self):
        self._states = {}
        self.fired = []
        self.bus = SimpleNamespace(async_listen=lambda *a: (lambda: None), async_fire=lambda name, data: self.fired.append((name, data)))
        self.states = SimpleNamespace(get=self._states.get, async_all=lambda domain=None: list(self._states.values()))

    def set(self, entity_id, state, **attrs):
        self._states[entity_id] = FakeState(entity_id, state, **attrs)


class FakeManager:
    def __init__(self):
        self.sent = []

    async def async_notify(self, data, source="service"):
        self.sent.append((data, source))


def make(rules, people=None):
    hass = FakeHass()
    config = merge_config({"alerts": {"rules": rules}, "people": people or {}})
    store = SimpleNamespace(config=config)
    manager = FakeManager()
    engine = AlertEngine(hass, store, manager)
    return hass, engine, manager


def run(coro):
    return asyncio.new_event_loop().run_until_complete(coro)


def test_state_rule_triggers_snoozes_and_dismisses():
    hass, engine, manager = make({"garage": {"name": "Garage", "entity": "binary_sensor.garage", "state": "on", "message": "{name} is {state}", "route": "garage_open", "priority": "critical"}})
    hass.set("binary_sensor.garage", "off", friendly_name="Garage door")
    run(engine.async_start())
    assert engine.active == {}

    hass.set("binary_sensor.garage", "on", friendly_name="Garage door")
    run(engine._async_recompute())
    alert = engine.active["garage|binary_sensor.garage"]
    assert alert["message"] == "Garage door is on"
    assert manager.sent[0][0]["route"] == "garage_open"
    assert engine.log[0]["event"] == "triggered"

    run(engine.async_snooze(alert["key"], 1))
    assert engine.active == {}
    assert engine.payload("", True)["snoozed"][0]["key"] == alert["key"]
    run(engine.async_resume())
    assert alert["key"] in engine.active

    run(engine.async_dismiss(alert["key"]))
    assert engine.active == {}
    run(engine._async_recompute())
    assert engine.active == {}  # still true, stays dismissed
    hass.set("binary_sensor.garage", "off")
    run(engine._async_recompute())
    hass.set("binary_sensor.garage", "on", friendly_name="Garage door")
    run(engine._async_recompute())
    assert alert["key"] in engine.active  # came back after clearing
    assert len(manager.sent) == 2


def test_existing_alert_at_startup_does_not_fire_route():
    hass, engine, manager = make({"a": {"entity": "light.x", "state": "on", "route": "r"}})
    hass.set("light.x", "on")
    run(engine.async_start())
    assert "a|light.x" in engine.active
    assert manager.sent == []


def test_device_class_pattern_and_persistent_mode():
    hass, engine, manager = make(
        {"bat": {"name": "Battery", "device_class": "battery", "operator": "<", "state": "20", "message": "{name} {state}%", "mode": "persistent"}}
    )
    hass.set("sensor.a", "50", device_class="battery", friendly_name="A")
    hass.set("sensor.b", "10", device_class="battery", friendly_name="B")
    hass.set("sensor.t", "5", device_class="temperature")
    run(engine.async_start())
    assert list(engine.active) == ["bat|sensor.b"]
    hass.set("sensor.b", "90", device_class="battery", friendly_name="B")
    run(engine._async_recompute())
    assert "bat|sensor.b" in engine.active  # persistent keeps it
    run(engine.async_dismiss("bat|sensor.b"))
    run(engine._async_recompute())
    assert engine.active == {}


def test_visibility_and_manual_alerts():
    hass, engine, manager = make(
        {"sec": {"entity": "light.x", "state": "on", "visible_to": ["randy"]}},
        people={"randy": {"name": "Randy", "person_entity": "person.randy"}},
    )
    hass.set("light.x", "on")
    run(engine.async_start())
    assert len(engine.payload("randy", False)["alerts"]) == 1
    assert engine.payload("sam", False)["alerts"] == []
    run(engine.async_raise({"id": "oven", "message": "Oven is on", "priority": "info"}))
    assert [a["message"] for a in engine.payload("sam", False)["alerts"]] == ["Oven is on"]
    run(engine.async_clear("oven"))
    assert engine.payload("sam", False)["alerts"] == []


def test_priority_order_and_template_condition():
    hass, engine, _ = make(
        {
            "low": {"entity": "light.a", "state": "on", "priority": "low"},
            "crit": {"entity": "light.b", "state": "on", "priority": "critical"},
            "tpl": {"template": "true", "message": "Template says so", "priority": "info"},
            "tpl_false": {"template": "nope"},
        }
    )
    hass.set("light.a", "on")
    hass.set("light.b", "on")
    run(engine.async_start())
    order = [a["rule_id"] for a in engine.payload("", True)["alerts"]]
    assert order == ["crit", "tpl", "low"]


def test_preview_counts_matches():
    hass, engine, _ = make({})
    hass.set("sensor.a_battery", "5", device_class="battery")
    hass.set("sensor.b_battery", "80", device_class="battery")
    result = engine.preview({"device_class": "battery", "operator": "<", "state": "20"})
    assert result["count"] == 2 and result["active"] == 1
    assert engine.preview({})["count"] == 0
