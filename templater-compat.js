function pathIsInFolder(file, folder) {
  const normalizedFolder = String(folder || '').replace(/\/+$/, '');
  if (!normalizedFolder) return false;

  return (
    file.parent?.path === normalizedFolder ||
    file.parent?.path?.startsWith(`${normalizedFolder}/`) ||
    file.path?.startsWith(`${normalizedFolder}/`)
  );
}

function getCreationTriggerState(templater) {
  const getControlValue = templater?.settingTab?.getControlValue;
  if (typeof getControlValue !== 'function') return null;

  try {
    const value = getControlValue.call(
      templater.settingTab,
      'trigger_on_file_creation'
    );
    return typeof value === 'boolean' ? value : null;
  } catch (error) {
    console.warn(
      'DateTagsPlugin: Unable to read Templater creation trigger state:',
      error
    );
    return null;
  }
}

function matchesTemplaterCreationRule(templater, file) {
  if (!templater?.settings || !file?.path) return false;

  const settings = templater.settings;
  if (getCreationTriggerState(templater) === false) return false;

  const isIgnored = (settings.ignore_folders_on_creation || []).some((entry) =>
    pathIsInFolder(file, typeof entry === 'string' ? entry : entry?.folder)
  );
  if (isIgnored) return false;

  const mode = settings.trigger_on_file_creation_mode;
  const folderMode =
    mode === 'folder' ||
    (mode == null && settings.enable_folder_templates === true);
  const regexMode =
    mode === 'regex' ||
    (mode == null && settings.enable_file_templates === true);

  if (folderMode) {
    for (const { folder, template } of settings.folder_templates || []) {
      if (folder && template && pathIsInFolder(file, folder)) {
        return true;
      }
    }
  }

  if (regexMode) {
    for (const { regex, template } of settings.file_templates || []) {
      if (!regex || !template) continue;

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

  return false;
}

function resolveTemplaterEventFile(payload) {
  if (!payload || typeof payload !== 'object') return null;
  if (typeof payload.path === 'string') return payload;

  return payload.file || payload.view?.file || payload.editor?.file || null;
}

module.exports = {
  matchesTemplaterCreationRule,
  resolveTemplaterEventFile,
};
