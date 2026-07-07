# 버그 수정 계획: HKCU 설치 폰트 미제거 (removeSystemFont 비대칭)

> 작성일: 2026-05-19 · 상태: **계획 (승인 전 개발 금지)**
> 분류: STEP 2/3와 독립된 별개 버그. 커스텀 폰트 제거 경로 결함.

## 0. 작업 전략 (2-step) + 릴리즈 전제

이 문서는 폰트 **설치/제거 위치(HKLM/HKCU)** 관련 2-step 작업의 계획이다.
(폰트 변조 metrics/수직정렬은 별도 문서 `font-implementation-plan.md` STEP 1~3.)

| 단계      | 내용                                              | 비고                                                                        |
| --------- | ------------------------------------------------- | --------------------------------------------------------------------------- |
| **B-1차** | `removeSystemFont` HKLM+HKCU 대칭화 (본 문서 §2~) | 수동 설치 폰트가 "기본값 복원"으로 안 지워지는 버그. 디아블로 케이스가 이것 |
| **B-2차** | 런처 설치 `installSystemFont` HKLM→HKCU 전환      | 관리자 권한 불필요화. 1차 선행 의존                                         |

**핵심 릴리즈 전제 (스키마/마이그레이션 불필요 근거):**

- 폰트 작업 전체(STEP 2 metrics, `fontMutationSchema`, 본 버그/설치전환)는
  **마지막 릴리즈 `1.2.1` 이후 `fix/custom-font` 브랜치에만 존재 — 미릴리즈.**
- 따라서 세상에 "이 기능으로 HKLM에 설치된 릴리즈 사용자"가 **없다.**
- B-1차·B-2차 + STEP 1~3을 **같은 첫 폰트 릴리즈에 묶어** 내보내면:
  - 사용자는 처음부터 B-2차(HKCU 설치) 적용본을 받음
  - "HKLM로 한 번 깔렸다가 HKCU로 옮기는" 시나리오 자체가 발생 안 함
  - → **`FONT_MUTATION_SCHEMA` bump 불필요, HKLM→HKCU 이전 마이그레이션
    로직 불필요.** 별도 이전 코드 작성 안 함.
- 단 **B-1차 선행은 여전히 필수**: (a) 수동/외부로 HKCU에 깐 폰트(디아블로
  등)는 릴리즈와 무관하게 사용자 PC에 이미 존재 → 제거 대칭화만이 해결책.
  (b) B-2차로 HKCU 설치 후에도 제거가 양쪽을 훑어야 깨끗.
- ⚠️ **분리 릴리즈 금지**: B-1차만 먼저 릴리즈하고 B-2차를 다음 릴리즈로
  미루면, B-1차 릴리즈로 HKLM 설치본이 세상에 나가고 B-2차에서 HKLM→HKCU
  이전 마이그레이션이 *다시 필요*해진다. 묶어서 내보내는 것이 전제.

## 1. 증상

- "기본값으로 복원" 후에도 게임에서 디아블로(Kodia) 폰트가 계속 표시됨.
- Windows 설정 > 글꼴: `Spoqa Han Sans Neo Regular` 항목의 글꼴 파일이
  `C:\Users\nerdl\AppData\Local\Microsoft\Windows\Fonts\디아블로2_KODIA.TTF`
  — Spoqa 자리에 Kodia 파일이, 그리고 **HKCU(사용자별) 경로**에 박혀 있음.

## 1-1. 배경: Windows 1809+ 폰트 설치 동작 변경 (왜 HKCU에?)

- **Windows 10 1809(2018)부터** 폰트 우클릭 "설치" 기본 동작이 바뀜:
  - "설치"(기본) → `%LOCALAPPDATA%\Microsoft\Windows\Fonts` + **HKCU**,
    **관리자 권한 불필요**.
  - "모든 사용자용으로 설치"(별도 메뉴) → `C:\Windows\Fonts` + **HKLM**,
    관리자 필요.
- 즉 사용자가 ttf를 더블클릭/우클릭"설치"하면 **요즘 Windows는 기본 HKCU**.
  옛 상식(`C:\Windows\Fonts` 무조건)은 더 이상 기본이 아님.
- 함의: 수동 설치 폰트는 **대개 HKCU**. 본 버그는 희귀 엣지케이스가 아니라
  요즘 환경에서 **빈번**히 재현됨 → 우선순위 높음.
