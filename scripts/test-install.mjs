// Networked acceptance check, deliberately separate from the offline test suite.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { entrypoints } from './entrypoints.mjs';

const source = fileURLToPath(new URL('../', import.meta.url));
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'gov install '));
const candidate = path.join(work, 'candidate');
const expected = entrypoints;
const observations = [];
function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', timeout: 120000, maxBuffer: 2 * 1024 * 1024,
    env: { ...process.env, CI: '1', DO_NOT_TRACK: '1' } });
  observations.push({ command: [command, ...args], cwd, exit: result.status, stdout: result.stdout, stderr: result.stderr });
  assert.equal(result.status, 0, result.error?.message ?? result.stderr ?? result.stdout);
  return result.stdout;
}
try {
  fs.mkdirSync(candidate);
  // Same publishable payload as GitHub; ignored development skills/drafts never
  // enter this candidate. No git add/commit occurs in the real working tree.
  for (const file of ['skills', 'README.md', 'package.json', '.github', 'scripts', 'tests', 'docs', 'evals']) fs.cpSync(path.join(source, file), path.join(candidate, file), { recursive: true, filter: f => !path.basename(f).startsWith('._') });
  const projects = ['copy', 'default', 'setup-only'].map(mode => ({ mode, project: path.join(work, mode) }));
  for (const { mode, project } of projects) {
    fs.mkdirSync(project);
    if (mode === 'copy') run('npx', ['--yes', 'skills@1.7.4', 'add', candidate, '--list'], project);
    run('npx', ['--yes', 'skills@1.7.4', 'add', candidate, '--agent', 'codex', '--skill', mode === 'setup-only' ? 'gov-setup' : '*', '--yes',
      ...(mode === 'copy' ? ['--copy'] : []), '--json'], project);
    assert.deepEqual(fs.readdirSync(path.join(project, '.agents/skills')).sort(), mode === 'setup-only' ? ['gov-setup'] : expected);
  }
  fs.rmSync(candidate, { recursive: true });
  for (const { project } of projects) {
    const setup = path.join(project, '.agents/skills/gov-setup/scripts/setup.mjs');
    fs.writeFileSync(path.join(project, 'README.md'), 'Isolated acceptance repo.\n');
    run(process.execPath, [setup, 'apply', '--root', project], project);
    const initial = JSON.parse(run(process.execPath, [path.join(project, '.governance/runtime/cli.mjs'), 'status', '--root', project, '--json'], project));
    assert.equal(initial.state, 'ready-to-activate'); assert.equal(initial.adoption, 'report');
    run(process.execPath, [path.join(project, '.governance/runtime/cli.mjs'), 'report', '--root', project, '--json'], project);
    run(process.execPath, [path.join(project, '.governance/runtime/cli.mjs'), 'activate', '--root', project, '--checks', 'registry', '--json'], project);
    run(process.execPath, [path.join(project, '.governance/runtime/cli.mjs'), 'check', '--root', project], project);
    const final = JSON.parse(run(process.execPath, [path.join(project, '.governance/runtime/cli.mjs'), 'status', '--root', project, '--json'], project));
    assert.equal(final.state, 'healthy'); assert.equal(final.adoption, 'enforced'); assert.equal(final.verification, 'complete');
  }
  console.log(JSON.stringify({ status: 'pass', skillsCLI: '1.7.4', node: process.version,
    assertions: [`only the ${expected.length} reviewed entrypoints`, 'real CLI copy and default installs', 'gov-setup installed alone', 'candidate removed before setup', 'runtime status/report/activate/check/status in all three projects'], observations }, null, 2));
} finally { fs.rmSync(work, { recursive: true, force: true }); }
