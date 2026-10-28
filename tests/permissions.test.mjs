import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { setup } from '../skills/gov-setup/scripts/setup.mjs';
import { manageHooks } from '../skills/gov-setup/runtime/hooks.mjs';
import { execute } from '../skills/gov-setup/runtime/core.mjs';
import { transact } from '../skills/gov-setup/runtime/io.mjs';

const posix = { skip: process.platform === 'win32' ? 'POSIX permission bits are not supported on Windows' : false };
const modeOf = file => fs.statSync(file).mode & 0o7777;
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gov permissions '));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}
function write(root, name, content, mode) {
  const file = path.join(root, name);
  fs.writeFileSync(file, content);
  fs.chmodSync(file, mode);
  return file;
}
async function withUmask(mask, run) {
  const previous = process.umask(mask);
  try { return await run(); } finally { process.umask(previous); }
}

test('hook install and removal preserve a private existing file under a permissive umask', posix, async t => {
  const root = fixture(t);
  setup(root, 'apply');
  fs.mkdirSync(path.join(root, '.codex'));
  const existing = { description: 'user metadata', hooks: { Stop: [] } };
  const hooks = write(root, '.codex/hooks.json', JSON.stringify(existing), 0o600);
  await withUmask(0o000, () => {
    manageHooks(root, 'install');
    assert.equal(modeOf(hooks), 0o600);
    manageHooks(root, 'remove');
    assert.equal(modeOf(hooks), 0o600);
  });
  assert.deepEqual(JSON.parse(fs.readFileSync(hooks, 'utf8')), existing);
});

test('activation preserves project config permissions under a restrictive umask', posix, async t => {
  const root = fixture(t);
  setup(root, 'apply');
  const config = path.join(root, '.governance/config.json');
  fs.chmodSync(config, 0o640);
  const result = await withUmask(0o077, () => execute({ root, action: 'activate', selected: ['registry'] }));
  assert.equal(result.exitCode, 0);
  assert.deepEqual(result.activated, ['registry']);
  assert.equal(modeOf(config), 0o640);
});

test('replacement retains executable bits even when the umask would remove them', posix, async t => {
  const root = fixture(t), file = write(root, 'check.sh', '#!/bin/sh\nexit 1\n', 0o751);
  await withUmask(0o077, () => transact(root, [{ path: 'check.sh', content: '#!/bin/sh\nexit 0\n' }]));
  assert.equal(fs.readFileSync(file, 'utf8'), '#!/bin/sh\nexit 0\n');
  assert.equal(modeOf(file), 0o751);
});

test('new files keep the default non-executable permissions filtered by the umask', posix, async t => {
  const root = fixture(t);
  await withUmask(0o027, () => transact(root, [{ path: 'new.txt', content: 'new' }]));
  assert.equal(modeOf(path.join(root, 'new.txt')), 0o640);
});

test('rollback restores contents and modes for replaced and deleted files', posix, async t => {
  const root = fixture(t);
  const replaced = write(root, 'replaced.sh', 'original executable', 0o751);
  const deleted = write(root, 'deleted.txt', 'original group-readable file', 0o640);
  const rename = fs.renameSync;
  const mocked = t.mock.method(fs, 'renameSync', (from, to) => {
    if (to === path.join(root, 'new/failed.txt')) throw new Error('injected rename failure');
    return rename(from, to);
  });
  try {
    await withUmask(0o077, () => assert.throws(() => transact(root, [
      { path: 'replaced.sh', content: 'updated' },
      { path: 'deleted.txt', content: null },
      { path: 'new/failed.txt', content: 'new' }
    ]), /injected rename failure/));
  } finally { mocked.mock.restore(); }
  assert.equal(fs.readFileSync(replaced, 'utf8'), 'original executable');
  assert.equal(modeOf(replaced), 0o751);
  assert.equal(fs.readFileSync(deleted, 'utf8'), 'original group-readable file');
  assert.equal(modeOf(deleted), 0o640);
  assert.deepEqual(fs.readdirSync(root).sort(), ['deleted.txt', 'replaced.sh']);
});

test('a mode change between writes aborts without overwriting the new permissions', posix, t => {
  const root = fixture(t);
  const first = write(root, 'first.txt', 'first original', 0o600);
  const second = write(root, 'second.txt', 'second original', 0o640);
  const rename = fs.renameSync;
  let changed = false;
  const mocked = t.mock.method(fs, 'renameSync', (from, to) => {
    const result = rename(from, to);
    if (to === first && !changed) { changed = true; fs.chmodSync(second, 0o600); }
    return result;
  });
  try {
    assert.throws(() => transact(root, [
      { path: 'first.txt', content: 'first updated' },
      { path: 'second.txt', content: 'second updated' }
    ]), /file changed during operation: second\.txt/);
  } finally { mocked.mock.restore(); }
  assert.equal(fs.readFileSync(first, 'utf8'), 'first original');
  assert.equal(modeOf(first), 0o600);
  assert.equal(fs.readFileSync(second, 'utf8'), 'second original');
  assert.equal(modeOf(second), 0o600);
});
