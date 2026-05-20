---
name: config-management
description: MANDATORY rules for adding or changing any AppConfig field (data layer only — independent of whether a settings-screen UI is involved). Covers AppConfig type, CONFIG_METADATA, CONFIG_KEYS, DEFAULT_CONFIG registration and persistence model.
---

# Skill: Config Data Management

**Target Audience:** AI Agents
**Objective:** When you add, remove, or change ANY `AppConfig` field, you MUST follow this. This applies **regardless of UI** — a field managed only by a service, a dedicated modal, or auto-managed (like `appliedFonts`) STILL requires full registration here. UI rendering is a separate concern (see `settings-management`).

> **Why this skill exists separately:** A config key added only to the `AppConfig`
> type — without `config.ts` registration — silently becomes an **ORPHANED /
> Unmapped Field** and fails `config-integrity.test.ts`. This happens most often
> when the field has _no settings-screen UI_, so the author wrongly assumes the
> settings skill (UI-focused) does not apply. It always applies at the data layer.

---

## 1. The Non-Negotiable Registration Checklist

Adding a persistent `AppConfig` field requires **ALL** of the following. Missing any one causes an ORPHANED config or a build-failing integrity test:

1. **Type**: add the property to `AppConfig` in `src/shared/types.ts`.
2. **Metadata**: add an entry to `CONFIG_METADATA` in `src/shared/config.ts`
   (`{ key, name, category, description }`). This is what removes the field from
   the "ORPHANED CONFIGS (Legacy/Unknown)" panel.
3. **Physical key mapping**: add to the `CONFIG_KEYS` block in `src/shared/config.ts`
   if that block enumerates keys.
4. **Default value**: add the key with its default to `DEFAULT_CONFIG` in
   `src/shared/config.ts`.

`config-integrity.test.ts` enforces 1–4. Run it (or `tsc`) before declaring done.

---

## 2. Persistence Model — decide BEFORE registering

### A. Persistent (saved to `config.json`)

Physical user/state values that survive reboots. Do the full checklist above.
Auto-managed state (no user-facing control, e.g. `appliedFonts`,
`fontMutationSchema`) is still Persistent — register it fully, just don't add a
settings-screen item for it.

### B. Transient / Action (NOT saved)

Temporary session toggles or action buttons. These live only in
`settings-config.ts` with an explicit `defaultValue` and bypass the store —
they are NOT `AppConfig` fields, so this skill does not apply to them.

---

## 3. Nested config — never mutate pulled objects

When changing nested properties (e.g. `remoteThemeSettings.selectedThemes.POE2`),
do NOT mutate the fetched object. Electron IPC / store watchers do not track deep
mutations.
**Correct:** `await window.electronAPI?.setConfig("key", { ...config, nested: { ...config?.nested, newKey: val } });`

---

## 4. After registering

If the field needs a control in the **settings screen**, continue with the
`settings-management` skill (UI items, Context API hooks, no-hardcoding rule).
If it is service-/modal-/auto-managed (no settings-screen control), you are done
here — but registration steps 1–4 were still mandatory.
