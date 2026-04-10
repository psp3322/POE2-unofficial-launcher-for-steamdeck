# Path of Exile 1 & 2 Custom Font Research (Metadata Modification Approach)

## 1. 개요 (Overview)
기존의 윈도우 레지스트리(`FontSubstitutes`) 및 보안 정책 마이그레이션(`Set-ProcessMitigation`)을 활용하는 우회법은 관리자 권한 의존성과 타겟 실행파일(.exe)을 정확히 지정해야 하는 단점이 있습니다.
이에 따라 **"사용자가 선택한 커스텀 폰트의 내부 이름(Metadata) 자체를 게임이 요구하는 폰트 이름으로 변조하여 Windows 폰트 시스템에 직접 설치하는 방식"**을 채택합니다. 
이를 통해 게임 클라이언트는 정상적으로 폰트를 로드한다고 인식하지만, 실제로는 OS에 주입된 우리의 커스텀 폰트가 렌더링됩니다.

## 2. 타겟 폰트 상세 (Target Fonts)
각 서비스별로 클라이언트가 화면 렌더링에 요구하는 대상 폰트(Target Font Family)는 분리되어 있습니다.
- **GGG (Global)**:
  - `Fontin`
  - `Fontin SmallCaps`
- **Kakao Games (KR)**:
  - `Noto Sans CJK TC Book`
  - `Spoqa Han Sans Neo Regular`

## 3. 작동 시스템 파이프라인 (Mechanism Pipeline)

1. **사용자 폰트 수집 (.TTF / .OTF)**
   - 런처 설정 UI를 통해 사용자가 게임에 적용하고 싶은 폰트 파일을 선택합니다.
2. **Metadata 변조 (Node.js)**
   - `opentype.js` (또는 `fonteditor-core`)와 같은 폰트 파싱 라이브러리를 런처 종속성 패키지로 추가합니다.
   - 런처 백그라운드 프로세스에서 원본 폰트 버퍼를 복제한 후, `name` 테이블 데이터(Full Name, Family Name, Sub Family 등)를 위 **타겟 폰트 상세**의 이름들로 강제 덮어씌웁니다.
3. **가짜 폰트 빌드**
   - 각 대상 폰트마다 변조된 TTF 파일을 백그라운드 임시(%TEMP%) 폴더에 생성합니다. (예: `fake_fontin.ttf`, `fake_spoqa.ttf` 등)
4. **시스템 폰트 설치 (PowerShellManager)**
   - 관리자 권한 `PowerShellManager`를 통해 다음 두 가지 작업을 조용히 병렬 수행합니다.
     - `.ttf` 파일을 `C:\Windows\Fonts` 디렉토리로 안전하게 복사.
     - `HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Fonts` 레지스트리에 폰트를 공식 등록.

## 4. 아키텍처 구현 계획 (Implementation Details)

### A. 의존성 (Dependencies)
- **추가 필요**: 폰트 파싱 및 조작을 위해 `opentype.js` 패키지 추가 (`npm i opentype.js`, `npm i -D @types/opentype.js`).

### B. 설정 및 UI 계층 (`src/renderer/settings/` 및 컴포넌트)
단순한 파일 선택을 넘어, 사용자가 다수의 폰트를 자유롭게 관리할 수 있도록 독립적인 **'폰트 관리 모달(Font Manager Modal)'**을 도입합니다.

1. **Settings 탭 진입부 (`settings-config.ts`)**
   - `game` 탭 내부에 `type: button` 아이템("커스텀 폰트 관리")을 추가하여, 클릭 시 전용 관리 모달이 열리도록 구성합니다.
2. **폰트 관리 모달 UI 구조 (프로세스 공통 모달 규격 준수)**
   - **UI 일관성**: 기존 `MigrationModal`이나 `NoticeModal` 등 프로젝트 내 다른 모달들과 완벽하게 동일한 룩앤필(테마 색상, 폰트 사이즈, CSS 변수)을 공유합니다.
   - **백그라운드 제어**: 모달 바깥쪽(Overlay 영역)을 클릭하면 모달이 부드럽게 닫히는 공통 모달 동작 로직을 기본으로 적용합니다.
   - **상단 섹션 (서비스별 폰트 연결)**: 
     - GGG(`Fontin`)용 폰트 선택 Select Box
     - 카카오게임즈(`Noto Sans` 등)용 폰트 선택 Select Box
     - *UX 포인트*: 폰트가 무거워 UI 스레드가 멈추는 현상(DOM 주입)을 방지하기 위해, **폰트 최초 등록 시점에 Node.js/Canvas를 활용해 '폰트 디자인이 적용된 샘플 문구 PNG' 이미지를 미리 추출해 저장**합니다. 이후 Hover 시에는 이 PNG 파일(`<img />`)만 즉시 불러와 툴팁처럼 보여주는 고성능-저부하 방식을 채택합니다.
   - **하단 섹션 (폰트 라이브러리 Data 관리)**:
     - 사용자가 시스템/로컬 파일에서 직접 폰트(.ttf/.otf)를 **추가/수정/제거(CRUD)** 할 수 있는 섹션.
     - 추가된 폰트에는 사용자가 기억하기 쉬운 임의의 **별명(Alias)**을 지정하여 저장 가능.
     - 이 하단 라이브러리에 등록된 폰트 목록이 상단의 서비스별 Select Box 옵션으로 연동됩니다.
     - **저장소 위치 및 열기 기능**: 원본 폰트 파일들을 복사하여 보관하는 전용 폴더를 런처 데이터 경로에 생성합니다. 폴더명은 `%APPDATA%\poe2-unofficial-launcher\CustomFonts` 규격을 따르며, 사용자가 타인과 쉽게 폰트를 공유하고 백업할 수 있도록 모달 내부에 **[저장 폴더 위치 열기]** 버튼을 배치합니다.

