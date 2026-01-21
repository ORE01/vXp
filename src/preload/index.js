const { contextBridge, ipcRenderer } = require('electron');

let ALLOW_SEND = new Set();
let ALLOW_INVOKE = new Set();
let ALLOW_LISTEN = new Set();
let DATA_SUFFIX = 'Data';
let allowlistLoaded = false;

// warn-only immer (bei dir so gewünscht)
function warn(kind, channel) {
  console.warn(`[IPC warn-only] ${kind}: "${channel}" (not in allowlist)`);
}

function isAllowedDataEvent(channel) {
  return typeof channel === 'string' && channel.endsWith(DATA_SUFFIX);
}

function canSend(channel) {
  if (!allowlistLoaded) return true; // warn-only: solange nicht geladen, nicht nerven/blocken
  if (ALLOW_SEND.has(channel)) return true;
  warn('send', channel);
  return true;
}

function canInvoke(channel) {
  if (!allowlistLoaded) return true;
  if (ALLOW_INVOKE.has(channel)) return true;
  warn('invoke', channel);
  return true;
}

function canListen(channel) {
  if (!allowlistLoaded) return true;
  if (ALLOW_LISTEN.has(channel) || isAllowedDataEvent(channel)) return true;
  warn('listen', channel);
  return true;
}

// Load allowlist async from main
(async function initAllowlist() {
  try {
    const allow = await ipcRenderer.invoke('ipc:get-allowlist');
    if (allow && typeof allow === 'object') {
      ALLOW_SEND = new Set(Array.isArray(allow.send) ? allow.send : []);
      ALLOW_INVOKE = new Set(Array.isArray(allow.invoke) ? allow.invoke : []);
      ALLOW_LISTEN = new Set(Array.isArray(allow.listen) ? allow.listen : []);
      DATA_SUFFIX = allow.allowDataEventsEndingWith || 'Data';
      allowlistLoaded = true;
      console.log('[preload] IPC allowlist loaded:', {
        send: ALLOW_SEND.size,
        invoke: ALLOW_INVOKE.size,
        listen: ALLOW_LISTEN.size,
        dataSuffix: DATA_SUFFIX,
      });
    }
  } catch (e) {
    // warn-only: wenn allowlist nicht geladen werden kann, bleibt alles erlaubt
    console.warn('[preload] allowlist load failed (warn-only, continuing):', e?.message || e);
  }
})();

contextBridge.exposeInMainWorld('api', {
  send: (channel, data) => {
    const ch = String(channel || '');
    if (!canSend(ch)) return;
    ipcRenderer.send(ch, data);
  },

  invoke: (channel, data) => {
    const ch = String(channel || '');
    if (!canInvoke(ch)) return ipcRenderer.invoke(ch, data);
    return ipcRenderer.invoke(ch, data);
  },

  receive: (channel, callback) => {
    const ch = String(channel || '');
    if (!canListen(ch)) return;
    ipcRenderer.on(ch, (_event, ...args) => callback(...args));
  },

  once: (channel, callback) => {
    const ch = String(channel || '');
    if (!canListen(ch)) return;
    ipcRenderer.once(ch, (_event, ...args) => callback(...args));
  },

  on: (channel, callback) => {
    const ch = String(channel || '');
    if (!canListen(ch)) return;
    ipcRenderer.on(ch, (_event, ...args) => callback(...args));
  },

  removeListener: (channel, callback) => {
    ipcRenderer.removeListener(channel, callback);
  },

  // explicit helpers
  fetchBonds: (isins) => ipcRenderer.invoke('bonds:fetch', isins),
  fetchBondsTermsOnly: (isins) => ipcRenderer.invoke('bonds:fetchTermsOnly', isins),
  parsePdfUrl: (url, isin) => ipcRenderer.invoke('bonds:parsePdfUrl', { url, isin }),

  onProgress: (callback) => {
    ipcRenderer.on('py-progress', (_event, data) => callback(data));
  },
});

window.addEventListener('DOMContentLoaded', () => {
  const replaceText = (selector, text) => {
    const element = document.getElementById(selector);
    if (element) element.innerText = text;
  };

  for (const type of ['chrome', 'node', 'electron']) {
    replaceText(`${type}-version`, process.versions[type]);
  }
});





