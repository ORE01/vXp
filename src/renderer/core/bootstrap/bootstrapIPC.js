// src/renderer/core/bootstrap/bootstrapIPC.js

import { installIpcBridge } from '../ipc/ipcBridge.js';

function validateHandlers(obj) {

  for (const [key, value] of Object.entries(obj)) {

    if (key.startsWith("handle") && typeof value !== "function") {
      console.warn(`[BOOT] Handler "${key}" is not a function`, value);
    }

  }

}

export function bootstrapIPC(deps) {

  validateHandlers(deps);

  installIpcBridge(deps);

}
