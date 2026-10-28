import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const MANIFEST = '.governance/manifest.json', CONFIG = '.governance/config.json', RULES = '.governance/rules.json';
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);

// Keep the diagnostic bootstrap independent of owned io/core modules: either
// may be missing or syntactically broken. This probe only accepts the fixed
// contract paths and validated owned paths below; general paths use core.load.
function safePath(root, relative) {
  let cursor = root;
  for (const part of relative.split('/')) {
    cursor = path.join(cursor, part);
    try {
      if (fs.lstatSync(cursor).isSymbolicLink()) throw new Error(`symlink refused: ${relative}`);
    } catch (e) { if (e.code !== 'ENOENT') throw e; }
  }
  return cursor;
}

function exists(root, file) {
  try { fs.lstatSync(safePath(root, file)); return true; }
  catch (e) { if (e.code === 'ENOENT') return false; throw e; }
}
function ownership(root) {
  const manifest = JSON.parse(fs.readFileSync(safePath(root, MANIFEST), 'utf8'));
  if (!object(manifest) || manifest.version !== 1 || typeof manifest.toolkitVersion !== 'string'
    || !object(manifest.files) || !Object.keys(manifest.files).length) throw new Error('invalid ownership manifest');
  for (const [file, digest] of Object.entries(manifest.files)) {
    if (!/^\.governance\/runtime\/[a-z][a-z0-9-]*\.mjs$/.test(file) || !/^[a-f0-9]{64}$/.test(digest)) throw new Error('invalid owned path/hash');
  }
  const drift = [];
  for (const [file, digest] of Object.entries(manifest.files)) {
    let bytes = null;
    try { bytes = fs.readFileSync(safePath(root, file)); }
    catch (e) {
      if (e.code !== 'ENOENT') {
        drift.push({ file, problem: /symlink refused/.test(e.message) ? 'unsafe' : 'unreadable', message: e.message });
        continue;
      }
    }
    if (bytes === null) drift.push({ file, problem: 'missing' });
    else if (createHash('sha256').update(bytes).digest('hex') !== digest) drift.push({ file, problem: 'modified' });
  }
  return { manifest, drift };
}

// Hints only: the user's task, not this table, decides which skill runs.
const ROUTES = {
  'not-installed': [['gov-audit', 'map real authorities and native checks first (read-only)'], ['gov-setup', 'preview, then install runtime, config and CI integration']],
  partial: [['gov-setup', 'preview; reconcile the half-present installation instead of overwriting it']],
  'invalid-contract': [['gov-maintain', 'repair config/rules against the runtime contract']],
  'runtime-drift': [['gov-setup', 'preview; owned runtime was edited or removed, reconcile before update']],
  'enforce-failing': [['gov-check', 'identify the candidate that broke an enforced gate'], ['gov-maintain', 'if the failure is governance drift rather than a product change']],
  'ready-to-activate': [['gov-setup', 'if adoption is requested, select and revalidate the complete batch before activation']],
  adopting: [['gov-audit', 'find the next batch of precise paths and native commands'], ['gov-rule', 'place a demonstrated invariant in executable protection']],
  'enforced-unverified': [['gov-check', 'all checks are enforced; review and run the unverified commands for fresh verification']],
  healthy: [['gov-check', 'review a candidate change'], ['gov-doc-sync', 'after behavior changes'], ['gov-rule', 'add or revise one invariant'], ['gov-maintain', 'periodic scoped health review']]
};

