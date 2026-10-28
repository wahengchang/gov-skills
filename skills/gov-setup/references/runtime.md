# Runtime contract — v0.2.0

Requires Node.js >=22.20.0. No npm install or Python dependency for the toolkit itself. Native commands require the target repo's own tools. The canonical runtime is the `runtime/` directory in this skill; setup vendors it to `.governance/runtime/`. CI runs that copy. Config and rules are project-owned, never deleted by update/uninstall. `.governance/manifest.json` owns only runtime paths/hashes and the optional hook definition.

## Configuration

`.governance/config.json` is strict JSON with `version: 1` and a nonempty `checks` array. Unknown fields (including baseline) are errors. Check `id` is unique lowercase letters/digits/hyphens, starting with a letter. All checks require `reason` and a nonempty `paths` list. Paths are literal repo-relative files/directories, no glob expansion; symlinks and escapes are refused. Missing paths are errors. `mode` defaults to `report`.

```json
{
  "version": 1,
  "checks": [
    {"id":"registry","kind":"registry","mode":"report","reason":"Keep adopted rule references valid","paths":[".governance/rules.json"]},
    {"id":"docs","kind":"links","mode":"report","reason":"Validate maintained Markdown navigation","paths":["README.md","docs"]},
    {"id":"native-tests","kind":"command","mode":"report","reason":"Reuse contract tests","paths":["src","tests"],"argv":["npm","test"],"cwd":".","timeoutMs":30000}
  ]
}
```

This is an example to adapt; do not register nonexistent example paths or execute example commands without inspecting the project. Setup's generated default adopts only registry integrity.

Kinds:

| Kind | Behavior / options |
| --- | --- |
| `registry` | Check all rule scope/source/proof references plus declared paths. Registry structure validation is always a prerequisite, even if this check is not selected. Reference existence does not verify behavior. |
| `links` | Recursively check Markdown relative links, images, reference links and ATX heading/HTML id anchors within declared paths. Balanced nested link text and images inside links are checked, including both image and outer link destinations. Ignore fenced/inline code and external URIs; no network requests. |
| `size` | Recursively measure declared files against optional positive `maxBytes` and/or `maxLines`. Only adopt budgets justified for this repo; no universal limit. |
| `command` | Explicit nonempty `argv` array, optional `cwd` (default repo root), `timeoutMs` 1–120000 (default 30000). Shell expansion is off. Exit !=0 is a finding; spawn/timeout/signal/overflow is an error. Output limit 1 MiB. |

Only `.git`, `node_modules` and AppleDouble metadata are excluded from recursive built-ins. Select precise paths; do not point links at the entire repo indiscriminately. The link checker implements a practical Markdown subset, not a site renderer: multiline inline links, setext headings, MDX expressions, HTML href links, embedded templates and framework routes require native documentation checks/semantic review. Non-Markdown fragments are flagged for manual validation. A machine pass applies only to the supported declared checks.

`command.paths` records the adopted scope and verifies paths exist; the native command defines its actual coverage. Paths are not automatically appended to argv. Inspect the command's scripts/dependencies and use a non-mutating check mode. The runner is not a sandbox and cannot guarantee an approved native command is read-only. It does not install dependencies or run generators automatically. Process timeout kills the process group on POSIX; native Windows termination uses the direct child. No universal OS test claim.

## Status

```sh
node .governance/runtime/cli.mjs status --root . [--json]
```

Read-only diagnosis for routing. It never runs registered `command` checks and writes nothing; built-in `registry`/`links`/`size` checks are run in report mode to learn whether they are clean. `--checks` is not accepted. Exit 0 whenever the repo could be diagnosed (invalid contracts and drift are states); 2 for an unreadable or unsafe root or usage error.

