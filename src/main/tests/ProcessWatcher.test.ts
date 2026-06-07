import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { eventBus } from "../events/EventBus";
import { EventType, type AppContext } from "../events/types";
import { ProcessWatcher } from "../services/ProcessWatcher";
import {
  getGameStatus,
  resetGameStatusCacheForTests,
  updateGameStatusCache,
} from "../state/GameStatusStore";
import * as processUtils from "../utils/process";

vi.mock("../events/EventBus", () => ({
  eventBus: {
    emit: vi.fn(),
  },
}));

vi.mock("../utils/process", () => ({
  getProcessesInfo: vi.fn(),
}));

const createContext = (): AppContext =>
  ({
    mainWindow: { isFocused: () => false },
    debugWindow: null,
    getConfig: (key?: string) =>
      key === "processWatchMode" ? "resource-saving" : undefined,
  }) as AppContext;

describe("ProcessWatcher suspension", () => {
  beforeEach(() => {
    resetGameStatusCacheForTests();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-07T00:00:00.000Z"));
    vi.mocked(processUtils.getProcessesInfo).mockResolvedValue([]);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("keeps watching while a launch flow is still active", async () => {
    updateGameStatusCache({
      gameId: "POE2",
      serviceId: "Kakao Games",
      status: "authenticating",
    });

    const watcher = new ProcessWatcher(createContext());
    const stopWatching = vi.spyOn(watcher, "stopWatching");

    watcher.scheduleSuspension();
    await vi.advanceTimersByTimeAsync(60 * 1000);

    expect(stopWatching).not.toHaveBeenCalled();
    expect(getGameStatus("POE2", "Kakao Games").status).toBe("authenticating");
  });

  it("releases a stale running status when no matching process exists", async () => {
    updateGameStatusCache({
      gameId: "POE2",
      serviceId: "Kakao Games",
      status: "running",
    });

    const watcher = new ProcessWatcher(createContext());

    watcher.scheduleSuspension();
    await vi.advanceTimersByTimeAsync(60 * 1000);

    expect(getGameStatus("POE2", "Kakao Games").status).toBe("idle");
    expect(eventBus.emit).toHaveBeenCalledWith(
      EventType.GAME_STATUS_CHANGE,
      expect.anything(),
      expect.objectContaining({
        gameId: "POE2",
        serviceId: "Kakao Games",
        status: "idle",
      }),
    );
  });

  it("passes inferred game context to process criteria", async () => {
    vi.mocked(processUtils.getProcessesInfo).mockResolvedValue([
      {
        pid: 77,
        name: "POE2_Launcher.exe",
        path: "",
      },
    ]);

    const watcher = new ProcessWatcher(createContext());
    const criteria = vi.fn(() => true);

    watcher.startWatching();
    await vi.waitFor(() => {
      expect(watcher.isProcessRunning("POE2_Launcher.exe")).toBe(true);
    });

    expect(watcher.isProcessRunning("POE2_Launcher.exe", criteria)).toBe(true);
    expect(criteria).toHaveBeenCalledWith(
      expect.objectContaining({
        pid: 77,
        name: "POE2_Launcher.exe",
        gameId: "POE2",
        serviceId: "Kakao Games",
      }),
    );

    watcher.stopWatching();
  });
});
