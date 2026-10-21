# Feature Specification: Harnmux Reviewable Delivery

**Feature Branch**: `main` | **Created**: 2026-10-21 | **Status**: Implementation baseline
**Input**: Rename project Harnmux and establish a concrete differentiation from existing harness connectors.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Identify exactly what was handed back (Priority: P1)

The user submits acceptance criteria. Every completed turn produces a fixed delivery packet containing
its task contract, original baseline, harness/session/model, model report, captured changes and
separately identified observations from the native harness. Continuing work never overwrites the old packet.

**Why this priority**: A connector invocation alone does not tell the user which deliverable was reviewed.
**Independent Test**: Complete two controlled turns and compare the first packet before/after continuation/restart.
**Acceptance Scenarios**:
1. Given submitted criteria, when a member starts, then its prompt and packet carry those criteria.
2. Given finished execution, when exported, then one stable packet identifies its turn and content digest.
3. Given a new turn or service restart, when retrieving a prior packet, then its content/digest are unchanged.

### User Story 2 - Review a specific delivery without merging (Priority: P1)

The Leader recommends acceptance or requests changes; only the user marks the reviewed packet accepted.
Both decisions name the exact turn and packet digest. Reading a result is separate from accepting it.

**Why this priority**: Avoid accepting a later revision using an old review, or calling model confidence validation.
**Independent Test**: Submit valid/wrong-digest/stale-turn and wrong-role decisions; inspect retained receipts.
**Acceptance Scenarios**:
1. Given a child packet, when its Leader recommends acceptance, then user acceptance remains unset.
2. Given an active task, old turn, wrong digest, incomplete diff or failed execution, when accepted, then refuse.
3. Given a current complete delivery, when the user accepts with a note, then retain the receipt without merging.
4. Given UI/CLI, when inspecting a finished task, then show execution, Leader review and user acceptance separately.

### Edge Cases

- Old tasks lacking packets remain queryable; no fabricated retroactive evidence.
- Capture failure, truncated or binary changes, missing native observations, cancelled/failed turns.
- Parent packets reference member turn/digest; unfinished or unsealed members block acceptance.
- Failed/incomplete terminal packets can receive change requests, but not acceptance/recommendation.
- User accepts while a new turn starts; old packet export after event eviction or process restart.
- A packet is a local integrity reference, not a signature, live worktree attestation or proof of correctness.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: User-facing project, CLI, Skill, app and state names MUST use Harnmux consistently; prior state is not deleted.
- **FR-002**: Tasks MAY include explicit acceptance criteria, preserved in prompts and per-turn packets.
- **FR-003**: Each terminal turn MUST attempt an immutable packet; failure MUST be visible and block acceptance.
- **FR-004**: Packet MUST distinguish model-authored report from native observations and captured diff, with truncation/absence explicit.
- **FR-005**: Prior packets and review receipts MUST survive continuation and restart.
- **FR-006**: Leader recommendations and user acceptance MUST remain separate, scoped and bound to turn plus packet digest.
- **FR-007**: Stale/wrong-digest/active/incomplete/unsuccessful acceptance MUST be rejected; decisions MUST NOT merge or execute code.
- **FR-008**: CLI and native panel MUST expose packet/criteria/review operations; acknowledgment MUST remain separate.
- **FR-009**: Competitive claims MUST cite primary sources and separate implemented, verified and planned capabilities.

### Key Entities

- Task contract: instructions plus acceptance criteria, source baseline and execution identity.
- Delivery packet: immutable per-turn snapshot, digest, model report, delivery and bounded native observations.
- Review receipt: reviewer role, referenced packet/turn, decision, note and timestamp.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Earlier packet contents remain identical after a second turn, mutable worktree edits and restart.
- **SC-002**: Controlled tests reject every wrong-role/stale/wrong-digest/active/incomplete/failed acceptance attempt.
- **SC-003**: Leader recommendation never marks user acceptance; acknowledging never marks acceptance.
- **SC-004**: Existing delegation/protocol tests still pass, CLI lifecycle works under Harnmux and native app builds.

## Assumptions

No new model gateway, scheduler, automatic test runner, merge engine or Desktop injection. Native
observations are harness-reported facts, not independent test execution. Digest identifies exported
content only; ignored files, Git metadata and later worktree edits are outside the snapshot. Complete
binary patches are captured when within bounds; oversized/missing diffs cannot be accepted by this flow.
Original names may appear in historical evidence and third-party repository links. Existing native
configuration and old Harnmux-predecessor state directories remain untouched.
