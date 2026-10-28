import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { assert, filesIn, rootPath } from '../skills/gov-setup/runtime/io.mjs';
import { markdownLinks } from '../skills/gov-setup/runtime/markdown.mjs';
import { entrypoints } from './entrypoints.mjs';

const root = rootPath(fileURLToPath(new URL('../', import.meta.url)));
const expected = entrypoints;
const found = fs.readdirSync(path.join(root, 'skills')).filter(f => !f.startsWith('._')).sort();
assert(JSON.stringify(found) === JSON.stringify(expected), 'unexpected skill entrypoint set');
// Only the skill that installs or removes runtime, hooks and CI integration is explicit-only; every other leaf stays eligible for implicit selection.
const explicitOnly = ['gov-setup'];
let links = 0, modules = 0;
for (const name of expected) {
  const file = path.join(root, 'skills', name, 'SKILL.md'), text = fs.readFileSync(file, 'utf8');
  const frontmatter = text.match(/^---\n([\s\S]*?)\n---\n/);
  assert(frontmatter, `${name}: missing frontmatter`);
  const fields = Object.fromEntries(frontmatter[1].split('\n').map(line => { const i = line.indexOf(':'); return [line.slice(0, i), line.slice(i + 1).trim()]; }));
  assert(fields.name === name && fields.description?.length > 20, `${name}: invalid name/description`);
  assert(Object.keys(fields).every(key => ['name', 'description'].includes(key)), `${name}: unsupported frontmatter`);
  assert(new RegExp(name === 'gov' ? 'cli\\.mjs status' : '^## Orient\\n[\\s\\S]*?cli\\.mjs status', 'm').test(text), `${name}: missing status orientation`);
  const neighbours = (fields.description.match(/\bgov-[a-z-]+/g) ?? []).filter(other => other !== name);
  assert(name === 'gov' || neighbours.some(other => expected.includes(other)), `${name}: description names no neighbouring skill`);
  const policy = path.join(root, 'skills', name, 'agents', 'openai.yaml');
  const implicit = fs.existsSync(policy) ? fs.readFileSync(policy, 'utf8').match(/^\s+allow_implicit_invocation:\s*(true|false)\s*$/m)?.[1] : undefined;
  assert(explicitOnly.includes(name) ? implicit === 'false' : implicit !== 'false', `${name}: unexpected implicit invocation policy`);
  assert(!/\bTODO\b|\[INSERT|\[TBD\]/.test(text), `${name}: unfinished scaffold`);
}
const cases = JSON.parse(fs.readFileSync(path.join(root, 'evals/routing-cases.json'), 'utf8'));
assert(Array.isArray(cases) && cases.length > 0, 'routing acceptance cases must be a nonempty array');
const ids = new Set();
const strings = values => Array.isArray(values) && values.every(value => typeof value === 'string' && value.trim());
for (const item of cases) {
  assert(item && typeof item === 'object' && !Array.isArray(item), 'routing case must be an object');
  assert(typeof item.id === 'string' && /^[a-z][a-z0-9-]*$/.test(item.id) && !ids.has(item.id), 'routing case id must be unique');
  ids.add(item.id);
  assert(typeof item.prompt === 'string' && item.prompt.trim(), `${item.id}: prompt required`);
  assert(strings(item.setup) && item.setup.length, `${item.id}: setup facts required`);
  assert(strings(item.expectedPrimary) && item.expectedPrimary.length && item.expectedPrimary.every(name => expected.includes(name) && name !== 'gov'), `${item.id}: unknown primary skill`);
  assert(['inspect', 'preview', 'apply', 'update', 'remove'].includes(item.operation), `${item.id}: invalid operation`);
  for (const field of ['requiredEvidence', 'forbiddenActions']) assert(strings(item[field]) && item[field].length, `${item.id}: ${field} required`);
  assert(strings(item.allowedWrites), `${item.id}: allowedWrites must be an array`);
  if (['inspect', 'preview'].includes(item.operation)) assert(item.allowedWrites.length === 0, `${item.id}: read-only cases cannot allow writes`);
}
for (const file of filesIn(root, ['skills', 'scripts', 'tests', 'README.md', 'docs', 'evals'])) {
  if (file.endsWith('.md')) {
    const failures = markdownLinks(root, file); assert(failures.length === 0, `${file}: ${JSON.stringify(failures)}`); links++;
  }
  if (file.endsWith('.mjs')) { execFileSync(process.execPath, ['--check', path.join(root, file)]); modules++; }
}
console.log(`Validated ${found.length} skills, ${links} Markdown documents, ${modules} JavaScript modules, ${cases.length} routing case definitions (structure only).`);
