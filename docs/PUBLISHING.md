# Publishing checklist

## One-time repo setup (GitHub)

1. **Description.** Set the repo description, for example "Notification routing for Home Assistant: Discord, phone pushes, presence and a control panel."
2. **Topics.** Add `home-assistant`, `hacs`, `hacs-integration`, `discord`, `notifications`, `home-assistant-custom-component`.
3. **Issues.** Make sure Issues are enabled (HACS requires it).
4. **Actions.** Open the Actions tab and confirm the `Validate` workflow ran. Fix anything hassfest or HACS flags.

## Every release

1. Pick the version, for example `0.1.1`.
2. Update it in all three places:
   - `custom_components/nabu_flow/manifest.json` (`version`)
   - `custom_components/nabu_flow/const.py` (`VERSION`)
   - the `?v=` on the import at the top of `frontend/nabu-flow-panel.js`
3. Add an entry to `CHANGELOG.md`.
4. Commit and push to `main`.
5. On GitHub, **Releases > Draft a new release**, create tag `v0.1.1`, title `v0.1.1`, paste the changelog entry, and **Publish release**. HACS shows real version numbers only for published releases.

## Updating on your Home Assistant

HACS shows the update. After downloading it, restart Home Assistant. If the panel looks stale on a phone, fully close and reopen the companion app (the `?v=` change busts the cache).

## About the HACS "brands" check

Custom repositories do not need an entry in the home-assistant/brands repo, so the workflow ignores that check. The icons in `custom_components/nabu_flow/brand/` are used by recent Home Assistant versions that read brand images from the integration itself.
