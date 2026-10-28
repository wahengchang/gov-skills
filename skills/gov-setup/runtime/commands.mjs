import { spawn } from 'node:child_process';

export function runCommand(argv, cwd, timeoutMs) {
  return new Promise(resolve => {
    const started = Date.now();
    let child, timer, stdout = '', stderr = '', failure, spawnError = false, timedOut = false;
    const limit = 1024 * 1024;
    const stop = () => {
      try { if (process.platform !== 'win32') process.kill(-child.pid, 'SIGKILL'); else child.kill('SIGKILL'); } catch {}
    };
    const capture = channel => chunk => {
      if (channel === 'stdout') stdout += chunk; else stderr += chunk;
      if (Buffer.byteLength(stdout) + Buffer.byteLength(stderr) > limit) {
        failure = 'command output exceeded 1 MiB';
        stdout = stdout.slice(0, limit / 2); stderr = stderr.slice(0, limit / 2); stop();
      }
    };
    try { child = spawn(argv[0], argv.slice(1), { cwd, shell: false, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] }); }
    catch (e) { resolve({ argv, cwd, error: e.message, exit: null, durationMs: Date.now() - started }); return; }
    child.stdout.setEncoding('utf8').on('data', capture('stdout'));
    child.stderr.setEncoding('utf8').on('data', capture('stderr'));
    child.on('error', e => { failure = e.message; spawnError = true; });
    timer = setTimeout(() => { timedOut = true; failure = `timeout after ${timeoutMs} ms`; stop(); }, timeoutMs);
    child.on('close', (exit, signal) => {
      clearTimeout(timer);
      resolve({ argv, cwd, exit: spawnError ? null : exit, signal, stdout, stderr, timedOut, durationMs: Date.now() - started, ...(failure ? { error: failure } : {}) });
    });
  });
}