### C. 메인 프로세스 (IPC & Logic)
- **IPC Handler**: `handleFontPatch(filePath: string)`
  - 선택된 `filePath`를 `opentype.js`로 읽어들임.
  - 서비스 대상별 타겟 이름(Fontin, Spoqa 등)으로 변환된 Buffer를 임시 저장.
- **PowerShell Script 예시**:
  ```powershell
  # 폰트 파일 복사
  Copy-Item -Path "$env:TEMP\fake_spoqa.ttf" -Destination "$env:windir\Fonts\SpoqaHanSansNeo.ttf" -Force
  
  # 레지스트리 시스템 등록
  Set-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Fonts" -Name "Spoqa Han Sans Neo Regular (TrueType)" -Value "SpoqaHanSansNeo.ttf"
  ```

## 5. 핵심 로직 및 해결 전략 (Logical Overcomes)

초기에 우려되었던 범용 폰트(Noto Sans 등)의 시스템 영구 점유 및 충돌 문제는 다음의 논리적 흐름으로 완벽히 제어합니다.

- **문제점 식별의 한계**: 현재 레지스트리에 타겟 폰트(ex: Noto Sans)가 설치되어 있다고 할지라도, 이 폰트가 사용자가 원단위로 설치한 '오리지널'인지, 우리가 변조해서 꽂아넣은 '커스텀 가짜' 폰트인지 런처단에서 100% 식별할 방법이 존재하지 않습니다.
- **상태 표기 전략**: 
  - 타겟 폰트가 시스템에 이미 존재할 경우, 설정 화면에서 폰트 상태를 **"알 수 없음 (Unverified/Unknown)"** 으로 표기합니다.
- **덮어쓰기(Overwrite) 안전장치**:
  - 상태가 "알 수 없음"일 때 사용자가 새로운 폰트 치환을 시도하면, **"시스템에 해당 이름의 폰트가 이미 존재합니다. 변조된 커스텀 폰트로 덮어씌우시겠습니까?"** 라는 2차 확인 모달(Confirm Modal)을 강제로 띄워 유저의 자의적 선택을 보장합니다.
- **기본값 리셋(Reset) 전략**:
  - 본래 게임은 내장(Embed)된 폰트를 최우선으로 찾지만, 시스템 영역에 동일 이름의 폰트가 있으면 시스템 폰트를 끌어다 씁니다.
  - 따라서 사용자가 "기본값 복원"을 원할 경우, **시스템에 설치된 해당 타겟 폰트를 완전히 제거해버리면 게임은 자연스럽게 원래의 내장 GGPK 폰트로 롤백(Fallback)** 됩니다. (복구 로직은 단순 무식하게 '시스템 폰트 삭제'로 타결)
- **한글 폰트 유효성 검증 (Glyph Validation)**:
  - 카카오게임즈(혹은 GGG 한글 환경)에 적용할 폰트가 실제로 한글(KR)을 지원하는지 검증을 돌립니다.
  - 적용 예정인 파싱 라이브러리(`opentype.js`)의 `font.charToGlyph('가')`와 같은 API를 사용해, 필수 한글 유니코드 대역(가~힣 등 테스트용 필수 글자)의 글리프(글꼴 이미지 데이터) 인덱스가 존재하는지(Index > 0) 검사합니다.
  - 만약 한글 글리프가 없는 영문 전용 폰트라면 등록 거부 혹은 경고 팝업을 띄워 인게임에서 글씨가 '네모(□)'나 픽셀로 깨지는 현상을 방어합니다.

---

> **결론 및 다음 단계**: 제시해주신 로직으로 시스템 폰트 충돌에 대한 예외 처리가 완벽해졌습니다. "폰트 변조 및 덮어씌우기, 그리고 삭제 후 GGPK 폴백"이라는 완결된 리서치 결과가 도출되었습니다. 언제든 개발 진행 명령을 내려주시면 파이프라인 설계를 바탕으로 즉각 스킬 구동을 시작하겠습니다!

