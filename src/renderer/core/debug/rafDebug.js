export function installRafDebug() {
  if (window.__rafDebugInstalled) return;
  window.__rafDebugInstalled = true;

  const originalRAF = window.requestAnimationFrame;

  window.requestAnimationFrame = function (callback) {
    const stack = new Error().stack;

    return originalRAF.call(window, (ts) => {
      const start = performance.now();

      callback(ts);

      const ms = performance.now() - start;

      if (ms > 16) {
        console.warn('[RAF SLOW]', `${ms.toFixed(1)}ms`, stack);
      }
    });
  };

  console.log('[RAF DEBUG] installed');
}