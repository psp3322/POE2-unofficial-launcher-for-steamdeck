import { ipcMain } from "electron";
import { FontManager } from "../services/FontManager";
import { AppConfig } from "../../shared/types";
import { Logger } from "../utils/logger";

const logger = new Logger({ type: "ipc-font", typeColor: "#3498db" });

export class FontIpcHandler {
  public static register() {
    ipcMain.handle("font:get-fonts", () => {
      try {
        const fm = FontManager.getInstance();
        return fm.getFonts();
      } catch (err) {
        logger.error("Failed to get fonts", err);
        throw err;
      }
    });

    ipcMain.handle("font:add-font", async (_, filePath: string) => {
      try {
        const fm = FontManager.getInstance();
        return await fm.addFont(filePath);
      } catch (err) {
        logger.error("Failed to add font", err);
        throw err; // Renderer will catch and show error toast
      }
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
      "font:apply-font",
      async (_, service: AppConfig["serviceChannel"], fontId: string) => {
        try {
          const fm = FontManager.getInstance();
          await fm.applyFont(service, fontId);
        } catch (err) {
          logger.error(`Failed to apply font ${fontId} to ${service}`, err);
          throw err;
        }
      },
    );

    ipcMain.handle(
      "font:restore-font",
      async (_, service: AppConfig["serviceChannel"]) => {
        try {
          const fm = FontManager.getInstance();
          await fm.restoreFont(service);
        } catch (err) {
          logger.error(`Failed to restore font for ${service}`, err);
          throw err;
        }
      },
    );

    ipcMain.handle("font:open-folder", () => {
      const fm = FontManager.getInstance();
      fm.openCustomFontsFolder();
    });
    
    logger.log("Font IPC Handlers registered");
  }
}
