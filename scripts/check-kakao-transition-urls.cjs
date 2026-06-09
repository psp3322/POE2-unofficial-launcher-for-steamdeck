#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const NOTICE_URL = "https://poe.game.daum.net/forum/view-thread/3931700";
const TRANSFER_EFFECTIVE_AT = "2026-06-17T10:00:00+09:00";
const CLEANUP_REVIEW_AFTER = "2026-06-18T00:00:00+09:00";
const DEFAULT_TIMEOUT_MS = 15000;

const START_PATHS = {
  POE1: "#autoStart",
  POE2: "/main#autoStart",
};

const DEFAULT_BASE_URLS = {
  asis: {
    POE1: "https://poe.game.daum.net",
    POE2: "https://pathofexile2.game.daum.net",
  },
  tobe: {
    POE1: "https://kakaogames.com",
    POE2: "https://kakaogames.com",
  },
};

const GAME_PAGE_HINTS = {
  POE1: ["Path of Exile", "패스 오브 엑자일"],
  POE2: ["Path of Exile 2", "Path of Exile2", "패스 오브 엑자일2"],
};

const args = parseArgs(process.argv.slice(2));

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

async function main() {
  const timeoutMs = Number(args["timeout-ms"] || DEFAULT_TIMEOUT_MS);
  const targets = ["asis", "tobe"].flatMap((phase) =>
    ["POE1", "POE2"].map((gameId) => ({
      phase,
      gameId,
      url: getTargetUrl(phase, gameId),
    })),
  );

  const results = [];
  for (const target of targets) {
    results.push(await checkUrl(target, timeoutMs));
  }

  const report = {
    checkedAt: new Date().toISOString(),
    noticeUrl: NOTICE_URL,
    transferEffectiveAt: TRANSFER_EFFECTIVE_AT,
    cleanupReviewAfter: CLEANUP_REVIEW_AFTER,
    primaryAfterTransfer: "tobe",
    fallbackBeforeCleanup: "asis",
    results,
  };

  if (args.json) {
    writeFile(args.json, `${JSON.stringify(report, null, 2)}\n`);
  }

  const markdown = formatMarkdown(report);
  if (args.markdown) {
    writeFile(args.markdown, markdown);
  }

  process.stdout.write(markdown);

  if (args["fail-on-tobe-fail"] && results.some(isFailingTobeResult)) {
    process.exitCode = 1;
  }
}

async function checkUrl(target, timeoutMs) {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(target.url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "POE2-unofficial-launcher-transition-check/1.0",
      },
    });
    const contentType = response.headers.get("content-type") || "";
    const elapsedMs = Date.now() - startedAt;
    const body = contentType.includes("text/html") ? await response.text() : "";
    const bodySample = summarizeBody(body);
    const hasExpectedPageHint = hasGamePageHint(target.gameId, body);
    const isReachable = response.status >= 200 && response.status < 400;

    return {
      ...target,
      pass: isReachable && hasExpectedPageHint,
      status: response.status,
      finalUrl: response.url,
      contentType,
      elapsedMs,
      hasExpectedPageHint,
      bodySample,
      note: hasExpectedPageHint
        ? "Expected PoE page text found."
        : "Expected PoE page text was not found.",
    };
  } catch (error) {
    return {
      ...target,
      pass: false,
      status: null,
      finalUrl: null,
      contentType: null,
      elapsedMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function getTargetUrl(phase, gameId) {
  const startUrlOverride =
    process.env[`KAKAO_${phase.toUpperCase()}_${gameId}_START_URL`];
  if (startUrlOverride) return startUrlOverride;

  const baseUrl =
    process.env[`KAKAO_${phase.toUpperCase()}_${gameId}_URL`] ||
    DEFAULT_BASE_URLS[phase][gameId];
  return `${baseUrl.replace(/\/$/, "")}${START_PATHS[gameId]}`;
}

function formatMarkdown(report) {
  const rows = report.results
    .map((result) =>
      [
        result.phase.toUpperCase(),
        result.gameId,
        result.pass ? "PASS" : "FAIL",
        result.status ?? "-",
        result.elapsedMs,
        result.finalUrl || "-",
        result.error || result.note || result.bodySample || "-",
      ]
        .map(escapeTableCell)
        .join(" | "),
    )
    .join("\n");

  return [
    "## URL Check Result",
    "",
    `- Official notice: ${report.noticeUrl}`,
    `- Transfer effective: ${report.transferEffectiveAt}`,
    `- Cleanup review after: ${report.cleanupReviewAfter}`,
    `- Primary after transfer: ${report.primaryAfterTransfer.toUpperCase()}`,
    `- Fallback before cleanup: ${report.fallbackBeforeCleanup.toUpperCase()}`,
    `- Checked at: ${report.checkedAt}`,
    "",
    "| Phase | Game | Result | Status | Elapsed ms | Final URL | Note |",
    "| --- | --- | --- | ---: | ---: | --- | --- |",
    rows,
    "",
    "Manual Windows verification is still required for login, terms or identity verification, starter handoff, and actual game process launch.",
    "",
  ].join("\n");
}

function summarizeBody(body) {
  return body.replace(/\s+/g, " ").trim().slice(0, 180);
}

function hasGamePageHint(gameId, body) {
  return GAME_PAGE_HINTS[gameId].some((hint) => body.includes(hint));
}

function isFailingTobeResult(result) {
  return result.phase === "tobe" && !result.pass;
}

function escapeTableCell(value) {
  return String(value).replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function parseArgs(rawArgs) {
  const parsed = {};

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];
    if (!arg.startsWith("--")) continue;

    const key = arg.slice(2);
    const next = rawArgs[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = true;
      continue;
    }

    parsed[key] = next;
    index += 1;
  }

  return parsed;
}

function writeFile(outputPath, content) {
  const resolvedPath = path.resolve(outputPath);
  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
  fs.writeFileSync(resolvedPath, content, "utf8");
}
