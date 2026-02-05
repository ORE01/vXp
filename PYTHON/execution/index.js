// PYTHON/execution/index.js

import { createPythonExecutionRouter } from './router.js';
import { createPythonExecutionFetch } from './fetch.js';
import { createPythonExecutionReceivers } from './receivers.js';

export function bindPythonExecution(ctx) {
  const { appState } = ctx;

  // shared local state for hist button
  let lastHistButton = null;
  const setLastHistButton = (btn) => { lastHistButton = btn; };
  const getLastHistButton = () => lastHistButton;
  const clearLastHistButton = () => { lastHistButton = null; };

  // once/on fallback
  const once = (channel, cb) => (window.api?.once ? window.api.once(channel, cb) : window.api.receive(channel, cb));
  const on   = (channel, cb) => (window.api?.on   ? window.api.on(channel, cb)   : window.api.receive(channel, cb));

  const fetch = createPythonExecutionFetch({
    ...ctx,
    appState,
    once,
  });

  const router = createPythonExecutionRouter({
    ...ctx,
    appState,
    once,
    setLastHistButton,
  });

  const receivers = createPythonExecutionReceivers({
    ...ctx,
    appState,
    on,
    fetch,
    handleProjectResponse: router.handleProjectResponse,
    getLastHistButton,
    clearLastHistButton,
  });

  return {
    installPythonReceivers: receivers.installPythonReceivers,
    handleProjectButtonClick: router.handleProjectButtonClick,
  };
}
