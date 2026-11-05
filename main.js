var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};

// date-helper.js
var require_date_helper = __commonJS({
  "date-helper.js"(exports2, module2) {
    var DateHelper2 = class _DateHelper {
      static formatTimestamp() {
        const now = /* @__PURE__ */ new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
          2,
          "0"
        )}-${String(now.getDate()).padStart(2, "0")} ${String(
          now.getHours()
        ).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(
          now.getSeconds()
        ).padStart(2, "0")}`;
      }
      static buildDateTag(baseTag, date = /* @__PURE__ */ new Date()) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${baseTag}/${year}/${month}/${day}`;
      }
      static parseDateInput(dateInput = /* @__PURE__ */ new Date()) {
        if (dateInput instanceof Date) {
          if (isNaN(dateInput.getTime())) {
            throw new Error("Invalid Date object");
          }
          return dateInput;
        }
        if (typeof dateInput === "string") {
          const compact = /^(\d{4})(\d{2})(\d{2})$/.exec(dateInput.trim());
          if (compact) {
            return _DateHelper.fromLocalDateParts(Number(compact[1]), Number(compact[2]), Number(compact[3]));
          }
          const dashed = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateInput.trim());
          if (dashed) {
            return _DateHelper.fromLocalDateParts(Number(dashed[1]), Number(dashed[2]), Number(dashed[3]));
          }
        }
        throw new Error("Expected date input as Date, YYYY-MM-DD, or YYYYMMDD");
      }
      static fromLocalDateParts(year, month, day) {
        const parsed = new Date(year, month - 1, day);
        if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) {
          throw new Error("Invalid calendar date");
        }
        return parsed;
      }
      static parseCreatedDate(frontmatterData) {
        const created = frontmatterData.created;
        if (!created)
          return null;
        if (typeof created === "string") {
          const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(created.trim());
          if (dateOnly) {
            try {
              return _DateHelper.fromLocalDateParts(
                Number(dateOnly[1]),
                Number(dateOnly[2]),
                Number(dateOnly[3])
              );
            } catch {
              return null;
            }
          }
        }
        const date = new Date(created);
        return isNaN(date.getTime()) ? null : date;
      }
    };
    module2.exports = DateHelper2;
  }
});

// frontmatter-manager.js
var require_frontmatter_manager = __commonJS({
  "frontmatter-manager.js"(exports2, module2) {
    var FrontmatterManager2 = class {
      constructor(settings, app) {
        this.settings = settings;
        this.app = app;
      }
      process(file, updateFrontmatter) {
        return this.app.fileManager.processFrontMatter(file, updateFrontmatter);
      }
      ensureFrontmatter(frontmatter, timestamp) {
        if (!frontmatter.created) {
          frontmatter.created = timestamp;
        }
        if (!frontmatter.modified) {
          frontmatter.modified = timestamp;
        }
        if (this.settings.addTypeIfMissing && !frontmatter.type) {
          frontmatter.type = this.settings.typeValue;
        }
      }
      updateModified(frontmatter, timestamp) {
        frontmatter.modified = timestamp;
      }
      addTag(frontmatter, tag) {
        this.normalizeTags(frontmatter);
        if (!frontmatter.tags.includes(tag)) {
          frontmatter.tags.push(tag);
        }
      }
      ensureTagAtStart(frontmatter, tag) {
        this.normalizeTags(frontmatter);
        const existingIndex = frontmatter.tags.indexOf(tag);
        if (existingIndex > -1) {
          frontmatter.tags.splice(existingIndex, 1);
        }
        frontmatter.tags.unshift(tag);
      }
      normalizeTags(frontmatter) {
        if (!frontmatter.tags) {
          frontmatter.tags = [];
        } else if (typeof frontmatter.tags === "string") {
          frontmatter.tags = [frontmatter.tags];
        } else if (!Array.isArray(frontmatter.tags)) {
          frontmatter.tags = [];
        }
      }
    };
    module2.exports = FrontmatterManager2;
  }
});

