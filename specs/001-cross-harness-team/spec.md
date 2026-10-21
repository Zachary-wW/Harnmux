# Feature Specification: Local Cross-Harness Team

**Feature Branch**: `main` (feature directory independent of branch)
**Created**: 2026-10-21
**Status**: Implementation baseline
**Input**: User requests a local open-source MVP: native harness collaboration, independent entry/Leader/Worker, reviewable worktrees, retained approvals and a polished macOS status UI. Plugin-specific work is deferred.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Select a Leader independently of the entry (Priority: P1)

A user remains in DSH, selects Codex as Leader and DSH as the available Worker. Codex plans and issues concrete tasks, DSH executes, and the result returns for Codex review and user inspection. Reversing the two harnesses uses the same task operations.

**Why this priority**: It proves native cross-harness cooperation rather than swapping a model.
**Independent Test**: Submit a run with distinct entry, Leader and Worker; observe separate native session identities and a child task created by the Leader.
**Acceptance Scenarios**:
1. **Given** configured native harnesses, **When** a run names its Leader and allowed Workers, **Then** entry does not determine Leader and each execution uses the specified harness.
2. **Given** a Leader session, **When** it dispatches an allowed Worker, **Then** the child is linked to its parent and results are queryable by the Leader.
3. **Given** a Worker credential, **When** it attempts further dispatch, **Then** the service refuses.
4. **Given** a repeated submission identifier, **When** retried, **Then** exactly the existing task is returned, or conflicting content is rejected.

### User Story 2 - Execute with reviewable changes and approvals (Priority: P1)

Each execution gets an isolated repository branch/worktree. The user handles native approval requests, selects a member's supported model, and receives changes and validation records without automatic merging.

**Why this priority**: Useful collaboration must preserve control and changes.
**Independent Test**: Use a disposable committed Git repository, a controlled native-protocol executable and an approval-requiring turn; approve/reject and inspect isolated changes.
**Acceptance Scenarios**:
1. **Given** a committed repository, **When** execution starts, **Then** the original directory remains unchanged and the worktree/branch is recorded.
2. **Given** a pending native request, **When** the user permits once or rejects, **Then** the matching request receives exactly that decision.
3. **Given** an unsupported model or unavailable harness, **When** started, **Then** it fails clearly without silently selecting a different model or weakening permissions.
4. **Given** completed execution, **When** inspecting delivery, **Then** result, diff and actual validation output remain available and no merge or cleanup has happened.

### User Story 3 - Observe, continue and cancel reliably (Priority: P2)

Users inspect tasks from their current harness or macOS menu bar, continue retained sessions, handle approvals and cancel execution. UI may close while workers run.

**Why this priority**: Users need a dependable single working context.
**Independent Test**: Start the service, attach/close the UI, query results and pending events, continue a session, cancel a controlled turn, then restart the service.
**Acceptance Scenarios**:
1. **Given** a disconnected UI, **When** opened again, **Then** persisted tasks/results remain queryable.
2. **Given** an active task at service interruption, **When** restarted, **Then** it is reported interrupted with no automatic replay or false success; stale approvals cannot authorize a new turn.
3. **Given** a running turn, **When** cancelled, **Then** cancellation remains pending until confirmed or a bounded process-termination fallback reports its actual outcome.
4. **Given** a saved result, **When** no native wakeup is available, **Then** the status UI highlights it and the current harness can query it.
5. **Given** keyboard/VoiceOver and either appearance, **When** using the UI, **Then** primary task and approval actions are labeled and reachable.

### Edge Cases

- Missing binaries, empty/uncommitted repositories, explicit refs, dirty entry directory, invalid target paths, worktree failure.
- Duplicate/conflicting requests, wrong-role credentials, stale task tokens, body/output size limits, unrelated child access.
- Exit during pending approval, late protocol responses, refusal, unknown native requests, full event buffers.
- Cancel racing completion, repeated cancel/approve, process exit, service crash, continuation after interruption.
- DSH profile differs from Desktop; existing settings remain untouched, individual plugins are not a release gate.
- Native wakeup/session UI unavailable: expose limitations, retain query fallback.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Entry, Leader and Worker MUST be separate recorded identities, with Codex/DSH selectable for execution roles.
- **FR-002**: A Leader MUST dispatch only allowed Workers; Workers MUST NOT create more team members.
- **FR-003**: Submission MUST deduplicate identifiers and reject conflicting duplicates.
- **FR-004**: Each member MUST execute in an independent worktree using an explicit committed baseline; dirty entry changes MUST NOT be silently copied.
- **FR-005**: Native session/model configuration MUST be local to the member and MUST NOT rewrite shared harness/router/plugin settings.
- **FR-006**: Native approval requests MUST be identifiable, visible and answered once, or rejected/expired without implicit authorization.
- **FR-007**: Tasks, bounded events, results, native references, changes and notification acknowledgments MUST persist locally.
- **FR-008**: Task operations MUST include create, list/status, result, continue and cancel; child results MUST be accessible to their Leader.
- **FR-009**: Cancellation and interrupted/unknown states MUST be explicit; uncertain operations MUST NOT automatically replay.
- **FR-010**: Delivery MUST retain worktrees and distinguish execution completion from user acceptance.
- **FR-011**: Menu-bar UI MUST show roles, connection freshness, pending approvals, activity and recent deliveries, with labeled keyboard-accessible controls and light/dark appearance.
- **FR-012**: UI closure MUST NOT cancel service-owned execution; ordinary events MUST NOT flood notifications.
- **FR-013**: Capability and verification reports MUST separate supported, unsupported and unverified behavior, including native wakeup and plugin-specific compatibility.
- **FR-014**: Entry integration MUST require no vendor Desktop injection and MUST provide an explicit query fallback.
- **FR-015**: Local control access MUST authenticate callers, restrict role scope, and keep credentials out of ordinary results/logs.

### Key Entities

- **Profile**: harness, optional model and native executable configuration; references existing native settings.
- **Task**: request identity, entry, role, parent, allowed profiles, instructions, lifecycle and execution evidence.
- **Workspace**: source repository, resolved baseline, isolated branch/worktree and retained change summary.
- **Approval**: task/native request, human-readable details, options, pending/answered/expired lifecycle.
- **Event/Delivery**: sequenced bounded execution facts, result and unread/acknowledged completion notice.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Both Codex→DSH and DSH→Codex role assignments complete a controlled dispatch/result cycle without changing the user's entry application.
- **SC-002**: Ten repeated identical submissions create one task; conflicting reuse is rejected.
- **SC-003**: Approval allow/reject, cancellation and interrupted restart scenarios produce zero unintended authorization or automatic task replays in controlled checks.
- **SC-004**: Changes from controlled execution remain entirely in the recorded worker directory, with original files unchanged and no automatic merge.
- **SC-005**: Users can inspect activity, handle a pending approval and open delivery details from a single status panel; results survive UI closure/service restart.
- **SC-006**: Release records enumerate every unperformed real harness/Desktop check instead of treating simulations as real validation.

## Assumptions

- Local macOS; users have committed Git repositories and separately installed/authenticated harnesses.
- No account/router/plugin installation or configuration migration is included.
- A fresh DSH worker is acceptable; specific plugin compatibility is deferred by explicit user instruction.
- Native Desktop wakeup is optional; queryable durable results are mandatory.
- Initial team depth is Entry→Leader→Worker, with bounded concurrency and no automatic merge.
