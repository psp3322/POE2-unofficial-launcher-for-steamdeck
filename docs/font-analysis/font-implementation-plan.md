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

## STEP 3 — 수직 보정 (필요성 실증됨, 계획 단계)

> 상태: **STEP 2 실게임 테스트로 필요성 확정.** Kodia 적용 시 닉네임이
> 라인박스 하단으로 처지고 윗여백 514(본체 정답 334) 폭발 — 수직정렬 깨짐
> 육안+실측 확인. 더 이상 "조건부 스킵" 아님. 단 **계획 승인 전 개발 금지.**
>
> **범위 한정: STEP 3 = 수직정렬(글리프 y평행이동)만.** 샘플이 추가로
> 하던 작업 분류:
>
> | #   | 샘플 작업                    | 처리                                                                      |
> | --- | ---------------------------- | ------------------------------------------------------------------------- |
> | 1   | Name table 교체              | ✅ STEP 2 완료 (결함 2건 정정 포함)                                       |
> | 2   | 크기 보정 (metrics)          | ✅ STEP 2 완료 (슬라이더)                                                 |
> | 3   | 글리프 확대 ×1.13            | ✅ STEP 2가 metrics로 동일 효과 대체 (글리프 무확대 방침)                 |
> | 4   | **수직 정렬 (글리프 y이동)** | **← 이번 STEP 3**                                                         |
> | 5   | 외계어(누락 글리프) 추가     | **STEP 4로 분리** (성격 상이: 좌표이동 vs 글리프 주입). 미계획, 별도 조사 |

### 3.1 원인 (실측 확정)

- 게임은 `hhea.ascent~descent` 라인박스에 글자를 앉힌다. STEP 2가 ascent를
  본체값(Noto 1160)으로 키웠으나 **글리프는 원본 그대로** → 원본 글리프가
  baseline 아래로 치우친 폰트는 라인박스 윗부분이 텅 비고 글자가 하단에 몰림.
- 샘플 제작자는 metrics만으론 안 되니 **글리프를 직접 y평행이동(+확대)** 했다
  (보고서 7.3 Kodia 수동 GUI 보정). 런처는 글리프 무변형 방침 → 깨짐.

### 3.2 측정 데이터 (보정 공식의 입력)

게임 본체 Noto 목표 cy ≈ **378** (한글 한/가/나 평균, upm1000 정규화).
`보정필요량 = 목표378 − 원본cy`:

| 폰트       | 원본cy | 샘플cy | 목표−원본 (런처 보정필요) | 샘플−원본 (샘플 실제이동) | 샘플−목표 (샘플 오차) |
| ---------- | ------ | ------ | ------------------------- | ------------------------- | --------------------- |
| Kodia      | 212    | 364    | **+166**                  | +152                      | −14                   |
| 프리텐다드 | 164    | 358    | **+214**                  | +194                      | −20                   |
| 이사만루   | 311    | 412    | +67                       | +101                      | +34                   |
| 메이플     | 321    | 383    | +57                       | +62                       | +5                    |
| 빙그레     | 341    | 341    | +37                       | **0 (무이동)**            | −37                   |
| DNF-M      | 345    | 345    | +33                       | **0 (무이동)**            | −33                   |
| Kostar     | 526    | 526    | **−148**                  | **0 (무이동)**            | +148                  |

**핵심 관찰**:

1. **보정필요량은 폰트마다 다르다** (−148 ~ +214). 단일 고정값 불가 →
   `목표 − 원본cy` 폰트별 자동계산이 유일하게 일관된 방법.
2. 샘플 제작자는 **들쭉날쭉**: Kodia/프리텐다드/이사만루/메이플은 글리프를
   위로 옮겼으나, 빙그레/DNF/Kostar는 **안 옮김(0)**. 즉 샘플은 "거슬리는
   것만 손본" 비일관 작업 → 흉내내면 안 됨. 우리는 전 폰트 일관 보정.
3. **샘플−목표 오차**가 작은 폰트(Kodia −14, 메이플 +5)는 샘플 제작자가
   사실상 본체 cy(378)를 목표로 삼았음을 방증 → 목표값 378 타당성 입증.
4. **Kostar 주의**: 원본 cy=526(목표보다 위). 보정하면 −148 (글자를 아래로
   내림). 샘플은 Kostar를 안 건드렸고 게임에서 잘 됐다 → 보정 시 오히려
   Kostar가 나빠질 위험. **양방향 보정의 리스크** (3.5 참조).

### 3.3 보정 방식

- 목표: 글리프 세로 중심 cy를 본체 Noto cy(≈378)로 맞춤.
- 보정량 `dy = 목표cy − 원본폰트_측정cy` (폰트별, scale 적용 후 좌표계 기준).
- **모든 글리프 컨투어 좌표에 dy를 더함** (평행이동). advanceWidth/가로 불변.
- 측정 글리프: 단일 글자 디자인 편차 회피 위해 한글 다자(한·가·나) 평균.
  글리프 없으면 보정 생략(폴백).
