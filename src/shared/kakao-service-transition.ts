import type { AppConfig } from "./types";

export type KakaoGameId = Extract<AppConfig["activeGame"], "POE1" | "POE2">;
export type KakaoTransitionUrlPhase = "asis" | "tobe";

export type KakaoTransitionUrlCandidate = {
  gameId: KakaoGameId;
  phase: KakaoTransitionUrlPhase;
  url: string;
};

export const KAKAO_SERVICE_TRANSITION_NOTICE_URL =
  "https://poe.game.daum.net/forum/view-thread/3931700";

export const KAKAO_SERVICE_TRANSITION_EFFECTIVE_AT =
  "2026-06-17T10:00:00+09:00";

export const KAKAO_SERVICE_TRANSITION_CLEANUP_PR_AFTER =
  "2026-06-18T00:00:00+09:00";

export const KAKAO_SERVICE_TRANSITION_DECISIONS = [
  "The official notice identifies kakaogames.com as the new platform URL, but does not publish stable game-specific PoE1/PoE2 start URLs before the transfer.",
  "The launcher keeps ASIS Daum URLs as a transition fallback and prefers TOBE URLs after 2026-06-17 10:00 KST.",
  "The cleanup workflow opens a PR regardless of ASIS/TOBE URL check results; Windows game-start verification remains manual before merge.",
] as const;

const KAKAO_GAME_START_PATHS = {
  POE1: "#autoStart",
  POE2: "/main#autoStart",
} satisfies Record<KakaoGameId, string>;

export const KAKAO_TOBE_BASE_URLS = {
  POE1: "https://kakaogames.com",
  POE2: "https://kakaogames.com",
} satisfies Record<KakaoGameId, string>;

const KAKAO_TOBE_HOME_HOSTS = {
  POE1: ["kakaogames.com", "www.kakaogames.com", "poe.kakaogames.com"],
  POE2: ["kakaogames.com", "www.kakaogames.com", "poe.kakaogames.com"],
} satisfies Record<KakaoGameId, readonly string[]>;

const KAKAO_TOBE_INFRA_HOSTS = {
  launcher: ["pubsvc.kakaogames.com"],
  securityCenter: ["security-center.kakaogames.com"],
  member: ["member.kakaogames.com"],
} satisfies Record<string, readonly string[]>;

/* kakao-transition:legacy-start */
export const KAKAO_ASIS_BASE_URLS = {
  POE1: "https://poe.game.daum.net",
  POE2: "https://pathofexile2.game.daum.net",
} satisfies Record<KakaoGameId, string>;

export const KAKAO_TRANSITION_LEGACY_FALLBACK_ENABLED = true;

const KAKAO_ASIS_HOME_HOSTS = {
  POE1: ["poe.game.daum.net"],
  POE2: ["pathofexile2.game.daum.net"],
} satisfies Record<KakaoGameId, readonly string[]>;

const KAKAO_ASIS_INFRA_HOSTS = {
  launcher: ["pubsvc.game.daum.net"],
  securityCenter: ["security-center.game.daum.net"],
  member: ["member.game.daum.net"],
} satisfies Record<string, readonly string[]>;
/* kakao-transition:legacy-end */

export function isKakaoServiceTransitionEffective(now = new Date()): boolean {
  return (
    now.getTime() >= new Date(KAKAO_SERVICE_TRANSITION_EFFECTIVE_AT).getTime()
  );
}

export function getKakaoPrimaryBaseUrl(
  gameId: KakaoGameId,
  now = new Date(),
): string {
  /* kakao-transition:legacy-start */
  if (!isKakaoServiceTransitionEffective(now)) {
    return KAKAO_ASIS_BASE_URLS[gameId];
  }
  /* kakao-transition:legacy-end */

  return KAKAO_TOBE_BASE_URLS[gameId];
}

export function getKakaoGameStartUrlCandidates(
  gameId: KakaoGameId,
  now = new Date(),
): KakaoTransitionUrlCandidate[] {
  const tobe = createUrlCandidate(gameId, "tobe", KAKAO_TOBE_BASE_URLS[gameId]);

  /* kakao-transition:legacy-start */
  if (KAKAO_TRANSITION_LEGACY_FALLBACK_ENABLED) {
    const asis = createUrlCandidate(
      gameId,
      "asis",
      KAKAO_ASIS_BASE_URLS[gameId],
    );

    return isKakaoServiceTransitionEffective(now) ? [tobe, asis] : [asis, tobe];
  }
  /* kakao-transition:legacy-end */

  return [tobe];
}

export function isKakaoPoeHomeUrl(url: URL, gameId?: KakaoGameId): boolean {
  return getKakaoUrlPhase(url, gameId) !== null;
}

export function getKakaoUrlPhase(
  url: URL,
  gameId?: KakaoGameId,
): KakaoTransitionUrlPhase | null {
  for (const id of getGameIds(gameId)) {
    const hosts = KAKAO_TOBE_HOME_HOSTS[id];
    if (hosts.includes(url.hostname)) return "tobe";

    /* kakao-transition:legacy-start */
    if (KAKAO_ASIS_HOME_HOSTS[id].includes(url.hostname)) return "asis";
    /* kakao-transition:legacy-end */
  }

  return null;
}

export function isKakaoLauncherUrl(url: URL): boolean {
  if (KAKAO_TOBE_INFRA_HOSTS.launcher.includes(url.hostname)) return true;

  /* kakao-transition:legacy-start */
  if (KAKAO_ASIS_INFRA_HOSTS.launcher.includes(url.hostname)) return true;
  /* kakao-transition:legacy-end */

  return false;
}

export function isKakaoSecurityCenterUrl(url: URL): boolean {
  if (KAKAO_TOBE_INFRA_HOSTS.securityCenter.includes(url.hostname)) return true;

  /* kakao-transition:legacy-start */
  if (KAKAO_ASIS_INFRA_HOSTS.securityCenter.includes(url.hostname)) return true;
  /* kakao-transition:legacy-end */

  return false;
}

export function isKakaoMemberUrl(url: URL): boolean {
  if (KAKAO_TOBE_INFRA_HOSTS.member.includes(url.hostname)) return true;

  /* kakao-transition:legacy-start */
  if (KAKAO_ASIS_INFRA_HOSTS.member.includes(url.hostname)) return true;
  /* kakao-transition:legacy-end */

  return false;
}

export function isKakaoGameLoginRedirectUrl(url: URL): boolean {
  return isKakaoPoeHomeUrl(url) && url.pathname.includes("/login");
}

export function isKakaoStarterInstallPopupUrl(url: URL): boolean {
  if (!isKakaoSecurityCenterUrl(url)) return false;

  const pathname = url.pathname.toLowerCase();
  return pathname.includes("/popup/") && pathname.includes("starter");
}

function createUrlCandidate(
  gameId: KakaoGameId,
  phase: KakaoTransitionUrlPhase,
  baseUrl: string,
): KakaoTransitionUrlCandidate {
  return {
    gameId,
    phase,
    url: `${baseUrl.replace(/\/$/, "")}${KAKAO_GAME_START_PATHS[gameId]}`,
  };
}

function getGameIds(gameId?: KakaoGameId): readonly KakaoGameId[] {
  return gameId ? [gameId] : ["POE1", "POE2"];
}
