import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { Worker } from "node:worker_threads";

import { app } from "electron";
import opentype from "opentype.js";

import { SyncEngine, RemoteFontItem } from "./SyncEngine";
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
  private readonly syncEngine: SyncEngine;
  private fontsMap: Map<string, CustomFontData> = new Map();
  private remoteCatalog: RemoteFontItem[] = [];
  private initPromise: Promise<void>;

  private constructor() {
    this.customFontsDir = path.join(app.getPath("userData"), "CustomFonts");
    this.syncEngine = SyncEngine.getInstance();
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
    // 백그라운드에서 원격 카탈로그 동기화 시작
    this.syncWithRemote().catch((err) => {
      logger.error(`Background sync failed: ${err}`);
    });
  }

  /**
   * 원격 저장소와 카탈로그 동기화
   */
  public async syncWithRemote(force: boolean = false): Promise<void> {
    this.remoteCatalog = await this.syncEngine.fetchCatalog({ force });
    this.notifyRenderer();
  }

  public getCatalog(): RemoteFontItem[] {
    return this.remoteCatalog;
  }

  /**
   * 폰트 로드 (내부 전용)
   */
  private async addFontInternal(
    sourceFilePath: string,
    customAlias?: string,
    previewDataUrl: string = "",
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
              return reject(
                new Error("한글(KR) 글리프를 지원하지 않는 폰트입니다."),
              );
            }

            const originalName =
              font.names.fontFamily?.en ||
              font.names.fullName?.en ||
              "Unknown Font";

            // 별칭 중복 검증
            const aliasToUse = customAlias || originalName;
            const isDuplicate = Array.from(this.fontsMap.values()).some(
              (f) => f.alias === aliasToUse,
            );
            if (isDuplicate) {
              return reject(
                new Error(
                  `이미 '${aliasToUse}' 별칭을 가진 폰트가 존재합니다.`,
                ),
              );
            }

            const id = randomUUID();
            const extension = path.extname(sourceFilePath).toLowerCase();
            const newFileName = `${id}${extension}`;
            const destPath = path.join(this.customFontsDir, newFileName);

            try {
              await fs.copyFile(sourceFilePath, destPath);
              const now = Date.now();
              const data: CustomFontData = {
                id,
                alias: aliasToUse,
                fileName: newFileName,
                originalName,
                previewDataUrl: previewDataUrl,
                previewVersion: 2,
                createdAt: now,
                updatedAt: now,
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

  /**
   * 새 폰트 등록 (Public)
   */
  public async addFont(filePath: string, previewDataUrl: string = "") {
    await this.initPromise;
    return await this.addFontInternal(filePath, undefined, previewDataUrl);
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

      // 로드 완료 후 디스크 정리 수행
      this.cleanupOrphanedFiles();
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

    const servicesToCheck = Object.entries(TARGET_SERVICES_CONFIG).filter(
      ([service]) => !appliedStore[service],
    );

    if (servicesToCheck.length > 0) {
      const checkScript = servicesToCheck
        .flatMap(([service, targets]) =>
          targets.map(
            (t) =>
              `if (Get-ItemProperty -Path "HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts" -Name "${t} (TrueType)" -ErrorAction SilentlyContinue) { write-host "FOUND:${service}" }`,
          ),
        )
        .join("; ");

      const res = await pm.execute(checkScript, false, true);
      const output = res.stdout;
      servicesToCheck.forEach(([service]) => {
        if (output.includes(`FOUND:${service}`)) {
          unknownServices.push(service);
        }
      });
    }

    const baseFonts = Array.from(this.fontsMap.values()).map((f) => {
      const appliedServices = Object.entries(appliedStore)
        .filter(([_, id]) => id === f.id)
        .map(([svc]) => svc);
      // 모든 커스텀/원격 폰트는 isDefault를 false로 강제하여 관리 자유도 보장
      return { ...f, appliedServices, isDefault: false };
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
      isDefault: true, // 오직 가상 항목에만 플래그 유지
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
      // 가상 항목인 DEFAULT(기본값)를 항상 최상단에 배치
      if (a.id === "DEFAULT") return -1;
      if (b.id === "DEFAULT") return 1;
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

    // 중복 별칭 검증 (자기 자신 제외)
    const isDuplicate = Array.from(this.fontsMap.values()).some(
      (f) => f.alias === newAlias && f.id !== id && !f.isDefault,
    );
    if (isDuplicate) {
      throw new Error(`이미 '${newAlias}' 별칭을 가진 폰트가 존재합니다.`);
    }

    data.alias = newAlias;
    data.updatedAt = Date.now();
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
      if (!data) {
        // [New] 로컬에 없지만 원격 카탈로그에 있는 폰트인지 확인
        const remoteItem = this.remoteCatalog.find(
          (item) => item.id === fontId,
        );
        if (remoteItem) {
          logger.info(
            `Requested font ${remoteItem.alias} is remote. Starting automatic download...`,
          );
          const success = await this.syncEngine.downloadFont(
            remoteItem,
            (progress) => {
              // 렌더러로 진행률 브로드캐스트
              import("electron").then(({ BrowserWindow }) => {
                BrowserWindow.getAllWindows().forEach((win) => {
                  if (!win.isDestroyed())
                    win.webContents.send("font:download-progress", {
                      id: remoteItem.id,
                      progress,
                    });
                });
              });
            },
          );
          if (success) {
            // 다운로드 성공 시 메타데이터 생성 및 맵 갱신
            const now = new Date(remoteItem.createdAt).getTime();
            const newData: CustomFontData = {
              id: remoteItem.id,
              alias: remoteItem.alias,
              fileName: remoteItem.fileName,
              originalName: remoteItem.alias,
              previewDataUrl: this.syncEngine.getPreviewUrl(
                remoteItem.previewPath,
              ),
              previewVersion: 2,
              createdAt: now,
              updatedAt: Date.now(),
              isDefault: false,
            };
            await this.saveFontMetadata(newData);
          } else {
            logger.error(
              `Automatic download failed for ${remoteItem.alias}. Skipping assignment.`,
            );
            continue;
          }
        } else {
          continue;
        }
      }

      // 갱신된 맵에서 다시 가져옴
      const fontData = this.fontsMap.get(fontId);
      if (!fontData) continue;

      const sourcePath = path.join(this.customFontsDir, fontData.fileName);
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

  private async cleanupOrphanedFiles(): Promise<void> {
    await this.initPromise;
    const keptFiles: string[] = [];

    this.fontsMap.forEach((f) => {
      if (f.fileName) keptFiles.push(f.fileName);
      keptFiles.push(`${f.id}.json`);
    });

    await this.syncEngine.clearOrphaned(keptFiles);
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
}
