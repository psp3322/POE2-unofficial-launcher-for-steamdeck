import * as fs from "node:fs";
import * as fsp from "node:fs/promises";

import { logger } from "./logger";
import { isWineEnvironment } from "./wine";

/**
 * [SteamDeck] Decky Lossless Scaling(lsfg-vk) 프레임 생성을 런처에서
 * 켜고 끄기 위한 설정 관리.
 *
 * lsfg-vk는 리눅스 쪽 ~/.config/lsfg-vk/conf.toml 의 [[game]] 항목과
 * 일치하는 프로세스에만 활성화된다. 이 파일을 Z: 드라이브로 편집해서
 * 게임 클라이언트(exe)만 등록/해제한다 — 스팀 실행옵션의 전역 래퍼와
 * 달리 런처(Electron)는 후킹하지 않으므로 크래시가 없다.
 *
 * 이 모듈은 마커 주석 사이의 블록만 소유하므로, 사용자가 conf.toml에
 * 직접 추가한 다른 게임 설정은 건드리지 않는다.
 */

const MANAGED_BEGIN =
  "# >>> poe2-unofficial-launcher managed block (do not edit)";
const MANAGED_END = "# <<< poe2-unofficial-launcher managed block";

// 카카오 클라이언트 두 이름 모두 등록 (POE1/POE2 공용)
const GAME_EXECUTABLES = ["PathOfExile_KG.exe", "PathOfExile_x64_KG.exe"];

export interface LsfgApplyResult {
  ok: boolean;
  installed: boolean;
  configPath?: string;
  error?: string;
}

const findLinuxHomeZPath = (): string | null => {
  // Wine은 리눅스 환경변수를 그대로 물려주므로 HOME이 /home/... 형태로 보인다
  const envHome = process.env.HOME;
  if (envHome && envHome.startsWith("/")) {
    const zPath = `Z:${envHome.replace(/\//g, "\\")}`;
    if (fs.existsSync(zPath)) return zPath;
  }

  const deckHome = "Z:\\home\\deck";
  if (fs.existsSync(deckHome)) return deckHome;

  try {
    for (const entry of fs.readdirSync("Z:\\home")) {
      const candidate = `Z:\\home\\${entry}`;
      if (fs.existsSync(`${candidate}\\.config`)) return candidate;
    }
  } catch {
    // Z:\home 접근 불가
  }

  return null;
};

/** lsfg-vk(Decky 플러그인 또는 수동 설치)가 시스템에 있는지 확인 */
export const isLsfgVkInstalled = (): boolean => {
  if (!isWineEnvironment()) return false;
  const home = findLinuxHomeZPath();
  if (!home) return false;

  return (
    fs.existsSync(`${home}\\.config\\lsfg-vk`) ||
    fs.existsSync(
      `${home}\\.local\\share\\vulkan\\implicit_layer.d\\lsfg-vk.json`,
    ) ||
    fs.existsSync(`${home}\\.local\\lib\\liblsfg-vk.so`)
  );
};

const stripManagedBlock = (content: string): string => {
  const lines = content.split(/\r?\n/);
  const result: string[] = [];
  let inManaged = false;
  for (const line of lines) {
    if (line.trim() === MANAGED_BEGIN) {
      inManaged = true;
      continue;
    }
    if (line.trim() === MANAGED_END) {
      inManaged = false;
      continue;
    }
    if (!inManaged) result.push(line);
  }
  // 꼬리 빈 줄 정리
  while (result.length > 0 && result[result.length - 1].trim() === "") {
    result.pop();
  }
  return result.join("\n");
};

const buildManagedBlock = (multiplier: number): string => {
  const entries = GAME_EXECUTABLES.map((exe) =>
    [`[[game]]`, `exe = "${exe}"`, `multiplier = ${multiplier}`].join("\n"),
  ).join("\n\n");
  return `${MANAGED_BEGIN}\n${entries}\n${MANAGED_END}\n`;
};

/**
 * conf.toml에 게임 항목을 등록(enabled=true)하거나 제거(enabled=false)한다.
 */
export const applyLsfgConfig = async (
  enabled: boolean,
  multiplier: number,
): Promise<LsfgApplyResult> => {
  if (!isWineEnvironment()) {
    return {
      ok: false,
      installed: false,
      error: "스팀덱(Wine/Proton) 환경에서만 사용할 수 있습니다.",
    };
  }

  const home = findLinuxHomeZPath();
  if (!home) {
    return {
      ok: false,
      installed: false,
      error: "리눅스 홈 디렉터리(Z:\\home\\...)를 찾지 못했습니다.",
    };
  }

  const installed = isLsfgVkInstalled();
  const configDir = `${home}\\.config\\lsfg-vk`;
  const configPath = `${configDir}\\conf.toml`;

  try {
    let existing = "";
    try {
      existing = await fsp.readFile(configPath, "utf8");
    } catch {
      // 파일 없음 — 새로 만든다
    }

    let next = stripManagedBlock(existing);

    if (enabled) {
      // 새 파일이면 lsfg-vk 설정 스키마 버전 명시
      if (next.trim() === "") {
        next = "version = 1";
      }
      next = `${next}\n\n${buildManagedBlock(multiplier)}`;
    }

    await fsp.mkdir(configDir, { recursive: true });
    await fsp.writeFile(configPath, `${next.trimEnd()}\n`, "utf8");

    logger.log(
      `[LsfgConfig] ${enabled ? `Enabled (x${multiplier})` : "Disabled"} for ${GAME_EXECUTABLES.join(", ")} at ${configPath} (lsfg-vk installed: ${installed})`,
    );

    return { ok: true, installed, configPath };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`[LsfgConfig] Failed to update ${configPath}: ${message}`);
    return { ok: false, installed, configPath, error: message };
  }
};
