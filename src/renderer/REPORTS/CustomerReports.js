import processData from '../UI/MODAL_HELPER/dataProcessor.js';
import { appState } from '../../renderer/renderer.js';
import { handleModalAction } from '../UI/MODAL_HELPER/ModalActionHandler.js';
import { ensureRendered } from '../../utils/domHelpers.js';


const TABLE_CUSTOMER_REPORTS = 'CustomerReports';

// ✅ Nimm A oder B:
const CUSTOMER_REPORTS_COLUMNS = [
  'id',
  'name',
  'report_type',
  'state_json', 
  'created_at',
  'updated_at'
];

// optional helper, nur falls du state_json anzeigen willst
function shortenJson(v, maxLen = 120) {
  const s = (v ?? '').toString();
  if (!s) return '';
  return s.length > maxLen ? (s.slice(0, maxLen) + '…') : s;
}

export function handleCustomerReportsView() {
  console.log('handleCustomerReportsView');

  const container = document.getElementById('customerReportsContainer');
  if (!container) {
    console.warn('⚠️ Container #customerReportsContainer nicht gefunden.');
    return;
  }

  while (container.firstChild) container.removeChild(container.firstChild);

  const receivedData = appState.getCustomerReportsData() || [];

  const tableData = Array.isArray(receivedData)
    ? receivedData.map(row => {
        const newRow = {};

        CUSTOMER_REPORTS_COLUMNS.forEach(col => {
          if (!Object.prototype.hasOwnProperty.call(row, col)) return;

          // Wenn du state_json in den Columns hast:
          if (col === 'state_json') {
            newRow[col] = shortenJson(row[col], 140);
          } else {
            newRow[col] = row[col];
          }
        });

        return newRow;
      })
    : [];

  container.innerHTML = processData(tableData, TABLE_CUSTOMER_REPORTS);

  // State zurückschreiben (wie bei dir üblich)
  appState.setCustomerReportsData(receivedData);

  ensureRendered(async () => {
    const reload = async () => {
      // Wenn dein Modal-Handler den State aktualisiert, reicht re-render.
      handleCustomerReportsView();
      // Alternativ: hier fetch triggern, falls du das so gelöst hast.
    };

    const addButton = document.getElementById('customerReportsAddButton');
    if (addButton) {
      addButton.addEventListener('click', (event) => {
        handleModalAction(
          event,
          appState.getCustomerReportsData() || [],
          null,
          TABLE_CUSTOMER_REPORTS,
          'add',
          { modalId: 'editModal', onReload: reload }
        );
      });
    }

    const editButtons = container.querySelectorAll('.edit-button');
    editButtons.forEach((button) => {
      button.addEventListener('click', (event) => {
        const rowIndex = parseInt(button.getAttribute('data-row'), 10);
        handleModalAction(
          event,
          appState.getCustomerReportsData() || [],
          rowIndex,
          TABLE_CUSTOMER_REPORTS,
          'edit',
          { modalId: 'editModal', onReload: reload }
        );
      });
    });
  });
}


// CustomerReportsClient.js (Renderer)

function extractArg(a, b) {
  // wenn once(handler) mit (event, payload) kommt → b ist payload
  // wenn once(handler) mit (payload) kommt → a ist payload
  return (typeof b !== 'undefined') ? b : a;
}

export function listCustomerReports(reportType = 'risk') {
  return new Promise((resolve) => {
    const requestId = `cr_list_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const okCh  = `customerReports:list-success:${requestId}`;
    const errCh = `customerReports:list-error:${requestId}`;

    console.log(`[CR][LIST->SEND] req=${requestId} report_type=${reportType}`);

    window.api.once(okCh, (a, b) => {
      const payload = extractArg(a, b);
      const rows = Array.isArray(payload) ? payload : (Array.isArray(payload?.rows) ? payload.rows : []);
      console.log(`[CR][LIST<-OK] req=${requestId} rows.count=${rows.length}`);
      resolve(rows);
    });

    window.api.once(errCh, (a, b) => {
      const msg = extractArg(a, b);
      console.warn(`[CR][LIST<-ERR] req=${requestId} | ${msg}`);
      resolve([]);
    });

    window.api.send('customerReports:list', {
      requestId,
      report_type: reportType
    });
  });
}

export function loadCustomerReport(name) {
  return new Promise((resolve) => {
    const requestId = `cr_load_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const okCh  = `customerReports:load-success:${requestId}`;
    const errCh = `customerReports:load-error:${requestId}`;

    const nm = String(name || '').trim();
    console.log(`[CR][LOAD->SEND] req=${requestId} name=${nm}`);

    window.api.once(okCh, (a, b) => {
      const row = extractArg(a, b);
      console.log(`[CR][LOAD<-OK] req=${requestId} hasRow=${!!row}`);
      resolve(row || null);
    });

    window.api.once(errCh, (a, b) => {
      const msg = extractArg(a, b);
      console.warn(`[CR][LOAD<-ERR] req=${requestId} | ${msg}`);
      resolve(null);
    });

    window.api.send('customerReports:load', {
      requestId,
      name: nm
    });
  });
}

export function saveCustomerReport(name, state, reportType = 'risk') {
  return new Promise((resolve) => {
    const requestId = `cr_save_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const okCh  = `customerReports:save-success:${requestId}`;
    const errCh = `customerReports:save-error:${requestId}`;

    const nm = String(name || '').trim();
    const st = (state && typeof state === 'object') ? state : {};
    console.log(
      `[CR][SAVE->SEND] req=%s name=%s report_type=%s keys=%d`,
      requestId, nm, reportType, Object.keys(st).length
    );

    window.api.once(okCh, () => {
      console.log(`[CR][SAVE<-OK] req=${requestId}`);
      resolve(true);
    });

    window.api.once(errCh, (a, b) => {
      const msg = extractArg(a, b);
      console.warn(`[CR][SAVE<-ERR] req=${requestId} | ${msg}`);
      resolve(false);
    });

    window.api.send('customerReports:save', {
      requestId,
      name: nm,
      report_type: reportType,
      state: st
    });
  });
}

export function deleteCustomerReport(name) {
  return new Promise((resolve) => {
    const requestId = `cr_del_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const okCh  = `customerReports:delete-success:${requestId}`;
    const errCh = `customerReports:delete-error:${requestId}`;

    const nm = String(name || '').trim();
    console.log(`[CR][DEL->SEND] req=${requestId} name=${nm}`);

    window.api.once(okCh, () => {
      console.log(`[CR][DEL<-OK] req=${requestId}`);
      resolve(true);
    });

    window.api.once(errCh, (a, b) => {
      const msg = extractArg(a, b);
      console.warn(`[CR][DEL<-ERR] req=${requestId} | ${msg}`);
      resolve(false);
    });

    window.api.send('customerReports:delete', {
      requestId,
      name: nm
    });
  });
}





