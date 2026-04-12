---
name: event-ipc-integration
description: Pipeline instructions for creating events, subscribing via EventBus, and syncing with the Renderer (React) via IPC.
---

# Skill: EventBus & IPC Integration Pipeline

**Target Audience:** AI Agents (`Antigravity`, etc.)
**Objective:** When requested to create a new EventBus event that interacts with the Renderer (UI), strictly follow this end-to-end pipeline to ensure architectural consistency and type-safety.

## Step 1. Define the Event (Main Process)
**File:** `src/main/events/types.ts`
1. Add a unique string value to the `EventType` enum.
2. Define a new interface for the shape of the event payload.
3. Append this interface to the global `AppEvent` Union type.

```typescript
export enum EventType {
  // ... existing
  MY_CUSTOM_EVENT = "DOMAIN:MY_CUSTOM_EVENT",
}

export interface MyCustomEvent {
  type: EventType.MY_CUSTOM_EVENT;
  payload: { status: string; message: string; };
}

export type AppEvent = /* existing */ | MyCustomEvent;
```

## Step 2. Broadcast to Renderer (Main -> Renderer)
**File:** `src/main/events/handlers/MyCustomHandler.ts`
Instead of calling `mainWindow.webContents.send()` randomly, create a dedicated `EventHandler`.

```typescript
import { EventHandler, EventType, MyCustomEvent } from "../types";

export const MyCustomHandler: EventHandler<MyCustomEvent> = {
  id: "MyCustomHandler",
  targetEvent: EventType.MY_CUSTOM_EVENT,
  handle: async (event, context) => {
    // Safely emit to renderer
    context.mainWindow?.webContents.send("app:my-custom-event", event.payload);
  },
};
```
*Note:* Remember to register this handler in `src/main/main.ts` using `eventBus.register(MyCustomHandler);`.

## Step 3. Expose IPC Bridge (Preload)
**File:** `src/main/preload.ts`
Inside `contextBridge.exposeInMainWorld("electronAPI", { ... })`:
**CRITICAL:** You MUST return a cleanup function containing `ipcRenderer.off` to prevent React from leaking memory during hot reloads or unmounts.

```typescript
onMyCustomEvent: (callback: (data: { status: string; message: string }) => void) => {
  const handler = (_event: Electron.IpcRendererEvent, data: { status: string; message: string }) => callback(data);
  ipcRenderer.on("app:my-custom-event", handler);
  
  // Return the auto-unsubscriber
  return () => ipcRenderer.off("app:my-custom-event", handler);
},
```

## Step 4. Update Type Definitions
**File:** `src/shared/types.ts` (or equivalent global type def file)
Ensure you add the function signature to the `ElectronAPI` interface so the Renderer compilation passes successfully.

## Step 5. Subscribe in React (Renderer)
Ensure to invoke the unsubscribe logic inside the `useEffect` cleanup hook.

```tsx
useEffect(() => {
  // Setup the listener
  const unsubscribe = window.electronAPI.onMyCustomEvent((payload) => {
    console.log(payload.message);
  });

  // Teardown the listener
  return () => {
    unsubscribe();
  };
}, []);
```

## Step 6. Action from Renderer to Main (Reverse Flow)
If the Renderer triggers an action:
1. **Preload**: Expose a firing method `triggerMyAction: (data) => ipcRenderer.send("ui:my-action", data)`.
2. **Main (IPC Listener)**: Listen to it in `main.ts` or an IPC controller via `ipcMain.on`.
3. **CRITICAL RULE**: Do not write actual business logic inside the IPC `ipcMain.on` block. Instead, instantly delegate it to the EventBus:
   `ipcMain.on("ui:my-action", (_, data) => eventBus.emit(EventType.MY_ACTION, context, data));`
