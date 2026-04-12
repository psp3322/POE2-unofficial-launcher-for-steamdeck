---
name: settings-management
description: Declarative guidelines and pipeline for adding, modifying, and handling application settings (persistent vs transient logic).
---

# Skill: Settings & Configuration Management

**Target Audience:** AI Agents (`Antigravity`, etc.)
**Objective:** When requested to add, remove, or modify an application setting or its UI behavior, you MUST strictly follow this declarative approach.

## 🚨 CRITICAL RULE: NO HARDCODING IN UI COMPONENTS
- All settings components (`CheckItem`, `SwitchItem`, etc.) located in `src/renderer/settings/items/` are **pure UI components**.
- NEVER hardcode specific setting `id` checks (e.g., `if (id === "dev_mode")`) inside these renderer UI components.
- ALL business logic, conditional rendering, validations, and dynamic UI updates MUST be done through the Context API hooks (`onInit`, `onChangeListener`, `dependsOn`) inside `src/renderer/settings/settings-config.ts`.

---

## 1. Persistence Model (Saved vs. Not Saved)

Before adding a setting, you must determine its persistence pattern. The simple presence of `defaultValue` dictates behavior:

### A. Persistent Settings (Saved to `config.json`)
Used for physical user preferences that survive reboots.
1. Add the key and its default value to `DEFAULT_CONFIG` in `src/shared/config.ts`.
2. Define the setting object in `src/renderer/settings/settings-config.ts`.
3. **DO NOT** provide a `defaultValue` property in the UI object. The system will automatically fetch it from the Electron Store and save it on change.

### B. Transient / Action Settings (NOT Saved)
Used for temporary session toggles, action buttons, or states dictated by the environment.
1. Define the setting in `settings-config.ts`.
2. **MUST** provide a `defaultValue` property (e.g., `defaultValue: false`) in the object.
3. This completely bypasses the persistence layer (`electron-store`). 

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

### `dependsOn: string`
- Pass another setting's `id`. The current setting will only render if the parent setting evaluates to `true`.

### `onInit: (context) => void`
Fired when the setting is mounted.
- `context.setValue(value)`: Programmatically alter the value.
- `context.addDescription(text, variant)`: Attach an inline descriptive block (`variant` can be `'default' | 'info' | 'warning' | 'error'`).
- `context.clearDescription()`: Wipe dynamic descriptions.
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

### Mistake 1: Forgetting to update `CONFIG_METADATA` and Types
If you add a persistent setting to `DEFAULT_CONFIG` (`src/shared/config.ts`), you **MUST** also:
1. Add it to the `CONFIG_METADATA` object in the same file.
2. Add physical key mapping in `CONFIG_KEYS` block.
3. Add the property to the `AppConfig` type definition (usually in `src/shared/types.ts`).
**Failure to do this will cause the `config-integrity.test.ts` to instantly fail the build.**

### Mistake 2: Storing deep objects and mutating them locally
When modifying nested config properties (e.g., `remoteThemeSettings.selectedThemes.POE2`), do **NOT** mutate the pulled object directly. Electron IPC bridges and store watchers do not track deep mutations.
**Correct:** `await window.electronAPI?.setConfig("key", { ...config, nested: { ...config?.nested, newKey: val } });`

### Mistake 3: Faking Persistence manually when not needed
If you omit `defaultValue`, standard checks, switches, and texts auto-sync. Do not waste code writing manual `setConfig` calls inside `onChangeListener` unless the component type is `radio` or you specified a `defaultValue` (to isolate it) but still want to write to the store at a specific controlled interval. 

### Mistake 4: Environment-forced configs breaking UI
If a setting can be forced via an environment variable (like `dev_mode`), you should check `window.electronAPI.isConfigForced(key)` in `onInit`. If true, you MUST call `context.setDisabled(true)` and `context.setValue(true)` to lock the UI visually so the user understands they cannot change it.
