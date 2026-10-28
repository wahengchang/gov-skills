import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { setup, sourceRuntime } from '../skills/gov-setup/scripts/setup.mjs';
import { transact } from '../skills/gov-setup/runtime/io.mjs';
import { fixture, write, read, get, snapshot, initGit, git, check } from './helpers.mjs';

test('preview is read-only, install repeats without changes, uninstall keeps project content/index', t => {
  const root = fixture(t); write(root, 'AGENTS.md', 'Existing authority'); write(root, '.github/workflows/ci.yml', 'existing');
  write(root, 'staged.txt', 'base'); initGit(root); write(root, 'staged.txt', 'staged'); git(root, 'add', 'staged.txt'); write(root, 'staged.txt', 'unstaged');
  const before = snapshot(root), index = read(root, '.git/index'), head = git(root, 'rev-parse', 'HEAD');
  assert.equal(setup(root, 'preview').status, 'preview'); assert.deepEqual(snapshot(root), before);
  assert.equal(setup(root, 'apply').status, 'changed'); assert.equal(setup(root, 'apply').status, 'unchanged');
  assert.equal(setup(root, 'update').status, 'unchanged');
  const config = read(root, '.governance/config.json'), rules = read(root, '.governance/rules.json');
  write(root, '.governance/runtime/user-notes.txt', 'user');
  setup(root, 'uninstall'); assert.equal(read(root, '.governance/config.json'), config); assert.equal(read(root, '.governance/rules.json'), rules);
  assert.equal(read(root, '.governance/runtime/user-notes.txt'), 'user');
  assert.equal(read(root, '.git/index'), index); assert.equal(git(root, 'rev-parse', 'HEAD'), head);
  for (const file of ['AGENTS.md', '.github/workflows/ci.yml', 'staged.txt']) assert.equal(snapshot(root)[file], before[file]);
});

test('unowned conflicts, malformed config, local runtime edits and symlinks block before writes', t => {
  for (const scenario of ['collision', 'config', 'edit', 'symlink']) {
    const root = fixture(t), external = fixture(t); write(root, 'README.md', 'original');
    if (scenario === 'collision') write(root, '.governance/runtime/cli.mjs', 'user');
    if (scenario === 'config') write(root, '.governance/config.json', '{}');
    if (scenario === 'edit') { setup(root, 'apply'); write(root, '.governance/runtime/core.mjs', 'local change'); }
    if (scenario === 'symlink') fs.symlinkSync(external, path.join(root, '.governance'));
    const before = snapshot(root);
    assert.throws(() => setup(root, scenario === 'edit' ? 'update' : 'apply'));
    assert.deepEqual(snapshot(root), before);
  }
});

test('update replaces clean owned runtime, leaves extra files and project configs', t => {
  const root = fixture(t), runtime = fixture(t); fs.cpSync(sourceRuntime, runtime, { recursive: true });
  setup(root, 'apply'); write(runtime, 'core.mjs', `${read(runtime, 'core.mjs')}\n// updated fixture\n`);
  write(root, '.governance/runtime/local.txt', 'keep'); const config = read(root, '.governance/config.json');
  assert.throws(() => setup(root, 'apply', { runtime }), /use update/);
  assert.equal(setup(root, 'update', { runtime }).status, 'changed');
  assert.equal(read(root, '.governance/runtime/core.mjs'), read(runtime, 'core.mjs'));
  assert.equal(read(root, '.governance/config.json'), config); assert.equal(read(root, '.governance/runtime/local.txt'), 'keep');
  assert.equal(setup(root, 'update', { runtime }).status, 'unchanged');
  write(runtime, 'added.mjs', 'export const newModule = true;\n');
  assert.throws(() => setup(root, 'apply', { runtime }), /use update/);
  setup(root, 'update', { runtime }); assert.ok(fs.existsSync(path.join(root, '.governance/runtime/added.mjs')));
  fs.unlinkSync(path.join(runtime, 'added.mjs')); setup(root, 'update', { runtime });
  assert.ok(!fs.existsSync(path.join(root, '.governance/runtime/added.mjs')));
});

test('missing adopted project contracts are not replaced with an empty default on update', t => {
  const root = fixture(t); setup(root, 'apply'); fs.unlinkSync(path.join(root, '.governance/config.json'));
  const before = snapshot(root);
  assert.throws(() => setup(root, 'update'), /restore project contracts/); assert.deepEqual(snapshot(root), before);
});

test('ordinary transaction failure rolls back prior writes, preflight does not overwrite racing content', t => {
  const root = fixture(t); write(root, 'a.txt', 'original'); write(root, 'parent', 'not a directory');
  assert.throws(() => transact(root, [{ path: 'a.txt', content: 'changed' }, { path: 'parent/child', content: 'new' }]));
  assert.equal(read(root, 'a.txt'), 'original');
  assert.throws(() => transact(root, [{ path: 'a.txt', content: 'changed', before: 'wrong hash' }]));
  assert.equal(read(root, 'a.txt'), 'original');
  const rename = fs.renameSync; let count = 0;
  const mocked = t.mock.method(fs, 'renameSync', (...args) => { if (++count === 2) throw new Error('injected I/O failure'); return rename(...args); });
  assert.throws(() => transact(root, [{ path: 'a.txt', content: 'changed' }, { path: 'new/second.txt', content: 'new' }]), /injected I\/O failure/);
  mocked.mock.restore();
  assert.equal(read(root, 'a.txt'), 'original'); assert.ok(!fs.existsSync(path.join(root, 'new')));
});

test('copied setup skill works with no source checkout import; two different native tool repos complete lifecycle', t => {
  const installed = fixture(t);
  fs.cpSync(path.resolve('skills/gov-setup'), path.join(installed, 'gov-setup'), { recursive: true });
  for (const [name, argv, nativeFile, source] of [
    ['node', ['node', 'native.mjs'], 'native.mjs', 'process.exit(requireValue()); function requireValue(){return 0}'],
    ['python', ['python3', 'native.py'], 'native.py', 'from pathlib import Path\nassert Path("README.md").exists()\n']
  ]) {
    const root = fixture(t); write(root, 'README.md', `${name} project`); write(root, nativeFile, source);
    execFileSync(process.execPath, [path.join(installed, 'gov-setup/scripts/setup.mjs'), 'apply', '--root', root]);
    const config = get(root, '.governance/config.json'); config.checks.push(check('native', 'command', [nativeFile], { argv })); write(root, '.governance/config.json', config);
    const cli = path.join(root, '.governance/runtime/cli.mjs');
    const invoke = (...args) => JSON.parse(execFileSync(process.execPath, [cli, ...args, '--root', root, '--json'], { encoding: 'utf8' }));
    assert.equal(invoke('report').status, 'pass');
    assert.deepEqual(invoke('activate', '--checks', 'registry,native').activated, ['registry', 'native']);
    assert.equal(invoke('check').exitCode, 0);
    setup(root, 'update'); setup(root, 'uninstall'); assert.ok(fs.existsSync(path.join(root, nativeFile)));
  }
});
