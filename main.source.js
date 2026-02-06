// Buffer polyfill for mobile compatibility
import './buffer-polyfill.js';

const {
  Plugin,
  PluginSettingTab,
  Setting,
  TFile,
  Notice,
  normalizePath,
} = require('obsidian');

const DEFAULT_SETTINGS = {
  baseTag: 'date',
  scopeFolders: [],
  excludeFolders: ['Templates'],
  updateFrontmatterModified: true,
  delegateModifiedToLinter: false,
  addTypeIfMissing: true,
  typeValue: 'note',
  debounceMs: 1500,
  preserveCreationTag: true,
  templaterDetectionDelay: 300,
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

// Class for handling frontmatter operations using FileManager
class FrontmatterManager {
  constructor(settings, app) {
    this.settings = settings;
    this.app = app;
  }

  async ensureFrontmatter(file, timestamp) {
    await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
      // Ensure required fields exist
      if (!frontmatter.created) {
        frontmatter.created = timestamp;
      }
      if (!frontmatter.modified) {
        frontmatter.modified = timestamp;
      }
      if (this.settings.addTypeIfMissing && !frontmatter.type) {
        frontmatter.type = this.settings.typeValue;
      }
    });
  }

  async updateModified(file, timestamp) {
    await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
      frontmatter.modified = timestamp;
    });
  }

  async addTag(file, tag) {
    await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
      // Initialize tags array if it doesn't exist
      if (!frontmatter.tags) {
        frontmatter.tags = [];
      }

      // Ensure tags is an array (handle various formats)
      if (!Array.isArray(frontmatter.tags)) {
        if (typeof frontmatter.tags === 'string') {
          frontmatter.tags = [frontmatter.tags];
        } else {
          frontmatter.tags = [];
        }
      }

      // Add tag if not already present
      if (!frontmatter.tags.includes(tag)) {
        frontmatter.tags.push(tag);
      }
    });
  }

  async ensureTagAtStart(file, tag) {
    await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
      // Initialize tags array if it doesn't exist
      if (!frontmatter.tags) {
        frontmatter.tags = [];
      }

      // Ensure tags is an array (handle various formats)
      if (!Array.isArray(frontmatter.tags)) {
        if (typeof frontmatter.tags === 'string') {
          frontmatter.tags = [frontmatter.tags];
        } else {
          frontmatter.tags = [];
        }
      }

      // Remove tag if it exists elsewhere and add at start
      const existingIndex = frontmatter.tags.indexOf(tag);
      if (existingIndex > -1) {
        frontmatter.tags.splice(existingIndex, 1);
      }
      frontmatter.tags.unshift(tag);
    });
  }

  async getFrontmatter(file) {
    let frontmatterData = null;
    await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
      frontmatterData = { ...frontmatter };
    });
    return frontmatterData;
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

  isInScope(file) {
    if (!file || !(file instanceof TFile) || file.extension !== 'md') {
      return false;
    }

    // Check if file is in an excluded folder
    if (this.settings.excludeFolders.length > 0) {
      const isExcluded = this.settings.excludeFolders.some((folder) =>
        file.path.startsWith(folder.trim())
      );
      if (isExcluded) {
        return false;
      }
    }

    // Check if file is in scope folders (if specified)
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
        if (!folder || !template) continue;

        // Normalize folder path for comparison
        const normalizedFolder = normalizePath(folder);
        const normalizedFilePath = normalizePath(file.path);

        // Check if file is in this folder or any subfolder
        // Match patterns:
        // - "0 Daily ADHD Brain Logs/file.md" with folder "0 Daily ADHD Brain Logs"
        // - "parent/0 Daily ADHD Brain Logs/file.md" with folder "0 Daily ADHD Brain Logs"
        if (
          normalizedFilePath.startsWith(normalizedFolder + '/') ||
          normalizedFilePath.includes('/' + normalizedFolder + '/')
        ) {
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

    this.isModifying = true;
    try {
      await this.frontmatterMgr.ensureFrontmatter(file, timestamp);
      await this.frontmatterMgr.addTag(file, todayTag);
    } catch (error) {
      this.showError(`Failed to process new file: ${error.message}`, file.path);
    } finally {
      this.isModifying = false;
    }
  }

  async processUserEdit(file) {
    const timestamp = DateHelper.formatTimestamp();
    const todayTag = DateHelper.buildDateTag(this.settings.baseTag);

    this.isModifying = true;
    try {
      // Update modified timestamp if not delegated
      if (
        this.settings.updateFrontmatterModified &&
        !this.settings.delegateModifiedToLinter
      ) {
        await this.frontmatterMgr.updateModified(file, timestamp);
      }

      // Preserve creation tag
      if (this.settings.preserveCreationTag) {
        const frontmatterData = await this.frontmatterMgr.getFrontmatter(file);
        const createdDate = DateHelper.parseCreatedDate(frontmatterData);
        if (createdDate) {
          const creationTag = DateHelper.buildDateTag(
            this.settings.baseTag,
            createdDate
          );
          await this.frontmatterMgr.ensureTagAtStart(file, creationTag);
        }
      }

      // Add today's tag
      const frontmatterData = await this.frontmatterMgr.getFrontmatter(file);
      const currentTags = Array.isArray(frontmatterData.tags)
        ? frontmatterData.tags
        : [];
      if (!currentTags.includes(todayTag)) {
        await this.frontmatterMgr.addTag(file, todayTag);
      }
    } catch (error) {
      this.showError(
        `Failed to process file edit: ${error.message}`,
        file.path
      );
    } finally {
      this.isModifying = false;
    }
  }

  async processTemplaterComplete(file) {
    await new Promise((resolve) =>
      setTimeout(resolve, this.settings.templaterDetectionDelay)
    );

    const todayTag = DateHelper.buildDateTag(this.settings.baseTag);

    this.isModifying = true;
    try {
      const frontmatterData = await this.frontmatterMgr.getFrontmatter(file);
      const currentTags = Array.isArray(frontmatterData.tags)
        ? frontmatterData.tags
        : [];
      if (!currentTags.includes(todayTag)) {
        await this.frontmatterMgr.addTag(file, todayTag);
      }

      if (this.settings.preserveCreationTag) {
        const createdDate = DateHelper.parseCreatedDate(frontmatterData);
        if (createdDate) {
          const creationTag = DateHelper.buildDateTag(
            this.settings.baseTag,
            createdDate
          );
          await this.frontmatterMgr.ensureTagAtStart(file, creationTag);
        }
      }
    } catch (error) {
      this.showError(
        `Failed to process Templater completion: ${error.message}`,
        file.path
      );
    } finally {
      this.isModifying = false;
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
      name: "Add today's date tag",
      checkCallback: (checking) => {
        const activeFile = this.app.workspace.getActiveFile();
        if (activeFile && this.processor.isInScope(activeFile)) {
          if (!checking) {
            this.addTodayTagToActiveFile();
          }
          return true;
        }
        return false;
      },
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

  shouldSkipFile(file) {
    if (!this.processor.isInScope(file)) {
      return true;
    }
    if (this.processor.hasTemplaterConfig(file)) {
      return true;
    }
    return false;
  }

  async handleCreate(file) {
    if (this.shouldSkipFile(file)) {
      return;
    }

    try {
      await this.processor.processNewFile(file);
    } catch (error) {
      console.error(`DateTagsPlugin: Error creating file ${file.path}:`, error);
    }
  }

  async handleModify(file) {
    if (this.shouldSkipFile(file) || this.processor.isModifying) {
      return;
    }

    const nowTs = Date.now();
    if (nowTs - this.lastUserEdit > 3000) return;

    const last = this.lastProcessed.get(file.path) || 0;
    if (nowTs - last < this.settings.debounceMs) return;

    this.lastProcessed.set(file.path, nowTs);

    try {
      await this.processor.processUserEdit(file);
    } catch (error) {
      console.error(
        `DateTagsPlugin: Error modifying file ${file.path}:`,
        error
      );
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
      await this.processor.frontmatterMgr.addTag(activeFile, todayTag);
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

    // Base tag setting
    new Setting(containerEl)
      .setName('Base tag')
      .setDesc('The prefix for date tags (e.g., "date" creates #date/YYYY/MM/DD)')
      .addText((text) =>
        text
          .setPlaceholder('date')
          .setValue(this.plugin.settings.baseTag)
          .onChange(async (value) => {
            this.plugin.settings.baseTag = value || 'date';
            await this.plugin.saveSettings();
          })
      );

    // Scope folders setting
    new Setting(containerEl)
      .setName('Scope folders')
      .setDesc('Comma-separated list of folder paths to monitor (leave empty for entire vault)')
      .addTextArea((text) =>
        text
          .setPlaceholder('Test/0 Daily ADHD Brain Logs, Other/Folder')
          .setValue(this.plugin.settings.scopeFolders.join(', '))
          .onChange(async (value) => {
            this.plugin.settings.scopeFolders = value
              .split(',')
              .map((f) => f.trim())
              .filter((f) => f.length > 0);
            await this.plugin.saveSettings();
          })
      );

    // Exclude folders setting
    new Setting(containerEl)
      .setName('Exclude folders')
      .setDesc('Comma-separated list of folder paths to exclude from processing (useful for templates, copilot files, etc.)')
      .addTextArea((text) =>
        text
          .setPlaceholder('Templates, copilot-custom-prompts, copilot-conversations')
          .setValue(this.plugin.settings.excludeFolders.join(', '))
          .onChange(async (value) => {
            this.plugin.settings.excludeFolders = value
              .split(',')
              .map((f) => f.trim())
              .filter((f) => f.length > 0);
            await this.plugin.saveSettings();
          })
      );

    // Update frontmatter modified setting
    new Setting(containerEl)
      .setName('Update frontmatter modified')
      .setDesc('Automatically update the modified field in frontmatter on each save')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.updateFrontmatterModified)
          .onChange(async (value) => {
            this.plugin.settings.updateFrontmatterModified = value;
            await this.plugin.saveSettings();
            // Re-run display function to show/hide related settings
            this.display();
          })
      );

    // Delegate modified to Linter setting (only show when updateFrontmatterModified is true)
    if (this.plugin.settings.updateFrontmatterModified) {
      new Setting(containerEl)
        .setName('Delegate modified to Linter')
        .setDesc('Let Linter plugin handle modified timestamp updates instead')
        .addToggle((toggle) =>
          toggle
            .setValue(this.plugin.settings.delegateModifiedToLinter)
            .onChange(async (value) => {
              this.plugin.settings.delegateModifiedToLinter = value;
              await this.plugin.saveSettings();
            })
        );
    }

    // Add type if missing setting
    new Setting(containerEl)
      .setName('Add type if missing')
      .setDesc('Automatically add a type field to frontmatter if not present')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.addTypeIfMissing)
          .onChange(async (value) => {
            this.plugin.settings.addTypeIfMissing = value;
            await this.plugin.saveSettings();
            // Re-run display function to show/hide related settings
            this.display();
          })
      );

    // Default type value setting (only show when addTypeIfMissing is true)
    if (this.plugin.settings.addTypeIfMissing) {
      new Setting(containerEl)
        .setName('Default type value')
        .setDesc('The default value for the type field')
        .addText((text) =>
          text
            .setPlaceholder('note')
            .setValue(this.plugin.settings.typeValue)
            .onChange(async (value) => {
              this.plugin.settings.typeValue = value || 'note';
              await this.plugin.saveSettings();
            })
        );
    }

    // Debounce delay setting
    new Setting(containerEl)
      .setName('Debounce delay (ms)')
      .setDesc('Minimum time between processing file modifications (prevents rapid-fire updates)')
      .addText((text) =>
        text
          .setPlaceholder('1500')
          .setValue(this.plugin.settings.debounceMs.toString())
          .onChange(async (value) => {
            const num = parseInt(value);
            if (!isNaN(num) && num >= 100) {
              this.plugin.settings.debounceMs = num;
            }
            await this.plugin.saveSettings();
          })
      );

    // Preserve creation tag setting
    new Setting(containerEl)
      .setName('Preserve creation tag')
      .setDesc('Ensure the creation date tag is always present in the tag list')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.preserveCreationTag)
          .onChange(async (value) => {
            this.plugin.settings.preserveCreationTag = value;
            await this.plugin.saveSettings();
          })
      );

    // Templater detection delay setting
    new Setting(containerEl)
      .setName('Templater detection delay (ms)')
      .setDesc('How long to wait after file creation to allow Templater to expand templates')
      .addText((text) =>
        text
          .setPlaceholder('100')
          .setValue(this.plugin.settings.templaterDetectionDelay.toString())
          .onChange(async (value) => {
            const num = parseInt(value);
            if (!isNaN(num) && num >= 0) {
              this.plugin.settings.templaterDetectionDelay = num;
            }
            await this.plugin.saveSettings();
          })
      );
  }
}

module.exports = DateTagsPlugin;
