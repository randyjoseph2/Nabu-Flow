import pytest

from nabu_flow_pure.audit import scan_automations, summarize
from nabu_flow_pure.model import (
    clean_channels,
    clean_people,
    clean_routes,
    clean_section,
    clean_settings,
    clean_who,
    merge_config,
    slugify,
)


def test_slugify():
    assert slugify("  Front Door!! ") == "front_door"
    assert slugify(None) == ""


def test_clean_who_variants():
    assert clean_who(None) == ["all"]
    assert clean_who("Both") == ["all"]
    assert clean_who("randy, sam") == ["randy", "sam"]
    assert clean_who(["randy", "all"]) == ["all"]
    assert clean_who([]) == ["all"]


def test_clean_people_rejects_bad_values():
    people = clean_people(
        {
            "Randy": {
                "name": "Randy",
                "person_entity": "light.kitchen",
                "phone_service": "notify.mobile_app_phone",
                "discord_id": "12 34",
            },
            "all": {"name": "Reserved"},
        }
    )
    assert list(people) == ["randy"]
    assert people["randy"]["person_entity"] == ""
    assert people["randy"]["phone_service"] == "notify.mobile_app_phone"
    assert people["randy"]["discord_id"] == ""


def test_clean_channels_and_routes_clamp_values():
    channels = clean_channels({"Doors": {"name": "Doors", "discord_id": "123"}})
    assert channels == {"doors": {"name": "Doors", "discord_id": "123"}}
    routes = clean_routes({"r": {"severity": "bogus", "phone": "loud", "cooldown": "-5", "discord": "no"}})
    assert routes["r"]["severity"] == "info"
    assert routes["r"]["phone"] == "auto"
    assert routes["r"]["cooldown"] == 0
    assert routes["r"]["discord"] is False


def test_clean_settings_validates_services():
    out = clean_settings({"notify_service": "not a service", "announce_service": "notify.echo", "snapshot_path": "relative"})
    assert out["notify_service"] == "notify.nabu"
    assert out["announce_service"] == "notify.echo"
    assert out["snapshot_path"] == ""


def test_clean_section_unknown_raises():
    with pytest.raises(ValueError):
        clean_section("nope", {})


def test_merge_config_fills_defaults():
    cfg = merge_config({"people": {"a": {}}})
    assert "doors" in cfg["channels"]
    assert cfg["people"]["a"]["name"] == "A"
    assert cfg["routes"] == {}


AUTOMATIONS = [
    {
        "id": "1",
        "alias": "Door open",
        "actions": [
            {"if": [{"condition": "state"}], "then": [{"action": "nabu_flow.notify", "data": {"route": "front_door"}}]},
        ],
    },
    {
        "id": "2",
        "alias": "Old style",
        "action": [{"service": "notify.mobile_app_randys_iphone", "data": {"message": "x"}}, {"action": "script.notify_house"}],
    },
    {"id": "3", "alias": "Bad route", "actions": [{"action": "nabu_flow.notify", "data": {"route": "ghost"}}]},
    {"id": "4", "alias": "Lights only", "actions": [{"action": "light.turn_on"}]},
    {"id": "5", "alias": "Blueprint", "use_blueprint": {"path": "x.yaml"}},
    {"id": "6", "alias": "Direct discord", "actions": [{"action": "notify.nabu", "data": {"message": "hi"}}]},
]


def test_scan_automations_classifies_calls():
    result = scan_automations(AUTOMATIONS, {"front_door": {}}, "notify.nabu")
    by_alias = {a["alias"]: a for a in result["automations"]}
    assert set(by_alias) == {"Door open", "Old style", "Bad route", "Direct discord"}
    assert by_alias["Door open"]["calls"][0]["kind"] == "nabu"
    assert [c["kind"] for c in by_alias["Old style"]["calls"]] == ["phone_direct", "legacy_script"]
    assert by_alias["Bad route"]["calls"][0]["kind"] == "nabu_unknown_route"
    assert by_alias["Direct discord"]["calls"][0]["kind"] == "discord_direct"
    assert result["skipped_blueprints"] == 1
    assert summarize(result) == {"total": 4, "routed": 1, "not_routed": 3}


def test_scan_handles_garbage_input():
    assert scan_automations(None, {})["automations"] == []
    assert scan_automations([1, "x", {}], {})["automations"] == []
