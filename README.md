<p align="center">
  <img src="src/renderer/assets/layout/frame-top-center.gif" width="100%" />
</p>

<h1 align="center">POE Unofficial Launcher</h1>

<p align="center">
  <img src="https://img.shields.io/github/v/release/NERDHEAD-lab/POE2-unofficial-launcher?include_prereleases&style=flat-square" />
  <img src="https://img.shields.io/github/license/NERDHEAD-lab/POE2-unofficial-launcher?style=flat-square" />
  <img src="https://img.shields.io/github/downloads/NERDHEAD-lab/POE2-unofficial-launcher/total?style=flat-square" />
</p>

<p align="center">
  <a href="README.md"><b>EN</b></a> | <a href="docs/README_KR.md"><b>KR</b></a>
</p>

> **Disclaimer**: This is an **unofficial** launcher for **Path of Exile** & **Path of Exile 2**. It is not affiliated with Grinding Gear Games or Kakao Games. Use at your own risk.

A Windows desktop launcher that takes the friction out of starting **Path of Exile** and **Path of Exile 2**. It handles the launch process for both the Kakao Games (Korea) client and the Grinding Gear Games (GGG) standalone client, gets rid of the UAC pop-up, lets you swap in your own fonts and UI themes, watches for common patch errors, and shows official news right inside the launcher.

> **Windows only.** The Steam version of PoE / PoE 2 is **not** supported — use the GGG standalone client.

<p align="center">
  <img src="docs/PoE%20Unofficial%20Launcher%20preview.gif" width="100%" />
</p>

## Key Features

### Game launching

- **One-click start for PoE 1 & PoE 2** on both **Kakao Games** and the **Grinding Gear Games standalone client**. (Steam is not supported.)
- **Kakao automation**: confirms the "Designated PC" (지정 PC) prompt, the login pop-up, and the intro modal for you. The automation runs in a hidden, sandboxed browser window so you never see the web UI.
- **No more UAC pop-ups**. The launcher uses Windows' `RUNASINVOKER` compatibility flag to start `DaumGameStarter.exe` without elevation, so launching no longer triggers the User Account Control prompt. (This replaces the older Task Scheduler / `proxy.vbs` workaround; the legacy setup is detected and cleaned up automatically.)

### Customization

- **Custom in-game fonts**. Install your own fonts, browse a downloadable font catalog, and assign different fonts per game (PoE 1 / PoE 2 — per service channel). The launcher rewrites the font's internal metadata so the game accepts your font in place of the original without modifying any game files.
- **Game UI themes**. Pick from a catalog of themes that syncs automatically from the official theme repository; assets are cached locally and served to the launcher UI through a sandboxed `asset://` protocol.

### Patch tools

- **Auto-fix patch errors**. Detects recurring patch failures such as `Transferred a partial file` and recovers them automatically.
- **Patch reservation**. Schedule a patch to run later (e.g. overnight) instead of waiting around for it now.
- **Forced repair**. Trigger a full repair on demand when something looks wrong.

### Information & convenience

- **In-launcher news**. Official PoE notices and patch notes are scraped and displayed in a side panel — no need to open a browser.
- **Auto-update**. The launcher updates itself in the background (powered by `electron-updater`); you'll get a prompt when a new version is ready.
- **Process awareness**. Detects when the game is running, pauses background work when the launcher loses focus, and recovers cleanly across sleep/wake.
- **First-run wizard**. A short onboarding flow walks you through UAC bypass and patch options the first time you open the app.
- **Built-in debug console**. A diagnostics view for inspecting logs and configuration when you need to report a problem.

### Privacy & security

- **No stored passwords**. Login is handled by the publisher's own web flow inside a sandboxed Electron session; the launcher only relies on session cookies.
- **Locked-down browser session**. The hidden game window runs in an isolated Electron session partition with sensitive web permissions (camera, microphone, geolocation, WebAuthn / passkey, MIDI, pointer lock, etc.) explicitly blocked.

## Installation

1. Go to the [Releases](https://github.com/NERDHEAD-lab/POE2-unofficial-launcher/releases) page.
2. Download the latest `Setup.exe`.
3. Run the installer.

## Development

For end users, nothing here is required — just use the installer above. This section is only for contributors who want to run the launcher from source.

### Prerequisites

- **Node.js >= 24** (see `engines` in `package.json`)
- npm
- Windows (the launcher is Windows-only)

### Setup

```bash
# Clone
git clone https://github.com/NERDHEAD-lab/POE2-unofficial-launcher.git
cd POE2-unofficial-launcher

# Install dependencies (npm install also works)
npm run setup
```

### Common scripts

```bash
npm run dev        # Run in development mode (Vite + Electron)
npm run dev:test   # Same as dev, but shows the hidden game window and opens DevTools
npm run build      # Type-check, bundle, and produce a Windows installer
npm run lint       # ESLint
npm test           # Vitest
```

Detailed architecture and internal design notes are maintained separately as project-internal documentation and are not part of this repo.

## Contributing

Contributions are welcome. Please feel free to open an issue or submit a Pull Request.

## License

This project is licensed under the [GNU Affero General Public License v3.0](LICENSE).

## Repository

[https://github.com/NERDHEAD-lab/POE2-unofficial-launcher](https://github.com/NERDHEAD-lab/POE2-unofficial-launcher)

## Support

If you find this project helpful, please consider supporting the developer. [More Info](./docs/SUPPORT.md)

<p align="center">
  <img src="src/renderer/assets/layout/banner-bottom.png" width="100%" />
</p>
