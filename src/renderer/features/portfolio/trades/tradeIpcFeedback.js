// portfolio/tradeEditor/tradeIpcFeedback.js
// Einmalige IPC-Receiver für Erfolg/Fehler-Feedback der Trade-/Portfolio-Aktionen
// (Delete Portfolio, Add Products, Fill Trade Details). Bindet genau einmal.
//
// HINWEIS: Channel-Namen ('*-deals-*', 'createdDealsDropdown', …) sind noch im
// alten "deals"-Schema – das ist Absicht (externer Vertrag bleibt vorerst).

import { openFillTradeDetailsDrawer } from '../tradeEntry/fillTradeDetailsDrawer.js';

export function bindTradeIpcFeedbackOnce({ api, showMessageBox } = {}) {
  if (!api) return;
  if (window.__dealsDeleteEverywhereListenersBound) return;
  window.__dealsDeleteEverywhereListenersBound = true;

  api.receive?.('delete-portfolio-everywhere-success', ({ port, deleted, total, scannedTables } = {}) => {
    console.log('[UI] delete-portfolio-everywhere-success', { port, deleted, total, scannedTables });

    // Transparenzfenster: tabellenartige Auflistung (Tabelle | Zeilen).
    const entries = Object.entries(deleted || {});
    const totalRows = (typeof total === 'number')
      ? total
      : entries.reduce((sum, [, n]) => sum + (Number(n) || 0), 0);

    const box = document.createElement('div');
    box.classList.add('confirmation-message');

    const title = document.createElement('p');
    title.style.margin = '0 0 12px';
    title.textContent =
      `Portfolio "${port}" deleted — ${totalRows} rows from ${entries.length} table(s).`;
    box.appendChild(title);

    if (entries.length) {
      const wrap = document.createElement('div');
      wrap.className = 'delete-summary-wrap';

      const table = document.createElement('table');
      table.className = 'delete-summary-table';

      const thead = document.createElement('thead');
      thead.innerHTML = '<tr><th>Table</th><th>Rows</th></tr>';
      table.appendChild(thead);

      const tbody = document.createElement('tbody');
      entries
        .slice()
        .sort((a, b) => b[1] - a[1])
        .forEach(([t, n]) => {
          const tr = document.createElement('tr');
          const tdName = document.createElement('td');
          tdName.textContent = t;
          const tdCount = document.createElement('td');
          tdCount.textContent = String(n);
          tr.append(tdName, tdCount);
          tbody.appendChild(tr);
        });
      table.appendChild(tbody);
      wrap.appendChild(table);
      box.appendChild(wrap);
    }

    showMessageBox?.(box, () => {});

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

    // Nach dem Bestätigen direkt weiter zum Ausfüllen der Trade-Details für die
    // gerade hinzugefügten Produkte. Deals sind hier bereits refresht (refreshTable
    // läuft im Main vor dem Success-Event), daher zeigt der Drawer die neuen Zeilen.
    const proceedToFillDetails = () => {
      openFillTradeDetailsDrawer({ appState: window.appState, api, portName: port });
    };

    if (typeof showMessageBox === 'function') {
      showMessageBox(`${inserted ?? 0} product(s) added to "${port}".`, proceedToFillDetails);
    } else {
      proceedToFillDetails();
    }
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
