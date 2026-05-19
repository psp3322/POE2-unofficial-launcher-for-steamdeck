# Path of Exile 한국어 폰트 역할 분석 보고서

> 분석 대상 파일: `spoqahansansneo-regular-poe.ttf` / `notosanscjktc-regular.ttf`  
> 작성일: 2025-05-18

---

## 1. 개요

Path of Exile(POE1) 및 Path of Exile 2(POE2)의 한국어 클라이언트는 한글 렌더링을 위해 두 종류의 폰트 파일을 게임 패키지에 내장하고 있다. 영문·숫자 영역은 별도로 **Fontin Regular** 및 **Fontin SmallCaps**가 원본 폰트로 사용되며, 한글 텍스트는 아래 두 폰트가 분담한다.

| 파일명 | 폰트명 | 사용 게임 |
|---|---|---|
| `spoqahansansneo-regular-poe.ttf` | Spoqa Han Sans Neo Regular | POE1 전체 / POE2 UI 영역 |
| `notosanscjktc-regular.ttf` | Noto Sans CJK TC Regular | POE2 전용 (신규 패널) |

POE1은 **Spoqa Han Sans Neo** 하나만 교체하면 모든 한글 텍스트가 변경되지만, POE2는 두 폰트를 **모두** 교체해야 전체 한글이 바뀐다는 것이 핵심 차이점이다.

---

## 2. 폰트별 상세 분석

### 2.1 Spoqa Han Sans Neo Regular

Spoqa(스포카)에서 제작·관리하는 오픈소스 서체로, SIL Open Font License로 배포된다. POE 한국어 버전 전용으로 내장된 TTF 파일이다.

#### 기본 메트릭

| 항목 | 값 |
|---|---|
| unitsPerEm | 1000 |
| ascent (hhea) | 970 |
| descent (hhea) | −282 |
| usWinAscent | 1100 |
| usWinDescent | 310 |
| sTypoAscender | 970 |
| sTypoDescender | −282 |
| Vendor | GOOG |
| 버전 | 1.100 (2021) |

#### 문자 커버리지

| 범위 | 커버 수 / 전체 | 비율 |
|---|---|---|
| 한글 음절 (가–힣, U+AC00–U+D7A3) | 11,172 / 11,172 | **100%** |
| 한글 자모 (U+1100–U+11FF) | 256 / 256 | **100%** |
| CJK 통합 한자 (U+4E00–U+9FFF) | 20,945 / 20,992 | 99% |
| CJK 확장-A (U+3400–U+4DBF) | 6,582 / 6,592 | 99% |
| 라틴 기본 (U+0020–U+007F) | 95 / 96 | 98% |
| 히라가나 | 93 / 96 | 96% |
| 가타카나 | 96 / 96 | **100%** |
| Bopomofo (주음부호) | 0 / 2 | 0% |
| **총 cmap 항목** | **44,648** | — |

#### GSUB 피처

없음 (의도적으로 제거된 경량화 버전)

#### PUA (사용자 정의 영역)

- **U+E000, U+E001** 두 글리프 포함
- Spoqa 공식 README에서 언급하는 화살표 캐럿(← →) 아이콘 글리프로, UI 네비게이션 요소에 직접 사용됨

#### 인게임 담당 영역

- **POE1**: 채팅, HUD, 아이템 툴팁, 스킬·버프 이름, NPC 대화, 퀘스트 텍스트 등 **한글 전체**
- **POE2**: 아이템 툴팁·이름, HUD·버프·스킬 UI, 채팅창 등 **기존 UI 프레임워크 영역**

#### 채택 이유 (추정)

GSUB 피처가 없어 렌더링 오버헤드가 낮다. 아이템 툴팁, 버프 목록처럼 프레임마다 다수의 텍스트 요소를 실시간으로 그려야 하는 UI에 최적화된 선택이다. PUA 화살표 글리프는 UI 버튼 레이블 등에서 별도 이미지 없이 폰트 글리프만으로 처리할 수 있게 해준다.

---

### 2.2 Noto Sans CJK TC Regular

Google과 Adobe가 공동 개발한 Noto Sans CJK 계열 중 **TC(Traditional Chinese, 번체 중국어)** 변형이다. POE2에서 신규로 도입된 UI 패널 전용이다.

#### 기본 메트릭

| 항목 | 값 |
|---|---|
| unitsPerEm | 1000 |
| ascent (hhea) | **1160** |
| descent (hhea) | −288 |
| usWinAscent | **1160** |
| usWinDescent | 288 |
| sTypoAscender | 880 |
| sTypoDescender | −120 |
| Vendor | GOOG |
| 버전 | 2.004 |

> Spoqa 대비 usWinAscent가 60유닛 더 크다(1100 → 1160). 동일 포인트 크기에서 세로 여백이 더 넓게 잡히므로 대화창처럼 줄 간격이 필요한 텍스트 레이아웃에 유리하다.

#### 문자 커버리지

| 범위 | 커버 수 / 전체 | 비율 |
|---|---|---|
| 한글 음절 (가–힣) | 11,172 / 11,172 | **100%** |
| 한글 자모 | 256 / 256 | **100%** |
| CJK 통합 한자 | 20,976 / 20,992 | 99% |
| CJK 확장-A | 6,582 / 6,592 | 99% |
| Bopomofo (주음부호) | 2 / 2 | **100%** (Spoqa는 0%) |
| 원형 숫자 (U+2780–U+2789, ➀–➉) | 10 / 10 | **100%** |
| **총 cmap 항목** | **44,348** | — |

