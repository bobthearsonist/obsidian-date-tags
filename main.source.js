const {
  Plugin,
  PluginSettingTab,
  Setting,
  TFile,
  Notice,
} = require('obsidian');
const matter = require('gray-matter');

const DEFAULT_SETTINGS = {
  baseTag: 'date',
  scopeFolders: [],
  updateFrontmatterModified: true,
  delegateModifiedToLinter: false,
  addTypeIfMissing: true,
  typeValue: 'note',
  debounceMs: 1500,
  preserveCreationTag: true,
  templaterDetectionDelay: 100,
};

// Utility class for date formatting and tag building
class DateHelper {
  static formatTimestamp() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
      2,
      '0'
    )}-${String(now.getDate()).padStart(2, '0')} ${String(
      now.getHours()
    ).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(
      now.getSeconds()
    ).padStart(2, '0')}`;
  }

  static buildDateTag(baseTag, date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${baseTag}/${year}/${month}/${day}`;
  }

  static parseCreatedDate(frontmatterData) {
    if (!frontmatterData.created) return null;
    const date = new Date(frontmatterData.created);
    return isNaN(date.getTime()) ? null : date;
  }
}

// Class for handling frontmatter operations using gray-matter
class FrontmatterManager {
  constructor(settings, app) {
    this.settings = settings;
    this.app = app;

    // Get Obsidian's current indentation settings
    const indentSize = this.getObsidianIndentSize();

    // YAML formatting options to ensure consistent output (js-yaml options)
    this.yamlOptions = {
      lineWidth: -1, // Prevent line wrapping
      noRefs: true, // Prevent YAML references
      flowLevel: -1, // Use block style (with dashes) instead of flow style for collections
      sortKeys: false, // Don't sort keys to preserve original order
      indent: indentSize, // Use Obsidian's current indentation setting
      noArrayIndent: false, // Add indentation to array elements
    };
  }

  getObsidianIndentSize() {
    try {
      // Try to get the indent size from Obsidian's editor settings
      const editorSettings = this.app.vault.config?.editor;
      if (editorSettings) {
        // Check for tab size or default indentation settings
        return editorSettings.tabSize || editorSettings.indentSize || 2;
      }

      // Fallback: check app settings if available
      const appSettings = this.app.setting?.getItem?.('editor.tabSize');
      if (appSettings) {
        return parseInt(appSettings, 10) || 2;
      }

      // Default fallback to 2 spaces
      return 2;
    } catch (error) {
      console.log(
        'DateTagsPlugin: Could not read Obsidian indent settings, using default (2)'
      );
      return 2;
    }
  }

  ensureFrontmatter(content, timestamp) {
    let parsed;
    try {
      parsed = matter(content);
    } catch (error) {
      // If parsing fails, throw error to notify user
      throw new Error(`Failed to parse frontmatter: ${error.message}`);
    }

    // Ensure required fields exist
    if (!parsed.data.created) {
      parsed.data.created = timestamp;
    }
    if (!parsed.data.modified) {
      parsed.data.modified = timestamp;
    }
    if (this.settings.addTypeIfMissing && !parsed.data.type) {
      parsed.data.type = this.settings.typeValue;
    }

    return matter.stringify(parsed.content, parsed.data, this.yamlOptions);
  }

  createFrontmatter(timestamp) {
    const data = {
      created: timestamp,
      modified: timestamp,
    };

    if (this.settings.addTypeIfMissing) {
      data.type = this.settings.typeValue;
    }

    return matter.stringify('', data, this.yamlOptions);
  }

  updateModified(content, timestamp) {
    try {
      const parsed = matter(content);
      parsed.data.modified = timestamp;
      return matter.stringify(parsed.content, parsed.data, this.yamlOptions);
    } catch (error) {
      throw new Error(`Failed to update modified timestamp: ${error.message}`);
    }
  }

  addTag(content, tag) {
    try {
      const parsed = matter(content);

      // Initialize tags array if it doesn't exist
      if (!parsed.data.tags) {
        parsed.data.tags = [];
      }

      // Ensure tags is an array (handle various formats)
      if (!Array.isArray(parsed.data.tags)) {
        if (typeof parsed.data.tags === 'string') {
          parsed.data.tags = [parsed.data.tags];
        } else {
          parsed.data.tags = [];
        }
      }

      // Add tag if not already present
      if (!parsed.data.tags.includes(tag)) {
        parsed.data.tags.push(tag);
      }

      return matter.stringify(parsed.content, parsed.data, this.yamlOptions);
    } catch (error) {
      throw new Error(`Failed to add tag "${tag}": ${error.message}`);
    }
  }

