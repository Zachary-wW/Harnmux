# Feature: General collaboration and explicit handoffs

Created 2026-10-22. Supersedes features 001/002 only for mandatory Git, code-only acceptance and
the absence of service-owned Leader reporting. All other guards remain.

## User scenarios

1. Ask Codex to coordinate discussion, research or writing with a DSH contributor without a repo.
   Continue the retained conversation and review text without a fabricated diff. Members retain
   private working directories; native tools remain available under native approvals.
2. Provide shared context and exact earlier delivery references. The next member receives selected
   reports, identities and original goal. A code member may explicitly use a sealed code snapshot,
   including its uncommitted tracked/nonignored files. Entry dirty files are never silently copied.
3. A worker finishes after the Leader turn. With auto-report enabled, save the report, wait for an
   idle Leader and start one follow-up in its native session. Reading the child packet consumes a
   pending report. Cancellation/error/interruption suppresses unattended continuation; unknown sends
   never replay after restart.
4. The menu bar offers a compact composer and shows who or which decision blocks progress. Reports,
   reviews and optional code details remain distinct. No replacement chat shell is required.

## Requirements

- FR-001: mode conversation|code; no-repo default conversation; legacy repo requests stay code.
- FR-002: Private retained conversation directory without Git; successful nonempty untruncated text
  is acceptable without a diff. Code retains full-capture requirements.
- FR-003: Record shared context, original goal and optional duty. Duty grants no extra authority.
- FR-004: Input taskId/turn/digest is authorized and copied into immutable contracts. Wrong digests,
  unrelated scoped tasks and oversized context fail. Source reports are data, not authorization.
- FR-005: Explicit code sources require complete successful code packets with reachable snapshots
  in the same repository. Later worktree edits cannot alter selected input.
- FR-006: One persistent report per sealed child turn. Reserve report and receiving Leader turn
  atomically; wait for busy Leaders. Native receipt is distinct from reservation.
- FR-007: Restart changes in-flight report to unknown, no retry. Pending stays queryable; stopped
  Leaders need deliberate continuation. No Desktop injection or implicit approval.
- FR-008: Current aggregate acceptance validates current child versions. History is immutable;
  new child revisions/unfinished members block stale aggregate acceptance.
- FR-009: CLI/Skill/API/native UI support general tasks, stable submission IDs and next-action state.
- FR-010: Preserve native settings/routers/plugins; report unverified native-model/GUI behavior.

## Success criteria

- SC-001: Both assignments complete controlled no-repo conversations, continuation and text acceptance;
  empty/truncated answers cannot be accepted.
- SC-002: Exact context/report and code snapshot handoff works; unrelated inputs fail. Source files
  and index stay intact; external edits do not change consumed snapshot.
- SC-003: Busy/idle/duplicate/cancel/restart checks produce no duplicate automatic turn. Unknown does
  not replay; prior packet reading avoids unnecessary wakeup.
- SC-004: Stale aggregate acceptance fails; existing checks pass and native source builds.

## Scope

One service/SQLite and existing adapters/CLI/Skill/SwiftUI. No universal chat-history migration,
automatic browsing of private chats, unrestricted worker messaging, model manager or session-tree
embedding. Files remain retained; binary attachment upload/rendering is outside this text iteration.