// templater-compat.js
var require_templater_compat = __commonJS({
  "templater-compat.js"(exports2, module2) {
    function pathIsInFolder(file, folder) {
      const normalizedFolder = String(folder || "").replace(/\/+$/, "");
      if (!normalizedFolder)
        return false;
      return file.parent?.path === normalizedFolder || file.parent?.path?.startsWith(`${normalizedFolder}/`) || file.path?.startsWith(`${normalizedFolder}/`);
    }
    function getCreationTriggerState(templater) {
      const getControlValue = templater?.settingTab?.getControlValue;
      if (typeof getControlValue !== "function")
        return null;
      try {
        const value = getControlValue.call(
          templater.settingTab,
          "trigger_on_file_creation"
        );
        return typeof value === "boolean" ? value : null;
      } catch (error) {
        console.warn(
          "DateTagsPlugin: Unable to read Templater creation trigger state:",
          error
        );
        return null;
      }
    }
    function matchesTemplaterCreationRule2(templater, file) {
      if (!templater?.settings || !file?.path)
        return false;
      const settings = templater.settings;
      if (getCreationTriggerState(templater) === false)
        return false;
      const isIgnored = (settings.ignore_folders_on_creation || []).some(
        (entry) => pathIsInFolder(file, typeof entry === "string" ? entry : entry?.folder)
      );
      if (isIgnored)
        return false;
      const mode = settings.trigger_on_file_creation_mode;
      const folderMode = mode === "folder" || mode == null && settings.enable_folder_templates === true;
      const regexMode = mode === "regex" || mode == null && settings.enable_file_templates === true;
      if (folderMode) {
        for (const { folder, template } of settings.folder_templates || []) {
          if (folder && template && pathIsInFolder(file, folder)) {
            return true;
          }
        }
      }
      if (regexMode) {
        for (const { regex, template } of settings.file_templates || []) {
          if (!regex || !template)
            continue;
          try {
            if (new RegExp(regex).test(file.path))
              return true;
          } catch (error) {
            console.error(
              "DateTagsPlugin: Invalid regex in Templater file_templates:",
              error
            );
          }
        }
      }
      return false;
    }
    function resolveTemplaterEventFile2(payload) {
      if (!payload || typeof payload !== "object")
        return null;
      if (typeof payload.path === "string")
        return payload;
      return payload.file || payload.view?.file || payload.editor?.file || null;
    }
    module2.exports = {
      matchesTemplaterCreationRule: matchesTemplaterCreationRule2,
      resolveTemplaterEventFile: resolveTemplaterEventFile2
    };
  }
});

// cli-edit-tracker.js
var require_cli_edit_tracker = __commonJS({
  "cli-edit-tracker.js"(exports2, module2) {
    function createCliEditTracker2({ target, onCommandSettled, isEnabled }) {
      const collectors = /* @__PURE__ */ new Set();
      let original = null;
      let wrapper = null;
      function install() {
        if (wrapper || typeof target?.handleCli !== "function")
          return false;
        original = target.handleCli;
        const inner = original;
        wrapper = async function(args, ...rest) {
          if (!isActive())
            return inner.apply(this, [args, ...rest]);
          const files = /* @__PURE__ */ new Set();
          collectors.add(files);
          let result;
          try {
            result = await inner.apply(this, [args, ...rest]);
          } finally {
            collectors.delete(files);
            if (files.size > 0 && isActive()) {
              const command = Array.isArray(args) ? args[0] : void 0;
              try {
                await onCommandSettled([...files], command);
              } catch (error) {
                console.error("DateTagsPlugin: Failed to tag CLI edits:", error);
              }
            }
          }
          return result;
        };
        target.handleCli = wrapper;
        return true;
      }
      function isActive() {
        return original !== null && (typeof isEnabled !== "function" || isEnabled());
      }
      function uninstall() {
        if (!wrapper)
          return;
        if (target.handleCli === wrapper)
          target.handleCli = original;
        original = null;
        wrapper = null;
        collectors.clear();
      }
      function noteModified(path) {
        if (!path)
          return false;
        for (const files of collectors)
          files.add(path);
        return collectors.size > 0;
      }
      return {
        install,
        uninstall,
        noteModified,
        get isCliCommandRunning() {
          return collectors.size > 0;
        }
      };
    }
    module2.exports = { createCliEditTracker: createCliEditTracker2 };
  }
});

