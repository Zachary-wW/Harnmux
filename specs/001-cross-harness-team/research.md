# Research decisions

- Decision: separate Entry, Leader and Worker; preserve Q9 fresh DSH worker. Rationale: model routing does not change harness control loop. Alternatives: fixed entry-as-Leader fails the explicit use case; Desktop injection adds unnecessary private coupling.
- Decision: Codex native app-server. Rationale: installed 0.142.5 schemas and no-model handshake verified. Native approvals are server requests, completion has a status that must be checked. Alternative codex exec lacks the needed interactive control. Evidence: docs/codex-protocol-probe.md.
- Decision: acpx 0.20.0 in-process runtime for DSH ACP. Rationale: fake native-protocol probe verifies model configuration, permission callback, denial fallback, cancellation and child environment separation. Alternative full custom ACP client duplicates existing work. Evidence: docs/acpx-runtime-probe.md. No real DSH test has passed yet.
- Decision: node:sqlite. Rationale: available in Node 22.23; no native third-party addon/build dependency. Alternative JSON files complicate atomic request dedup and event ordering. Experimental warning is documented.
- Decision: SwiftUI MenuBarExtra.window. Rationale: native macOS controls, long approval/details supported; independent Node service survives UI termination. Alternative Electron duplicates the user's existing Desktop UI. Sources: design-system/harnmux/MASTER.md.
- Decision: plugin-specific checks deferred. Rationale: user's Q10 overrides earlier proposed compatibility prerequisite; neither worker profile nor existing global plugin settings are migrated by the bridge.
- Decision: crash recovery marks active tasks interrupted; explicit continuation only when native session exists. Rationale: avoid duplicate side effects; no claim of automatic lossless recovery. Delivery and notices remain readable offline.

All implementation unknowns have conservative defined behavior; unavailable installed harnesses are a real-test limitation, not a reason to label simulation as production verification.
