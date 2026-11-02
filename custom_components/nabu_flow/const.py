"""Constants for Nabu Flow."""

from __future__ import annotations

DOMAIN = "nabu_flow"
VERSION = "0.1.0"

STORAGE_KEY = "nabu_flow.config"
HISTORY_KEY = "nabu_flow.history"
STORAGE_VERSION = 1

PANEL_URL_PATH = "nabu-flow"
PANEL_ELEMENT = "nabu-flow-panel"
PANEL_FILE = "nabu-flow-panel.js"
STATIC_URL = "/nabu_flow_static"
DATA_STATIC_REGISTERED = f"{DOMAIN}_static_registered"
DATA_WS_REGISTERED = f"{DOMAIN}_ws_registered"

SERVICE_NOTIFY = "notify"
EVENT_SENT = "nabu_flow_sent"

SEVERITIES = ("info", "heads_up", "critical")
PHONE_MODES = ("auto", "none", "normal", "urgent", "critical")
PRESENCE_MODES = ("aware", "ignore", "home_only")

# Discord embed colors (decimal): blue, amber, red
COLORS = {"info": 6000111, "heads_up": 16762967, "critical": 15026253}

SECTIONS = ("settings", "people", "channels", "routes")

HISTORY_MAX = 100
MAX_PEOPLE = 20
MAX_CHANNELS = 60
MAX_ROUTES = 200
