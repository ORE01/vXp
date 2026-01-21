// UPDATES/updatesExcel.js

let excelConflicts = [];
let excelConflictsTruncated = 0;
let currentConflictIndex = 0;
let conflictDecisions = []; // [{ prodId, choice: 'old' | 'new' }]

// === Exportierter Entry-Point ===================================

export function handleExcelComplete({ success, mode, result, error }) {
  if (!success) {
    console.error('Excel-Import fehlgeschlagen:', error);
    if (typeof showToast === 'function') {
      showToast(`Excel-Import fehlgeschlagen (${mode}): ${error}`);
    }
    return;
  }

  console.log('Excel-Import abgeschlossen:', mode, result);

  if (typeof showToast === 'function') {
    showToast(`Excel-Import erfolgreich (${mode}).`);
  }

  if (mode !== 'PRODUCTS' || !result) return;

  const conflicts =
    result.conflicts ||
    result.conflicts_preview ||
    [];

  if (!Array.isArray(conflicts) || conflicts.length === 0) {
    return;
  }

  // Zentralen Zustand setzen
  excelConflicts = conflicts;
  excelConflictsTruncated = result.conflicts_truncated || 0;
  currentConflictIndex = 0;

  conflictDecisions = conflicts.map(c => ({
    prodId: c.PROD_ID,
    choice: 'old' // Default
  }));

  renderProductConflictModal();
}



// === Modal-Rendering ============================================

function renderProductConflictModal() {
  const conflicts = excelConflicts;
  const truncatedCount = excelConflictsTruncated;

  // Safety
  if (!Array.isArray(conflicts) || conflicts.length === 0) {
    closeProductConflictModal();
    return;
  }

  // aktuellen Konflikt holen
  const conflict = conflicts[currentConflictIndex];

  // Wenn es keinen Konflikt mehr gibt → schließen
  if (!conflict) {
    closeProductConflictModal();
    return;
  }

  // 🔍 UNTERSCHIEDE BERECHNEN
  const diffRows = buildDiffRows(conflict);

  // Wenn KEINE Unterschiede → direkt zum nächsten springen
  if (diffRows.length === 0) {
    // Gibt es noch weitere? → nächster
    if (currentConflictIndex < conflicts.length - 1) {
      currentConflictIndex++;
      renderProductConflictModal();
      return;
    }

    // Wir sind beim letzten und haben trotzdem keine Unterschiede → Modal schließen
    closeProductConflictModal();
    return;
  }

  // Ab hier: Es gibt echte Unterschiede, Modal anzeigen
  const overlay = document.getElementById('prod-conflict-overlay');
  const modalRoot = document.getElementById('prod-conflict-modal');
  if (!overlay || !modalRoot) {
    console.warn('prod-conflict-overlay oder prod-conflict-modal fehlt im DOM');
    return;
  }

  const rowsHtml = diffRows.map(row => `
    <tr>
      <td>${row.key}</td>
      <td>${row.oldVal == null ? '' : row.oldVal}</td>
      <td>${row.newVal == null ? '' : row.newVal}</td>
    </tr>
  `).join('');

  const decision = conflictDecisions[currentConflictIndex]?.choice || 'old';

  const infoMore = truncatedCount > 0
    ? `<p style="font-size:11px; color:#aaa; margin-top:2px;">
         Hinweis: Es gibt noch ${truncatedCount} weitere Konflikte, die hier nicht angezeigt werden (Preview).
       </p>`
    : '';

  modalRoot.innerHTML = `
    <div class="modal-card">
      <h2>Produkt-Konflikt ${currentConflictIndex + 1} von ${conflicts.length}</h2>
      <p><strong>PROD_ID:</strong> ${conflict.PROD_ID}</p>
      ${infoMore}

      <table class="conflict-table">
        <thead>
          <tr>
            <th>Feld</th>
            <th>Alt (DB)</th>
            <th>Neu (Excel)</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>

      <div class="decision-row">
        <label>
          <input type="radio" name="prod-conflict-choice" value="old" ${decision === 'old' ? 'checked' : ''}>
          Alte Version behalten
        </label>
        <label>
          <input type="radio" name="prod-conflict-choice" value="new" ${decision === 'new' ? 'checked' : ''}>
          Neue Version übernehmen
        </label>
      </div>

      <div class="conflict-buttons">
        <button id="prod-conflict-prev" ${currentConflictIndex === 0 ? 'disabled' : ''}>Zurück</button>
        <button id="prod-conflict-next">
          ${currentConflictIndex === conflicts.length - 1 ? 'Schließen' : 'Weiter'}
        </button>
      </div>
    </div>
  `;

  overlay.style.display = 'block';
  modalRoot.style.display = 'block';

  attachModalEvents();
}


function attachModalEvents() {
  const modalRoot = document.getElementById('prod-conflict-modal');
  if (!modalRoot) return;

  const radios = modalRoot.querySelectorAll('input[name="prod-conflict-choice"]');
  radios.forEach(r => {
    r.addEventListener('change', (e) => {
      conflictDecisions[currentConflictIndex].choice = e.target.value;
    });
  });

  const btnPrev = document.getElementById('prod-conflict-prev');
  const btnNext = document.getElementById('prod-conflict-next');

  btnPrev?.addEventListener('click', () => {
    saveCurrentDecision();
    if (currentConflictIndex > 0) {
      currentConflictIndex--;
      renderProductConflictModal();
    }
  });

  btnNext?.addEventListener('click', () => {
    saveCurrentDecision();
    if (currentConflictIndex < excelConflicts.length - 1) {
      currentConflictIndex++;
      renderProductConflictModal();
    } else {
      console.log('Produkt-Konflikt-Entscheidungen (Preview):', conflictDecisions);
      closeProductConflictModal();
      // 🔜 hier später: Entscheidungen ans Backend schicken
    }
  });
}

function saveCurrentDecision() {
  const modalRoot = document.getElementById('prod-conflict-modal');
  if (!modalRoot) return;

  const checked = modalRoot.querySelector('input[name="prod-conflict-choice"]:checked');
  if (checked) {
    conflictDecisions[currentConflictIndex].choice = checked.value;
  }
}

function closeProductConflictModal() {
  const overlay = document.getElementById('prod-conflict-overlay');
  const modalRoot = document.getElementById('prod-conflict-modal');
  if (overlay) overlay.style.display = 'none';
  if (modalRoot) modalRoot.style.display = 'none';
}

// === Diff-Logik ================================================

function valuesEqual(a, b) {
  if (a == null && b == null) return true;

  const aNum = Number(a);
  const bNum = Number(b);
  if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) {
    return aNum === bNum;
  }

  return String(a) === String(b);
}

function buildDiffRows(conflict) {
  const rows = [];
  const oldObj = conflict.old || {};
  const newObj = conflict.new || {};

  const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);

  for (const key of allKeys) {
    const oldVal = oldObj[key];
    const newVal = newObj[key];

    if (!valuesEqual(oldVal, newVal)) {
      rows.push({ key, oldVal, newVal });
    }
  }
  return rows;
}