- scale(STEP 2)과의 순서: scale로 metrics 조정 → 그 좌표계에서 cy 측정 →
  dy 평행이동. 글리프 확대는 **하지 않음**(샘플의 ×1.13은 크기 보정 영역,
  STEP 2 metrics가 이미 담당).

### 3.4 적용 형태 (확정)

**체크박스 + 미세조정 슬라이더** (사용자 결정 2026-05-19):

- 커스텀 폰트 상세 설정 모달에 **"중앙 정렬 보정" 체크박스** (기본 ON).
- 체크 시 **높낮이 미세조정 슬라이더** 노출. 기본값 = **정중앙(오프셋 0
  = 목표 cy 378)**. 사용자가 폰트별로 위/아래 미세 조절.
- config: 체크 여부 + 슬라이더 오프셋(폰트/타겟별). `config-management`
  스킬 절차로 AppConfig+CONFIG_METADATA+DEFAULT_CONFIG 등록.
- 최종 보정량 `dy = (378 + userOffset) − 원본cy`.

### 3.5 보정 방향 (확정) + 리스크

- **양방향 보정** (사용자 결정): 내려간 폰트(cy<378)는 올리고, 올라간
  폰트(cy>378, 예 Kostar 526)는 **내려서** 모두 중앙(378)으로 정렬.
  일관 기준선 우선. (Kostar류는 샘플이 안 건드려 게임 적합성 미검증이나,
  슬라이더로 사용자가 개별 미세조정 가능하므로 위험 완화됨.)
- **글리프 좌표 직접 변경 — PoC 검증 완료** (2026-05-19,
  `scratch/poc_glyph_shift.mjs`): contour 점은 `{x,y,onCurve}` 구조,
  `g.contours[][].y += dy` 가산 + **`g.yMin/yMax` bbox도 함께 가산**해야
  round-trip 반영됨(점만 바꾸고 bbox 안 바꾸면 cy 측정이 옛값 — 첫 PoC
  실패 원인). kodia: cy 211→384 정상. **kodia에 composite 글리프 없음**
  — 단 타 폰트 대비 `g.compound`/`g.glyf` 컴포넌트 오프셋 가산 분기는
  방어적으로 유지(빈 contour/composite 스킵 안전).
- **스키마 bump 불필요 (중요)**: STEP 2(metrics)·`fontMutationSchema` 자체가
  **아직 미릴리즈** (마지막 릴리즈 태그 `1.2.1`, 폰트 작업 전체가 그 이후
  `fix/custom-font` 브랜치). 즉 세상에 "v2로 설치된 사용자"가 없음 →
  STEP 3가 같은(첫) 폰트 릴리즈에 묶여 나가면 사용자는 처음부터 STEP 3
  적용본을 받음. **재마이그레이션 대상이 존재하지 않으므로 스키마 bump도,
  HKLM/구버전→신버전 이전 로직도 불필요.** (스키마 메커니즘은 _향후_
  릴리즈된 뒤 변조 규격이 또 바뀔 때를 위해 코드에 남겨둘 뿐.)
- **measure cy 비용**: 변조 시마다 글리프 3자 bbox 측정 — 워커 내 1회,
  무시 가능 수준 예상이나 확인.

### 3.6 작업 순서 (승인 후)

1. fonteditor-core glyf y평행이동 PoC (scratch, 커밋X) — composite 글리프
   포함 정상 이동 확인.
2. 워커에 dy 산출+적용 (3.3). 비대칭 정책(3.5) 결정 반영.
3. (B 채택 시) STEP 1 모달에 토글 + config 키 추가
   (`config-management` 스킬 절차 — AppConfig+CONFIG_METADATA+DEFAULT_CONFIG).
4. 검증: 산출물 cy가 378±tol, Kodia/프리텐다드 게임 실측 정상,
   Kostar 역효과 여부 확인.

> 스키마 bump 단계 없음 — 3.5 참조(미릴리즈, 재마이그레이션 대상 부재).
> STEP 1·2·3는 같은 첫 폰트 릴리즈에 묶여 나가는 것을 전제로 한다.

### 3.7 검증 기준 (declare-done)

- `scratch/verify_*` : Kodia/프리텐다드/Kostar 변조 후 측정 cy = 378±tol
  (Kostar는 비대칭 정책 결정에 따라 예외 가능).
- 사용자 게임 실측: 닉네임 수직정렬 정상, 윗여백 폭발 해소.
- `tsc` / `eslint` / config-integrity 통과.

---

## 미확정 / 사용자 결정 필요

1. **누락 글리프("외계어") 폴백**: 사용자 커스텀 폰트에 게임 요구 글리프가 없으면 두부(□) 가능. 보고서 10.2 "외계어 추가" 작업 관련. 범위/우선순위 추후 결정 (이번 3-step 외).
2. **GGG/Fontin**: 본체 미확보. 범위 제외.
3. **unitsPerEm≠1000(Pretendard 등)**: fonteditor-core upm 스케일 지원 여부 step 2에서 확인. 미지원 시 해당 폰트 metrics 보정 스킵 + 경고.
4. **재변조 트리거**: 슬라이더 변경 시 자동(디바운스) vs "적용" 버튼 — step 1 mockup 단계에서 UX 결정.
