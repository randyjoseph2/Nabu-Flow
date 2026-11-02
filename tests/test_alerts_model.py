from nabu_flow_pure.alerts_model import (
    clean_alert_settings,
    clean_alerts,
    clean_rule,
    compare,
    convert_alertticker,
    evaluate_rule,
    in_time_range,
    match_entities,
    render_placeholders,
    visible_to,
)
from nabu_flow_pure.model import default_config, merge_config


def test_compare_numbers_and_text():
    assert compare("15", "<", "20")
    assert not compare("25", "<", 20)
    assert compare("On", "=", "on")
    assert compare("on", "!=", "off")
    assert compare("Front door open", "contains", "door")
    assert not compare("abc", ">", "5")
    assert compare("20.0", "=", "20")


def test_time_range_crosses_midnight():
    assert in_time_range(100, "", "")
    assert in_time_range(23 * 60, "22:00", "06:00")
    assert in_time_range(5 * 60, "22:00", "06:00")
    assert not in_time_range(12 * 60, "22:00", "06:00")
    assert in_time_range(9 * 60, "08:00", "17:00")
    assert not in_time_range(17 * 60, "08:00", "17:00")


def test_clean_rule_defaults_and_bounds():
    rule = clean_rule({"entity": "Binary_Sensor.Garage", "priority": 1, "visible_to": "randy, sam", "icon": "nope", "color": "red"})
    assert rule["entity"] == "binary_sensor.garage"
    assert rule["priority"] == "critical"
    assert rule["visible_to"] == ["randy", "sam"]
    assert rule["icon"] == "" and rule["color"] == ""
    assert rule["message"] == "{name} is {state}"
    assert rule["tap_action"] == {"action": "default"}


def test_clean_rule_rejects_bad_values():
    rule = clean_rule(
        {
            "entity": "light.kitchen; drop",
            "operator": "~=",
            "mode": "forever",
            "time_from": "25:99",
            "tap_action": {"action": "navigate", "navigation_path": "no-slash"},
            "camera_entity": "light.kitchen",
            "route": "Front Door!",
        }
    )
    assert rule["entity"] == ""
    assert rule["operator"] == "="
    assert rule["mode"] == "state"
    assert rule["time_from"] == ""
    assert rule["tap_action"] == {"action": "default"}
    assert rule["camera_entity"] == ""
    assert rule["route"] == "front_door"


def test_clean_alerts_and_settings():
    out = clean_alerts({"settings": {"cycle_seconds": 1, "snooze_hours": "8, 1, 1, x", "clear_mode": "bogus"}, "rules": {"Low Battery": {"entity_filter": "sensor.*_battery"}}})
    assert out["settings"]["cycle_seconds"] == 3
    assert out["settings"]["snooze_hours"] == [1, 8]
    assert out["settings"]["clear_mode"] == "message"
    assert "low_battery" in out["rules"]
    assert clean_alert_settings(None)["clock_24h"] is True


def test_match_entities_filter_device_class_exclude():
    entities = {
        "sensor.a_battery": {"device_class": "battery"},
        "sensor.b_battery": {"device_class": "battery"},
        "sensor.temp": {"device_class": "temperature"},
    }
    rule = clean_rule({"device_class": "battery", "exclude": "sensor.b_*"})
    assert match_entities(rule, entities) == ["sensor.a_battery"]
    rule = clean_rule({"entity_filter": "battery"})
    assert match_entities(rule, entities) == ["sensor.a_battery", "sensor.b_battery"]
    rule = clean_rule({"entity": "light.x"})
    assert match_entities(rule, {}) == ["light.x"]


def test_evaluate_rule_attribute_and_unavailable():
    rule = clean_rule({"entity": "sensor.a", "operator": "<", "state": "20", "attribute": "battery.level"})
    assert evaluate_rule(rule, "on", {"battery": {"level": 10}}, 0)
    assert not evaluate_rule(rule, "on", {"battery": {"level": 50}}, 0)
    assert not evaluate_rule(rule, "on", {}, 0)
    rule = clean_rule({"entity": "lock.a", "operator": "!=", "state": "locked"})
    assert not evaluate_rule(rule, "unavailable", {}, 0)
    assert evaluate_rule(rule, "unlocked", {}, 0)


def test_render_placeholders_leaves_unknown_braces():
    assert render_placeholders("{name} is {state} {nope}", {"name": "Garage", "state": "open"}) == "Garage is open {nope}"


def test_visible_to():
    both = clean_rule({})
    assert visible_to(both, "", False)
    only_randy = clean_rule({"visible_to": ["randy"]})
    assert visible_to(only_randy, "randy", False)
    assert not visible_to(only_randy, "sam", False)
    admin_only = clean_rule({"visible_to": ["admin"]})
    assert visible_to(admin_only, "", True) and not visible_to(admin_only, "", False)
    assert visible_to(clean_rule({"visible_to": ["non_admin"]}), "", False)


def test_config_includes_alerts_and_roundtrips():
    cfg = default_config()
    assert cfg["alerts"]["rules"] == {}
    merged = merge_config({"alerts": {"rules": {"x": {"entity": "light.a"}}}})
    assert merged["alerts"]["rules"]["x"]["entity"] == "light.a"
    assert merge_config({})["alerts"]["settings"]["cycle_seconds"] == 6


def test_convert_alertticker():
    result = convert_alertticker(
        {
            "cycle_interval": 8,
            "clear_display_mode": "weather_forecast",
            "clear_weather_entity": "weather.home",
            "alerts": [
                {"entity": "binary_sensor.garage", "state": "on", "priority": 2, "message": "{name} open", "on_change": True, "auto_dismiss_after": 90, "icon_color": "#ff0000"},
                {"device_class": "battery", "operator": "<", "state": "20", "persistent": True, "visible_to": ["Randy"], "mystery": 1},
                {"entity": "x"},
            ],
        }
    )
    assert result["settings"]["cycle_seconds"] == 8
    assert result["settings"]["clear_mode"] == "weather"
    rules = list(result["rules"].values())
    assert rules[0]["priority"] == "warning" and rules[0]["mode"] == "on_change" and rules[0]["auto_dismiss"] == 90
    assert rules[0]["color"] == "#ff0000"
    assert rules[1]["mode"] == "persistent" and rules[1]["device_class"] == "battery"
    assert any("visible_to" in w for w in result["warnings"])
    assert any("mystery" in w for w in result["warnings"])
    assert convert_alertticker("nope")["rules"] == {}
