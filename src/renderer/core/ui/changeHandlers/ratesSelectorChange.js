export function handleRatesSelectorChange(target, { appState } = {}) {
  if (target?.id !== 'ratesSelector') return false;

  const selectedCurve = target.value;

  try {
    appState?.setSelectedCurve?.(selectedCurve);
  } catch (err) {
    console.warn('Rates selector: setSelectedCurve failed', err);
  }

  window.dispatchEvent(new CustomEvent('rates:selection:changed', {
    detail: { selectedCurve }
  }));

  return true;
}