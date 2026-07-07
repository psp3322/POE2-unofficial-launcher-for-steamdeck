# 폰트 작업 잔여 항목 (새 세션 인계용)

> 작성일: 2026-05-19 · **갱신: 2026-05-20 (B2/B3 수정 + §1.2 실측 완료 반영)** ·
> 브랜치: `fix/custom-font` (미릴리즈, 마지막 태그 `1.2.1`)
> 관련 문서: `font-implementation-plan.md`(STEP1·2, STEP3는 _조건부_ 상태로 자연 복귀),
> `bugfix-hkcu-font-removal-plan.md`(B-1/B-2), `font-mutation-analysis.md`(분석),
> raw 노트
> `~/project_llm_wiki/raw/projects/poe2-launcher/2026-05-20-font-step3-revert.md`(STEP3 회귀·revert·다음 실험 설계),
> `~/project_llm_wiki/raw/projects/poe2-launcher/2026-05-20-font-reapply-fixes.md`(**B2/B3 결함 발견·수정 — §1.2 실측 차단점 해소**)
>
> **폰트 무관 잔여작업** (axios hotfix, config-integrity, WSL/precommit
> 환경 메모 등): `docs/work/2026-05-20-residual-work.md`로 분리됨.

이 문서는 **다음 세션이 컨텍스트 없이 이어받을 수 있도록** 폰트 작업의
미완 항목만 모았다. 완료 항목은 각 계획서 본문, 폰트 무관 항목은 위 분리
문서 참조.

---

## 0. 완료 상태 요약 (인계 기준점)

| 항목                                          | 상태                                                                             |
| --------------------------------------------- | -------------------------------------------------------------------------------- |
| STEP 1 UI mockup                              | ✅ 완료                                                                          |
| STEP 2 metrics 크기보정                       | ✅ 완료 / **실게임 검증 완료 (2026-05-20, 50/100/150% 슬라이더 단계별 비교 OK)** |
| ~~STEP 3 수직 중앙 정렬~~                     | ❌ **revert 제거** (`1a4b960`, 2026-05-20)                                       |
| B-1차 제거 대칭화+폴백+감지버그               | ✅ 완료 / **실게임 검증 완료**                                                   |
| **B2 — applyBatch force 옵션 (scale 재변조)** | ✅ 완료 / 실게임 검증 완료. raw `2026-05-20-font-reapply-fixes.md` §1            |
| **B3 — GDI in-place reload (재부팅 불필요)**  | ✅ 완료 / 실게임 검증 완료. raw `2026-05-20-font-reapply-fixes.md` §2            |
| **§1.3 Kostar/Kodia STEP2-only 실측**         | ✅ 완료 / 실게임 검증 완료 (2026-05-20) — STEP3 영구 불필요 확정                 |

**STEP 3 revert 요약** (상세: raw 노트):
실게임 적용 시 Kostar가 라인박스 하단으로 박히는 회귀. 데이터 분석으로
_"cy=378 고정상수 강제"_ 전제가 게임 동작 모델과 어긋남을 확인 — 게임은
글자를 라인박스 정중앙도 본체 비율도 아닌 baseline+글리프 좌표대로 그림.
정상 동작 폰트들의 글리프 cy/비율이 너무 넓게 분포(35~76%)해 단일 임계값
알고리즘 불가. 단일 커밋 `eee6288` 전체 revert로 STEP3 코드·설정·UI 제거,
`font-implementation-plan.md`는 revert로 _"필요성 확인 후 조건부, 안
거슬리면 스킵"_ 상태(STEP3 진입 전)로 자연 복귀.

**릴리즈 전제 (전 항목 공통, 절대 잊지 말 것):**
STEP1·2 + B-1차가 전부 미릴리즈(`1.2.1` 이후 브랜치). **같은 첫 폰트
릴리즈에 묶어 내보내야** schema bump·HKLM→HKCU 이전 마이그레이션이
불필요. B-1차만 먼저 릴리즈하는 식의 분리 릴리즈는 재함정 — 묶음 필수.

---

## 1. STEP3 영구 폐기 vs 재설계 분기 실측 — ✅ 완료 (2026-05-20)

- **§1.1 빌드 패키징**: `FontMutatorWorker` `dist-electron/workers/`에
  281.03 kB 정상 번들 확인. WSL에선 `pwsh.exe`로 호출 (CLAUDE.md `## Commands`
  아래 WSL 규칙 박제됨).
