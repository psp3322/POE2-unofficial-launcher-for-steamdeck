#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const LEGACY_START = "/* kakao-transition:legacy-start */";
const LEGACY_END = "/* kakao-transition:legacy-end */";

const targetFiles = [
  path.join(root, "src", "shared", "kakao-service-transition.ts"),
  path.join(root, "src", "main", "tests", "kakao-service-transition.test.ts"),
  path.join(root, "src", "main", "tests", "kakao-visibility-policy.test.ts"),
];

let changedFiles = 0;

for (const targetFile of targetFiles) {
  const original = fs.readFileSync(targetFile, "utf8");
  const cleaned = removeLegacyBlocks(original);

  if (cleaned === original) {
    console.log(
      `[KakaoTransitionCleanup] No legacy blocks found in ${targetFile}`,
    );
    continue;
  }

  fs.writeFileSync(targetFile, cleaned, "utf8");
  changedFiles += 1;
  console.log(
    `[KakaoTransitionCleanup] Removed legacy blocks from ${targetFile}`,
  );
}

if (changedFiles === 0) {
  console.log("[KakaoTransitionCleanup] No legacy transition blocks found.");
  process.exit(0);
}

function removeLegacyBlocks(content) {
  let next = content;

  while (next.includes(LEGACY_START)) {
    const startIndex = next.indexOf(LEGACY_START);
    const endIndex = next.indexOf(LEGACY_END, startIndex);

    if (endIndex === -1) {
      throw new Error(
        `Missing ${LEGACY_END} marker after index ${startIndex}.`,
      );
    }

    next =
      next.slice(0, startIndex) +
      next.slice(endIndex + LEGACY_END.length).replace(/^\r?\n/, "");
  }

  if (next.includes(LEGACY_END)) {
    throw new Error(`Found unmatched ${LEGACY_END} marker.`);
  }

  return next;
}
