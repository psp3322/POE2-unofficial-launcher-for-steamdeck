# Kakao Games Service Transition

Official notice: <https://poe.game.daum.net/forum/view-thread/3931700>

## Timeline

- 2026-06-17 07:00-10:00 KST: Kakao Games service transfer maintenance.
- 2026-06-17 10:00 KST: The launcher should prefer TOBE Kakao Games URLs.
- 2026-06-18 00:00 KST or later: Open an automatic cleanup PR for ASIS Daum URL fallback review.

## Confirmed From The Notice

- The service platform changes from Daum Games to Kakao Games.
- The announced new platform URL is `kakaogames.com`.
- The existing Daum Game Starter cannot launch games after the service transfer.
- A new Kakao Games Starter may be required.
- Users may need to accept terms or complete identity verification once.

## Current Constraint

As of 2026-06-09, the notice does not publish stable PoE1/PoE2 game-specific
TOBE start URLs. The Kakao Games company/game listing still points PoE2 to the
existing Daum URL. Some candidate infrastructure hosts already respond, such as
`pubsvc.kakaogames.com` and `member.kakaogames.com`, but game homepage routing is
not confirmed enough to remove ASIS fallback immediately.

## Runtime Decision

`src/shared/kakao-service-transition.ts` is the transition policy source.

- Before 2026-06-17 10:00 KST, use ASIS Daum start URLs first and TOBE as a fallback.
- After 2026-06-17 10:00 KST, use TOBE Kakao Games start URLs first and ASIS as a fallback.
- The preload host matchers accept both TOBE hosts and ASIS fallback hosts during the transition.
- If a start page loads but the expected start button is not found within the observer timeout, preload asks main to retry the next URL candidate.
- If all URL candidates are exhausted, the existing Kakao start failure dump/archive/log path handles the failure.

## Automatic Cleanup PR

`.github/workflows/kakao-transition-cleanup-pr.yml` opens a cleanup PR after the
review date, or immediately when manually dispatched.

The PR is opened regardless of URL check pass/fail. The PR body includes:

- ASIS PoE1 URL check result
- ASIS PoE2 URL check result
- TOBE PoE1 URL check result
- TOBE PoE2 URL check result
- Final URL after redirects
- Whether expected PoE page text was found
- Manual verification checklist

The workflow does not merge automatically.

## Manual Verification Still Required

GitHub Actions cannot verify the Windows-only game start path end to end.
Before merging the cleanup PR, verify manually:

- PoE1 Kakao game start
- PoE2 Kakao game start
- Login-required flow
- Terms or identity verification flow if shown
- Kakao Games Starter handoff
- Actual game process launch

## Environment Overrides For URL Check

`scripts/check-kakao-transition-urls.cjs` accepts these optional environment
variables when the exact TOBE URLs become known:

- `KAKAO_TOBE_POE1_URL`
- `KAKAO_TOBE_POE2_URL`
- `KAKAO_TOBE_POE1_START_URL`
- `KAKAO_TOBE_POE2_START_URL`
- `KAKAO_ASIS_POE1_URL`
- `KAKAO_ASIS_POE2_URL`
- `KAKAO_ASIS_POE1_START_URL`
- `KAKAO_ASIS_POE2_START_URL`

`*_START_URL` overrides the full checked start URL. `*_URL` is treated as a base
URL and the launcher's start path/hash is appended.
