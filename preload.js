const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Send events to the main process
  send: (channel, data) => {
    ipcRenderer.send(channel, data);
  },

  // Listen for events from the main process
  receive: (channel, callback) => {
    ipcRenderer.on(channel, (event, ...args) => callback(...args));
  },

  // Use invoke for promises (async communication)
  invoke: (channel, data) => {
    return ipcRenderer.invoke(channel, data);
  },

  // Listen for events once (only triggers the callback one time)
  once: (channel, callback) => {
    ipcRenderer.once(channel, (event, ...args) => callback(...args));
  },

  // Listen for events and allow manual removal of the listener
  on: (channel, callback) => {
    ipcRenderer.on(channel, (event, ...args) => callback(...args));
  },

  // Remove a specific listener
  removeListener: (channel, callback) => {
    ipcRenderer.removeListener(channel, callback);
  }
});

// Optional: Replace text in DOM for Electron environment details
window.addEventListener('DOMContentLoaded', () => {
  const replaceText = (selector, text) => {
    const element = document.getElementById(selector);
    if (element) element.innerText = text;
  };

  for (const type of ['chrome', 'node', 'electron']) {
    replaceText(`${type}-version`, process.versions[type]);
  }
});


