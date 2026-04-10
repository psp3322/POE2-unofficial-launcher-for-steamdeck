# 폰트 관리 시스템 기술 전환 가이드 (FONT_TRANSITION_GUIDE)

본 문서는 POE2 런처의 폰트 변조 및 설치 로직을 기존의 불안정한 방식에서 검증된 고성능 방식(fonteditor-core + Win32 API 공지)으로 전환하기 위한 기술적 근거와 실행 전략을 정리합니다.

---

## 1. 개요: 왜 전환이 필요한가? (AS-IS vs TO-BE)

### [AS-IS] (기존 방식)
- **도구**: `opentype.js`
- **문제점**:
    - **폰트 파손**: 저장 시 복잡한 GPOS/GSUB 테이블(OpenType 레이아웃)을 완벽히 보존하지 못해 가독성 저하 및 데이터 오염 발생.
    - **이름 불일치**: 단순히 패밀리명만 바꾸어 구글 드라이브나 특정 윈도우 환경에서 스타일(Book, Regular)이 중복 표시되거나 누락되는 현상 발생.
    - **설치 실패**: 윈도우 11의 보안 정책(`Unblock-File`) 미대응 및 단순 파일 복사 방식으로 인한 실시간 적용 실패.

### [TO-BE] (신규 방식)
- **도구**: `fonteditor-core` (무결성 우선)
- **해결책**:
    - **무결성 유지**: 소스 폰트의 모든 테이블을 원본 그대로 보존하며 필요한 이름 레코드만 정밀 타격하여 수정.
    - **네이밍 정규화**: 윈도우 타이틀(ID 1, 4)과 스타일(ID 2, 16, 17)을 분리 제어하여 환경에 무관한 일관된 이름 제공.
    - **강력한 설치**: PowerShell을 통한 `Unblock-File` 처리 및 Win32 API(`AddFontResource`, `PostMessage`)를 활용한 시스템 즉시 공지.

---

## 2. 핵심 변조 규칙 (Precision Mutation)

카카오게임즈 POE2 클라이언트 인식 및 시스템 표시 최적화를 위한 1:1 매칭 규칙입니다.

| 전용 필드 (Name ID) | 적용 값 (예: Noto) | 적용 값 (예: Spoqa) | 전략 |
| :--- | :--- | :--- | :--- |
| **ID 1 (Family)** | Noto Sans CJK TC | Spoqa Han Sans Neo | 스타일 이름 제외 (윈도우 타이틀 클린화) |
| **ID 2 (Subfamily)**| **Book** | **Regular** | 필수 기입 (GDrive 등 외부 엔진 매칭용) |
| **ID 4 (Full Name)** | Noto Sans CJK TC | Spoqa Han Sans Neo Regular | 기준 폰트의 실제 윈도우 타이틀 규칙 준수 |
| **ID 6 (PostScript)**| NotoSansCJKTC | SpoqaHanSansNeo-Regular | 하이픈 구분 형식 유지 |
| **i18n (Language)** | **en, ko 모두 동일** | **en, ko 모두 동일** | 모든 언어 레코드를 일치시켜 "유령 문자열" 제거 |

---

## 4. 코드 아키텍처 가이드라인 (Readability & Maintainability)

본 시스템은 가독성과 유지보수성을 극대화하기 위해 다음과 같은 설계 원칙을 준수합니다.

- **메타데이터 상수 분리**: 각 타겟 폰트의 이름 규칙(Family, Subfamily, FullName, PostScript)은 워커 파일 상단에 `MUTATION_RULES`와 같은 **상수 객체**로 정의합니다.
- **로직/데이터 분리**: 변조 로직(`mutate`)은 순수하게 데이터를 받아 처리만 하며, 어떠한 하드코딩된 문자열도 포함하지 않습니다.
- **확장성**: 새로운 폰트 타겟이 추가될 경우, 로직 수정 없이 상수 설정값만 추가하여 대응합니다.

---

## 6. UI/UX 설계 가이드라인 (Unified Font Matrix)

사용자 편의성과 시각적 명확성을 극대화하기 위해 기존의 채널별 분리 설계를 폐지하고 **"폰트 라이브러리 중심의 통합 매트릭스"** 구조를 채택합니다.

### 6.1. 통합 리스트 계층 구조
1.  **기본값 (Default)**: 최상단 고정. 선택 시 해당 서비스의 커스텀 폰트 제거 및 원복.
2.  **알 수 없는 폰트 (Unknown)**: 시스템에 폰트는 설치되어 있으나 런처 라이브러리에 없는 경우에만 동적으로 표시.
3.  **기본 폰트 (System Defaults)**: 런처에서 기본적으로 제공하는 폰트 세트. 별명 수정 불가.
4.  **내 폰트 (User Library)**: 사용자가 직접 추가한 폰트들. 별명 수정 가능.

### 6.2. 서비스 할당 제어 (Service Toggle Icons)
- 각 폰트 행의 우측에 **카카오게임즈 / GGG 로고** 아이콘을 배치합니다.
- **비활성 상태**: 회색(Grayscale) 처리.
- **활성 상태**: 본래의 로고 색상(Full Color)으로 표시.
- **토글 로직**: 특정 아이콘 클릭 시 해당 폰트가 해당 서비스에 할당됩니다. (타 폰트에 이미 할당된 경우 자동 해제)

### 6.3. 상호작용 및 편집
- **인플레이스 별명 수정**: 커스텀 폰트의 별명 영역 클릭 시 즉시 텍스트 편집 모드로 전환합니다.
- **일괄 적용 (Batch Apply)**: 우측 하단에 단일 [적용] 버튼을 배치합니다. 변경 사항(Pending Changes)이 감지된 경우에만 활성화됩니다.

---

## 7. 시스템 통합 코드 체크리스트

하나의 가족 안에 여러 타입이 있는 폰트 대응 계획입니다.

- **추출 로직**: `fonteditor-core` 로드 시 `index` 옵션을 활용하여 특정 Face만 TTF로 추출.
- **분리 저장**: 통합 폰트 소스에서 추출된 각각의 인덱스를 독립된 `NOTO`, `SPOQA` 타겟 파일로 개별 변조 후 저장.

---

## 4. 실구현 전환 로드맵

### Phase 1: Worker 리팩토링 (`FontMutatorWorker.ts`)
- [ ] `opentype.js` 의존성 제거 및 `fonteditor-core` 도입.
- [ ] 위 테이블에 정의된 5단계 정명 변조 로직 구현.

### Phase 2: PowerShell 매니저 강화 (`powershell.ts`)
- [ ] `Unblock-File` 및 `-LiteralPath` 적용.
- [ ] `PostMessage`를 통한 `WM_FONTCHANGE` 시스템 전파 구현.

### Phase 3: 번들 에셋 교체 (`assets/fonts`)
- [ ] 사용자 검토가 완료된 고품질 Kodia 폰트(src 기준)를 기본 소스로 채택.
