import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { setup } from '../skills/gov-setup/scripts/setup.mjs';
import { status } from '../skills/gov-setup/runtime/status.mjs';
import { fixture, write, get, configure, check, snapshot } from './helpers.mjs';

const states = async root => (await status(root)).state;

test('status routes by repository state without writing or running registered commands', async t => {
  const root = fixture(t); write(root, 'README.md', '# Title\n');
  let before = snapshot(root), result = await status(root);
  assert.equal(result.state, 'not-installed'); assert.equal(result.suggestions[0].skill, 'gov-audit'); assert.deepEqual(snapshot(root), before);

  write(root, '.governance/config.json', { version: 1, checks: [check('docs', 'links', ['README.md'])] });
  assert.equal(await states(root), 'partial');

  setup(root, 'apply');
  assert.equal(await states(root), 'ready-to-activate');
  result = await status(root); assert.deepEqual(result.activatable, ['docs']); assert.equal(result.suggestions[0].skill, 'gov-setup');

  const config = get(root, '.governance/config.json');
  config.checks.push(check('native', 'command', ['README.md'], { argv: [process.execPath, '-e', 'require("fs").writeFileSync("NATIVE-RAN","bad")'] }));
  write(root, '.governance/config.json', config); before = snapshot(root);
  result = await status(root); assert.deepEqual(result.unverified, ['native']); assert.deepEqual(snapshot(root), before);
  assert.equal(result.checks.find(c => c.id === 'native').status, 'not-run');

  config.checks = config.checks.filter(c => c.id !== 'native').map(c => ({ ...c, mode: 'enforce' }));
  write(root, '.governance/config.json', config);
  assert.equal(await states(root), 'healthy');
  write(root, 'README.md', '[gone](missing.md)\n');
  result = await status(root); assert.equal(result.state, 'enforce-failing'); assert.deepEqual(result.suggestions.map(s => s.skill), ['gov-check', 'gov-maintain']);
});

test('fully enforced native checks remain enforced with explicitly partial verification', async t => {
  const root = fixture(t); setup(root, 'apply'); write(root, 'README.md', '# valid');
  configure(root, [check('docs', 'links', ['README.md'], { mode: 'enforce' }),
    check('native', 'command', ['README.md'], { mode: 'enforce', argv: [process.execPath, '-e', 'require("fs").writeFileSync("NATIVE-RAN","bad")'] })]);
  const before = snapshot(root), result = await status(root);
  assert.equal(result.state, 'enforced-unverified'); assert.equal(result.adoption, 'enforced'); assert.equal(result.verification, 'partial');
  assert.deepEqual(result.unverified, ['native']); assert.equal(result.suggestions[0].skill, 'gov-check'); assert.deepEqual(snapshot(root), before);
  configure(root, [check('docs', 'links', ['missing'], { mode: 'enforce' })]);
  const error = await status(root); assert.equal(error.state, 'enforce-failing'); assert.equal(error.verification, 'error');
  assert.ok(error.checks[0].errors.length); assert.ok(error.problems.length);
});

