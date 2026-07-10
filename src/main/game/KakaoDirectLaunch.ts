import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

import { AppConfig } from "../../shared/types";
import { AppContext } from "../events/types";
import { logger } from "../utils/logger";
import { getGameInstallPath } from "../utils/registry";

/**
 * [SteamDeck] 카카오 스타터 없이 게임을 직접 실행하는 우회 경로.
 *
 * Windows에서는 웹페이지가 발생시키는 kakaogamesstarter:// 프로토콜을
 * OS에 등록된 KakaoGamesStarter.exe가 받아 게임을 실행한다. Wine/Proton
 * 프리픽스에는 스타터가 설치되어 있지 않아 이 핸드오프가 조용히 실패하고
 * 자동화가 "지연 발생"으로 멈춘다.
 *
 * 이 모듈은 프로토콜 URL을 런처가 직접 가로채 페이로드
 * (gameCode|gameStatus|execute|token|userCode)를 파싱하고, 게임 실행
 * 파일을 --kakao 토큰 인자와 함께 직접 실행한다.
 * (poe1/poe2-kakao-launcher에서 스팀덱 실기기로 검증된 방식)
 */

const STARTER_SCHEME_PREFIXES = ["kakaogamesstarter://", "daumgamestarter://"];

// 페이로드의 execute 힌트가 비어있거나 신뢰할 수 없을 때 시도할 실행 파일
const KAKAO_EXECUTABLE_FALLBACKS = [
  "PathOfExile_KG.exe",
  "PathOfExile_x64_KG.exe",
];

export const isKakaoStarterUrl = (url: string): boolean =>
  STARTER_SCHEME_PREFIXES.some((prefix) => url.startsWith(prefix));

export const launchKakaoGameDirect = async (
  context: AppContext,
  url: string,
): Promise<boolean> => {
  let payload = decodeURIComponent(url);
  for (const prefix of STARTER_SCHEME_PREFIXES) {
    payload = payload.replace(prefix, "");
  }

  const [gameCode, gameStatus, executeHint, token, userCode] =
    payload.split("|");
  logger.log(
    `[KakaoDirectLaunch] Intercepted starter protocol: game=${gameCode}, status=${gameStatus}, exe=${executeHint}`,
  );

  if (!token || !userCode) {
    logger.error(
      "[KakaoDirectLaunch] Missing token/userCode in starter payload; cannot launch directly.",
    );
    return false;
  }

  // 실행 대상 게임은 게임 시작 흐름이 설정한 활성 게임을 따른다
  const config = context.getConfig() as AppConfig;
  const gameId = config.activeGame;

  const installPath = await getGameInstallPath("Kakao Games", gameId);
  if (!installPath) {
    logger.error(
      `[KakaoDirectLaunch] Install path not resolved for Kakao Games/${gameId}.`,
    );
    return false;
  }

  const candidates = [
    ...(executeHint && executeHint.toLowerCase().endsWith(".exe")
      ? [executeHint]
      : []),
    ...KAKAO_EXECUTABLE_FALLBACKS,
  ];
  const executable = candidates.find((name) =>
    fs.existsSync(path.win32.join(installPath, name)),
  );

  if (!executable) {
    logger.error(
      `[KakaoDirectLaunch] No known game executable found in ${installPath} (tried: ${candidates.join(", ")})`,
    );
    return false;
  }

  const executablePath = path.win32.join(installPath, executable);
  logger.log(
    `[KakaoDirectLaunch] Launching ${executablePath} with Kakao token (direct, no starter)`,
  );

  const child = spawn(executablePath, ["--kakao", token, userCode], {
    cwd: installPath,
    stdio: "ignore",
  });
  const startedAt = Date.now();
  child.on("error", (error) => {
    logger.error(`[KakaoDirectLaunch] Failed to spawn game: ${error.message}`);
  });
  child.on("exit", (code, signal) => {
    const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);
    logger.log(
      `[KakaoDirectLaunch] Game process exited (code=${code}, signal=${signal}) after ${elapsedSec}s`,
    );
    // 클라이언트가 자기 자신을 재실행하고 빠지는 정상 케이스도 있으므로,
    // 짧게 종료된 경우에만 게임 로그 꼬리를 남겨 원인(토큰 만료, 게이트웨이,
    // 크래시 등)을 디버그 콘솔에서 바로 볼 수 있게 한다.
    if (Date.now() - startedAt < 60000) {
      logGameClientLogTail(installPath);
    }
  });

  return true;
};

const GAME_CLIENT_LOG_CANDIDATES = [
  "logs\\KakaoClient.txt",
  "logs\\Client.txt",
];
const LOG_TAIL_LINES = 30;

const logGameClientLogTail = (installPath: string): void => {
  for (const relative of GAME_CLIENT_LOG_CANDIDATES) {
    const logPath = path.win32.join(installPath, relative);
    try {
      if (!fs.existsSync(logPath)) continue;
      const content = fs.readFileSync(logPath, "utf8");
      const lines = content.split(/\r?\n/).filter(Boolean);
      const tail = lines.slice(-LOG_TAIL_LINES).join("\n");
      logger.log(
        `[KakaoDirectLaunch] --- ${relative} (마지막 ${LOG_TAIL_LINES}줄) ---\n${tail}`,
      );
      return;
    } catch (error) {
      logger.warn(
        `[KakaoDirectLaunch] Unable to read game log ${logPath}: ${String(error)}`,
      );
    }
  }
  logger.warn(
    `[KakaoDirectLaunch] No game client log found under ${installPath}\\logs`,
  );
};
