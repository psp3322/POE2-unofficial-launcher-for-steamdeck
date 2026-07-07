---
name: roadmap-capture
description: Use when a user says a feature, bug fix, experiment, or follow-up can wait, should be done later, belongs on the roadmap/backlog, or asks to add/update roadmap items. Two tracks — user-visible product changes go to docs/Roadmap.md (CI-synced to GitHub Issue #7 and the gh-pages notice; public text), dev-internal items (tooling, build/CI, refactors, tech debt, agent workflow) go to the root AGENTS-ROADMAP.md (not CI-coupled). Route first, then capture.
---

# Skill: Roadmap Capture

## Instructions

Use this skill when a development discussion produces deferred work such as
"나중에 하자", "추후", "로드맵에 넣자", "backlog", or "TODO로 남기자".

### Step 0 — route to a track

| Track | File                                       | Carries                                                               | Reflection                                                       |
| ----- | ------------------------------------------ | --------------------------------------------------------------------- | ---------------------------------------------------------------- |
| 1     | `docs/Roadmap.md` (+ `docs/roadmap/` refs) | User-visible product features/changes                                 | CI-synced to GitHub Issue #7 + gh-pages notice (**public text**) |
| 2     | `AGENTS-ROADMAP.md` (repo root)            | Dev-internal: tooling, build/CI, refactors, tech debt, agent workflow | None — internal only, no CI                                      |

Routing rule: **would a user read this item in the public roadmap/notice?**
Yes → Track 1. Only developers/agents care → Track 2. If genuinely unclear,
ask the user which track.

### Track 1 — `docs/Roadmap.md` (user-facing, CI-coupled)

1. Capture the deferred item in plain user-facing wording.
2. If the user did not specify priority, ask for one priority before editing:
   `P0` stability/operation, `P1` execution/notification/update, `P2`
   user-facing expansion, or `P3` long-term review.
3. Update `docs/Roadmap.md`; it is the single source of truth for this track.
4. Add the item under the selected priority as a checklist entry.
5. If the item needs more than one sentence of detail, create or update
   `docs/roadmap/<kebab-case-topic>.md` and append
   `([ref](roadmap/<kebab-case-topic>.md))` to the checklist item.
6. For completed roadmap work, move the checked item to the `완료됨` section
   instead of leaving it in its old priority bucket.

**How Track 1 reflection works (why wording is gated):** on a master push
touching `docs/Roadmap.md` / `docs/roadmap/**`,
`.github/workflows/sync-roadmap-issue.yml` rebuilds the GitHub Issue #7 body
via `scripts/build-roadmap-issue-body.cjs` (ref links stripped), and
`sync-roadmap-notice.yml` regenerates the gh-pages `notice/[notice]roadmap.md`
via `scripts/build-roadmap-notice.cjs`, which the launcher surfaces to users.
Both outputs are **public**, so:

- Get the user's confirmation of item wording (and priority) before the
  change can reach master.
- Never manually edit GitHub Issue #7 — the sync workflow overwrites it
  (ref links are stripped automatically).
- Never manually edit the `gh-pages` notice files — the notice workflow
  rebuilds them.
- The paths `docs/Roadmap.md` / `docs/roadmap/**` are hardcoded in CI and
  scripts — do not move or rename them (see `docs/README.md`).

Validation after editing Track 1 content:

```bash
npm run roadmap:issue-body
npm run roadmap:notice
```

In this Windows-first repo, run npm scripts from Windows PowerShell as
described in `AGENTS.md`.

### Track 2 — `AGENTS-ROADMAP.md` (agent-internal, no CI)

Format mirrors project_tui's root `ROADMAP.md`: checkbox milestones with
optional DoD / verification / priority. Append-friendly; no CI coupling, no
public exposure, hence no wording gate.

1. Append a checkbox entry `- [ ] <item>` to the backlog section (create a
   new section only when a grouping is obvious).
2. When known, add one indented line: `— DoD: <observable pass condition> /
검증: <how + env tag [WSL | Windows-pwsh | 사용자]>`. Add a priority
   prefix (e.g. `(P3)`) only if the user gives one — do not invent it.
3. Link supporting docs inline (`docs/archive/...`, `docs/work/...`);
   `docs/roadmap/` ref docs belong to Track 1 only.
4. Completed items: check the box; move to a `완료` section when the list
   gets noisy.
5. No validation scripts apply — nothing is generated from this file.

## Examples

- User: "자동화 실패 판정은 나중에 하자" → user-visible behavior → Track 1.
  Ask for priority if missing; add a checklist item; create a detail ref
  only if the discussion includes enough policy or design detail to preserve.
- User: "이건 P1로 로드맵에 넣어" → Track 1, add directly under
  `## P1 - 실행, 알림, 업데이트`.
- User: "husky가 WSL에서 깨지는 건 나중에 고치자" → dev tooling → Track 2
  (`AGENTS-ROADMAP.md`), checkbox + one DoD/검증 line.
- A review finds an out-of-scope refactor/tech-debt item → Track 2, no
  wording gate — keep the entry short and factual.
