# 폰트 메타/메트릭스 변조 + 크기 보정 구현 계획 (2-step)

> 작성일: 2026-05-18 (재작성)
> 근거: `font-mutation-analysis.md`(동 폴더) 9·10장 + 샘플 수직보정 전수조사
> 원칙: 최소 변경 / 본체 metrics 상수 직접 주입 / step 단위로 검증 후 진행

---

## 0. 확정된 사실 (재작성 배경)

- **100% 기준 = PoE 본체 폰트 metrics** (`content.ggpk` 추출 실측, 보고서 9.3). PoE1·PoE2 폰트 파일 MD5 동일 → 게임 분기 불필요.
- **크기 보정(metrics 주입)은 필수**. 안 하면 글자 과대 (런처 현재 문제).
- **수직 정렬 보정은 선택**. 샘플 절반(Kostar cy=533, 빙그레 308 등)이 **수직 무보정으로도 게임 정상 적용** → 게임은 글리프 cy에 민감하지 않음. 거슬리는 일부 폰트만 배포자가 손봄.
- 슬라이더 **Noto / Spoqa 독립**, 50~150%, 기본 100%.
- UI에 **description 영역** 포함. 문구는 보고서 10.4에서 확정됨(아래 step 1).
- 작업 분할: **거슬릴 만한 폰트(Kostar/메이플)는 사용자가 step 2 완료 후 게임 실측**해 수직보정 필요성 판단 → step 3.

---

## STEP 1 — UI 추가 + Mockup (로직 없음, 디자인 파악용)

목표: 폰트 디테일 설정 UI를 시각적으로 확정. **변조 로직·설정 저장 연결 안 함.** 더미 상태로 디자인만.

### 1.1 위치

`src/renderer/components/modals/FontManagerModal.tsx` (659줄, 기존 폰트 설정 모달) 내부에 "폰트 디테일 설정" 섹션/탭 추가.

### 1.2 구성 요소 (mockup)

```
┌─ 폰트 디테일 설정 ───────────────────────────────┐
│                                                  │
│  Noto Sans CJK TC                                │
│  크기   50% ●━━━━━━━━━━○━━━━━━━ 150%   [100%]    │
│  ┌ 설명 ──────────────────────────────────────┐ │
│  │ POE2 전용 — NPC 대화창, 스토리·퀘스트,      │ │
│  │ 신규 UI 패널의 한글 텍스트                  │ │
│  └────────────────────────────────────────────┘ │
│                                                  │
│  Spoqa Han Sans Neo                              │
│  크기   50% ●━━━━━○━━━━━━━━━━━━ 150%   [100%]    │
│  ┌ 설명 ──────────────────────────────────────┐ │
│  │ POE1 한글 전체 / POE2 아이템 툴팁·이름,     │ │
│  │ HUD·버프·스킬 UI, 채팅창                    │ │
│  └────────────────────────────────────────────┘ │
│                                                  │
│  ※ POE1은 Spoqa만, POE2는 둘 다 교체해야 적용   │
│  [기본값 복원]                                   │
└──────────────────────────────────────────────────┘
```

- 슬라이더 2개 (Noto/Spoqa), 각 현재값 % 표시, 50~150 범위, step 5 권장
- description 박스: 보고서 10.4 확정 문구 그대로
- 하단 안내(POE1/POE2 차이) + 기본값 복원 버튼
- 상태는 `useState` 로컬 더미 (저장/IPC 미연결)

### 1.3 Step 1 검증 (declare-done 기준)

- 모달에 섹션 렌더, 슬라이더 조작 시 % 숫자만 갱신(로컬 state)
- 로직 없음 확인: 슬라이더 움직여도 폰트 재설치/설정 저장 안 일어남
- 사용자 디자인 OK 승인 → step 2 진행

---

## STEP 2 — metrics 보정 로직 반영 (크기 %)

목표: step 1 UI를 실제 변조 파이프라인에 연결. **크기 보정만.** 수직 보정 제외.

### 2.1 데이터 모델 (`src/shared/font-targets.ts`)

`FontMutationRule` 확장 — 본체 정답 상수(보고서 9.3) 추가:

| 필드                                   | Noto Sans CJK TC Book | Spoqa Han Sans Neo Regular |
| -------------------------------------- | --------------------- | -------------------------- |
| baseHheaAscent / Descent               | 1160 / -288           | 970 / -282                 |
| baseWinAscent / Descent                | 1160 / 288            | 1100 / 310                 |
| typoAscender / Descender / Gap         | 880 / -120 / 0        | 970 / -282 / 0             |
| fsSelection / usWeightClass / macStyle | 64 / 400 / 0          | 192 / 400 / 0              |
| uniqueSubFamily / version              | (9.3 원문)            | (9.3 원문)                 |

- Fontin(GGG)은 본체 미확보 → 이번 범위 제외(기존 4필드 유지, scale 무시).

