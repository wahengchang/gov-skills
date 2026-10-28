#!/usr/bin/env node
import { parseArgs } from 'node:util';
try {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: {
    root: { type: 'string', default: process.cwd() }, checks: { type: 'string' }, json: { type: 'boolean', default: false }
  } });
  if (positionals.length !== 1) throw new Error('usage: node cli.mjs report|check|activate|status [--root DIR] [--checks id,id] [--json]');
  if (positionals[0] === 'status') {
    if (values.checks !== undefined) throw new Error('status does not accept --checks');
    const { status, formatStatus } = await import('./status.mjs');
    const result = await status(values.root);
    console.log(values.json ? JSON.stringify(result, null, 2) : formatStatus(result)); process.exitCode = result.exitCode;
  } else {
    const { execute, format } = await import('./core.mjs');
    const result = await execute({ root: values.root, action: positionals[0], selected: values.checks?.split(',') });
    console.log(values.json ? JSON.stringify(result, null, 2) : format(result)); process.exitCode = result.exitCode;
  }
} catch (e) { console.error(e.message); process.exitCode = 2; }
