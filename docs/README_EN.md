<h1 align="center">POE Unofficial Launcher SD — Steam Deck Edition</h1>

<p align="center">
  <a href="../README.md"><b>한국어</b></a> | <a href="README_EN.md"><b>English</b></a>
</p>

An unofficial launcher for running **Path of Exile 1 & 2 (Kakao Games / Korea)** on the **Steam Deck**.
This is a fork of [NERDHEAD-lab/POE2-unofficial-launcher](https://github.com/NERDHEAD-lab/POE2-unofficial-launcher) adapted to work under Proton/Wine.

> ⚠️ This is an **unofficial** launcher. Not affiliated with Kakao Games or Grinding Gear Games. Use at your own risk.

## What works on Steam Deck

- **Automated Kakao login** — designated-PC check, login popups, and intro modals handled automatically
- **Game launch without KakaoGamesStarter** — the starter doesn't exist in a Steam Deck prefix, so this fork intercepts the launch token and starts the game client directly
- **No compatdata (random number) path editing** — keep launching the setup file you added to Steam; once installed, it opens the launcher directly on every run
- **Automatic game detection** — finds existing POE1/POE2 installs in other Steam prefixes or on SD cards; if none exist, installs the official client from inside the launcher
- **Deck-tailored UI** — 1280×800 fullscreen, gamepad navigation (D-pad/A/B), X button fully quits
- **🦆 Lossless Scaling (lsfg-vk) frame generation toggle** — the duck button on the main screen enables it for the game process only, so the launcher never crashes
- **Auto update** — pulls new versions from this repository's Releases

## Installation

1. Switch the Steam Deck to **Desktop Mode**
2. Download the latest `POE2-Unofficial-Launcher-Setup-....exe` from [Releases](https://github.com/psp3322/POE2-unofficial-launcher-for-steamdeck/releases)
3. In Steam (Desktop Mode), use **"Add a Non-Steam Game"** and add the downloaded file
4. In the game's Properties → Compatibility, force **Proton Experimental (recommended)** or Proton 9.0+
5. Launch it — installation runs automatically and the launcher opens. **That's it!** Keep using the same shortcut; no path editing needed
6. Return to Gaming Mode → log in to Kakao in the launcher → start the game

See the **[Steam Deck guide](README_STEAMDECK.md)** (Korean) for detailed usage, troubleshooting, and recommended graphics settings.

## Good to know

- **Do not add Decky Lossless Scaling as a Steam launch option** — it hooks the launcher too and the game dies right after starting. Use the in-launcher 🦆 toggle instead
- The custom font installer relies on Windows APIs and is disabled on Steam Deck
- Bug reports & suggestions: [Issues](https://github.com/psp3322/POE2-unofficial-launcher-for-steamdeck/issues) (the in-launcher "기능 건의" button links here too)

## Credits

- Original launcher: [NERDHEAD-lab/POE2-unofficial-launcher](https://github.com/NERDHEAD-lab/POE2-unofficial-launcher) — all of the Kakao automation
- Direct-launch approach pioneered by Dr.Sashimi's poe2-kakao-launcher and [psp3322/poe1-kakao-launcher](https://github.com/psp3322/poe1-kakao-launcher)
- License: [AGPL-3.0](../LICENSE) (same as upstream)