- (참고, 본 수정 범위 밖) 런처 `installSystemFont`도 HKLM 전용 = 항상
  관리자 권한 필요. HKCU 설치 방식 전환은 큰 개선이나 게임/배프 패치
  권한 의존성 전반 재검토가 필요해 **이번 버그 수정에서 제외**(결정됨).

## 2. 근본 원인 (코드 레벨 확정)

감지와 제거의 레지스트리/경로 범위 **비대칭**:

| 동작                                             | HKLM (`%windir%\Fonts`)          | HKCU (`%LOCALAPPDATA%\Microsoft\Windows\Fonts`) |
| ------------------------------------------------ | -------------------------------- | ----------------------------------------------- |
| 감지 `getUnifiedFonts` (FontManager.ts:367-368)  | ✅ `$p1`                         | ✅ `$p2`                                        |
| 설치 `installSystemFont` (powershell.ts:473,483) | ✅                               | ❌ (HKLM만)                                     |
| 제거 `removeSystemFont` (powershell.ts:516-541)  | ✅ `$env:windir\Fonts` + `HKLM:` | ❌ **전혀 안 봄**                               |

- "수동 추가 폰트 감지" 커밋(1c817a2)이 **HKCU 감지를 추가**했으나
  `removeSystemFont`은 HKLM 전용 그대로 → 감지는 되는데 제거가 안 됨.
- 시나리오: 외부/수동으로 HKCU에 폰트 설치(파일명 임의, 예
  `디아블로2_KODIA.TTF`, 레지스트리 이름은 `Spoqa Han Sans Neo Regular
(TrueType)`) → 런처가 감지 → "기본값 복원" → `removeSystemFont`이
  `%windir%\Fonts\SpoqaHanSansNeoRegular.ttf`(HKLM 규칙 파일명)와 HKLM
  레지스트리만 지움 → **HKCU의 실제 파일·레지스트리는 잔류** → 게임에 계속
  적용됨.

## 3. 부가 발견 — 파일명 가정 결함 + 폴백 필요

모든 호출처(FontManager.ts:548/827/957/983)가
`ttfFileName = targetName.replace(/\s+/g,"") + ".ttf"` 로 **파일명을 런처
규칙으로 가정**한다. 그러나 수동/외부 설치 폰트는 파일명이 임의
(`디아블로2_KODIA.TTF`). → 파일명 가정만으로는 **수동 잔재를 못 잡음**.

반대로 레지스트리 이름 기반만 쓰면 **레지스트리가 깨진(키 없이 파일만 남은)
런처 설치 잔재**를 못 잡는다. 두 방식은 서로 다른 빈틈을 가지므로 **상호
보완 — 둘 다 필요**:

| 잔재 유형                                                       | 레지스트리 이름 기반 | 런처 파일명 폴백 |
| --------------------------------------------------------------- | -------------------- | ---------------- |
| 임의 파일명, 레지스트리 이름 정상 (디아블로 케이스, **실증됨**) | ✅ 잡음              | ❌               |
| 런처 파일명, 레지스트리 키 깨짐/누락                            | ❌                   | ✅ 잡음          |
| 정상 런처 설치                                                  | ✅                   | ✅ (이중 안전)   |

> 실증(사용자 확인): "기본값 복원" 상태에서도 HKCU의 Kodia가
> `Spoqa...Regular (TrueType)` 이름으로 등록돼 게임이 인식 중.
> → 레지스트리 이름 기반 1차가 이 케이스의 핵심 해결책.

## 3-1. 추가 발견 + 수정 — Book/non-Book 비대칭 (구현 완료)

증상: Spoqa는 정리됐는데 **Noto만 잔류**(HKCU `디아블로2_KODIA_0.TTF`가
`Noto Sans CJK TC` 이름으로 등록돼 게임에 계속 표시).

원인: 감지(FontManager.ts:358)는 `Noto Sans CJK TC Book`에 더해
`Noto Sans CJK TC`(Book 없음)까지 확장 검사했으나, **제거 루프는
`TARGET_SERVICES_CONFIG`의 `Noto Sans CJK TC Book`만** 사용 → 실제 등록명
(Book 없음)을 못 잡음. Spoqa는 이름이 일치해 정상 제거됐던 것.

