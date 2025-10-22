# Date Tags Automation Plugin

Automatically manages created/modified frontmatter and appends daily nested date tags on every modification for Obsidian notes.

## Features

- **Automatic Frontmatter Management**: Adds `created`, `modified`, and optional `type` fields to all notes
- **Date Tag Tracking**: Automatically appends nested date tags (`#date/YYYY/MM/DD`) on every modification
- **Creation Tag Preservation**: Ensures the creation date tag is always preserved in the tag list
- **Cross-Platform**: Works on desktop and mobile (iOS/Android)
- **Templater Integration**: Plays nicely with Templater plugin for template-based note creation
- **Linter Compatibility**: Can delegate modified timestamp updates to Linter plugin
- **Configurable Scope**: Can be limited to specific folders or applied vault-wide

## Requirements

Your existing requirements are met:

- On creation: Sets `created` and `modified` frontmatter timestamps, adds initial date tag
- On modification: Updates `modified` timestamp, appends new date tag (even same-day duplicates)
- Creation date tag persists in tag list
- Works on mobile devices

## Installation

1. Copy the plugin files to your vault: `.obsidian/plugins/date-tags-plugin/`
2. Reload Obsidian or restart the app
3. Enable "Date Tags Automation" in Settings > Community Plugins
4. Configure settings as needed in Settings > Date Tags Automation

## Settings

### Core Settings

- **Base tag**: Prefix for date tags (default: "date" creates `#date/YYYY/MM/DD`)
- **Allow same-day duplicates**: Add new date tag even if one exists for today (default: enabled)
- **Scope folders**: Comma-separated folder paths to monitor (empty = entire vault)

### Frontmatter Settings

- **Update frontmatter modified**: Auto-update modified field on each save (default: enabled)
- **Delegate modified to Linter**: Let Linter plugin handle modified timestamps instead
- **Add type if missing**: Automatically add type field to frontmatter (default: enabled)
- **Default type value**: Value for type field (default: "note")

### Advanced Settings

- **Debounce delay**: Minimum time between processing modifications in milliseconds (default: 1500)
- **Preserve creation tag**: Ensure creation date tag always present (default: enabled)
- **Templater detection delay**: Wait time for Templater expansion in milliseconds (default: 100)

## Integration with Other Plugins

### Templater

The plugin works seamlessly with Templater:

- Template-created notes: Templater handles initial frontmatter and date tag via placeholders
- Non-template notes: Plugin adds frontmatter and initial tag automatically
- No conflicts: Plugin detects Templater placeholders and waits for expansion

### Linter

For Linter compatibility:

1. Enable "Delegate modified to Linter" if you want Linter to handle timestamp formatting
2. Ensure Linter doesn't have rules that consolidate duplicate tags
3. Linter will format YAML but preserve the date tag history

## Example Output

### New Note (Created via Template)

```markdown
---
created: 2025-10-19 16:55:00
modified: 2025-10-19 16:55:00
type: daily-log
---

#adhd-brain-log #daily #date/2025/10/19
```

### After Multiple Edits

```markdown
---
created: 2025-10-19 16:55:00
modified: 2025-10-20 09:30:15
type: daily-log
---

#adhd-brain-log #daily #date/2025/10/19 #date/2025/10/19 #date/2025/10/20
```

## Commands

- **Add Today's Date Tag**: Manually add today's date tag to the active file (Command Palette)

## Troubleshooting

### Tags Not Being Added

- Check that the file is in scope (scope folders setting)
- Verify debounce delay hasn't prevented processing
- Ensure file is markdown (`.md` extension)

### Frontmatter Issues

- Plugin detects existing frontmatter by looking for `---` at file start
- Malformed frontmatter will be replaced with new block
- Blank line before closing `---` prevents formatting issues

### Templater Conflicts

- Plugin waits for Templater expansion before processing
- Increase "Templater detection delay" if conflicts occur
- Plugin skips files with active Templater placeholders (`<% %>`)

### Performance

- Adjust debounce delay for faster/slower response
- Limit scope folders to reduce processing overhead
- Plugin only processes markdown files in configured scope

## Technical Details

- Pure JavaScript, no external dependencies
- Uses Obsidian's native event system (`vault.on('create')`, `vault.on('modify')`)
- Debounced modification handling prevents rapid-fire updates
- Minimal regex operations for frontmatter updates
- Mobile-compatible (no Node.js dependencies)

## Support

This plugin implements the exact behavior specified:

- Creation date tag in frontmatter and preserved in tag list
- Modified timestamp updated on each save
- New date tag added on every modification (including same-day duplicates)
- Cross-platform compatibility (desktop and mobile)

For issues or feature requests, refer to your Obsidian plugin development documentation.
