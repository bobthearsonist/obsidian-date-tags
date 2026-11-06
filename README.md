# Date Tags Automation

Keep creation and modification timestamps and a daily date-tag history in your Markdown notes.

Requires Obsidian 1.5.0 or later. Templater and Linter are optional. The plugin works on desktop and mobile without network requests, accounts, or telemetry.

## On this page

- [Install](#install)
- [What it changes](#what-it-changes)
- [Tracking behavior](#tracking-behavior)
- [Settings](#settings)
- [Integrations](#integrations)
- [Troubleshooting](#troubleshooting)
- [Development and releases](#development-and-releases)

## Install

Install and update **Date Tags Automation** from the [Obsidian Community Plugins directory](https://community.obsidian.md/plugins/date-tags):

1. In Obsidian, open **Settings > Community plugins > Browse**.
2. Search for **Date Tags Automation**, then select **Install** and **Enable**.
3. Open the plugin's settings to choose which folders and metadata to track.

### Manual installation

1. Download `main.js` and `manifest.json` from the [latest GitHub release](https://github.com/bobthearsonist/obsidian-date-tags/releases/latest).
2. Put both files in `.obsidian/plugins/date-tags/` inside your vault.
3. Reload Obsidian, then enable **Date Tags Automation** in **Settings > Community plugins**.

The folder must match the plugin ID, `date-tags`; it does not need to match the GitHub repository name. If you already installed the plugin in a differently named folder, back up its settings and avoid enabling both copies.

Back up your vault before enabling automatic frontmatter changes.

## What it changes

- Adds `created`, `modified`, and an optional `type` property to new, in-scope Markdown notes.
- Adds a nested date tag such as `date/2026/11/03` to notes after tracked edits.
- Keeps the creation-date tag first and avoids adding the same day's tag twice.
- Limits tracking to selected folders and can exclude templates or other folders.
- Waits for Templater to finish creating notes, including with Templater 2.x.
- Lets you update `modified` yourself or delegate that timestamp to Linter.

Tags are stored in the `tags` frontmatter property, not appended to the note body:

```yaml
---
created: 2026-11-02 09:00:00
modified: 2026-11-03 10:30:00
type: note
tags:
  - date/2026/11/02
  - date/2026/11/03
---
```

For backdated notes, set `created` to the intended creation date. Template-completion processing preserves that date's tag and adds today's tag without overwriting template timestamps.

## Tracking behavior

| Change | What happens |
| --- | --- |
| A new, in-scope Markdown note is created | Adds initial frontmatter and today's date tag. If a matching Templater creation rule is enabled, waits for Templater to finish first. |
| An existing note is edited in Obsidian | Processes the edit after the configured idle/debounce checks. Depending on settings, updates `modified` and adds today's tag. |
| A note is edited with Obsidian CLI on desktop | Tracks supported CLI edits after the command finishes, then applies the same checks as an editor change. Turn this off with **Tag notes edited by the CLI**. |
| A note changes through sync, the filesystem, or another plugin | Does not treat the change as a user edit, so it does not add today's tag. |

The default idle threshold is five seconds and the processing debounce is three seconds. Optional checks can process an edit when you switch files or move focus away from the editor. An actively open note may wait until you switch away before a check can safely update it.

The command **Date Tags Automation: Add today's date tag** adds a tag to the active note. It does not update the note's `modified` timestamp.

## Settings

- **Scope folders**: comma-separated folders to track. Empty means the whole vault.
- **Exclude folders**: folders to skip; defaults to `Templates`, `copilot-custom-prompts`, and `copilot-conversations`.
- **Base tag**: parent tag for dates; defaults to `date`.
- **Preserve creation tag**: keeps the creation-date tag first.
- **Update frontmatter modified** / **Delegate modified to Linter**: choose how tracked edits update the `modified` timestamp.
- **Add type if missing** / **Default type value**: control the initial `type` property.
- **Enable idle updates**, **Update on file switch**, and **Update on editor blur**: choose when tracked edits are processed.
- **Debounce delay** and **Idle time**: adjust processing timing.
- **Tag notes edited by the CLI**: track Obsidian CLI edits; enabled by default on desktop.
- **Templater detection delay**: time to wait after a template-completion event; defaults to 300 milliseconds.

## Integrations

### Templater

The plugin waits for Templater's completion event when a matching folder or regex creation rule is enabled. Templater's creation trigger is device-local in current versions, so enable it on each device where you use those templates.

### Linter

If Linter manages `modified` timestamps, enable **Delegate modified to Linter** and configure Linter separately.

### Obsidian CLI

On desktop, edits made while commands such as `append`, `prepend`, `property:set`, `daily:append`, or `eval` run are tracked when the command finishes. If you are actively typing in the same note, normal idle checks still apply.

### Plugin API

Other plugins can read the date-tag convention:

```js
const api = app.plugins.plugins['date-tags']?.api;
const tag = api?.buildDateTag('2026-11-03'); // date/2026/11/03 by default
```

API version `1` exposes `buildDateTag(date)` and `getBaseTag()`. Dates may be a `Date`, `YYYY-MM-DD`, or `YYYYMMDD`. This read-only API does not mark notes as edited.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| A note is not tagged | Confirm it is in scope and not in an excluded folder. Existing-note edits must come through Obsidian's editor or the supported desktop CLI. |
| A template-created note has unexpected frontmatter | Enable Templater's creation trigger on this device and confirm the folder or regex rule matches. |
| `modified` is not changing | Check **Update frontmatter modified** or configure Linter and enable **Delegate modified to Linter**. |
| The plugin reports malformed frontmatter | Repair the YAML before retrying. The plugin reports the problem rather than silently replacing malformed data. |

## Development and releases

```sh
npm ci
npm test
npm run build
```

`main.source.js` is the plugin entry point. The build bundles browser-compatible dependencies and their license notices into `main.js`. Release tags must exactly match `manifest.json`'s version, without a `v` prefix. Each release includes only `main.js` and `manifest.json`; GitHub Actions verifies these assets against the build and creates artifact attestations.

See the [release guide](docs/releasing.md) for the full release and Obsidian directory update process.

## License and support

Copyright (C) 2025 bobthearsonist.

Date Tags Automation is distributed under [GPL-3.0-or-later](LICENSE), without warranty. Bundled third-party packages retain their own licenses; their complete notices are included in `main.js`.

[Report a bug or request a feature](https://github.com/bobthearsonist/obsidian-date-tags/issues).
