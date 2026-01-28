// FRONT_END/bootstrap/bootstrapIPC.js

import { installIpcBridge } from '../IPC/ipcBridge.js';

export function bootstrapIPC(deps) {
  // deps ist absichtlich "flach + spreads", damit du keine zweite Liste pflegst
  installIpcBridge(deps);
}
