// src/renderer/core/ipc/ipcBridge.js
/**
 * ipc Bridge (Public API)
 *
 * This module intentionally re-exports the receiver installer
 * so the renderer imports only from "ipcBridge".
 *
 * ✅ No behavior change
 * ✅ No duplicate dependency list
 */

import { installReceivers } from './installReceivers.js';

// Option B: exact alias / pass-through
export const installIpcBridge = installReceivers;


