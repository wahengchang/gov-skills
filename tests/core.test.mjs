import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { execute } from '../skills/gov-setup/runtime/core.mjs';
import { fixture, write, read, get, configure, check, snapshot } from './helpers.mjs';

test('report preserves findings; enforce gates; checks do not edit source', async t => {
  const root = fixture(t);
  write(root, 'README.md', '[broken](missing.md) [other](also-missing.md)\n');
  configure(root, [check('docs', 'links', ['README.md'])]);
  const before = snapshot(root), report = await execute({ root });
  assert.equal(report.exitCode, 0); assert.equal(report.status, 'issues'); assert.equal(report.results[0].findings.length, 2);
  assert.deepEqual(snapshot(root), before);
  configure(root, [check('docs', 'links', ['README.md'], { mode: 'enforce' })]);
  assert.equal((await execute({ root, action: 'check' })).exitCode, 1);
});

test('Markdown destinations: references, unicode anchors, duplicate anchors, code, spaces, parentheses', async t => {
  const root = fixture(t);
  write(root, 'target (a).md', '# Hello World\n# Hello World\n# 中文\n# `Code` and [Link](relative)\n<a id="custom"></a>\n');
  write(root, 'README.md', '[one](<target (a).md#hello-world>) [two](target%20\(a\).md#hello-world-1)\n[zh][z]\n[z]: <target (a).md#中文>\n[custom](target%20(a).md#custom) [formatted](target%20(a).md#code-and-link)\n`[ignored](none)`\n```md\n[ignored](none)\n````\n');
  configure(root, [check('docs', 'links', ['README.md'])]);
  assert.equal((await execute({ root })).results[0].status, 'pass');
  write(root, 'README.md', '[bad](target%20(a).md#absent) [unknown][not-defined]\n');
  assert.equal((await execute({ root })).results[0].findings.length, 2);
});

test('registry validates identity, source, proof and owner; existence is only reference integrity', async t => {
  const root = fixture(t);
  write(root, 'contract.md', 'rule'); write(root, 'proof.mjs', '// not actually a proof\n');
  const rule = { id: 'contract', owner: 'team', scope: ['contract.md'], source: ['contract.md'], proof: ['proof.mjs'], enforcement: { check: 'registry' } };
  configure(root, [check('registry', 'registry', ['.governance/rules.json'])], [rule]);
  assert.equal((await execute({ root })).exitCode, 0);
  fs.unlinkSync(path.join(root, 'proof.mjs')); fs.unlinkSync(path.join(root, 'contract.md'));
  const result = await execute({ root }); assert.equal(result.results[0].findings.length, 3);
  configure(root, [check('registry', 'registry', ['.governance/rules.json'])], [rule, rule]);
  assert.equal((await execute({ root })).exitCode, 2);
  for (const invalid of [{ ...rule, owner: '' }, { ...rule, source: [] }, { ...rule, proof: [] }, { ...rule, enforcement: { check: 'unknown' } }, { ...rule, enforcement: { textReason: '' } }]) {
    configure(root, [check('registry', 'registry', ['.governance/rules.json'])], [invalid]);
    assert.equal((await execute({ root })).exitCode, 2);
  }
  write(root, 'contract.md', 'rule');
  configure(root, [check('registry', 'registry', ['.governance/rules.json'])], [{ ...rule, proof: [], enforcement: { textReason: 'Requires domain judgment' } }]);
  assert.equal((await execute({ root })).status, 'pass');
});

test('configured size thresholds include exact boundaries and growth', async t => {
  const root = fixture(t); write(root, 'AGENTS.md', 'a\nb\n');
  configure(root, [check('instructions', 'size', ['AGENTS.md'], { maxBytes: 4, maxLines: 2 })]);
  assert.equal((await execute({ root })).results[0].status, 'pass');
  write(root, 'AGENTS.md', 'a\nb\nc\n');
  assert.equal((await execute({ root })).results[0].findings.length, 2);
});

test('invalid contracts never pass even without enforced checks', async t => {
  const root = fixture(t); const valid = check('refs', 'registry', ['.governance/rules.json']);
  for (const checks of [[], [valid, valid], [{ ...valid, mode: 'skip' }], [{ ...valid, baseline: [] }], [{ ...valid, kind: 'unknown' }], [{ ...valid, reason: '' }]]) {
    configure(root, checks); assert.equal((await execute({ root })).exitCode, 2);
  }
  configure(root, [valid]); write(root, '.governance/rules.json', {});
  assert.equal((await execute({ root })).exitCode, 2);
  write(root, '.governance/rules.json', '{broken'); assert.equal((await execute({ root })).exitCode, 2);
  fs.unlinkSync(path.join(root, '.governance/config.json')); assert.equal((await execute({ root })).exitCode, 2);
});

