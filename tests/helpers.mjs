import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { hash, json } from '../skills/gov-setup/runtime/io.mjs';

export function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gov fixture '));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}
export function write(root, file, value) {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.writeFileSync(path.join(root, file), typeof value === 'string' || Buffer.isBuffer(value) ? value : json(value));
}
export const read = (root, file) => fs.readFileSync(path.join(root, file), 'utf8');
export const get = (root, file) => JSON.parse(read(root, file));
export const check = (id, kind, paths, extra = {}) => ({ id, kind, reason: 'Fixture adoption', paths, ...extra });
export function configure(root, checks, rules = []) {
  write(root, '.governance/config.json', { version: 1, checks }); write(root, '.governance/rules.json', rules);
}
export function snapshot(root) {
  const result = {};
  function walk(dir, prefix = '') {
    for (const name of fs.readdirSync(dir).sort()) {
      const file = path.join(dir, name), relative = `${prefix}${name}`;
      const stat = fs.lstatSync(file);
      if (stat.isSymbolicLink()) result[relative] = `link:${fs.readlinkSync(file)}`;
      else if (stat.isDirectory()) walk(file, `${relative}/`);
      else result[relative] = hash(fs.readFileSync(file));
    }
  }
  walk(root); return result;
}
export function git(root, ...args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1' } }).trim();
}
export function initGit(root) {
  git(root, 'init', '-q'); git(root, 'config', 'user.name', 'Fixture'); git(root, 'config', 'user.email', 'fixture@example.invalid');
  git(root, 'add', '.'); git(root, 'commit', '-qm', 'fixture');
}
