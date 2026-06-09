import { describe, expect, it, vi } from "vitest";

import {
  isPowerShellBlockedReason,
  PowerShellBlockedException,
  PowerShellManager,
} from "../utils/powershell";

type PendingResponse = {
  stdout: string;
  stderr: string;
  code: number | null;
};

type PendingCallback = (res: PendingResponse) => void;
type PowerShellSession = Parameters<PowerShellManager["executeCommand"]>[1];

describe("PowerShell blocked diagnostics", () => {
  it("detects OS-level spawn permission failures", () => {
    const error = Object.assign(new Error("spawn EPERM"), { code: "EPERM" });

    expect(isPowerShellBlockedReason(error)).toBe(true);
  });

  it("detects common Windows policy block messages", () => {
    expect(
      isPowerShellBlockedReason(
        "This program is blocked by group policy. For more information, contact your system administrator.",
      ),
    ).toBe(true);
    expect(
      isPowerShellBlockedReason(
        "File cannot be loaded because running scripts is disabled on this system.",
      ),
    ).toBe(true);
    expect(isPowerShellBlockedReason("액세스가 거부되었습니다.")).toBe(true);
    expect(
      isPowerShellBlockedReason(
        "이 시스템에서 스크립트를 실행할 수 없으므로 파일을 로드할 수 없습니다.",
      ),
    ).toBe(true);
  });

  it("includes likely security causes in the thrown error", () => {
    const error = new PowerShellBlockedException("spawn EPERM");

    expect(error.name).toBe("PowerShellBlockedException");
    expect(error.message).toContain("백신/EDR");
    expect(error.message).toContain("Windows 보안 정책");
    expect(error.message).toContain("spawn EPERM");
  });

  it("throws when a PowerShell command result indicates a policy block", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const session = {
      server: {},
      socket: {
        destroyed: false,
        write: vi.fn((_payload: string, callback?: (error?: Error) => void) => {
          callback?.();
        }),
      },
      process: null,
      pendingRequests: new Map<string, PendingCallback>(),
      pipePath: null,
      initializing: null,
      rejectInit: undefined,
    } as unknown as PowerShellSession & {
      pendingRequests: Map<string, PendingCallback>;
    };

    const result = PowerShellManager.getInstance().executeCommand(
      "Get-Item HKCU:\\Software",
      session,
      false,
      true,
    );
    await Promise.resolve();
    const callback = [...session.pendingRequests.values()][0];
    if (!callback) throw new Error("PowerShell request was not queued.");

    callback({
      stdout: "",
      stderr: "This program is blocked by group policy.",
      code: 1,
    });

    await expect(result).rejects.toThrow(PowerShellBlockedException);
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining("[process_normal]"),
      expect.stringContaining("백신/EDR"),
    );

    consoleError.mockRestore();
  });
});
