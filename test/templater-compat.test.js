const test = require('node:test');
const assert = require('node:assert/strict');

const {
  matchesTemplaterCreationRule,
  resolveTemplaterEventFile,
} = require('../templater-compat');

function file(path, parentPath) {
  return {
    path,
    parent: parentPath ? { path: parentPath } : null,
  };
}

test('matches Templater 2.x folder mode without legacy enable flags', () => {
  const templater = {
    settings: {
      trigger_on_file_creation_mode: 'folder',
      folder_templates: [
        {
          folder: '0 Daily ADHD Brain Logs',
          template: 'Templates/ADHDBrainLogTemplate.md',
        },
      ],
    },
    settingTab: {
      getControlValue: () => true,
    },
  };

  assert.equal(
    matchesTemplaterCreationRule(
      templater,
      file(
        '0 Daily ADHD Brain Logs/20261102.md',
        '0 Daily ADHD Brain Logs'
      )
    ),
    true
  );
});

test('does not match when the device-local creation trigger is disabled', () => {
  const templater = {
    settings: {
      trigger_on_file_creation_mode: 'folder',
      folder_templates: [
        {
          folder: '0 Daily ADHD Brain Logs',
          template: 'Templates/ADHDBrainLogTemplate.md',
        },
      ],
    },
    settingTab: {
      getControlValue: () => false,
    },
  };

  assert.equal(
    matchesTemplaterCreationRule(
      templater,
      file(
        '0 Daily ADHD Brain Logs/20261102.md',
        '0 Daily ADHD Brain Logs'
      )
    ),
    false
  );
});

test('respects Templater ignored creation folders', () => {
  const templater = {
    settings: {
      trigger_on_file_creation_mode: 'folder',
      folder_templates: [
        {
          folder: '0 Daily ADHD Brain Logs',
          template: 'Templates/ADHDBrainLogTemplate.md',
        },
      ],
      ignore_folders_on_creation: [
        { folder: '0 Daily ADHD Brain Logs/Archive' },
      ],
    },
    settingTab: {
      getControlValue: () => true,
    },
  };

  assert.equal(
    matchesTemplaterCreationRule(
      templater,
      file(
        '0 Daily ADHD Brain Logs/Archive/20250101.md',
        '0 Daily ADHD Brain Logs/Archive'
      )
    ),
    false
  );
});

test('supports Templater 2.x regex mode', () => {
  const templater = {
    settings: {
      trigger_on_file_creation_mode: 'regex',
      file_templates: [
        {
          regex: '^Projects/\\d+\\.md$',
          template: 'Templates/Project.md',
        },
      ],
    },
    settingTab: {
      getControlValue: () => true,
    },
  };

  assert.equal(
    matchesTemplaterCreationRule(
      templater,
      file('Projects/123.md', 'Projects')
    ),
    true
  );
});

test('retains compatibility with legacy Templater enable flags', () => {
  const templater = {
    settings: {
      enable_folder_templates: true,
      folder_templates: [
        {
          folder: 'Daily',
          template: 'Templates/Daily.md',
        },
      ],
    },
  };

  assert.equal(
    matchesTemplaterCreationRule(
      templater,
      file('Daily/20261102.md', 'Daily')
    ),
    true
  );
});

test('resolves current and legacy Templater event payloads', () => {
  const target = file('Daily/20261102.md', 'Daily');

  assert.equal(resolveTemplaterEventFile(target), target);
  assert.equal(resolveTemplaterEventFile({ file: target }), target);
  assert.equal(resolveTemplaterEventFile({ view: { file: target } }), target);
  assert.equal(resolveTemplaterEventFile({ editor: { file: target } }), target);
  assert.equal(resolveTemplaterEventFile(undefined), null);
});
