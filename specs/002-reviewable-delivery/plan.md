# Implementation Plan: Harnmux Reviewable Delivery

Reuse the existing TypeScript service/SQLite/API/CLI and SwiftUI panel. Rename identifiers and source
folders without changing native configuration. Add two small SQLite tables for immutable packets and
append-only review receipts; snapshots continue to serve current task state. No new runtime dependency.

Packet JSON has a SHA-256 integrity reference, original baseline and explicitly separate native observations
and model report. Capture uses binary patches where possible and marks incomplete/truncated capture.
A packet is sealed after native turn cleanup. Current task stores its digest and latest separate
Leader/user receipts; prior packets/receipts remain untouched. Observations are bounded and explicitly
label their origin, retention limits and non-verification of model assertions.

CLI adds repeated --criterion, packet and review. API uses existing authentication and scope checks.
Only admin/user can accept; Leader can recommend/request changes for its own children. Require exact
current turn/digest and no active execution. Acceptance/recommendation additionally requires completed state,
full diff capture and completed/sealed member references; request_changes can describe failed/incomplete packets. Record receipts
and current summary atomically; continue clears only the current review/delivery pointers.

SwiftUI shows contract, packet reference, Leader review and user acceptance with a note. It never
selects acceptance implicitly or merges changes. Validate source build and controlled lifecycle,
permissions, immutable history and stale review races. Native GUI/model limits remain explicit.

Constitution: native loops, worktrees, approvals and one service preserved. Packet and receipt tables
are justified by the prior implementation overwriting per-task result on continuation and lacking an
explicit acceptance record. A separate event bus, workflow language or artifact service is unnecessary.
