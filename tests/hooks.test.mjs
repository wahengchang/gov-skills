import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { setup } from '../skills/gov-setup/scripts/setup.mjs';
import { manageHooks, hookGroup } from '../skills/gov-setup/runtime/hooks.mjs';
import { fixture, write, get, read, snapshot, check } from './helpers.mjs';

test('hook lifecycle preserves existing definitions, previews without writes, repeat has no duplicate', t => {
  const root = fixture(t); setup(root, 'apply');
  const existing = { matcher: 'Write', hooks: [{ type: 'command', command: 'echo existing' }] };
  write(root, '.codex/hooks.json', { description: 'user', hooks: { PostToolUse: [existing], Stop: [] } });
  const before = snapshot(root); assert.equal(manageHooks(root, 'preview').status, 'preview'); assert.deepEqual(snapshot(root), before);
  manageHooks(root, 'install'); assert.equal(manageHooks(root, 'install').status, 'unchanged');
  assert.deepEqual(get(root, '.codex/hooks.json').hooks.PostToolUse, [existing, hookGroup]);
  assert.throws(() => setup(root, 'uninstall'), /remove the optional hook/);
  manageHooks(root, 'remove'); assert.equal(manageHooks(root, 'remove').status, 'unchanged');
  assert.deepEqual(get(root, '.codex/hooks.json'), { description: 'user', hooks: { PostToolUse: [existing], Stop: [] } });
  assert.equal(setup(root, 'uninstall').status, 'changed');
});

test('edited/missing owned hook, unowned identical group and symlink do not get overwritten', t => {
  for (const scenario of ['edited', 'missing', 'identical', 'symlink']) {
    const root = fixture(t); setup(root, 'apply');
    if (['edited', 'missing'].includes(scenario)) {
      manageHooks(root, 'install'); const config = get(root, '.codex/hooks.json');
      if (scenario === 'edited') config.hooks.PostToolUse[0].hooks[0].command = 'user edit'; else config.hooks.PostToolUse = [];
      write(root, '.codex/hooks.json', config);
    } else if (scenario === 'identical') write(root, '.codex/hooks.json', { hooks: { PostToolUse: [hookGroup] } });
    else { const external = fixture(t); fs.symlinkSync(external, path.join(root, '.codex')); }
    const before = snapshot(root); assert.throws(() => manageHooks(root, ['edited', 'missing'].includes(scenario) ? 'remove' : 'install'));
    assert.deepEqual(snapshot(root), before);
  }
});

test('mock PostToolUse payload from subdirectory returns advisory findings/errors without running native commands', t => {
  const root = fixture(t); setup(root, 'apply'); write(root, 'sub dir/README.md', '[missing](absent)');
  const config = get(root, '.governance/config.json');
  config.checks.push(check('docs', 'links', ['sub dir/README.md']), check('native', 'command', ['sub dir'], { argv: [process.execPath, '-e', 'require("fs").writeFileSync("NATIVE-RAN","bad")'] }));
  write(root, '.governance/config.json', config);
  const invoke = (env = process.env) => spawnSync(process.execPath, [path.join(root, '.governance/runtime/hook.mjs')], {
    cwd: path.join(root, 'sub dir'), input: JSON.stringify({ hook_event_name: 'PostToolUse', tool_name: 'apply_patch' }), encoding: 'utf8', env
  });
  const missing = spawnSync('/bin/sh', ['-c', 'node "$1"', '_', path.join(root, '.governance/runtime/hook.mjs')], {
    cwd: root, encoding: 'utf8', env: { ...process.env, PATH: path.join(root, 'missing-bin') }
  });
  assert.equal(missing.status, 127); assert.match(missing.stderr, /node/);
  let run = invoke(); assert.equal(run.status, 0);
  let output = JSON.parse(run.stdout).hookSpecificOutput.additionalContext;
  assert.match(output, /issues/); assert.match(output, /Native commands.*not run/); assert.ok(!fs.existsSync(path.join(root, 'NATIVE-RAN')));
  write(root, '.governance/config.json', '{broken'); run = invoke(); assert.equal(run.status, 0); assert.match(run.stdout, /feedback error/);
  // Simulate a broken runtime child process while retaining a valid hook adapter.
  write(root, '.governance/config.json', config); write(root, '.governance/runtime/cli.mjs', 'setInterval(()=>{},10000)');
  run = invoke(); assert.equal(run.status, 0); output = JSON.parse(run.stdout).hookSpecificOutput.additionalContext;
  assert.match(output, /timed out|ETIMEDOUT/);
});

