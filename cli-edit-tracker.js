// Obsidian's CLI dispatches every command (append, property:set, eval, ...)
// through a single global `handleCli` function on the renderer window. Wrapping
// it lets the plugin attribute vault modifications to CLI commands without any
// cooperation from the caller.
function createCliEditTracker({ target, onCommandSettled, isEnabled }) {
  const collectors = new Set();
  let original = null;
  let wrapper = null;

  function install() {
    if (wrapper || typeof target?.handleCli !== 'function') return false;

    original = target.handleCli;
    const inner = original;
    wrapper = async function (args, ...rest) {
      if (!isActive()) return inner.apply(this, [args, ...rest]);

      const files = new Set();
      collectors.add(files);
      let result;
      try {
        result = await inner.apply(this, [args, ...rest]);
      } finally {
        collectors.delete(files);
        if (files.size > 0 && isActive()) {
          const command = Array.isArray(args) ? args[0] : undefined;
          try {
            await onCommandSettled([...files], command);
          } catch (error) {
            console.error('DateTagsPlugin: Failed to tag CLI edits:', error);
          }
        }
      }
      return result;
    };
    target.handleCli = wrapper;
    return true;
  }

  function isActive() {
    return original !== null && (typeof isEnabled !== 'function' || isEnabled());
  }

  function uninstall() {
    if (!wrapper) return;
    // Another wrapper installed after ours still calls ours; restoring the
    // original there would drop it, so leave ours in place as a passthrough.
    if (target.handleCli === wrapper) target.handleCli = original;
    original = null;
    wrapper = null;
    collectors.clear();
  }

  function noteModified(path) {
    if (!path) return false;
    for (const files of collectors) files.add(path);
    return collectors.size > 0;
  }

  return {
    install,
    uninstall,
    noteModified,
    get isCliCommandRunning() {
      return collectors.size > 0;
    },
  };
}

module.exports = { createCliEditTracker };