조치(완료): `font-targets.ts`에 **`expandTargetNames()` 공유 헬퍼** 신설,
감지 + 제거 4곳(applyBatch DEFAULT, 시스템 완전정화, importExternal 감지,
cleanupExternal 전수소거) 전부 동일 헬퍼 사용 → 비대칭 구조적 차단.
검증: tsc/eslint 통과. **실게임 검증 완료 (2026-05-19, 사용자 확인): 수동
설치 폰트 감지·제거 둘 다 정상 동작.** (Book/non-Book 비대칭 + 감지 스킵
버그 + removeSystemFont HKLM/HKCU 대칭 세 수정의 합산 결과.)

### 3-1-1. 잔여 작업 (별도, 미진행 — 결정: 현재 유지)

**실측 사실**: 게임 본체 `notosanscjktc-regular.ttf` name table에서 "Book"은
`fontSubFamily`(ID2)에만 존재. `fontFamily`(ID1)/`fullName`(ID4)/
`postScript`(ID6)에는 없음 → **시스템 실제 등록명은 `Noto Sans CJK TC`
(Book 없음)**. 런처 생성 로직(font-targets.ts:68-71)도 본체와 동일
(subfamily에만 Book). 즉 `Noto Sans CJK TC Book`은 **내부 식별 키일 뿐
시스템에 그 이름으로 등록되지 않음** → `expandTargetNames`의 Book 변형은
사실상 no-op 군더더기.

**근본 정리안(미채택)**: `TARGET_SERVICES_CONFIG`/`FONT_MUTATION_DEFINITIONS`/
`FONT_SCALE_CONFIG_KEY` 등의 식별 키를 `Noto Sans CJK TC`(Book 없음)로
일원화하고 `expandTargetNames` 제거. 식별자=실제등록명이 되어 이 류 비대칭
버그가 원천 차단됨.

**미채택 사유 + 리스크 (재작업 시 참고)**:

- 영향 범위 넓음: 키 변경이 `FONT_MUTATION_DEFINITIONS`, `FONT_SCALE_CONFIG_KEY`,
  감지 스크립트, **`appliedFonts` 저장값**(기존 사용자 설정 마이그레이션
  필요) 등으로 연쇄.
- ⚠️ Book 확장 패치는 커밋 **`1c817a2`(수동 폰트 감지 fix)** 에서 도입.
  즉 과거에 "Book 없는 케이스를 못 잡는" 실문제를 겪고 방어한 흔적 →
  단순 제거가 아니라 **그 케이스가 무엇이었는지 재현·확인 후** 정리해야
  안전. (현 expandTargetNames는 Book/non-Book 양쪽을 다 잡으므로 그
  방어를 유지하면서 동작.)
- 결정(사용자): **현재 expandTargetNames 유지.** 근본 정리는 별도 작업으로
  남김(우선순위 낮음, B-1/B-2/STEP3 이후).

**레지스트리 실증 (2026-05-19, 사용자 regedit 확인)**:
HKCU `...\CurrentVersion\Fonts` 실제 등록명 —

- `Noto Sans CJK TC (TrueType)` → `...\Local\Microsoft\Windows\Fonts\notosanscjktc-regular.ttf`
  (**Book 없음 확정**, content.ggpk 내장 폰트 그대로 설치 시)
- `Spoqa Han Sans Neo Regular (TrueType)` → spoqa 파일
  → 위 "근본 정리안"이 추정이 아니라 실측으로 확정됨. `Noto Sans CJK TC Book`
  식별 키는 시스템에 존재하지 않는 이름.

**근본 정리 실행 방법 (착수 시, 사용자 지시)**:
식별 키를 표준 등록명(`Noto Sans CJK TC`, Book 없음)으로 정렬할 때:

1. `TARGET_SERVICES_CONFIG`/`FONT_MUTATION_DEFINITIONS`/`FONT_SCALE_CONFIG_KEY`
   키를 표준명으로 변경, `expandTargetNames` 제거.
2. **bump는 "필요하다면"만** (사용자 지시 2026-05-19) — 무조건 아님:
   - **첫 폰트 릴리즈에 묶임** → 구 키로 릴리즈된 사용자 없음 →
     **bump 불필요, 마이그레이션 코드 작성 안 함**.
   - **폰트 기능 릴리즈 이후** 별도 정리 릴리즈 → 구 키
     `appliedFonts`/설치본 가진 사용자 존재 → 이때만 `FONT_MUTATION_SCHEMA`
     bump + 부팅 마이그레이션(구 키→표준 키 변환 + 표준 등록명 재설치).
