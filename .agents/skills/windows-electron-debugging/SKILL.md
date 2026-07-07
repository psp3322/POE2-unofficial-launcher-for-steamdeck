---
name: windows-electron-debugging
description: Use this skill whenever debugging or visually verifying the POE2 launcher UI, Electron runtime errors, Vite dev-server behavior, Chrome DevTools attachment, screenshots, or CDP capture. This project is Windows-first; this skill prevents WSL/mock-browser verification mistakes by forcing pwsh npm run dev, launcher terminal logs, Chrome remote debugging, and real Electron screenshots.
---

# Skill: Windows Electron Debugging

Use this workflow for launcher UI verification, runtime error triage, and screenshots. The app is Windows-first, so do not validate Electron behavior through WSL-only browser mocks.

## Required Flow

1. Start from WSL only for source inspection and edits.
2. Run the app from Windows PowerShell:

```powershell
cd "D:\project_poe2\POE2-unofficial-launcher"
npm run dev
```

`npm run dev` starts Electron with `--remote-debugging-port=9222` by default. Override only when needed:

```powershell
$env:ELECTRON_REMOTE_DEBUGGING_PORT="9333"
npm run dev
```

3. Read the launcher terminal logs before making visual claims. Fatal modal reports, IPC errors, and service errors appear there first.
4. Verify the debugging endpoint from Windows:

```powershell
curl.exe -sS http://127.0.0.1:9222/json/version
curl.exe -sS http://127.0.0.1:9222/json/list
```

5. Attach Chrome DevTools to the real launcher page, not the debug console page:

```powershell
$targets = Invoke-RestMethod http://127.0.0.1:9222/json/list
$main = $targets | Where-Object { $_.url -eq "http://localhost:54321/" } | Select-Object -First 1
Start-Process "C:\Program Files\Google\Chrome\Application\chrome.exe" $main.devtoolsFrontendUrl
```

If the main target is missing, inspect the terminal log and Electron process command line before proceeding.

## Capture Screenshot

Use the bundled script to capture the actual Electron surface and print a small DOM/error summary:

```powershell
cd "D:\project_poe2\POE2-unofficial-launcher"
node .agents\skills\windows-electron-debugging\scripts\cdp-capture.js
```

Default output: `.tmp/electron-cdp.png`.

Optional overrides:

```powershell
$env:CDP_PORT="9333"
$env:CDP_TARGET_URL="http://localhost:54321/"
$env:CDP_OUTPUT="D:\project_poe2\POE2-unofficial-launcher\.tmp\launcher.png"
node .agents\skills\windows-electron-debugging\scripts\cdp-capture.js
```

## Kakao Automation Popup Dumps

When diagnosing Kakao login, Daum Game Starter, SecurityCenter, or hidden automation windows, keep the app running from Windows PowerShell and inspect the launcher terminal log first. Then collect the real popup dumps from Windows temp.

In dev mode, automation pages are dumped by default when an automation window is force-shown, times out, or is exposed by inactive-window debugging. Disable only when needed:

```powershell
$env:VITE_KAKAO_PAGE_DUMP="false"
npm run dev
```

Dump location:

```powershell
$dumpRoot = Join-Path $env:TEMP "poe2-unofficial-launcher\kakao-page-dumps"
Get-ChildItem $dumpRoot | Sort-Object LastWriteTime -Descending | Select-Object -First 20
```

Back up each user-run flow before asking them to reproduce another state:

```powershell
cd "D:\project_poe2\POE2-unofficial-launcher"
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backup = ".tmp\kakao-page-dumps\$stamp-login-flow"
New-Item -ItemType Directory -Force $backup
Copy-Item "$dumpRoot\*" $backup -Recurse -Force
```

Read the files in this order:

- `.json`: reason, triggerContext, window id, URL, title, visibility/focus, bounds.
- `.txt`: visible body text, useful for recognizing transient prompts.
- `.html`: selectors and page state; use `rg`, not visual guesses.
- `.png`: final confirmation of the visible surface.

For `security-center.game.daum.net`, do not decide visibility from the URL alone — classify by DOM state. **The SecurityCenter visibility-classification policy (which selectors keep-hidden vs show) lives in the `kakao-automation` skill (Rule 3).** Collect and read the dumps here; apply that policy there.

## What To Report

Report the exact checks, not guesses:

- Electron main process argv includes `--remote-debugging-port=...`.
- `/json/version` responds.
- `/json/list` has the `http://localhost:54321/` page target.
- CDP summary shows whether fatal text is present.
- Screenshot path and the visible UI state.
- Kakao popup dump backup path, if automation windows were involved.
- Launcher terminal log excerpts for the relevant click or error.

## Avoid

- Do not use WSL Playwright/Chromium as the primary verifier for this Windows Electron app.
- Do not build mock HTML to judge real launcher UI.
- Do not dismiss an error modal as visual contrast or layout until terminal logs and CDP state are checked.