test('deployed status diagnoses missing or broken core/io before importing damaged modules', t => {
  for (const module of ['core', 'io']) for (const damage of ['missing', 'syntax', 'side-effect']) {
    const root = fixture(t); setup(root, 'apply');
    const file = `.governance/runtime/${module}.mjs`;
    if (damage === 'missing') fs.unlinkSync(path.join(root, file));
    else write(root, file, damage === 'syntax' ? 'invalid module syntax' : `import fs from 'node:fs'; fs.writeFileSync(${JSON.stringify(path.join(root, 'DAMAGED-RAN'))}, 'bad'); throw Error('damaged module executed');`);
    const before = snapshot(root);
    const run = spawnSync(process.execPath, [path.join(root, '.governance/runtime/cli.mjs'), 'status', '--root', root, '--json'], { encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr); const result = JSON.parse(run.stdout);
    assert.equal(result.state, 'runtime-drift'); assert.equal(result.adoption, 'unknown'); assert.equal(result.verification, 'not-run');
    assert.ok(result.drift.some(d => d.file === file)); assert.deepEqual(snapshot(root), before);
  }
});

test('intact bundled CLI diagnoses a target whose diagnostic bootstrap is damaged', t => {
  for (const module of ['cli', 'status']) {
    const root = fixture(t); setup(root, 'apply'); write(root, `.governance/runtime/${module}.mjs`, 'invalid module syntax');
    const before = snapshot(root);
    const run = spawnSync(process.execPath, [fileURLToPath(new URL('../skills/gov-setup/runtime/cli.mjs', import.meta.url)), 'status', '--root', root, '--json'], { encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr); assert.equal(JSON.parse(run.stdout).state, 'runtime-drift'); assert.deepEqual(snapshot(root), before);
  }
});

test('missing manifest leaves status partial without importing side-effecting target core', t => {
  const root = fixture(t); setup(root, 'apply'); fs.unlinkSync(path.join(root, '.governance/manifest.json'));
  write(root, '.governance/runtime/core.mjs', `import fs from 'node:fs'; fs.writeFileSync(${JSON.stringify(path.join(root, 'UNOWNED-RAN'))}, 'bad'); export function load() { throw Error('unowned core ran'); }`);
  const before = snapshot(root);
  const run = spawnSync(process.execPath, [path.join(root, '.governance/runtime/cli.mjs'), 'status', '--root', root, '--json'], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr); const result = JSON.parse(run.stdout);
  assert.equal(result.state, 'partial'); assert.equal(result.verification, 'not-run'); assert.deepEqual(result.checks, []);
  assert.deepEqual(snapshot(root), before);
});

test('ownership access errors name the affected file and retain earlier drift', t => {
  const root = fixture(t), external = fixture(t); setup(root, 'apply');
  fs.unlinkSync(path.join(root, '.governance/runtime/commands.mjs'));
  fs.unlinkSync(path.join(root, '.governance/runtime/core.mjs'));
  write(external, 'core.mjs', 'throw Error("must not import external module")');
  fs.symlinkSync(path.join(external, 'core.mjs'), path.join(root, '.governance/runtime/core.mjs'));
  const before = snapshot(root);
  const run = spawnSync(process.execPath, [path.join(root, '.governance/runtime/cli.mjs'), 'status', '--root', root, '--json'], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr); const result = JSON.parse(run.stdout);
  assert.equal(result.state, 'runtime-drift');
  assert.ok(result.drift.some(d => d.file === '.governance/runtime/commands.mjs' && d.problem === 'missing'));
  assert.ok(result.drift.some(d => d.file === '.governance/runtime/core.mjs' && d.problem === 'unsafe' && /symlink/.test(d.message)));
  assert.ok(!result.drift.some(d => d.file === '.governance/manifest.json')); assert.deepEqual(snapshot(root), before);
});

test('status reports invalid contracts and owned runtime drift as states, not crashes', async t => {
  const root = fixture(t); setup(root, 'apply');
  write(root, '.governance/runtime/core.mjs', 'local edit');
  const drift = await status(root); assert.equal(drift.state, 'runtime-drift'); assert.deepEqual(drift.drift, [{ file: '.governance/runtime/core.mjs', problem: 'modified' }]);
  const clean = fixture(t); setup(clean, 'apply');
  write(clean, '.governance/config.json', '{broken');
  const broken = await status(clean); assert.equal(broken.state, 'invalid-contract'); assert.equal(broken.suggestions[0].skill, 'gov-maintain'); assert.ok(broken.problems.length);
});

test('status CLI: JSON/text agree, exit 0 for diagnosed states, usage error for --checks', t => {
  const root = fixture(t); setup(root, 'apply');
  const cli = (...args) => spawnSync(process.execPath, [path.join(root, '.governance/runtime/cli.mjs'), ...args], { encoding: 'utf8' });
  const json = cli('status', '--root', root, '--json'), text = cli('status', '--root', root);
  assert.equal(json.status, 0); assert.equal(JSON.parse(json.stdout).state, 'ready-to-activate'); assert.match(text.stdout, /^status: ready-to-activate/);
  assert.equal(cli('status', '--root', root, '--checks', 'registry').status, 2);
  assert.equal(cli('status', '--root', path.join(root, 'nope')).status, 2);
});