  ensureTagAtStart(content, tag) {
    try {
      const parsed = matter(content);

      // Initialize tags array if it doesn't exist
      if (!parsed.data.tags) {
        parsed.data.tags = [];
      }

      // Ensure tags is an array (handle various formats)
      if (!Array.isArray(parsed.data.tags)) {
        if (typeof parsed.data.tags === 'string') {
          parsed.data.tags = [parsed.data.tags];
        } else {
          parsed.data.tags = [];
        }
      }

      // Remove tag if it exists elsewhere and add at start
      const existingIndex = parsed.data.tags.indexOf(tag);
      if (existingIndex > -1) {
        parsed.data.tags.splice(existingIndex, 1);
      }
      parsed.data.tags.unshift(tag);

      return matter.stringify(parsed.content, parsed.data, this.yamlOptions);
    } catch (error) {
      throw new Error(
        `Failed to ensure tag "${tag}" at start: ${error.message}`
      );
    }
  }
}

// Class for handling file operations with safety checks
class FileProcessor {
  constructor(app, settings) {
    this.app = app;
    this.settings = settings;
    this.frontmatterMgr = new FrontmatterManager(settings, app);
    this.isModifying = false;
  }

  showError(message, filePath) {
    const fullMessage = filePath
      ? `DateTagsPlugin: ${message} (File: ${filePath})`
      : `DateTagsPlugin: ${message}`;
    new Notice(fullMessage, 8000); // Show for 8 seconds
    console.error(fullMessage);
  }

  async safeModify(file, content) {
    this.isModifying = true;
    try {
      await this.app.vault.modify(file, content);
    } finally {
      this.isModifying = false;
    }
  }

  isInScope(file) {
    if (!file || !(file instanceof TFile) || file.extension !== 'md') {
      return false;
    }
    if (this.settings.scopeFolders.length === 0) return true;
    return this.settings.scopeFolders.some((folder) =>
      file.path.startsWith(folder.trim())
    );
  }

  hasTemplaterConfig(file) {
    const templater = this.app.plugins.plugins['templater-obsidian'];
    if (!templater?.settings) return false;

    const {
      enable_folder_templates,
      folder_templates,
      enable_file_templates,
      file_templates,
    } = templater.settings;

    if (enable_folder_templates && folder_templates) {
      for (const { folder, template } of folder_templates) {
        if (folder && template && file.path.startsWith(folder + '/')) {
          return true;
        }
      }
    }

    if (enable_file_templates && file_templates) {
      for (const { regex, template } of file_templates) {
        if (regex && template) {
          try {
            if (new RegExp(regex).test(file.path)) return true;
          } catch (error) {
            console.error(
              'DateTagsPlugin: Invalid regex in Templater file_templates:',
              error
            );
          }
        }
      }
    }

    return false;
  }

  async processNewFile(file) {
    const timestamp = DateHelper.formatTimestamp();
    const todayTag = DateHelper.buildDateTag(this.settings.baseTag);
    let content = await this.app.vault.read(file);

    try {
      content = this.frontmatterMgr.ensureFrontmatter(content, timestamp);
      content = this.frontmatterMgr.addTag(content, todayTag);
      await this.safeModify(file, content);
    } catch (error) {
      this.showError(`Failed to process new file: ${error.message}`, file.path);
    }
  }

  async processUserEdit(file) {
    const timestamp = DateHelper.formatTimestamp();
    const todayTag = DateHelper.buildDateTag(this.settings.baseTag);
    let content = await this.app.vault.read(file);
    let needsUpdate = false;

    try {
      // Update modified timestamp if not delegated
      if (
        this.settings.updateFrontmatterModified &&
        !this.settings.delegateModifiedToLinter
      ) {
        const updated = this.frontmatterMgr.updateModified(content, timestamp);
        if (updated !== content) {
          content = updated;
          needsUpdate = true;
        }
      }

      // Preserve creation tag
      if (this.settings.preserveCreationTag) {
        const parsed = matter(content);
        const createdDate = DateHelper.parseCreatedDate(parsed.data);
        if (createdDate) {
          const creationTag = DateHelper.buildDateTag(
            this.settings.baseTag,
            createdDate
          );
          const updated = this.frontmatterMgr.ensureTagAtStart(
            content,
            creationTag
          );
          if (updated !== content) {
            content = updated;
            needsUpdate = true;
          }
        }
      }

      // Add today's tag
      const parsed = matter(content);
      const currentTags = Array.isArray(parsed.data.tags)
        ? parsed.data.tags
        : [];
      if (!currentTags.includes(todayTag)) {
        content = this.frontmatterMgr.addTag(content, todayTag);
        needsUpdate = true;
      }

      if (needsUpdate) {
        await this.safeModify(file, content);
      }
    } catch (error) {
      this.showError(
        `Failed to process file edit: ${error.message}`,
        file.path
      );
    }
  }

