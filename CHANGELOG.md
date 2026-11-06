# Changelog

## 2.4.0-alpha (v2.4-Alpha)

- Pinned top bar is now compact: while pinned it drops the subtitle and countdown chip and shrinks the logo, title and pills. It slides away as you scroll down and returns when you scroll up, and it hides while a popup (a `#` in the URL) is open so it no longer draws over popups.
- iPhone: when there is no header above the page, the pinned bar sits at the very top and pads under the status bar, so scrolled content no longer shows above it.
- Options: `sticky_compact: false` and `sticky_hide: false` turn the new behavior off; `sticky: false` still turns pinning off.
- Version scheme moves to 2.x alpha (previous tag v2.2-Alpha / v2.3-Alpha contain 1.1.4-beta code).

## 1.1.4-beta (V1.1.4-Beta)

- Pinned top bar now locks to the top edge of the scrolling page area instead of where it first sat, so it sits flush under the header on iPhone and the companion app. The pinned background is more solid with a light blur, so content no longer shows through.

## 1.1.3-beta (V1.1.3-Beta)

- Christmas mode for the top bar. While `input_boolean.christmas_mode` is on, Nabu wears a Santa hat with twinkling sparkles, string lights run along the top, light snow falls, and a live countdown chip shows time to Christmas. On Dec 25 it says Merry Christmas, from Dec 26 it counts down to New Year, and it says Happy New Year until January 3, then the theme ends on its own. The bar keeps its dashboard's own colors.
- Options: `christmas: false` to turn it off, or `christmas: {entity, snow: false, end_days: 3, preview: true}`.

## 1.1.2-beta (V1.1.2-Beta)

- Top bar stays pinned at the top while the page scrolls, so the alert bubble and the page pills are always reachable. Turn it off with `sticky: false`; `sticky_bg` sets the pinned background color.

## 1.1.1-beta (V1.1.1-Beta)

### Alerts Flow: synced and smoother
- Every strip and bubble (all pages, tablets, phones, kitchen display) now cycles from one shared server-time clock, so they show the same alert at the same moment.
- Fewer redraws: unchanged alert data and unchanged weather no longer rebuild the strip. The stylesheet is parsed once.
- Smoother tile-to-tile transition: removed the backdrop blur on the strip and promoted the animated layers.
- Tapping prev/next or swiping pauses the shared rhythm for two cycles, then snaps back in step.

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
