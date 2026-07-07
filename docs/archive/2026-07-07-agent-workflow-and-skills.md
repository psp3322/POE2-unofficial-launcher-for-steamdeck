# 에이전트 개발 워크플로 정착 + 스킬 정비 + 후속 처분 (설계안)

> 작성일: 2026-07-07 · 상태: 계획 · 브랜치: feat/next-release · 갱신: 2026-07-07 (v2)

2026-07-07 에이전트 설정 정비(AGENTS.md 단일 소스, architect 서브에이전트,
docs 체계 — 위키 raw `2026-07-07-agent-config-overhaul.md`)의 후속 3종 설계.
**본 문서는 architect가 작성한 제안이며, 구현(AGENTS.md/CLAUDE.md/스킬 수정)은
사용자 승인 후 메인 세션이 수행한다.** 아래 file:line 근거는 전부 현 소스에서
재검증했다 (2026-07-07 기준).

- Task 1: feat/fix 브리핑 → 자동 개발 워크플로 설계 및 성문화 위치
- Task 2: 스킬 7종 소스 대조 결과 확정 + 처분 + 카카오 스킬 신설 판단
- Task 3: residual-work 트리아지 / 위키 캐치업 범위 / preview.gif 판정
  \+ (v2) 투트랙 로드맵 설계

## v2 개정 요약 (2026-07-07, 사용자 v1 검토 반영)

**v1에서 승인 확정 (재론 없음)**: 성문화 형태 A(AGENTS.md 섹션 + CLAUDE.md
바인딩) · 경량 트랙 허용 · 리뷰 캡 3라운드 · kakao-automation 스킬 신설 ·
PR 본문 "Test plan" 섹션 금지. 본문에서 "제안/추천" → "확정" 표기만 변경.

**v1 → v2 변경 3건**:

1. **투트랙 로드맵** (§3.4 신설, §1.4·§1.7·§2.4·§3.1 연동 수정): 로드맵을
   Track 1 `docs/Roadmap.md`(사용자 가시 제품 로드맵, CI 공개 동기화 — 기존
   체계 그대로)와 Track 2 **루트 에이전트 내부 로드맵**(개발 도구·빌드/CI·
   리팩토링·기술부채·에이전트 워크플로, CI 비결합 — project_tui 루트
   `ROADMAP.md` 모델)으로 분리. roadmap-capture 스킬 투트랙 개정 드래프트와
   루트 파일 시드 포함. 잔존 2건 재배치: HKCU 폰트 = Track 1 P2(유지),
   husky pwsh 위임 = Track 2로 이동(v1의 P3 제안 철회). 루트 파일명은 열린
   질문 (추천 `AGENTS-ROADMAP.md`).