test('removing hooks leaves the ordinary checker independent', t => {
  const root = fixture(t); setup(root, 'apply'); manageHooks(root, 'install'); manageHooks(root, 'remove');
  const run = spawnSync(process.execPath, [path.join(root, '.governance/runtime/cli.mjs'), 'check', '--root', root, '--json'], { encoding: 'utf8' });
  assert.equal(run.status, 0); assert.equal(JSON.parse(run.stdout).status, 'pass');
});

test('hook stays quiet on pass and outside-repo edits, conservatively reports link findings', t => {
  const root = fixture(t); setup(root, 'apply');
  write(root, 'docs/guide.md', '[ok](other.md)'); write(root, 'docs/other.md', '# other'); write(root, 'src/app.js', 'x');
  const config = get(root, '.governance/config.json');
  config.checks.push(check('docs', 'links', ['docs']), check('budget', 'size', ['src'], { maxLines: 1 }));
  write(root, '.governance/config.json', config);
  const invoke = (tool_input, env = {}) => spawnSync(process.execPath, [path.join(root, '.governance/runtime/hook.mjs')], {
    cwd: root, input: JSON.stringify({ hook_event_name: 'PostToolUse', tool_name: 'Edit', cwd: root, tool_input }), encoding: 'utf8', env: { ...process.env, ...env }
  });
  const context = run => run.stdout ? JSON.parse(run.stdout).hookSpecificOutput.additionalContext : '';

  let run = invoke({ file_path: path.join(root, 'docs/guide.md') });
  assert.equal(run.status, 0); assert.equal(run.stdout, '', 'passing relevant check is silent');
  assert.match(context(invoke({ file_path: 'docs/guide.md' }, { GOV_HOOK_VERBOSE: '1' })), /1 quick check\(s\) pass/);

  write(root, 'docs/guide.md', '[bad](absent.md)');
  run = invoke({ file_path: 'docs/guide.md' });
  assert.match(context(run), /docs \[report\] issues/); assert.doesNotMatch(context(run), /budget|registry/, 'only failing relevant checks are reported');
  run = invoke({ command: '*** Begin Patch\n*** Update File: docs/guide.md\n@@\n-a\n+b\n*** End Patch' });
  assert.match(context(run), /docs \[report\] issues/, 'apply_patch headers are attributed');

  assert.match(context(invoke({ file_path: 'src/app.js' })), /docs \[report\] issues/, 'link targets can be outside the scanned Markdown scope');
  write(root, 'src/app.js', 'x\ny\n');
  const budget = context(invoke({ file_path: 'src/app.js' })); assert.match(budget, /budget/); assert.match(budget, /absent\.md/);
  assert.match(context(invoke({ file_path: 'unrelated/notes.txt' })), /docs \[report\] issues/, 'in-repo edits conservatively rerun links');
  assert.doesNotMatch(context(invoke({ file_path: 'docs/guide.md' })), /budget/, 'size checks outside the edited scope stay unreported');
  write(root, 'docs/guide.md', '[ok](other.md)'); write(root, 'src/app.js', 'x');
  assert.equal(invoke({ file_path: 'unrelated/notes.txt' }).stdout, '', 'all checks pass: silent');
  write(root, 'docs/guide.md', '[bad](absent.md)');
  assert.equal(invoke({ file_path: path.join(path.dirname(root), 'outside.md') }).stdout, '', 'edit outside the repo is silent');
  assert.match(context(invoke({ file_path: '.governance/config.json' })), /docs \[report\] issues/, 'contract edits re-run every quick check');
  assert.match(context(invoke({ unknown: 'shape' })), /docs \[report\] issues/, 'unattributable edit falls back to every quick check');
});

test('hook catches incoming links after target heading changes, renames and deletion', t => {
  const root = fixture(t); setup(root, 'apply');
  write(root, 'README.md', '[details](docs/detail.md#original)'); write(root, 'docs/detail.md', '# original');
  write(root, '.governance/config.json', { version: 1, checks: [check('readme', 'links', ['README.md'])] });
  const invoke = command => spawnSync(process.execPath, [path.join(root, '.governance/runtime/hook.mjs')], {
    cwd: root, encoding: 'utf8', input: JSON.stringify({ hook_event_name: 'PostToolUse', cwd: root, tool_input: { command } })
  });
  const edited = '*** Begin Patch\n*** Update File: docs/detail.md\n@@\n-# original\n+# renamed\n*** End Patch';
  assert.equal(invoke(edited).stdout, '', 'valid links are quiet');
  write(root, 'docs/detail.md', '# renamed');
  assert.match(invoke(edited).stdout, /missing anchor/);
  fs.renameSync(path.join(root, 'docs/detail.md'), path.join(root, 'docs/renamed.md'));
  assert.match(invoke('*** Update File: docs/detail.md\n*** Move to: docs/renamed.md').stdout, /readme.*issues/);
  write(root, 'docs/detail.md', '# original'); fs.unlinkSync(path.join(root, 'docs/detail.md'));
  assert.match(invoke('*** Delete File: docs/detail.md').stdout, /readme.*issues/);
});

