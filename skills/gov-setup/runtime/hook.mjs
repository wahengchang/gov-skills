#!/usr/bin/env node
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

// Never execute native commands during an edit hook. Keep feedback bounded and
// independent of the caller's cwd. The enclosing host timeout is six seconds.
// Quiet on pass: link destinations may be anywhere in the repo; size/registry
// are filtered by scope. Contract errors always add context. GOV_HOOK_VERBOSE=1
// restores a message for every event (use it to verify real hook triggering).
const QUICK = ['registry', 'links', 'size'];

async function main() {
  let message;
  const verbose = process.env.GOV_HOOK_VERBOSE === '1';
  try {
    const payload = JSON.parse(fs.readFileSync(0, 'utf8'));
    if (payload.hook_event_name !== 'PostToolUse') throw new Error('unsupported hook event');
    const root = fileURLToPath(new URL('../../', import.meta.url)).replace(/[\/]$/, '');
    const { format, load } = await import('./core.mjs');
    const { relevantChecks } = await import('./scope.mjs');
    // Contract validity is a prerequisite even when this edit selects no check.
    const { config, rules } = load(root);
    const quick = config.checks.filter(c => QUICK.includes(c.kind)), checks = relevantChecks(root, config, rules, payload, QUICK);
    if (!quick.length) message = verbose ? 'Gov Skills: no quick checks selected; native commands and semantic review were not run.' : undefined;
    else if (!checks.length) message = verbose ? 'Gov Skills: edit is outside every quick check scope; nothing run.' : undefined;
    else {
      const run = spawnSync(process.execPath, [fileURLToPath(new URL('./cli.mjs', import.meta.url)), 'report', '--root', root, '--json', '--checks', checks.map(c => c.id).join(',')],
        { encoding: 'utf8', timeout: 4000, maxBuffer: 128 * 1024 });
      if (run.error) message = `Gov Skills feedback error: ${run.error.message}`;
      else {
        let result;
        try { result = JSON.parse(run.stdout); } catch { message = `Gov Skills feedback error (exit ${run.status}): ${run.stderr || run.stdout}`; }
        if (result) {
          const noisy = { ...result, results: result.results.filter(r => r.status !== 'pass') };
          if (result.status === 'pass') message = verbose ? `Gov Skills: ${checks.length} quick check(s) pass. Native commands and semantic review were not run.` : undefined;
          else message = `Gov Skills advisory (exit ${run.status}):\n${format(noisy)}\nNative commands and semantic review were not run.`;
        }
      }
    }
  } catch (e) { message = `Gov Skills feedback error: ${e.message}`; }
  if (message !== undefined) console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: message.slice(0, 12000) } }));
}
await main();
// Feedback only. Errors remain visible in context; CI uses cli.mjs directly.
process.exitCode = 0;
