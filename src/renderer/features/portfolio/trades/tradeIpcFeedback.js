// portfolio/tradeEditor/tradeIpcFeedback.js
// Einmalige IPC-Receiver für Erfolg/Fehler-Feedback der Trade-/Portfolio-Aktionen
// (Delete Portfolio, Add Products, Fill Trade Details). Bindet genau einmal.
//
// HINWEIS: Channel-Namen ('*-deals-*', 'createdDealsDropdown', …) sind noch im
// alten "deals"-Schema – das ist Absicht (externer Vertrag bleibt vorerst).

export function bindTradeIpcFeedbackOnce({ api, showMessageBox } = {}) {
  if (!api) return;
  if (window.__dealsDeleteEverywhereListenersBound) return;
  window.__dealsDeleteEverywhereListenersBound = true;

  api.receive?.('delete-portfolio-everywhere-success', ({ port, deleted } = {}) => {
    console.log('[UI] delete-portfolio-everywhere-success', { port, deleted });

    showMessageBox?.(`Portfolio "${port}" deleted.`, () => {});

    // reset deals dropdown to NONE
    const dd = document.getElementById('createdDealsDropdown');
    if (dd) {
      dd.value = '__NONE__';
      dd.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // optional: clear inputs
    const nameEl = document.getElementById('nameInput');
    if (nameEl) nameEl.value = '';

    const tagEl = document.getElementById('tagInputField');
    if (tagEl) tagEl.value = '';
  });

  api.receive?.('delete-portfolio-everywhere-error', ({ message } = {}) => {
    console.error('[UI] delete-portfolio-everywhere-error', message);
    if (typeof showMessageBox === 'function') {
      showMessageBox(message || 'Delete failed.');
    } else {
      console.warn('[TradeIpcFeedback]', message || 'Delete failed.');
    }
  });

  api.receive?.('add-products-to-portfolio-success', ({ port, inserted } = {}) => {
    console.log('[UI] add-products-to-portfolio-success', { port, inserted });
    showMessageBox?.(`${inserted ?? 0} product(s) added to "${port}".`, () => {});
  });

  api.receive?.('add-products-to-portfolio-error', ({ message } = {}) => {
    console.error('[UI] add-products-to-portfolio-error', message);
    if (typeof showMessageBox === 'function') {
      showMessageBox(message || 'Adding products failed.');
    } else {
      console.warn('[TradeIpcFeedback]', message || 'Adding products failed.');
    }
  });

  api.receive?.('update-deals-fields-success', ({ port, updated } = {}) => {
    console.log('[UI] update-deals-fields-success', { port, updated });
    showMessageBox?.(`Trade details saved (${updated ?? 0} updated) for "${port}".`, () => {});
  });

  api.receive?.('update-deals-fields-error', ({ message } = {}) => {
    console.error('[UI] update-deals-fields-error', message);
    if (typeof showMessageBox === 'function') {
      showMessageBox(message || 'Saving trade details failed.');
    } else {
      console.warn('[TradeIpcFeedback]', message || 'Saving trade details failed.');
    }
  });
}
