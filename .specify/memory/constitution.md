# Harnmux Constitution

## Core Principles

### I. Native Execution and Independent Roles

Entry, Leader and Worker MUST be separately identifiable and selectable. Each member MUST use its
real harness execution loop. Model routing MUST remain a separate dependency. A DSH entry selecting
a Codex Leader and DSH Worker is a required first-class workflow, not a model substitution.

### II. Small, Explicit Boundaries

A single local task service MUST own task state and worker lifetimes. CLI and native UI MUST consume
that service. Each new infrastructure layer MUST state its user benefit and why a simpler option
fails. First release MUST prefer existing protocol components, including evaluating acpx, over
rewriting them. Native Desktop injection and a model gateway are outside the core.

### III. Isolated Changes and Native Approvals

Conversation members MUST use private retained working directories without requiring Git. Code
members MUST use independent Git worktrees based on explicit refs or explicitly selected sealed
delivery snapshots. Dirty entry changes MUST NOT be silently imported. Changes MUST remain
available for review; completion MUST NOT merge or discard them. Native approval requests MUST
reach a user decision or fail closed. Worktrees MUST NOT be described as security sandboxes.
Existing harness accounts, routers and plugins MUST NOT be silently reconfigured.

### IV. Durable Facts and Honest Capabilities

Task submission MUST be idempotent. Task state, events, results and notification acknowledgments
MUST persist locally. Ambiguous execution after failure MUST be reported as interrupted or unknown,
without automatic replay. Cancel requested and cancellation confirmed MUST be distinct facts.
Supported, unsupported and unverified capabilities MUST be distinguishable. Protocol fixtures,
real harness handshakes and paid model/Desktop end-to-end tests MUST be reported separately.

### V. Native, Accessible Presentation

The macOS UI MUST follow the project design system and native platform conventions. It MUST
prioritize approvals and actionable failures, distinguish execution from acceptance, support
light/dark appearance, keyboard and VoiceOver, and honor reduced motion. Closing the UI MUST NOT
cancel workers. Unknown progress MUST NOT be represented with invented percentages.

## Product Boundaries

The product supports conversation, research, writing and code collaboration. Conversation delivery
MUST be reviewable without a Git diff. Shared context MUST be explicit. Versioned deliveries MUST
identify the information and code actually handed to another member. Automatic reporting MAY start
a turn only in service-owned native sessions; uncertain delivery MUST NOT automatically replay.

First release targets local macOS, Codex and DSH, CLI/Skill entry, optional per-member models,
reviewable delivery, and a SwiftUI menu-bar client. Entry may create a remote-harness Leader which
may dispatch allowed Workers; Workers cannot recursively create teams. Existing DSH plugins remain
owned by DSH; plugin-specific compatibility is not a first-release acceptance prerequisite at the
user's request. Automatic native Desktop wakeup is capability-dependent, with durable query fallback.

## Development Workflow and Quality Gates

Use Spec Kit constitution, feature specification, plan, research, data model, contracts, tasks and
verification records. Meaningful tests MUST cover role authorization, protocol approvals,
idempotency, worktree isolation, cancellation and interrupted recovery. Native source MUST compile.
UI screenshots prove layout only. Dependencies MUST be locked. Deliver installation/run instructions
and limitations; never label a missing real integration test as passed. Managed Spec Kit templates
remain unchanged. Future agents consult feature artifacts before modifying the task contract.

## Governance

This constitution governs implementation decisions. Amendments MUST update the feature artifacts,
state their motivation and apply semantic versioning: major for incompatible principle changes,
minor for new obligations, patch for clarification. Changes MUST be reviewed against the principles
and supported by appropriate checks. User instructions and explicit scope decisions take precedence
over local workflow guidance. Ratification records the implementation baseline derived from the
user's Q1–Q5, Q9 and Q10 answers and subsequent corrections.

Amendment 2.0.0: user instruction on 2026-10-22 expands beyond coding. Replace universal Git
requirements with conversation/code environments and add managed-Leader reporting. Native approvals,
separate acceptance, no silent configuration changes and honest verification remain.

**Version**: 2.0.0 | **Ratified**: 2026-10-21 | **Last Amended**: 2026-10-22
