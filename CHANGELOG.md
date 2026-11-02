# Changelog

## 1.1.0-beta (V1.1-Beta)

First release with Alerts Flow and the merged top bar. The earlier V1.0-Beta release was cut from older code, so install V1.1-Beta instead.

- Alerts strip lives in the Nabu Flow panel header on every tab.
- Top bar: `alerts: {layout: strip | bubble | auto}`. `bubble` puts a pill beside the logo and title on wide bars; `auto` switches at 700px.
- Top bar: the logo is now the Assist button; the separate microphone button is gone.
- Top bar: `alerts` loads its own file if a display skipped it, waits for it if it loads late, and says on screen why the strip is missing.

### Also in this release (0.4.7)
- Top bar: a page can have a `badge` entity. A count bubble shows on that pill while the entity's state is above 0 (for example `badge: sensor.chore_quest_open` on the Chores page) and hides at 0.

## 0.4.0
- Alerts Flow: rule-based alerts evaluated on the server, with snooze and dismiss shared across every device
- Rules watch an entity, a wildcard pattern or a device class, with operators, attributes, time ranges, templates, priority, placeholders, camera, tap actions and per-person visibility
- Modes: while true, stay until dismissed, or flash on any state change
- A rule can also fire a Nabu route (Discord and phone) the first time it appears
- `nabu-alert-strip` inside `custom:nabu-top-bar` (`alerts: true`) and the standalone `custom:nabu-alerts-card`: cycling, swipe, snooze, list, camera view, and a clear-state message, clock or weather
- New Alerts tab in the panel: rules, live preview, match checker, display settings, AlertTicker importer and activity log
- AlertTicker import maps targets on tap actions, extra AND conditions (as a template), emoji icons and themes (to priority)
- Strip option `only` / `skip` (rule ids) to give each dashboard its own list
- New actions `nabu_flow.alert` and `nabu_flow.alert_clear` for one-off alerts; new `nabu_flow_alert` event

## 0.3.6
- New `tap_url` option: tapping the phone push opens that dashboard path (for example /newui-4-0/cameras).

## 0.3.5
- Phone pushes show the camera picture through the app's camera proxy (`entity_id`) instead of a /local file that returned 404.

## 0.3.4
- Phone pushes can carry action buttons: pass `actions` (list of `action`, `title`, optional `destructive`) to `nabu_flow.notify`.
- Top bar no longer errors if it is loaded twice.

## 0.3.3

- Cards and top bar also load in older display WebViews (es5 list), so kiosk displays no longer show a red missing-card error

## 0.3.2

- Top bar: `menu: false` hides the sidebar button (for kiosk displays)

## 0.3.1

- Top bar pills snap into place and the current page is centered on load

## 0.3.0

- New `custom:nabu-top-bar` card: logo, title, Assist button and pill tabs that act as dashboard pages

## 0.2.1

- Camera snapshots are now attached to phone pushes as well as Discord (iOS attachment and Android image), when the snapshot path is under www

## 0.2.0

- Dashboard card `custom:nabu-flow-card`: recent notifications, quiet-mode switch, optional test button (loads automatically, works for non-admin users)
- Read-only `nabu_flow/recent` websocket command

## 0.1.0

First release.

- `nabu_flow.notify` action with routes, per-person delivery, Discord on/off, four phone levels, presence modes, camera snapshots, kitchen announce, cooldowns and quiet mode
- Control panel: Routes, Audit, People, Channels, History, Settings
- Automation audit for UI-created automations in `automations.yaml`
- Notification history and `nabu_flow_sent` event
- JSON export and import
