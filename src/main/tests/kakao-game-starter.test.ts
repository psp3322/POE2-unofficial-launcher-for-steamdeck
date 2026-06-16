import { describe, expect, it } from "vitest";

import {
  extractStarterExePath,
  isAnyStarterRunAsInvokerEnabled,
  isStarterMissingRunAsInvoker,
  resolveInstalledKakaoGameStarters,
  type KakaoGameStarterUacStatus,
} from "../utils/uac/kakao-game-starter";

describe("Kakao game starter resolver", () => {
  it("extracts quoted and unquoted executable paths from protocol commands", () => {
    expect(
      extractStarterExePath(
        '"C:\\Users\\Default\\AppData\\Roaming\\KakaoGames\\KakaogamesStarter.exe" "%1" ',
      ),
    ).toBe(
      "C:\\Users\\Default\\AppData\\Roaming\\KakaoGames\\KakaogamesStarter.exe",
    );

    expect(
      extractStarterExePath(
        'C:\\Users\\Default\\AppData\\Roaming\\DaumGames\\DaumGameStarter.exe "%1"',
      ),
    ).toBe(
      "C:\\Users\\Default\\AppData\\Roaming\\DaumGames\\DaumGameStarter.exe",
    );
  });

  it("resolves installed Kakao Games and Daum starter protocol commands", async () => {
    const registryValues = new Map<string, string>([
      [
        "HKLM:\\Software\\Classes\\KakaogamesStarter\\shell\\open\\command",
        'C:\\Users\\Default\\AppData\\Roaming\\KakaoGames\\KakaogamesStarter.exe "%1"',
      ],
      [
        "HKCU:\\Software\\Classes\\daumgamestarter\\shell\\open\\command",
        'C:\\Users\\Default\\AppData\\Roaming\\DaumGames\\DaumGameStarter.exe "%1"',
      ],
    ]);

    const starters = await resolveInstalledKakaoGameStarters(
      async (key) => registryValues.get(key) ?? null,
      () => true,
    );

    expect(starters.map((starter) => starter.id)).toEqual([
      "kakaogames",
      "daum",
    ]);
    expect(starters[0].exePath).toBe(
      "C:\\Users\\Default\\AppData\\Roaming\\KakaoGames\\KakaogamesStarter.exe",
    );
    expect(starters[1].exePath).toBe(
      "C:\\Users\\Default\\AppData\\Roaming\\DaumGames\\DaumGameStarter.exe",
    );
  });

  it("falls back to the known install path when registry lookup is missing", async () => {
    const starters = await resolveInstalledKakaoGameStarters(
      async () => null,
      (path) => path.includes("\\KakaoGames\\KakaogamesStarter.exe"),
    );

    expect(starters).toEqual([
      {
        id: "kakaogames",
        label: "KakaogamesStarter",
        exePath:
          "C:\\Users\\Default\\AppData\\Roaming\\KakaoGames\\KakaogamesStarter.exe",
        source: "fallback",
      },
    ]);
  });

  it("ignores legacy proxy commands and missing executable paths", async () => {
    const registryValues = new Map<string, string>([
      [
        "HKCU:\\Software\\Classes\\KakaogamesStarter\\shell\\open\\command",
        '"C:\\Windows\\System32\\wscript.exe" "proxy.vbs" "%1"',
      ],
      [
        "HKCU:\\Software\\Classes\\daumgamestarter\\shell\\open\\command",
        'C:\\Missing\\DaumGameStarter.exe "%1"',
      ],
    ]);

    const starters = await resolveInstalledKakaoGameStarters(
      async (key) => registryValues.get(key) ?? null,
      () => false,
    );

    expect(starters).toEqual([]);
  });

  it("treats UAC bypass as enabled when either starter has RUNASINVOKER", () => {
    const statuses: KakaoGameStarterUacStatus[] = [
      createStarterStatus("kakaogames", false),
      createStarterStatus("daum", true),
    ];

    expect(isAnyStarterRunAsInvokerEnabled(statuses)).toBe(true);
  });

  it("detects only the requested installed starter as missing RUNASINVOKER", () => {
    const statuses: KakaoGameStarterUacStatus[] = [
      createStarterStatus("kakaogames", false),
      createStarterStatus("daum", true),
    ];

    expect(isStarterMissingRunAsInvoker(statuses, "kakaogames")).toBe(true);
    expect(isStarterMissingRunAsInvoker(statuses, "daum")).toBe(false);
  });
});

function createStarterStatus(
  id: "kakaogames" | "daum",
  runAsInvokerEnabled: boolean,
): KakaoGameStarterUacStatus {
  const label = id === "kakaogames" ? "KakaogamesStarter" : "DaumGameStarter";

  return {
    id,
    label,
    exePath: `C:\\Users\\Default\\AppData\\Roaming\\${label}\\${label}.exe`,
    source: "test",
    runAsInvokerEnabled,
  };
}
