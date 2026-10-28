#!/usr/bin/env node
import { execute, format } from './core.mjs';
import { parseArgs } from 'node:util';
try {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: {
    root: { type: 'string', default: process.cwd() }, checks: { type: 'string' }, json: { type: 'boolean', default: false }
  } });
  if (positionals.length !== 1) throw new Error('usage: node cli.mjs report|check|activate [--root DIR] [--checks id,id] [--json]');
  const result = await execute({ root: values.root, action: positionals[0], selected: values.checks?.split(',') });
  console.log(values.json ? JSON.stringify(result, null, 2) : format(result)); process.exitCode = result.exitCode;
} catch (e) { console.error(e.message); process.exitCode = 2; }
