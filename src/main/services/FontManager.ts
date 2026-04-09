import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { Worker } from "node:worker_threads";

import { createCanvas } from "canvas";
import { app } from "electron";
import opentype from "opentype.js";

import { AppConfig, CustomFontData } from "../../shared/types";
import { getConfig } from "../store";
import { setConfigWithEvent } from "../utils/config-utils";
import { Logger } from "../utils/logger";
import { PowerShellManager } from "../utils/powershell";

const logger = new Logger({ type: "font-manager", typeColor: "#f39c12" });

const TARGET_FONTS = {
  GGG: ["Fontin"], // We will overwrite 'Fontin'
  "Kakao Games": ["Noto Sans CJK TC Book", "Spoqa Han Sans Neo Regular"],
};
export class FontManager {
  private static instance: FontManager;
  private readonly customFontsDir: string;
  private fontsMap: Map<string, CustomFontData> = new Map();
  private initPromise: Promise<void>;

  private constructor() {
    this.customFontsDir = path.join(app.getPath("userData"), "CustomFonts");
    this.initPromise = this.ensureDirectory().catch((err) => {
      logger.error(`Failed to ensure CustomFonts directory: ${err}`);
    });
  }

  public static getInstance(): FontManager {
    if (!FontManager.instance) {
      FontManager.instance = new FontManager();
    }
    return FontManager.instance;
  }

  private async ensureDirectory() {
    try {
      await fs.access(this.customFontsDir);
    } catch {
      await fs.mkdir(this.customFontsDir, { recursive: true });
    }
    await this.loadFontsFromDisk();
    await this.initializeDefaultFonts();
  }

  private async initializeDefaultFonts() {
    logger.info("Initializing default fonts...");
    try {
      // Possible directories for default fonts
      const possibleDirs = [
        // Production: process.resourcesPath/assets
        path.join(process.resourcesPath, "assets", "fonts", "defaults"),
        // Development: appPath/src/main/assets
        path.join(
          app.getAppPath(),
          "src",
          "main",
          "assets",
          "fonts",
          "defaults",
        ),
        // Fallback Development: CWD/src/main/assets
        path.join(process.cwd(), "src", "main", "assets", "fonts", "defaults"),
      ];

      let defaultsDir = "";
      for (const dir of possibleDirs) {
        try {
          await fs.access(dir);
          defaultsDir = dir;
          logger.info(`Found default fonts directory: ${defaultsDir}`);
          break;
        } catch {
          continue;
        }
      }

      if (!defaultsDir) {
        logger.warn(
          "Could not find default fonts directory in any expected location.",
        );
        return;
      }

      const manifestPath = path.join(defaultsDir, "manifest.json");

      try {
        await fs.access(manifestPath);
      } catch {
        logger.info(
          `No default fonts manifest found at ${manifestPath}. Skipping.`,
        );
        return;
      }

      const manifestContent = await fs.readFile(manifestPath, "utf-8");
      const manifest = JSON.parse(manifestContent) as {
        fileName: string;
        alias: string;
      }[];
      logger.info(`Manifest loaded with ${manifest.length} fonts.`);

      for (const item of manifest) {
        const fontFilePath = path.join(defaultsDir, item.fileName);

        // Find existing match by alias
        const existing = Array.from(this.fontsMap.values()).find(
          (f) => f.alias === item.alias,
        );

        let needsSync = !existing;
        if (existing) {
          try {
            await fs.access(path.join(this.customFontsDir, existing.fileName));
          } catch {
            logger.warn(
              `Font file missing for ${existing.alias}, re-syncing...`,
            );
            needsSync = true;
          }
        }

        if (needsSync) {
          logger.info(`Syncing default font: ${item.alias} (${item.fileName})`);
          try {
            await this.addFontInternal(fontFilePath, item.alias, true);
            logger.info(`Successfully synced: ${item.alias}`);
          } catch (err) {
            logger.error(
              `Failed to initialize default font ${item.alias}: ${err}`,
            );
          }
        } else {
          logger.log(`Default font ${item.alias} already synced.`);
        }
      }

      logger.info("Default fonts initialization complete.");
      this.notifyRenderer();
    } catch (err) {
      logger.error(`Error in initializeDefaultFonts: ${err}`);
    }
  }

