const test = require('node:test');
const assert = require('node:assert/strict');

const { createCliEditTracker } = require('../cli-edit-tracker');

function setup({ enabled = true, handler } = {}) {
  const settled = [];
  const target = {};
  const state = { enabled };
  const tracker = createCliEditTracker({
    target,
    isEnabled: () => state.enabled,
    onCommandSettled: async (paths, command) => settled.push({ paths, command }),
  });
  target.handleCli = handler || (async () => 'ok');
  return { target, tracker, settled, state };
}

test('reports files modified while a CLI command runs, before it returns', async () => {
  const ctx = setup({
    handler: async (args) => {
      ctx.tracker.noteModified('notes/a.md');
      ctx.tracker.noteModified('notes/a.md');
      ctx.tracker.noteModified('notes/b.md');
      return `ran ${args[0]}`;
    },
  });
  ctx.tracker.install();

  const result = await ctx.target.handleCli(['append', 'path=notes/a.md']);

  assert.equal(result, 'ran append');
  assert.deepEqual(ctx.settled, [
    { paths: ['notes/a.md', 'notes/b.md'], command: 'append' },
  ]);
});

test('ignores modifications outside CLI commands and read-only commands', async () => {
  const ctx = setup();
  ctx.tracker.install();

  assert.equal(ctx.tracker.noteModified('notes/a.md'), false);
  await ctx.target.handleCli(['read', 'path=notes/a.md']);

  assert.deepEqual(ctx.settled, []);
});

test('still tags partial writes when the command fails', async () => {
  const ctx = setup({
    handler: async () => {
      ctx.tracker.noteModified('notes/a.md');
      throw 'boom';
    },
  });
  ctx.tracker.install();

  await assert.rejects(ctx.target.handleCli(['eval']), /boom/);
  assert.deepEqual(ctx.settled, [{ paths: ['notes/a.md'], command: 'eval' }]);
});

test('passes through when disabled and restores the original on uninstall', async () => {
  const ctx = setup({
    handler: async () => {
      ctx.tracker.noteModified('notes/a.md');
      return 'ok';
    },
  });
  const original = ctx.target.handleCli;
  ctx.tracker.install();
  ctx.state.enabled = false;

  assert.equal(await ctx.target.handleCli(['append']), 'ok');
  assert.deepEqual(ctx.settled, []);

  ctx.tracker.uninstall();
  assert.equal(ctx.target.handleCli, original);
});

test('does nothing when the CLI bridge is unavailable', () => {
  const tracker = createCliEditTracker({
    target: {},
    onCommandSettled: async () => {},
  });
  assert.equal(tracker.install(), false);
});
