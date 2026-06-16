import { existsSync } from "fs";

export type KakaoGameStarterId = "kakaogames" | "daum";

export type KakaoGameStarterDefinition = {
  id: KakaoGameStarterId;
  label: string;
  protocol: string;
  protocolCommandKeys: readonly string[];
  fallbackExePath: string;
};

export type ResolvedKakaoGameStarter = {
  id: KakaoGameStarterId;
  label: string;
  exePath: string;
  source: string;
};

export type KakaoGameStarterUacStatus = ResolvedKakaoGameStarter & {
  runAsInvokerEnabled: boolean;
};

export type RegistryReader = (
  path: string,
  name?: string,
) => Promise<string | null>;

export type PathExists = (path: string) => boolean;

export const KAKAO_GAME_STARTERS = [
  {
    id: "kakaogames",
    label: "KakaogamesStarter",
    protocol: "KakaogamesStarter",
    protocolCommandKeys: [
      "HKCU:\\Software\\Classes\\KakaogamesStarter\\shell\\open\\command",
      "HKLM:\\Software\\Classes\\KakaogamesStarter\\shell\\open\\command",
      "Registry::HKEY_CLASSES_ROOT\\KakaogamesStarter\\shell\\open\\command",
    ],
    fallbackExePath:
      "C:\\Users\\Default\\AppData\\Roaming\\KakaoGames\\KakaogamesStarter.exe",
  },
  {
    id: "daum",
    label: "DaumGameStarter",
    protocol: "daumgamestarter",
    protocolCommandKeys: [
      "HKCU:\\Software\\Classes\\daumgamestarter\\shell\\open\\command",
      "HKLM:\\Software\\Classes\\DaumGameStarter\\shell\\open\\command",
      "Registry::HKEY_CLASSES_ROOT\\daumgamestarter\\shell\\open\\command",
    ],
    fallbackExePath:
      "C:\\Users\\Default\\AppData\\Roaming\\DaumGames\\DaumGameStarter.exe",
  },
] as const satisfies readonly KakaoGameStarterDefinition[];

export function extractStarterExePath(command: string): string | null {
  const trimmed = command.trim();
  if (!trimmed) return null;

  const quoted = trimmed.match(/^"([^"]+?\.exe)"/i);
  if (quoted?.[1]) return quoted[1];

  const unquoted = trimmed.match(/^(.+?\.exe)(?:\s|$)/i);
  return unquoted?.[1]?.trim() || null;
}

export async function resolveInstalledKakaoGameStarters(
  readRegistryValue: RegistryReader,
  pathExists: PathExists = existsSync,
): Promise<ResolvedKakaoGameStarter[]> {
  const resolved: ResolvedKakaoGameStarter[] = [];
  const seenPaths = new Set<string>();

  for (const starter of KAKAO_GAME_STARTERS) {
    const candidate = await resolveStarterExecutable(
      starter,
      readRegistryValue,
      pathExists,
    );

    if (!candidate) continue;

    const dedupeKey = candidate.exePath.toLowerCase();
    if (seenPaths.has(dedupeKey)) continue;

    seenPaths.add(dedupeKey);
    resolved.push(candidate);
  }

  return resolved;
}

export function isAnyStarterRunAsInvokerEnabled(
  statuses: readonly KakaoGameStarterUacStatus[],
): boolean {
  return statuses.some((starter) => starter.runAsInvokerEnabled);
}

export function isStarterMissingRunAsInvoker(
  statuses: readonly KakaoGameStarterUacStatus[],
  id: KakaoGameStarterId,
): boolean {
  return statuses.some(
    (starter) => starter.id === id && !starter.runAsInvokerEnabled,
  );
}

async function resolveStarterExecutable(
  starter: KakaoGameStarterDefinition,
  readRegistryValue: RegistryReader,
  pathExists: PathExists,
): Promise<ResolvedKakaoGameStarter | null> {
  for (const key of starter.protocolCommandKeys) {
    const command = await readRegistryValue(key);
    const exePath = command ? extractStarterExePath(command) : null;

    if (exePath && isUsableStarterPath(exePath) && pathExists(exePath)) {
      return {
        id: starter.id,
        label: starter.label,
        exePath,
        source: key,
      };
    }
  }

  if (pathExists(starter.fallbackExePath)) {
    return {
      id: starter.id,
      label: starter.label,
      exePath: starter.fallbackExePath,
      source: "fallback",
    };
  }

  return null;
}

function isUsableStarterPath(exePath: string): boolean {
  const normalized = exePath.toLowerCase();
  return normalized.endsWith(".exe") && !normalized.includes("wscript.exe");
}
