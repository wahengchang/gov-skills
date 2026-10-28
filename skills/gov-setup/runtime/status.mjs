import fs from 'node:fs';
import { object, rootPath, safePath, hash, VERSION } from './io.mjs';
import { load, execute } from './core.mjs';

const MANIFEST = '.governance/manifest.json', CONFIG = '.governance/config.json', RULES = '.governance/rules.json';

function exists(root, file) {
  try { fs.lstatSync(safePath(root, file, { missing: true })); return true; }
  catch (e) { if (e.code === 'ENOENT') return false; throw e; }
}
function ownedDrift(root) {
  const manifest = JSON.parse(fs.readFileSync(safePath(root, MANIFEST), 'utf8'));
  if (!object(manifest) || manifest.version !== 1 || !object(manifest.files)) throw new Error('invalid ownership manifest');
  const drift = [];
  for (const [file, digest] of Object.entries(manifest.files)) {
    let bytes = null;
    try { bytes = fs.readFileSync(safePath(root, file)); } catch (e) { if (e.code !== 'ENOENT') throw e; }
    if (bytes === null) drift.push({ file, problem: 'missing' });
    else if (hash(bytes) !== digest) drift.push({ file, problem: 'modified' });
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
  const root = rootPath(input);
  const result = { version: VERSION, action: 'status', root, state: 'not-installed', manifest: false, drift: [], checks: [], activatable: [], unverified: [], problems: [], suggestions: [], exitCode: 0 };
  const hasManifest = exists(root, MANIFEST), hasConfig = exists(root, CONFIG), hasRules = exists(root, RULES);
  result.manifest = hasManifest;
  if (hasManifest) {
    try { result.drift = ownedDrift(root); } catch (e) { result.problems.push(e.message); result.drift.push({ file: MANIFEST, problem: 'invalid' }); }
  }
  let config;
  if (hasConfig && hasRules) {
    try { config = load(root).config; } catch (e) { result.problems.push(e.message); }
  }
  if (config) {
    // Built-in checks only: registered commands may mutate files or use the network.
    const quick = config.checks.filter(c => c.kind !== 'command').map(c => c.id);
    const run = quick.length ? await execute({ root, action: 'report', selected: quick }) : { results: [], errors: [] };
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
  else if (!config) result.state = 'invalid-contract';
  else if (result.drift.length) result.state = 'runtime-drift';
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