#### GSUB 피처 (15종)

| 피처 태그 | 기능 |
|---|---|
| `ljmo` / `tjmo` / `vjmo` | 한글 자모 조합 (초성/중성/종성) |
| `locl` | 로케일별 자형 변형 |
| `vert` | 세로쓰기 대응 |
| `liga` / `dlig` | 합자(Ligature) |
| `ccmp` | 문자 조합 |
| `calt` | 문맥적 자형 교체 |
| `fwid` / `hwid` / `pwid` | 전각/반각/비례폭 |
| `ruby` | 루비 문자(후리가나 등) |
| `hist` | 역사적 자형 |
| `aalt` | 모든 대체 자형 |

#### PUA

없음

#### 인게임 담당 영역 (POE2 전용)

- NPC 대화창 텍스트
- 스토리·퀘스트 설명 텍스트
- 신규 UI 패널(POE2에서 새로 구현된 로그, 이벤트 텍스트 등)의 한글 렌더링

#### 채택 이유 (추정)

POE2가 POE1과 별개의 게임으로 독립 개발되면서 대화·서사 전달용 UI 패널을 새로운 렌더링 코드로 구현했고, 해당 시스템이 Noto Sans CJK TC를 참조하도록 설계된 것으로 보인다. `ljmo/tjmo/vjmo` 자모 조합 피처와 `locl` 로케일 피처는 긴 서사 텍스트의 자간·가독성 품질을 높이며, TC 변형 채택으로 한국어·번체 중국어·일본어를 동일 폰트 파이프라인에서 관리할 수 있다. 원형 숫자 글리프(➀~➉)는 퀘스트 단계 표시 등 순서형 UI 요소에도 활용 가능하다.

---

## 3. 두 폰트 비교

### 3.1 공통점

- unitsPerEm 동일 (1000)
- 한글 음절 11,172자 100% 커버
- CJK 한자 99% 커버
- 히라가나·가타카나 지원
- Google 제작 또는 후원 (Vendor: GOOG)
- SIL Open Font License 배포

### 3.2 차이점

| 항목 | Spoqa Han Sans Neo | Noto Sans CJK TC |
|---|---|---|
| usWinAscent | 1100 | **1160** |
| GSUB 피처 수 | **0** | 15종 |
| 한글 자모 조합 피처 | 없음 | ljmo / tjmo / vjmo |
| 로케일 피처 | 없음 | locl |
| Bopomofo | 미지원 | **지원** |
| 원형 숫자 ➀~➉ | 미포함 | **포함** |
| PUA 화살표 글리프 | **E000, E001 포함** | 없음 |
| 파일 크기(상대) | 경량 | 대형 |
| 렌더링 성능 | 최적화 (GSUB 없음) | 피처 풀 탑재 |
| 주 용도 | 실시간 UI 렌더링 | 서사·대화 텍스트 |

### 3.3 Spoqa에만 있는 글리프 (주요)

- `U+E000`, `U+E001` — 화살표 캐럿 (PUA)
- `U+2252` — ≒ (거의 같음 기호)
- `U+25C8` — ◈ (한국어 글머리 기호로 자주 사용)
- CJK Ext-B 일부 한자

### 3.4 Noto에만 있는 글리프 (주요)

- `U+00A0` — 줄바꿈 없는 공백(NBSP)
- `U+02EA`, `U+02EB` — Bopomofo 성조 부호
- `U+0300`~`U+030C` — 결합 악센트 기호
- `U+2780`~`U+2789` — 원형 숫자 ➀~➉
- `U+278A`~`U+278F` — 채워진 원형 숫자 ➊~➏
- `U+22EF` — ⋯ (중간 줄임표)

---

## 4. POE1 vs POE2 폰트 구조 차이

```
POE1
├── 영문/숫자  →  Fontin Regular + Fontin SmallCaps
└── 한글 전체  →  Spoqa Han Sans Neo Regular (단독)

POE2
├── 영문/숫자         →  Fontin Regular + Fontin SmallCaps
├── 한글 UI 텍스트    →  Spoqa Han Sans Neo Regular
└── 한글 서사 텍스트  →  Noto Sans CJK TC Regular (신규 추가)
```

POE2가 POE1의 대형 업데이트가 아닌 별도 게임으로 독립 개발되는 과정에서, 확장된 대화·스토리 UI 시스템이 새로운 폰트 렌더링 파이프라인을 도입했고 이것이 Noto Sans CJK TC를 참조하게 된 구조다. 결과적으로 POE2 유저가 커스텀 폰트를 적용하려면 반드시 두 파일을 모두 교체해야 한다.

---

## 5. 결론

| 구분 | Spoqa Han Sans Neo | Noto Sans CJK TC |
|---|---|---|
| 핵심 역할 | 실시간 게임 UI 전반의 한글 | POE2 대화·서사 텍스트의 한글 |
| 설계 철학 | 경량·고속 렌더링 우선 | 타이포그래피 품질·다중 CJK 우선 |
| 적용 게임 | POE1 전체 + POE2 UI | POE2 전용 |

두 폰트는 용도에 따라 명확히 분리되어 있으며, Spoqa는 성능이 중요한 인터페이스 레이어를, Noto는 가독성과 국제화가 중요한 서사 레이어를 담당하는 역할 분담 구조로 운용된다.

---

*분석 도구: Python fonttools 라이브러리를 이용한 TTF 파일 직접 파싱*  
*참고 커뮤니티: 패스 오브 엑자일 마이너 갤러리(디시인사이드), 패스 오브 엑자일 인벤*
