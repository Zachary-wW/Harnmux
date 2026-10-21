# MVP verification record

Date: 2026-10-21, macOS arm64. This is a runnable source MVP with explicit integration limits,
not a claim that real model teams or all native Desktop behaviors are production-validated.

## Environment

- Node 22.23.3; npm 10.9.9; Swift 6.3.3; macOS target >=14.
- Codex CLI 0.142.5 at both the default PATH executable and the separately probed local path.
- acpx 0.20.0; Zod 4.6.5; ACP SDK 1.9.0 for the controlled fixture.
- `dsh` not found on PATH. No claim about installations outside PATH.
- No real model turn was invoked. Native credentials/config files were not read or modified.

## Executed checks

| Check | Result | What it establishes |
| --- | --- | --- |
| `npm run build` | PASS | TypeScript strict compilation and runnable CLI output |
| `npm run check` | PASS | Type checking, including adapter contracts |
| `npm test` | PASS, 14/14 | Controlled service/API and real subprocess protocol fixtures |
| `npm run ui:build` | PASS | SwiftUI debug source compilation |
| `npm run ui:bundle` | PASS | Release app bundle and ad-hoc signing |
| CLI lifecycle in isolated HBRIDGE_HOME | PASS | Start, idempotent start, doctor, empty list, authenticated stop; process exited and discovery/lock removed |
| Skill installer in disposable project | PASS | Absolute Node/CLI command, refusal to overwrite, existing file unchanged |
| Dependency lock update/audit | PASS | Lockfile consistent; npm reported zero known vulnerabilities at this run |
| Codex stdio initialize only | PASS | Actual installed app-server handshake, no native thread or model turn; see protocol probe |
| Standalone acpx fixture probe | PASS | Exported runtime/session/model/permission/cancel semantics with a synthetic ACP agent |
| Native UI via Computer Use | BLOCKED | Two getApp attempts returned server -10005 timeoutReached; no actual interaction claim |

Controlled test coverage:

1. Each adapter starts an actual synthetic JSON-RPC/ACP subprocess, selects a model, allows one
   approval, captures isolated changes, resumes a native session and cancels a held turn.
2. Each adapter rejects approval without modifying the source or worker file.
3. Missing executable, unavailable DSH model and native failed turn fail explicitly; Codex chooses
   its completed final answer over streamed commentary.
4. Both role directions complete scoped dispatch/result cycles through the HTTP API. The Leader
   behavior in these two tests is scripted, not model-generated planning.
5. Ten duplicate submissions return one task; conflicting content is refused. Worker dispatch,
   disallowed member selection and task-token approvals are refused.
6. Original source stays unchanged; tracked changes and new filenames (including leading spaces)
   appear in retained delivery. Active scoped secrets are redacted from events, result and diff.
7. Independently ended native execution expires orphaned approvals; late callbacks cannot write
   to a closed store. Changed profile harness cannot resume an old native session.
8. Interrupted restart expires pending decisions, never replays execution; cancelled approvals
   cannot be authorized later. A nonresponsive runner enters cancelling, requests stop after five
   seconds and becomes interrupted, not falsely confirmed cancelled.
9. Local API rejects missing authentication, browser Origin, unrelated Host, invalid fields and
   concurrent service ownership.

The 14 tests include several assertions per scenario. They prove these controlled boundaries,
not the availability, model quality, plugin behavior or permission policy of a user's installation.

## UI evidence

The SwiftUI implementation includes a menu-bar status count, task list, role/harness/model/session
details, exact native approval options, report/diff/events, Finder reveal, continuation, cancellation,
unread acknowledgment and cached offline list. Polling belongs to the app model rather than popup
lifetime; execution belongs to the separate service. No custom animation is used.

The design study in `design-system/harness-bridge/previews/` uses synthetic data and a separate
offscreen rendering script. It was visually reviewed in light/dark form; its measured contrast
does not certify actual system materials or the running product. Native keyboard focus, Tab/
Shift-Tab, Escape, VoiceOver, actual light/dark contrast, long approval scrolling and clicking a
real approval in the delivered app remain **UNVERIFIED**, because Computer Use could not attach.

