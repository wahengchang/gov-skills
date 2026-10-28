import fs from 'node:fs';
import { assert, object, safePath, rootPath, filesIn, hash, json, transact, VERSION } from './io.mjs';
import { markdownLinks } from './markdown.mjs';
import { runCommand } from './commands.mjs';

const CONFIG = '.governance/config.json', RULES = '.governance/rules.json';
const strings = x => Array.isArray(x) && x.length > 0 && x.every(v => typeof v === 'string' && v.trim().length > 0);
const keys = (value, allowed, label) => {
  assert(object(value), `${label} must be an object`);
  assert(Object.keys(value).every(k => allowed.includes(k)), `${label} has unknown fields (baseline is not supported)`);
};
export function validateConfig(config) {
  keys(config, ['version', 'checks'], 'config');
  assert(config.version === 1 && Array.isArray(config.checks) && config.checks.length > 0, 'config requires version: 1 and nonempty checks array');
  const ids = new Set();
  for (const check of config.checks) {
    keys(check, ['id', 'kind', 'mode', 'reason', 'paths', 'maxBytes', 'maxLines', 'argv', 'cwd', 'timeoutMs'], 'check');
    assert(typeof check.id === 'string' && /^[a-z][a-z0-9-]*$/.test(check.id) && !ids.has(check.id), 'invalid or duplicate check id'); ids.add(check.id);
    assert(['registry', 'links', 'size', 'command'].includes(check.kind), `${check.id}: invalid kind`);
    assert(check.mode === undefined || ['report', 'enforce'].includes(check.mode), `${check.id}: invalid mode`);
    assert(typeof check.reason === 'string' && check.reason.trim(), `${check.id}: reason required`);
    assert(strings(check.paths), `${check.id}: nonempty paths required`);
    if (check.kind === 'size') assert(['maxBytes', 'maxLines'].some(k => check[k] !== undefined), `${check.id}: size threshold required`);
    for (const key of ['maxBytes', 'maxLines']) if (check[key] !== undefined) {
      assert(check.kind === 'size' && Number.isSafeInteger(check[key]) && check[key] > 0, `${check.id}: invalid ${key}`);
    }
    if (check.kind === 'command') {
      assert(strings(check.argv), `${check.id}: argv required`);
      assert(check.cwd === undefined || (typeof check.cwd === 'string' && check.cwd.length > 0), `${check.id}: invalid cwd`);
      assert(check.timeoutMs === undefined || (Number.isInteger(check.timeoutMs) && check.timeoutMs >= 1 && check.timeoutMs <= 120000), `${check.id}: timeoutMs must be 1..120000`);
    } else assert(!['argv', 'cwd', 'timeoutMs'].some(k => check[k] !== undefined), `${check.id}: command fields on non-command check`);
  }
  return config;
}
export function validateRules(rules, config) {
  assert(Array.isArray(rules), 'rules must be an array');
  const ids = new Set();
  for (const rule of rules) {
    keys(rule, ['id', 'owner', 'scope', 'source', 'proof', 'enforcement'], 'rule');
    assert(typeof rule.id === 'string' && /^[a-z][a-z0-9-]*$/.test(rule.id) && !ids.has(rule.id), 'invalid or duplicate rule id'); ids.add(rule.id);
    assert(typeof rule.owner === 'string' && rule.owner.trim(), `${rule.id}: owner required`);
    for (const field of ['scope', 'source']) assert(strings(rule[field]), `${rule.id}: ${field} required`);
    assert(Array.isArray(rule.proof) && rule.proof.every(v => typeof v === 'string' && v.trim()), `${rule.id}: proof must be an array of paths`);
    keys(rule.enforcement, ['check', 'textReason'], `${rule.id}.enforcement`);
    const e = rule.enforcement;
    assert(Boolean(e.check) !== Boolean(e.textReason), `${rule.id}: select check or textReason`);
    if (e.check) assert(config.checks.some(c => c.id === e.check), `${rule.id}: unknown enforcement check`);
    else assert(typeof e.textReason === 'string' && e.textReason.trim(), `${rule.id}: textReason required`);
    if (e.check) assert(rule.proof.length > 0, `${rule.id}: executable rule needs proof references`);
  }
  return rules;
}

export function load(root) {
  const configText = fs.readFileSync(safePath(root, CONFIG), 'utf8');
  const rulesText = fs.readFileSync(safePath(root, RULES), 'utf8');
  const config = validateConfig(JSON.parse(configText));
  const rules = validateRules(JSON.parse(rulesText), config);
  // Configuration path safety is a prerequisite, even for unselected checks.
  for (const check of config.checks) {
    for (const file of check.paths) safePath(root, file, { missing: true });
    if (check.cwd !== undefined) safePath(root, check.cwd, { missing: true });
  }
  for (const rule of rules) for (const field of ['scope', 'source', 'proof']) for (const file of rule[field]) safePath(root, file, { missing: true });
  return { config, rules, configText, rulesText };
}