// main.source.js
var {
  Plugin,
  PluginSettingTab,
  Setting,
  TFile,
  Notice
} = require("obsidian");
var DateHelper = require_date_helper();
var FrontmatterManager = require_frontmatter_manager();
var {
  matchesTemplaterCreationRule,
  resolveTemplaterEventFile
} = require_templater_compat();
var { createCliEditTracker } = require_cli_edit_tracker();
var DEFAULT_SETTINGS = {
  baseTag: "date",
  scopeFolders: [],
  excludeFolders: [
    "Templates",
    "copilot-custom-prompts",
    "copilot-conversations"
  ],
  updateFrontmatterModified: true,
  delegateModifiedToLinter: false,
  addTypeIfMissing: true,
  typeValue: "note",
  debounceMs: 3e3,
  idleTimeMs: 5e3,
  enableIdleUpdate: true,
  updateOnFileSwitch: true,
  updateOnEditorBlur: true,
  preserveCreationTag: true,
  tagCliEdits: true,
  templaterDetectionDelay: 300,
  enableDebugLogging: false
};
var FileProcessor = class {
  constructor(app, settings) {
    this.app = app;
    this.settings = settings;
    this.frontmatterMgr = new FrontmatterManager(settings, app);
    this.isModifying = false;
  }
  showError(message, filePath) {
    const fullMessage = filePath ? `DateTagsPlugin: ${message} (File: ${filePath})` : `DateTagsPlugin: ${message}`;
    new Notice(fullMessage, 8e3);
    console.error(fullMessage);
  }
  async safeUpdate(file, updateFrontmatter) {
    this.isModifying = true;
    try {
      await this.frontmatterMgr.process(file, updateFrontmatter);
      return true;
    } finally {
      this.isModifying = false;
    }
  }
  isInScope(file) {
    if (!file || !(file instanceof TFile) || file.extension !== "md") {
      return false;
    }
    if (this.settings.excludeFolders.length > 0) {
      const isExcluded = this.settings.excludeFolders.some(
        (folder) => file.path.startsWith(folder.trim())
      );
      if (isExcluded) {
        return false;
      }
    }
    if (this.settings.scopeFolders.length === 0)
      return true;
    return this.settings.scopeFolders.some(
      (folder) => file.path.startsWith(folder.trim())
    );
  }
  hasTemplaterConfig(file) {
    const templater = this.app.plugins.plugins["templater-obsidian"];
    return matchesTemplaterCreationRule(templater, file);
  }
  async processNewFile(file) {
    const timestamp = DateHelper.formatTimestamp();
    const todayTag = DateHelper.buildDateTag(this.settings.baseTag);
    try {
      await this.safeUpdate(file, (frontmatter) => {
        this.frontmatterMgr.ensureFrontmatter(frontmatter, timestamp);
        this.frontmatterMgr.addTag(frontmatter, todayTag);
      });
      return true;
    } catch (error) {
      this.showError(`Failed to process new file: ${error.message}`, file.path);
      return false;
    }
  }
  async processUserEdit(file) {
    const timestamp = DateHelper.formatTimestamp();
    const todayTag = DateHelper.buildDateTag(this.settings.baseTag);
    try {
      await this.safeUpdate(file, (frontmatter) => {
        if (this.settings.updateFrontmatterModified && !this.settings.delegateModifiedToLinter) {
          this.frontmatterMgr.updateModified(frontmatter, timestamp);
        }
        if (this.settings.preserveCreationTag) {
          const createdDate = DateHelper.parseCreatedDate(frontmatter);
          if (createdDate) {
            const creationTag = DateHelper.buildDateTag(
              this.settings.baseTag,
              createdDate
            );
            this.frontmatterMgr.ensureTagAtStart(frontmatter, creationTag);
          }
        }
        this.frontmatterMgr.addTag(frontmatter, todayTag);
      });
      return true;
    } catch (error) {
      this.showError(
        `Failed to process file edit: ${error.message}`,
        file.path
      );
      return false;
    }
  }
  async processTemplaterComplete(file) {
    await new Promise(
      (resolve) => setTimeout(resolve, this.settings.templaterDetectionDelay)
    );
    const todayTag = DateHelper.buildDateTag(this.settings.baseTag);
    try {
      await this.safeUpdate(file, (frontmatter) => {
        this.frontmatterMgr.addTag(frontmatter, todayTag);
        if (this.settings.preserveCreationTag) {
          const createdDate = DateHelper.parseCreatedDate(frontmatter);
          if (createdDate) {
            const creationTag = DateHelper.buildDateTag(
              this.settings.baseTag,
              createdDate
            );
            this.frontmatterMgr.ensureTagAtStart(frontmatter, creationTag);
          }
        }
      });
      return true;
    } catch (error) {
      this.showError(
        `Failed to process Templater completion: ${error.message}`,
        file.path
      );
      return false;
    }
  }
};
var DateTagsPlugin = class extends Plugin {
  constructor() {
    super(...arguments);
    this.lastProcessed = /* @__PURE__ */ new Map();
    this.lastUserEdit = 0;
    this.editedFiles = /* @__PURE__ */ new Set();
    this.currentActiveFile = null;
    this.idleTimer = null;
    this.layoutReady = false;
    this.layoutReadyTime = 0;
    this._processor = null;
    this.processingFiles = /* @__PURE__ */ new Set();
    this.api = {
      version: 1,
      buildDateTag: (dateInput = /* @__PURE__ */ new Date()) => DateHelper.buildDateTag(
        this.settings?.baseTag || DEFAULT_SETTINGS.baseTag,
        DateHelper.parseDateInput(dateInput)
      ),
      getBaseTag: () => this.settings?.baseTag || DEFAULT_SETTINGS.baseTag
    };
  }
  // Lazy initialization of FileProcessor - only create after layout is ready
  get processor() {
    if (!this._processor && this.layoutReady) {
      this.debugLog("Creating FileProcessor (lazy init)");
      this._processor = new FileProcessor(this.app, this.settings);
    }
    return this._processor;
  }
  debugLog(message, data = null) {
    if (this.settings?.enableDebugLogging) {
      const timestamp = (/* @__PURE__ */ new Date()).toISOString();
      const layoutStatus = this.layoutReady ? "READY" : "NOT_READY";
      const timeSinceReady = this.layoutReady ? `+${Date.now() - this.layoutReadyTime}ms` : "N/A";
      console.log(
        `[DateTags ${timestamp}] [${layoutStatus}${timeSinceReady !== "N/A" ? ` ${timeSinceReady}` : ""}] ${message}`,
        data || ""
      );
    }
  }
  async onload() {
    this.debugLog("onload() started");
    await this.loadSettings();
    this.addSettingTab(new DateTagsSettingTab(this.app, this));
    this.app.workspace.onLayoutReady(() => {
      this.layoutReady = true;
      this.layoutReadyTime = Date.now();
      const clearedCount = this.editedFiles.size;
      this.editedFiles.clear();
      this.debugLog("onLayoutReady fired", {
        clearedEditedFiles: clearedCount,
        filesCleared: clearedCount > 0 ? Array.from(this.editedFiles) : []
      });
      this.cliTracker = createCliEditTracker({
        target: window,
        isEnabled: () => this.settings.tagCliEdits,
        onCommandSettled: (paths, command) => this.processCliEdits(paths, command)
      });
      if (this.cliTracker.install()) {
        this.register(() => this.cliTracker?.uninstall());
      }
    });
    this.registerEvent(
      this.app.workspace.on("editor-change", (editor, view) => {
        this.lastUserEdit = Date.now();
        if (view.file?.path) {
          this.editedFiles.add(view.file.path);
          this.debugLog("editor-change event", {
            file: view.file.path,
            editedFilesCount: this.editedFiles.size
          });
        }
      })
    );
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", async (leaf) => {
        if (this.settings.updateOnFileSwitch) {
          const newActiveFile = this.app.workspace.getActiveFile();
          const previousFile = this.currentActiveFile;
          if (previousFile && this.editedFiles.has(previousFile.path)) {
            if (this.isFileSafeToModify(previousFile)) {
              await this.processTrackedUserEdit(previousFile, "active-leaf-change");
            }
          }
          this.currentActiveFile = newActiveFile;
        }
      })
    );
    this.registerEvent(
      this.app.workspace.on("window-blur", () => {
        if (this.settings.updateOnEditorBlur) {
          this.handleEditorBlur();
        }
      })
    );
    this.registerEvent(
      this.app.vault.on("create", (file) => this.handleCreate(file))
    );
    this.registerEvent(
      this.app.vault.on("modify", (file) => this.handleModify(file))
    );
    const templaterEvents = [
      "templater:new-note-from-template",
      "templater:template-appended",
      "templater:overwrite-file",
      "templater:all-templates-executed"
    ];
    templaterEvents.forEach((eventName) => {
      this.registerEvent(
        this.app.workspace.on(
          eventName,
          (payload) => this.handleTemplaterComplete(resolveTemplaterEventFile(payload))
        )
      );
    });
    if (this.settings.enableIdleUpdate) {
      this.startIdleTimer();
    }
    this.addCommand({
      id: "add-today-date-tag",
      name: "Add today's date tag",
      checkCallback: (checking) => {
        const activeFile = this.app.workspace.getActiveFile();
        if (!this.layoutReady || !this.processor?.isInScope(activeFile)) {
          return false;
        }
        if (!checking) {
          this.addTodayTagToActiveFile();
        }
        return true;
      }
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
    if (this.idleTimer) {
      clearInterval(this.idleTimer);
      this.idleTimer = null;
    }
    if (this.settings.enableIdleUpdate) {
      this.startIdleTimer();
    }
  }
  shouldSkipFile(file) {
    if (!this.layoutReady)
      return true;
    if (!this.processor.isInScope(file)) {
      return true;
    }
    if (this.processor.hasTemplaterConfig(file)) {
      return true;
    }
    return false;
  }
  isFileSafeToModify(file) {
    if (!this.layoutReady)
      return false;
    if (!this.processor.isInScope(file))
      return false;
    const activeFile = this.app.workspace.getActiveFile();
    if (activeFile && activeFile.path === file.path)
      return false;
    const timeSinceEdit = Date.now() - this.lastUserEdit;
    if (timeSinceEdit < this.settings.idleTimeMs)
      return false;
    if (this.processor.isModifying)
      return false;
    return true;
  }
  startIdleTimer() {
    this.idleTimer = setInterval(async () => {
      const timeSinceEdit = Date.now() - this.lastUserEdit;
      if (timeSinceEdit >= this.settings.idleTimeMs) {
        for (const filePath of this.editedFiles) {
          const file = this.app.vault.getAbstractFileByPath(filePath);
          if (file instanceof TFile && this.isFileSafeToModify(file)) {
            await this.processTrackedUserEdit(file, "idle-timer");
          }
        }
      }
    }, 2e3);
    this.register(() => {
      if (this.idleTimer) {
        clearInterval(this.idleTimer);
      }
    });
  }
  async handleEditorBlur() {
    for (const filePath of this.editedFiles) {
      const file = this.app.vault.getAbstractFileByPath(filePath);
      if (file instanceof TFile && this.isFileSafeToModify(file)) {
        await this.processTrackedUserEdit(file, "window-blur");
      }
    }
  }
  async handleCreate(file) {
    if (this.shouldSkipFile(file)) {
      return;
    }
    if (this.processingFiles.has(file.path)) {
      this.debugLog("handleCreate: SKIPPED (already processing)", {
        file: file.path
      });
      return;
    }
    this.processingFiles.add(file.path);
    try {
      await this.processor.processNewFile(file);
    } catch (error) {
      console.error(`DateTagsPlugin: Error creating file ${file.path}:`, error);
    } finally {
      this.processingFiles.delete(file.path);
    }
  }
  async handleModify(file) {
    if (this.layoutReady && !this.processor?.isModifying && this.cliTracker?.noteModified(file.path)) {
      this.debugLog("handleModify: DEFERRED (CLI command)", { file: file.path });
      return;
    }
    const debugData = {
      file: file.path,
      shouldSkip: this.shouldSkipFile(file),
      isModifying: this.processor?.isModifying || false,
      layoutReady: this.layoutReady,
      inEditedFiles: this.editedFiles.has(file.path),
      isProcessingFile: this.processingFiles.has(file.path),
      timeSinceEdit: Date.now() - this.lastUserEdit,
      idleThreshold: this.settings.idleTimeMs
    };
    if (this.shouldSkipFile(file) || this.processor?.isModifying) {
      this.debugLog(
        "handleModify: SKIPPED (shouldSkip or isModifying)",
        debugData
      );
      return;
    }
    if (!this.layoutReady) {
      this.debugLog("handleModify: SKIPPED (layoutNotReady)", debugData);
      return;
    }
    if (!this.editedFiles.has(file.path)) {
      this.debugLog("handleModify: SKIPPED (notInEditedFiles)", debugData);
      return;
    }
    const nowTs = Date.now();
    if (nowTs - this.lastUserEdit < this.settings.idleTimeMs) {
      this.debugLog("handleModify: SKIPPED (userNotIdle)", debugData);
      return;
    }
    const last = this.lastProcessed.get(file.path) || 0;
    if (nowTs - last < this.settings.debounceMs) {
      this.debugLog("handleModify: SKIPPED (debounce)", debugData);
      return;
    }
    this.debugLog("handleModify: PROCESSING", debugData);
    await this.processTrackedUserEdit(file, "modify");
  }
  async processTrackedUserEdit(file, source) {
    if (!this.layoutReady || !this.processor)
      return false;
    if (this.processingFiles.has(file.path) || this.processor.isModifying) {
      this.debugLog("processTrackedUserEdit: SKIPPED (already processing)", {
        file: file.path,
        source
      });
      return false;
    }
    this.processingFiles.add(file.path);
    try {
      const success = await this.processor.processUserEdit(file);
      if (success) {
        this.editedFiles.delete(file.path);
        this.lastProcessed.set(file.path, Date.now());
        this.debugLog("processTrackedUserEdit: SUCCESS", {
          file: file.path,
          source
        });
      }
      return success;
    } catch (error) {
      this.debugLog("processTrackedUserEdit: ERROR", {
        file: file.path,
        source,
        error: error.message
      });
      console.error(
        `DateTagsPlugin: Error modifying file ${file.path}:`,
        error
      );
      return false;
    } finally {
      this.processingFiles.delete(file.path);
    }
  }
  async processCliEdits(paths, command) {
    if (!this.layoutReady || !this.processor)
      return;
    for (const path of paths) {
      const file = this.app.vault.getAbstractFileByPath(path);
      if (!(file instanceof TFile) || !this.processor.isInScope(file))
        continue;
      const activeFile = this.app.workspace.getActiveFile();
      const userTyping = activeFile?.path === file.path && Date.now() - this.lastUserEdit < this.settings.idleTimeMs;
      const done = !userTyping && await this.processTrackedUserEdit(file, `cli:${command}`);
      if (!done)
        this.editedFiles.add(file.path);
    }
  }
  async handleTemplaterComplete(file) {
    if (!this.layoutReady || !this.processor)
      return;
    if (!this.processor.isInScope(file))
      return;
    try {
      await this.processor.processTemplaterComplete(file);
    } catch (error) {
      console.error(
        "DateTagsPlugin: Error handling Templater completion:",
        error
      );
    }
  }
  async addTodayTagToActiveFile() {
    const activeFile = this.app.workspace.getActiveFile();
    if (!this.layoutReady || !this.processor)
      return;
    if (!activeFile || !this.processor.isInScope(activeFile))
      return;
    try {
      const todayTag = DateHelper.buildDateTag(this.settings.baseTag);
      await this.processor.safeUpdate(activeFile, (frontmatter) => {
        this.processor.frontmatterMgr.addTag(frontmatter, todayTag);
      });
    } catch (error) {
      this.processor.showError(
        `Failed to add today's tag manually: ${error.message}`,
        activeFile.path
      );
    }
  }
};
var DateTagsSettingTab = class extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    const settings = [
      {
        name: "Base tag",
        desc: 'The prefix for date tags (e.g., "date" creates #date/YYYY/MM/DD)',
        type: "text",
        placeholder: "date",
        get: () => this.plugin.settings.baseTag,
        set: (value) => {
          this.plugin.settings.baseTag = value || "date";
        }
      },
      {
        name: "Scope folders",
        desc: "Comma-separated list of folder paths to monitor (leave empty for entire vault)",
        type: "textarea",
        placeholder: "Test/0 Daily ADHD Brain Logs, Other/Folder",
        get: () => this.plugin.settings.scopeFolders.join(", "),
        set: (value) => {
          this.plugin.settings.scopeFolders = value.split(",").map((f) => f.trim()).filter((f) => f.length > 0);
        }
      },
      {
        name: "Exclude folders",
        desc: "Comma-separated list of folder paths to exclude from processing (useful for templates, copilot files, etc.)",
        type: "textarea",
        placeholder: "Templates, copilot-custom-prompts, copilot-conversations",
        get: () => this.plugin.settings.excludeFolders.join(", "),
        set: (value) => {
          this.plugin.settings.excludeFolders = value.split(",").map((f) => f.trim()).filter((f) => f.length > 0);
        }
      },
      {
        name: "Update frontmatter modified",
        desc: "Automatically update the modified field in frontmatter on each save",
        type: "toggle",
        get: () => this.plugin.settings.updateFrontmatterModified,
        set: (value) => {
          this.plugin.settings.updateFrontmatterModified = value;
        }
      },
      {
        name: "Delegate modified to Linter",
        desc: "Let Linter plugin handle modified timestamp updates instead",
        type: "toggle",
        get: () => this.plugin.settings.delegateModifiedToLinter,
        set: (value) => {
          this.plugin.settings.delegateModifiedToLinter = value;
        }
      },
      {
        name: "Add type if missing",
        desc: "Automatically add a type field to frontmatter if not present",
        type: "toggle",
        get: () => this.plugin.settings.addTypeIfMissing,
        set: (value) => {
          this.plugin.settings.addTypeIfMissing = value;
        }
      },
      {
        name: "Default type value",
        desc: "The default value for the type field",
        type: "text",
        placeholder: "note",
        get: () => this.plugin.settings.typeValue,
        set: (value) => {
          this.plugin.settings.typeValue = value || "note";
        }
      },
      {
        name: "Debounce delay (ms)",
        desc: "Minimum time between processing file modifications (prevents rapid-fire updates)",
        type: "number",
        placeholder: "3000",
        get: () => this.plugin.settings.debounceMs.toString(),
        set: (value) => {
          const num = parseInt(value);
          if (!isNaN(num) && num >= 100) {
            this.plugin.settings.debounceMs = num;
          }
        }
      },
      {
        name: "Idle time before update (ms)",
        desc: "How long user must stop typing before updates are applied",
        type: "number",
        placeholder: "5000",
        get: () => this.plugin.settings.idleTimeMs.toString(),
        set: (value) => {
          const num = parseInt(value);
          if (!isNaN(num) && num >= 1e3) {
            this.plugin.settings.idleTimeMs = num;
          }
        }
      },
      {
        name: "Enable idle updates",
        desc: "Automatically update files after idle time expires",
        type: "toggle",
        get: () => this.plugin.settings.enableIdleUpdate,
        set: (value) => {
          this.plugin.settings.enableIdleUpdate = value;
        }
      },
      {
        name: "Update on file switch",
        desc: "Update file when switching to a different note",
        type: "toggle",
        get: () => this.plugin.settings.updateOnFileSwitch,
        set: (value) => {
          this.plugin.settings.updateOnFileSwitch = value;
        }
      },
      {
        name: "Update on editor blur",
        desc: "Update file when editor loses focus (clicking outside Obsidian)",
        type: "toggle",
        get: () => this.plugin.settings.updateOnEditorBlur,
        set: (value) => {
          this.plugin.settings.updateOnEditorBlur = value;
        }
      },
      {
        name: "Tag notes edited by the CLI",
        desc: "Update notes changed by Obsidian CLI commands (append, property:set, eval, ...) as soon as the command finishes. Desktop only.",
        type: "toggle",
        get: () => this.plugin.settings.tagCliEdits,
        set: (value) => {
          this.plugin.settings.tagCliEdits = value;
        }
      },
      {
        name: "Preserve creation tag",
        desc: "Ensure the creation date tag is always present in the tag list",
        type: "toggle",
        get: () => this.plugin.settings.preserveCreationTag,
        set: (value) => {
          this.plugin.settings.preserveCreationTag = value;
        }
      },
      {
        name: "Templater detection delay (ms)",
        desc: "How long to wait after file creation to allow Templater to expand templates",
        type: "number",
        placeholder: "100",
        get: () => this.plugin.settings.templaterDetectionDelay.toString(),
        set: (value) => {
          const num = parseInt(value);
          if (!isNaN(num) && num >= 0) {
            this.plugin.settings.templaterDetectionDelay = num;
          }
        }
      }
    ];
    settings.forEach((config) => {
      const setting = new Setting(containerEl).setName(config.name).setDesc(config.desc);
      if (config.type === "text") {
        setting.addText(
          (text) => text.setPlaceholder(config.placeholder).setValue(config.get()).onChange(async (value) => {
            config.set(value);
            await this.plugin.saveSettings();
          })
        );
      } else if (config.type === "textarea") {
        setting.addTextArea(
          (text) => text.setPlaceholder(config.placeholder).setValue(config.get()).onChange(async (value) => {
            config.set(value);
            await this.plugin.saveSettings();
          })
        );
      } else if (config.type === "toggle") {
        setting.addToggle(
          (toggle) => toggle.setValue(config.get()).onChange(async (value) => {
            config.set(value);
            await this.plugin.saveSettings();
          })
        );
      } else if (config.type === "number") {
        setting.addText(
          (text) => text.setPlaceholder(config.placeholder).setValue(config.get()).onChange(async (value) => {
            config.set(value);
            await this.plugin.saveSettings();
          })
        );
      }
    });
  }
};
module.exports = DateTagsPlugin;

/*!
Date Tags Automation
Copyright (C) 2025 bobthearsonist
GPL-3.0-or-later; see https://www.gnu.org/licenses/gpl-3.0.html
*/
