<p align="center">
  <img src="../src/renderer/assets/layout/frame-top-center.gif" width="100%" />
</p>

<h1 align="center">POE Unofficial Launcher</h1>

<p align="center">
  <img src="https://img.shields.io/github/v/release/NERDHEAD-lab/POE2-unofficial-launcher?include_prereleases&style=flat-square" />
  <img src="https://img.shields.io/github/license/NERDHEAD-lab/POE2-unofficial-launcher?style=flat-square" />
  <img src="https://img.shields.io/github/downloads/NERDHEAD-lab/POE2-unofficial-launcher/total?style=flat-square" />
</p>

<p align="center">
  <a href="../README.md"><b>EN</b></a> | <a href="README_KR.md"><b>KR</b></a>
</p>

> **면책 조항 (Disclaimer)**: 본 프로그램은 **Path of Exile** 및 **Path of Exile 2**를 위한 **비공식(Unofficial)** 런처입니다. Grinding Gear Games 또는 Kakao Games와 무관하며, 사용 시 발생하는 모든 책임은 사용자에게 있습니다.

**Path of Exile**과 **Path of Exile 2**를 좀 더 쾌적하게 실행하기 위한 Windows 데스크톱 런처입니다. 카카오게임즈(한국)와 Grinding Gear Games(GGG) 스탠드얼론 클라이언트의 실행 과정을 자동화하고, 매번 뜨는 UAC 창을 없애고, 게임 폰트·UI 테마를 원하는 대로 바꾸고, 흔한 패치 오류를 알아서 복구하며, 공식 공지·패치 노트도 런처 안에서 바로 보여줍니다.

> **Windows 전용**입니다. PoE / PoE 2의 **Steam 버전은 지원하지 않습니다** — GGG 스탠드얼론 클라이언트를 사용하세요.

<p align="center">
  <img src="PoE%20Unofficial%20Launcher%20preview.gif" width="100%" />
</p>

## 주요 기능

### 게임 실행

- **PoE 1 & PoE 2 원클릭 실행** — **카카오게임즈**와 **Grinding Gear Games 스탠드얼론 클라이언트**를 지원합니다. (Steam 버전은 지원하지 않습니다.)
- **카카오 자동화**: "지정 PC" 확인 창, 로그인 팝업, 시작 시 인트로 모달을 자동으로 처리합니다. 자동화는 별도의 숨겨진 샌드박스 창에서 돌아가기 때문에 사용자는 웹 UI를 볼 일이 없습니다.
- **UAC(사용자 계정 컨트롤) 팝업 제거**. Windows의 `RUNASINVOKER` 호환성 플래그를 이용해 카카오게임즈 스타터(`KakaogamesStarter.exe` / `DaumGameStarter.exe`)를 권한 상승 없이 실행하므로, 게임을 켤 때마다 뜨던 UAC 확인 창이 더 이상 뜨지 않습니다. (예전의 작업 스케줄러 / `proxy.vbs` 방식을 대체하며, 기존에 그 방식이 설치돼 있다면 자동으로 감지해 정리합니다.)

### 커스터마이징

- **게임 내 커스텀 폰트**. 원하는 폰트를 등록하고, 다운로드 가능한 폰트 카탈로그를 둘러보고, PoE1 / PoE2(서비스 채널별)에 각기 다른 폰트를 지정할 수 있습니다. 게임 파일은 손대지 않고, 폰트 자체의 내부 메타데이터를 게임이 기대하는 이름으로 바꿔서 끼워 넣는 방식이라 호환성이 깨지지 않습니다.
- **게임 UI 테마**. 공식 테마 저장소에서 자동으로 동기화되는 카탈로그에서 테마를 고를 수 있습니다. 에셋은 로컬에 캐시되고, 샌드박스화된 `asset://` 프로토콜을 통해 런처 UI에 제공됩니다.

### 패치 도구

