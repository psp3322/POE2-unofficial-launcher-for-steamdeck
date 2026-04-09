import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { Worker } from "node:worker_threads";

import { createCanvas } from "canvas";
import { app } from "electron";
import opentype from "opentype.js";

import {
  FONT_MUTATION_DEFINITIONS,
  TARGET_SERVICES_CONFIG,
  FontMutationRule,
} from "../../shared/font-targets";
import { UnifiedFontData, CustomFontData } from "../../shared/types";
import { getConfig } from "../store";
import { setConfigWithEvent } from "../utils/config-utils";
import { Logger } from "../utils/logger";
import { PowerShellManager } from "../utils/powershell";

const logger = new Logger({ type: "font-manager", typeColor: "#f39c12" });

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

  /**
   * 런처 기본 제공 폰트 초기화 (manifest.json 기반)
   */
  private async initializeDefaultFonts() {
    logger.info("Initializing default fonts...");
    try {
      let defaultsDir = path.join(
        process.resourcesPath,
        "assets",
        "fonts",
        "defaults",
      );

      if (!app.isPackaged) {
        // [Development] Override with local source paths
        const devDirs = [
          path.join(
            app.getAppPath(),
            "src",
            "main",
            "assets",
            "fonts",
            "defaults",
          ),
          path.join(
            process.cwd(),
            "src",
            "main",
            "assets",
            "fonts",
            "defaults",
          ),
        ];

        for (const dir of devDirs) {
          try {
            await fs.access(dir);
            defaultsDir = dir;
            break;
          } catch {
            continue;
          }
        }
      }

      if (!defaultsDir) {
        logger.error(
          "Could not locate defaults font directory in any environment.",
        );
        return;
      }

      const manifestPath = path.join(defaultsDir, "manifest.json");
      try {
        await fs.access(manifestPath);
      } catch {
        logger.warn(`Manifest not found at: ${manifestPath}`);
        return;
      }

      const manifestContent = await fs.readFile(manifestPath, "utf-8");
      const manifest = JSON.parse(manifestContent) as {
        fileName: string;
        alias: string;
      }[];

      for (const item of manifest) {
        const fontFilePath = path.join(defaultsDir, item.fileName);
        const existing = Array.from(this.fontsMap.values()).find(
          (f) => f.alias === item.alias,
        );

        let needsSync = !existing;
        if (existing) {
          try {
            await fs.access(path.join(this.customFontsDir, existing.fileName));
          } catch {
            needsSync = true;
          }
        }

        if (needsSync) {
          try {
            await this.addFontInternal(fontFilePath, item.alias, true);
          } catch (err) {
            logger.error(`Failed to sync default font ${item.alias}: ${err}`);
          }
        }
      }
      this.notifyRenderer();
    } catch (err) {
      logger.error(`Error in initializeDefaultFonts: ${err}`);
    }
  }

  /**
   * 폰트 로드 (내부 전용)
   */
  private async addFontInternal(
    sourceFilePath: string,
    customAlias?: string,
    isDefault?: boolean,
  ): Promise<CustomFontData> {
    if (!sourceFilePath) throw new Error("유효하지 않은 파일 경로입니다.");

    try {
      await fs.access(sourceFilePath);
    } catch {
      throw new Error(`파일에 접근할 수 없습니다: ${sourceFilePath}`);
    }

    return new Promise((resolve, reject) => {
      try {
        opentype.load(
          sourceFilePath,
          async (err: Error | null, font: opentype.Font | undefined) => {
            if (err || !font)
              return reject(
                err || new Error("폰트 데이터를 파싱할 수 없습니다."),
              );

            // 한글 지원 체크
            if (
              !font.charToGlyph("가")?.unicode &&
              font.charToGlyph("가")?.index === 0
            ) {
              if (!isDefault)
                return reject(
                  new Error("한글(KR) 글리프를 지원하지 않는 폰트입니다."),
                );
            }

            const originalName =
              font.names.fontFamily?.en ||
              font.names.fullName?.en ||
              "Unknown Font";
            const previewDataUrl = this.generatePreviewPNG(font);

            const id = randomUUID();
            const extension = path.extname(sourceFilePath).toLowerCase();
            const newFileName = `${id}${extension}`;
            const destPath = path.join(this.customFontsDir, newFileName);

            try {
              await fs.copyFile(sourceFilePath, destPath);
              const data: CustomFontData = {
                id,
                alias: customAlias || originalName,
                fileName: newFileName,
                originalName,
                previewDataUrl,
                previewVersion: 2,
                createdAt: Date.now(),
                isDefault,
              };
              await this.saveFontMetadata(data);
              resolve(data);
            } catch (e) {
              reject(e);
            }
          },
        );
      } catch (e) {
        reject(e);
      }
    });
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

          // [Migration] 꼼꼼하게: 구버전 미리보기 자동 갱신
          if (!data.previewVersion || data.previewVersion < 2) {
            logger.log(`[Migration] Updating preview style for: ${data.alias}`);
            const fontFile = path.join(this.customFontsDir, data.fileName);
            try {
              await new Promise<void>((resolve, reject) => {
                opentype.load(
                  fontFile,
                  async (
                    err: Error | null,
                    font: opentype.Font | undefined,
                  ) => {
                    if (err || !font) return reject(err);
                    data.previewDataUrl = this.generatePreviewPNG(font);
                    data.previewVersion = 2;
                    await this.saveFontMetadata(data);
                    resolve();
                  },
                );
              });
            } catch (err) {
              logger.error(`Migration failed for ${data.alias}: ${err}`);
            }
          }

          this.fontsMap.set(data.id, data);
        }
      }
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
    import("electron").then(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows().forEach((win) => {
        if (!win.isDestroyed()) win.webContents.send("font:updated");
      });
    });
  }

  /**
   * 통합 폰트 리스트 조회 (UI용)
   */
  public async getUnifiedFonts(): Promise<UnifiedFontData[]> {
    await this.initPromise;
    const appliedStore =
      (getConfig("appliedFonts") as Record<string, string>) || {};
    const pm = PowerShellManager.getInstance();

    const unknownServices: string[] = [];
    for (const [service, targets] of Object.entries(TARGET_SERVICES_CONFIG)) {
      if (appliedStore[service]) continue;

      const checkScript = targets
        .map(
          (t) =>
            `Get-ItemProperty -Path "HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts" -Name "${t} (TrueType)" -ErrorAction SilentlyContinue`,
        )
        .join("; ");
      const res = await pm.execute(checkScript, false, true);
      if (res.stdout.trim()) {
        unknownServices.push(service);
      }
    }

    const baseFonts = Array.from(this.fontsMap.values()).map((f) => {
      const appliedServices = Object.entries(appliedStore)
        .filter(([_, id]) => id === f.id)
        .map(([svc]) => svc);
      return { ...f, appliedServices };
    });

    // 기본값 항목 추가
    const defaultAppliedServices = Object.entries(appliedStore)
      .filter(([_, id]) => id === "DEFAULT" || id === null)
      .map(([svc]) => svc);

    // 만약 특정 서비스에 할당된 폰트가 없다면 해당 서비스는 기본값에 추가됨
    const allServices = Object.keys(TARGET_SERVICES_CONFIG);
    allServices.forEach((s) => {
      if (!appliedStore[s] && !defaultAppliedServices.includes(s)) {
        defaultAppliedServices.push(s);
      }
    });

    baseFonts.unshift({
      id: "DEFAULT",
      alias: "기본값",
      originalName: "System Standard",
      fileName: "",
      previewDataUrl: "",
      createdAt: 0,
      isDefault: true,
      appliedServices: defaultAppliedServices,
    } as UnifiedFontData);

    if (unknownServices.length > 0) {
      baseFonts.push({
        id: "UNKNOWN_SYSTEM_FONT",
        alias: "알 수 없는 폰트",
        originalName: "System Assigned",
        fileName: "",
        previewDataUrl: "",
        createdAt: 0,
        isUnknown: true,
        appliedServices: unknownServices,
      } as UnifiedFontData);
    }

    return baseFonts.sort((a, b) => {
      if (a.isDefault && !b.isDefault) return -1;
      if (!a.isDefault && b.isDefault) return 1;
      return b.createdAt - a.createdAt;
    });
  }

  /**
   * 별명 수정
   */
  public async updateAlias(id: string, newAlias: string): Promise<void> {
    await this.initPromise;
    const data = this.fontsMap.get(id);
    if (!data) return;
    if (data.isDefault)
      throw new Error("기본 폰트의 이름은 수정할 수 없습니다.");

    data.alias = newAlias;
    await this.saveFontMetadata(data);
  }

  /**
   * 일괄 적용 (Batch Apply)
   */
  public async applyBatch(
    assignments: Record<string, string | null>,
  ): Promise<void> {
    await this.initPromise;
    const pm = PowerShellManager.getInstance();
    const currentApplied =
      (getConfig("appliedFonts") as Record<string, string>) || {};

    for (const [service, fontId] of Object.entries(assignments)) {
      const targetNames =
        TARGET_SERVICES_CONFIG[service as keyof typeof TARGET_SERVICES_CONFIG];

      if (!fontId || fontId === "DEFAULT") {
        for (const targetName of targetNames) {
          const ttfFileName = targetName.replace(/\s+/g, "") + ".ttf";
          await pm.removeSystemFont(targetName, ttfFileName);
        }
        delete currentApplied[service];
        continue;
      }

      if (fontId === currentApplied[service]) continue;

      const data = this.fontsMap.get(fontId);
      if (!data) continue;

      const sourcePath = path.join(this.customFontsDir, data.fileName);
      for (const targetName of targetNames) {
        const rule = FONT_MUTATION_DEFINITIONS[targetName];
        if (!rule) {
          logger.error(`No mutation rule found for target: ${targetName}`);
          continue;
        }

        const mutatedBuffer = await this.mutateFontName(sourcePath, rule);
        const tempPath = path.join(
          app.getPath("temp"),
          `poe2_${targetName.replace(/\s+/g, "_")}_${randomUUID().slice(0, 8)}.ttf`,
        );
        await fs.writeFile(tempPath, Buffer.from(mutatedBuffer));

        const ttfFileName = targetName.replace(/\s+/g, "") + ".ttf";
        const success = await pm.installSystemFont(
          tempPath,
          targetName,
          ttfFileName,
        );
        if (!success)
          logger.error(`Failed to install ${targetName} for ${service}`);

        fs.unlink(tempPath).catch(() => {});
      }
      currentApplied[service] = fontId;
    }

    setConfigWithEvent("appliedFonts", currentApplied);
    this.notifyRenderer();
    logger.info("Batch Font Apply completed.");
  }

  public async getFonts(): Promise<CustomFontData[]> {
    await this.initPromise;
    return Array.from(this.fontsMap.values()).sort(
      (a, b) => b.createdAt - a.createdAt,
    );
  }

  public async addFont(sourceFilePath: string): Promise<CustomFontData> {
    await this.initPromise;
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
      logger.error(`Failed to delete font files: ${err}`);
    }
    this.fontsMap.delete(id);
    this.notifyRenderer();
  }

  public openCustomFontsFolder(): void {
    import("electron").then((electron) =>
      electron.shell.openPath(this.customFontsDir),
    );
  }

  private mutateFontName(
    filePath: string,
    rule: FontMutationRule,
  ): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      // [Production] Base path for unpacked workers (Standard Case)
      let workerPath = path.join(
        app.getAppPath(),
        "..",
        "app.asar.unpacked",
        "dist-electron",
        "workers",
        "FontMutatorWorker.js",
      );

      if (!app.isPackaged) {
        // [Development] Adjacent to main bundle in dist-electron
        workerPath = path.join(__dirname, "workers", "FontMutatorWorker.js");
      }

      const worker = new Worker(workerPath);
      worker.postMessage({ filePath, rule });
      worker.on(
        "message",
        (msg: { success: boolean; buffer: ArrayBuffer; error?: string }) => {
          if (msg.success) resolve(msg.buffer);
          else reject(new Error(msg.error || "Mutation failed"));
          worker.terminate();
        },
      );
      worker.on("error", (err: Error) => {
        reject(err);
        worker.terminate();
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

      // 캔버스 배경은 투명하게 유지
      ctx.clearRect(0, 0, width, height);

      const x = 20;
      const y = 80;
      const fontPath = font.getPath(text, x, y, fontSize);

      // 1. 외곽선 스타일 설정
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 6;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";

      // 2. 패스를 직접 수동으로 그리기 (Stroke/Fill 분리 제어)
      ctx.beginPath();
      fontPath.commands.forEach((cmd: opentype.PathCommand) => {
        if (cmd.type === "M") ctx.moveTo(cmd.x, cmd.y);
        else if (cmd.type === "L") ctx.lineTo(cmd.x, cmd.y);
        else if (cmd.type === "C")
          ctx.bezierCurveTo(cmd.x1, cmd.y1, cmd.x2, cmd.y2, cmd.x, cmd.y);
        else if (cmd.type === "Q")
          ctx.quadraticCurveTo(cmd.x1, cmd.y1, cmd.x, cmd.y);
        else if (cmd.type === "Z") ctx.closePath();
      });

      // 흰색 외곽선 먼저 그리기
      ctx.stroke();

      // 내부 채우기 (어두운 배경 대비 가독성 확보)
      ctx.fillStyle = "#1a1a1a";
      ctx.fill();

      return canvas.toDataURL("image/png");
    } catch (e) {
      logger.error(`Failed to generate preview PNG: ${e}`);
      return "";
    }
  }
}
