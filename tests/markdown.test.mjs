import test from 'node:test';
import assert from 'node:assert/strict';
import { execute } from '../skills/gov-setup/runtime/core.mjs';
import { markdownLinks } from '../skills/gov-setup/runtime/markdown.mjs';
import { fixture, write, configure, check, read } from './helpers.mjs';

test('enforced links inspect both the outer destination and the image source', async t => {
  for (const [source, targets] of [
    ['[![Guide](logo.svg)](missing.md)', ['missing.md']],
    ['[![Guide](missing.svg)](guide.md)', ['missing.svg']],
    ['[![Guide](missing.svg)](missing.md)', ['missing.md', 'missing.svg']]
  ]) {
    const root = fixture(t);
    write(root, 'logo.svg', '<svg/>'); write(root, 'guide.md', '# Guide\n');
    write(root, 'README.md', `# Project\n\n${source}\n`);
    configure(root, [check('docs', 'links', ['README.md'], { mode: 'enforce' })]);
    const result = await execute({ root, action: 'check' });
    assert.equal(result.exitCode, 1); assert.equal(result.results[0].status, 'issues');
    assert.deepEqual(result.results[0].findings.map(f => f.target).sort(), targets);
    assert.ok(result.results[0].findings.every(f => f.file === 'README.md' && f.line === 3));
  }
});

test('nested link text cannot hide a missing target or activate a broken check', async t => {
  const root = fixture(t);
  write(root, 'README.md', 'Introduction.\n[a [nested [label]]](missing.md)\n');
  configure(root, [check('docs', 'links', ['README.md'])]);
  const before = read(root, '.governance/config.json');
  const result = await execute({ root, action: 'activate', selected: ['docs'] });
  assert.equal(result.exitCode, 1); assert.deepEqual(result.activated, []);
  assert.equal(read(root, '.governance/config.json'), before);
  assert.deepEqual(result.results[0].findings.map(({ target, line }) => ({ target, line })), [{ target: 'missing.md', line: 2 }]);
});

test('valid nested text, linked images and ordinary links retain a clean result', t => {
  const root = fixture(t);
  write(root, 'logo.svg', '<svg/>'); write(root, 'guide.md', '# Guide\n');
  write(root, 'README.md', [
    '[![Guide](logo.svg)](guide.md#guide)',
    '[a [nested [label]]](guide.md)',
    '[ordinary](guide.md)',
    '[external](https://example.invalid/ignored)',
    '[network path](//example.invalid/ignored)'
  ].join('\n'));
  assert.deepEqual(markdownLinks(root, 'README.md'), []);
});

test('accepted inner links make enclosing ordinary link syntax literal', async t => {
  for (const source of [
    '[outer [inner](guide.md)](missing.md)',
    '[outer [inner][guide]](missing.md)\n\n[guide]: guide.md',
    '[outer [guide]](missing.md)\n\n[guide]: guide.md'
  ]) {
    const root = fixture(t);
    write(root, 'guide.md', '# Guide\n'); write(root, 'README.md', source);
    configure(root, [check('docs', 'links', ['README.md'], { mode: 'enforce' })]);
    const result = await execute({ root, action: 'check' });
    assert.equal(result.exitCode, 0, source);
    assert.deepEqual(result.results[0].findings, [], source);
  }
});

test('accepted links inside image descriptions do not disable the image source', t => {
  const root = fixture(t);
  write(root, 'guide.md', '# Guide\n');
  write(root, 'README.md', [
    '![description [inner](guide.md)](missing-inline.svg)',
    '![description [inner][guide]](missing-reference.svg)',
    '![description [guide]](missing-shortcut.svg)',
    '[guide]: guide.md'
  ].join('\n'));
  assert.deepEqual(markdownLinks(root, 'README.md').map(({ target, line }) => ({ target, line })), [
    { target: 'missing-inline.svg', line: 1 },
    { target: 'missing-reference.svg', line: 2 },
    { target: 'missing-shortcut.svg', line: 3 }
  ]);
});

test('escaped exclamation marks do not turn ordinary inner links into images', t => {
  const root = fixture(t);
  write(root, 'guide.md', '# Guide\n'); write(root, 'logo.svg', '<svg/>');
  write(root, 'README.md', [
    String.raw`[outer \![inner](guide.md)](literal-suffix.md)`,
    String.raw`[outer \\![inner](logo.svg)](missing.md)`
  ].join('\n'));
  assert.deepEqual(markdownLinks(root, 'README.md').map(({ target, line }) => ({ target, line })), [{ target: 'missing.md', line: 2 }]);
});

test('escaped delimiters remain literal while even backslashes leave a real link', t => {
  const root = fixture(t);
  write(root, 'guide.md', '# Guide\n');
  write(root, 'README.md', [
    String.raw`\[literal](absent.md)`,
    String.raw`!\[literal image](absent.svg)`,
    String.raw`[escaped \] bracket](guide.md)`,
    String.raw`[escaped \[ bracket](guide.md)`,
    String.raw`\\[real link](missing.md)`
  ].join('\n'));
  assert.deepEqual(markdownLinks(root, 'README.md').map(({ target, line }) => ({ target, line })), [{ target: 'missing.md', line: 5 }]);
});

test('reference labels normalize whitespace and preserve the first definition', t => {
  const root = fixture(t);
  write(root, 'guide.md', '# Guide\n'); write(root, 'logo.svg', '<svg/>');
  write(root, 'README.md', [
    '[go][ SOME   label ]',
    '[some\tlabel][]',
    '[some label]',
    '[![Guide][image]][some label]',
    '[some label]: guide.md',
    '[some label]: ignored-duplicate.md',
    '[image]: logo.svg',
    '[unknown][missing   ref]'
  ].join('\n'));
  assert.deepEqual(markdownLinks(root, 'README.md'), [{ file: 'README.md', line: 8, message: 'undefined link reference: missing ref' }]);
});

test('destination brackets, titles, code and existing destination forms remain supported', t => {
  const root = fixture(t);
  write(root, 'guide[1].md', '# 中文\n# Repeat\n# Repeat\n<a id="custom"></a>\n');
  write(root, 'target (a).md', '# Target\n');
  write(root, 'README.md', [
    '[brackets](guide[1].md#中文 "title [not a reference]")',
    '[anchor](guide[1].md#repeat-1)',
    '[HTML anchor](guide[1].md#custom)',
    '[spaces](<target (a).md#target>)',
    String.raw`[escaped parentheses](target%20\(a\).md#target)`,
    '[balanced parentheses](target%20(a).md#target)',
    '`[ignored](missing.md)`',
    '```md',
    '[![ignored](missing.svg)](missing.md)',
    '```'
  ].join('\n'));
  assert.deepEqual(markdownLinks(root, 'README.md'), []);
});
