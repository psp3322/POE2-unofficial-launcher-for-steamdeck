import { parentPort } from "node:worker_threads";

import opentype from "opentype.js";

/**
 * Mutates the font names to match the target game's expectations.
 */
const mutateNames = (obj: Record<string, unknown>, newName: string) => {
  if (!obj) return;
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (typeof val === "object" && val !== null) {
      for (const lang of Object.keys(val as Record<string, unknown>)) {
        (val as Record<string, unknown>)[lang] = newName;
      }
    } else if (typeof val === "string") {
      obj[key] = newName;
    }
  }
};

if (parentPort) {
  parentPort.on("message", (data) => {
    const { filePath, newName } = data;

    opentype.load(filePath, (err: Error | null, font?: opentype.Font) => {
      if (err || !font) {
        parentPort?.postMessage({
          error: err?.message || "Failed to load font.",
        });
        return;
      }

      try {
        mutateNames(font.names as unknown as Record<string, unknown>, newName);
        const buffer = font.toArrayBuffer();
        parentPort?.postMessage(
          {
            success: true,
            buffer: buffer,
          },
          [buffer],
        ); // Use Transferable for performance
      } catch (e: unknown) {
        parentPort?.postMessage({
          error: (e as Error).message || "Unknown error during mutation.",
        });
      }
    });
  });
}