## Real acceptance still required

| Scenario | Status | Needed evidence |
| --- | --- | --- |
| DSH entry → Codex Leader → DSH Worker using real models | UNVERIFIED | Installed/authenticated DSH; actual Leader-issued dispatch; native identities; real change/test result and Leader review |
| Reverse DSH Leader → Codex Worker with real models | UNVERIFIED | Same evidence in reverse roles |
| Real Codex approval, loopback CLI access, continuation/cancel | UNVERIFIED | Native workspace/network approvals, completed/failed/interrupted facts under installed configuration |
| Real DSH ACP approval/model/continuation/cancel | UNVERIFIED | Installed version and actual native protocol trace without credentials |
| Current Desktop Skill discovery and tool execution | UNVERIFIED | Load shared Skill from each entry; query saved task without changing entry application |
| UI closure/relaunch while native task runs | UNVERIFIED | Real GUI lifecycle and fresh counts; controlled persistence and CLI lifecycle are already tested |
| DSH-specific plugins | DEFERRED by Q10 | No individual plugin release gate; global configuration remains native-owned |
| Native Desktop wakeup/session tree projection | UNSUPPORTED | Query fallback is implemented; these are outside MVP |

Use `quickstart.md` and README with a disposable committed repository for deliberate real-model
verification. Record a failed prerequisite as blocked/unverified rather than substituting fixture
success. A process/API scope is not a sandbox against another process running as the same OS user.

## Spec Kit consistency and convergence

Official prerequisites script returned this feature directory and all required artifacts. No
extensions.yml hooks exist. Read-only spec/plan/tasks analysis found zero unresolved conflicts,
zero ambiguous placeholders, zero duplicate requirements and zero unmapped tasks. Coverage is
21/21 requirements/success criteria with tasks (100%); it is not a real-acceptance pass rate.

| Source | Tasks | Evidence / limit |
| --- | --- | --- |
| FR-001 | T003,T006,T007,T009 | Independent roles, both controlled directions |
| FR-002 | T006,T007,T008 | Scoped allowlist and recursive dispatch denial |
| FR-003 | T004,T006 | Stable duplicate and conflict checks |
| FR-004 | T005,T006,T020 | Resolved baseline, independent retained worktrees |
| FR-005 | T003,T011,T012,T019 | Per-native model config, resume identity validation |
| FR-006 | T004,T010–T013,T018 | Allow/reject/expire, orphan cleanup, oversized fail-closed path |
| FR-007 | T004,T005,T013,T020 | SQLite, bounded events/output, retained changes |
| FR-008 | T007,T008,T011–T013,T019 | CLI/API task operations and native resume fixtures |
| FR-009 | T004,T011–T013,T018 | Cancel confirmation versus interruption; no replay |
| FR-010 | T005,T009,T020 | Retained delivery; no automatic merge or acceptance |
| FR-011 | T014,T015 | Compiled native UI; interaction/accessibility acceptance pending |
| FR-012 | T007,T014 | Independent service, UI-owned polling, no notification flood |
| FR-013 | T008,T016,T022 | Capabilities/doctor plus this honest verification record |
| FR-014 | T008,T009 | Shared CLI/Skill, no Desktop injection, query fallback |
| FR-015 | T003,T006–T008,T020 | Private discovery, Bearer scope, redaction assertions |
| SC-001 | T006,T021 | Both controlled directions; real-model decisions unverified |
| SC-002 | T004,T006 | Ten repeated requests and conflicting reuse |
| SC-003 | T010,T013,T018,T021 | Approval/cancel/restart controlled checks |
| SC-004 | T005,T006,T020 | Tracked/new file isolation and retained diff |
| SC-005 | T013–T015,T021 | Implemented panel/actions; native interaction acceptance pending |
| SC-006 | T016,T017,T022 | Real and simulated evidence separated |

Convergence identified five partial areas, appended T018–T022 and completed the code/documentation
work. The implementation has no known unbuilt core requirement from this assessment. The external
acceptance checks above remain open; a checked implementation task never overrides that status.
