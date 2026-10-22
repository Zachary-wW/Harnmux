# Verification — 2026-10-22

## Implemented and checked

- `npm run check` and `npm run build`: passed (TypeScript).
- `npm test`: **31/31 passed**. Includes 19 prior checks plus 12 collaboration checks; the CLI
  lifecycle test also exercises no-repo conversation, shared context, duty, explicit input and manual reporting.
- `npm run ui:build`: debug Swift build passed.
- `npm run ui:bundle`: release Swift build and local ad-hoc signing passed; output is
  `/Users/weizhihao/Projects/Agents/harnmux/dist/Harnmux.app`. No distribution/notarization claim.
- `git diff --check`: passed.

## Meaningful controlled evidence

| Contract | Evidence |
| --- | --- |
| No mandatory Git | Both native adapters run/continue against protocol fixture subprocesses in private no-Git directories; no worktree/diff is fabricated; text acceptance succeeds |
| Complete answers | Empty, explicitly truncated and service-overflow answers cannot be accepted |
| Exact context and scope | Shared background/duty reach members; selected answer/digest enters prompt and sealed contract; mismatched digest and unrelated task input fail; worker cannot read sibling |
| Bounded handoff | Combined oversized reports fail before creating the next task, without silent omission |
| Code continuity | Snapshot includes staged/working/untracked files, source staging remains identical, later external edits do not change a successor's files; source repo remains unchanged |
| Automatic report | Busy Leader waits; idle Leader resumes after late completion in same native session with exact report; one report/receiving turn, no duplicate on another completion |
| Active observation | Leader packet read marks pending report observed and avoids an extra automatic turn |
| Cancellation | Completed Leader cancellation disables automatic revival and stops its active child; existing unconfirmed-cancellation test still passes |
| Crash/uncertainty | Reserved receiving turn restores interrupted and report unknown without replay; pre-receipt transport failure remains unknown; explicit selected input permits a deliberate new receiving turn |
| Freshness | Child revision blocks old aggregate acceptance while old packet/digest remain unchanged |
| Existing contracts | Prior scoped API, approvals, model selection, redaction, failure, binary patches, idempotency, immutable reviews and CLI lifecycle checks pass |

Fixtures are our own Codex JSON-RPC and DSH ACP subprocesses, not installed native harnesses or real
models. DSH's fixture requests native permission even for conversation; the test explicitly rejects
that controlled write and checks the response. An initial development run waited on that fixture
approval; it was stopped, the test driver was corrected to decide the approval, and the complete suite
then passed. No native approval was bypassed or model account called.

## Native/UI evidence and limits

The earlier Codex initialize handshake is historical evidence only, not this feature's real-model
validation. Earlier environment checks found DSH installed inside DeepSeek Harness.app but absent
from PATH; that is not a claim that DSH is unavailable. See prior research for exact version/path.

This iteration did **not** run real Codex/DSH model teams, test real DSH plugins/router profiles,
or interactively validate MenuBarExtra. It changed no global account, model, plugin or Desktop settings.
Swift compilation and native semantic controls do not prove visual contrast, keyboard focus, VoiceOver,
large text, long approvals, offline recovery or pending-submission UI behavior. Those remain explicit
real-use checks. Existing static design images predate the new composer and are not feature screenshots.

Capabilities endpoint distinguishes implemented operations from installed-harness certification.
Automatic reporting is only for Harnmux-owned sessions; arbitrary Entry Desktop wakeup is unsupported.
Git snapshots are Git trees; ignored files, external files, dependency environments and dirty submodule
working contents are not copied. Binary/image chat attachments are outside this text release.