JSON fields: `state`, `adoption` (not-installed/partial/unknown/report/mixed/enforced), `verification` (not-run/partial/complete/error), `manifest`, `drift` (owned files that are missing/modified/unsafe/unreadable, with access errors attributed to that file; invalid identifies a malformed ownership manifest), `checks` (id, kind, mode, `status` pass/issues/error/not-run, finding count and errors), `activatable` (report-mode built-in checks with zero findings), `unverified` (checks not run), `problems`, `suggestions` (skill + reason), `exitCode`, `version` (installed manifest's toolkitVersion, or null when unavailable). `complete` means all declared checks were evaluated, not that they passed or that semantic coverage is complete.

States, in precedence order: `not-installed`, `partial` (manifest/config/rules not all present), `runtime-drift`, `invalid-contract`, `enforce-failing`, `ready-to-activate`, `adopting` (report/mixed modes remain), `enforced-unverified` (all checks enforce, but verification is incomplete), `healthy`. Registered commands stay unverified without making an enforced repo appear to be adopting. A state is a hint: `activatable` is not an activation, a selected batch still needs a fresh complete `activate`, and `healthy` covers only declared built-in checks, not semantic coverage. Preview/update/removal requests never become activation because of a hint.

The status bootstrap requires a present, valid manifest and checks owned hashes before importing core/io or reading project config. A missing manifest leaves the installation partial, with checks unloaded and verification not-run. With drift it reports unknown adoption and not-run verification, preserving the damaged files. If cli.mjs/status.mjs itself cannot start, or the target is an older version without status, use an intact installed setup bundle: `node "<skill>/runtime/cli.mjs" status --root "<repo>" --json`. That diagnoses the target without importing target modules. Daily skills without this bundle report unavailable diagnostics and continue useful native work; they do not silently install tooling. Ownership hashes detect changes relative to the manifest; they are not an authenticity guarantee for a deliberately rewritten manifest.

## Rule registry

`.governance/rules.json` must be an array (an empty array is valid). Each entry has only `id`, `owner`, `scope`, `source`, `proof`, `enforcement`. Unique rule IDs use the same syntax as check IDs. `owner` is a nonempty string; `scope` and `source` are nonempty path arrays; `proof` is a path array. Enforcement is either `{ "check": "registered-id" }` with nonempty proof, or `{ "textReason": "specific reason" }`. Never store a complete business spec or dependency map here.

## Commands and results

```sh
node .governance/runtime/cli.mjs report --root . --json
node .governance/runtime/cli.mjs activate --root . --checks registry,docs
node .governance/runtime/cli.mjs check --root .
```

`report` and `check` default to all checks; `--checks id,id` chooses an explicit subset. `activate` requires a nonempty unique explicit batch, reruns it, and atomically rewrites config only when every member completed with zero findings/errors. A failed batch changes no modes. A config/registry edit during the run makes evidence stale and prevents activation. Run without concurrent edits; native tools are trusted, and content changes outside config/registry require semantic freshness review.

Exit codes: `0` = execution completed without blocking findings (report findings may remain); `1` = enforce findings on `check`, or findings preventing `activate`; `2` = invalid contract, missing path/tool, timeout, execution or I/O error. Errors block even in report mode. No baseline or suppression field.

Text and `--json` expose the same results. JSON includes `action`, `root`, `results` (check, kind, mode, scope, status, findings, errors, optional native command observation), global `errors`, `activated`, `status`, `exitCode` and toolkit `version`. Machine `pass` covers only that execution; a skill still checks semantic coverage and freshness.

## Lifecycle

`node "<installed-skill>/scripts/setup.mjs" preview|apply|update|uninstall --root <repo>` prints JSON with actual operation paths. Preview writes nothing and describes the current-source deployment; use update to replace a differing clean owned version. Apply is idempotent for identical content. Existing valid config/rules are preserved; if an adopted installation loses either contract, restore it rather than silently resetting adoption. Conflicts, missing/edited owned files and symlinks abort the whole preflight. Update can remove obsolete owned runtime files; uninstall only removes unchanged owned runtime/manifest, retaining extra files. No Git staging/committing/reset/stash.

Writes use per-file atomic rename with preflight snapshots and best-effort rollback on ordinary failure. Replacing or restoring an existing file preserves its POSIX permission bits; new files use the process umask. Ownership, extended attributes and ACL preservation are not provided. Multi-file process interruption/disk failure is not a transactional filesystem; inspect state and reconcile before retry. No force option. Filesystem changes by concurrent processes are outside the supported operation window.

Setup does not modify CI automatically: adapt the installed template or existing workflow after the repo audit, using `node .governance/runtime/cli.mjs check --root .` after native dependencies. On uninstall remove obsolete CI references within the authorized cleanup.