### 2.2 설정 저장 (`src/shared/types.ts` AppConfig)

```
fontScaleNoto?: number;   // 50~150, 기본 100
fontScaleSpoqa?: number;  // 50~150, 기본 100
```

기존 ConfigSync 경로 재사용. 신규 인프라 없음.

### 2.3 변조 워커 (`src/main/workers/FontMutatorWorker.ts`)

- **name table**: ID 1/2/4/6 = rule값. ID 3 = `rule.uniqueSubFamily` 원문(현재 잘못된 합성 제거, 보고서 3.3 결함①). ID 5 = version 추가. **ID 16/17 주입 코드 제거**(본체에 없음, 결함②).
- **metrics 주입 (크기 %)** — 검증된 공식(보고서 9.4):

```
ascRatio = baseHheaAscent / (baseHheaAscent - baseHheaDescent)
newLine  = round((baseHheaAscent - baseHheaDescent) * 100 / scale)
hhea.ascent  = round(newLine * ascRatio)
hhea.descent = hhea.ascent - newLine

winRatio = baseWinAscent / (baseWinAscent - baseWinDescent)
winLine  = round((baseWinAscent - baseWinDescent) * 100 / scale)
OS/2.usWinAscent  = round(winLine * winRatio)
OS/2.usWinDescent = OS/2.usWinAscent - winLine

// scale 무관 고정
OS/2.sTypo* = 본체 상수, fsSelection = 본체값, usWeightClass = 400, head.macStyle = 0
```

- **글리프는 건드리지 않음** (수직 보정 step 3로 분리).

### 2.4 설정 전달 (`src/main/services/FontManager.ts`)

[FontManager.ts:552-558](src/main/services/FontManager.ts) 변조 호출부에서 AppConfig의 scale 읽어 targetName별 매핑 후 `mutateFontName(path, rule, scale)` 로 전달 (시그니처에 scale 추가).

### 2.5 UI ↔ 로직 연결

step 1 더미 state → AppConfig 저장 + 슬라이더 변경 시 폰트 재변조·재설치 트리거(디바운스). 가능하면 기존 재설치 경로 재사용 → 신규 IPC 0개. 불가 시 `font:set-scale` 1개만.

### 2.6 Step 2 검증 (declare-done 기준)

- 검증 스크립트(`verify_mutation.mjs`, 미커밋 — 아래 부록 공식으로 재작성 가능): Kostar를 새 워커 로직(scale=100)으로 변조 → 산출물 hhea/win/typo/fsSel/mac/name이 보고서 9.3 본체 상수와 **필드단위 assert 일치**.
- scale 50/150 → 산출물 라인높이가 9.4 공식 예측값과 일치.
- `npm run lint` / `tsc` 통과.
- 사용자 게임 실측: 100%에서 게임 기본 폰트와 동일 크기. **이때 Kostar/메이플 등 거슬릴 만한 폰트의 수직 위치도 함께 육안 확인 → step 3 필요성 판단.**

---

## STEP 3 — 수직 보정 (필요성 확인 후 조건부)

목표: step 2 게임 실측에서 수직 위치가 거슬리는 폰트가 있으면 보정 추가. **없으면 step 3 자체를 스킵.**

### 3.1 필요성 판단 (사용자)

step 2 완료 후 사용자가 Kostar/메이플 등을 게임에 적용해 육안 확인:

- 거슬림 없음 → **step 3 불필요, 종료** (글리프 무변형 유지)
- 일부 폰트 거슬림 → 3.2 진행

### 3.2 보정 방식 (필요 시)

- 목표: 글리프 세로 중심을 게임 본체 cy(≈384, upm1000)에 맞춤
- 보정량 = `384 - 원본폰트_cy` (폰트별 자동 계산, 고정값 아님)
- 글리프 전체 y 평행이동 (fonteditor-core glyf 좌표 조작 — 지원 여부 사전 확인)
- 설정 노출 여부: 자동 적용 vs 토글. step 2 실측 결과 보고 결정.

### 3.3 Step 3 검증

- 보정 후 산출물 cy가 384±tolerance
- 사용자 게임 실측에서 수직 위치 정상

---

## 미확정 / 사용자 결정 필요

1. **누락 글리프("외계어") 폴백**: 사용자 커스텀 폰트에 게임 요구 글리프가 없으면 두부(□) 가능. 보고서 10.2 "외계어 추가" 작업 관련. 범위/우선순위 추후 결정 (이번 3-step 외).
2. **GGG/Fontin**: 본체 미확보. 범위 제외.
3. **unitsPerEm≠1000(Pretendard 등)**: fonteditor-core upm 스케일 지원 여부 step 2에서 확인. 미지원 시 해당 폰트 metrics 보정 스킵 + 경고.
4. **재변조 트리거**: 슬라이더 변경 시 자동(디바운스) vs "적용" 버튼 — step 1 mockup 단계에서 UX 결정.
