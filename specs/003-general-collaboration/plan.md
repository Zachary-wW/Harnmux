# Implementation plan

Keep one service/SQLite and native adapters. Add mode/context/duty/input fields while preserving
legacy code submissions/packets. Conversation directories replace mandatory worktrees only in
conversation mode. Record text truncation explicitly.

Use private Git indexes and reachable commit snapshots for explicit code delivery reuse. Compute
patches from the same snapshot consumed by successors; preserve the user's index. Borrow the
workspace principle from Harness Mix, with original implementation and no team scripting system.

A SQLite result-report table records pending/starting/delivered/observed/unknown. Atomically reserve
reports with a receiving turn; mark native receipt via adapter observations. Pump after lifecycle
changes; recheck capacity/idle state and never revive stopped Leaders. Pending survives restart;
uncertain delivery does not replay. Borrow CodexHost's delivery semantics, not its in-memory watches.

Continue using explicit inputs and original goal. Add aggregate freshness checks without mutating
history. UI uses the same service/design tokens, actionable summaries and compact composer, informed
by 0xSero Local AI's thin shared-core approach. No model manager or new runtime dependency.

Verification: disposable repositories/scripted runners, native protocol fixture subprocesses, CLI
lifecycle and Swift build. Real model/GUI checks remain a separate deliberate acceptance step.
