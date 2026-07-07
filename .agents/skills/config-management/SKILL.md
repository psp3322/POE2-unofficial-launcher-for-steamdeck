---
name: config-management
description: MANDATORY rules for adding or changing any AppConfig field (data layer only — independent of whether a settings-screen UI is involved). Covers AppConfig type, CONFIG_METADATA, CONFIG_KEYS, DEFAULT_CONFIG registration and persistence model.
---

# Skill: Config Data Management

**Target Audience:** AI Agents
**Objective:** When you add, remove, or change ANY `AppConfig` field, you MUST follow this. This applies **regardless of UI** — a field managed only by a service, a dedicated modal, or auto-managed (like `appliedFonts`) STILL requires full registration here. UI rendering is a separate concern (see `settings-management`).

> **Why this skill exists separately:** A config key added only to the `AppConfig`
> type — without `config.ts` registration — silently becomes an **ORPHANED /
> Unmapped Field** in the runtime debug viewer (not caught by CI — see
> Enforcement). It is easiest to miss for fields with _no settings-screen UI_,
> where the author wrongly assumes the settings skill (UI-focused) does not
> apply — but registration always applies at the data layer.

---

## 1. The Registration Checklist

Adding a persistent `AppConfig` field requires the three **required** steps below (plus one conditional). Nothing auto-checks metadata completeness, so treat this as mandatory discipline (see Enforcement):

1. **Type** (required): add the property to `AppConfig` in `src/shared/types.ts`.
2. **Metadata** (required): add an entry to `CONFIG_METADATA` in `src/shared/config.ts`
   (`{ key, name, category, description }`). Missing this leaves the field in the
   runtime debug viewer's "ORPHANED CONFIGS (Legacy/Unknown)" panel.
3. **Default value** (required): add the key with its default to `DEFAULT_CONFIG` in
   `src/shared/config.ts`.
4. **Physical key mapping** (conditional): `CONFIG_KEYS` in `src/shared/config.ts` is
   a legacy, non-exhaustive compatibility map (see the comment at `config.ts:233`).
   Add to it ONLY when existing call-sites read the field through `CONFIG_KEYS` — it
   is NOT required for a new field.

## Enforcement — what actually catches mistakes

- **`tsc` (the real gate):** `DEFAULT_CONFIG` is typed `AppConfig`
  (`src/shared/config.ts`), so a required `AppConfig` field missing from
  `DEFAULT_CONFIG` fails compilation. Optional fields are NOT caught.
- **`config-integrity.test.ts`** (`src/renderer/settings/`): only verifies
  that store-backed settings-screen UI items (no `defaultValue`) exist in
  `DEFAULT_CONFIG`. A field with no UI is never checked by this test.
- **ORPHANED panel**: a runtime debug viewer
  (`src/renderer/components/debug/ConfigViewer.tsx`), not CI. A key present
  in config.json but missing from `CONFIG_METADATA` shows up there — use it
  as a manual diagnostic.

There is NO automated check for `CONFIG_METADATA` completeness — that is why
this checklist is mandatory discipline.

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
here — but the required registration steps above were still mandatory.

---

## Related area: game install paths (1.4.0+)

`gameInstallPaths` (`src/shared/types.ts`, nested per-service map) backs the
manual path designation + diagnosis flow (`GamePathDiagnosticModal`,
`src/main/game/GameInstallStatusReconciler.ts`). It is a nested object —
the §3 no-deep-mutation rule applies to every change.
