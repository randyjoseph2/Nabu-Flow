from nabu_flow_pure.model import merge_config
from nabu_flow_pure.router import build_plan


def make_config(**routes):
    cfg = merge_config(
        {
            "settings": {"announce_service": "notify.mobile_app_echo_show_8"},
            "people": {
                "randy": {
                    "name": "Randy",
                    "person_entity": "person.randy",
                    "phone_service": "notify.mobile_app_randys_iphone",
                    "discord_id": "111",
                },
                "sam": {
                    "name": "Sam",
                    "person_entity": "person.sam",
                    "phone_service": "notify.mobile_app_sams_iphone",
                    "discord_id": "222",
                },
            },
            "channels": {
                "doors": {"name": "Doors", "discord_id": "1001"},
                "garage": {"name": "Garage", "discord_id": "1002"},
                "server_and_ha": {"name": "Server", "discord_id": "1003"},
                "digest": {"name": "Digest", "discord_id": "1004"},
                "critical_log": {"name": "Critical log", "discord_id": "1005"},
            },
            "routes": routes,
        }
    )
    return cfg


def test_info_goes_to_discord_only():
    plan = build_plan(make_config(), {"channel": "doors", "title": "Hi", "message": "there"})
    assert plan["discord"]["channel_id"] == "1001"
    assert plan["discord"]["message"] == ""  # info never mentions
    assert plan["pushes"] == []
    assert plan["recipients"] == ["randy", "sam"]


def test_critical_pushes_everyone_loud_and_mirrors_to_log():
    plan = build_plan(make_config(), {"channel": "garage", "title": "Garage open", "severity": "critical"})
    assert [p["level"] for p in plan["pushes"]] == ["critical", "critical"]
    assert plan["discord"]["mirror_channel_id"] == "1005"
    assert "<@111>" in plan["discord"]["message"] and "<@222>" in plan["discord"]["message"]


def test_critical_in_critical_log_does_not_mirror_to_itself():
    plan = build_plan(make_config(), {"channel": "critical_log", "severity": "critical"})
    assert plan["discord"]["mirror_channel_id"] is None


def test_aware_sends_passive_to_away_person():
    plan = build_plan(make_config(), {"channel": "doors", "severity": "heads_up", "phone": "normal"}, away={"sam"})
    levels = {p["person"]: p["level"] for p in plan["pushes"]}
    assert levels == {"randy": "active", "sam": "passive"}
    assert plan["discord"]["message"] == "<@111>"  # away person not mentioned


def test_ignore_presence_treats_everyone_the_same():
    plan = build_plan(
        make_config(),
        {"channel": "doors", "severity": "heads_up", "phone": "normal", "presence": "ignore"},
        away={"sam"},
    )
    assert {p["level"] for p in plan["pushes"]} == {"active"}
    assert plan["discord"]["message"] == "<@111> <@222>"


def test_home_only_skips_away_but_falls_back_when_nobody_home():
    cfg = make_config()
    data = {"channel": "doors", "severity": "heads_up", "phone": "normal", "presence": "home_only"}
    plan = build_plan(cfg, data, away={"sam"})
    assert [p["person"] for p in plan["pushes"]] == ["randy"]
    plan = build_plan(cfg, data, away={"sam", "randy"})
    assert [p["person"] for p in plan["pushes"]] == ["randy", "sam"]


def test_critical_ignores_home_only():
    plan = build_plan(
        make_config(),
        {"channel": "doors", "severity": "critical", "presence": "home_only"},
        away={"sam"},
    )
    assert [p["person"] for p in plan["pushes"]] == ["randy", "sam"]


def test_quiet_mode_moves_info_to_digest_but_not_heads_up():
    cfg = make_config()
    info = build_plan(cfg, {"channel": "doors"}, quiet=True)
    assert info["discord"]["channel_id"] == "1004"
    heads = build_plan(cfg, {"channel": "doors", "severity": "heads_up"}, quiet=True)
    assert heads["discord"]["channel_id"] == "1001"


def test_route_defaults_and_call_overrides():
    cfg = make_config(
        front_door={
            "name": "Front door",
            "channel": "doors",
            "who": ["randy"],
            "severity": "heads_up",
            "discord": True,
            "phone": "urgent",
        }
    )
    plan = build_plan(cfg, {"route": "front_door", "title": "Door"})
    assert plan["recipients"] == ["randy"]
    assert plan["pushes"][0]["level"] == "time-sensitive"
    off = build_plan(cfg, {"route": "front_door", "discord": False, "phone": "none"})
    assert off["discord"] is None and off["pushes"] == []


def test_unknown_route_warns_and_disabled_route_is_suppressed():
    cfg = make_config(old={"name": "Old", "enabled": False})
    plan = build_plan(cfg, {"route": "nope", "title": "x"})
    assert any("Unknown route" in w for w in plan["warnings"])
    disabled = build_plan(cfg, {"route": "old"})
    assert disabled["suppressed"] == "route_disabled" and disabled["discord"] is None


def test_missing_channel_id_warns_instead_of_sending():
    cfg = make_config()
    cfg["channels"]["network"] = {"name": "Network", "discord_id": ""}
    plan = build_plan(cfg, {"channel": "network"})
    assert plan["discord"] is None
    assert any("no Discord ID" in w for w in plan["warnings"])


def test_unknown_channel_falls_back_to_default():
    plan = build_plan(make_config(), {"channel": "nonexistent"})
    assert plan["discord"]["channel_key"] == "server_and_ha"


def test_announce_only_when_someone_is_home():
    cfg = make_config()
    data = {"title": "Garage open", "message": "Since 10 PM", "announce": True}
    assert build_plan(cfg, data, away={"sam"})["announce"]["text"] == "Garage open. Since 10 PM"
    assert build_plan(cfg, data, away={"sam", "randy"})["announce"] is None


def test_dedupe_from_call_and_route():
    cfg = make_config(door={"name": "Door", "cooldown": 900})
    assert build_plan(cfg, {"route": "door"})["dedupe"] == {"key": "door", "cooldown": 900}
    assert build_plan(cfg, {"route": "door", "cooldown": 0})["dedupe"] is None
    assert build_plan(cfg, {"dedupe_key": "k", "cooldown": 60})["dedupe"] == {"key": "k", "cooldown": 60}


def test_unknown_recipient_falls_back_to_everyone_with_warning():
    plan = build_plan(make_config(), {"who": "bob", "phone": "normal"})
    assert plan["recipients"] == ["randy", "sam"]
    assert any("Unknown recipient" in w for w in plan["warnings"])


def test_string_booleans_from_templates_are_understood():
    plan = build_plan(make_config(), {"channel": "doors", "discord": "false"})
    assert plan["discord"] is None
