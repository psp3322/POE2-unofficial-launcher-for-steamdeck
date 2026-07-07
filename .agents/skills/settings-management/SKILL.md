---
name: settings-management
description: Declarative pipeline for rendering and wiring settings-SCREEN UI items (settings-config.ts items, Context API hooks, no-hardcoding rule). For the underlying AppConfig data-layer registration, use config-management first.
---

# Skill: Settings Screen UI

**Target Audience:** AI Agents
**Objective:** When adding/modifying a control that appears in the **settings
screen**, follow this declarative UI approach.

> **⚠️ PREREQUISITE — do this first:** If the setting persists an `AppConfig`
> field, you MUST complete the `config-management` skill (AppConfig type +
> `CONFIG_METADATA` + `DEFAULT_CONFIG`, plus legacy `CONFIG_KEYS` only if
> referenced) BEFORE wiring UI here.
> Skipping it produces an ORPHANED config and fails `config-integrity.test.ts`.
> This UI skill covers only the settings-screen rendering layer. A field with
> no settings-screen control (service-/modal-/auto-managed, e.g. `appliedFonts`)
> needs config-management ONLY — it does not appear here at all.

## 🚨 CRITICAL RULE: NO HARDCODING IN UI COMPONENTS

- All settings components (`CheckItem`, `SwitchItem`, etc.) located in `src/renderer/components/settings/items/` are **pure UI components**.
- NEVER hardcode specific setting `id` checks (e.g., `if (id === "dev_mode")`) inside these renderer UI components.
- ALL business logic, conditional rendering, validations, and dynamic UI updates MUST be done through the Context API hooks (`onInit`, `onChangeListener`, `dependsOn`) inside `src/renderer/settings/settings-config.ts`.

---

## 1. Persistence Model for the UI item

The presence of `defaultValue` on the UI object dictates store behavior:

### A. Persistent item (backed by an AppConfig field)

The `AppConfig` field must already be registered via `config-management`.

1. Define the setting object in `src/renderer/settings/settings-config.ts`.
2. **DO NOT** provide a `defaultValue` property in the UI object — the system
   fetches it from the Electron Store (registered in `DEFAULT_CONFIG`) and saves
   on change.

### B. Transient / Action item (NOT saved, no AppConfig field)

Temporary session toggles or action buttons.

1. Define the setting in `settings-config.ts`.
2. **MUST** provide a `defaultValue` property (e.g., `defaultValue: false`).
3. This completely bypasses the persistence layer — no `config-management` needed.

---

## 2. Adding a Setting Item

Construct a JSON object inside the appropriate category in `src/renderer/settings/settings-config.ts`.

Available `type` properties:

- `check`: Standard checkbox toggle.
- `switch`: Bold toggle switch (visually stressed).
- `radio` / `select`: Multiple options. `radio` supports adding a `description` to each option array element.
- `slider` / `number`: Value adjustments. `number` supports `suffix` (e.g., "%").
- `text`: Information display. Supports `copyable: true`, `externalLink: { label, url }`, and `isExpandable`.
- `button`: Immediate action sequence. Can trigger modals.

---

## 3. Dynamic UI via Context API (Hooks)

Use these methods within the `SettingItem` configuration block to manipulate the app reacting to state changes.

### `dependsOn: string | { key: string; value: SettingValue }`

- String form: render only when the parent setting is truthy.
- Object form: render only when the parent setting equals `value`
  (`src/renderer/settings/types.ts`).

### `onInit: (context) => void`

Fired when the setting is mounted.

- `context.setValue(value)`: Programmatically alter the value.
- `context.addDescription(text, variant)`: Attach an inline descriptive block (`variant` can be `'default' | 'info' | 'warning' | 'error'`).
- `context.resetDescription()`: Wipe dynamic descriptions.
- `context.setDisabled(boolean)`: Lock the component.
- `context.setVisible(boolean)`: Hide the component.

### `onChangeListener: (val, context) => void`

Fired when a user manually interacts with the setting.

- Includes all context functions from `onInit`.
- `context.showToast(message)`: Pops a global toast notification.

---

## 4. Example: A Transient Action Button

Below is a purely logic-driven button trigger. Because it has `defaultValue`, it does not infect `config.json`.

```typescript
{
  id: "trigger_uac_reset",
  type: "button",
  label: "UAC Security Configuration",
  buttonText: "Reset Rules",
  defaultValue: false, // -> Mark as Transient (Don't save)
  variant: "danger",
  onClickListener: ({ showConfirm, showToast }) => {
    showConfirm({
      title: "Confirm Reset",
      message: "Are you absolutely sure you want to reset the cache?",
      onConfirm: async () => {
        await window.electronAPI.disableUACBypass();
        showToast("UAC Rules completely reset.");
      }
    });
  }
}
```

---

## 5. 🚨 COMMON AI PITFALLS & MISTAKES

When an AI Agent attempts to add/modify settings, these are the most common points of failure that cause build errors or logic bugs:

### Mistake 1: Skipping the config data-layer registration

The single most common failure. `AppConfig` type / `CONFIG_METADATA` /
`DEFAULT_CONFIG` registration (plus legacy `CONFIG_KEYS` if referenced, and the
deep-mutation rule) is owned by the **`config-management`** skill — follow it
BEFORE this UI skill for any persistent field. Skipping it produces an ORPHANED
config and fails `config-integrity.test.ts`.

### Mistake 2: Faking Persistence manually when not needed

If you omit `defaultValue`, standard checks, switches, and texts auto-sync. Do not waste code writing manual `setConfig` calls inside `onChangeListener` unless the component type is `radio` or you specified a `defaultValue` (to isolate it) but still want to write to the store at a specific controlled interval.

### Mistake 3: Environment-forced configs breaking UI

If a setting can be forced via an environment variable (like `dev_mode`), you should check `window.electronAPI.isConfigForced(key)` in `onInit`. If true, you MUST call `context.setDisabled(true)` and `context.setValue(true)` to lock the UI visually so the user understands they cannot change it.