  async processTemplaterComplete(file) {
    await new Promise((resolve) => setTimeout(resolve, 50));

    const todayTag = DateHelper.buildDateTag(this.settings.baseTag);
    let content = await this.app.vault.read(file);
    let needsUpdate = false;

    try {
      const parsed = matter(content);
      const currentTags = Array.isArray(parsed.data.tags)
        ? parsed.data.tags
        : [];
      if (!currentTags.includes(todayTag)) {
        content = this.frontmatterMgr.addTag(content, todayTag);
        needsUpdate = true;
      }

      if (this.settings.preserveCreationTag) {
        const createdDate = DateHelper.parseCreatedDate(parsed.data);
        if (createdDate) {
          const creationTag = DateHelper.buildDateTag(
            this.settings.baseTag,
            createdDate
          );
          const updated = this.frontmatterMgr.ensureTagAtStart(
            content,
            creationTag
          );
          if (updated !== content) {
            content = updated;
            needsUpdate = true;
          }
        }
      }

      if (needsUpdate) {
        await this.safeModify(file, content);
      }
    } catch (error) {
      this.showError(
        `Failed to process Templater completion: ${error.message}`,
        file.path
      );
    }
  }
}

class DateTagsPlugin extends Plugin {
  constructor() {
    super(...arguments);
    this.lastProcessed = new Map();
    this.lastUserEdit = 0;
  }

  async onload() {
    await this.loadSettings();
    this.processor = new FileProcessor(this.app, this.settings);

    this.addSettingTab(new DateTagsSettingTab(this.app, this));

    // Track user edits
    this.registerEvent(
      this.app.workspace.on('editor-change', () => {
        this.lastUserEdit = Date.now();
      })
    );

    // File events
    this.registerEvent(
      this.app.vault.on('create', (file) => this.handleCreate(file))
    );
    this.registerEvent(
      this.app.vault.on('modify', (file) => this.handleModify(file))
    );

    // Templater events
    const templaterEvents = [
      'templater:new-note-from-template',
      'templater:template-appended',
      'templater:overwrite-file',
      'templater:all-templates-executed',
    ];

    templaterEvents.forEach((eventName) => {
      this.registerEvent(
        this.app.workspace.on(eventName, (file) =>
          this.handleTemplaterComplete(file)
        )
      );
    });

    this.addCommand({
      id: 'add-today-date-tag',
      name: "Add Today's Date Tag",
      callback: () => this.addTodayTagToActiveFile(),
    });
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
    if (this.processor) {
      this.processor.settings = this.settings;
      this.processor.frontmatterMgr.settings = this.settings;
    }
  }

  async handleCreate(file) {
    if (!this.processor.isInScope(file)) return;
    if (this.processor.hasTemplaterConfig(file)) return;

    try {
      await this.processor.processNewFile(file);
    } catch (error) {
      console.error('DateTagsPlugin: Error handling file creation:', error);
    }
  }

  async handleModify(file) {
    if (!this.processor.isInScope(file) || this.processor.isModifying) return;

    const nowTs = Date.now();
    if (nowTs - this.lastUserEdit > 3000) return;

    const last = this.lastProcessed.get(file.path) || 0;
    if (nowTs - last < this.settings.debounceMs) return;

    this.lastProcessed.set(file.path, nowTs);

    try {
      await this.processor.processUserEdit(file);
    } catch (error) {
      console.error('DateTagsPlugin: Error handling file modification:', error);
    }
  }

  async handleTemplaterComplete(file) {
    if (!this.processor.isInScope(file)) return;

    try {
      await this.processor.processTemplaterComplete(file);
    } catch (error) {
      console.error(
        'DateTagsPlugin: Error handling Templater completion:',
        error
      );
    }
  }

  async addTodayTagToActiveFile() {
    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile || !this.processor.isInScope(activeFile)) return;

    try {
      const todayTag = DateHelper.buildDateTag(this.settings.baseTag);
      let content = await this.app.vault.read(activeFile);
      content = this.processor.frontmatterMgr.addTag(content, todayTag);
      await this.app.vault.modify(activeFile, content);
    } catch (error) {
      this.processor.showError(
        `Failed to add today's tag manually: ${error.message}`,
        activeFile.path
      );
    }
  }
}

class DateTagsSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl('h2', { text: 'Date Tags Automation Settings' });

    const settings = [
      {
        name: 'Base tag',
        desc: 'The prefix for date tags (e.g., "date" creates #date/YYYY/MM/DD)',
        type: 'text',
        placeholder: 'date',
        get: () => this.plugin.settings.baseTag,
        set: (value) => {
          this.plugin.settings.baseTag = value || 'date';
        },
      },
      {
        name: 'Scope folders',
        desc: 'Comma-separated list of folder paths to monitor (leave empty for entire vault)',
        type: 'textarea',
        placeholder: 'Test/0 Daily ADHD Brain Logs, Other/Folder',
        get: () => this.plugin.settings.scopeFolders.join(', '),
        set: (value) => {
          this.plugin.settings.scopeFolders = value
            .split(',')
            .map((f) => f.trim())
            .filter((f) => f.length > 0);
        },
      },
      {
        name: 'Update frontmatter modified',
        desc: 'Automatically update the modified field in frontmatter on each save',
        type: 'toggle',
        get: () => this.plugin.settings.updateFrontmatterModified,
        set: (value) => {
          this.plugin.settings.updateFrontmatterModified = value;
        },
      },
      {
        name: 'Delegate modified to Linter',
        desc: 'Let Linter plugin handle modified timestamp updates instead',
        type: 'toggle',
        get: () => this.plugin.settings.delegateModifiedToLinter,
        set: (value) => {
          this.plugin.settings.delegateModifiedToLinter = value;
        },
      },
      {
        name: 'Add type if missing',
        desc: 'Automatically add a type field to frontmatter if not present',
        type: 'toggle',
        get: () => this.plugin.settings.addTypeIfMissing,
        set: (value) => {
          this.plugin.settings.addTypeIfMissing = value;
        },
      },
      {
        name: 'Default type value',
        desc: 'The default value for the type field',
        type: 'text',
        placeholder: 'note',
        get: () => this.plugin.settings.typeValue,
        set: (value) => {
          this.plugin.settings.typeValue = value || 'note';
        },
      },
      {
        name: 'Debounce delay (ms)',
        desc: 'Minimum time between processing file modifications (prevents rapid-fire updates)',
        type: 'number',
        placeholder: '1500',
        get: () => this.plugin.settings.debounceMs.toString(),
        set: (value) => {
          const num = parseInt(value);
          if (!isNaN(num) && num >= 100) {
            this.plugin.settings.debounceMs = num;
          }
        },
      },
      {
        name: 'Preserve creation tag',
        desc: 'Ensure the creation date tag is always present in the tag list',
        type: 'toggle',
        get: () => this.plugin.settings.preserveCreationTag,
        set: (value) => {
          this.plugin.settings.preserveCreationTag = value;
        },
      },
      {
        name: 'Templater detection delay (ms)',
        desc: 'How long to wait after file creation to allow Templater to expand templates',
        type: 'number',
        placeholder: '100',
        get: () => this.plugin.settings.templaterDetectionDelay.toString(),
        set: (value) => {
          const num = parseInt(value);
          if (!isNaN(num) && num >= 0) {
            this.plugin.settings.templaterDetectionDelay = num;
          }
        },
      },
    ];

    settings.forEach((config) => {
      const setting = new Setting(containerEl)
        .setName(config.name)
        .setDesc(config.desc);

      if (config.type === 'text') {
        setting.addText((text) =>
          text
            .setPlaceholder(config.placeholder)
            .setValue(config.get())
            .onChange(async (value) => {
              config.set(value);
              await this.plugin.saveSettings();
            })
        );
      } else if (config.type === 'textarea') {
        setting.addTextArea((text) =>
          text
            .setPlaceholder(config.placeholder)
            .setValue(config.get())
            .onChange(async (value) => {
              config.set(value);
              await this.plugin.saveSettings();
            })
        );
      } else if (config.type === 'toggle') {
        setting.addToggle((toggle) =>
          toggle.setValue(config.get()).onChange(async (value) => {
            config.set(value);
            await this.plugin.saveSettings();
          })
        );
      } else if (config.type === 'number') {
        setting.addText((text) =>
          text
            .setPlaceholder(config.placeholder)
            .setValue(config.get())
            .onChange(async (value) => {
              config.set(value);
              await this.plugin.saveSettings();
            })
        );
      }
    });
  }
}

module.exports = DateTagsPlugin;
