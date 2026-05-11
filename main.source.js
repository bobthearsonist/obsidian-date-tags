// Buffer polyfill for mobile compatibility
import './buffer-polyfill.js';

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
  excludeFolders: [
    'Templates',
    'copilot-custom-prompts',
    'copilot-conversations',
  ],
  updateFrontmatterModified: true,
  delegateModifiedToLinter: false,
  addTypeIfMissing: true,
  typeValue: 'note',
  debounceMs: 3000,
  idleTimeMs: 5000,
  enableIdleUpdate: true,
  updateOnFileSwitch: true,
  updateOnEditorBlur: true,
  preserveCreationTag: true,
  templaterDetectionDelay: 300,
  enableDebugLogging: false,
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

  static parseDateInput(dateInput = new Date()) {
    if (dateInput instanceof Date) {
      if (isNaN(dateInput.getTime())) {
        throw new Error('Invalid Date object');
      }
      return dateInput;
    }

    if (typeof dateInput === 'string') {
      const compact = /^(\d{4})(\d{2})(\d{2})$/.exec(dateInput.trim());
      if (compact) {
        return DateHelper.fromLocalDateParts(Number(compact[1]), Number(compact[2]), Number(compact[3]));
      }

      const dashed = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateInput.trim());
      if (dashed) {
        return DateHelper.fromLocalDateParts(Number(dashed[1]), Number(dashed[2]), Number(dashed[3]));
      }
    }

    throw new Error('Expected date input as Date, YYYY-MM-DD, or YYYYMMDD');
  }

  static fromLocalDateParts(year, month, day) {
    const parsed = new Date(year, month - 1, day);
    if (
      parsed.getFullYear() !== year ||
      parsed.getMonth() !== month - 1 ||
      parsed.getDate() !== day
    ) {
      throw new Error('Invalid calendar date');
    }
    return parsed;
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
    // Default to 2 spaces - safest for all platforms
    // Note: app.vault.config and app.setting are not reliably available on mobile
    // Using a fixed default prevents errors during mobile vault initialization
    return 2;
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

        // Simple approach: check if file's folder path starts with or equals the template folder
        // This handles both exact matches and subfolders
        if (
          file.parent &&
          (file.parent.path === folder ||
            file.parent.path.startsWith(folder + '/'))
        ) {
          return true;
        }

        // Also check if the file path itself starts with the folder (fallback for edge cases)
        if (file.path.startsWith(folder + '/')) {
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
    await new Promise((resolve) =>
      setTimeout(resolve, this.settings.templaterDetectionDelay)
    );

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
    this.editedFiles = new Set();
    this.currentActiveFile = null;
    this.idleTimer = null;
    this.layoutReady = false;
    this.layoutReadyTime = 0;
    this._processor = null;
    this.api = {
      version: 1,
      buildDateTag: (dateInput = new Date()) =>
        DateHelper.buildDateTag(
          this.settings?.baseTag || DEFAULT_SETTINGS.baseTag,
          DateHelper.parseDateInput(dateInput)
        ),
      getBaseTag: () => this.settings?.baseTag || DEFAULT_SETTINGS.baseTag,
    };
  }

  // Lazy initialization of FileProcessor - only create after layout is ready
  get processor() {
    if (!this._processor && this.layoutReady) {
      this.debugLog('Creating FileProcessor (lazy init)');
      this._processor = new FileProcessor(this.app, this.settings);
    }
    return this._processor;
  }

  debugLog(message, data = null) {
    if (this.settings?.enableDebugLogging) {
      const timestamp = new Date().toISOString();
      const layoutStatus = this.layoutReady ? 'READY' : 'NOT_READY';
      const timeSinceReady = this.layoutReady
        ? `+${Date.now() - this.layoutReadyTime}ms`
        : 'N/A';

      console.log(
        `[DateTags ${timestamp}] [${layoutStatus}${
          timeSinceReady !== 'N/A' ? ` ${timeSinceReady}` : ''
        }] ${message}`,
        data || ''
      );
    }
  }

  async onload() {
    this.debugLog('onload() started');
    await this.loadSettings();

    this.addSettingTab(new DateTagsSettingTab(this.app, this));

    // Wait for workspace to be fully initialized before processing modifications
    // This prevents mass-tagging of files during vault initialization on mobile
    this.app.workspace.onLayoutReady(() => {
      this.layoutReady = true;
      this.layoutReadyTime = Date.now();

      // Clear any spurious entries in editedFiles that occurred during vault initialization
      // On mobile, editor-change events can fire during sync/load even though user didn't edit
      const clearedCount = this.editedFiles.size;
      this.editedFiles.clear();

      this.debugLog('onLayoutReady fired', {
        clearedEditedFiles: clearedCount,
        filesCleared: clearedCount > 0 ? Array.from(this.editedFiles) : [],
      });
    });

    // Track user edits and which files were edited
    this.registerEvent(
      this.app.workspace.on('editor-change', (editor, view) => {
        this.lastUserEdit = Date.now();
        if (view.file?.path) {
          this.editedFiles.add(view.file.path);
          this.debugLog('editor-change event', {
            file: view.file.path,
            editedFilesCount: this.editedFiles.size,
          });
        }
      })
    );

    // Track active file changes (for file switching)
    this.registerEvent(
      this.app.workspace.on('active-leaf-change', (leaf) => {
        if (this.settings.updateOnFileSwitch) {
          const newActiveFile = this.app.workspace.getActiveFile();
          const previousFile = this.currentActiveFile;

          // Update previous file if it was edited
          if (previousFile && this.editedFiles.has(previousFile.path)) {
            if (this.isFileSafeToModify(previousFile)) {
              this.processor.processUserEdit(previousFile);
              this.editedFiles.delete(previousFile.path);
            }
          }

          // Update current active file reference
          this.currentActiveFile = newActiveFile;
        }
      })
    );

    // Update when editor loses focus
    this.registerEvent(
      this.app.workspace.on('window-blur', () => {
        if (this.settings.updateOnEditorBlur) {
          this.handleEditorBlur();
        }
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

    // Optional idle timer
    if (this.settings.enableIdleUpdate) {
      this.startIdleTimer();
    }

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

    // Restart idle timer if setting changed
    if (this.idleTimer) {
      clearInterval(this.idleTimer);
      this.idleTimer = null;
    }
    if (this.settings.enableIdleUpdate) {
      this.startIdleTimer();
    }
  }

  shouldSkipFile(file) {
    if (!this.layoutReady) return true; // Bail out if not loaded yet

    if (!this.processor.isInScope(file)) {
      return true;
    }
    if (this.processor.hasTemplaterConfig(file)) {
      return true;
    }
    return false;
  }

  isFileSafeToModify(file) {
    if (!this.layoutReady) return false; // Bail out if not loaded yet

    // 1. File must be in scope
    if (!this.processor.isInScope(file)) return false;

    // 2. Don't modify if it's currently the active editor file
    const activeFile = this.app.workspace.getActiveFile();
    if (activeFile && activeFile.path === file.path) return false;

    // 3. Don't modify if user is actively typing (within idle threshold)
    const timeSinceEdit = Date.now() - this.lastUserEdit;
    if (timeSinceEdit < this.settings.idleTimeMs) return false;

    // 4. Don't modify if we're already modifying
    if (this.processor.isModifying) return false;

    return true;
  }

  startIdleTimer() {
    // Check every 2 seconds if there are files to update
    this.idleTimer = setInterval(() => {
      const timeSinceEdit = Date.now() - this.lastUserEdit;

      // Only process if user has been idle long enough
      if (timeSinceEdit >= this.settings.idleTimeMs) {
        // Process all edited files that are safe to modify
        for (const filePath of this.editedFiles) {
          const file = this.app.vault.getAbstractFileByPath(filePath);
          if (file instanceof TFile && this.isFileSafeToModify(file)) {
            this.processor.processUserEdit(file);
            this.editedFiles.delete(filePath);
          }
        }
      }
    }, 2000);

    // Clean up on unload
    this.register(() => {
      if (this.idleTimer) {
        clearInterval(this.idleTimer);
      }
    });
  }

  handleEditorBlur() {
    // Process all edited files when editor loses focus
    for (const filePath of this.editedFiles) {
      const file = this.app.vault.getAbstractFileByPath(filePath);
      if (file instanceof TFile && this.isFileSafeToModify(file)) {
        this.processor.processUserEdit(file);
        this.editedFiles.delete(filePath);
      }
    }
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
    const debugData = {
      file: file.path,
      shouldSkip: this.shouldSkipFile(file),
      isModifying: this.processor?.isModifying || false,
      layoutReady: this.layoutReady,
      inEditedFiles: this.editedFiles.has(file.path),
      timeSinceEdit: Date.now() - this.lastUserEdit,
      idleThreshold: this.settings.idleTimeMs,
    };

    if (this.shouldSkipFile(file) || this.processor?.isModifying) {
      this.debugLog(
        'handleModify: SKIPPED (shouldSkip or isModifying)',
        debugData
      );
      return;
    }

    // CRITICAL FIX FOR MOBILE: Don't process modifications until layout is ready
    // This prevents mass-tagging during vault initialization
    if (!this.layoutReady) {
      this.debugLog('handleModify: SKIPPED (layoutNotReady)', debugData);
      return;
    }

    // CRITICAL FIX: Only process files that were actually edited by the user
    // This prevents synced files, files modified by other plugins, or external
    // changes from getting today's date tag added to them
    if (!this.editedFiles.has(file.path)) {
      this.debugLog('handleModify: SKIPPED (notInEditedFiles)', debugData);
      return;
    }

    const nowTs = Date.now();
    // FIX: Changed logic - only process if user has been idle
    if (nowTs - this.lastUserEdit < this.settings.idleTimeMs) {
      this.debugLog('handleModify: SKIPPED (userNotIdle)', debugData);
      return;
    }

    const last = this.lastProcessed.get(file.path) || 0;
    if (nowTs - last < this.settings.debounceMs) {
      this.debugLog('handleModify: SKIPPED (debounce)', debugData);
      return;
    }

    this.lastProcessed.set(file.path, nowTs);

    this.debugLog('handleModify: PROCESSING', debugData);

    try {
      await this.processor.processUserEdit(file);
      // Remove from edited files after successful processing
      this.editedFiles.delete(file.path);
      this.debugLog('handleModify: SUCCESS', { file: file.path });
    } catch (error) {
      this.debugLog('handleModify: ERROR', {
        file: file.path,
        error: error.message,
      });
      console.error(
        `DateTagsPlugin: Error modifying file ${file.path}:`,
        error
      );
    }
  }

  async handleTemplaterComplete(file) {
    if (!this.layoutReady || !this.processor) return;
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
    if (!this.layoutReady || !this.processor) return;
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
        name: 'Exclude folders',
        desc: 'Comma-separated list of folder paths to exclude from processing (useful for templates, copilot files, etc.)',
        type: 'textarea',
        placeholder: 'Templates, copilot-custom-prompts, copilot-conversations',
        get: () => this.plugin.settings.excludeFolders.join(', '),
        set: (value) => {
          this.plugin.settings.excludeFolders = value
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
        placeholder: '3000',
        get: () => this.plugin.settings.debounceMs.toString(),
        set: (value) => {
          const num = parseInt(value);
          if (!isNaN(num) && num >= 100) {
            this.plugin.settings.debounceMs = num;
          }
        },
      },
      {
        name: 'Idle time before update (ms)',
        desc: 'How long user must stop typing before updates are applied',
        type: 'number',
        placeholder: '5000',
        get: () => this.plugin.settings.idleTimeMs.toString(),
        set: (value) => {
          const num = parseInt(value);
          if (!isNaN(num) && num >= 1000) {
            this.plugin.settings.idleTimeMs = num;
          }
        },
      },
      {
        name: 'Enable idle updates',
        desc: 'Automatically update files after idle time expires',
        type: 'toggle',
        get: () => this.plugin.settings.enableIdleUpdate,
        set: (value) => {
          this.plugin.settings.enableIdleUpdate = value;
        },
      },
      {
        name: 'Update on file switch',
        desc: 'Update file when switching to a different note',
        type: 'toggle',
        get: () => this.plugin.settings.updateOnFileSwitch,
        set: (value) => {
          this.plugin.settings.updateOnFileSwitch = value;
        },
      },
      {
        name: 'Update on editor blur',
        desc: 'Update file when editor loses focus (clicking outside Obsidian)',
        type: 'toggle',
        get: () => this.plugin.settings.updateOnEditorBlur,
        set: (value) => {
          this.plugin.settings.updateOnEditorBlur = value;
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
