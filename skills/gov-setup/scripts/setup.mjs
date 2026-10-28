#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { rootPath, safePath, readJSON, hash, json, assert, object, transact, VERSION } from '../runtime/io.mjs';
import { validateConfig, validateRules } from '../runtime/core.mjs';

const MANIFEST = '.governance/manifest.json';
export const sourceRuntime = fileURLToPath(new URL('../runtime/', import.meta.url));

export function readManifest(root) {
  const manifest = readJSON(root, MANIFEST);
  assert(object(manifest) && manifest.version === 1 && typeof manifest.toolkitVersion === 'string' && object(manifest.files), 'invalid ownership manifest');
  for (const [file, digest] of Object.entries(manifest.files)) {
    assert(/^\.governance\/runtime\/[a-z][a-z0-9-]*\.mjs$/.test(file) && /^[a-f0-9]{64}$/.test(digest), 'invalid owned path/hash');
  }
  return manifest;
}
export function planSetup(input, action = 'preview', { runtime = sourceRuntime } = {}) {
  assert(['preview', 'apply', 'update', 'uninstall'].includes(action), 'expected preview|apply|update|uninstall');
  const root = rootPath(input), changes = [], runtimeFiles = {};
  const snapshot = file => {
    try { return fs.readFileSync(safePath(root, file, { missing: true })); }
    catch (e) { if (e.code === 'ENOENT') return null; throw e; }
  };
  const manifestBytes = snapshot(MANIFEST);
  const old = manifestBytes === null ? null : readManifest(root);
  if (['update', 'uninstall'].includes(action)) assert(old, 'no owned installation; use apply first');
  if (old) for (const [file, digest] of Object.entries(old.files)) {
    const bytes = snapshot(file);
    assert(bytes !== null && hash(bytes) === digest, `owned runtime modified/missing; preserve and reconcile before retry: ${file}`);
  }
  const add = (file, content) => {
    const before = snapshot(file);
    if (content === null ? before === null : before?.equals(Buffer.from(content))) return;
    changes.push({ path: file, content, before: before === null ? null : hash(before) });
  };
  if (action === 'uninstall') {
    assert(!old.hook, 'remove the optional hook before uninstalling runtime');
    for (const file of Object.keys(old.files)) add(file, null);
    add(MANIFEST, null);
  } else {
    for (const file of fs.readdirSync(runtime).filter(f => /^[a-z][a-z0-9-]*\.mjs$/.test(f)).sort()) {
      assert(!fs.lstatSync(path.join(runtime, file)).isSymbolicLink(), 'runtime source symlink refused');
      const bytes = fs.readFileSync(path.join(runtime, file));
      const target = `.governance/runtime/${file}`;
      runtimeFiles[target] = hash(bytes);
      const before = snapshot(target);
      assert(before === null || old?.files[target], `unowned destination conflict: ${target}`);
      if (action === 'apply' && old && before && !before.equals(bytes)) throw new Error('installed runtime differs; use update');
      add(target, bytes);
    }
    assert(Object.keys(runtimeFiles).length > 0, 'runtime source is empty');
    if (action === 'apply' && old) assert(JSON.stringify(Object.entries(old.files).sort()) === JSON.stringify(Object.entries(runtimeFiles).sort()), 'installed runtime differs; use update');
    for (const file of Object.keys(old?.files ?? {})) if (!runtimeFiles[file]) add(file, null);
    const configFile = '.governance/config.json', rulesFile = '.governance/rules.json';
    const existingConfig = snapshot(configFile), existingRules = snapshot(rulesFile);
    if (old) assert(existingConfig !== null && existingRules !== null, 'installed config/rules missing; restore project contracts before retry');
    const config = existingConfig === null ? { version: 1, checks: [{ id: 'registry', kind: 'registry', mode: 'report', reason: 'Keep adopted rule references valid', paths: [rulesFile] }] } : validateConfig(JSON.parse(existingConfig));
    const rules = existingRules === null ? [] : validateRules(JSON.parse(existingRules), config);
    // Validate both existing and generated contracts before deploying anything.
    validateRules(rules, config);
    for (const check of config.checks) {
      for (const file of check.paths) safePath(root, file, { missing: true });
      if (check.cwd !== undefined) safePath(root, check.cwd, { missing: true });
    }
    for (const rule of rules) for (const field of ['scope', 'source', 'proof']) for (const file of rule[field]) safePath(root, file, { missing: true });
    if (existingConfig === null) add(configFile, json(config));
    if (existingRules === null) add(rulesFile, json(rules));
    const manifest = { version: 1, toolkitVersion: VERSION, files: runtimeFiles, ...(old?.hook ? { hook: old.hook } : {}) };
    add(MANIFEST, json(manifest));
  }
  return { root, action, changes, preserved: ['.governance/config.json', '.governance/rules.json', 'project docs, CI, Git index and unowned files'] };
}

export function setup(input, action, options) {
  const plan = planSetup(input, action, options);
  if (action !== 'preview') transact(plan.root, plan.changes);
  return { root: plan.root, action, status: action === 'preview' ? 'preview' : plan.changes.length ? 'changed' : 'unchanged',
    changes: plan.changes.map(c => ({ path: c.path, operation: c.content === null ? 'delete' : c.before === null ? 'create' : 'update' })), preserved: plan.preserved };
}
if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) {
  try {
    const { values, positionals } = parseArgs({ allowPositionals: true, options: { root: { type: 'string', default: process.cwd() } } });
    assert(positionals.length === 1, 'usage: node setup.mjs preview|apply|update|uninstall [--root DIR]');
    console.log(json(setup(values.root, positionals[0])));
  } catch (e) { console.error(e.message); process.exitCode = 2; }
}
