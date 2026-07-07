# docs/ 문서 체계

이 저장소의 문서는 다섯 종류로 나뉜다. 새 문서를 만들기 전에 어느 칸에
속하는지 먼저 정한다.

| 위치                                | 용도                                                                                | 수명                                                            |
| ----------------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `docs/` 루트                        | 사용자·기여자 대상 문서 (`README_KR.md`, `CLA.md`, `SUPPORT*.md`, 이미지 자산)      | 영구. 외부(README, PR 템플릿)에서 링크되므로 **이동/개명 금지** |
| `docs/Roadmap.md` + `docs/roadmap/` | 사용자 로드맵(Track 1) 단일 소스 + 하위 기획                                        | 영구. CI가 경로를 하드코딩하므로 **이동/개명 금지** (아래 참조) |
| 루트 `AGENTS-ROADMAP.md`            | 에이전트·개발 내부 로드맵 (도구·CI·리팩토링·기술부채) — CI 미결합, 비공개 (Track 2) | 영구. 라우팅 규칙은 roadmap-capture 스킬                        |
| `docs/work/`                        | 진행 중 작업 문서 — 분석, 계획, 세션 인계 노트                                      | 작업 완료 시까지. 완료되면 위키 반영 후 `archive/`로            |
| `docs/archive/`                     | 완료된 작업 문서 — 위키에 반영됐거나 역사 기록용                                    | 영구 보관 (참조용, 갱신하지 않음)                               |

로드맵이 왜 두 트랙인지·무엇을 어디에 넣는지는 `roadmap-capture` 스킬이
정의한다 (사용자 가시 제품 변경 → Track 1, 개발 내부 항목 → Track 2).

## work/ 작성 규칙

- 파일명: `YYYY-MM-DD-<주제>.md` (위키 raw 노트와 동일한 규칙).
- 머리에 상태 블록: `> 작성일: YYYY-MM-DD · 상태: <계획|진행|보류> · 브랜치: <branch>`
  (기존 문서들의 관례를 그대로 표준화한 것).
- 갱신하면 `갱신: YYYY-MM-DD`를 추가한다.

## 작업 문서 수명주기

1. 굵직한 작업 시작 → `docs/work/YYYY-MM-DD-<주제>.md`에 계획/분석 기록.
2. 작업 완료 → 위키 raw 노트(`~/project_llm_wiki/raw/projects/poe2-launcher/`)
   작성 후 위키 저장소에서 `/ingest`.
3. 위키 반영 후 → 문서를 `docs/archive/`로 이동 (관련 클러스터는
   하위 폴더로 묶는다, 예: `archive/font-analysis/`).
4. `work/`에 남아 있는 문서 = 아직 끝나지 않은 작업. 주기적으로 훑어서
   완료된 것은 아카이브, 유효한 백로그 항목은 roadmap-capture 트랙 규칙에
   따라 `docs/Roadmap.md`(사용자 가시) 또는 루트 `AGENTS-ROADMAP.md`(개발
   내부)로 옮긴다.

## 금지 사항

- **로그·스크린샷·실행 산출물을 docs/에 넣지 않는다.** `*.log`는 gitignore
  대상이다. 임시 산출물은 `scratch/`(비추적)를 쓴다.
- 대형 바이너리 자산(GIF 등)은 추가하지 않는다. 필요하면 gh-pages나 릴리스
  에셋으로 올리고 링크한다 (기존 `PoE Unofficial Launcher preview.gif`는
  README가 참조하므로 유지 중).

## CI가 의존하는 경로 (이동하면 조용히 깨짐)

- `docs/Roadmap.md`, `docs/roadmap/**` — `.github/workflows/sync-roadmap-issue.yml`,
  `sync-roadmap-notice.yml`의 트리거 경로이자 `scripts/build-roadmap-*.cjs`의
  하드코딩 입력.
- `docs/README_KR.md`, `docs/SUPPORT.md`, `docs/PoE Unofficial Launcher preview.gif` — 루트 `README.md`가 링크.
- `docs/CLA.md` — `.github/PULL_REQUEST_TEMPLATE.md`가 절대 URL로 링크.
