# 디버그 콘솔 스크롤 바닥 고정 문제 분석 및 수정 계획

## 배경

디버그 콘솔의 로그 영역은 터미널과 같은 방식으로 동작해야 한다.

- 사용자가 로그 맨 아래를 보고 있으면 새 로그가 빠르게 쌓여도 계속 최신 로그를 따라간다.
- 사용자가 직접 위로 스크롤하면 자동 추적을 멈추고 `새 로그 보기` 버튼을 표시한다.
- `새 로그 보기`를 누르면 최신 로그로 이동하고 다시 자동 추적 상태가 된다.

보고된 증상은 로그가 짧은 시간에 많이 출력될 때 간헐적으로 발생한다. 사용자는 바닥을 보고 있었는데 화면이 중간에 남거나, 사용자가 위로 올리지 않았는데 `새 로그 보기` 버튼이 표시될 수 있다.

## 기존 구현

`src/renderer/components/DebugConsole.tsx`는 기존에 `isAutoScroll` 하나로 스크롤 상태를 관리했다.

- `handleScroll()`에서 `scrollHeight - scrollTop - clientHeight < 50`이면 바닥으로 판단했다.
- `scrollToBottom()`은 `bottomRef.current.scrollIntoView()`를 호출하고 바로 `isAutoScroll`을 `true`로 설정했다.
- 로그 변경 감지는 `logState.all.length` 증가 여부만 사용했다.
- `새 로그 보기` 버튼은 `!isAutoScroll`이면 표시했다.

이 구조에서는 서로 다른 의미가 하나의 상태에 섞여 있었다.

- 사용자가 최신 로그를 계속 따라가려는 의도
- 현재 DOM 측정값 기준으로 바닥에 가까운지 여부
- 사용자가 보지 못한 새 로그가 있는지 여부

## 확인한 문제

1. 바닥 추적 의도가 불안정한 DOM 측정값에 의해 꺼질 수 있다.

   로그가 빠르게 추가되면 React 렌더 후 스크롤 보정이 일어나기 전에 `scrollHeight`가 크게 증가한다. 이때 `scrollTop`은 이전 바닥을 가리키고 있으므로, 실제로 사용자가 움직이지 않았더라도 `handleScroll()`이 바닥이 아니라고 오판할 수 있다.

2. `새 로그 보기` 버튼이 사용자 의도 없이 표시될 수 있다.

   기존 버튼 조건이 `!isAutoScroll` 하나라서, 일시적인 측정 오차만으로도 버튼이 표시된다. 사용자가 로그를 올려 본 경우와 레이아웃 변경 때문에 잠깐 바닥 판정이 깨진 경우가 구분되지 않는다.

3. 새 로그 감지가 전체 로그 길이에만 의존한다.

   `mergeLog()`는 반복 로그를 마지막 항목의 `count`, `timestamp` 변경으로 병합할 수 있다. 이 경우 화면에 보이는 마지막 로그는 바뀌지만 `logState.all.length`는 증가하지 않는다. 기존 구현은 이런 갱신을 새 로그로 보지 못한다.

4. 필터별 로그 화면에서 전역 로그 길이를 기준으로 동작한다.

   특정 타입 탭을 보고 있을 때 다른 타입 로그가 들어와도 `logState.all.length`는 증가한다. 반대로 현재 필터에서 보이는 반복 로그는 길이 증가 없이 갱신될 수 있다. 따라서 현재 화면에 보이는 로그 목록 기준으로 판단해야 한다.

5. 스크롤 보정 시점이 늦다.

   기존 자동 스크롤은 `useEffect()`에서 수행되어 paint 이후에 실행된다. 로그가 몰릴 때는 사용자가 중간 위치를 보는 프레임이 생길 수 있다. 바닥 추적은 레이아웃 단계에서 직접 `scrollTop`을 맞추는 방식이 더 적절하다.

## 목표 동작