## 6. 추가 건의 및 고도화 제안 (Proposals)

성공적이고 안정적인 개발을 위해 런처 환경(Electron)에 특화된 3가지 추가 방안을 건의합니다.

- **건의 1: 게임 실행 중 폰트 변경 차단 (OS File Lock 방어)**
  - 윈도우는 실행 중인 프로그램이 사용 중인 폰트를 시스템(GDI/DirectWrite) 단위로 강력하게 잠금(Lock) 처리합니다.
  - 게임이 켜져 있는 상태에서 유저가 폰트 덮어쓰기나 삭제를 시도하면 PowerShell에서 `Access Denied` 에러가 발생할 확률이 높습니다.
  - **제안**: 런처가 게임 프로세스를 감지하고 있다면, 게임 실행 중에는 폰트 관리 모달의 "적용" 및 "복원" 버튼을 비활성화(Disable)하여 충돌을 원천 차단합니다.
  
- **건의 2: 폰트 용량 제한 및 별명 자동 추출 (안정성 & UX)**
  - 한중일(CJK) 통합 폰트 등은 용량이 30~50MB를 넘어가기도 하며, 유저가 실수로 엄청나게 큰 파일을 고를 경우 Node.js V8 엔진의 메모리 한계로 메인 프로세스가 터질 수 있습니다.
  - **제안**: 파일 선택 시 용량 제한(ex: 30MB)을 두고, 파일을 불러오는 즉시 메타데이터를 파싱하여 **원본 폰트의 실제 이름(Full Name)**을 UI의 '기본 별명(Alias)' 칸에 자동으로 채워 넣어 사용자 편의를 극대화합니다.

- **건의 3: 관리자 권한(UAC) 거부 예외 처리 전면 개편**
  - 시스템 폰트 폴더 접근을 위해 `PowerShellManager`가 띄운 UAC 팝업을 유저가 거부할 경우, 단순 크래시가 아닌 명시적인 커스텀 예외(`UACDeniedException` 등)를 생성해 `throw` 하도록 구현합니다.
  - 사용자의 임의 취소이므로 시스템 에러가 아닌 Logger의 `Warn` 레벨로 로그를 남겨 기록만 유지합니다.
  - 폰트 시스템을 비롯해 이 관리자 권한 함수를 호출한 모달/기능 쪽에서 이 `throw`를 `Catch`하여, 사용자에게 예쁜 커스텀 토스트 알림("관리자 권한이 거부되었습니다.")을 띄우도록 역할을 철저히 분리(Decoupling)합니다.

## 7. 개발 로드맵 (Phased Commit Strategy)

유저의 아키텍처 피드백을 수용하여, 거대한 한 덩어리의 코드가 아닌 **3단계의 독립된 커밋(작업 분할)**으로 점진적 개발을 진행합니다.

- **STEP 1: UAC 거부 예외 처리 전역 구축 (사전 작업 1)**
  - `PowerShellManager` 등 UAC 호출 부에 `UACDeniedException` 커스텀 에러망을 신설하고 Logger(`Warn` 레벨)를 부착합니다.
  - 이를 호출하는 기존 앱 내의 레거시 기능 코드들까지 해당 에러를 `Catch` 하여 토스트 팝업으로 사용자에게 안내하도록 권한/에러 핸들링을 먼저 전역 일괄 리팩토링합니다.

- **STEP 2: 글로벌 Game State 상태 관리 리팩토링 (사전 작업 2)**
  - 기존의 단발성 이벤트 구독 방식의 한계를 극복하기 위해, 렌더러 측(React Context/Status)에서 메인 프로세스의 게임 실행 상태를 영구적으로 보관하고 갱신하도록 설계합니다.
  - 최우선적으로 메인 화면의 '게임 시작 버튼'이 이 글로벌 상태 컨텍스트에 의존하도록 리팩토링하여 체계의 안정성을 검증합니다.
  
- **STEP 3: 폰트 라이브러리 엔진 및 모달 계층 병합 (메인 작업)**
  - `opentype.js` 기반 메타데이터 파서 및 폰트 샘플용 PNG 추출 로직(Canvas 활용)을 제작하여 `%APPDATA%` 와 연동시킵니다.
  - `FontManagerModal` UI를 만들고 Hover 시 PNG 표시가 작동하는지 확인합니다.
  - 최종적으로 'STEP 1(UAC 예외)'과 'STEP 2(게임 실행 상태)' 기반 하에 폰트를 실제로 윈도우 OS 시스템(`C:\Windows\Fonts`)에 조작 및 적용하며 메인 피처 개발을 완수합니다.
