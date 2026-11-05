"""Constants for Nabu Flow."""

from __future__ import annotations

DOMAIN = "nabu_flow"
VERSION = "1.1.3-beta"

STORAGE_KEY = "nabu_flow.config"
HISTORY_KEY = "nabu_flow.history"
ALERTS_STATE_KEY = "nabu_flow.alerts_state"
STORAGE_VERSION = 1

PANEL_URL_PATH = "nabu-flow"
PANEL_ELEMENT = "nabu-flow-panel"
PANEL_FILE = "nabu-flow-panel.js"
CARD_FILE = "nabu-flow-card.js"
TOPBAR_FILE = "nabu-flow-topbar.js"
ALERTS_FILE = "nabu-flow-alerts.js"
STATIC_URL = "/nabu_flow_static"
DATA_STATIC_REGISTERED = f"{DOMAIN}_static_registered"
DATA_WS_REGISTERED = f"{DOMAIN}_ws_registered"

SERVICE_NOTIFY = "notify"
SERVICE_ALERT = "alert"
SERVICE_ALERT_CLEAR = "alert_clear"
EVENT_SENT = "nabu_flow_sent"
EVENT_ALERT = "nabu_flow_alert"

SEVERITIES = ("info", "heads_up", "critical")
PHONE_MODES = ("auto", "none", "normal", "urgent", "critical")
PRESENCE_MODES = ("aware", "ignore", "home_only")

# Discord embed colors (decimal): blue, amber, red
COLORS = {"info": 6000111, "heads_up": 16762967, "critical": 15026253}

SECTIONS = ("settings", "people", "channels", "routes", "alerts")

HISTORY_MAX = 100
MAX_PEOPLE = 20
MAX_CHANNELS = 60
MAX_ROUTES = 200