- 사용자가 직접 위로 스크롤하지 않았다면 로그가 몰려도 바닥 추적을 유지한다.
- 바닥에서 벗어난 모든 상황을 자동 추적 해제로 보지 않고, 사용자 스크롤 의도가 있을 때만 추적을 멈춘다.
- `followTail`과 `hasUnseenLogs`를 분리한다.
- `새 로그 보기`는 로그 화면에서 다음 조건이 모두 맞을 때만 표시한다.
  - `followTail === false`
  - `hasUnseenLogs === true`
- 탭 또는 필터를 바꾸면 최신 로그 위치로 이동하고 자동 추적을 재개한다.
- 로그 변경 감지는 전체 길이가 아니라 현재 보이는 로그 목록의 tail signature로 판단한다.

## 수정 계획

1. `src/renderer/components/debug/scroll-follow.ts`에 순수 헬퍼를 추가한다.

   담당 범위:

   - 스크롤 snapshot 기준 바닥 근접 여부 계산
   - 현재 필터에서 보이는 로그 목록 선택
   - 보이는 로그 목록의 tail signature 생성
   - `새 로그 보기` 버튼 표시 조건 계산

2. 헬퍼 단위 테스트를 추가한다.

   검증 항목:

   - 바닥 근접 threshold 판정
   - 필터별 visible log 선택
   - 새 로그 append 시 tail signature 변경
   - 반복 로그 병합으로 길이가 늘지 않아도 `count`/`timestamp` 변경 감지
   - `새 로그 보기` 버튼 표시 조건

3. `DebugConsole.tsx`의 스크롤 상태를 분리한다.

   기존 `isAutoScroll`을 제거하고 다음 상태로 대체한다.

   - `followTail`: 최신 로그를 따라갈지에 대한 사용자 의도
   - `hasUnseenLogs`: 추적 중지 상태에서 현재 화면에 보이는 로그가 갱신되었는지

   추가 ref:

   - 사용자 스크롤 의도 감지 ref
   - 프로그램이 발생시킨 스크롤 이벤트 무시용 ref
   - 이전 필터 ref
   - 이전 visible tail signature ref

4. 바닥 보정은 layout 단계에서 수행한다.

   `followTail`이 켜져 있고 보이는 로그 tail이 바뀌면 `scrollTop = scrollHeight`를 직접 적용한다. 사용자가 볼 수 있는 중간 프레임을 줄이고, `scrollIntoView()`의 지연 또는 smooth scroll 중간 상태에 의존하지 않는다.

5. 기존 사용자 동작을 유지한다.

   - 사용자가 위로 스크롤하면 추적을 멈춘다.
   - 추적이 멈춘 상태에서 보이는 로그가 바뀌면 `새 로그 보기`를 표시한다.
   - 버튼을 누르면 최신 로그로 이동하고 unseen 상태를 지운다.
   - 필터 전환 시 최신 위치로 이동하고 추적을 재개한다.

## 검증 계획

- `npm test -- --run src/renderer/components/debug/scroll-follow.test.ts`
- `npm run lint`
- `npm run build:check`
- Windows Electron CDP로 실제 디버그 콘솔 대상에 붙어 다음 시나리오 확인
  - 바닥 추적 상태에서 로그 80개 연속 추가
  - 사용자가 위로 스크롤한 뒤 새 로그 추가
  - 이때만 `새 로그 보기` 표시
  - 버튼 클릭 후 다시 바닥 이동 및 버튼 숨김

## 확인 결과

- 집중 테스트 통과: `src/renderer/components/debug/scroll-follow.test.ts`
- lint 통과
- build check 통과
- 실제 Electron CDP 시나리오 통과
  - 로그 burst 이후 `distanceFromBottom: 0`, 버튼 숨김
  - 사용자 스크롤 후 새 로그 추가 시 버튼 표시
  - 버튼 클릭 후 `distanceFromBottom: 0`, 버튼 숨김
