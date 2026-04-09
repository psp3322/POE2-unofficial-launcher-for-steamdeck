# Architecture: POE2-Unofficial-Launcher

이 문서는 POE2-Unofficial-Launcher 프로젝트의 기술 스택, 디렉토리 구조 및 코딩 컨벤션을 정의합니다.

## 1. Project Context

- **목적**: Kakao Games Path of Exile 2용 비공식 런처.
- **주요 기능**:
  - 깔끔하고 현대적인 UI 제공.
  - 로그인 창(새 탭/팝업)의 유연한 처리.
  - 불필요한 광고 및 외부 팝업 차단.

### Tech Stack

- **Runtime**: Node.js (v24+)
- **Framework**: Electron (with Vite)
- **UI**: React
- **Language**: TypeScript (Target: `esnext`)
- **Builder**: electron-builder

### Build Commands

- `npm run dev`: 개발 모드 실행 (Vite + Electron)
- `npm run build`: TypeScript 컴파일 및 Vite 빌드.

## 2. Directory Structure

```text
/
├── dist/               # 빌드 결과물 (Electron entry)
├── dist-electron/      # Main Process 빌드 결과물
├── src/
│   ├── main/           # Electron Main Process
│   │   ├── main.ts     # Entry Point
│   │   ├── preload.ts  # Main Window Preload
│   │   └── preload-game.ts # Game Window Preload
│   ├── renderer/       # React UI (Vite Root)
│   │   ├── App.tsx
│   │   └── main.tsx
│   └── shared/         # 공용 타입 및 유틸리티
├── .github/
│   └── workflows/      # CI/CD (Release Please, PR Check)
├── electron-builder.json5 # Builder 설정
└── vite.config.ts      # Vite 설정
```

## 3. Coding Conventions

- **Language**: 한국어 주석 및 커밋 메시지 권장 (UI 텍스트 포함).
- **Naming**:
  - React Component: `PascalCase.tsx`
  - Logic/Utils: `camelCase.ts`
- **Linting**: ESLint + Prettier (Strict 모드 권장)
- **Styling**:
  - **Dynamic Theme**: 상호작용 요소 및 포인트 컬러에는 하드코딩된 색상 대신 반드시 CSS 변수(`var(--theme-accent)`)를 사용합니다 (ADR-018 참고).

## 4. Architecture Decision Records (ADR)

### Active Rules (Mandatory Constraints)

#### ADR-001: Documentation Synchronization

- **Rule**: `README.md` (영문) 업데이트 시, **즉시** `docs/README_KR.md` (국문)도 동일한 내용으로 동기화해야 합니다.

#### ADR-002: Icon Source

