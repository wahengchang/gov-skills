import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const VERSION = '0.1.0';
export const json = value => `${JSON.stringify(value, null, 2)}\n`;
export const hash = value => crypto.createHash('sha256').update(value).digest('hex');
export const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export const assert = (condition, message) => { if (!condition) throw new Error(message); };
export function rootPath(root) {
  const resolved = fs.realpathSync(root);
  assert(fs.statSync(resolved).isDirectory(), 'root must be a directory');
  return resolved;
}

// Refuse symlinks even when they currently point inside the repo. This also
// protects missing destinations whose parent is a symlink.
export function safePath(root, relative, { missing = false } = {}) {
  assert(typeof relative === 'string' && relative.length > 0 && !relative.includes('\0'), 'invalid path');
  assert(!path.isAbsolute(relative) && !/^[A-Za-z]:/.test(relative) && !relative.includes('\\'), `repo-relative path required: ${relative}`);
  const destination = path.resolve(root, relative);
  assert(destination === root || destination.startsWith(`${root}${path.sep}`), `path escapes repo: ${relative}`);
  const parts = path.relative(root, destination).split(path.sep).filter(Boolean);
  let cursor = root;
  for (const part of parts) {
    cursor = path.join(cursor, part);
    try { assert(!fs.lstatSync(cursor).isSymbolicLink(), `symlink refused: ${relative}`); }
    catch (error) { if (missing && error.code === 'ENOENT') continue; throw error; }
  }
  return destination;
}

export function readJSON(root, file) {
  try { return JSON.parse(fs.readFileSync(safePath(root, file), 'utf8')); }
  catch (error) { throw new Error(`${file}: ${error.message}`); }
}

// A set of writes/deletes is preflighted before the first change. Ordinary I/O
// failures roll back prior writes; process death / filesystem failure cannot be
// made transactional across multiple files. Never run concurrently with edits.
export function transact(root, changes) {
  const prepared = changes.map(change => {
    const file = safePath(root, change.path, { missing: true });
    let before = null;
    try { before = fs.readFileSync(file); } catch (e) { if (e.code !== 'ENOENT') throw e; }
    assert(change.before === undefined || (before === null ? null : hash(before)) === change.before,
      `file changed during operation: ${change.path}`);
    return { ...change, file, before };
  });
  const done = [], createdDirs = [], temporaries = [];
  const write = (file, data) => {
    const parents = [];
    for (let dir = path.dirname(file); !fs.existsSync(dir); dir = path.dirname(dir)) parents.push(dir);
    for (const dir of parents.reverse()) { fs.mkdirSync(dir); createdDirs.push(dir); }
    const temp = `${file}.gov-${crypto.randomUUID()}.tmp`;
    temporaries.push(temp);
    fs.writeFileSync(temp, data, { flag: 'wx' });
    fs.renameSync(temp, file);
  };
  try {
    for (const change of prepared) {
      // Recheck after preflight, before each write.
      safePath(root, change.path, { missing: true });
      let current = null;
      try { current = fs.readFileSync(change.file); } catch (e) { if (e.code !== 'ENOENT') throw e; }
      assert((current === null ? null : hash(current)) === (change.before === null ? null : hash(change.before)),
        `file changed during operation: ${change.path}`);
      done.push(change);
      if (change.content === null) fs.unlinkSync(change.file);
      else write(change.file, change.content);
    }
  } catch (error) {
    const failures = [];
    for (const change of done.reverse()) {
      try {
        if (change.before === null) { if (fs.existsSync(change.file)) fs.unlinkSync(change.file); }
        else write(change.file, change.before);
      } catch (rollback) { failures.push(`${change.path}: ${rollback.message}`); }
    }
    if (failures.length) error.message += `; rollback incomplete: ${failures.join('; ')}`;
    throw error;
  } finally {
    for (const temp of temporaries) { try { fs.unlinkSync(temp); } catch {} }
    for (const dir of createdDirs.reverse()) { try { fs.rmdirSync(dir); } catch {} }
  }
}

export function filesIn(root, paths) {
  const found = new Set();
  function visit(relative) {
    const absolute = safePath(root, relative);
    const stat = fs.statSync(absolute);
    if (stat.isDirectory()) {
      for (const name of fs.readdirSync(absolute).sort()) {
        if (['.git', 'node_modules'].includes(name) || name.startsWith('._')) continue;
        visit(path.posix.join(relative, name));
      }
    } else { assert(stat.isFile(), `not a regular file: ${relative}`); found.add(relative); }
  }
  paths.forEach(visit);
  return [...found].sort();
}
