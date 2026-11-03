# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.5] - 2026-11-02

### Fixed

- Detect Templater 2.x folder and regex creation modes after its legacy enable flags were removed.
- Accept Templater 2.x event payload objects when processing completed templates.
- Respect Templater's device-local creation toggle and ignored creation folders.
- Prevent Date Tags from racing Templater and corrupting frontmatter on newly created template notes.

### Publication

- Correct manual installation instructions and document editor-only tracking and the read-only integration API.
- Align package metadata with the existing GPL-3.0-or-later license and include its complete text.
- Include complete bundled dependency license notices in the distributable plugin.

## [0.1.0] - 2025-10-22

### Added

- Initial release of Date Tags Automation plugin
- Automatic frontmatter management (created, modified, type fields)
- Daily nested date tags (`#date/YYYY/MM/DD`) on every modification
- Creation date tag preservation in tag list
- Cross-platform compatibility (desktop and mobile)
- Templater integration with smart detection
- Linter plugin compatibility
- Configurable scope folders
- Debounced modification handling
- Manual "Add Today's Date Tag" command
- Comprehensive settings panel with:
  - Base tag customization
  - Scope folder configuration
  - Frontmatter update options
  - Templater detection settings
  - Advanced timing controls

### Features

- **Smart Frontmatter**: Automatically adds and maintains created/modified timestamps
- **Date Tag History**: Preserves complete editing history through date tags
- **Plugin Integration**: Works seamlessly with Templater and Linter
- **Mobile Support**: Full functionality on iOS and Android
- **Flexible Configuration**: Extensive settings for customization
- **Error Handling**: Robust error handling with user notifications

### Technical Details

- Built with gray-matter for reliable YAML parsing
- Uses Obsidian's native event system
- Debounced processing prevents performance issues
- GPL-3.0 licensed for open source compatibility