  /**
   * Internal version of addFont that allows custom alias
   */
  private async addFontInternal(
    sourceFilePath: string,
    customAlias?: string,
    isDefault?: boolean,
  ): Promise<CustomFontData> {
    const font = await new Promise<opentype.Font>((resolve, reject) => {
      opentype.load(sourceFilePath, (err, font) => {
        if (err || !font) reject(err || new Error("Failed to load font."));
        else resolve(font);
      });
    });

    // Verify Korean glyph Support ("가")
    if (
      !font.charToGlyph("가")?.unicode &&
      font.charToGlyph("가")?.index === 0
    ) {
      throw new Error("선택한 폰트는 한글(KR) 글리프를 지원하지 않습니다.");
    }

    // Attempt extract preview PNG
    const originalName =
      font.names.fontFamily?.en || font.names.fullName?.en || "Unknown Font";
    const previewDataUrl = this.generatePreviewPNG(font);

    const id = randomUUID();
    const extension = path.extname(sourceFilePath).toLowerCase();
    const newFileName = `${id}${extension}`;
    const destPath = path.join(this.customFontsDir, newFileName);

    await fs.copyFile(sourceFilePath, destPath);

    const data: CustomFontData = {
      id,
      alias: customAlias || originalName,
      fileName: newFileName,
      originalName,
      previewDataUrl,
      createdAt: Date.now(),
      isDefault,
    };

    await this.saveFontMetadata(data);
    return data;
  }

  private async loadFontsFromDisk() {
    try {
      const files = await fs.readdir(this.customFontsDir);
      for (const file of files) {
        if (file.endsWith(".json")) {
          const content = await fs.readFile(
            path.join(this.customFontsDir, file),
            "utf-8",
          );
          const data = JSON.parse(content) as CustomFontData;
          this.fontsMap.set(data.id, data);
        }
      }
      logger.info(`Loaded ${this.fontsMap.size} custom fonts.`);
    } catch (err) {
      logger.error(`Error loading fonts from disk: ${err}`);
    }
  }

