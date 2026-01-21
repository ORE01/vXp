// FRONT_END/UI/globalChangeDelegation.js

/**
 * Bindet die globale Change-Delegation (Szenario-Checkboxen, IR-Curve Selector, Offers Dropdown).
 * Idempotent: bindet nur einmal.
 */
export function bindGlobalChangeDelegation({ appState, handleEUSWData }) {
  if (window.__changeBoundOnce) return;
  window.__changeBoundOnce = true;

  let lastOffersPort = null;

  document.addEventListener('change', (event) => {
    const t = event.target;
    if (!t) return;

    // 1) Szenario-Checkboxen
    if (t.classList.contains('select-scenario')) {
      const checkboxes = document.querySelectorAll('.select-scenario');
      let isDefaultSelected = false;

      checkboxes.forEach((cb) => {
        if (cb !== t) cb.checked = false;
        if (cb.checked && cb.dataset.row === "0") isDefaultSelected = true;
      });

      const creditWarningContainer = document.getElementById("creditWarningContainer");
      const creditWarningLight     = document.getElementById("creditWarning");
      if (creditWarningContainer && creditWarningLight) {
        if (!isDefaultSelected) {
          creditWarningLight.style.backgroundColor = "red";
          creditWarningContainer.style.visibility = "visible";
        } else {
          creditWarningLight.style.backgroundColor = "transparent";
          creditWarningContainer.style.visibility = "hidden";
        }
      }
      return;
    }

    // 2) IR Curve Selector
    if (t.id === "ratesSelector") {
      const selectedCurve = t.value;

      try { appState?.setSelectedCurve?.(selectedCurve); } catch {}
      try { handleEUSWData?.(appState?.getForwardData?.()); } catch {}

      const warningContainer = document.getElementById("curveWarningContainer");
      const warningLight     = document.getElementById("curveWarning");
      if (warningContainer && warningLight) {
        const off = (selectedCurve === "EUSWAP");
        warningLight.style.backgroundColor = off ? "transparent" : "red";
        warningContainer.style.visibility  = off ? "hidden" : "visible";
      }
      return;
    }

    // 3) OFFERS Dropdown
    if (t.id === 'createdOffersDropdown') {
      const port_name = t.value;
      if (port_name === lastOffersPort) return;
      lastOffersPort = port_name;

      try {
        appState?.setSelectedDealsTableName?.(port_name);
        appState?.setSelectedPortTableName?.(port_name);

        const all  = (appState?.getAllDealsData && appState.getAllDealsData()) || [];
        const rows = all.filter(r => r?.port_name === port_name);

        // nutzt deinen bestehenden Pfad
        appState?.handleDealsData?.(rows, port_name);
      } catch (err) {
        console.error('Offers Dropdown handling failed:', err);
      }
      return;
    }

    // alles andere ignorieren
  }, false);
}