test('activate reruns a selected batch and commits all or none', async t => {
  const root = fixture(t); write(root, 'README.md', '[bad](absent)'); write(root, 'AGENTS.md', 'ok');
  configure(root, [check('docs', 'links', ['README.md']), check('size', 'size', ['AGENTS.md'], { maxBytes: 20 })]);
  const before = read(root, '.governance/config.json');
  assert.equal((await execute({ root, action: 'activate', selected: ['docs', 'size'] })).exitCode, 1);
  assert.equal(read(root, '.governance/config.json'), before);
  for (const selected of [undefined, [], ['unknown'], ['docs', 'docs']]) {
    assert.equal((await execute({ root, action: 'activate', selected })).exitCode, 2); assert.equal(read(root, '.governance/config.json'), before);
  }
  write(root, 'absent', 'fixed');
  const success = await execute({ root, action: 'activate', selected: ['docs', 'size'] });
  assert.equal(success.exitCode, 0); assert.deepEqual(success.activated, ['docs', 'size']);
  assert.ok(get(root, '.governance/config.json').checks.every(c => c.mode === 'enforce'));
});

test('native command receives exact cwd and argv, returns actual output/exit', async t => {
  const root = fixture(t); write(root, 'sub dir/native.mjs', 'console.log(JSON.stringify({cwd:process.cwd(),arg:process.argv[2]})); process.exit(3);');
  configure(root, [check('native', 'command', ['sub dir'], { argv: [process.execPath, 'native.mjs', 'a b;no shell'], cwd: 'sub dir' })]);
  const result = await execute({ root }), item = result.results[0];
  assert.equal(item.command.exit, 3); assert.equal(item.status, 'issues');
  assert.deepEqual(JSON.parse(item.command.stdout), { cwd: fs.realpathSync(path.join(root, 'sub dir')), arg: 'a b;no shell' });
});

test('missing binary, timeout and output overflow are errors; activation remains atomic', async t => {
  const root = fixture(t); write(root, 'README.md', 'ok');
  for (const argv of [['gov-nonexistent-binary-fixture'], [process.execPath, '-e', 'setInterval(()=>{},1000)'], [process.execPath, '-e', 'process.stdout.write("x".repeat(2000000))']]) {
    configure(root, [check('good', 'links', ['README.md']), check('native', 'command', ['README.md'], { argv, timeoutMs: argv[0] === process.execPath && argv[2].includes('repeat') ? 2000 : 150 })]);
    const before = read(root, '.governance/config.json');
    const result = await execute({ root, action: 'activate', selected: ['good', 'native'] });
    assert.equal(result.exitCode, 2); assert.equal(result.results[1].status, 'error'); assert.equal(read(root, '.governance/config.json'), before);
    if (argv[0] === 'gov-nonexistent-binary-fixture') assert.equal(result.results[1].command.exit, null);
  }
});

test('unregistered native scripts are never executed; stale contracts fail activation', async t => {
  const root = fixture(t);
  write(root, 'package.json', { scripts: { test: 'touch SHOULD-NOT-EXIST' } });
  configure(root, [check('refs', 'registry', ['.governance/rules.json'])]);
  await execute({ root }); assert.ok(!fs.existsSync(path.join(root, 'SHOULD-NOT-EXIST')));
  configure(root, [check('native', 'command', ['package.json'], { argv: [process.execPath, '-e', 'require("fs").appendFileSync(".governance/config.json"," ")'] })]);
  const result = await execute({ root, action: 'activate', selected: ['native'] });
  assert.equal(result.exitCode, 2); assert.deepEqual(result.activated, []);
});

test('traversal, external symlinks and missing paths cannot produce a clean result', async t => {
  const root = fixture(t), external = fixture(t); write(external, 'secret.md', 'private');
  fs.symlinkSync(external, path.join(root, 'linked'));
  for (const paths of [['../secret.md'], ['linked'], ['missing']]) {
    configure(root, [check('docs', 'links', paths)]); assert.equal((await execute({ root })).exitCode, 2);
  }
  configure(root, [check('docs', 'links', ['README.md'])]); write(root, 'README.md', '[unsafe](linked/secret.md) [escape](../../outside)');
  assert.equal((await execute({ root })).results[0].findings.length, 2);
});

test('CLI text and JSON agree about findings, modes, errors and real exit codes', t => {
  const root = fixture(t); write(root, 'README.md', '[bad](missing.md)');
  const cli = path.resolve('skills/gov-setup/runtime/cli.mjs');
  const invoke = (...args) => spawnSync(process.execPath, [cli, ...args, '--root', root], { encoding: 'utf8' });
  configure(root, [check('docs', 'links', ['README.md'])]);
  const report = invoke('report', '--json'), body = JSON.parse(report.stdout);
  assert.equal(report.status, body.exitCode); assert.equal(body.status, 'issues'); assert.equal(body.results[0].mode, 'report');
  configure(root, [check('docs', 'links', ['README.md'], { mode: 'enforce' })]);
  const machine = invoke('check', '--json'), text = invoke('check');
  assert.equal(machine.status, 1); assert.equal(text.status, 1); assert.equal(JSON.parse(machine.stdout).results[0].findings.length, 1);
  assert.match(text.stdout, /docs \[enforce\] issues/); assert.match(text.stdout, /README.md:1/);
  write(root, '.governance/rules.json', '{}');
  assert.equal(invoke('report').status, 2); assert.equal(invoke('check', '--json').status, 2);
  assert.equal(invoke('report', '--unknown').status, 2);
});
