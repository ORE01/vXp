// src/renderer/core/ui/globalChangeDelegation.js

export function bindGlobalChangeDelegation({ appState, handleEUSWData }) {

  if (window.__changeBoundOnce) return;
  window.__changeBoundOnce = true;

  let lastOffersPort = null;

  document.addEventListener('change', (event) => {

    const t = event.target;
    if (!t) return;

    // =====================================================
    // LEGACY SCENARIO CHECKBOXES
    // =====================================================

    if (t.classList.contains('select-scenario')) {

      const checkboxes = document.querySelectorAll('.select-scenario');

      checkboxes.forEach((cb) => {
        if (cb !== t) cb.checked = false;
      });

      return;
    }

    // =====================================================
    // IR CURVE SELECTOR
    // =====================================================

    if (t.id === "ratesSelector") {

      const selectedCurve = t.value;

      try {
        appState?.setSelectedCurve?.(selectedCurve);
      } catch {}

      try {
        handleEUSWData?.(appState?.getForwardData?.());
      } catch {}

      return;
    }

    // =====================================================
    // OFFERS DROPDOWN
    // =====================================================

    if (t.id === 'createdOffersDropdown') {

      const port_name = t.value;

      if (port_name === lastOffersPort) return;
      lastOffersPort = port_name;

      try {

        appState?.setSelectedDealsTableName?.(port_name);
        appState?.setSelectedPortTableName?.(port_name);

        const all  = (appState?.getAllDealsData && appState.getAllDealsData()) || [];
        const rows = all.filter(r => r?.port_name === port_name);

        appState?.handleDealsData?.(rows, port_name);

      } catch (err) {

        console.error('Offers Dropdown handling failed:', err);

      }

      return;
    }

  }, false);

}
