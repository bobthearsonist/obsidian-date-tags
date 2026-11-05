const test = require('node:test');
const assert = require('node:assert/strict');

const FrontmatterManager = require('../frontmatter-manager');

function setup(frontmatter = {}) {
  let processCalls = 0;
  const file = { path: 'note.md' };
  const app = {
    fileManager: {
      processFrontMatter(target, update) {
        assert.equal(target, file);
        processCalls++;
        update(frontmatter);
      },
    },
  };
  const manager = new FrontmatterManager(
    { addTypeIfMissing: true, typeValue: 'note' },
    app
  );
  return {
    file,
    frontmatter,
    manager,
    processCallCount: () => processCalls,
  };
}

test('batches new-note fields and date tag in one Obsidian update', () => {
  const ctx = setup();

  ctx.manager.process(ctx.file, (frontmatter) => {
    ctx.manager.ensureFrontmatter(frontmatter, '2026-11-05 13:00:00');
    ctx.manager.addTag(frontmatter, 'date/2026/11/05');
  });

  assert.deepEqual(ctx.frontmatter, {
    created: '2026-11-05 13:00:00',
    modified: '2026-11-05 13:00:00',
    type: 'note',
    tags: ['date/2026/11/05'],
  });
  assert.equal(ctx.processCallCount(), 1);
});

test('preserves existing metadata and normalizes a scalar tag before appending', () => {
  const ctx = setup({
    created: '2025-01-02',
    modified: '2025-01-03',
    type: 'project',
    tags: 'existing',
  });

  ctx.manager.process(ctx.file, (frontmatter) => {
    ctx.manager.ensureFrontmatter(frontmatter, '2026-11-05 13:00:00');
    ctx.manager.addTag(frontmatter, 'date/2026/11/05');
  });

  assert.deepEqual(ctx.frontmatter, {
    created: '2025-01-02',
    modified: '2025-01-03',
    type: 'project',
    tags: ['existing', 'date/2026/11/05'],
  });
  assert.equal(ctx.processCallCount(), 1);
});

test('keeps the creation tag first without duplicates', () => {
  const ctx = setup({
    tags: ['other', 'date/2025/01/02', 'date/2026/11/05'],
  });

  ctx.manager.process(ctx.file, (frontmatter) => {
    ctx.manager.ensureTagAtStart(frontmatter, 'date/2025/01/02');
    ctx.manager.addTag(frontmatter, 'date/2026/11/05');
  });

  assert.deepEqual(ctx.frontmatter.tags, [
    'date/2025/01/02',
    'other',
    'date/2026/11/05',
  ]);
  assert.equal(ctx.processCallCount(), 1);
});
