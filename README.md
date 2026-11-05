# Date Tags Automation

Maintain creation and modification timestamps and a daily date-tag history in your Markdown notes.

## Features

- Add `created`, `modified`, and an optional `type` property to new notes.
- Add a nested frontmatter tag such as `date/2026/11/03` after tracked editor changes and Obsidian CLI edits.
- Keep the creation-date tag first and avoid duplicate tags for the same day.
- Limit processing to selected folders and exclude templates or other folders.
- Wait for Templater to finish creating notes, including Templater 2.x.
- Optionally leave modified timestamps to Linter.
- Work on desktop and mobile without network requests, accounts, or telemetry.

Requires Obsidian 1.5.0 or later. Templater and Linter are optional.

## Installation

The plugin is not yet listed in the community directory.

### Manual installation

1. Download `main.js` and `manifest.json` from the [latest release](https://github.com/bobthearsonist/obsidian-date-tags/releases/latest).
2. Create `.obsidian/plugins/date-tags/` inside your vault and put both files there.
3. Reload Obsidian, enable **Date Tags Automation** under **Settings > Community plugins**, and review its settings.

The folder must match the manifest ID, `date-tags`. The GitHub repository name does not need to match it.
If you already installed the plugin in a differently named folder, keep a backup of its settings and avoid enabling two copies.

## How tracking works

New, in-scope Markdown files receive initial frontmatter and today's date tag. When a matching Templater creation rule is enabled, Date Tags waits for Templater's completion event instead.

Existing notes are tracked through Obsidian's `editor-change` event. Processing waits until you have been idle, with optional file-switch and editor-blur checks. The default idle threshold is five seconds and the processing debounce is three seconds.

**Obsidian CLI edits are tracked on desktop.** Notes changed while an [Obsidian CLI](https://obsidian.md/cli) command runs (`append`, `prepend`, `property:set`, `daily:append`, `eval`, and so on) get the same update as an editor change once the command finishes, before the CLI returns. If you are typing in that note, it waits for the normal idle check. Turn this off with **Tag notes edited by the CLI**.

**Other external writes are not treated as user edits.** Sync, filesystem changes, and writes from other plugins do not emit `editor-change`. A plain vault modification is intentionally insufficient, to avoid tagging every synced note as edited today.

The command **Date Tags Automation: Add Today's Date Tag** adds a tag to the active note. It does not update its modified timestamp.

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

Backdated notes should set `created` to their intended creation date. Template-completion processing preserves that date's tag and adds today's tag without overwriting template timestamps.

## Settings

- **Base tag**: defaults to `date`.
- **Scope folders**: comma-separated folders; empty means the entire vault.
- **Exclude folders**: defaults to `Templates`, `copilot-custom-prompts`, and `copilot-conversations`.
- **Update frontmatter modified** / **Delegate modified to Linter**: control timestamp updates after tracked edits.
- **Add type if missing** / **Default type value**: control the initial type property.
- **Debounce delay** and **Idle time**: control when tracked edits are processed.
- **Enable idle updates**, **Update on file switch**, and **Update on editor blur**: enable the corresponding processing checks.
- **Preserve creation tag**: keep the creation-date tag first.
- **Tag notes edited by the CLI**: update notes changed by Obsidian CLI commands; on by default, desktop only.
- **Templater detection delay**: delay after template-completion events, default 300 milliseconds.

An actively open note may wait until you switch away before an idle/blur check can safely update it.

## Plugin API

Other plugins can read the date-tag convention:

```js
const api = app.plugins.plugins['date-tags']?.api;
const tag = api?.buildDateTag('2026-11-03'); // date/2026/11/03 by default
```

API version `1` exposes `buildDateTag(date)` and `getBaseTag()`. Dates may be a `Date`, `YYYY-MM-DD`, or `YYYYMMDD`.
This is a read-only API; it does not mark notes as edited.

## Troubleshooting

- Check the scope and excluded folders if tags are missing.
- For existing notes, confirm the change came through the editor or the Obsidian CLI, then allow the idle delay or switch notes.
- Templater's creation trigger is device-local in current versions: enable it on each device where you use folder or regex templates.
- Malformed frontmatter reports an error instead of being silently replaced. Repair the YAML before retrying.
- If Linter manages modified timestamps, enable delegation and configure Linter separately.

Back up your vault before enabling automated frontmatter changes.

## Development

```sh
npm ci
npm test
npm run build
```

`main.source.js` is the plugin entry point. The build bundles browser-compatible dependencies and their license notices into `main.js`. Release tags must exactly match `manifest.json`'s version, without a `v` prefix. Attach `main.js` and `manifest.json` to each release.

## License and support

Copyright (C) 2025 bobthearsonist

Date Tags Automation is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version ([GPL-3.0-or-later](LICENSE)). It is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. The full license text is in [LICENSE](LICENSE).

Bundled third-party packages retain their own licenses; their complete notices are included in `main.js`.

[Report a bug or request a feature](https://github.com/bobthearsonist/obsidian-date-tags/issues).