- **패치 오류 자동 복구**. `Transferred a partial file` 같은 고질적인 패치 실패를 감지해 자동으로 복구합니다.
- **패치 예약**. 지금 기다리는 대신, 원하는 시각(예: 새벽)에 패치를 돌리도록 예약할 수 있습니다.
- **강제 수리**. 뭔가 이상하다 싶을 때 클릭 한 번으로 게임 파일 전체 수리를 수동 실행할 수 있습니다.

### 정보 / 편의 기능

- **런처 내 뉴스**. PoE 공식 공지와 패치 노트를 스크래핑해 옆 패널에 바로 보여주므로 브라우저를 따로 열 필요가 없습니다.
- **자동 업데이트**. `electron-updater` 기반으로 런처가 백그라운드에서 자기 자신을 업데이트하고, 새 버전이 준비되면 알려줍니다.
- **프로세스 인식**. 게임이 실행 중인지 감지하고, 런처가 포커스를 잃으면 백그라운드 작업을 잠시 멈추며, 절전/복귀 시에도 정상 복구합니다.
- **첫 실행 마법사**. 처음 실행할 때 UAC 우회 설정과 패치 옵션을 짧은 단계로 안내합니다.
- **내장 디버그 콘솔**. 문제가 생겼을 때 로그와 설정값을 확인할 수 있는 진단용 화면을 제공합니다.

### 개인정보 / 보안

- **비밀번호를 저장하지 않습니다**. 로그인은 퍼블리셔 자체 웹 흐름이 샌드박스 Electron 세션 안에서 처리하고, 런처는 세션 쿠키만 사용합니다.
- **격리된 브라우저 세션**. 숨겨진 게임 창은 분리된 Electron 세션 파티션에서 동작하며, 카메라·마이크·위치·WebAuthn(패스키)·MIDI·포인터 락 등 민감한 웹 권한을 명시적으로 차단합니다.

## 설치 방법

1. [Releases](https://github.com/NERDHEAD-lab/POE2-unofficial-launcher/releases) 페이지로 이동합니다.
2. 최신 `Setup.exe`를 다운로드합니다.
3. 설치 프로그램을 실행합니다.

## 개발용 설정

일반 사용자라면 이 섹션은 필요 없습니다. 위 설치 방법으로 충분합니다. 소스로 직접 빌드해 보고 싶은 분들을 위한 안내입니다.

### 준비물

- **Node.js 24 이상** (`package.json`의 `engines` 참고)
- npm
- Windows (런처는 Windows 전용입니다)

### 설정

```bash
# 저장소 복제
git clone https://github.com/NERDHEAD-lab/POE2-unofficial-launcher.git
cd POE2-unofficial-launcher

# 의존성 설치 (npm install로도 동일)
npm run setup
```

### 자주 쓰는 스크립트

```bash
npm run dev        # 개발 모드 실행 (Vite + Electron)
npm run dev:test   # dev와 동일하나, 숨겨진 게임 창과 DevTools를 함께 표시
npm run build      # 타입체크 + 번들링 + Windows 인스톨러 생성
npm run lint       # ESLint
npm test           # Vitest
```

상세한 아키텍처와 내부 설계 노트는 본 저장소가 아닌 프로젝트 내부 문서에서 별도로 관리합니다.

## 기여하기

기여는 언제나 환영합니다. 이슈나 풀 리퀘스트(Pull Request)를 자유롭게 올려 주세요.

## 라이선스

이 프로젝트는 [GNU Affero General Public License v3.0](../LICENSE) 라이선스로 배포됩니다.

## 저장소 주소

[https://github.com/NERDHEAD-lab/POE2-unofficial-launcher](https://github.com/NERDHEAD-lab/POE2-unofficial-launcher)

## 후원하기

이 프로젝트가 도움이 되셨다면 개발자를 후원해 주세요. [상세 정보](./SUPPORT_KR.md)

<p align="center">
  <img src="../src/renderer/assets/layout/banner-bottom.png" width="100%" />
</p>
