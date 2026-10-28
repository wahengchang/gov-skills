import fs from 'node:fs';
import path from 'node:path';

const CONTRACTS = ['.governance/config.json', '.governance/rules.json'];

// Paths named by the tool input: file_path/path fields and apply_patch headers.
export function editedPaths(payload) {
  const found = new Set();
  const visit = (value, key) => {
    if (typeof value === 'string') {
      if (['file_path', 'filePath', 'path'].includes(key)) found.add(value);
      for (const m of value.matchAll(/^\*\*\* (?:Add File|Update File|Delete File|Move to): (.+)$/gm)) found.add(m[1].trim());
    } else if (Array.isArray(value)) value.forEach(v => visit(v, key));
    else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) visit(v, k);
  };
  visit(payload.tool_input);
  return [...found];
}
// Resolve through symlinks (e.g. /tmp vs /private/tmp) even when the file is new.
function real(file) {
  const tail = [];
  for (let dir = file; ; dir = path.dirname(dir)) {
    try { return path.join(fs.realpathSync(dir), ...tail.reverse()); } catch { tail.push(path.basename(dir)); }
    if (path.dirname(dir) === dir) return file;
  }
}
const within = (file, scope) => file === scope || file.startsWith(`${scope.replace(/\/+$/, '')}/`);

// An edit that names no path stays relevant to every quick check.
export function relevantChecks(root, config, rules, payload, quickKinds) {
  const raw = editedPaths(payload);
  if (!raw.length) return config.checks.filter(c => quickKinds.includes(c.kind));
  const base = typeof payload.cwd === 'string' && path.isAbsolute(payload.cwd) ? payload.cwd : process.cwd();
  const files = raw.map(f => path.relative(real(root), real(path.resolve(base, f))).split(path.sep).join('/'))
    .filter(f => f && f !== '..' && !f.startsWith('../') && !path.isAbsolute(f));
  const contractEdit = files.some(f => CONTRACTS.includes(f));
  const referenced = rules.flatMap(r => [...r.scope, ...r.source, ...r.proof]);
  // A link finding can come from editing a link target outside the check's paths,
  // so link checks stay relevant to any in-repo edit; they report only when they find something.
  return config.checks.filter(c => quickKinds.includes(c.kind) && (contractEdit || (c.kind === 'links' && files.length > 0)
    || files.some(f => c.paths.some(p => within(f, p)) || (c.kind === 'registry' && referenced.some(p => within(f, p))))));
}