  private async saveFontMetadata(data: CustomFontData) {
    const filePath = path.join(this.customFontsDir, `${data.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
    this.fontsMap.set(data.id, data);
    this.notifyRenderer();
  }

  private notifyRenderer() {
    import("electron")
      .then(({ BrowserWindow }) => {
        BrowserWindow.getAllWindows().forEach((win) => {
          if (!win.isDestroyed()) {
            win.webContents.send("font:updated");
          }
        });
      })
      .catch((err) => logger.error(`Failed to notify renderer: ${err}`));
  }

  public async getFonts(): Promise<CustomFontData[]> {
    await this.initPromise;
    return Array.from(this.fontsMap.values()).sort(
      (a, b) => b.createdAt - a.createdAt,
    );
  }

  public async addFont(sourceFilePath: string): Promise<CustomFontData> {
    await this.initPromise;
    logger.info(`Adding new font from: ${sourceFilePath}`);
    return this.addFontInternal(sourceFilePath);
  }

  public async removeFont(id: string): Promise<void> {
    await this.initPromise;
    const data = this.fontsMap.get(id);
    if (!data) return;

    try {
      await fs.unlink(path.join(this.customFontsDir, data.fileName));
      await fs.unlink(path.join(this.customFontsDir, `${data.id}.json`));
    } catch (err) {
      logger.error(`Failed to delete files for font ${id}: ${err}`);
    }

    this.fontsMap.delete(id);
  }

  public async applyFont(
    service: AppConfig["serviceChannel"],
    fontId: string,
  ): Promise<void> {
    await this.initPromise;
    const data = this.fontsMap.get(fontId);
    if (!data) throw new Error("등록되지 않은 폰트입니다.");

    const sourcePath = path.join(this.customFontsDir, data.fileName);
    const targetNames = TARGET_FONTS[service];
    const pm = PowerShellManager.getInstance();

    for (const targetName of targetNames) {
      logger.info(`Mutating font for target: ${targetName}...`);
      const mutatedBuffer = await this.mutateFontName(sourcePath, targetName);

      const tempPath = path.join(
        app.getPath("temp"),
        `poe2_mutated_${targetName.replace(/\s+/g, "_")}.ttf`,
      );
      await fs.writeFile(tempPath, Buffer.from(mutatedBuffer));

      logger.info(`Installing mutated font: ${targetName}`);
      const ttfFileName = targetName.replace(/\s+/g, "") + ".ttf";
      const success = await pm.installSystemFont(
        tempPath,
        targetName,
        ttfFileName,
      );
      if (!success) {
        throw new Error(`폰트 설치 실패: ${targetName}`);
      }
    }

    // Save applied font state
    const appliedFonts =
      (getConfig("appliedFonts") as Record<string, string>) || {};
    appliedFonts[service] = fontId;
    setConfigWithEvent("appliedFonts", appliedFonts);

    logger.info(`Successfully applied custom font for ${service}.`);
  }

  public async restoreFont(
    service: AppConfig["serviceChannel"],
  ): Promise<void> {
    await this.initPromise;
    logger.info(`Restoring default fonts for ${service}...`);
    const targetNames = TARGET_FONTS[service];
    const pm = PowerShellManager.getInstance();

    for (const targetName of targetNames) {
      const ttfFileName = targetName.replace(/\s+/g, "") + ".ttf";
      const success = await pm.removeSystemFont(targetName, ttfFileName);
      if (!success) {
        throw new Error(`기본 폰트 복구 실패: ${targetName}`);
      }
    }

    // Remove applied font state
    const appliedFonts =
      (getConfig("appliedFonts") as Record<string, string>) || {};
    delete appliedFonts[service];
    setConfigWithEvent("appliedFonts", appliedFonts);

    logger.info(`Successfully restored default fonts.`);
  }

  public openCustomFontsFolder(): void {
    import("electron").then((electron) => {
      electron.shell.openPath(this.customFontsDir);
    });
  }

  private mutateFontName(
    filePath: string,
    newName: string,
  ): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const workerPath = path.join(
        __dirname,
        "workers",
        "FontMutatorWorker.js",
      );
      logger.info(`Spawning font mutator worker: ${workerPath}`);

      const worker = new Worker(workerPath);

      worker.postMessage({ filePath, newName });

      worker.on("message", (msg) => {
        if (msg.success) {
          resolve(msg.buffer);
        } else {
          reject(
            new Error(msg.error || "Worker failed without error message."),
          );
        }
        worker.terminate();
      });

      worker.on("error", (err) => {
        reject(err);
        worker.terminate();
      });

      worker.on("exit", (code) => {
        if (code !== 0) {
          reject(new Error(`Worker exited with code ${code}`));
        }
      });
    });
  }

  private generatePreviewPNG(font: opentype.Font): string {
    try {
      const text = "패스오브액자일2 - 한글 테스트";
      const fontSize = 48;

      const width = 800;
      const height = 120;
      const canvas = createCanvas(width, height);
      const ctx = canvas.getContext("2d");

      ctx.fillStyle = "transparent";
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = "#ffffff";

      const path = font.getPath(text, 20, 80, fontSize);
      // @ts-expect-error draw expects a CanvasRenderingContext2D which ours implements, but types may mismatch
      path.draw(ctx);

      return canvas.toDataURL("image/png");
    } catch (e) {
      logger.error(`Failed to generate preview PNG: ${e}`);
      return "";
    }
  }
}