test('hook normalizes root and dotted scopes and validates contracts before filtering', t => {
  const root = fixture(t); setup(root, 'apply'); write(root, 'docs/guide.txt', 'one\ntwo\n');
  const invoke = () => spawnSync(process.execPath, [path.join(root, '.governance/runtime/hook.mjs')], {
    cwd: root, encoding: 'utf8', input: JSON.stringify({ hook_event_name: 'PostToolUse', cwd: root, tool_input: { path: 'docs/guide.txt' } })
  });
  for (const scope of ['.', './docs', 'docs/.']) {
    write(root, '.governance/config.json', { version: 1, checks: [check('budget', 'size', [scope], { maxLines: 1 })] });
    assert.match(invoke().stdout, /budget.*issues/, scope);
  }
  for (const change of [{ version: 99 }, { extra: true }, { checks: [check('native', 'bogus', ['elsewhere'])] }]) {
    write(root, '.governance/config.json', { version: 1, checks: [check('registry', 'registry', ['.governance/rules.json'])], ...change });
    const result = invoke(); assert.equal(result.status, 0); assert.match(result.stdout, /feedback error/, 'invalid config is visible even without a relevant quick check');
  }
});

test('ambiguous relative edit paths conservatively check from root or a subdirectory', t => {
  const root = fixture(t); setup(root, 'apply'); write(root, 'docs/guide.txt', 'one\ntwo\n'); write(root, 'sub/keep', 'x');
  write(root, '.governance/config.json', { version: 1, checks: [check('budget', 'size', ['docs'], { maxLines: 1 })] });
  for (const cwd of [root, path.join(root, 'sub')]) for (const eventCwd of [undefined, '.']) {
    const run = spawnSync(process.execPath, [path.join(root, '.governance/runtime/hook.mjs')], {
      cwd, encoding: 'utf8', input: JSON.stringify({ hook_event_name: 'PostToolUse', cwd: eventCwd, tool_input: { file_path: 'docs/guide.txt' } })
    });
    assert.equal(run.status, 0); assert.match(run.stdout, /budget.*issues/);
  }
});

test('broken hook dependencies produce advisory feedback rather than uncaught import errors', t => {
  for (const module of ['core', 'io', 'scope']) for (const damage of ['missing', 'syntax']) {
    const root = fixture(t); setup(root, 'apply');
    if (damage === 'missing') fs.unlinkSync(path.join(root, `.governance/runtime/${module}.mjs`));
    else write(root, `.governance/runtime/${module}.mjs`, 'invalid module syntax');
    const run = spawnSync(process.execPath, [path.join(root, '.governance/runtime/hook.mjs')], {
      cwd: root, encoding: 'utf8', input: JSON.stringify({ hook_event_name: 'PostToolUse' })
    });
    assert.equal(run.status, 0, run.stderr); assert.match(run.stdout, /feedback error/);
  }
});

test('editing a link target outside the link check paths still reports the broken anchor', t => {
  const root = fixture(t); setup(root, 'apply');
  write(root, 'README.md', '# T\n\n[api](docs/a.md#setup)\n'); write(root, 'docs/a.md', '# Setup\n');
  const config = get(root, '.governance/config.json'); config.checks.push(check('docs', 'links', ['README.md'])); write(root, '.governance/config.json', config);
  const invoke = file => spawnSync(process.execPath, [path.join(root, '.governance/runtime/hook.mjs')], {
    cwd: root, input: JSON.stringify({ hook_event_name: 'PostToolUse', cwd: root, tool_input: { file_path: file } }), encoding: 'utf8' });
  assert.equal(invoke('docs/a.md').stdout, '');
  write(root, 'docs/a.md', '# Renamed\n');
  assert.match(JSON.parse(invoke('docs/a.md').stdout).hookSpecificOutput.additionalContext, /missing anchor #setup/);
});
