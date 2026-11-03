const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild');

const result = esbuild.buildSync({
  absWorkingDir: __dirname,
  entryPoints: ['main.source.js'],
  bundle: true,
  external: ['obsidian'],
  outfile: 'main.js',
  format: 'cjs',
  platform: 'browser',
  define: { global: 'window' },
  metafile: true,
  write: false,
});

const packages = new Set(
  Object.keys(result.metafile.inputs)
    .map((input) => /^node_modules\/((?:@[^/]+\/)?[^/]+)/.exec(input)?.[1])
    .filter(Boolean)
);
const notices = [...packages].sort().map((name) => {
  const directory = path.join(__dirname, 'node_modules', name);
  const license = fs.readdirSync(directory).find((file) => /^license(?:\.|$)/i.test(file));
  if (!license) throw new Error(`Missing bundled dependency license: ${name}`);
  return `${name}\n\n${fs.readFileSync(path.join(directory, license), 'utf8')}`;
});
const copyright = 'Date Tags Automation\nCopyright (C) 2025 bobthearsonist\nGPL-3.0-or-later; see https://www.gnu.org/licenses/gpl-3.0.html';
const footer = `\n/*!\n${[copyright, ...notices].join('\n\n---\n\n').replace(/\*\//g, '* /')}\n*/\n`;
fs.writeFileSync(path.join(__dirname, 'main.js'), result.outputFiles[0].text + footer);
