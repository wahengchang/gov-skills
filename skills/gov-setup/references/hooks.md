# Optional Codex feedback

Schema checked against [official Codex hooks documentation](https://learn.chatgpt.com/docs/hooks) on 2026-10-28, local CLI 0.159.3. Repo `.codex/hooks.json` merges event groups; non-managed hooks must be reviewed and trusted. A definition change may require trust again. Never edit the trust store or use a trust-bypass flag to make an acceptance test green.

After setup, when requested:

```sh
node .governance/runtime/hooks.mjs preview --root .
node .governance/runtime/hooks.mjs install --root .
node .governance/runtime/hooks.mjs remove --root .
```

The owned PostToolUse group matches `apply_patch`, `Edit`, `Write`, invokes the target repo's Node adapter from the Git root, and has a six-second host timeout. Existing event groups/metadata are preserved. Reinstall is idempotent; locally changed/missing/duplicate owned definitions block removal instead of guessing. The manifest tracks only our definition, not ownership of the entire hooks file. Removal may retain an empty hooks file. Remove this group before uninstalling runtime. Runtime updates retain the hook record; reconcile a changed definition explicitly.

The adapter is quiet on pass. It validates the complete config/rules contract before filtering, so contract errors remain visible even for unrelated edits or command-only configurations. It reads edited paths from `file_path`/`path` fields and `apply_patch` headers, normalizes scopes such as `.` and `./docs`, and selects size/registry checks whose paths or rule references overlap the edit. It conservatively runs every adopted links check for any in-repo edit: destinations and anchors may be outside the scanned Markdown scope, and no reverse dependency index is maintained. Config/rules edits and payloads naming no path run every quick check. An outside-repo edit selects none when the contract is valid. It adds context for findings/errors; absence of output is not proof of whole-repo health. Set `GOV_HOOK_VERBOSE=1` in the hook environment to observe every event during trigger verification. Payload field names follow the documented schema but are not verified against a real host.

Relative edit paths without an absolute event cwd are ambiguous, so they fall back to every quick check instead of guessing from the adapter's launch directory. Absolute paths remain attributable without cwd. The adapter runs only built-in registry/links/size checks (no native commands), with a four-second subprocess timeout and 128 KiB output cap. It catches missing/broken dependency imports inside its advisory error handler, emits bounded `PostToolUse.additionalContext`, reports findings/errors, and exits 0. It cannot undo an edit or replace CI. Large selected scopes can time out; configure precise paths. If Node or the adapter entrypoint itself cannot start, the host reports the command failure. Runtime errors and unavailable checks do not mean clean.

Verify separately (with `GOV_HOOK_VERBOSE=1` for the trigger observation): definition written, project/hooks trusted through Codex's normal flow, real successful edit, real violation, and real failure/timeout event with visible feedback. Use a throwaway repo/session for fault cases. Mock payload tests do not prove host discovery or trust. From a subdirectory, confirm Git-root resolution. After removal, run the ordinary checker to show it remains independent.

Status must say **configured / pending trust / triggered / not verified** as supported by actual observations. No persisted trust evidence or real event means not verified. Do not claim hooks enabled from a config file alone.
