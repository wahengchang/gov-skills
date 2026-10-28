# Optional Codex feedback

Schema checked against [official Codex hooks documentation](https://learn.chatgpt.com/docs/hooks) on 2026-10-28, local CLI 0.159.3. Repo `.codex/hooks.json` merges event groups; non-managed hooks must be reviewed and trusted. A definition change may require trust again. Never edit the trust store or use a trust-bypass flag to make an acceptance test green.

After setup, when requested:

```sh
node .governance/runtime/hooks.mjs preview --root .
node .governance/runtime/hooks.mjs install --root .
node .governance/runtime/hooks.mjs remove --root .
```

The owned PostToolUse group matches `apply_patch`, `Edit`, `Write`, invokes the target repo's Node adapter from the Git root, and has a six-second host timeout. Existing event groups/metadata are preserved. Reinstall is idempotent; locally changed/missing/duplicate owned definitions block removal instead of guessing. The manifest tracks only our definition, not ownership of the entire hooks file. Removal may retain an empty hooks file. Remove this group before uninstalling runtime. Runtime updates retain the hook record; reconcile a changed definition explicitly.

The adapter is quiet by default: it reads the edited paths from the payload (`file_path`/`path` fields and `apply_patch` headers) and runs only quick checks whose `paths` cover them, plus the registry check when a registered rule references the file, and every quick check after a config/rules edit. A payload naming no path falls back to all quick checks. It adds context only when a relevant check has findings or errors; passing and unrelated edits stay silent. Set `GOV_HOOK_VERBOSE=1` in the hook environment to get a message for every event, which is the way to verify real triggering. Payload field names follow the documented schema but are not verified against a real host.

The adapter runs only built-in registry/links/size checks (no native commands), with a four-second subprocess timeout and 128 KiB output cap. It emits bounded `PostToolUse.additionalContext`, reports findings/errors, and exits 0 as advisory feedback. It cannot undo an edit or replace CI. Large selected scopes can time out; configure precise paths. If `node` cannot start, the host reports the command failure. Runtime errors and unavailable checks do not mean clean.

Verify separately (with `GOV_HOOK_VERBOSE=1` for the trigger observation): definition written, project/hooks trusted through Codex's normal flow, real successful edit, real violation, and real failure/timeout event with visible feedback. Use a throwaway repo/session for fault cases. Mock payload tests do not prove host discovery or trust. From a subdirectory, confirm Git-root resolution. After removal, run the ordinary checker to show it remains independent.

Status must say **configured / pending trust / triggered / not verified** as supported by actual observations. No persisted trust evidence or real event means not verified. Do not claim hooks enabled from a config file alone.
