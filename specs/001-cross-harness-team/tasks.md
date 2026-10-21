# Tasks: Local Cross-Harness Team

Input: spec.md, plan.md, research.md, data-model.md and contracts/api.md.

## Phase 1: Setup
- [x] T001 Record constitution, feature and design contracts in .specify/memory/constitution.md and specs/001-cross-harness-team/.
- [x] T002 Pin runtime/tooling dependencies in package.json, package-lock.json and tsconfig.json.

## Phase 2: Foundation
- [x] T003 Implement validated task/profile contracts and private state discovery in src/types.ts and src/config.ts.
- [x] T004 Implement atomic dedup, events, approvals and interruption recovery in src/store.ts.
- [x] T005 Implement isolated Git worktrees and retained diff capture in src/workspace.ts.

## Phase 3: US1 — Independent roles
- [x] T006 [US1] Add role/dedup/workspace acceptance tests in tests/service.test.ts.
- [x] T007 [US1] Implement scoped Leader/Worker orchestration in src/service.ts.
- [x] T008 [US1] Implement authenticated HTTP and CLI operations in src/server.ts and src/cli.ts.
- [x] T009 [US1] Write shared native entry/Leader Skill and profiles example in integrations/harnmux/SKILL.md and examples/team.json.

## Phase 4: US2 — Native execution/approval
- [x] T010 [US2] Add fake newline RPC and ACP executables and adapter integration checks in tests/fixtures/ and tests/adapters.test.ts.
- [x] T011 [US2] Implement bounded Codex transport, approval and cancel in src/adapters/rpc.ts and src/adapters/codex.ts.
- [x] T012 [US2] Implement acpx DSH execution, model and permission lifecycle in src/adapters/dsh.ts.

## Phase 5: US3 — Durable observation/native UI
- [x] T013 [US3] Test stale approvals, continuation, cancellation and restart in tests/service.test.ts and tests/server.test.ts.
- [x] T014 [US3] Implement menu-bar activity, native decisions, delivery details and offline state in macos/Sources/Harnmux/.
- [x] T015 [US3] Bundle the native UI and verify Swift build using macos/Package.swift and scripts/build-macos.sh.

## Phase 6: Review/delivery
- [x] T016 Document real vs simulated evidence, limits and runnable installation in README.md and specs/001-cross-harness-team/verification.md.
- [x] T017 Run npm checks/tests/build, Swift build, diff hygiene and spec coverage analysis; fix findings in relevant source files.

## Dependencies and execution

T001–T005 precede role/service work; US1 uses a controlled execution seam before native adapters.
US2 shares that seam; US3 consumes the same API. Execute serially; independent protocol research
was delegated before implementation. No parallel production ownership is assumed.

## Independent validation

US1: role identity and authorized dispatch, repeat/conflict dedup, retained source isolation.
US2: fake native subprocess event/approval/cancel/model tests, plus separately recorded real handshake.
US3: restart/offline/continued state tests, compiled native UI; live UI interaction remains separately recorded.

## Implementation strategy

Deliver task/service contracts first, then both real protocol adapters and native UI, then exercise
complete controlled dispatch cycles and record installed-harness limitations. Do not stop after scaffolding.

## Phase 7: Convergence

- [x] T018 Release orphaned approvals and guard late native callbacks in src/service.ts per FR-006/FR-009 (partial).
- [x] T019 Validate retained profile harness before continuation and refresh model identity in src/service.ts per FR-005/FR-008 (partial).
- [x] T020 Prefer final native answer with explicit output bounds and verify untracked delivery in src/adapters/ and tests/ per FR-007/FR-010 (partial).
- [x] T021 Verify reverse delegation, unavailable native executable/model and local CLI lifecycle per SC-001/US2/AC3/US3/AC1 (partial).
- [x] T022 Complete source installation, open-source license, current discovery notes and honest UI/native verification records per FR-013/SC-006 (partial).

Implementation tasks are checked against source and controlled checks. Real-model/Desktop and
manual accessibility acceptance remain unverified as recorded in verification.md; task completion
is not a claim that these environment-dependent acceptance checks passed.
