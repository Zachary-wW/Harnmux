# Harnmux rename and delivery verification

2026-10-21, macOS arm64, Node 22.23.3 / Swift 6.3.3. Extends feature 001's historical baseline.

| Check | Result | Scope |
| --- | --- | --- |
| TypeScript check/build | PASS | Strict typing, compiled renamed CLI/API |
| Controlled automated suite | PASS, 19/19 | Prior 14 + four delivery scenarios + CLI lifecycle |
| SwiftUI release bundle | PASS | `dist/Harnmux.app`, ad-hoc signed; source build only |
| Branded static design export | PASS | Light/dark PNG inspected; synthetic offscreen study |
| CLI/Skill isolated lifecycle | PASS | Start, fixture task, criteria, packet, accept, ack, continue, history, stale rejection, installer/overwrite refusal, stop/discovery removal |
| Spec Kit prerequisites | PASS | Spec, plan, tasks and supporting artifacts discovered for feature 002 |

## Coverage

- FR-001 / T001: directory, package/bin, environment, app/target/bundle, shared Skill and design names
  changed to Harnmux; previous state directory untouched. Static preview rebuilt with new name.
- FR-002 / T002: criteria in native prompt/packet, inherited by child, explicitly revised on continue.
- FR-003–FR-005 / T002–T003: insert-only per-turn packet, SHA-256, binary diff, separate native events
  and model claims; truncation explicit. First packet survives external edits, continuation, event
  eviction and restart. Duplicate sealing refused; old tasks receive no fabricated packet.
- FR-006–FR-007 / T003,T005: owning Leader recommendations separate from user acceptance; worker/
  self/wrong-role denial, wrong digest and stale/active turn rejection. Failed/truncated packet refuses
  acceptance but permits request_changes. Unfinished/unsealed member references block parent acceptance.
- FR-008 / T004: CLI/API criteria/packet/review, scoped packet export and await-finalization semantics;
  ack remains separate. Native panel displays criteria, digest, separate decisions and explicit note;
  user can copy packet or submit a review. Native GUI interactions remain unverified.
- FR-009 / T006: fixed-commit primary-source research, README comparison, overlapping competitor
  features acknowledged; no claim of global exclusivity or all-harness compatibility.

SC-001–SC-003 have controlled evidence above. SC-004 has compiled CLI lifecycle, prior protocol suite
and Swift build evidence; it does not imply real-model or Desktop certification.

## Limits and open acceptance

Native DSH is absent from PATH; no real model turn was invoked. No native account/router/plugin
settings were modified. Feature 001's real Codex initialize-only handshake is historical evidence,
not a new model test. Codex/DSH actual Leader-issued delegation, native approvals under user profiles,
Desktop Skill discovery and native GUI keyboard/VoiceOver/long-content/click flows remain unverified.
Previous Computer Use attachment timed out; this turn does not claim a live app screenshot.

The static PNG covers list layout only; review detail source is compiled, not visually/interaction
certified. Digest identifies sealed exported JSON, not live worktree contents, a security signature,
independently run tests or correctness. Ignored files and Git metadata are outside captured changes.
Bounded native events can include actual command results when reported; absence is not a test pass.
Admin credentials represent the user API role, not cryptographic proof of a human action; same-user
processes can read them. Agents using entry credentials must follow the Skill's user-decision rule.
