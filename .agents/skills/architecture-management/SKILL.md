---
name: architecture-management
description: Use when adding or changing features that affect lifecycle phases, service startup/shutdown, EventBus/IPC boundaries, shared state ownership, background processes, or cross-module responsibilities.
---

# Skill: Architecture Responsibility Management

Use this before implementing any feature or fix that crosses module boundaries or depends on runtime ordering.

## When to Use

- Startup, shutdown, resume, updater, process watcher, font migration, or background scheduler work
- Any change that writes shared state from more than one place
- Any new EventBus event, IPC bridge, service, manager, or long-running task
- Any feature where an initial check, post-init reconciliation, or user action can overwrite another state

## Required Pass

1. Name the lifecycle phase: bootstrap, service init, post-init reconciliation, runtime, suspend/resume, or shutdown.
2. Identify the owner for each state. Only the owner may create the strongest runtime state.
3. Define ordering guarantees. If a later step relies on a result, do not fire-and-forget the earlier step.
4. Define overwrite rules. Reconciliation and background checks must not downgrade stronger runtime state without owner confirmation.
5. Keep event boundaries explicit. Business logic belongs in services/handlers, not random IPC or renderer callbacks.
6. Add a test for the ordering or ownership contract when the change can regress silently.

## Pair With

- `event-ipc-integration` when adding or changing EventBus or renderer IPC flows.
- `config-management` when adding or changing any `AppConfig` field.
- `settings-management` when exposing a setting in the settings screen.
- `windows-electron-debugging` for Electron runtime, dev server, or visual verification work.

## Local Rule

For game status, runtime/process state is stronger than install-check state. Install reconciliation may fill unknown/idle/uninstalled status, but must not overwrite `preparing`, `processing`, `authenticating`, `ready`, or `running` unless the runtime owner has first cleared that state.
