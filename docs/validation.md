# Validation status

## Current candidate

Local validation on 2026-10-28 for the v0.1.1 implementation; Node v24.22.1, Python 3.12.14 and skills CLI 1.7.4. This records the checks below, not universal platform support or a complete model-behavior acceptance run.

| Layer | Evidence / status |
| --- | --- |
| Runtime and lifecycle | `npm test`: 39 passing tests in isolated fixtures. The original 24 cases remain, with nine nested-link/reference/precedence regressions and six POSIX permission/rollback cases added. No failures or skipped tests on this Linux run. |
| Markdown protection | Enforced checks detect a broken image destination and a broken outer link independently; nested link text cannot hide a missing target or activate a broken check. Inner ordinary links deactivate enclosing ordinary link syntax without suppressing image destinations. Valid links, escaped delimiters/markers, normalized references, code exclusion and supported destinations are covered. |
| File permissions | Existing private config/hook files and executable bits survive replacement under different umasks. Rollback restores replaced/deleted files and modes; an intervening chmod aborts without overwriting the changed permissions. New files retain the prior umask policy. POSIX-specific tests skip Windows. |
| Different target tools | Copied setup skill deploys to Node and Python fixtures, then report, activate, check, update and uninstall. |
| Skill/corpus structure | `npm run validate`: seven reviewed entrypoints, frontmatter, 13 Markdown documents, 18 JavaScript modules and 14 routing-case definitions. Corpus validation checks structure and declared permissions, not model behavior. |
| Actual skills CLI install | `node scripts/test-install.mjs`: skills CLI 1.7.4 successfully installed all seven skills in copy/default modes and gov-setup alone in three temporary projects. The local candidate copy was removed before setup/report/activate/check; all 16 observed commands exited 0. This verifies local-candidate installation, not installation from the eventual GitHub PR URL. |
| Fresh-agent spot checks | Two isolated tasks used the available name/description catalog and actual skill files, without the case oracle or prior review conclusions. Root-commit review chose gov-check, found a real doc/implementation mismatch despite a passing native test, and changed no repository files or installed runtime. Tool-drift repair chose gov-maintain, changed only the stale command path, retained both enforce gates and product assertions, and reported the remaining product regression as partial. Separate post-run file hashes and config assertions confirmed those outcomes. |
| Routing acceptance | The [14-case corpus](../evals/README.md) is a reproducible specification; the entire corpus has not been run. The two spot checks are narrower evidence. Explicitly supplying a catalog does not establish automatic host skill discovery, routing accuracy across hosts, or latency gains. |
| Optional hooks | Lifecycle and mock PostToolUse payload tests pass, including violations, malformed config, child timeout and missing-node launch failure. Real host trust and edit-trigger acceptance remain unverified. |
| GitHub CI / required gate | This local record does not establish a remote required gate. Inspect the workflow result for the exact PR head and verify repository protection separately. |

## Historical evidence

The [initial commit's validation record](https://github.com/wahengchang/gov-skills/blob/d0f841722681034f5b83e63e49439c4f04995fd6/docs/validation.md) reports four fresh Codex CLI 0.159.3 sessions and six-skill installation acceptance. Those sessions evaluated the earlier instructions and are not evidence that the new routing contract or all 14 cases pass. The initial commit's remote workflow subsequently succeeded; that result does not validate this candidate.

## Known limits

Built-in Markdown parsing remains a documented subset rather than a site framework. Native commands are reviewed trusted entrypoints, not sandboxed. Permission preservation covers POSIX mode bits, not owner/group, ACLs or extended attributes. Installation requires no concurrent edits and cannot guarantee rollback after process death or filesystem failure. No OS matrix, chosen license, fully executed routing corpus or real-host hook acceptance is claimed.
