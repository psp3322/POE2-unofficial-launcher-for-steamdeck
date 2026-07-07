# CLAUDE.md — POE2 Unofficial Launcher

Shared project rules for all coding agents live in `AGENTS.md` (single
source — do not fork rules here). This file adds only Claude Code-specific
behavior.

@AGENTS.md

## Model routing ★core

- **This session's default model does the routine work**: well-specified
  fixes, edits, formatting, running tests, mechanical tasks. Do NOT
  delegate these.
- **Delegate to the `architect` subagent** (`.claude/agents/architect.md`,
  pinned to a higher-tier model) for:
  1. Architecture changes — EventBus/IPC boundaries, service lifecycle,
     shared state ownership, updater/release flow
  2. Root-cause analysis of regressions and genuinely hard bugs
     (Windows/Electron/폰트/카카오 자동화) — anything you would otherwise
     have to guess at
  3. Backward-compatibility impact assessment (config schema, migrations,
     updater path) and refactoring plans for the god files
     Also delegate when the user explicitly asks for 설계 검토 / 근본 원인 분석 /
     architecture review.
- **After architect returns**: relay its options, recommendation,
  compatibility impact, and open questions to the user **verbatim in
  substance**. Unresolved items are a gate — do not implement past them
  without approval.
- Claude Code built-ins (Explore agent, /code-review, plan mode) handle
  search/review/planning as usual. architect is reserved for the
  deep-judgment cases above **and** the 개발 워크플로 설계·리뷰 게이트
  (다음 섹션) — not for routine search or formatting.

## 개발 워크플로 바인딩 ★core

AGENTS.md `## 개발 워크플로`의 설계자·리뷰어 = **architect 서브에이전트**.

- 계획(1단계): Model routing 기준 준용 — 아키텍처/호환성/난제가 걸리면
  architect가 계획 수립, 루틴 수정은 세션이 직접 작성. 어느 쪽이든 사용자
  승인 게이트는 생략 불가.
- 리뷰(4단계): 라운드마다 architect를 새로 호출(무상태)하고 work 문서 경로 +
  `git diff master...HEAD` 범위 + 이전 라운드 지적을 전달한다. architect는
  판정·지적을 work 문서에 직접 기록한다.
- **런타임 분기**: `architect` 서브에이전트가 노출되지 않는 런타임(VSCode
  확장 — `.claude/agents/*.md`를 로드하지 않음, upstream 버그 #24439)에서는
  `general-purpose` 서브에이전트를 `model: "claude-fable-5"`로 고정 호출하고
  `.claude/agents/architect.md` 본문을 프롬프트에 인라인한다. 이때 도구
  제한이 강제되지 않으므로 제약을 프롬프트에 명시할 것 — 쓰기는
  `docs/work/*`만, Bash는 읽기 전용, 소스 수정 금지. (Fable 5 + 분리
  컨텍스트가 유지되므로 리뷰어 분리 요건은 그대로 성립.) architect가 핵심인
  작업(설계·리뷰 게이트)은 가능하면 CLI(`claude`)에서 실행하는 것이 최선.
- 구현자(세션)는 architect 리뷰 `통과`/`조건부 통과` 없이 5단계로 진행 금지.

## Wiki access

To work with the LLM wiki visible as read context:
`claude --add-dir ~/project_llm_wiki` (also configured via
`.claude/settings.json` additionalDirectories).