3. 착수 시점 분기 판단 기준: **"이전에 폰트 기능이 릴리즈됐는가"**
   (마지막 릴리즈 태그 이후 폰트 커밋만 있으면 = 미릴리즈 = bump 불필요).
   0장 릴리즈 전제와 동일 논리.

## 4. 수정 방향 (제안 — 미확정 포함)

> **범위 확정: 제거(`removeSystemFont`) 대칭화만.** 설치
> (`installSystemFont`)는 HKLM 전용 그대로 유지(1-1 참조, 결정됨).
> 즉 설치는 HKLM이지만 제거는 HKLM+HKCU 양쪽 — 비대칭처럼 보이나
> 의도적: 런처가 깐 건 HKLM, 사용자가 수동으로 깐 잔재는 HKCU에 많으므로
> 제거는 양쪽을 다 훑어야 "기본값 복원"이 실제로 깨끗해진다.

`removeSystemFont`을 HKLM/HKCU 대칭 + **2단계 폴백**으로 재작성. 각 하이브
(HKLM, HKCU)에 대해 동일 절차:

**1차 — 레지스트리 이름 기반 (정확, 임의 파일명 잔재 잡음)**

1. 대상 레지스트리 이름 = `${targetFontName} (TrueType)`.
2. 해당 하이브 Fonts 키에서 그 이름의 값을 읽음 → 값이 절대경로면 그대로,
   파일명만이면 하이브 기본 디렉터리와 결합:
   - HKLM: `%windir%\Fonts\`
   - HKCU: `%LOCALAPPDATA%\Microsoft\Windows\Fonts\`
3. 그 파일 제거 + 레지스트리 값 제거 + RemoveFontResource.

**2차 — 런처 기본 파일명 폴백 (레지스트리 깨진 런처 잔재 잡음)**

4. 1차에서 못 찾았거나, 추가로: 런처 규칙 파일명
   `${targetFontName.replace(/\s+/g,"")}.ttf` 를 두 하이브 기본 디렉터리에서
   **직접 존재 확인** → 있으면 제거 + RemoveFontResource.
   - 안전성 근거: 이 파일명은 **런처만 생성**하는 규칙명이므로 사용자/타
     프로그램 폰트를 오삭제할 위험이 낮음. (임의 파일명은 건드리지 않음 —
     그건 1차의 레지스트리 이름 매칭으로만 제거.)
5. 어느 단계든 못 찾으면 무시(에러 아님). 1·2차는 보완 관계라 **둘 다 수행**.
6. RemoveFontResource + `WM_FONTCHANGE` 브로드캐스트는 기존대로(하이브당).

### 4-1. 결정 필요 (계획 확정 전)

- **권한 컨텍스트**: 현재 `removeSystemFont`은 `execute(script, true)`(admin)
  로 실행. admin/elevated 세션에서 `HKCU:` 와 `%LOCALAPPDATA%` 는 **호출
  사용자가 아닌 elevated 계정 하이브/프로필**을 가리킬 수 있음 → HKCU 정리가
  엉뚱한 곳을 봄. 옵션: (a) HKCU 정리는 비-admin 세션(`execute(script,
false)`)으로 분리 실행, (b) admin 스크립트에서 실제 사용자 SID/프로필을
  명시 해석. → **(a) 권장 검토** (단 호출 흐름 2-세션 분리 영향 점검).
- **파일명 가정 제거 범위**: `removeSystemFont` 시그니처가 `(targetFontName,
ttfFileName)`. ttfFileName 인자를 레지스트리 기반 해석으로 대체하면 호출처
  4곳 모두 단순화 가능하나, 시그니처 변경 → 사이드이펙트 점검 필요.
- **잔류 폰트 적극 정리 여부**: 이미 잘못 박힌 사용자(스크린샷 케이스)는
  "기본값 복원"을 다시 눌러야 정리됨. 부팅 시 자동 정리(마이그레이션처럼)는
  과한가? → 우선 수동 복원 정상화만, 자동 정리는 별도 판단.

## 5. 영향 범위 / 리스크

- `removeSystemFont` 호출처 4곳(applyBatch DEFAULT 전환 548, 전체 초기화
  827, 외부 정리 957, allTargets 983) **전부 동일 함수** → 한 번 고치면
  전부 반영. 회귀 위험: 정상 HKLM-only 케이스가 깨지지 않아야 함.
- 레지스트리 값 형식(파일명 vs 절대경로) 분기 처리 누락 시 파일 못 지움.
- admin/HKCU 권한 컨텍스트 오인 시 "지웠다는데 안 지워짐" 재발.

## 6. 검증 기준 (declare-done)

- **실증 케이스(디아블로)**: HKCU에 임의 파일명(`디아블로2_KODIA.TTF`)+
  `Spoqa...Regular (TrueType)` 이름으로 등록된 상태 → "기본값 복원" →
  1차(레지스트리 이름) 경로로 HKCU 파일+레지스트리+HKLM 모두 제거, 게임에서
  디아블로 폰트 사라짐(사용자 실측).
- **폴백 케이스**: 런처 규칙 파일명 파일만 남고 레지스트리 키 없는 상태 →
  "기본값 복원" → 2차(파일명 폴백)로 제거됨.
- **오삭제 음성 검증**: 사용자/타 프로그램의 임의 파일명 폰트(레지스트리
  이름 무관)는 폴백으로 **건드리지 않음**.
- 정상 HKLM 설치/제거 회귀 없음.
- `tsc` / `eslint` 통과.

## 7. 선결 조사 (계획 확정 전, 사용자 환경 필요)

Windows에서만 가능 — 사용자 확인 요청 대상:

- `reg query "HKCU\Software\Microsoft\Windows NT\CurrentVersion\Fonts" /v
"Spoqa Han Sans Neo Regular (TrueType)"` → 값이 **파일명인지 절대경로인지**
  확인 (4번 분기 설계 확정에 필수).
- `%LOCALAPPDATA%\Microsoft\Windows\Fonts\` 디렉터리 실제 내용.
- 같은 이름이 HKLM에도 동시 등록돼 있는지(이중 등록 여부).

> §2~7은 **B-1차(제거 대칭화)** 전용. 아래 §8은 **B-2차(설치 전환)**.

## 8. B-2차: 설치 HKLM → HKCU 전환 (1차 승인/완료 후 착수)

### 8.1 목적

`installSystemFont`(powershell.ts:465~)이 `%windir%\Fonts` + `HKLM:` 에만
설치 → **항상 관리자 권한(UAC) 필요**. Windows 1809+ 표준 방식(HKCU,
`%LOCALAPPDATA%\Microsoft\Windows\Fonts` + `HKCU:`)으로 전환 시 **관리자
권한 없이** 폰트 설치 가능.

### 8.2 변경 골자 (계획 — 미확정 포함)

- 복사 대상: `%LOCALAPPDATA%\Microsoft\Windows\Fonts\<file>`
- 레지스트리: `HKCU:\Software\Microsoft\Windows NT\CurrentVersion\Fonts`,
  값은 **절대경로 권장**(HKCU 관례). §7 조사로 값 형식 확정 후 1차 제거
  로직과 형식 합치.
- `AddFontResource` + `WM_FONTCHANGE`는 그대로 (사용자 권한으로 동작).
- `execute(script, true)`(admin) → **`execute(script, false)`(일반)** 전환.

### 8.3 권한 의존성 전반 재검토 (리스크 — 핵심)

설치만 권한을 낮추면 안 되고, **이 폰트가 쓰이는 경로 전체**가 일반 권한과
정합해야 함:

- 배프(배틀 프리퍼런스) 패치/게임 실행 시 폰트 참조 흐름이 HKCU 등록
  폰트를 정상 인식하는지 (게임이 GDI/시스템 폰트 열거로 읽으면 HKCU도
  보이나, 별도 폰트 캐시/관리자 컨텍스트면 안 보일 수 있음).
- 런처 자체가 관리자로 실행될 때 `execute(script,false)`의 HKCU가 **어느
  사용자 하이브**인지 (1차 §4-1과 동일 논점 — admin 컨텍스트 HKCU 오인).
- → 8.3이 B-2차의 **승인 전 필수 검증**. 미해소 시 "설치는 됐는데 게임이
  폰트를 못 읽음" 회귀 위험.

### 8.4 검증 기준

- 일반 사용자 권한(UAC 없이) 폰트 설치 성공 + 게임에서 적용 확인.
- 1차 제거 로직이 HKCU 설치본을 정상 제거(왕복 테스트).
- 관리자 실행 / 일반 실행 양쪽에서 동작.
- `tsc` / `eslint` 통과.
