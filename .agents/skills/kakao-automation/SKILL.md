---
name: kakao-automation
description: Use when changing anything under src/main/kakao/ (login/launch automation, PageHandler selectors, SecurityCenter, visibility policy, page dumps, maintenance detection) or the KakaoGames starter/UAC path (src/main/utils/uac/kakao-game-starter.ts, uac-migration.ts). Third-party-DOM selector policy and real-user blast radius rules.
---

# Skill: Kakao Automation

카카오 로그인·게임 실행 자동화는 서드파티 DOM에 의존하며, 셀렉터 변경은
auto-update로 전체 사용자에게 즉시 배포된다.

## 구조 지도

- `src/main/kakao/preload.ts` (~1.4k lines): PageHandler 레지스트리 —
  URL/DOM 매칭 기반 자동화 본체 (SecurityCenterHandler 포함).
- `src/main/kakao/visibility-policy.ts`: 자동화 창 표시/숨김 정책.
- `src/main/kakao/automation-page-dump.ts`: 실패·노출 시 페이지 덤프 저장.
- `src/main/kakao/session.ts`: 세션 파티션. `maintenance-info.ts`: 점검 감지.
- `src/main/utils/uac/kakao-game-starter.ts`: KakaoGames Starter(KGS) 실행
  경로 — 2026-06 DGS→KGS 전환·마이그레이션 판단. (게임 exe
  `PathOfExile_KG.exe` 감지 자체는 `src/main/config/GameServiceProfiles.ts`·
  `src/main/utils/registry.ts`.)

## 규칙

1. **셀렉터는 덤프에서만.** 실제 페이지 덤프(HTML) 근거 없이 셀렉터를
   추가·수정하지 않는다. 덤프 수집·독해 방법은 `windows-electron-debugging`.
2. **추가 우선, 제거 신중.** 기존 매칭 제거/교체는 구 페이지를 보는 사용자를
   깨뜨린다. 핸들러·셀렉터는 추가로 확장하고, 제거는 페이지 소멸 근거와 함께.
3. **SecurityCenter 노출 판정은 URL이 아닌 DOM 상태로.**
   - 숨김 유지(자동 진행): PC정보수집안내 확인 버튼, `.section--device-save`,
     `.modal--device-loading`, 본문 "PC 인증 정보 수집 중".
   - 즉시 노출(사용자 입력): MOTP, ARS, 카카오페이, 기기명 입력, 가시적
     코드/입력 셀렉터.
   - 미지의 화면: 노출을 지연하고 덤프를 보존해 다음 릴리스에서 셀렉터 보강.
4. **검증은 실제 플로우로만.** 이 영역 DoD는 항상 `[사용자]` Windows 실동작
   검증 — 빌드/유닛 테스트 통과로 완료 선언 금지.
5. 스타터/UAC 경로 변경은 기존 설치 사용자의 마이그레이션 blast radius를
   먼저 서술한다 (`uac-migration.ts`).
