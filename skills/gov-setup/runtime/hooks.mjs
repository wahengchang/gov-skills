#!/usr/bin/env node
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { assert, object, rootPath, safePath, readJSON, hash, json, transact } from './io.mjs';

export const hookGroup = {
  matcher: '^(apply_patch|Edit|Write)$',
  hooks: [{ type: 'command', command: 'node "$(git rev-parse --show-toplevel)/.governance/runtime/hook.mjs"', timeout: 6,
    statusMessage: 'Gov Skills: advisory governance feedback' }]
};
export function manageHooks(input, action) {
  assert(['preview', 'install', 'remove'].includes(action), 'expected preview|install|remove');
  const root = rootPath(input), manifestFile = '.governance/manifest.json', hookFile = '.codex/hooks.json';
  const manifestBytes = fs.readFileSync(safePath(root, manifestFile));
  const manifest = readJSON(root, manifestFile);
  assert(manifest.version === 1 && object(manifest.files) && manifest.files['.governance/runtime/hook.mjs'], 'install runtime first');
  let before = null;
  try { before = fs.readFileSync(safePath(root, hookFile, { missing: true })); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  const config = before === null ? {} : JSON.parse(before);
  assert(object(config) && (config.hooks === undefined || object(config.hooks)), 'invalid hooks config');
  config.hooks ??= {};
  const groups = config.hooks.PostToolUse ?? [];
  assert(Array.isArray(groups), 'PostToolUse must be an array');
  const same = group => hash(json(group)) === hash(json(hookGroup));
  let next;
  if (action === 'remove') {
    if (!manifest.hook) return { status: 'unchanged', trust: 'not managed', changes: [] };
    assert(hash(json(manifest.hook.group)) === hash(json(hookGroup)), 'owned hook definition differs; reconcile before removal');
    assert(groups.filter(same).length === 1, 'owned hook modified/missing/duplicated; reconcile before removal');
    next = groups.filter(group => !same(group)); delete manifest.hook;
  } else {
    if (manifest.hook) {
      assert(hash(json(manifest.hook.group)) === hash(json(hookGroup)) && groups.filter(same).length === 1, 'owned hook modified/missing/duplicated');
      return { status: 'unchanged', trust: 'requires host verification', changes: [] };
    }
    assert(!groups.some(same), 'identical unowned hook exists; reconcile explicitly');
    next = [...groups, hookGroup]; manifest.hook = { group: hookGroup, createdFile: before === null };
  }
  if (next.length) config.hooks.PostToolUse = next; else delete config.hooks.PostToolUse;
  // Keep even an empty hooks file; it may have existed before installation.
  const changes = [{ path: hookFile, content: json(config), before: before === null ? null : hash(before) },
    { path: manifestFile, content: json(manifest), before: hash(manifestBytes) }];
  if (action !== 'preview') transact(root, changes);
  return { status: action === 'preview' ? 'preview' : 'changed', trust: 'definition only; review/trust in Codex, then verify a real edit event',
    changes: changes.map(c => ({ path: c.path, content: c.content })) };
}
if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) {
  try {
    const { values, positionals } = parseArgs({ allowPositionals: true, options: { root: { type: 'string', default: process.cwd() } } });
    assert(positionals.length === 1, 'usage: node hooks.mjs preview|install|remove [--root DIR]');
    console.log(json(manageHooks(values.root, positionals[0])));
  } catch (e) { console.error(e.message); process.exitCode = 2; }
}
