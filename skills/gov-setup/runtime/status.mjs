import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// Drift detection must work when an owned runtime file is edited or broken, so
// this module imports nothing from the runtime statically: the manifest check
// uses only built-ins, and io/core load lazily for the contract and check pass.
const MANIFEST = '.governance/manifest.json', CONFIG = '.governance/config.json', RULES = '.governance/rules.json';
const OWNED = /^\.governance\/runtime\/[a-z][a-z0-9-]*\.mjs$/;

function exists(root, file) {
  try { fs.lstatSync(path.join(root, file)); return true; }
  catch (e) { if (e.code === 'ENOENT') return false; throw e; }
}
function ownedDrift(root) {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, MANIFEST), 'utf8'));
  if (manifest === null || typeof manifest !== 'object' || manifest.version !== 1 || manifest.files === null || typeof manifest.files !== 'object') throw new Error('invalid ownership manifest');
  const drift = [];
  for (const [file, digest] of Object.entries(manifest.files)) {
    if (!OWNED.test(file)) throw new Error(`invalid owned path in manifest: ${file}`);
    let bytes = null;
    try {
      const target = path.join(root, file);
      if (fs.lstatSync(target).isSymbolicLink()) { drift.push({ file, problem: 'symlink' }); continue; }
      bytes = fs.readFileSync(target);
    } catch (e) { if (e.code !== 'ENOENT') throw e; }
    if (bytes === null) drift.push({ file, problem: 'missing' });
    else if (crypto.createHash('sha256').update(bytes).digest('hex') !== digest) drift.push({ file, problem: 'modified' });
  }
  return drift;
}

// Hints only: the user's task, not this table, decides which skill runs.
const ROUTES = {
  'not-installed': [['gov-audit', 'map real authorities and native checks first (read-only)'], ['gov-setup', 'preview, then install runtime, config and CI integration']],
  partial: [['gov-setup', 'preview; reconcile the half-present installation instead of overwriting it']],
  'invalid-contract': [['gov-maintain', 'repair config/rules against the runtime contract']],
  'runtime-drift': [['gov-setup', 'preview; owned runtime was edited or removed, reconcile before update']],
  'enforce-failing': [['gov-check', 'identify the candidate that broke an enforced gate'], ['gov-maintain', 'if the failure is governance drift rather than a product change']],
  'ready-to-activate': [['gov-setup', 'activate the verified batch together, then run check']],
  adopting: [['gov-audit', 'find the next batch of precise paths and native commands'], ['gov-rule', 'place a demonstrated invariant in executable protection']],
  healthy: [['gov-check', 'review a candidate change'], ['gov-doc-sync', 'after behavior changes'], ['gov-rule', 'add or revise one invariant'], ['gov-maintain', 'periodic scoped health review']]
};

export async function status(input) {
  const root = fs.realpathSync(input);
  if (!fs.statSync(root).isDirectory()) throw new Error('root must be a directory');
  let io, core, loadError;
  try { io = await import('./io.mjs'); core = await import('./core.mjs'); }
  catch (e) { io = core = undefined; loadError = e.message.split('\n').find(Boolean); }
  const result = { version: io?.VERSION ?? 'unknown', action: 'status', root, state: 'not-installed', manifest: false, drift: [], checks: [], activatable: [], unverified: [], problems: [], suggestions: [], exitCode: 0 };
  const hasManifest = exists(root, MANIFEST), hasConfig = exists(root, CONFIG), hasRules = exists(root, RULES);
  result.manifest = hasManifest;
  if (hasManifest) {
    try { result.drift = ownedDrift(root); } catch (e) { result.problems.push(e.message); result.drift.push({ file: MANIFEST, problem: 'invalid' }); }
  }
  let config;
  if (!core && hasManifest) result.problems.push(`owned runtime cannot be loaded: ${loadError}`);
  else if (core && hasConfig && hasRules) {
    try { config = core.load(root).config; } catch (e) { result.problems.push(e.message); }
  }
  if (config) {
    // Built-in checks only: registered commands may mutate files or use the network.
    const quick = config.checks.filter(c => c.kind !== 'command').map(c => c.id);
    const run = quick.length ? await core.execute({ root, action: 'report', selected: quick }) : { results: [], errors: [] };
    result.problems.push(...run.errors);
    for (const check of config.checks) {
      const item = run.results.find(r => r.check === check.id), mode = check.mode ?? 'report';
      const state = item ? item.status : 'not-run';
      result.checks.push({ id: check.id, kind: check.kind, mode, status: state, findings: item?.findings.length ?? 0 });
      if (state === 'not-run') result.unverified.push(check.id);
      else if (mode === 'report' && state === 'pass') result.activatable.push(check.id);
    }
  }
  const enforcing = result.checks.filter(c => c.mode === 'enforce');
  if (!hasManifest && !hasConfig && !hasRules) result.state = 'not-installed';
  else if (!hasManifest || !hasConfig || !hasRules) result.state = 'partial';
  else if (result.drift.length || !core) result.state = 'runtime-drift';
  else if (!config) result.state = 'invalid-contract';
  else if (enforcing.some(c => c.status === 'issues' || c.status === 'error')) result.state = 'enforce-failing';
  else if (result.activatable.length) result.state = 'ready-to-activate';
  else if (!enforcing.length || result.unverified.length || result.checks.some(c => c.status !== 'pass')) result.state = 'adopting';
  else result.state = 'healthy';
  result.suggestions = ROUTES[result.state].map(([skill, reason]) => ({ skill, reason }));
  return result;
}

export function formatStatus(result) {
  return [`status: ${result.state} (toolkit ${result.version})`,
    ...result.problems.map(p => `PROBLEM ${p}`),
    ...result.drift.map(d => `DRIFT ${d.file}: ${d.problem}`),
    ...result.checks.map(c => `${c.id} [${c.mode}] ${c.kind} ${c.status}${c.findings ? ` findings=${c.findings}` : ''}`),
    ...(result.activatable.length ? [`activatable (built-in, zero findings): ${result.activatable.join(',')}`] : []),
    ...(result.unverified.length ? [`not run (registered commands): ${result.unverified.join(',')}`] : []),
    ...result.suggestions.map(s => `-> ${s.skill}: ${s.reason}`),
    'Status is a hint; it runs no registered commands and does not replace report/check.'].join('\n');
}
