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

export function markdownLinks(root, file) {
  const source = fs.readFileSync(safePath(root, file), 'utf8'), text = prose(source), links = [], definitions = new Map();
  for (const match of text.matchAll(/^ {0,3}\[([^\]]+)\]:\s*(<[^>]+>|\S+)/gm)) {
    definitions.set(match[1].trim().toLowerCase(), match[2].replace(/^<|>$/g, ''));
  }
  // Inline destinations support angle brackets, escaped punctuation and nested
  // parentheses; reference links resolve through the same destination checker.
  for (const match of text.matchAll(/!?\[([^\]\n]*)\](?:(\()|\[([^\]\n]*)\])?/g)) {
    const line = text.slice(0, match.index).split('\n').length;
    let target;
    if (match[2] !== undefined) {
      let input = text.slice(match.index + match[0].length).split('\n')[0].trimStart();
      if (input.startsWith('<')) target = input.slice(1, input.indexOf('>'));
      else {
        let depth = 0; target = '';
        for (let i = 0; i < input.length; i++) {
          const c = input[i];
          if (c === '\\' && i + 1 < input.length) { target += input[++i]; continue; }
          if ((c === ')' && depth === 0) || (/\s/.test(c) && depth === 0)) break;
          if (c === '(') depth++; if (c === ')') depth--; target += c;
        }
      }
    } else {
      const key = (match[3] || match[1]).trim().toLowerCase();
      if (definitions.has(key)) target = definitions.get(key);
      else if (match[3] !== undefined) links.push({ file, line, message: `undefined link reference: ${key}` });
    }
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
