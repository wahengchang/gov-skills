import fs from 'node:fs';
import path from 'node:path';
import { safePath } from './io.mjs';

function withoutFences(text) {
  let fence;
  return text.split('\n').map(line => {
    const start = line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (!fence && start) { fence = start[1]; return ' '.repeat(line.length); }
    if (fence) {
      const close = line.match(/^ {0,3}(`{3,}|~{3,})\s*$/);
      if (close && close[1][0] === fence[0] && close[1].length >= fence.length) fence = undefined;
      return ' '.repeat(line.length);
    }
    return line;
  }).join('\n');
}
function prose(text) {
  return withoutFences(text).replace(/(`+)([^\n]*?)\1/g, match => ' '.repeat(match.length));
}
function slug(text) {
  return text.toLowerCase().replace(/!?\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/<[^>]*>/g, '').replace(/[^\p{L}\p{N}_\-\s]/gu, '').replace(/ /g, '-');
}
function anchors(text) {
  const ids = new Set(), counts = new Map();
  for (const match of withoutFences(text).matchAll(/^ {0,3}#{1,6}\s+(.+?)\s*#*\s*$/gm)) {
    const base = slug(match[1]), count = counts.get(base) ?? 0;
    counts.set(base, count + 1); ids.add(count ? `${base}-${count}` : base);
  }
  for (const match of withoutFences(text).matchAll(/<(?:a|[a-z][\w-]*)\b[^>]*\b(?:id|name)=["']([^"']+)["']/gi)) ids.add(match[1]);
  return ids;
}

const labelKey = label => label.trim().replace(/[\t\n\r ]+/g, ' ').toLowerCase();

// Keep this scanner line-bounded like the supported inline-link subset. Consume
// the whole destination/title so brackets in a URL or title are not link text.
function inlineDestination(text, opening) {
  const end = text.indexOf('\n', opening), limit = end < 0 ? text.length : end;
  let i = opening + 1, target = '', depth = 0;
  const spaces = () => { while (i < limit && /[ \t\r]/.test(text[i])) i++; };
  spaces();
  if (text[i] === '<') {
    i++;
    while (i < limit && text[i] !== '>') {
      if (text[i] === '\\' && i + 1 < limit) i++;
      target += text[i++];
    }
    if (text[i++] !== '>') return;
  } else {
    while (i < limit) {
      const char = text[i];
      if (char === '\\' && i + 1 < limit) { target += text[i + 1]; i += 2; continue; }
      if (depth === 0 && (char === ')' || /[ \t\r]/.test(char))) break;
      if (char === '(') depth++;
      if (char === ')') depth--;
      target += char; i++;
    }
    if (depth !== 0) return;
  }
  const beforeSpace = i;
  spaces();
  if (i > beforeSpace && ['"', "'", '('].includes(text[i])) {
    const close = text[i] === '(' ? ')' : text[i]; i++;
    while (i < limit && text[i] !== close) {
      if (text[i] === '\\' && i + 1 < limit) i++;
      i++;
    }
    if (text[i++] !== close) return;
    spaces();
  }
  if (text[i] === ')') return { target, end: i };
}

function* destinations(text, definitions) {
  const brackets = [];
  let line = 1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\n') { line++; brackets.length = 0; continue; }
    if (text[i] === '\\' && text[i + 1] !== '\n') { i++; continue; }
    if (text[i] === '!' && text[i + 1] === '[') { brackets.push({ index: ++i, image: true, active: true }); continue; }
    if (text[i] === '[') { brackets.push({ index: i, image: false, active: true }); continue; }
    if (text[i] !== ']' || !brackets.length) continue;
    const opening = brackets.pop();
    if (!opening.active) continue;
    const label = text.slice(opening.index + 1, i);
    const accept = target => {
      // Links cannot contain links. Images may contain inline link text and may
      // themselves appear inside a link, so retain earlier image openers.
      if (!opening.image) for (const bracket of brackets) if (!bracket.image) bracket.active = false;
      return { line, target };
    };
    const inline = text[i + 1] === '(' ? inlineDestination(text, i + 1) : undefined;
    if (inline) { yield accept(inline.target); i = inline.end; continue; }
    let key = labelKey(label), explicit = false;
    if (text[i + 1] === '[') {
      let end = i + 2;
      for (; end < text.length && !['\n', '[', ']'].includes(text[end]); end++) {
        if (text[end] === '\\' && text[end + 1] !== '\n') end++;
      }
      if (text[end] === ']') {
        key = labelKey(text.slice(i + 2, end) || label); explicit = true; i = end;
      }
    }
    if (definitions.has(key)) yield accept(definitions.get(key));
    else if (explicit) yield { line, message: `undefined link reference: ${key}` };
  }
}

export function markdownLinks(root, file) {
  const source = fs.readFileSync(safePath(root, file), 'utf8'), text = prose(source), links = [], definitions = new Map();
  for (const match of text.matchAll(/^ {0,3}\[([^\]]+)\]:\s*(<[^>]+>|\S+)/gm)) {
    const key = labelKey(match[1]);
    if (!definitions.has(key)) definitions.set(key, match[2].replace(/^<|>$/g, ''));
  }
  // Closing each balanced bracket pair visits inner images and outer links.
  // References share the destination checker; escaped brackets stay literal.
  for (const entry of destinations(text, definitions)) {
    const { line, target } = entry;
    if (entry.message) { links.push({ file, ...entry }); continue; }
    if (target === undefined || target === '' || /^[a-z][a-z\d+.-]*:/i.test(target) || target.startsWith('//')) continue;
    try {
      const [rawPath, fragment] = target.split('#', 2);
      const decoded = decodeURIComponent(rawPath.split('?')[0]);
      if (path.isAbsolute(decoded)) throw new Error('absolute local link is outside relative-link contract');
      const destination = path.posix.join(path.posix.dirname(file), decoded || path.posix.basename(file));
      const absolute = safePath(root, destination);
      if (fragment) {
        if (!/\.md$/i.test(destination)) throw new Error('fragment on non-Markdown target needs manual validation');
        if (!anchors(fs.readFileSync(absolute, 'utf8')).has(decodeURIComponent(fragment))) throw new Error(`missing anchor #${fragment}`);
      }
    } catch (e) { links.push({ file, line, target, message: e.message }); }
  }
  return links;
}
