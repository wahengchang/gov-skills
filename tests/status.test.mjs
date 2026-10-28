import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
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