2. **architect 바인딩 런타임 폴백** (§1.8 개정): VSCode 확장은
   `.claude/agents/*.md`를 로드하지 않음(upstream #24439, open) →
   architect 미노출 런타임에서는 `general-purpose` +
   `model: "claude-fable-5"` + `.claude/agents/architect.md` 인라인으로
   폴백. architect가 핵심인 작업은 CLI 실행 권장 한 줄 추가.
3. **브랜치 결정** (§4·§6 반영): 본 작업은 현 `feat/next-release` 브랜치에서
   계속 — 정비가 이미 이 브랜치 위에서 진행 중이므로 "master에서 분기" 규칙의
   **1회 예외**(규칙은 다음 작업부터 적용). 완료 시 `chore(...)` 커밋으로
   에이전트 툴링 변경만 커밋하고, 브랜치에 선재하는 미커밋 UpdateModal WIP는
   **별도 사안**으로 분리 리뷰.

---

## 1. Task 1 — feat/fix 개발 워크플로

### 1.1 적용 조건과 원칙

- **트리거**: 사용자가 feat/fix **브리핑**을 주고, 산출물이 master로 갈 코드
  변경(=PR, =릴리스 후보)인 모든 작업. 명시적 요청 없이도 기본 동작한다.
- **역할 분리 (불변 규칙)**: 구현자(세션 기본 모델)와 설계·리뷰어(구현자와
  분리된 컨텍스트)를 나눈다. **구현자는 자기 구현을 스스로 리뷰 통과시킬 수
  없다.** Claude 바인딩: 설계·리뷰어 = architect 서브에이전트(Fable 5, 호출마다
  무상태; 런타임 폴백은 §1.8). 타 에이전트(Codex 등): 별도 서브에이전트 또는
  최소한 구현과 분리된 리뷰 패스.
- **게이트는 4개, 전부 사용자 소유**: 계획 승인 / 실동작 검증 OK / 머지 승인 /
  릴리스 결정. master 머지 = release-please 자동 릴리스이므로 머지 게이트는
  기존 AGENTS.md stop-and-ask #4와 동일 항목이다 (신설 아님, 워크플로에 편입).
- **모델 라우팅과의 정합** (CLAUDE.md `## Model routing`과의 긴장 해소):
  계획 단계의 작성 주체는 라우팅 규칙을 따른다 — 아키텍처/호환성/난제가 걸린
  브리핑은 architect가 계획을 수립하고, 루틴 수정은 구현자가 직접 계획을
  작성한다. **리뷰 분리는 무조건** — 계획을 누가 썼든 4단계 리뷰어는 항상
  구현자와 분리된 컨텍스트다.

### 1.2 단계/게이트 표

| #   | 단계        | 수행           | 산출물/행동                                      | 진행 게이트            |
| --- | ----------- | -------------- | ------------------------------------------------ | ---------------------- |
| 1   | 계획        | 설계자         | `docs/work/YYYY-MM-DD-<주제>.md`: 마일스톤 + DoD | **사용자 승인**        |
| 2   | 브랜치      | 구현자         | master에서 `feat/*` `fix/*` `hotfix/*` 분기      | —                      |
| 3   | 구현        | 구현자         | 마일스톤 단위 구현, 해당 영역 skills 준수        | 마일스톤 DoD 자체 통과 |
| 4   | 리뷰 루프   | 리뷰어↔구현자  | 라운드별 판정·지적을 work 문서에 누적            | 리뷰 통과 (§1.4, 캡 3) |
| 5   | 사용자 검증 | 사용자         | `[사용자]` 태그 DoD의 Windows 실동작 확인        | **사용자 OK**          |
| 6   | 마무리      | 구현자         | 위키 raw 노트 → 커밋 → PR → 머지                 | **사용자 머지 승인**   |
| 7   | 릴리스      | release-please | 릴리스 PR 확인, 머지 여부 질의 후 종료           | **사용자 릴리스 결정** |

(2단계 "master에서 분기" — 본 정비 작업 자체는 1회 예외로 현
`feat/next-release`에서 진행, §4 참조. 규칙은 다음 작업부터.)

### 1.3 DoD 규약

계획의 각 마일스톤은 `관찰 가능한 판정 기준 + 검증 환경 태그`를 갖는다.

- 태그 3종: `[WSL]` (순수 Node 스크립트/문서 대조/`git` 검증),
  `[Windows-pwsh]` (`npm run build:check`·`lint`·`test` — WSL에서는 네이티브
  바인딩 부재로 불가, AGENTS.md WSL 규칙), `[사용자]` (런처/인게임 실동작 —
  빌드 통과로 대체 불가).
- 예: "tsc 통과 `[Windows-pwsh]`", "설정→글꼴에서 X 선택 시 게임에 반영
  `[사용자]`", "스킬 문서의 file:line이 소스와 일치 `[WSL]`".
- 런처 UI·게임 동작·카카오 자동화가 걸린 마일스톤은 반드시 `[사용자]` DoD를
  하나 이상 포함한다.

### 1.4 리뷰 루프 규칙 (캡 3 — 승인됨)

- **리뷰어 입력**: work 문서 경로 + `git diff master...HEAD` + 이전 라운드 지적.
  리뷰어는 판정·지적을 work 문서에 직접 기록한다 (architect의 쓰기 권한은
  `docs/work/*`뿐이므로 정확히 부합; 무상태 호출 간 연속성도 이 문서가 담보).
- **판정 어휘 4종**:
  - `통과` — 5단계로 진행.
  - `조건부 통과` — 경미 지적. 구현자가 수정하되 재리뷰 불필요.
  - `반려` — 수정 후 재리뷰 필요. 라운드 1회 소모.
  - `설계 결함` — 구현이 아니라 계획이 틀림. 라운드를 소모하지 않고 1단계로
    회귀, 사용자에게 즉시 보고.
- **리뷰 범위 한정**: 계획의 DoD + blast radius(stop-and-ask 4종) + 관련 스킬
  준수. **범위 밖 발견은 blocking 금지** — work 문서에 기록하거나
  roadmap-capture **트랙 규칙대로 이관**한다 (사용자 가시 제품 변화 →
  `docs/Roadmap.md`, 개발 내부 → 루트 에이전트 로드맵 — §3.4). (리뷰 루프가
  스코프 크리프로 무한화되는 것 방지.)
- **캡 = 3라운드** (반려→수정→재리뷰 = 1라운드). 3라운드 후에도 미통과면 잔여
  지적과 구현자·리뷰어 이견을 정리해 사용자 에스컬레이션 — 사용자가 잔여 리스크
  수용 / 재계획 / 루프 연장을 결정한다.

### 1.5 산출물 위치

| 산출물                              | 위치                                                                                                                                               | 근거                            |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| 계획 + 리뷰 라운드 기록 + 검증 결과 | `docs/work/YYYY-MM-DD-<주제>.md` 단일 문서에 누적                                                                                                  | docs/README.md work 규칙 그대로 |
| 위키 raw 노트 (6단계)               | `~/project_llm_wiki/raw/projects/poe2-launcher/YYYY-MM-DD-<주제>.md`, **`/ingest`는 위키 저장소에서 수행** (세션에서 불가하면 사용자에게 요청)     | AGENTS.md 문서 맵               |
| work 문서 아카이브                  | 위키 반영 후 `docs/archive/`로 이동                                                                                                                | docs/README.md 수명주기         |
| PR 본문                             | **Summary + 배경/동기만. "Test plan" 류 섹션 금지** (사용자 전역 규칙 — Codex 등 타 에이전트는 전역 CLAUDE.md를 못 보므로 AGENTS.md에 성문화 필요) | 사용자 전역 규칙 (승인됨)       |
| gh 작업 전부                        | `github-cli-token` 스킬 절차                                                                                                                       | AGENTS.md 기존 규칙             |
| 커밋                                | WSL 세션은 husky 네이티브 바인딩 제약 → Windows 커밋 또는 단건 `--no-verify` 승인 (기존 WSL 규칙 참조)                                             | AGENTS.md WSL 규칙              |

**경량 트랙 (승인됨)**: 명백히 국소적인 fix(설계 판단·stop-and-ask
비해당·마일스톤 1개)는 계획을 대화 내 요약+DoD로 갈음하고 work 문서·위키
노트를 생략할 수 있다. 이때 리뷰 판정은 대화/PR에 남긴다. **단 4개 게이트는
어떤 경우에도 생략 불가.** (완전 생략 트랙이 없으면 오타 수정에도 문서 3개가
강제되어 규칙이 사문화될 위험이 있다 — 게이트만 지키는 최소형을 명시하는 편이
규칙 준수율을 높인다.)

### 1.6 성문화 위치 — 형태 A 확정 (사용자 승인)

**분담 (하드 제약 준수)**:

- AGENTS.md → 스켈레톤 전부: 역할 분리(추상 역할), 단계/게이트 표, DoD 규약,
  리뷰 루프 규칙, 브랜치 규칙, PR/머지/릴리스 규칙, 경량 트랙.
- CLAUDE.md → Claude 바인딩만: 설계·리뷰어=architect(+런타임 폴백),
  라운드별 무상태 호출 프로토콜(전달물), 계획 위임 기준(기존 Model routing 준용).

**확정 = A. AGENTS.md 섹션 + CLAUDE.md 바인딩, 신규 파일 없음** (사용자 승인).
기각 기록: B(슬래시 커맨드) = 수동 호출이라 "자동" 요건 위반 + 포크 재발 패턴;
C(압축 스켈레톤 + dev-workflow 스킬) = 규범/절차 2원화. §1.7 드래프트가 향후
유의미하게 비대해지면 그때 C 분리를 재검토한다는 후속 조건만 유지.

### 1.7 AGENTS.md 신규 섹션 드래프트 (paste-ready)

삽입 위치 제안: `## Project status — shipped, in maintenance` 섹션 뒤,
`## Documentation map` 앞.

```markdown
## 개발 워크플로 (feat/fix) ★core

사용자가 기능/수정 브리핑만 주어도 이 루프가 기본 동작한다. 대상: master로
갈 코드 변경(=PR) 전부.

역할 분리(필수): **구현자** = 현 세션. **설계·리뷰어** = 구현자와 분리된
컨텍스트 (Claude는 architect 서브에이전트 — CLAUDE.md 참조. 그 외 에이전트는
별도 서브에이전트 또는 구현과 분리된 리뷰 패스). 구현자는 자기 구현을 스스로
리뷰 통과시킬 수 없다.

| #   | 단계        | 수행           | 산출물/행동                                      | 진행 게이트              |
| --- | ----------- | -------------- | ------------------------------------------------ | ------------------------ |
| 1   | 계획        | 설계자         | `docs/work/YYYY-MM-DD-<주제>.md`: 마일스톤 + DoD | **사용자 승인**          |
| 2   | 브랜치      | 구현자         | master에서 `feat/*`·`fix/*`·`hotfix/*` 분기      | —                        |
| 3   | 구현        | 구현자         | 마일스톤 단위, 해당 영역 skills 준수             | 마일스톤 DoD 자체 통과   |
| 4   | 리뷰 루프   | 리뷰어↔구현자  | 판정·지적을 work 문서에 라운드별 누적            | 리뷰 통과 (최대 3라운드) |
| 5   | 사용자 검증 | 사용자         | `[사용자]` DoD의 Windows 실동작 확인             | **사용자 OK**            |
| 6   | 마무리      | 구현자         | 위키 raw 노트 → 커밋 → PR → 머지                 | **사용자 머지 승인**     |
| 7   | 릴리스      | release-please | 릴리스 PR 확인 후 머지 여부 질의, 종료           | **사용자 릴리스 결정**   |

**DoD 규약** — 각 마일스톤 = 관찰 가능한 판정 기준 + 검증 환경 태그
`[WSL | Windows-pwsh | 사용자]`. 런처/인게임/카카오 자동화가 걸린 작업은
빌드 통과로 대체 불가 — `[사용자]` DoD 필수 (위 WSL 규칙 참조).

**리뷰 루프** — 리뷰어 입력: work 문서 + `git diff master...HEAD` + 이전
라운드 지적. 판정: `통과` / `조건부 통과`(경미 — 수정 후 재리뷰 불필요) /
`반려`(재리뷰, 라운드 소모) / `설계 결함`(라운드 소모 없이 1단계 회귀 +
사용자 보고). 리뷰 범위는 DoD + blast radius(stop-and-ask 4종) + 스킬 준수로
한정하고, 범위 밖 발견은 blocking 없이 work 문서에 남기거나 roadmap-capture
트랙 규칙대로 이관한다 (사용자 가시 → `docs/Roadmap.md`, 개발 내부 → 루트
`AGENTS-ROADMAP.md`). 3라운드 미통과 시 잔여 지적·이견을 정리해 사용자
에스컬레이션.

**PR·머지** — PR 본문 = Summary + 배경/동기만, "Test plan" 류 섹션 금지.
모든 gh 작업은 `github-cli-token` 스킬 절차. master 머지 = 자동 릴리스이므로
반드시 사용자 승인 후 실행 (stop-and-ask #4와 동일). 커밋은 WSL husky 제약
시 Windows에서 수행하거나 단건 승인으로 처리 (위 WSL 규칙).

**마무리 체크리스트(6단계)**: ① 위키 raw 노트
(`~/project_llm_wiki/raw/projects/poe2-launcher/`) 작성 — `/ingest`는 위키
저장소에서 수행(불가 시 사용자에게 요청) ② work 문서를 `docs/archive/`로
이동 ③ 커밋·PR·(승인 후) 머지.

**경량 트랙**: 명백히 국소적인 fix(설계 판단·stop-and-ask 비해당, 마일스톤
1개)는 계획을 대화 내 요약+DoD로 갈음하고 work 문서·위키 노트를 생략할 수
있다. 단 4개 게이트(계획 승인·분리 리뷰·사용자 검증·머지 승인)는 생략 불가.
```

(루트 로드맵 파일명 `AGENTS-ROADMAP.md`는 §3.4.1 확정 전 가칭 — 확정 명으로
일괄 치환.)

### 1.8 CLAUDE.md 바인딩 드래프트 (paste-ready, v2 — 런타임 폴백 포함)

삽입 위치 제안: `## Model routing ★core` 바로 뒤.

```markdown
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
```

---

## 2. Task 2 — 스킬 정비

### 2.1 소스 대조 결과 (fact-pack 재검증 — 전부 확인됨, 경로 2건 보정)

| 스킬                       | 판정            | 재검증 근거                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| -------------------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| architecture-management    | **UPDATE(소)**  | 보존 상태 로직 `src/main/state/GameStatusStore.ts:38-46` (`isLaunchBlockingStatus`: preparing/processing/authenticating/ready/running), 리컨실러 보존 `src/main/game/GameInstallStatusReconciler.ts:172,193`. 스킬의 "fill unknown"은 오기 — `unknown`은 `RunStatus`가 아님 (`src/shared/types.ts:258-268`), 리컨실 결과는 `uninstalled`/`install_check_blocked`/`idle`(+프로세스 감지 시 `running`) (`GameInstallStatusReconciler.ts:97-104,179-184`). `stopping`/`error`는 보존 대상 아님                                                     |
| config-management          | **UPDATE(중)**  | (a) `config-integrity.test.ts`는 `src/renderer/settings/`에 있고 store-backed UI 아이템의 `DEFAULT_CONFIG` 존재만 검사 — 실패 메시지에 "UI 없는 자동관리 config 누락은 여기서 잡히지 않음" 자체 명시. "1–4 강제" 주장 과대 (b) ORPHANED는 CI가 아니라 런타임 디버그 뷰어 `src/renderer/components/debug/ConfigViewer.tsx` (c) `CONFIG_KEYS`는 "기존 코드와의 호환성을 위한 키 매핑" 주석의 레거시 비망라 맵 (`src/shared/config.ts:233-234`) (d) 실제 강제 장치 = `DEFAULT_CONFIG: AppConfig` 타입 (`config.ts:268`) → 필수 키 누락 시 tsc 에러 |
| event-ipc-integration      | **UPDATE(소)**  | 핸들러 등록은 `CORE_EVENT_HANDLERS` (`src/main/events/register-handlers.ts:41-76`) — 스킬의 "main.ts에서 eventBus.register" 및 "Antigravity" 문구 낡음                                                                                                                                                                                                                                                                                                                                                                                          |
| settings-management        | **UPDATE(소)**  | 아이템 경로 실제 `src/renderer/components/settings/items/` (스킬은 `src/renderer/settings/items/` — 사어); API 실제 `resetDescription()` (`src/renderer/settings/types.ts:46,94`, 스킬은 `clearDescription()`); `dependsOn`은 `string \| { key, value }` 객체형 지원 (`types.ts:81`)                                                                                                                                                                                                                                                            |
| github-cli-token           | **KEEP**        | 변경 없음                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| roadmap-capture            | **재설계 (v2)** | v1 판정은 KEEP(현행 Roadmap 구조 `Roadmap.md:15/25/44/62/92` 대조 일치)였으나, 투트랙 로드맵 결정으로 **전면 개정 대상**으로 승격 — §3.4.2 드래프트                                                                                                                                                                                                                                                                                                                                                                                             |
| windows-electron-debugging | **KEEP + 이관** | 본체 정확. 단 SecurityCenter DOM 분류 **정책**은 디버깅 스킬의 경계 밖 → 카카오 스킬 신설로 그쪽에 이관, 여기엔 포인터만                                                                                                                                                                                                                                                                                                                                                                                                                        |

### 2.2 스킬별 타깃 텍스트 (변경분만, paste-ready)

**(1) architecture-management — Local Rule 교체**

```markdown
## Local Rule

For game status, runtime/process state is stronger than install-check state.
Install reconciliation emits only `idle` / `uninstalled` /
`install_check_blocked` (plus `running` when the process is detected), and
must not overwrite the launch-blocking statuses `preparing`, `processing`,
`authenticating`, `ready`, `running` (`isLaunchBlockingStatus`,
`src/main/state/GameStatusStore.ts`) unless the runtime owner has first
cleared them. `stopping` and `error` are NOT preserved — reconciliation may
resolve them.
```

**(2) config-management — 3곳 수정**

- 체크리스트를 "필수 3 + 조건부 1"로 재구성:
  1. Type (`AppConfig`, `src/shared/types.ts`) — 필수
  2. `CONFIG_METADATA` (`src/shared/config.ts`) — 필수 (누락 시 디버그 뷰어의
     ORPHANED 패널에 노출)
  3. `DEFAULT_CONFIG` (`src/shared/config.ts`) — 필수
  4. `CONFIG_KEYS` — **조건부**: 레거시 호환용 비망라 맵
     (`config.ts:233` 주석). 기존 호출부가 `CONFIG_KEYS`로 접근할 때만 추가.
     신규 필드에 필수 아님.
- 강제 장치 문단 교체 (기존 "config-integrity.test.ts enforces 1–4" 삭제):

```markdown
## Enforcement — what actually catches mistakes

- **`tsc` (the real gate):** `DEFAULT_CONFIG` is typed `AppConfig`
  (`src/shared/config.ts`), so a required `AppConfig` field missing from
  `DEFAULT_CONFIG` fails compilation. Optional fields are NOT caught.
- **`config-integrity.test.ts`** (`src/renderer/settings/`): only verifies
  that store-backed settings-screen UI items (no `defaultValue`) exist in
  `DEFAULT_CONFIG`. A field with no UI is never checked by this test.
- **ORPHANED panel**: a runtime debug viewer
  (`src/renderer/components/debug/ConfigViewer.tsx`), not CI. A key present
  in config.json but missing from `CONFIG_METADATA` shows up there — use it
  as a manual diagnostic.

There is NO automated check for `CONFIG_METADATA` completeness — that is why
this checklist is mandatory discipline.
```

- 말미에 관련 영역 추가 (설치 경로 진단 편입 — 신규 스킬 불필요):

```markdown
## Related area: game install paths (1.4.0+)

`gameInstallPaths` (`src/shared/types.ts`, nested per-service map) backs the
manual path designation + diagnosis flow (`GamePathDiagnosticModal`,
`src/main/game/GameInstallStatusReconciler.ts`). It is a nested object —
the §3 no-deep-mutation rule applies to every change.
```

**(3) event-ipc-integration — Step 2 노트 교체 + 대상 문구 정리**

- `**Target Audience:** AI Agents (\`Antigravity\`, etc.)`→`**Target Audience:** AI Agents`
- Step 2 말미 노트 교체:

```markdown
_Note:_ Register the handler by adding it to `CORE_EVENT_HANDLERS` in
`src/main/events/register-handlers.ts` — do not call `eventBus.register`
ad-hoc from `main.ts`.
```

**(4) settings-management — 3곳 수정**

- 경로: `src/renderer/settings/items/` → `src/renderer/components/settings/items/`
- API: `context.clearDescription()` → `context.resetDescription()` (2곳:
  onInit 목록, SettingChangeContext 언급부)
- `dependsOn` 항목 보강:

```markdown
### `dependsOn: string | { key: string; value: SettingValue }`

- String form: render only when the parent setting is truthy.
- Object form: render only when the parent setting equals `value`
  (`src/renderer/settings/types.ts`).
```

- PREREQUISITE/Mistake 1 문구의 `CONFIG_KEYS` 언급을 config-management의
  "필수 3 + 조건부 1" 표현과 일치시킴 (4종 나열 → "type + CONFIG_METADATA +
  DEFAULT_CONFIG (+ legacy CONFIG_KEYS if referenced)").

**(5) roadmap-capture** — 투트랙 전면 개정: §3.4.2 드래프트 (v2에서 Task 3로
이동 — 로드맵 체계 설계와 한 몸).

### 2.3 카카오 자동화 스킬 신설 — 확정 = A (사용자 승인, 신설 진행)

배경: 최근 5개 릴리스 중 다수가 이 영역 (스타터 전환 `ec88bb0` 1.3.4 →
`7db1c86` 1.4.0 → `e172b4e` 1.4.1). 서드파티 DOM 의존 = 셀렉터가 로드베어링,
오프라인 검증 불가. 현재 SecurityCenter 노출 판정 정책이
windows-electron-debugging(디버깅 스킬)에 들어가 있어 **기능 작업 시에는
트리거되지 않는** 경계 누수 상태.

**확정 = 옵션 A — `.agents/skills/kakao-automation/SKILL.md` 신설** (사용자
승인). 기각 기록: B(디버깅 스킬 증축) = 기능 작업에서 트리거 안 되는 문제
잔존; C(위키만) = stale + 공통 로드 경로 아님.

- 범위: `src/main/kakao/*` (preload.ts ~1,369줄 PageHandler 레지스트리,
  visibility-policy.ts, automation-page-dump.ts, session.ts,
  maintenance-info.ts) + `src/main/utils/uac/kakao-game-starter.ts`(KGS
  전환)·`uac-migration.ts`.
- windows-electron-debugging과의 경계: **디버깅 스킬 = 덤프 수집·CDP·검증
  "방법", 카카오 스킬 = 자동화가 지켜야 할 "정책·구조·변경 규칙"**.

골격 드래프트:

```markdown
---
name: kakao-automation
description: Use when changing anything under src/main/kakao/ (login/launch automation, PageHandler selectors, SecurityCenter, visibility policy, page dumps, maintenance detection) or the KakaoGames starter/UAC path (src/main/utils/uac/kakao-game-starter.ts, uac-migration.ts). Third-party-DOM selector policy and real-user blast radius rules.
---

# Skill: Kakao Automation

카카오 로그인·게임 실행 자동화는 서드파티 DOM에 의존하며, 셀렉터 변경은
auto-update로 전체 사용자에게 즉시 배포된다.

## 구조 지도

- `src/main/kakao/preload.ts` (~1.4k lines): PageHandler 레지스트리 —
  URL/DOM 매칭 기반 자동화 본체 (SecurityCenterHandler 포함).
- `src/main/kakao/visibility-policy.ts`: 자동화 창 표시/숨김 정책.
- `src/main/kakao/automation-page-dump.ts`: 실패·노출 시 페이지 덤프 저장.
- `src/main/kakao/session.ts`: 세션 파티션. `maintenance-info.ts`: 점검 감지.
- `src/main/utils/uac/kakao-game-starter.ts`: KakaoGames Starter(KGS) 실행
  경로 — 2026-06 DGS→KGS 전환, `PathOfExile_KG.exe` 감지.

## 규칙

1. **셀렉터는 덤프에서만.** 실제 페이지 덤프(HTML) 근거 없이 셀렉터를
   추가·수정하지 않는다. 덤프 수집·독해 방법은 `windows-electron-debugging`.
2. **추가 우선, 제거 신중.** 기존 매칭 제거/교체는 구 페이지를 보는 사용자를
   깨뜨린다. 핸들러·셀렉터는 추가로 확장하고, 제거는 페이지 소멸 근거와 함께.
3. **SecurityCenter 노출 판정은 URL이 아닌 DOM 상태로.**
   - 숨김 유지(자동 진행): PC정보수집안내 확인 버튼, `.section--device-save`,
     `.modal--device-loading`, 본문 "PC 인증 정보 수집 중".
   - 즉시 노출(사용자 입력): MOTP, ARS, 카카오페이, 기기명 입력, 가시적
     코드/입력 셀렉터.
   - 미지의 화면: 노출을 지연하고 덤프를 보존해 다음 릴리스에서 셀렉터 보강.
4. **검증은 실제 플로우로만.** 이 영역 DoD는 항상 `[사용자]` Windows 실동작
   검증 — 빌드/유닛 테스트 통과로 완료 선언 금지.
5. 스타터/UAC 경로 변경은 기존 설치 사용자의 마이그레이션 blast radius를
   먼저 서술한다 (`uac-migration.ts`).
```

동반 수정: windows-electron-debugging의 "For `security-center.game.daum.net`
..." 분류 정책 블록 → `분류 정책은 kakao-automation 스킬 참조` 한 줄 포인터로
교체 (덤프 수집·독해 순서는 잔존).

### 2.4 AGENTS.md 스킬 섹션 갱신 드래프트 (paste-ready)

```markdown
## Skills (`.agents/skills/`)

Plain-markdown playbooks, agent-agnostic — read the SKILL.md before working
in its area:

- `architecture-management` — lifecycle phases, service startup/shutdown,
  EventBus/IPC boundaries, shared state ownership, cross-module workflows.
- `config-management` — MANDATORY for any `AppConfig` field change (type +
  `CONFIG_METADATA` + `DEFAULT_CONFIG`; `CONFIG_KEYS` only for legacy
  call-sites). Includes the `gameInstallPaths` install-path area.
- `settings-management` — settings-screen UI items (pair after
  config-management when the field has UI).
- `event-ipc-integration` — new events, EventBus subscription via
  `CORE_EVENT_HANDLERS`, renderer IPC sync.
- `kakao-automation` — any change under `src/main/kakao/` or the KakaoGames
  starter/UAC path: selector-from-dump policy, SecurityCenter visibility
  classification, real-user blast radius.
- `roadmap-capture` — when work is deferred to later ("나중에", backlog,
  roadmap requests): two tracks — user-visible product change →
  `docs/Roadmap.md` (CI-synced to Issue #7 + gh-pages notice, public
  wording gate); dev-internal (tooling/build/CI/refactor/tech debt/agent
  workflow) → root `AGENTS-ROADMAP.md` (not CI-coupled).
- `windows-electron-debugging` — debugging/visually verifying the launcher
  (pwsh `npm run dev`, CDP capture, page dumps, real Electron screenshots —
  never WSL/mock-browser verification).
- `github-cli-token` — see above.
```

---

## 3. Task 3 — 후속 처분 + 투트랙 로드맵 (v2)

### 3.1 residual-work 트리아지 (`docs/work/2026-05-20-residual-work.md`)

fact-pack B 판정을 소스로 재검증 — 전부 확인. **v2: 잔존 2건의 이관처를
투트랙 규칙(§3.4)으로 재배정.**

| 항목                            | 판정                           | 재검증 근거                                                                                                                                                    |
| ------------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| §1.1 theme_mode integrity fail  | 해소                           | `settings-config.ts` `theme_mode_poe1`/`poe2`에 `defaultValue: "auto"` + 주석 "defaultValue marks this as not store-backed for the integrity test" (~:410-431) |
| §1.2 axios content-length       | 해소                           | `String(...)` 캐스팅 존재 `src/main/services/PatchManager.ts:462`                                                                                              |
| §1.3 폰트 설치 HKLM→HKCU        | **잔존 → Track 1 P2**          | 설치는 여전히 HKLM(`%windir%\Fonts`)만 (`src/main/utils/powershell.ts` ~:185,224), 제거·정리만 양쪽 하이브 스윕 (~:943-968). UAC 없는 설치 = **사용자 가시**   |
| §2.1 WSL 분기                   | 제거                           | AGENTS.md에 성문화됨. §2.1 자체의 "lint/test는 WSL 직접" 주장은 `84a6829`로 정정된 낡은 내용                                                                   |
| §2.2 rollup 우회                | 제거                           | Vite 8 = rolldown 체계, 상황 소멸                                                                                                                              |
| §2.3 pre-commit 17-20s          | 제거                           | 트레이드오프 수용으로 종결된 기록                                                                                                                              |
| §2.4 설정 추가 규칙             | 제거                           | config-management 스킬이 권위 소스                                                                                                                             |
| §2.5 husky WSL 실패 → pwsh 위임 | **잔존 → Track 2 루트 로드맵** | `.husky/pre-commit` = `npx lint-staged` 단독 (WSL 분기 없음). 순수 개발 도구 — 사용자 무관, CI 비결합 트랙이 정위치 (v1의 Roadmap.md P3 제안 철회)             |
| §2.6 RTK lint 표시 오류         | 제거                           | 사용자 전역 도구 이슈, 저장소 문서 대상 아님                                                                                                                   |
| §3 박제 핵심                    | 제거                           | AGENTS.md WSL 규칙에 성문화됨                                                                                                                                  |

**처분**: ① HKCU → `docs/Roadmap.md` P2 이관(아래 드래프트) ② husky →
루트 로드맵 시드에 포함(§3.4.3 — 별도 이관 작업 불요) ③ 문서 머리에 트리아지
종결 주석 1줄 추가 → ④ `git mv docs/work/2026-05-20-residual-work.md
docs/archive/` (별도 위키 노트 불요 — 트리아지 결과는 본 작업의 랩업 위키
노트에 1줄 포함).

**Track 1 엔트리 드래프트** (우선순위 P2는 제안값 — roadmap-capture 규칙상
사용자 확정 필요):

- `## P2 - 사용자 기능 확장`에:

  ```markdown
  - [ ] 폰트 설치 HKLM → HKCU 전환 — UAC 승인 없이 폰트 설치 ([ref](roadmap/hkcu-font-install.md))
  ```

  ref 문서 `docs/roadmap/hkcu-font-install.md` (신규, 요지만):

  ```markdown
  # 폰트 설치 HKLM → HKCU 전환

  `installSystemFont`가 HKLM(`%windir%\Fonts`) 전용이라 항상 관리자 권한 필요.
  Windows 1809+ 표준 HKCU(`%LOCALAPPDATA%\Microsoft\Windows\Fonts`) 설치로
  전환하면 UAC 불필요.

  - 선결 리스크: 게임/패치가 HKCU 등록 폰트를 실제 인식하는지 검증
    (미해소 시 "설치됐는데 게임이 못 읽음" 회귀). admin 세션의 HKCU 하이브
    오인 논점 포함.
  - 안전망: 제거/정리는 이미 양쪽 하이브 스윕 (B-1차 완료).
  - 상세 계획: `docs/archive/font-analysis/bugfix-hkcu-font-removal-plan.md` §8.
  ```

주의 (Track 1에만 해당): `docs/Roadmap.md` 변경은 master 반영 시
`sync-roadmap-issue.yml`(Issue #7 본문 재작성) + `sync-roadmap-notice.yml`
(gh-pages 공지 재생성)을 트리거 — **공개 노출 텍스트**이므로 문구를 사용자
확인 후 반영, 검증은 `npm run roadmap:issue-body` / `npm run roadmap:notice`
`[Windows-pwsh]`. (husky 항목은 Track 2라 이 게이트 비적용 — v1에서 달았던
CI 결합 주의는 더 이상 해당 없음.)

### 3.2 위키 캐치업 raw 노트 범위 (작성은 본 작업 랩업 시)

파일: `~/project_llm_wiki/raw/projects/poe2-launcher/<날짜>-release-catchup-1.3.4-1.4.2.md`

1. **카카오 스타터 전환 DGS→KGS 연대기**: `1be685e`/`ec88bb0`(1.3.4) → #215
   (1.3.6) → #217(1.3.7) → `7db1c86`(1.4.0, 페이지 구조 변경 대응) →
   `e172b4e`(1.4.1, `PathOfExile_KG.exe` 감지). 관련 모듈:
   `src/main/utils/uac/kakao-game-starter.ts`, `src/main/kakao/*`.
2. **게임 경로 진단/수동 지정**: `c25e7b7`(1.4.0, `AppConfig.gameInstallPaths`
   스키마 추가 — `types.ts:91`, `config.ts:164,292`) → `74d2f15`
   (GamePathDiagnosticModal) → 1.4.2 `125627a`/`b9670ab` +
   `GameInstallStatusReconciler` 보존 규칙.
3. **POB 연동 = 미출시**: `work/pob-pr-22` 브랜치에서 진행되다 보류/폐기 —
   브랜치 ref는 현재 삭제됨, 커밋(`8210805` 등)·stash만 잔존. 위키가 "출시됨"
   으로 오기하지 않도록 명시.
4. **UpdateModal = 미커밋 WIP**: copy 추출(`update-modal-copy.ts`)+테스트
   리팩토링, 출시 아님. (처분: §4 M5 후속 — 에이전트 툴링 커밋과 분리 리뷰.)
5. 릴리스 표 1.3.4→1.4.2 + AGENTS.md의 위키 stale 경고 문구 갱신 필요 여부를
   ingest 후 재평가 (AGENTS.md 수정은 별도 승인).

### 3.3 preview.gif (8.2MB)

**유지 (종결).** blob은 이미 git 히스토리에 있어 gh-pages 이전으로 클론
비용이 줄지 않고, docs/README.md가 "README가 참조하므로 유지 중" + "신규
대형 바이너리 금지(gh-pages/릴리스 에셋 사용)" 규칙을 이미 기록함. 향후 GIF
교체 시점에만 gh-pages 호스팅으로 전환. → raw 노트 후속 #3 종결 처리.

### 3.4 투트랙 로드맵 설계 (v2 신규)

로드맵을 두 트랙으로 분리한다 — Track 1은 기존 체계 그대로, Track 2를 신설:

| 트랙 | 파일                                      | 대상                                                                     | 반영 경로                                                               |
| ---- | ----------------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| 1    | `docs/Roadmap.md` (+ `docs/roadmap/` ref) | **사용자에게 보이는** 제품 기능/변경                                     | CI: master push → Issue #7 본문 + gh-pages 공지 재생성 (**공개**)       |
| 2    | 루트 `AGENTS-ROADMAP.md` (가칭, §3.4.1)   | **개발 내부**: 개발 도구, 빌드/CI, 리팩토링, 기술부채, 에이전트 워크플로 | 없음 — CI 비결합, 공개 채널 미노출 (project_tui 루트 `ROADMAP.md` 모델) |

**라우팅 규칙 (한 문장)**: "공개 로드맵/공지에서 **사용자가 읽을 항목인가?**"
— Yes → Track 1, 개발자·에이전트만 관심 → Track 2, 애매하면 사용자에게 질문.

CI 비결합은 검증된 사실: `sync-roadmap-issue.yml`/`sync-roadmap-notice.yml`의
트리거 경로는 `docs/Roadmap.md`·`docs/roadmap/**` 정확 경로이고, 생성
스크립트 입력도 `docs/Roadmap.md` 하드코딩(`build-roadmap-issue-body.cjs:7`)
— 루트 파일은 어떤 이름이어도 Issue #7/공지에 닿지 않는다.

#### 3.4.1 루트 로드맵 파일명 — 옵션과 추천 (사용자 확정 필요)

- **옵션 R — 루트 `ROADMAP.md`** (project_tui 파일명 그대로)
  - 장점: 참조 모델과 동일 명칭, 루트 메모리 파일 관례(ROADMAP/ARCHITECTURE/
    DECISIONS) 통일.
  - 단점: `docs/Roadmap.md`와 대소문자·디렉터리만 다른 사실상 동명 — CI
    충돌은 없음(위 검증)이나 **라우팅 혼동 벡터**: "로드맵에 추가해" 류
    지시의 중의성, `rg -i roadmap` 잡음, 레포 루트에서 `Roadmap.md`로
    저장하는 실수. 대소문자 무시 Windows 환경에서 사람 혼동 가중.
- **옵션 B — `BACKLOG.md`**
  - 장점: 충돌 없음, 짧음. 단점: 내용 모델(마일스톤+DoD+검증)과 "backlog"
    뉘앙스 불일치, roadmap 검색에 안 걸림.
- **옵션 A — `AGENTS-ROADMAP.md`** ← 추천
  - 장점: 이름에 대상(에이전트/개발 내부)이 박혀 라우팅 규칙이 자기서술적.
    루트 목록에서 `AGENTS.md` 옆에 정렬(이 저장소의 "AGENTS\* = 에이전트용"
    관례 연장). `docs/Roadmap.md`와 혼동 불가.
  - 단점: project_tui 파일명과 다름(단, 미러의 본질은 파일명이 아니라 "루트
    상주 + 체크박스 마일스톤 + DoD/검증" 포맷·역할), 이름이 김.

**추천 = A (`AGENTS-ROADMAP.md`).** 확정 전까지 본 문서 드래프트는 이 가칭
표기, 확정 시 일괄 치환.

#### 3.4.2 roadmap-capture 스킬 전면 개정 드래프트 (paste-ready)

`.agents/skills/roadmap-capture/SKILL.md` 전문 교체 (기존 Track 1 지침 8단계
·검증 절차·예시는 전부 보존, 트랙 라우팅과 반영 메커니즘 설명을 추가):

````markdown
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
````

#### 3.4.3 루트 로드맵 시드 드래프트 (신규 파일, paste-ready)

`AGENTS-ROADMAP.md` (레포 루트) 초기 내용 — project_tui 루트 `ROADMAP.md`의
"한 줄 정체 선언 헤더 + 마일스톤/DoD/검증" 골격을 미러:

```markdown
# AGENTS-ROADMAP.md — 개발 내부 로드맵 (마일스톤 + DoD + 검증)

> 에이전트·개발 내부용 엔지니어링 로드맵: 개발 도구, 빌드/CI, 리팩토링,
> 기술부채, 에이전트 워크플로. 사용자에게 보이는 제품 로드맵은
> `docs/Roadmap.md`(CI가 Issue #7·gh-pages 공지로 동기화)가 별도로 담당한다.
> 이 파일은 CI와 무관하며 공개 채널에 노출되지 않는다. 라우팅 규칙:
> `.agents/skills/roadmap-capture/SKILL.md`.

## 백로그

- [ ] husky pre-commit: WSL 감지 시 lint-staged를 Windows pwsh로 위임
      — DoD: WSL에서 `git commit`이 `--no-verify` 없이 통과 / 검증: WSL 실커밋
      1회 `[WSL]` + Windows 커밋 회귀 없음 `[Windows-pwsh]`.
      의사코드: `docs/archive/2026-05-20-residual-work.md` §2.5.
```

#### 3.4.4 AGENTS.md·docs/README.md 투트랙 반영 드래프트 (paste-ready)

**(a) AGENTS.md `## Documentation map`** — 첫 불릿에서 로드맵 구절을 분리해
두 트랙을 명명 (기존 불릿 교체 → 2개 불릿):

```markdown
- `docs/README.md` defines the repo doc system: `docs/` root = user-facing
  (do not move), `docs/work/` = in-flight work notes
  (`YYYY-MM-DD-<topic>.md`), `docs/archive/` = completed work docs.
  Non-trivial work starts by checking `docs/work/` and ends by updating it.
- Roadmaps — two tracks (routing rule in the `roadmap-capture` skill):
  `docs/Roadmap.md` + `docs/roadmap/` = **user-facing product roadmap**,
  CI-coupled (master push syncs GitHub Issue #7 + the gh-pages notice —
  public text, do not move); root `AGENTS-ROADMAP.md` = **agent-internal
  engineering roadmap** (dev tooling, build/CI, refactors, tech debt —
  not CI-coupled).
```

**(b) 워크플로 섹션의 이관 문구** — §1.7 드래프트에 이미 반영됨 ("범위 밖
발견은 ... 사용자 가시 → `docs/Roadmap.md`, 개발 내부 → 루트
`AGENTS-ROADMAP.md`").

**(c) Skills 섹션의 roadmap-capture 트리거 문구** — §2.4 드래프트에 이미
반영됨 (two tracks + 라우팅 규칙 요약).

**(d) docs/README.md** — 문서 종류 표에 행 1개 추가 + 수명주기 4항 보정:

```markdown
| 루트 `AGENTS-ROADMAP.md` | 에이전트·개발 내부 로드맵 (도구·CI·리팩토링·기술부채) — CI 미결합, 비공개 | 영구. 라우팅 규칙은 roadmap-capture 스킬 |
```

수명주기 4항: "유효한 백로그 항목은 `docs/Roadmap.md`로 옮긴다" →
"유효한 백로그 항목은 roadmap-capture 트랙 규칙에 따라 `docs/Roadmap.md`
(사용자 가시) 또는 루트 `AGENTS-ROADMAP.md`(개발 내부)로 옮긴다".

---

## 4. 구현 마일스톤 (v2 — 승인 후 메인 세션 수행, 본 작업이 새 워크플로의 시범 적용)

| M   | 내용                                                                                                                                                                                                          | DoD                                                                                                                                                                                       | 검증                                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| M1  | AGENTS.md 워크플로 섹션(§1.7) + 스킬 섹션(§2.4) + Documentation map 투트랙(§3.4.4a) + CLAUDE.md 바인딩(§1.8 — **런타임 폴백 포함**)                                                                           | 본 문서 드래프트와 일치, AGENTS.md 내 중복/모순 없음, CLAUDE.md에 VSCode 폴백 분기 문구 존재                                                                                              | architect 리뷰 `[WSL]`                                                                     |
| M2  | 스킬 4종 수정 (§2.2 (1)–(4))                                                                                                                                                                                  | 스킬 내 모든 경로·file:line·API명이 소스와 일치                                                                                                                                           | architect 리뷰 + grep 대조 `[WSL]`                                                         |
| M3  | kakao-automation 신설 + windows-electron-debugging 포인터 교체 (§2.3, 승인됨)                                                                                                                                 | SecurityCenter 정책이 정확히 1곳에만 존재                                                                                                                                                 | architect 리뷰 `[WSL]`                                                                     |
| M4  | **투트랙 로드맵 구축**: 루트 로드맵 신설+시드(§3.4.3, husky 포함) · roadmap-capture 전면 개정(§3.4.2) · Track 1 HKCU P2 엔트리+ref(§3.1) · docs/README.md 행/수명주기(§3.4.4d) · residual-work 아카이브(§3.1) | 루트 로드맵 존재+husky 항목, 스킬이 드래프트와 일치, residual-work가 `docs/archive/`로 이동, Roadmap 생성물 검증 통과                                                                     | `npm run roadmap:issue-body`/`roadmap:notice` `[Windows-pwsh]` + 공개 문구 확인 `[사용자]` |
| M5  | 랩업: 위키 raw 노트 2건(본 작업 + §3.2 캐치업) 작성 → 위키 저장소 `/ingest` → 본 문서 `docs/archive/` 이동 → **`chore(...)` 커밋을 현 `feat/next-release`에**                                                 | 노트 2건 존재+ingest 완료; **커밋에 에이전트 툴링 변경만 포함 — UpdateModal WIP 3파일(`UpdateModal.tsx`·`UpdateModal.test.ts`·`update-modal-copy.ts`) 미포함**을 `git show --stat`로 확인 | `[WSL]` + 사용자 확인                                                                      |

- **브랜치 (사용자 결정)**: 본 작업은 새 브랜치 없이 현 `feat/next-release`
  에서 계속한다 — 에이전트 정비가 이미 이 브랜치 위에서 진행 중이라 "master
  에서 분기" 규칙(§1.2 2단계)의 **1회 예외**이며, 규칙은 다음 작업부터
  적용한다. 본 작업만의 별도 PR/머지는 없음 — 이 브랜치의 PR/머지는
  next-release 작업 전체의 일정을 따른다.
- **M5 후속 (별도 사안, 본 작업 범위 밖)**: 브랜치에 선재하는 미커밋
  UpdateModal WIP(copy 추출 + 테스트)를 에이전트 툴링 커밋에 섞지 않고
  **분리 리뷰**한다 — 채택/폐기/보완 판단 후 별도 커밋. 이 브랜치가 PR로
  가기 전 완료 필요.
- 전 마일스톤이 문서/에이전트 설정 변경이라 `[사용자]` 실동작 DoD는 없음.
  단 M4의 Track 1 문구는 공개 노출(Issue #7·공지)이므로 머지 전 사용자 확인
  필수.

## 5. 호환성 영향 (blast radius)

- **런타임/사용자 데이터: 영향 없음.** `AppConfig`/`DEFAULT_CONFIG`·마이그레이션
  ·업데이터·카카오 셀렉터를 일절 건드리지 않음 (전부 문서·에이전트 설정).
- **AGENTS.md/CLAUDE.md/스킬**: 이후 모든 에이전트 세션의 행동 규칙 변경 —
  프로세스 리스크만 있고 되돌리기 쉬움. 스킬 수정은 전부 "소스 사실로의 교정"
  이라 리스크 감소 방향.
- **Roadmap.md (Track 1)**: master 반영 시 CI가 GitHub Issue #7 본문과
  gh-pages 공지를 재생성 — 공개 텍스트 변경이므로 문구 사용자 확인 게이트
  포함 (M4).
- **루트 로드맵 (Track 2)**: CI 비결합 검증됨 — sync 워크플로 트리거는
  `docs/Roadmap.md`·`docs/roadmap/**` 정확 경로, 생성 스크립트 입력은
  `docs/Roadmap.md` 하드코딩(`build-roadmap-issue-body.cjs:7`). 루트 파일은
  파일명과 무관하게 공개 채널에 닿지 않는다. 남는 리스크는 라우팅 혼동뿐 —
  파일명 선택(§3.4.1)으로 완화.
- **VSCode 폴백 (§1.8)**: 실행 경로 차이일 뿐 산출물 규약(리뷰 기록 위치·판정
  어휘)은 동일 — 리뷰어 분리 요건(Fable 5 + 분리 컨텍스트)도 유지됨. 단
  폴백에서는 도구 제한이 프롬프트 수준 약속이라 강제력이 낮음 → "CLI 최선"
  한 줄로 완화.
- **브랜치 예외**: `feat/next-release`에 선재하는 미커밋 UpdateModal WIP와의
  혼입 리스크 → M5 DoD(커밋 파일 목록 검사)로 통제.
- 기록된 결정과의 충돌: 없음. preview.gif는 기존 기록(유지)과 동일 방향으로
  후속 항목만 종결. 계획 단계 주체 규칙(§1.1)은 CLAUDE.md Model routing과의
  긴장을 "루틴=세션, 난제=architect + 리뷰 분리는 무조건"으로 해소 — 라우팅
  결정을 뒤집지 않음. Track 1 로드맵 체계(구조·CI·완료됨 규칙)는 변경 없이
  보존 — Track 2는 순수 추가.

## 6. 결정 현황과 열린 질문

**확정 (v1 검토에서 사용자 승인 — 재론 없음)**:

1. 성문화 형태 = **A** (AGENTS.md 섹션 + CLAUDE.md 바인딩).
2. 경량 트랙 허용 (게이트 4종 유지 전제).
3. 리뷰 루프 캡 = 3라운드.
4. kakao-automation 스킬 신설.
5. PR 본문 "Test plan" 섹션 금지의 AGENTS.md 성문화.
6. 브랜치 = 현 `feat/next-release` 계속(1회 예외) + `chore(...)` 커밋 +
   UpdateModal WIP 분리 리뷰 (§4).

**열린 질문 (v2, 사용자 확정 필요)**:

1. **루트 로드맵 파일명** — 추천 `AGENTS-ROADMAP.md` (§3.4.1). 대안: 루트
   `ROADMAP.md`(project_tui 동명 미러 — 단 `docs/Roadmap.md`와의 혼동 벡터),
   `BACKLOG.md`(의미 불일치). 확정 시 §1.7·§2.4·§3.4 드래프트 내 가칭 일괄
   치환.
2. **HKCU 폰트 항목 (Track 1)** — P2 배정 + 공개 문구(Issue #7·공지 노출분)
   확인 (M4 게이트와 동일 사안).
3. (경미) docs/README.md 투트랙 반영(§3.4.4d)을 M4에 포함하는 범위 — 이견
   없으면 드래프트대로 진행.

---

## 리뷰 로그

### M1 — R1 (architect, 2026-07-07)

- 판정: **조건부 통과** (아래 지적 2건 수정, 재리뷰 불필요)
- 검증: §1.7·§1.8·§2.4·§3.4.4a 드래프트 ↔ AGENTS.md(:40-85 워크플로,
  :89-98 Documentation map, :123-148 Skills)·CLAUDE.md(:33-51 바인딩)
  기계 대조(diff) — **4건 전부 문자 단위 일치**, 삽입 위치도 제안 위치와
  일치. DoD(c): VSCode 폴백 분기(`general-purpose` +
  `model: "claude-fable-5"` + `.claude/agents/architect.md` 인라인 +
  upstream #24439) CLAUDE.md:43-50 존재, `.claude/agents/architect.md`
  실재 확인. DoD(d): `AGENTS-ROADMAP.md` 표기 AGENTS.md:70·96·144 3곳
  일관(전부 "루트/root" 한정 표기), 가칭/placeholder 잔재 없음,
  `docs/Roadmap.md`는 항상 `docs/` 경로 동반이라 혼동 벡터 없음.
  M1 범위 밖의 의도치 않은 변경 없음(기존 섹션 원형 유지).
- 지적:
  1. AGENTS.md:62·:76 — "(위 WSL 규칙 참조)" / "(위 WSL 규칙)": WSL
     execution rules 섹션(:150)은 워크플로 섹션(:40)보다 **아래**에 있어
     방향 오기. §1.7 드래프트 자체의 오기이며 구현은 verbatim 요건을 준수
     — 스펙 정오 사항. "(아래 WSL 규칙 …)" 또는 방향 중립 "(WSL 규칙
     참조)"로 수정할 것. 본 항목이 §1.7 드래프트의 정오표를 겸하므로
     수정해도 DoD(a) 위반 아님.
  2. CLAUDE.md:29-31 — Model routing 말미 "architect is **only** for the
     deep-judgment cases above"가 바로 다음 섹션의 바인딩(모든 4단계 리뷰
     = architect, 경량 트랙 포함)과 문자적으로 충돌. §1.1은 계획 단계
     긴장만 해소했고 §1.8 드래프트가 Model routing 개정을 포함하지 않아
     남은 잔여 긴장 — 루틴 fix의 4단계 리뷰를 built-in /code-review로
     대체해 리뷰 분리를 건너뛰는 오독 경로가 열림. 마지막 불릿에 워크플로
     게이트 예외를 한 줄 반영할 것 (예: "… architect is only for the
     deep-judgment cases above **and the 개발 워크플로 설계·리뷰
     게이트(다음 섹션)**").
- 비차단 노트 (blocking 아님):
  - AGENTS.md:85 경량 트랙의 "4개 게이트(계획 승인·분리 리뷰·사용자
    검증·머지 승인)" 열거가 본 문서 §1.1 "게이트 4개 = 계획 승인/실동작
    검증/머지 승인/릴리스 결정(전부 사용자 소유)"과 구성이 다름(분리 리뷰
    ↔ 릴리스 결정 교체). 승인된 드래프트 그대로라 M1 결함은 아니나 "4개
    게이트" 용어가 두 의미로 과적재 — 후속 문서 개정 시 정리 권고.
  - `AGENTS-ROADMAP.md` 파일은 아직 미생성 — M4 산출물이므로 M1 시점의
    전방 참조는 설계상 정상. M4 완료 전 이 브랜치가 PR로 가지 않도록만
    유의.

### M2 — R1 (architect, 2026-07-07)

- 판정: **조건부 통과** (지적 1건 수정, 재리뷰 불필요)
- 검증 (DoD a–e):
  - (a) 4종 스킬의 경로·심볼·API 전수 소스 대조 — 전부 일치:
    `isLaunchBlockingStatus`(GameStatusStore.ts:39 =
    preparing/processing/authenticating/ready/running), reconciler 방출
    집합(GameInstallStatusReconciler.ts:99-104 idle/uninstalled/
    install_check_blocked, :183 running), stopping·error 비보존
    (`shouldPreserveRuntimeGameStatus` = `isLaunchBlockingStatus`;
    GameStatusStore.test.ts:45 stopping=false), `install_check_blocked`
    (shared/types.ts:261), CONFIG_KEYS 레거시 주석 위치(config.ts:233) +
    비망라 실증(FONT_MUTATION_SCHEMA는 CONFIG_METADATA에만 존재),
    `DEFAULT_CONFIG: AppConfig`(config.ts:268), config-integrity.test.ts
    (src/renderer/settings/ — store-backed UI 아이템만 DEFAULT_CONFIG
    대조, 테스트 자체 힌트에 "UI 없는 자동관리 config 누락은 여기서 잡히지
    않음" 명시), ORPHANED CONFIGS(Legacy/Unknown)·Unmapped Field
    (ConfigViewer.tsx:309·314, components/debug), `gameInstallPaths`
    (types.ts:26 `Record<ServiceChannel, Record<ActiveGame, string>>` =
    nested per-service, :91), GamePathDiagnosticModal·
    GameInstallStatusReconciler 실재, `CORE_EVENT_HANDLERS`
    (register-handlers.ts:41, :73-77 eventBus.register), EventType/
    AppEvent/EventHandler{id,targetEvent,handle}(events/types.ts:14/287/
    439-445), preload.ts:33 exposeInMainWorld("electronAPI"),
    `src/renderer/components/settings/items/` 실재(SettingCheck.tsx가
    `CheckItem` export — 스킬의 컴포넌트명 유효), `resetDescription`
    (settings/types.ts:94 외; `clearDescription` 소스 0건), dependsOn
    오브젝트 폼(settings/types.ts:81), isConfigForced(shared/types.ts:475),
    disableUACBypass(:564), 아이템 타입 8종·suffix·copyable·externalLink·
    isExpandable 전부 실재.
  - (b) §2.2 드래프트 4종 ↔ diff 기계 대조 — 전부 반영. prettier 훅의
    포맷 변형(빈 줄, `*`→`_`, 세미콜론)은 비차단 — 단 예제 1건 의미 훼손
    (아래 지적 1).
  - (c) 경계 유지: config-management = 데이터층(§4에서 UI를
    settings-management로 handoff), settings-management = UI층
    (PREREQUISITE에서 데이터층을 역방향 handoff). CONFIG_KEYS 표현 양측
    동일("legacy … only if referenced").
  - (d) settings-management의 잔존 "fails `config-integrity.test.ts`"
    2곳(PREREQUISITE, Mistake 1)은 맥락상 정확 — 대상이 settings-screen
    persistent 필드(= defaultValue 없는 store-backed UI 아이템)이고,
    테스트가 정확히 그 케이스의 DEFAULT_CONFIG 누락을 잡음.
    config-management의 "not caught by CI"(UI 없는 필드)와 상보 관계 —
    모순 아님, 감사 지적의 올바른 해소.
  - 드래프트 외 2건(implementer 자체 추가)은 둘 다 정당 — overreach 아님:
    intro box의 허위 테스트 claim 제거(UI 없는 orphan은 그 테스트가 못
    잡는 케이스 — 소스로 확증)와 §4 "steps 1–4" → "required steps above"
    (3+1 재구성 후 방치하면 조건부 4번을 필수로 재모순시킴).
- 지적:
  1. event-ipc-integration SKILL.md:30 — prettier 훅이 유니온 append
     예제를 `export type AppEvent /* existing */ = MyCustomEvent;`로
     변형해 "기존 유니온에 추가"(:17 지시문)가 "단독 할당(유니온 대체)"
     예제로 의미 훼손. prettier-안정형(leading-pipe 멀티라인)으로 교체:
     `export type AppEvent =` / `  | ExistingEvent // ...existing` /
     `  | MyCustomEvent;`. 1곳 수정, 재리뷰 불필요.
- 비차단 노트 (blocking 아님):
  - windows-electron-debugging SKILL.md:100이 **미생성**
    `kakao-automation` 스킬(Rule 3)을 전방 참조하며 SecurityCenter 분류
    정책 원문(선택자 목록)을 삭제 — §2.3 "동반 수정"으로 승인된 내용이나
    M2 범위(4종) 밖 선반영. kakao-automation 신설과 같은 커밋으로 묶을 것
    (신설 전 단독 커밋되면 정책 원문이 리포에서 소실).
  - config-management SKILL.md:3 frontmatter description은 여전히 4종
    평면 나열("…CONFIG_METADATA, CONFIG_KEYS, DEFAULT_CONFIG…") — "covers"
    라 사실 오류는 아니나 본문 3+1 구조와 톤 불일치. 후속 정리 권고.
  - §2.2 (4)의 "clearDescription 2곳" 계수는 과다(HEAD 원본에 1곳뿐) —
    구현은 잔존 0건으로 올바름. 스펙 정오만 기록.

### M3+M4 — R1 (architect, 2026-07-07)

- 판정: **조건부 통과** (지적 2건 수정, 재리뷰 불필요)
- 검증:
  - **M3**: kakao-automation SKILL.md ↔ §2.3 드래프트 기계 대조 — 문자
    단위 일치. DoD(정책 1곳) grep 확증: `.section--device-save`/
    `.modal--device-loading`/`MOTP`가 스킬 중 kakao-automation에만 존재.
    windows-electron-debugging diff = -5/+1로 정확히 분류 정책 블록만
    포인터(Rule 3 지시)로 교체, 덤프 수집·독해 순서(.json→.txt→.html→.png)
    잔존. Rule 3 내용은 visibility-policy.ts:41-68과 전면 일치
    (auto-progress 셀렉터/텍스트, user-required MOTP·ARS·kp·기기명·tel
    input, unresolved→지연 노출). 구조 지도: kakao 파일 5종 실재,
    preload.ts 1,369줄("~1.4k" ✓), SecurityCenterHandler(preload.ts:
    940-947), uac-migration.ts 실재. M2 비차단 노트 이행 상태 확인:
    포인터 교체와 신설 스킬이 둘 다 미커밋으로 공존 — M5 단일 chore
    커밋에 묶는 경로 유지됨.
  - **M4**: roadmap-capture ↔ §3.4.2, AGENTS-ROADMAP.md ↔ §3.4.3,
    hkcu-font-install.md ↔ §3.1, Roadmap.md 엔트리 ↔ §3.1 — 전부 문자
    단위 일치. Track 1 원 지침 8단계·Validation(스크립트 2종 + Windows
    주의)·예시 전부 보존(1:1 매핑). 라우팅 규칙은 skill Step 0 ·
    AGENTS-ROADMAP 헤더 · AGENTS.md · docs/README 간 상호 일관(애매→사용자
    질문 포함). CI 사실 대조 전부 실재: sync 워크플로 2종 트리거 경로,
    `gh issue edit 7`, notice 출력 `gh-pages/notice/[notice]roadmap.md`,
    npm `roadmap:issue-body`/`roadmap:notice`,
    `build-roadmap-issue-body.cjs:7` 하드코딩. Roadmap.md diff = P2 말미
    +1줄(기존 항목과 동일 체크리스트 포맷), ref-strip 정규식
    (`\s+\(\[ref\]\([^)]+\)\)`) 매칭·`[ref](`/omit 가드 통과·notice 추출
    (`## P0`→끝 슬라이스)까지 정적 추적으로 파스 안전 — 단 실제
    `npm run roadmap:*` 실행 `[Windows-pwsh]` + 공개 문구 `[사용자]` 확인은
    M4 DoD상 잔여 게이트(마일스톤 정의대로, 결함 아님). residual-work
    `git mv` + 종결 헤더 확인, AGENTS-ROADMAP husky 항목의 ref는 아카이브
    파일 §2.5(의사코드 포함)로 해소. hkcu ref 문서 주장 소스 확증
    (installSystemFont powershell.ts:879 → `$env:windir\Fonts` :185
    admin 전용, 제거는 양쪽 하이브 스윕 :943-968, 상세 계획 §8 실재).
  - **드래프트 초과 2건 판단 (docs/README.md)**: overreach 아님 —
    Roadmap 행 "(Track 1)" 라벨과 표 하단 투트랙 1문장은 Track 2 행
    신설과 짝을 이루는 일관화이고, 문장은 권위를 roadmap-capture 스킬로
    위임해 규칙 중복 없음. 신설 행의 "(Track 2)" 부기도 동일 취지로 승인.
- 지적:
  1. kakao-automation SKILL.md:19-20 — 구조 지도가 "`PathOfExile_KG.exe`
     감지"를 kakao-game-starter.ts에 귀속했으나 **해당 파일에 그 문자열·
     로직이 없음**(rg 0건). 실제 위치: `src/main/config/
GameServiceProfiles.ts:20,25`(프로필 executable/processKeywords),
     `src/main/utils/registry.ts:63`(설치 감지 — 근거 커밋 `e172b4e`가
     실제로 고친 파일), `GameProcessStatusHandler.ts`(프로세스 감지).
     kakao-game-starter.ts의 실제 역할은 스타터 exe 레지스트리 해석 +
     runAsInvoker UAC 상태 + DGS→KGS 마이그레이션 요청 산출. §2.3 드래프트
     자체의 오기(스펙 정오)로 구현은 verbatim 준수 — 다만 이 스킬의 존재
     이유가 구조 지도의 정확성이므로 수정 필수. 예: "— 2026-06 DGS→KGS
     전환·마이그레이션 판단 (게임 exe `PathOfExile_KG.exe` 감지는
     `GameServiceProfiles.ts`·`utils/registry.ts`)".
  2. docs/README.md:3 — "문서는 **네 종류**로 나뉜다"가 M4의
     AGENTS-ROADMAP 행 추가로 표 5행과 불일치. "다섯 종류" 또는 개수
     비명시 표현("다음과 같이 나뉜다")으로 수정.
- 비차단 노트 (blocking 아님):
  - roadmap-capture reflection 문단이 notice 워크플로도 `docs/roadmap/**`
    터치로 트리거되는 것처럼 묶어 서술 — 실제 sync-roadmap-notice.yml
    트리거는 `docs/Roadmap.md`+template+스크립트뿐. 과잉 경계 방향(보수적)
    이라 방치 가능, 승인 드래프트 문안 그대로임. 후속 정리 권고.
  - kakao 구조 지도에 `src/main/kakao/account-validation-dom.ts`(6번째
    파일) 미기재 — frontmatter 트리거가 "anything under src/main/kakao/"
    로 커버하므로 지도는 대표 목록으로 허용.
  - 아카이브 종결 헤더의 "나머지 §2·§3은 AGENTS.md에 성문화됨"은
    §2.2(상황 소멸)·§2.3(수용 종결)·§2.4(권위는 config-management 스킬)·
    §2.6(사용자 도구 이슈)에는 부정확한 일반화 — 참조용 보관 문서라
    비차단, 원하면 "해소·성문화·종결로 처분"류로 완화.
  - 스킬의 `.modal--device-loading` 표기는 소스 셀렉터
    `.modal--device-loading.modal--show`(visibility-policy.ts:44)의 축약 —
    정책 문서 수준 표기이고 Rule 1이 구현 시 덤프 근거를 강제하므로 허용.
