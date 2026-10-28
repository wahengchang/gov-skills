import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { setup } from '../skills/gov-setup/scripts/setup.mjs';
import { execute } from '../skills/gov-setup/runtime/core.mjs';
import { fixture, write, read, get, check, initGit, git, snapshot } from './helpers.mjs';

// Mechanical workflow fixtures. These assertions establish real runtime
// behavior, not that a model followed the skill's semantic instructions.
test('contract counterexample fails before enforcement; product repair remains separate', async t => {
  const root = fixture(t);
  write(root, 'src/provider.mjs', 'export const version = 1;\n');
  write(root, 'src/consumer.mjs', 'import {version} from "./provider.mjs"; export const label = `v${version}`;\n');
  write(root, 'docs/api.md', '# API\nContract: v1.\n');
  write(root, 'README.md', '[API](docs/api.md)\n');
  write(root, 'tests/contract.mjs', 'import assert from "node:assert/strict"; import {label} from "../src/consumer.mjs"; assert.equal(label,"v1");\n');
  initGit(root); setup(root, 'apply');
  const config = get(root, '.governance/config.json');
  config.checks.push(check('docs', 'links', ['README.md', 'docs']), check('contract', 'command', ['src', 'tests'], { argv: [process.execPath, 'tests/contract.mjs'] }));
  write(root, '.governance/config.json', config);
  write(root, '.governance/rules.json', [{ id: 'api-version', owner: 'api', scope: ['src'], source: ['docs/api.md'], proof: ['tests/contract.mjs'], enforcement: { check: 'contract' } }]);
  const good = await execute({ root }); assert.equal(good.status, 'pass');
  // Isolated product regression: retain original docs/tests, preserve modes.
  write(root, 'src/provider.mjs', 'export const version = 2;\n');
  const modes = read(root, '.governance/config.json');
  const report = await execute({ root }); assert.equal(report.exitCode, 0); assert.equal(report.results.find(r => r.check === 'contract').status, 'issues');
  assert.equal((await execute({ root, action: 'activate', selected: ['docs', 'contract'] })).exitCode, 1);
  assert.equal(read(root, '.governance/config.json'), modes); assert.match(read(root, 'docs/api.md'), /v1/);
  // Model a separately authorized fix only in this throwaway fixture.
  write(root, 'src/provider.mjs', 'export const version = 1;\n');
  assert.equal((await execute({ root, action: 'activate', selected: ['docs', 'contract'] })).exitCode, 0);
  assert.equal((await execute({ root, action: 'check' })).status, 'pass');
});

test('maintenance fixture exposes document/tool drift and product regression; factual repair is idempotent', async t => {
  const root = fixture(t); write(root, 'docs/current.md', '# Current\nStable contract.'); write(root, 'README.md', '[Guide](docs/old.md)');
  write(root, 'product.txt', 'regressed'); write(root, 'test.mjs', 'import fs from "node:fs"; import assert from "node:assert/strict"; assert.equal(fs.readFileSync("product.txt","utf8"),"stable")');
  setup(root, 'apply'); const config = get(root, '.governance/config.json');
  config.checks.push(check('docs', 'links', ['README.md']), check('tool', 'command', ['test.mjs'], { argv: ['fixture-missing-tool'] }), check('product', 'command', ['product.txt'], { argv: [process.execPath, 'test.mjs'] }));
  write(root, '.governance/config.json', config);
  const before = await execute({ root }); assert.deepEqual(before.results.map(r => r.status), ['pass', 'issues', 'error', 'issues']);
  write(root, 'README.md', '[Guide](docs/current.md)');
  config.checks.find(c => c.id === 'tool').argv = [process.execPath, '--version']; write(root, '.governance/config.json', config);
  const repaired = await execute({ root }); assert.deepEqual(repaired.results.map(r => r.status), ['pass', 'pass', 'pass', 'issues']);
  assert.equal(read(root, 'product.txt'), 'regressed'); assert.ok(config.checks.some(c => c.id === 'product'));
  const state = snapshot(root); await execute({ root }); assert.deepEqual(snapshot(root), state);
});

test('rename/delete fixture retains both Git paths for semantic investigation', t => {
  const root = fixture(t); write(root, 'old.md', 'authority'); write(root, 'caller.md', '[authority](old.md)'); initGit(root);
  git(root, 'mv', 'old.md', 'new.md');
  const diff = git(root, 'diff', '--cached', '--name-status', '-M'); assert.match(diff, /R100\s+old.md\s+new.md/);
  assert.match(read(root, 'caller.md'), /old.md/);
});