export async function status(input) {
  const root = fs.realpathSync(input);
  if (!fs.statSync(root).isDirectory()) throw new Error('root must be a directory');
  const result = { version: null, action: 'status', root, state: 'not-installed', adoption: 'not-installed', verification: 'not-run', manifest: false, drift: [], checks: [], activatable: [], unverified: [], problems: [], suggestions: [], exitCode: 0 };
  const hasManifest = exists(root, MANIFEST), hasConfig = exists(root, CONFIG), hasRules = exists(root, RULES);
  result.manifest = hasManifest;
  if (hasManifest) {
    try {
      const owned = ownership(root); result.version = owned.manifest.toolkitVersion; result.drift = owned.drift;
    } catch (e) { result.problems.push(e.message); result.drift.push({ file: MANIFEST, problem: 'invalid' }); }
  }
  let config;
  let execute;
  // Do not load damaged owned modules just to diagnose their damage. When the
  // bootstrap itself is damaged, use the installed skill's intact CLI instead.
  if (hasManifest && hasConfig && hasRules && !result.drift.length) {
    try {
      const core = await import('./core.mjs'); execute = core.execute; config = core.load(root).config;
    } catch (e) { result.problems.push(e.message); }
  }
  if (config) {
    // Built-in checks only: registered commands may mutate files or use the network.
    const quick = config.checks.filter(c => c.kind !== 'command').map(c => c.id);
    const run = quick.length ? await execute({ root, action: 'report', selected: quick }) : { results: [], errors: [] };
    result.problems.push(...run.errors);
    for (const check of config.checks) {
      const item = run.results.find(r => r.check === check.id), mode = check.mode ?? 'report';
      const state = item ? item.status : 'not-run';
      const errors = item?.errors ?? [];
      result.checks.push({ id: check.id, kind: check.kind, mode, status: state, findings: item?.findings.length ?? 0, errors });
      result.problems.push(...errors.map(error => `${check.id}: ${error}`));
      if (state === 'not-run') result.unverified.push(check.id);
      else if (mode === 'report' && state === 'pass') result.activatable.push(check.id);
    }
    const modes = new Set(result.checks.map(c => c.mode));
    result.adoption = modes.size > 1 ? 'mixed' : modes.has('enforce') ? 'enforced' : 'report';
    result.verification = run.errors.length || result.checks.some(c => c.status === 'error') ? 'error'
      : result.unverified.length ? 'partial' : 'complete';
  }
  const enforcing = result.checks.filter(c => c.mode === 'enforce');
  if (!hasManifest && !hasConfig && !hasRules) result.state = 'not-installed';
  else if (!hasManifest || !hasConfig || !hasRules) { result.state = 'partial'; result.adoption = 'partial'; }
  else if (result.drift.length) result.state = 'runtime-drift';
  else if (!config) result.state = 'invalid-contract';
  else if (enforcing.some(c => c.status === 'issues' || c.status === 'error')) result.state = 'enforce-failing';
  else if (result.activatable.length) result.state = 'ready-to-activate';
  else if (result.adoption !== 'enforced') result.state = 'adopting';
  else if (result.unverified.length || result.verification !== 'complete') result.state = 'enforced-unverified';
  else result.state = 'healthy';
  if (['runtime-drift', 'invalid-contract'].includes(result.state)) result.adoption = 'unknown';
  result.suggestions = ROUTES[result.state].map(([skill, reason]) => ({ skill, reason }));
  return result;
}

export function formatStatus(result) {
  return [`status: ${result.state} (installed toolkit ${result.version ?? 'unknown'})`,
    `adoption: ${result.adoption}; verification: ${result.verification}`,
    ...result.problems.map(p => `PROBLEM ${p}`),
    ...result.drift.map(d => `DRIFT ${d.file}: ${d.problem}${d.message ? ` (${d.message})` : ''}`),
    ...result.checks.map(c => `${c.id} [${c.mode}] ${c.kind} ${c.status}${c.findings ? ` findings=${c.findings}` : ''}`),
    ...(result.activatable.length ? [`activatable (built-in, zero findings): ${result.activatable.join(',')}`] : []),
    ...(result.unverified.length ? [`not run (registered commands): ${result.unverified.join(',')}`] : []),
    ...result.suggestions.map(s => `-> ${s.skill}: ${s.reason}`),
    'Status is a hint; it runs no registered commands and does not replace report/check.'].join('\n');
}
