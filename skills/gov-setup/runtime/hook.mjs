#!/usr/bin/env node
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { safePath } from './io.mjs';

// Never execute native commands during an edit hook. Keep feedback bounded and
// independent of the caller's cwd. The enclosing host timeout is six seconds.
let message;
try {
  const payload = JSON.parse(fs.readFileSync(0, 'utf8'));
  if (payload.hook_event_name !== 'PostToolUse') throw new Error('unsupported hook event');
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const config = JSON.parse(fs.readFileSync(safePath(root.replace(/[\/]$/, ''), '.governance/config.json'), 'utf8'));
  const checks = config.checks.filter(c => ['registry', 'links', 'size'].includes(c.kind)).map(c => c.id);
  if (!checks.length) message = 'Gov Skills: no quick checks selected; native commands and semantic review were not run.';
  else {
    const run = spawnSync(process.execPath, [fileURLToPath(new URL('./cli.mjs', import.meta.url)), 'report', '--root', root, '--checks', checks.join(',')],
      { encoding: 'utf8', timeout: 4000, maxBuffer: 128 * 1024 });
    message = run.error ? `Gov Skills feedback error: ${run.error.message}` : `Gov Skills advisory (exit ${run.status}):\n${run.stdout || run.stderr}\nNative commands and semantic review were not run.`;
  }
} catch (e) { message = `Gov Skills feedback error: ${e.message}`; }
console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: message.slice(0, 12000) } }));
// Feedback only. Errors remain visible in context; CI uses cli.mjs directly.
process.exitCode = 0;