export async function execute({ root: input, action = 'report', selected } = {}) {
  const result = { version: VERSION, action, root: input, results: [], errors: [], activated: [], exitCode: 0 };
  try {
    assert(['report', 'check', 'activate'].includes(action), 'unknown action');
    const root = rootPath(input); result.root = root;
    const { config, rules, configText, rulesText } = load(root);
    if (selected !== undefined) assert(strings(selected) && new Set(selected).size === selected.length, 'checks must be a nonempty unique list');
    if (action === 'activate') assert(selected?.length, 'activate requires explicit --checks');
    for (const id of selected ?? []) assert(config.checks.some(c => c.id === id), `unknown check: ${id}`);
    const checks = config.checks.filter(c => !selected || selected.includes(c.id));
    for (const check of checks) {
      const item = { check: check.id, kind: check.kind, mode: check.mode ?? 'report', scope: check.paths, status: 'pass', findings: [], errors: [] };
      result.results.push(item);
      try {
        if (check.kind === 'registry') {
          for (const rule of rules) for (const field of ['scope', 'source', 'proof']) for (const file of rule[field]) {
            try { safePath(root, file); }
            catch (e) { item.findings.push({ file, rule: rule.id, field, message: e.message }); }
          }
          for (const file of check.paths) safePath(root, file);
        } else if (check.kind === 'links') {
          for (const file of filesIn(root, check.paths).filter(f => /\.md$/i.test(f))) item.findings.push(...markdownLinks(root, file));
        } else if (check.kind === 'size') {
          for (const file of filesIn(root, check.paths)) {
            const bytes = fs.readFileSync(safePath(root, file));
            const lines = bytes.length ? bytes.toString('utf8').split('\n').length - (bytes.at(-1) === 10 ? 1 : 0) : 0;
            for (const [key, actual] of [['maxBytes', bytes.length], ['maxLines', lines]]) {
              if (check[key] !== undefined && actual > check[key]) item.findings.push({ file, metric: key, actual, limit: check[key], message: `${actual} exceeds ${check[key]}` });
            }
          }
        } else {
          for (const file of check.paths) safePath(root, file);
          const cwd = safePath(root, check.cwd ?? '.'); assert(fs.statSync(cwd).isDirectory(), 'command cwd must be a directory');
          item.command = await runCommand(check.argv, cwd, check.timeoutMs ?? 30000);
          if (item.command.error || item.command.exit === null) item.errors.push(item.command.error ?? `command terminated: ${item.command.signal}`);
          else if (item.command.exit !== 0) item.findings.push({ file: check.cwd ?? '.', message: `command exited ${item.command.exit}`, exit: item.command.exit });
        }
      } catch (e) { item.errors.push(e.message); }
      item.status = item.errors.length ? 'error' : item.findings.length ? 'issues' : 'pass';
    }
    // Also detects a registered command rewriting its governing contracts.
    assert(fs.readFileSync(safePath(root, CONFIG), 'utf8') === configText && fs.readFileSync(safePath(root, RULES), 'utf8') === rulesText,
      'config or registry changed while running; evidence is stale');
    if (action === 'activate' && checks.every(c => result.results.find(r => r.check === c.id).status === 'pass')) {
      for (const check of checks) check.mode = 'enforce';
      transact(root, [{ path: CONFIG, content: json(config), before: hash(configText) }]);
      result.activated = checks.map(c => c.id);
    }
  } catch (e) { result.errors.push(e.message); }
  if (result.errors.length || result.results.some(r => r.errors.length)) result.exitCode = 2;
  else if (result.results.some(r => r.findings.length && (action === 'activate' || (action === 'check' && r.mode === 'enforce')))) result.exitCode = 1;
  result.status = result.exitCode === 2 ? 'error' : result.results.some(r => r.findings.length) ? 'issues' : 'pass';
  return result;
}

export function format(result) {
  return [`${result.action}: ${result.status} (exit ${result.exitCode})`,
    ...result.errors.map(e => `ERROR ${e}`),
    ...result.results.flatMap(r => [`${r.check} [${r.mode}] ${r.status} scope=${r.scope.join(',')}`,
      ...r.errors.map(e => `  ERROR ${e}`), ...r.findings.map(f => `  ${f.file}${f.line ? `:${f.line}` : ''}: ${f.message}`),
      ...(r.command ? [`  command exit=${r.command.exit} cwd=${r.command.cwd}`, r.command.stdout, r.command.stderr].filter(Boolean) : [])]),
    ...(result.activated.length ? [`activated: ${result.activated.join(',')}`] : [])].join('\n');
}
