import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import electron from "vite-plugin-electron";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let commitHash = "Dev";
try {
  const hash = execSync("git rev-parse --short HEAD").toString().trim();
  const isDirty =
    execSync("git status --porcelain").toString().trim().length > 0;
  commitHash = isDirty ? `${hash}-dirty` : hash;
} catch {
  // Fallback to Dev if git is not available or fails
}

const packageJson = JSON.parse(readFileSync("package.json", "utf-8"));
const appVersion = JSON.stringify(packageJson.version);
const appAuthorEmail = JSON.stringify(packageJson.author.email);

const builderConfig = readFileSync("electron-builder.json5", "utf-8");
const guidMatch = builderConfig.match(/guid:\s*["'](.*?)["']/);
const appGuid = guidMatch
  ? guidMatch[1]
  : "612ccee6-aa48-58b5-9d2e-fdd023b16218";

const productNameMatch = builderConfig.match(/productName:\s*["'](.*?)["']/);
const productName = productNameMatch
  ? productNameMatch[1]
  : "POE2 Unofficial Launcher";

const defines = {
  __APP_VERSION__: appVersion,
  __APP_AUTHOR_EMAIL__: appAuthorEmail,
  __APP_HASH__: JSON.stringify(commitHash),
  __APP_GUID__: JSON.stringify(appGuid),
  __PRODUCT_NAME__: JSON.stringify(productName),
};

type ElectronStartupOptions = {
  startup: (argv?: string[]) => Promise<void>;
  reload: () => void;
};

type ElectronProcess = NodeJS.Process & {
  electronApp?: unknown;
};

type ExecError = Error & {
  stderr?: Buffer | string;
};

const getElectronStartupArgs = () => {
  const args = [".", "--no-sandbox"];
  const remoteDebuggingPort =
    process.env.ELECTRON_REMOTE_DEBUGGING_PORT || "9222";

  args.push(`--remote-debugging-port=${remoteDebuggingPort}`);

  return args;
};

const startElectronApp = async (options: ElectronStartupOptions) => {
  try {
    return await options.startup(getElectronStartupArgs());
  } catch (error) {
    if (!isMissingTaskkillProcessError(error)) {
      throw error;
    }

    const electronProcess = process as ElectronProcess;
    console.warn(
      "[vite] Ignoring stale Electron PID cleanup failure and retrying startup.",
    );
    electronProcess.electronApp = undefined;
    return options.startup(getElectronStartupArgs());
  }
};

const reloadElectronRenderer = (options: ElectronStartupOptions) => {
  if ((process as ElectronProcess).electronApp) {
    options.reload();
    return;
  }

  return startElectronApp(options);
};

function isMissingTaskkillProcessError(error: unknown) {
  if (!(error instanceof Error)) return false;

  const execError = error as ExecError;
  const stderr = Buffer.isBuffer(execError.stderr)
    ? execError.stderr.toString("utf8")
    : (execError.stderr ?? "");
  const message = `${error.message}\n${stderr}`;

  return (
    message.includes("taskkill") &&
    (/not found/i.test(message) || message.includes("찾을 수 없습니다"))
  );
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        // Main-Process entry file of the Electron App.
        entry: "src/main/main.ts",
        onstart: startElectronApp,
        vite: {
          define: defines,
          build: {
            rollupOptions: {
              external: ["canvas"],
            },
          },
        },
      },
      {
        entry: "src/main/workers/FontMutatorWorker.ts",
        onstart: startElectronApp,
        vite: {
          define: defines,
          build: {
            outDir: "dist-electron/workers",
            lib: {
              entry: "src/main/workers/FontMutatorWorker.ts",
              formats: ["cjs"],
              fileName: () => "[name].js",
            },
          },
        },
      },
      {
        entry: "src/main/workers/OtfMutatorWorker.ts",
        onstart: startElectronApp,
        vite: {
          define: defines,
          build: {
            outDir: "dist-electron/workers",
            emptyOutDir: false,
            lib: {
              entry: "src/main/workers/OtfMutatorWorker.ts",
              formats: ["cjs"],
              fileName: () => "[name].js",
            },
          },
        },
      },
      {
        entry: "src/main/preload.ts",
        onstart: reloadElectronRenderer,
        vite: {
          define: defines,
        },
      },
      {
        entry: "src/main/kakao/preload.ts",
        onstart: reloadElectronRenderer,
        vite: {
          build: {
            outDir: "dist-electron/kakao",
            minify: process.env.NODE_ENV === "production",
            lib: {
              entry: "src/main/kakao/preload.ts",
              formats: ["cjs"],
              fileName: () => "[name].js",
            },
            rollupOptions: {
              external: ["electron"],
              output: {
                // Force name to be simple
                entryFileNames: "[name].js",
              },
            },
          },
          define: defines,
        },
      },
    ]),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    port: 54321,
    strictPort: true,
  },
  define: defines,
});
