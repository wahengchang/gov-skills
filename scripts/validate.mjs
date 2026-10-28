import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { assert, filesIn, rootPath } from '../skills/gov-setup/runtime/io.mjs';
import { markdownLinks } from '../skills/gov-setup/runtime/markdown.mjs';

const root = rootPath(fileURLToPath(new URL('../', import.meta.url)));
const expected = ['gov-audit', 'gov-check', 'gov-doc-sync', 'gov-maintain', 'gov-rule', 'gov-setup'];
const found = fs.readdirSync(path.join(root, 'skills')).filter(f => !f.startsWith('._')).sort();
assert(JSON.stringify(found) === JSON.stringify(expected), 'unexpected skill entrypoint set');
// Mutating skills run only when named; read-only skills may be chosen implicitly.
const explicitOnly = ['gov-maintain', 'gov-rule', 'gov-setup'];
let links = 0, modules = 0;
for (const name of expected) {
  const file = path.join(root, 'skills', name, 'SKILL.md'), text = fs.readFileSync(file, 'utf8');
  const frontmatter = text.match(/^---\n([\s\S]*?)\n---\n/);
  assert(frontmatter, `${name}: missing frontmatter`);
  const fields = Object.fromEntries(frontmatter[1].split('\n').map(line => { const i = line.indexOf(':'); return [line.slice(0, i), line.slice(i + 1).trim()]; }));
  assert(fields.name === name && fields.description?.length > 20, `${name}: invalid name/description`);
  assert(Object.keys(fields).every(key => ['name', 'description'].includes(key)), `${name}: unsupported frontmatter`);
  assert(new RegExp(`^## Orient\\n[\\s\\S]*?cli\\.mjs status`, 'm').test(text), `${name}: missing status orientation`);
  assert(expected.some(other => other !== name && fields.description.includes(other)), `${name}: description names no neighbouring skill`);
  const policy = path.join(root, 'skills', name, 'agents', 'openai.yaml');
  const implicit = fs.existsSync(policy) ? fs.readFileSync(policy, 'utf8').match(/^\s+allow_implicit_invocation:\s*(true|false)\s*$/m)?.[1] : undefined;
  assert(explicitOnly.includes(name) ? implicit === 'false' : implicit !== 'false', `${name}: unexpected implicit invocation policy`);
  assert(!/\bTODO\b|\[INSERT|\[TBD\]/.test(text), `${name}: unfinished scaffold`);
}
for (const file of filesIn(root, ['skills', 'scripts', 'tests', 'README.md', 'docs'])) {
  if (file.endsWith('.md')) {
    const failures = markdownLinks(root, file); assert(failures.length === 0, `${file}: ${JSON.stringify(failures)}`); links++;
  }
  if (file.endsWith('.mjs')) { execFileSync(process.execPath, ['--check', path.join(root, file)]); modules++; }
}
console.log(`Validated ${found.length} skills, ${links} Markdown documents, ${modules} JavaScript modules.`);
