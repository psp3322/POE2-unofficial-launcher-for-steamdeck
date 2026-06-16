import { describe, expect, it } from "vitest";

import {
  getKakaoGameStartUrlCandidates,
  getKakaoPrimaryBaseUrl,
  getKakaoUrlPhase,
  isKakaoLauncherUrl,
  isKakaoMemberUrl,
  isKakaoPoeHomeUrl,
  isKakaoSecurityCenterUrl,
  isKakaoStarterInstallPopupUrl,
  KAKAO_SERVICE_TRANSITION_CLEANUP_PR_AFTER,
  KAKAO_SERVICE_TRANSITION_EFFECTIVE_AT,
  KAKAO_SERVICE_TRANSITION_NOTICE_URL,
} from "../../shared/kakao-service-transition";

describe("kakao service transition policy", () => {
  it("documents the official transition notice and cleanup review date", () => {
    expect(KAKAO_SERVICE_TRANSITION_NOTICE_URL).toBe(
      "https://poe.game.daum.net/forum/view-thread/3931700",
    );
    expect(KAKAO_SERVICE_TRANSITION_EFFECTIVE_AT).toBe(
      "2026-06-17T10:00:00+09:00",
    );
    expect(KAKAO_SERVICE_TRANSITION_CLEANUP_PR_AFTER).toBe(
      "2026-06-18T00:00:00+09:00",
    );
  });

  /* kakao-transition:legacy-start */
  it("prefers ASIS URLs before the service transfer", () => {
    const candidates = getKakaoGameStartUrlCandidates(
      "POE2",
      new Date("2026-06-17T09:59:59+09:00"),
    );

    expect(candidates.map((candidate) => candidate.phase)).toEqual([
      "asis",
      "tobe",
    ]);
    expect(candidates[0].url).toBe(
      "https://pathofexile2.game.daum.net/main#autoStart",
    );
    expect(getKakaoPrimaryBaseUrl("POE2", candidatesDate("before"))).toBe(
      "https://pathofexile2.game.daum.net",
    );
  });
  /* kakao-transition:legacy-end */

  it("prefers TOBE URLs after the service transfer and keeps ASIS as fallback", () => {
    const candidates = getKakaoGameStartUrlCandidates(
      "POE1",
      new Date("2026-06-17T10:00:00+09:00"),
    );

    expect(candidates[0].phase).toBe("tobe");
    expect(candidates[0].url).toBe("https://kakaogames.com#autoStart");

    /* kakao-transition:legacy-start */
    expect(candidates[1].phase).toBe("asis");
    expect(candidates[1].url).toBe("https://poe.game.daum.net#autoStart");
    /* kakao-transition:legacy-end */

    expect(getKakaoPrimaryBaseUrl("POE1", candidatesDate("after"))).toBe(
      "https://kakaogames.com",
    );
  });

  it("recognizes TOBE homepage hosts and transition fallback homepage hosts", () => {
    expect(isKakaoPoeHomeUrl(new URL("https://kakaogames.com/main"))).toBe(
      true,
    );
    expect(getKakaoUrlPhase(new URL("https://kakaogames.com/main"))).toBe(
      "tobe",
    );

    /* kakao-transition:legacy-start */
    expect(
      isKakaoPoeHomeUrl(new URL("https://pathofexile2.game.daum.net/main")),
    ).toBe(true);
    expect(getKakaoUrlPhase(new URL("https://poe.game.daum.net/login"))).toBe(
      "asis",
    );
    /* kakao-transition:legacy-end */
  });

  it("recognizes known TOBE infrastructure hosts and ASIS fallback hosts", () => {
    expect(isKakaoLauncherUrl(new URL("https://pubsvc.kakaogames.com/x"))).toBe(
      true,
    );

    /* kakao-transition:legacy-start */
    expect(isKakaoLauncherUrl(new URL("https://pubsvc.game.daum.net/x"))).toBe(
      true,
    );
    expect(
      isKakaoSecurityCenterUrl(
        new URL("https://security-center.game.daum.net"),
      ),
    ).toBe(true);
    /* kakao-transition:legacy-end */

    expect(isKakaoMemberUrl(new URL("https://member.kakaogames.com"))).toBe(
      true,
    );
  });

  it("recognizes Daum and Kakao Games starter install popups", () => {
    expect(
      isKakaoStarterInstallPopupUrl(
        new URL(
          "https://security-center.game.daum.net/popup/install_daumstarter",
        ),
      ),
    ).toBe(true);
    expect(
      isKakaoStarterInstallPopupUrl(
        new URL(
          "https://security-center.kakaogames.com/popup/install_kakaogamesstarter",
        ),
      ),
    ).toBe(true);
    expect(
      isKakaoStarterInstallPopupUrl(
        new URL(
          "https://member.kakaogames.com/popup/install_kakaogamesstarter",
        ),
      ),
    ).toBe(false);
  });
});

function candidatesDate(phase: "before" | "after") {
  return new Date(
    phase === "before"
      ? "2026-06-17T09:59:59+09:00"
      : "2026-06-17T10:00:00+09:00",
  );
}