- **§1.2 STEP2 크기보정 실측**: Spoqa 50/100/150% 슬라이더 단계별로
  캐릭터 선택창 닉네임 크기 단계별 변화 + 한글 정상 표시 스크린샷 3장.
- **§1.3 Kostar/Kodia STEP2-only 실측**: 둘 다 정상 → **STEP3 영구 불필요
  확정**. 분석문서 10.3 결론 _"본체 metrics 있으면 글리프 무변형으로 충분"_
  확정. `font-implementation-plan.md`의 STEP3 _"안 거슬리면 스킵"_ 상태
  그대로 유지. STEP3 재도입 금지 (raw `2026-05-20-font-step3-revert.md` §9 박제).
- §1.4(조건부 격자 변주 실험)는 §1.3 둘 다 정상으로 **진입 조건 미발생,
  철회**. 향후 새 폰트에서 처짐 보고되면 그때 raw §7.3 설계대로 재검토.

---

## 2. 미커밋 산출물 처리

- `scratch/*.mjs`(verify/poc/분석), `scratch/_*.json`, 폰트 파일:
  **discard 예정, 미커밋** (저작권/일회성). STEP3 분석 산출물 6종
  (`kostar_diff`, `vcenter_logic_check`, `box_ratio_check`,
  `distribution_scan`, `algo_proposal`, `glyph_normal_check`)도 동일 처리
  — 방법론은 raw 노트 §2와 `font-mutation-analysis.md` 11장에 박제됨.
- **B3 가설 검증 PS 스크립트 3종**: `restart-fontcache.ps1`(가설1 부정),
  `clear-user-fontcache.ps1`(가설2 부정), `proper-font-refresh.ps1`(✅
  정답 — RemoveFontResource 선행). discard 예정. 매트릭스는 raw
  `2026-05-20-font-reapply-fixes.md` §2.2에 박제.
- ~~`verify_vcenter.mjs`~~: STEP3 revert로 검증 대상 사라짐, 검증 목표
  자체가 잘못된 가정(raw §9.1)이라 재사용 금지.
- 커밋 대상: `docs/font-analysis/*.md`(분석·계획·역할조사·본 문서) +
  `src/` 코드 변경.

---

## 3. 다음 세션 박제 핵심 (raw §9 — 같은 함정 재진입 방지)

1. **round-trip 검증 ≠ 동작 정상성.** STEP3는 `verify_vcenter.mjs` 통과했으나
   실게임 회귀. 검증 기준(cy=378) 자체가 잘못된 목표였음.
2. **단일 정답값 일반화 금지.** 본체 한 점에서 측정한 값을 만능 기준으로
   박으면, 우연 차원에서 어긋난 폰트에서 회귀.
3. **샘플 폰트의 한계.** 배포자 손맛(폰트별 metrics 미세조정)이 들어가
   ground truth로 약함. 자체 실험 데이터 없이 일반 규칙 추론 불가.
4. **분석문서 10.3 _"본체 metrics 있으면 글리프 무변형으로 충분"_ 결론이
   옳았다.** 사후에 뒤집은 STEP3가 잘못된 갈래. 잔여작업 §1 가드(_"실게임
   검증 안 되면 완료로 못 박음"_)가 회귀 발견을 가능하게 함 — 유지.
5. **`AddFontResource`는 in-place reload 안 한다 (B3, raw §2).** 같은 경로
   폰트 파일은 ref count만 +1 됨. 새 metrics 반영하려면 `RemoveFontResource`
   를 ref count 0까지 호출 + `WM_FONTCHANGE` 브로드캐스트 + 200ms 대기 →
   삭제·복사 → 재등록 순서 필수. 재부팅이 동작했던 이유는 winlogon이 폰트
   디렉터리를 재enumerate 하면서 새 파일을 처음 본 것처럼 처리하기 때문.
6. **"X가 안 동작한다"의 전제부터 의심 (B3 사례).** 재부팅 필요 = 캐시 문제
   라는 직관에 끌려 FontCache 서비스/사용자 SID 캐시/PoE2 자체 캐시/DWrite
   collection까지 5개 가설 사망 후, 진짜 원인은 *캐시가 아니라 API가
   reload 안 하는 것*이었음. 가설 매트릭스로 차례차례 부정하는 절차가
   효과 있었음.
