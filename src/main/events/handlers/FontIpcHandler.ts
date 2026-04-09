import fs from "node:fs/promises";

import { ipcMain } from "electron";

import { FontManager } from "../../services/FontManager";
import { Logger } from "../../utils/logger";

const logger = new Logger({ type: "ipc-font", typeColor: "#3498db" });

export class FontIpcHandler {
  private static registered = false;

  public static register() {
    if (this.registered) {
      logger.log("Font IPC Handlers already registered. Skipping.");
      return;
    }

    ipcMain.handle("font:get-fonts", () => {
      try {
        const fm = FontManager.getInstance();
        return fm.getFonts();
      } catch (err) {
        logger.error("Failed to get fonts", err);
        throw err;
      }
    });

    ipcMain.handle("font:get-unified-fonts", async () => {
      try {
        const fm = FontManager.getInstance();
        return await fm.getUnifiedFonts();
      } catch (err) {
        logger.error("Failed to get unified fonts", err);
        throw err;
      }
    });

    ipcMain.handle("font:get-catalog", () => {
      try {
        const fm = FontManager.getInstance();
        return fm.getCatalog();
      } catch (err) {
        logger.error("Failed to get catalog", err);
        throw err;
      }
    });

    ipcMain.handle("font:sync-catalog", async (_, force: boolean = false) => {
      try {
        const fm = FontManager.getInstance();
        await fm.syncWithRemote(force);
        return fm.getCatalog();
      } catch (err) {
        logger.error("Failed to sync font catalog", err);
        throw err;
      }
    });

    ipcMain.handle("font:read-file", async (_, filePath: string) => {
      try {
        const buffer = await fs.readFile(filePath);
        return buffer; // Uint8Array로 렌더러에 전달됨
      } catch (err) {
        logger.error("Failed to read font file", err);
        throw err;
      }
    });

    ipcMain.handle(
      "font:add-font",
      async (_, filePath: string, previewDataUrl?: string) => {
        try {
          if (!filePath) throw new Error("파일 경로가 유효하지 않습니다.");
          const fm = FontManager.getInstance();
          return await fm.addFont(filePath, previewDataUrl);
        } catch (err) {
          logger.error("Failed to add font", err);
          throw err;
        }
      },
    );

    ipcMain.handle("font:pick-file", async (event) => {
      const win = import("electron").then(({ BrowserWindow }) =>
        BrowserWindow.fromWebContents(event.sender),
      );
      const targetWin = await win;
      if (!targetWin) return null;

      const { dialog } = await import("electron");
      const { canceled, filePaths } = await dialog.showOpenDialog(targetWin, {
        title: "새 폰트 선택",
        filters: [{ name: "Font Files", extensions: ["ttf", "otf"] }],
        properties: ["openFile"],
      });

      if (canceled || filePaths.length === 0) return null;
      return filePaths[0];
    });

    ipcMain.handle("font:remove-font", async (_, id: string) => {
      try {
        const fm = FontManager.getInstance();
        await fm.removeFont(id);
      } catch (err) {
        logger.error(`Failed to remove font ${id}`, err);
        throw err;
      }
    });

    ipcMain.handle(
      "font:update-alias",
      async (_, id: string, newAlias: string) => {
        try {
          const fm = FontManager.getInstance();
          await fm.updateAlias(id, newAlias);
        } catch (err) {
          logger.error(`Failed to update alias for ${id}`, err);
          throw err;
        }
      },
    );

    ipcMain.handle(
      "font:apply-batch",
      async (_, assignments: Record<string, string | null>) => {
        try {
          const fm = FontManager.getInstance();
          await fm.applyBatch(assignments);
        } catch (err) {
          logger.error("Failed to apply batch fonts", err);
          throw err;
        }
      },
    );

    ipcMain.handle("font:open-folder", () => {
      const fm = FontManager.getInstance();
      fm.openCustomFontsFolder();
    });

    logger.log("Font IPC Handlers registered");
    this.registered = true;
  }
}
