import { beforeEach, describe, expect, it, vi } from "vitest";

import { eventBus } from "../events/EventBus";
import { GameInstallCheckHandler } from "../events/handlers/GameInstallCheckHandler";
import {
  EventType,
  type AppContext,
  type ConfigChangeEvent,
} from "../events/types";
import { getGameInstallationStatus } from "../utils/registry";

const mocks = vi.hoisted(() => ({
  getGameInstallationStatus: vi.fn(),
}));

vi.mock("../events/EventBus", () => ({
  eventBus: {
    emit: vi.fn(),
  },
}));

vi.mock("../utils/registry", () => ({
  getGameInstallationStatus: mocks.getGameInstallationStatus,
}));

const configChangeEvent: ConfigChangeEvent = {
  type: EventType.CONFIG_CHANGE,
  payload: {
    key: "activeGame",
    oldValue: "POE1",
    newValue: "POE2",
  },
};

describe("GameInstallCheckHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("emits a blocked install-check status when installation status is unknown", async () => {
    vi.mocked(getGameInstallationStatus).mockResolvedValue("unknown");

    const context = {
      getConfig: vi.fn(() => ({
        activeGame: "POE2",
        serviceChannel: "Kakao Games",
      })),
      processWatcher: {
        isProcessRunning: vi.fn(() => false),
      },
    } as unknown as AppContext;

    await GameInstallCheckHandler.handle(configChangeEvent, context);

    expect(eventBus.emit).toHaveBeenCalledWith(
      EventType.GAME_STATUS_CHANGE,
      context,
      {
        gameId: "POE2",
        serviceId: "Kakao Games",
        status: "install_check_blocked",
        errorCode: "INSTALL_CHECK_UNKNOWN",
      },
    );
  });
});
