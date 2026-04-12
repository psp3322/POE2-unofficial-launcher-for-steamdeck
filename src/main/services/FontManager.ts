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

export interface AddFontOptions {
  filePath: string;
  customAlias?: string;
  previewDataUrl?: string;
  remoteSourceId?: string | null;
}

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
   * 폰트 로드 및 메타데이터 추출 (로컬 썸네일 생성 포함)
   */
  public async extractMetadata(filePath: string): Promise<{
    originalName: string;
    previewDataUrl: string;
  }> {
    return new Promise((resolve, reject) => {
      opentype.load(filePath, (err, font) => {
        if (err || !font) {
          logger.error(
            `Failed to load font file for metadata: ${filePath}`,
            err,
          );
          return reject(new Error("유효하지 않은 폰트 파일입니다."));
        }

        // [v13] 한국어 이름 우선 추출, 없으면 영어, 최후엔 파일명
        const originalName =
          font.names.fontFamily?.ko ||
          font.names.fontFamily?.en ||
          font.names.fullName?.ko ||
          font.names.fullName?.en ||
          path.basename(filePath, path.extname(filePath));

        // [v14] 즉석에서 로컬 SVG 썸네일 생성
        const previewDataUrl = this.generateFontThumbnail(font);

        resolve({
          originalName,
          previewDataUrl,
        });
      });
    });
  }

  /**
   * opentype.js를 활용하여 폰트 실물에서 SVG 썸네일 생성
   */
  private generateFontThumbnail(font: opentype.Font): string {
    try {
      // [v14.1] 사용자 요청 텍스트로 변경
      const text = "Path Of Exile - 패스 오브 액자일";
      const fontSize = 28; // 문구가 길어졌으므로 폰트 크기 살짝 조정
      const x = 10;
      const y = 40;

      const pathData = font.getPath(text, x, y, fontSize);
      const svgPath = pathData.toSVG();

      // 뷰박스 확장 (문구가 길어짐에 따라 너비 확보)
      const width = 500;
      const height = 60;

      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        <rect width="100%" height="100%" fill="transparent" />
        ${svgPath.replace('fill="black"', 'fill="white"')}
      </svg>`;

      return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
    } catch (err) {
      logger.warn("Failed to generate font thumbnail from binary", err);
      return "";
    }
  }

  private async addFontInternal(
    options: AddFontOptions,
  ): Promise<CustomFontData> {
    const { filePath, customAlias, previewDataUrl, remoteSourceId } = options;
    await this.initPromise;
    if (!filePath) throw new Error("유효하지 않은 파일 경로입니다.");

    try {
      await fs.access(filePath);
    } catch {
      throw new Error(`파일에 접근할 수 없습니다: ${filePath}`);
    }

    return new Promise((resolve, reject) => {
      try {
        opentype.load(
          filePath,
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

            // [v13] 한국어 이름 우선 추출
            const originalName =
              font.names.fontFamily?.ko ||
              font.names.fontFamily?.en ||
              font.names.fullName?.ko ||
              font.names.fullName?.en ||
              "Unknown Font";

            // [v11] 중복 체크 (로컬 이름 기준)
            const existing = Array.from(this.fontsMap.values()).find(
              (f) => f.originalName === originalName,
            );

            if (existing) {
              logger.info(
                `Font '${originalName}' already exists. Refusing duplicate.`,
              );
              return reject(
                new Error(
                  `동일한 폰트('${originalName}')가 이미 라이브러리에 등록되어 있습니다.`,
                ),
              );
            }

            const id = randomUUID();
            const extension = path.extname(filePath).toLowerCase();
            const newFileName = `${id}${extension}`;
            const destPath = path.join(this.customFontsDir, newFileName);

            try {
              await fs.copyFile(filePath, destPath);

              // [v14] 서버 프리뷰가 있더라도 로컬에서 직접 추출한 썸네일을 우선 사용
              const localPreview = this.generateFontThumbnail(font);

              const now = Date.now();
              const data: CustomFontData = {
                id,
                alias: customAlias || originalName,
                fileName: newFileName,
                originalName,
                previewDataUrl: localPreview || previewDataUrl || "",
                previewVersion: 2,
                createdAt: now,
                updatedAt: now,
                remoteSourceId: remoteSourceId || undefined,
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
  public async addFont(
    filePath: string,
    previewDataUrl?: string,
    customAlias?: string,
    remoteSourceId?: string | null,
  ) {
    return await this.addFontInternal({
      filePath,
      previewDataUrl,
      customAlias,
      remoteSourceId,
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

    // [고도화] 별칭 중복 고유성 제한 해제
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

    const currentLang = (getConfig("language") as string) || "ko";

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
          const remoteName =
            remoteItem.displayNames[currentLang] ||
            remoteItem.displayNames.en ||
            remoteItem.id;
          logger.info(
            `Requested font ${remoteName} is remote. Starting automatic download...`,
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
            // [v11] 서버 ID를 remoteSourceId로 전달하여 등록
            const downloadedPath = path.join(
              this.customFontsDir,
              remoteItem.fileName,
            );
            try {
              await this.addFontInternal({
                filePath: downloadedPath,
                previewDataUrl: this.syncEngine.getPreviewUrl(
                  remoteItem.previewPath,
                ),
                customAlias: remoteName,
                remoteSourceId: remoteItem.id,
              });
            } catch (err) {
              logger.error(`Failed to integrate downloaded font: ${err}`);
            }
          } else {
            logger.error(
              `Automatic download failed for ${remoteName}. Skipping assignment.`,
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

  /**
   * 원격 폰트 다운로드 후 로컬 라이브러리에 설치 (통합 워크플로우 전용)
   */
  public async downloadAndInstallRemoteFont(
    item: RemoteFontItem,
    customAlias?: string,
  ): Promise<CustomFontData> {
    await this.initPromise;
    const currentLang = (getConfig("language") as string) || "ko";
    const remoteName =
      item.displayNames[currentLang] || item.displayNames.en || item.id;

    try {
      logger.info(
        `Starting intentional download for '${remoteName}' (Target Alias: ${customAlias || remoteName})...`,
      );

      // 1. 파일 다운로드
      const success = await this.syncEngine.downloadFont(item, (progress) => {
        this.notifyDownloadProgress(item.id, progress);
      });

      if (!success) {
        throw new Error(`폰트 다운로드에 실패했습니다: ${remoteName}`);
      }

      const downloadedPath = path.join(this.customFontsDir, item.fileName);

      // [v14] 객체 기반 파라미터 전달로 순서 오인 사태 방지
      const result = await this.addFontInternal({
        filePath: downloadedPath,
        customAlias: customAlias || remoteName, // 사용자가 입력한 별칭 우선, 없으면 서버 별칭
        remoteSourceId: item.id,
      });

      // addFontInternal이 새로운 UUID 파일명으로 복사본을 만들었으므로 원본 삭제 가능
      if (downloadedPath !== path.join(this.customFontsDir, result.fileName)) {
        await fs.unlink(downloadedPath).catch(() => {});
      }

      logger.info(
        `Remote font '${result.alias}' successfully integrated into library.`,
      );
      return result;
    } catch (err) {
      logger.error(`Failed to download and install remote font: ${err}`);
      throw err;
    }
  }

  /**
   * 다운로드 진행률 알림 헬퍼
   */
  private notifyDownloadProgress(id: string, progress: number) {
    import("electron").then(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows().forEach((win) => {
        if (!win.isDestroyed())
          win.webContents.send("font:download-progress", { id, progress });
      });
    });
  }

  /**
   * 전체 폰트 목록 조회
   */
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
      // 1. [시스템 언인스톨] 해당 폰트가 현재 서비스에 할당되어 있는지 확인
      const currentApplied =
        (getConfig("appliedFonts") as Record<string, string>) || {};
      const rollbackAssignments: Record<string, string | null> = {};

      for (const [service, fontId] of Object.entries(currentApplied)) {
        if (fontId === id) {
          rollbackAssignments[service] = "DEFAULT";
          logger.info(
            `Font '${id}' is in use by '${service}'. Triggering automatic rollback to DEFAULT via applyBatch.`,
          );
        }
      }

      // 2. [로직 재사용] 할당된 서비스가 있다면 applyBatch를 호출하여 물리적 제거 및 레지스트리 롤백 수행
      if (Object.keys(rollbackAssignments).length > 0) {
        await this.applyBatch(rollbackAssignments);
      }

      // 3. [최종 물리 삭제] 런처 내부의 물리 파일 및 메타데이터 삭제
      await fs.unlink(path.join(this.customFontsDir, data.fileName));
      await fs.unlink(path.join(this.customFontsDir, `${data.id}.json`));
    } catch (err) {
      logger.error(
        `Failed to fully remove font or cleanup system assignments: ${err}`,
      );
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