- **Source**: 아이콘이 필요한 경우, [Google Fonts Icons](https://fonts.google.com/icons) (Material Symbols/Icons)를 표준 소스로 사용합니다.
- **Implementation**: 모든 아이콘은 `src/assets/icons/` 디렉토리에 **SVG/PNG 파일**로 저장하여 관리하며, 코드 내에서 Import하여 사용합니다. (Inline SVG 지양)

#### ADR-003: Persistence & Theme Optimization (Reactive Observer)

- **상황**: 앱 재시작 시 설정을 유지해야 하며, 게임 전환 시 IPC 지연으로 인한 테마 색상 반영의 미세한 끊김(Latency)을 해결해야 함.
- **결정**:
  - **Persistence**: `electron-store`를 도입하여 메인 프로세스에서 설정을 관리함.
  - **Reactive Observer Pattern**:
    - 메인 프로세스의 `store.onDidChange` 이벤트를 구독하여 설정 변경 시 `mainWindow`, `debugWindow`, `gameWindow` 등 모든 활성 창으로 즉시 알림(`config-changed`)을 브로드캐스트함.
    - 렌더러는 설정 데이터를 로컬 React State로 동기화하여 관리함.
  - **Asset-Specific Indexing**: 이미지 경로 대신 `gameId`('POE1', 'POE2')를 키로 사용하여 각 게임당 최적의 테마 데이터를 유지하고 관리 복잡도를 낮춤.
  - **Zero-Flicker Startup Sequence**: 런처 시동 시 캐시된 `assetPath`를 즉시 배경으로 로드하고, 원격 테마 동기화(`isThemesSynced`)가 완료될 때까지 Splash 화면을 유지하여 시각적 정합성을 100% 보장함.
- **결과**: 앱 설정이 영구 저장되며, 리소스 낭비(불필요한 이미지 디코딩)나 시동 시 배경 깜빡임이 없는 프리미엄한 사용자 경험을 제공함.

#### ADR-004: Type-Safe Event Bus (Pub-Sub Pattern)

- **상황**: 메인 프로세스 내 비즈니스 로직(창 제어, 프로세스 감시 등)이 복잡해짐에 따라, 모듈 간 결합도를 낮추고 타입 안전성을 보장하는 통신 방식이 필요함. 기존의 단순 콜백이나 하드 코딩된 호출은 유지보수가 어려움.
- **결정**:
  - **Event Bus 도입**: `EventBus` 싱글톤을 통해 컴포넌트 간 통신을 중개하는 **Publish-Subscribe** 패턴을 적용함.
  - **Discriminated Unions**: 이벤트 타입(`AppEvent`)을 `Generic`과 `Discriminated Union`으로 정의하여, 이벤트 종류(`type`)에 따라 페이로드(`payload`) 타입이 자동으로 추론되도록 설계함.
  - **Handler Interface**: `EventHandler<T>` 제네릭 인터페이스를 구현하여 핸들러 내부에서 강제 형변환(`as Casting`) 없이 안전하게 로직을 작성하도록 강제함.
- **결과**:
  - **결합도 감소**: `StartupHandler`, `CleanupHandler` 등이 서로를 알 필요 없이 이벤트를 구독하여 독립적으로 동작함.
  - **타입 안전성**: 잘못된 페이로드를 emit하거나 처리할 수 없게 되어 컴파일 단계에서 오류를 방지함.
  - **확장성**: 새로운 기능 추가 시 기존 코드를 수정하지 않고 새로운 핸들러를 등록(`register`)하는 것만으로 기능 확장이 가능함.

  > **참고**: 구현 예제 및 상세 가이드는 AI 에이전트 전용 스킬인 [.agents/skills/event-ipc-integration/SKILL.md](../.agents/skills/event-ipc-integration/SKILL.md)를 참고하여 개발을 지시하세요.

#### ADR-005: Unified PowerShell & Registry Management (Standardization)

- **상황**: `uac.ts`, `registry.ts` 등 여러 곳에서 개별적으로 PowerShell 프로세스(`spawn`) 및 `reg.exe`를 직접 호출함. 이로 인해 시스템 작업 로깅이 파편화되고, 관리자 권한 작업 시 중복된 UAC 팝업이 발생하는 등 유지보수와 UX 측면에서 개선이 필요함.
- **결정**:
  - **PowerShellManager 일원화**: 모든 PowerShell 및 외부 시스템 명령 실행을 `PowerShellManager` 싱글톤으로 통합하여 실행 이력을 디버그 콘솔에서 실시간으로 확인할 수 있게 함.
  - **Registry Utility 표준화**: `registry.ts`를 통해 레지스트리 경로와 조작 로직을 중앙 집중화하고, PowerShell 표준 명령어(`Get-ItemProperty`, `Set-ItemProperty`)를 사용하여 시스템 안정성을 높임.
  - **Persistent Session**: 관리자 권한이 필요한 경우 **Named Pipe** 기반의 지속 세션을 활용하여 UAC 팝업 발생을 최소화함.
- **결과**:
  - **가시성 확보**: 런처 내부에서 일어나는 모든 시스템 레벨 작업이 통합 로깅되어 디버깅이 용이해짐.
  - **신뢰성**: 직접적인 프로세스 호출 대신 검증된 유틸리티를 사용하여 런타임 오류 가능성을 낮춤.

#### ADR-006: Enhanced Debug Console (Raw Config Editor)

- **상황**: 개발 및 디버깅 과정에서 앱 설정(Config)을 실시간으로 확인하고 안전하게 수정할 수 있는 기능이 필요함. 특히 `config.ts` 메타데이터에 정의되지 않은 고아(Orphaned) 설정들을 식별하고 관리해야 함.
- **결정**:
  - **Categorized Config Viewer**: `CONFIG_METADATA`를 기반으로 설정을 카테고리별(General, Game, Appearance)로 분류하여 시각화함.
  - **Inline JSON Editor**: 설정을 인라인에서 바로 편집할 수 있는 기능을 추가하고, `JSON.parse` 및 커스텀 제약 조건(예: `activeGame`은 'POE1'/'POE2'만 허용)을 통한 유효성 검증을 수행함.
  - **Orphaned Config Detection**: `electron-store`에는 존재하지만 코드상 메타데이터에는 매핑되지 않은 설정들을 별도 섹션(Orange Accent)으로 분리하여 표시함.
  - **Performance Optimization**: 로그 병합 및 해시 계산 등 무거운 헬퍼 함수들을 컴포넌트 외부로 추출하여 React의 불필요한 리렌더링 오버헤드를 줄임.
- **결과**:
  - **개발 효율성**: 외부 도구 없이 런처 내에서 직접 설정을 제어할 수 있어 디버깅 속도가 향상됨.
  - **안정성**: 엄격한 유효성 검증을 통해 잘못된 데이터 주입으로 인한 앱 크래시를 방지함.
  - **가독성 및 유지보수**: 고아 데이터 식별을 통해 불필요한 설정 키를 정리하고 시스템 무결성을 유지하기 쉬워짐.

#### ADR-007: Setting Dependency & Environment Priority (Developer Mode)

- **상황**: 디버그 및 개발 관련 설정들이 늘어남에 따라 일반 사용자의 UI 복잡성을 낮추고, 특정 개발 환경(예: 특정 창 강제 노출)에서 설정을 안전하고 편리하게 강제할 수 있는 메커니즘이 필요함.
- **결정**:
  - **Dependency Mechanism (`dependsOn`)**: 설정 항목 간의 부모-자식 관계를 정의함. 부모 설정(`dev_mode`)이 활성화된 경우에만 하위 설정 아이템들이 렌더링되도록 구현하여 UI 가독성을 개선함.
  - **Environment Priority Logic**: `VITE_SHOW_GAME_WINDOW=true`와 같은 환경 변수가 감지될 경우, 관련 설정값을 강제로 `true`로 덮어쓰고 UI 상에서 비활성화(Disabled) 처리함.
  - **Smart Persistence (Selective Saving)**:
    - 환경 변수에 의해 **강제된 값**은 저장소(`electron-store`)에 **기록하지 않음**. 이를 통해 환경 변수 없이 재시작 시 원래의 사용자 설정을 유지함.
    - 일반적인 상황에서 사용자가 직접 조작한 설정값은 `setConfig`를 통해 **즉시 영구 저장**됨.
  - **Restart-Required Policy**: 실시간 창 제어의 복잡성을 피하기 위해, 중요 설정 변경 시 UI 하단에 '재시작 필요' 안내를 표시하고 다음 실행 시 적용되는 방식을 채택함.
- **결과**:
  - **사용자 경험 성숙도**: 복잡한 설정 간의 관계를 시각적으로 명확히 전달하며, 적용 시점(재시작)을 명시하여 혼란을 방지함.

#### ADR-009: Global Fatal Error Handling & Fallback UI

- **상황**: 초기 앱 로드 중 예외가 발생하거나 React 렌더링에 치명적인 문제가 있을 경우 백화현상(White Screen)과 함께 런처가 응답 불능 상태에 빠지는 현상 제거 필요.
- **결정**:
  - **Main Process 포착**: `process.on('uncaughtException', ...)` 및 `unhandledRejection` 핸들러를 추가하여 메인 프로세스의 치명적 오류를 글로벌하게 포착함.
  - **Renderer ErrorBoundary**: React 렌더 트리 내부에서 발생하는 JS 오류는 최상단 `ErrorBoundary` 컴포넌트가 포착함.
  - **FatalErrorModal**: 어떠한 오류든 포착되면, 안전한 CSS 스타일만을 사용한 `FatalErrorModal`을 노출하여 사용자가 에러 내역을 복사하거나 런처를 강제 재시작할 수 있도록 안내함.
- **결과**: 앱 크래시 대신 명확한 안내 화면을 띄워 사용자 거부감을 최소화하고 디버깅 가능한 보고 체계를 갖춤.

#### ADR-010: Robust UAC Bypass via Proxy VBS & Task Scheduler

- **상황**: 게임 실행 파일을 직접 호출 시 관리자 권한 요청(UAC)이 매번 발생하여 자동화 흐름이 끊김. 이를 해결하기 위해 시스템 레지스트리를 수정하여 런처가 제어권을 가져와야 함.
- **결정**:
  - **Task Scheduler 활용**: `schtasks`를 이용해 관리자 권한으로 실행되는 작업을 등록하고 이를 호출하여 UAC를 우회함.
  - **Proxy VBS & Runner 구조**: `proxy.vbs` 및 `runner.vbs`를 활용하여 경로 내 공백 및 인용 부호 문제를 해결함.
  - **Encoding Standardization (UTF-16 LE)**: Windows Script Host(WSH) 한글 사용자 환경 지원을 위해 모든 스크립트를 **UTF-16 LE (with BOM)** 형식으로 생성함.
- **결과**: 사용자는 최초 한 번의 UAC 승인만으로 이후 모든 게임 실행 과정에서 추가 팝업 없는 자동 실행 기능을 누릴 수 있음.

#### ADR-011: Initial Onboarding Wizard & First-Run Logic

- **상황**: 앱 최초 실행 시 사용자가 주요 정책을 인지하고 필수 설정(UAC 우회 등)을 진행할 수 있는 안내 장치가 필요함.
- **결정**:
  - **Multi-step Onboarding Modal**: React 기반의 단계별 위저드를 구현하여 고지 사항 및 필수 설정을 순차적으로 진행함.
  - **`showOnboarding` State**: 완료 시 플래그를 저장하여 이후 실행부터는 노출되지 않도록 제어함.
- **결과**: 서비스 정책의 투명성을 확보하고 사용자가 앱의 주요 기능을 즉시 활용할 수 있도록 유도함.

#### ADR-012: Uninstaller Cleanup & Standalone Script Strategy

- **상황**: 앱 제거 시 시스템에 남은 UAC 우회 관련 스케줄러 항목과 레지스트리 설정이 방치될 수 있음.
- **결정**:
  - **Standalone Batch Script**: 앱 제거 시 호출될 독립적인 배치 파일(`uninstall_uac.bat`)을 미리 생성해둠.
  - **Uninstaller Integration**: NSIS 언인스톨러는 앱을 실행하지 않고 이 배치 파일을 직접 호출하여 정리 작업을 수행함.
- **결과**: 앱 파일이 완전히 제거되기 전에 시스템 설정을 깔끔하게 원복하며 제거 과정의 안정성을 보장함.

#### ADR-013: Service Channel Architecture (Kakao vs GGG)

- **상황**: Kakao Games와 GGG 채널의 실행 방식과 권한 레벨이 상이하여 단일한 감사 로직으로는 오작동이 발생함.
- **결정**:
  - **Kakao Games (Admin Privileged)**: 런처 프로세스 유무 및 활성 컨텍스트를 기준으로 식별하고 감시함.
  - **GGG (User Privileged)**: 파일 경로를 통해 POE1과 POE2를 명확히 구분하여 로그 감시를 수행함.
- **결과**: 서비스 채널별 특성에 맞춘 최적화된 감시 전략을 통해 로그 누락 및 오작동을 방지함.

#### ADR-014: Continuous Process Monitoring Strategy (Optimization Toggle)

- **상황**: 사용자가 런처를 백그라운드로 두고 다른 작업을 할 때도 패치 오류 등을 감지해야 한다는 요구사항이 존재함.
- **결정**:
  - **Optimization Setting**: `processWatcherEnabled` 설정을 도입하여 프로세스 감시 최적화 모드를 제어함.
  - **Always-On Monitoring**: 최적으로 모드를 끄면 런처가 백그라운드 상태여도 감시 루프를 중단하지 않고 항상 유지함.
- **결과**: 런처의 실행 상태와 무관하게 게임 실행 및 오류를 놓치지 않고 포착할 수 있음.

#### ADR-015: Standardized Logging System (Main, Preload, Renderer)

- **상황**: 프로젝트 전반에서 로그 형식이 파편화되어 런처 내부 '디버그 콘솔' 탭에서 통합 모니터링이 어려움.
- **결정**:
  - **Unified Logger System**: 모든 레이어에서 `LoggerBase`를 확장한 커스텀 로거를 사용하도록 강제함.
  - **Inter-process Streaming**: IPC를 통해 모든 로그를 메인 프로세스로 집약하여 하나의 타임라인으로 시각화함.
- **결과**: 개발자 도구를 열지 않고도 런처 UI 내에서 모든 시스템 흐름을 실시간으로 모니터링할 수 있음.

#### ADR-016: Intelligent Window Scaling & Real-time Resolution Adaptation

- **상황**: 저해상도 노트북이나 UMPC 환경에서 UI가 잘리거나 조작이 불가능해지는 현상이 발생함.
- **결정**:
  - **Dynamic Scaling Mode**: 화면 해상도를 실시간 감지하여 공간이 부족할 경우 Scale-to-fit을 적용함.
  - **Letterbox Implementation**: 배경 이미지를 스케일러 내부로 가두어 시각적 일관성을 확보함.
- **결과**: 다양한 폼팩터에서 런처가 잘림 없이 항상 최적의 크기로 노출됨.

#### ADR-017: Advanced Scheduler Configuration (XML Import Strategy)

- **상황**: 기본 `schtasks` 명령으로는 배터리 모드 실행이나 중복 실행 방지 정책을 정밀하게 제어할 수 없음.
- **결정**:
  - **XML-Based Definition**: XML 명세 파일을 동적으로 생성하여 완전한 제어권을 확보함.
  - **Power Condition Bypass**: 배터리 모드에서도 안정적인 자동 실행을 보장함.
- **결과**: 시스템 전원 상태와 무관하게 런처가 항상 신뢰성 있게 자동 실행됨.

#### ADR-018: Background-Driven Dynamic Theme System (Mandatory)

- **상황**: 각 게임별 배경화면에 어울리는 테마 색쌍이 필요하며 하드코딩된 색상은 가독성을 저해할 수 있음.
- **결정**:
  - **Auto-Extraction**: 이미지에서 액센트 색상을 자동 추출함.
  - **CSS Variables Standard**: 추출된 색상은 반드시 `--theme-accent` 등의 변수를 통해서만 적용되어야 함.
- **결과**: 배경화면이 바뀌어도 전체 UI 조화롭고 일관된 디자인 퀄리티를 유지함.

#### ADR-019: Background Account Validation & UI Transformation

- **상황**: 설정 페이지 집입 시 계정 ID를 즉시 보여주어야 하며 로그인 여부에 따라 버튼 성격이 동적으로 변해야 함.
- **결정**:
  - **Silent Background Validation**: 보이지 않는 배경 윈도우를 통해 정보를 실시간 추출함.
  - **Account ID Caching**: 추출된 정보는 캐싱하여 다음 진입 시 즉시 표시(낙관적 UI)함.
- **결과**: 별도의 팝업 없이 설정 페이지 내에서 로그인 상태를 즉시 확인 및 전이할 수 있음.

#### ADR-020: Markdown Notice System (gh-pages Source & Automation)

- **상황**: 프로젝트 공지사항을 Markdown 형식으로 외부에서 가져올 때 목록 관리 및 레이아웃 유지의 어려움이 있음.
- **결정**:
  - **gh-pages Branch as Source**: 개발자가 `gh-pages` 브랜치에 MD 파일을 올리는 모델 채택.
  - **Hybrid GitHub Actions**: 푸시 시 자동으로 `list.json` 인덱스를 갱신하는 자동화 파이프라인 구축.
- **결과**: 파일 업로드만으로 런처 공지사항이 자동 동기화되는 효율적인 파이프라인 확보.

#### ADR-021: FSM-Based State Management (Patch Reservation)

- **상황**: 패치 예약 및 자동 실행 로직이 복잡한 비동기 작업으로 얽혀 있어 상태 전환 시점의 모호함과 레이스 컨디션 우려가 있음.
- **결정**:
  - **FSM (Finite State Machine) 도입**: 명확한 상태 정의(`IDLE`, `PREPARING` 등)와 전이 규칙을 적용함.
  - **Type-Safe Handler Registry**: `any` 타입을 배제하고 상태별 전용 핸들러를 등록하여 로직 응집도를 높임.
- **결과**: 서비스 로직의 흐름 파악이 용이해지고 예외 상황에서도 안전하게 복구되는 신뢰성을 확보함.

#### ADR-022: Single Instance Lock & Active Window Focus

- **상황**: 사용자가 런처를 중복 실행할 경우 리소스 낭비 및 설정 충돌 가능성이 있음.
- **결정**:
  - **Single Instance Lock**: `app.requestSingleInstanceLock()`을 사용하여 중복 실행을 즉시 차단함.
  - **Second Instance Handling**: 중복 실행 시도 발생 시 기존 창에 포커스를 주거나 트레이에서 복구함.
- **결과**: 앱의 유일성을 보장하고 사용자 편의성을 증대시킴.

#### ADR-023: Persistent PowerShell Session & Socket Monitoring

- **상황**: 관리자 권한 작업마다 새로운 프로세스를 띄우면 지연이 발생하고 UAC가 반복됨.
- **결정**:
  - **Persistent Session**: 한 번 승인된 관리자 세션을 백그라운드에서 유지함.
  - **Socket-based Liveness**: IPC 소켓이 살아있는 한 세션을 유지하여 재승인 절차를 최소화함.
- **결과**: 앱 실행 중 한 번의 UAC 승인으로 모든 작업을 즉시 수행할 수 있게 됨.

#### ADR-024: Font Resource Externalization & Remote Sync (New)

- **상황**: 폰트 바이너리는 용량이 크고 라이선스 이슈가 민감하여 실행 파일과 분리 배포할 필요가 있음.
- **결정**:
  - **External Hosting**: 모든 폰트를 `gh-pages` 브랜치에 저장하고 메타데이터(`list.json`)로 관리함.
  - **Atomic Hash Sync**: 폰트 변경 시 해시값을 비교하여 필요한 폰트만 점진적으로 다운로드(Lazy Load)함.
  - **Server-side Rendering**: 미리보기 썸네일을 GitHub Actions에서 선제적으로 생성하여 런처의 런타임 부하를 제거함.
- **결과**: 라이선스 법적 리스크를 제거하고 런처 패키지 크기를 획기적으로 경량화함.

## 5. Settings System

런처의 설정 화면은 `src/renderer/settings/types.ts` 인터페이스를 기반으로 선언적으로 구축됩니다.

- **설정 구성**: [settings-config.ts](./src/renderer/settings/settings-config.ts)에서 실제 노출될 아이템들을 정의합니다.
- **핵심 메커니즘**:
  - **Type-Safe Binding**: `shared/config.ts`의 `DEFAULT_CONFIG`와 `id`로 매핑되어 영속성을 보장받습니다.
  - **Dynamic Context**: `onInit`, `onChangeListener`를 통해 실시간 상태 반영이 가능합니다.
- **상세 가이드**: AI 전용 스킬 문서 **[Skill: Settings Management](../.agents/skills/settings-management/SKILL.md)**를 참고하세요.

> [!IMPORTANT]
> **개발 원칙 (UI Separation)**: `SettingsContent.tsx`(Renderer)에는 비즈니스 로직을 하드코딩하지 않습니다. 모든 로직은 `settings-config.ts`의 훅을 통해 구현해야 합니다.

## 6. Documentation Map

| 기능 영역 (Area)        | 관련 문서 (Document)                                                              | 비고 (Note)                             |
| :---------------------- | :-------------------------------------------------------------------------------- | :-------------------------------------- |
| **설정 구성**           | [settings-config.ts](../src/renderer/settings/settings-config.ts)                 | 실제 노출 항목 정의 및 상호작용 로직    |
| **설정 사용 가이드**    | [Skill: Settings Management](../.agents/skills/settings-management/SKILL.md)      | 설정 추가 로직 및 패턴 (AI 구동 스킬)   |
| **설정 인터페이스**     | [types.ts](../src/renderer/settings/types.ts)                                     | `SettingItem` 등 핵심 타입 정의         |
| **이벤트 시스템**       | [Skill: Event & IPC](../.agents/skills/event-ipc-integration/SKILL.md)            | ADR-004 관련 상세 가이드 (AI 구동 스킬) |
| **빌드 및 릴리즈 (EN)** | [README.md](../README.md)                                                         | 설치 및 빌드 환경 변수 설명             |
| **빌드 및 릴리즈 (KR)** | [README_KR.md](./README_KR.md)                                                    | 설치 및 빌드 (한국어 버전)              |
| **UAC 우회**            | [uac.ts](../src/main/utils/uac.ts)                                                | 시스템 레지스트리 및 작업 스케줄러 로직 |
| **후원하기 (EN/KR)**    | [SUPPORT.md](./SUPPORT.md) / [SUPPORT_KR.md](./SUPPORT_KR.md)                     | 개발자 후원 방법 및 커뮤니티 안내       |
