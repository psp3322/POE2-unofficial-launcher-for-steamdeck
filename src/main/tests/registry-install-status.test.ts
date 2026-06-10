import { beforeEach, describe, expect, it, vi } from "vitest";

import { getGameInstallationStatus, isGameInstalled } from "../utils/registry";

import type { ChildProcess } from "node:child_process";

const mocks = vi.hoisted(() => ({
  execFile: vi.fn(),
  stat: vi.fn(),
  powershellExecute: vi.fn(),
  loggerWarn: vi.fn(),
}));

vi.mock("node:child_process", () => ({
  default: {
    execFile: mocks.execFile,
  },
  execFile: mocks.execFile,
}));

vi.mock("node:fs/promises", () => ({
  default: {
    stat: mocks.stat,
  },
}));

vi.mock("electron", () => ({
  app: {
    getPath: vi.fn(() => "C:\\test\\app.exe"),
    isPackaged: false,
  },
}));

vi.mock("../utils/logger", () => ({
  logger: {
    warn: mocks.loggerWarn,
    error: vi.fn(),
    log: vi.fn(),
  },
}));

vi.mock("../utils/powershell", () => ({
  PowerShellManager: {
    getInstance: () => ({
      execute: mocks.powershellExecute,
    }),
  },
}));

type RegQueryCallback = (
  error: (Error & { code?: number | string }) | null,
  stdout: string,
  stderr: string,
) => void;

type RegQueryImplementation = (
  command: string,
  args: string[],
  options: { windowsHide?: boolean; timeout?: number },
  callback: RegQueryCallback,
) => ChildProcess;

const mockRegQuery = (implementation: RegQueryImplementation) => {
  mocks.execFile.mockImplementation(implementation);
};

describe("registry install status", () => {
  beforeEach(() => {
    mocks.execFile.mockReset();
    mocks.stat.mockReset();
    mocks.powershellExecute.mockReset();
    mocks.loggerWarn.mockClear();
    mocks.powershellExecute.mockResolvedValue({
      stdout: "",
      stderr: "",
      code: 0,
    });
  });

  it("falls back to reg.exe when the PowerShell session cannot start", async () => {
    const installPath = String.raw`C:\Games\Path of Exile 2`;
    mocks.powershellExecute.mockRejectedValue(new Error("spawn EPERM"));
    mockRegQuery((_command, args, _options, callback) => {
      expect(args).toEqual([
        "query",
        "HKCU\\Software\\DaumGames\\POE2",
        "/v",
        "InstallPath",
      ]);
      callback(
        null,
        `
HKEY_CURRENT_USER\\Software\\DaumGames\\POE2
    InstallPath    REG_SZ    ${installPath}
`,
        "",
      );
      return {} as ChildProcess;
    });
    mocks.stat.mockResolvedValue({ isDirectory: () => true });

    await expect(
      getGameInstallationStatus("Kakao Games", "POE2"),
    ).resolves.toBe("installed");
    await expect(isGameInstalled("Kakao Games", "POE2")).resolves.toBe(true);

    expect(mocks.stat).toHaveBeenCalledWith(installPath);
  });

  it("returns unknown instead of uninstalled when registry access fails", async () => {
    mocks.powershellExecute.mockRejectedValue(new Error("spawn EPERM"));
    mockRegQuery((_command, _args, _options, callback) => {
      callback(
        Object.assign(new Error("spawn EPERM"), { code: "EPERM" }),
        "",
        "spawn EPERM",
      );
      return {} as ChildProcess;
    });

    await expect(
      getGameInstallationStatus("Kakao Games", "POE2"),
    ).resolves.toBe("unknown");
    await expect(isGameInstalled("Kakao Games", "POE2")).resolves.toBe(false);

    expect(mocks.stat).not.toHaveBeenCalled();
    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      expect.stringContaining("Could not determine installation status"),
    );
  });

  it("returns uninstalled when the registry value is absent", async () => {
    mocks.powershellExecute.mockResolvedValue({
      stdout: "",
      stderr: "",
      code: 0,
    });

    await expect(
      getGameInstallationStatus("Kakao Games", "POE2"),
    ).resolves.toBe("uninstalled");

    expect(mocks.execFile).not.toHaveBeenCalled();
    expect(mocks.stat).not.toHaveBeenCalled();
  });
});
