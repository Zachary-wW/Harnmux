# Implementation Plan: Local Cross-Harness Team

**Branch**: `main` | **Date**: 2026-10-21 | **Spec**: [spec.md](spec.md)

## Summary

One TypeScript local service owns authenticated tasks, SQLite records and Git worktrees. A shared
CLI/Skill supports independent entry/Leader/Worker roles. Codex uses app-server JSON-RPC; DSH uses
acpx in-process ACP runtime after its permission/cancel probe. SwiftUI MenuBarExtra reads the same
API and handles approvals/deliveries. No Desktop injection, model gateway or plugin migration.

## Technical Context

**Language/Version**: TypeScript strict, Node >=22.13; Swift 6 / macOS >=14.
**Primary Dependencies**: acpx 0.20.0, Zod 4.6.5; SwiftUI/AppKit/Foundation only for UI.
**Storage**: built-in node:sqlite DatabaseSync, WAL, bounded events; private state directory.
**Testing**: node:test via tsx, disposable Git repos and fake native-protocol subprocesses; real Codex handshake separately.
**Target Platform**: local macOS arm64; source builds on supported macOS toolchains.
**Project Type**: CLI/local service + native menu-bar client.
**Performance Goals**: two-second UI refresh; bounded 1 MiB request/line and 256 KiB retained event payload/output fragments.
**Constraints**: <=4 simultaneous executions; native permissions preserved; no paid task run without an explicit real-test step; no global native config mutation.
**Scale/Scope**: single OS user, one service, Entry→Leader→Worker, two harness adapters.

## Constitution Check

Before/after research and design: PASS. Native execution and role identity explicit; task-scoped
authorization; private worktrees; native approval callbacks; no silent all-access; persistent
state and unknown interruption; native accessible UI. Two languages are justified by JS protocol
reuse and native macOS UI. No mandatory extensions.yml hooks exist.

## Project Structure

```text
src/
  cli.ts          # JSON-friendly entry, agent operations and service lifecycle
  server.ts       # authenticated local HTTP API
  service.ts      # task and role orchestration
  store.ts        # durable tasks, bounded events and approvals
  workspace.ts    # Git worktree and delivery capture
  config.ts       # private state, profiles and endpoint discovery
  types.ts        # validated contracts
  adapters/
    codex.ts      # app-server transport and native approval bridge
    dsh.ts        # acpx in-process ACP runtime
    rpc.ts        # bounded newline JSON-RPC subprocess client
macos/
  Package.swift
  Sources/Harnmux/  # menu-bar UI, API models and details
scripts/build-macos.sh
integrations/harnmux/SKILL.md
examples/team.json
tests/                    # orchestration and protocol integration fixtures
```

## Complexity Tracking

No constitution violations. SQLite JSON snapshots plus sequenced events avoid a framework/ORM.
One local HTTP transport serves CLI and UI. CLI credentials for children are ephemeral scoped
environment values, never profile settings. acpx owns each DSH protocol process; own transport
owns each Codex protocol process. No duplicate connection owners or custom ACP implementation.
