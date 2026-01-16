// FRONT_END/MARKET_DATA/FORWARDS/forwardsUI.js

export function bindForwardsButtons({ appState, handleFWDData, bindings = [] } = {}) {
  if (!appState) throw new Error('[bindForwardsButtons] appState missing');
  if (typeof handleFWDData !== 'function') throw new Error('[bindForwardsButtons] handleFWDData missing');

  // idempotent
  if (window.__forwardsButtonsBoundOnce) return;
  window.__forwardsButtonsBoundOnce = true;

  // Default bindings, falls du nichts übergibst
  const list = (Array.isArray(bindings) && bindings.length > 0)
    ? bindings
    : [
        // Beispiel: { buttonId: 'applyCMSButton', applyCubicSpline: false },
      ];

  list.forEach(({ buttonId, applyCubicSpline = false }) => {
    const btn = document.getElementById(buttonId);
    if (!btn) return;

    btn.addEventListener('click', () => {
      const cachedData = appState.getForwardData?.();
      if (!cachedData) {
        console.warn(`[bindForwardsButtons] No cached forward data for ${buttonId}`);
        return;
      }
      try {
        handleFWDData(cachedData, applyCubicSpline);
      } catch (e) {
        console.warn('[bindForwardsButtons] handleFWDData failed', e);
      }
    });
  });
}
