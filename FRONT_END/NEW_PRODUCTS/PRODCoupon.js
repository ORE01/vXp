import { appState } from '../renderer.js';
import { handleModalAction, saveChanges, addSaveButtonHandler, addNewRow} from '../../MODAL_HELPER/ModalActionHandler.js';
import { convertDateToISO, toISODate} from '../../utils/format.js';
import { makeModalDraggable} from '../../MODAL_HELPER/DraggableModal.js';


export function handleCouponModal(prodId, couponSchedule, startDate, maturity, couponfreq) {

  const modalContent = document.querySelector('.modal-content');
  if (!modalContent) {
    console.warn('Modal content container not found!');
    return;
  }
// COUPON BUTTON:

  // COUPON button: Check exists to prevent duplicates
  let couponButton = document.getElementById('coupon-button');
  if (!couponButton) {
    // Create the button
    couponButton = document.createElement('button');
    couponButton.id = 'coupon-button';
    couponButton.textContent = 'Coupon Schedule';
    couponButton.classList.add('chart-button'); // Use the same style class as your other buttons

    // COUPON button: Append to the modal (next to Save/Delete buttons)
    const saveButton = document.getElementById('saveButton');
    if (saveButton) {
      saveButton.parentElement.appendChild(couponButton);
    } else {
      console.warn('Save button not found! Adding the coupon button at the end.');
      modalContent.appendChild(couponButton);
    }
  }

  // COUPON SCHEDULE: EVENT LISTENER with the current prodId

  couponButton.onclick = async () => {
    try {
      await handleCouponData(
        prodId,
        couponSchedule, // <— statt "schedule"
        startDate,
        maturity,
        couponfreq
      );
    } catch (e) {
      console.error('[handleCouponModal] handleCouponData Fehler:', e);
    }
  };
  
}





function handleCouponData(prodId, couponSchedule, startDate, maturity, couponfreq) {
  const receivedData = appState.getCouponData();
  if (!Array.isArray(receivedData)) {
    console.error("❌ Error: receivedData is not an array", receivedData);
    return;
  }

  const filteredData = receivedData
    .filter(item => String(item.PROD_ID) === String(prodId))
    .sort((a, b) => {
      const ad = String(a.DATE ?? '');
      const bd = String(b.DATE ?? '');
      return ad.localeCompare(bd) || ((a.ID ?? 0) - (b.ID ?? 0));
    });

  // Altes Modal entfernen
  const existingModal = document.getElementById('coupon-modal');
  if (existingModal) existingModal.remove();

  // Modal + Content
  const modal = document.createElement('div');
  modal.id = 'coupon-modal';
  modal.classList.add('modal');

  const modalContent = document.createElement('div');
  modalContent.classList.add('modal-content', 'draggable');

  // Close
  const closeButton = document.createElement('span');
  closeButton.classList.add('close');
  closeButton.innerHTML = '&times;';
  closeButton.onclick = () => document.body.removeChild(modal);
  modalContent.appendChild(closeButton);

  // 🔹 NEU: Maximize-Toggle
  let isFullscreen = false;

  const maxBtn = document.createElement('button');
  maxBtn.type = 'button';
  maxBtn.classList.add('modal-maximize-btn');
  maxBtn.textContent = '⛶'; // Symbol für Vollbild

  maxBtn.onclick = () => {
    isFullscreen = !isFullscreen;

    if (isFullscreen) {
      // Vollbild aktivieren
      modalContent.classList.add('fullscreen');

      // Close-Button AUSBLENDEN
      closeButton.style.display = 'none';

      // Inline-Styles zurücksetzen, damit CSS-Fullscreen sauber greift
      modalContent.style.left = '';
      modalContent.style.top = '';
      modalContent.style.width = '';
      modalContent.style.height = '';
      modalContent.style.transform = '';
    } else {
      // Vollbild verlassen
      modalContent.classList.remove('fullscreen');

      // Close-Button wieder EINBLENDEN
      closeButton.style.display = '';

      // Position wird beim nächsten Drag neu gesetzt
      modalContent.style.left = '';
      modalContent.style.top = '';
      modalContent.style.width = '';
      modalContent.style.height = '';
      modalContent.style.transform = '';
    }
  };


  modalContent.appendChild(maxBtn);

  // Titel
  const title = document.createElement('h2');
  title.textContent = `${prodId}`;
  modalContent.appendChild(title);


  // Formular aufbauen (leer vs. bestehend)
  const isEmptySchedule = Number(couponSchedule) === 1 && filteredData.length === 0;
  let couponForm = null;

  if (isEmptySchedule) {
    const generatedData = generateEmptyCouponFormData(prodId, startDate, maturity, couponfreq);
    couponForm = generateCouponForm(generatedData);
  } else {
    couponForm = generateCouponForm(filteredData);
  }

// Button-Leiste (immer beide Buttons anzeigen)
const btnWrap = document.createElement('div');
btnWrap.style.display = 'flex';
btnWrap.style.gap = '8px';
btnWrap.style.marginBottom = '8px';

const saveBtn = document.createElement('button');
saveBtn.id = 'couponSaveBtn';
saveBtn.textContent = 'Save Changes';
// gleiche Optik wie andere Edit-Buttons
saveBtn.classList.add('edit-button');

const delBtn = document.createElement('button');
delBtn.id = 'couponDeleteBtn';
delBtn.textContent = 'Delete Schedule';
// Basis-Style von edit-button + extra Danger-Style
delBtn.classList.add('edit-button', 'delete-button');

// wenn du vorerst kein extra CSS willst, könntest du auch hier
// zusätzlich inline stylen – aber schöner ist eine Klasse.


  // Handler pro Modus
  if (isEmptySchedule) {
    // Save: neu einfügen (sequenziell)
    saveBtn.onclick = async () => {
      const rows = Array.from(couponForm.querySelectorAll('.coupon-row'));
      if (!rows.length) return;

      let prevNotional = null;

      for (const row of rows) {
        const dateEl   = row.querySelector('[data-field="DATE"]');
        const fixcfEl  = row.querySelector('[data-field="FIX_CF"]');
        const callEl   = row.querySelector('[data-field="CALL"]');
        const zeroEl   = row.querySelector('[data-field="ZERO"]');
        const notionEl = row.querySelector('[data-field="Notional_Factor"]');

        const DATE = toISODate(dateEl?.value || '');
        const FIX_CF = parsePercentToDecimal(fixcfEl?.value);
        const CALL = callEl?.checked ? 1 : 0;
        const ZERO = zeroEl?.checked ? 1 : 0;

        const rawNotional = (notionEl?.value ?? '').trim();

        // ⬇️ NUR HIER MINIMALER FIX:
        // Berechneten Factor weiterhin via resolveNotional,
        // und WENN es eine Formel ist, zusätzlich den Formel-String mitspeichern.
        let Notional_Factor = resolveNotional(rawNotional, prevNotional);
        let Notional_Formula = rawNotional.startsWith('=') ? rawNotional : null;

        if (Number.isFinite(Notional_Factor)) {
          prevNotional = Notional_Factor;
        }

        const newRowData = {
          PROD_ID: String(prodId),
          DATE,
          FIX_CF,
          CALL,
          ZERO,
          Notional_Factor,
          ...(Notional_Formula ? { Notional_Formula } : {})
        };

        await addNewRow(newRowData, 'ProdCouponSchedules');
      }

      document.body.removeChild(modal);
      window.api?.send?.('fetch-table-data', 'ProdCouponSchedules');
    };

    // Delete: bei leerem Schedule — sichtbar aber disabled
    delBtn.disabled = true;

  } else {
    // Save: bestehende Zeilen aktualisieren
    saveBtn.onclick = () => {
      saveCouponChanges(filteredData, couponForm);
      document.body.removeChild(modal);
    };

    // Delete-All: alle persistierten Zeilen (dieser PROD_ID) löschen
    delBtn.onclick = async () => {
      const idInputs = couponForm.querySelectorAll("input[data-field='ID']");
      const ids = Array.from(idInputs)
        .map(el => Number((el.value || '').trim()))
        .filter(n => Number.isFinite(n) && n > 0);

      if (!ids.length) {
        document.body.removeChild(modal);
        return;
      }

      try {
        for (const id of ids) {
          const rowEl = couponForm
            .querySelector(`.coupon-row input[data-field='ID'][value="${id}"]`)
            ?.closest('.coupon-row');
          await eraseCouponRow(id, rowEl);
        }
        window.api?.send?.('fetch-table-data', 'ProdCouponSchedules');
        document.body.removeChild(modal);
      } catch (e) {
        console.error('[delete schedule] error:', e);
        const err = document.createElement('div');
        err.style.color = '#b00020';
        err.style.marginTop = '8px';
        err.textContent = 'Löschen fehlgeschlagen: ' + (e?.message || e);
        modalContent.appendChild(err);
      }
    };
  }

  btnWrap.appendChild(saveBtn);
  btnWrap.appendChild(delBtn);

  // Zusammenbauen & anzeigen
  modalContent.appendChild(btnWrap);
  modalContent.appendChild(couponForm);


  makeModalDraggable(modalContent);

  modal.appendChild(modalContent);
  document.body.appendChild(modal);
  modal.style.display = 'block';
}

    function generateEmptyCouponFormData(prodId, startDate, maturity, couponfreq) {
      const schedule = [];
      const start = new Date(convertDateToISO(startDate));
      const end   = new Date(convertDateToISO(maturity));
      if (isNaN(start) || isNaN(end) || couponfreq <= 0) return schedule;

      const intervalInMonths = Math.round((1 / couponfreq) * 12);
      let currentDate = new Date(start);
      let rowCounter = 1;

      while (currentDate <= end) {
        // Temp-ID nur für die UI (NICHT in DB schreiben)
        const tmpId = `tmp_${prodId}_${rowCounter}_${Date.now()}`;

        schedule.push({
          // ID:  ❌ NICHT setzen (DB vergibt sie)
          TMP_ID: tmpId,                       // ✅ nur für UI
          PROD_ID: String(prodId),
          DATE: convertDateToISO(currentDate.toISOString().split("T")[0]),
          FIX_CF: "",
          CALL: 0,
          ZERO: 0,
          Notional_Factor: ""
        });

        currentDate.setMonth(currentDate.getMonth() + intervalInMonths);
        rowCounter++;
      }
      return schedule;
    }
    function generateCouponForm(data) {
      const form = document.createElement('form');
      form.id = 'coupon-form';
      form.appendChild(createHeaderRow());
  
      data.forEach((item, index) => {
          form.appendChild(createCouponRow(item, index, data));
      });
  
      return form;
    }
        function createHeaderRow() {
          const headerRow = document.createElement('div');
          headerRow.classList.add('coupon-header');
          headerRow.style.display = 'flex';
          headerRow.style.gap = '5px';
          headerRow.style.alignItems = 'center';

          headerRow.innerHTML = `
            <div style="width: 120px; font-weight: bold;">DATE</div>

            <div style="display: flex; flex-direction: column; align-items: center; width: 110px;">
              <span style="font-weight: bold;">FIX_CF</span>
              <span style="font-size: 12px;">🡇 Fill</span>
            </div>

            <div style="display: flex; flex-direction: column; align-items: center; width: 90px;">
              <span style="font-weight: bold;">CALL</span>
              <span style="font-size: 12px;">🡇 Fill</span>
            </div>

            <div style="display: flex; flex-direction: column; align-items: center; width: 90px;">
              <span style="font-weight: bold;">ZERO</span>
              <span style="font-size: 12px;">🡇 Fill</span>
            </div>

            <div style="display: flex; flex-direction: column; align-items: center; width: 140px;">
              <span style="font-weight: bold;">Notional_Factor</span>
              <span style="font-size: 12px;">🡇 Fill</span>
            </div>

            <div style="width: 50px; font-weight: bold; text-align:center;">DEL</div>
          `;
          return headerRow;
        }
        function createCouponRow(item, index, receivedData) {
          const formattedFixCF = item.FIX_CF
            ? `${(parseFloat(item.FIX_CF) * 100).toFixed(4)}%`
            : '0.0000%';

          // Notional-Anzeige: Formel (="...") zeigen, sonst Wert
          let notionalDisplayValue = '';
          let evaluatedValue = item.Notional_Factor;

          if (item.Notional_Formula) {
            if (String(item.Notional_Formula).startsWith('=')) {
              const formula  = item.Notional_Formula.slice(1);
              const prevItem = index > 0 ? receivedData[index - 1] : {};
              const context  = { prev: parseFloat(prevItem.Notional_Factor) || 0 };
              const result   = evaluateFormula(formula, context);
              evaluatedValue = result;
              notionalDisplayValue = item.Notional_Formula; // Formel anzeigen
            } else {
              notionalDisplayValue = item.Notional_Formula;
              evaluatedValue = parseFloat(item.Notional_Formula);
            }
          } else {
            notionalDisplayValue = item.Notional_Factor ?? '';
          }

          const row = document.createElement('div');
          row.classList.add('coupon-row');
          row.style.display = 'flex';
          row.style.gap = '5px';
          row.style.alignItems = 'center';

          row.innerHTML = `
            <input type="hidden" value="${item.ID ?? ''}" data-field="ID" data-row-index="${index}">
            <input type="hidden" value="${item.PROD_ID}" data-field="PROD_ID" data-row-index="${index}">

            <input type="date" class="col-date"
                  value="${convertDateToISO(item.DATE)}"
                  data-field="DATE" data-row-index="${index}" style="width:120px">

            <input type="text" class="col-fixcf"
                  value="${formattedFixCF}"
                  data-field="FIX_CF" data-row-index="${index}" style="width:110px">
            <button type="button" class="fill-down-btn fill-down-fixcf">🡇</button>

            <input type="checkbox" class="col-call"
                  ${item.CALL == 1 ? 'checked' : ''} data-field="CALL"
                  data-row-index="${index}" style="width:20px">
            <button type="button" class="fill-down-btn fill-down-call">🡇</button>

            <input type="checkbox" class="col-zero"
                  ${item.ZERO == 1 ? 'checked' : ''} data-field="ZERO"
                  data-row-index="${index}" style="width:20px">
            <button type="button" class="fill-down-btn fill-down-zero">🡇</button>

            <input type="text" class="col-fixcf"
                  value="${notionalDisplayValue}"
                  data-field="Notional_Factor" data-row-index="${index}" style="width:140px">
            <button type="button" class="fill-down-btn fill-down-Notional_Factor">🡇</button>
          `;

          // %-Formatierung für FIX_CF (Eingabe)
          const fixCFInput = row.querySelector('[data-field="FIX_CF"]');
          fixCFInput.addEventListener('input', (event) => {
            let rawValue = event.target.value.replace('%', '');
            if (!isNaN(rawValue) && rawValue !== '') {
              const cursorPosition = event.target.selectionStart;
              event.target.value = `${parseFloat(rawValue).toFixed(4)}%`;
              event.target.setSelectionRange(cursorPosition, cursorPosition);
            } else {
              event.target.value = '';
            }
          });

          // Fill-Down FIX_CF
          const fillDownFixCF = row.querySelector('.fill-down-fixcf');
          fillDownFixCF.addEventListener('click', () => {
            const currentValue = fixCFInput.value;
            const allRows = document.querySelectorAll('.coupon-row');
            for (let i = index + 1; i < allRows.length; i++) {
              const targetInput = allRows[i].querySelector('[data-field="FIX_CF"]');
              if (targetInput) targetInput.value = currentValue;
            }
          });

          // Fill-Down CALL
          const callInput = row.querySelector('[data-field="CALL"]');
          const fillDownCall = row.querySelector('.fill-down-call');
          fillDownCall.addEventListener('click', () => {
            const isChecked = callInput.checked;
            const allRows = document.querySelectorAll('.coupon-row');
            for (let i = index + 1; i < allRows.length; i++) {
              const targetCheckbox = allRows[i].querySelector('[data-field="CALL"]');
              if (targetCheckbox) targetCheckbox.checked = isChecked;
            }
          });

          // Fill-Down ZERO
          const zeroInput = row.querySelector('[data-field="ZERO"]');
          const fillDownZero = row.querySelector('.fill-down-zero');
          fillDownZero.addEventListener('click', () => {
            const isChecked = zeroInput.checked;
            const allRows = document.querySelectorAll('.coupon-row');
            for (let i = index + 1; i < allRows.length; i++) {
              const targetCheckbox = allRows[i].querySelector('[data-field="ZERO"]');
              if (targetCheckbox) targetCheckbox.checked = isChecked;
            }
          });

          // Fill-Down Notional_Factor
          const notionalInput = row.querySelector('[data-field="Notional_Factor"]');
          const fillDownBtn = row.querySelector('.fill-down-Notional_Factor');
          fillDownBtn.addEventListener('click', () => {
            const valueToFill = notionalInput.value;
            const allRows = document.querySelectorAll('.coupon-row');
            for (let i = index + 1; i < allRows.length; i++) {
              const targetInput = allRows[i].querySelector('[data-field="Notional_Factor"]');
              if (targetInput) targetInput.value = valueToFill;
            }
          });

          return row;
        }




function saveCouponChanges(couponData, couponForm) {
  const updatedData = [];

  const rows = couponForm.querySelectorAll(".coupon-row");
  rows.forEach((row, rowIndex) => {
    const dateInput = row.querySelector("input[data-field='DATE']");
    const fixCFInput = row.querySelector("input[data-field='FIX_CF']");
    const callInput = row.querySelector("input[data-field='CALL']");
    const zeroInput = row.querySelector("input[data-field='ZERO']");
    const notionalInput = row.querySelector("input[data-field='Notional_Factor']");

    if (!dateInput || !fixCFInput || !callInput || !zeroInput || !notionalInput) {
      console.warn(`Row ${rowIndex}: Missing input fields.`);
      return;
    }

    const datasetRowIndex = dateInput.dataset.rowIndex;
    if (!datasetRowIndex) {
      console.error(`Row ${rowIndex}: Missing data-row-index attribute.`);
      return;
    }

    // FIX_CF verarbeiten
    let fixCFValue = fixCFInput.value.replace('%', '').trim();
    fixCFValue = parseFloat(fixCFValue);
    if (!isNaN(fixCFValue)) {
      fixCFValue = fixCFValue / 100;
    } else {
      console.error(`Row ${rowIndex}: Invalid FIX_CF value '${fixCFInput.value}'`);
      fixCFValue = null;
    }

    // Notional_Factor und Notional_Formula verarbeiten
    let notionalFormula = notionalInput.value.trim();
    let notionalValue = null;

    if (notionalFormula.startsWith('=')) {
      const formulaBody = notionalFormula.slice(1); // entfernt das "="

      // Kontext für math.js – prev = vorheriger Notional_Factor
      const prevRow = rowIndex > 0 ? couponData[rowIndex - 1] : null;
      const context = {
        prev: prevRow ? parseFloat(prevRow.Notional_Factor) || 0 : 0
      };

      try {
        notionalValue = math.evaluate(formulaBody, context);

        // ✅ NEU: Berechneten Wert in couponData[rowIndex] eintragen
        if (!isNaN(notionalValue)) {
          couponData[rowIndex].Notional_Factor = notionalValue;
        }

      } catch (e) {
        console.error(`❌ Fehler bei Formel in Row ${rowIndex}: ${notionalFormula}`, e);
        notionalValue = null;
      }

    } else {
      // Kein "=" → direkter Wert
      notionalValue = parseFloat(notionalFormula);
      if (isNaN(notionalValue)) {
        console.error(`Row ${rowIndex}: Ungültiger Notional_Factor '${notionalFormula}'`);
        notionalValue = null;
      }
    }

    // Ursprüngliche Zeile aus den Originaldaten holen
    const rowData = couponData[datasetRowIndex];
    if (!rowData) {
      console.warn(`Row ${datasetRowIndex}: No matching data in couponData. Skipping.`);
      return;
    }

    // Neue Zeile zusammenstellen
    const updatedRow = {
      ID: rowData.ID,
      PROD_ID: rowData.PROD_ID,
      DATE: toISODate(dateInput.value),
      FIX_CF: fixCFValue,
      CALL: callInput.checked ? 1 : 0,
      ZERO: zeroInput.checked ? 1 : 0,
      Notional_Factor: notionalValue,
      Notional_Formula: notionalFormula.startsWith('=') ? notionalFormula : null
    };
    //ID: rowData.ID,

    updatedData.push(updatedRow);
  });

  // Änderungen speichern
  updatedData.forEach((row) => {
    const uniqueIdentifier = { column: "ID", value: row.ID };
    saveChanges(row, "ProdCouponSchedules", null, uniqueIdentifier);
  });
}
function eraseCouponRow(id, rowEl) {
  return new Promise((resolve, reject) => {
    if (!window.api?.send || !window.api?.once) {
      return reject(new Error('IPC bridge not available'));
    }

    // Listener einmalig binden
    const onSuccess = () => {
      // UI sofort aktualisieren
      try { rowEl?.remove(); } catch {}
      resolve();
    };
    const onError = (msg) => {
      reject(new Error(typeof msg === 'string' ? msg : (msg?.message || 'Unknown error')));
    };

    window.api.once('erase-data-success', onSuccess);
    window.api.once('erase-data-error', onError);

    // An Main senden
    window.api.send('erase-data', {
      cleanTableName: 'ProdCouponSchedules',
      uniqueIdentifier: { column: 'ID', value: id },
    });
  });
}



function evaluateFormula(expression, context = {}) {
  const src = String(expression || '').trim();
  if (!src) return NaN;

  // 1) Normalisieren: Komma als Dezimaltrenner zulassen
  const s = src.replace(/,/g, '.').replace(/\s+/g, '');

  // 2) Tokenisieren (nur erlaubte Tokens)
  const tokens = [];
  let i = 0;

  const isDigit = (ch) => /[0-9.]/.test(ch);

  while (i < s.length) {
    const ch = s[i];

    // Zahl
    if (isDigit(ch)) {
      let j = i + 1;
      while (j < s.length && isDigit(s[j])) j++;
      tokens.push({ type: 'num', value: parseFloat(s.slice(i, j)) });
      i = j;
      continue;
    }

    // prev
    if (s.startsWith('prev', i)) {
      tokens.push({ type: 'var', value: 'prev' });
      i += 4;
      continue;
    }

    // Operatoren
    if ('+-*/()'.includes(ch)) {
      tokens.push({ type: 'op', value: ch });
      i++;
      continue;
    }

    // Irgendwas Unerlaubtes?
    throw new Error(`Unerlaubtes Zeichen in Formel: "${ch}"`);
  }

  // 3) Shunting-Yard: In RPN umwandeln
  const out = [];
  const ops = [];
  const prec = { '+':1, '-':1, '*':2, '/':2 };

  for (const t of tokens) {
    if (t.type === 'num' || t.type === 'var') {
      out.push(t);
    } else if (t.type === 'op') {
      if (t.value === '(') {
        ops.push(t);
      } else if (t.value === ')') {
        while (ops.length && ops[ops.length-1].value !== '(') out.push(ops.pop());
        if (!ops.length) throw new Error('Klammern nicht ausgeglichen');
        ops.pop(); // '(' entfernen
      } else {
        while (ops.length &&
               ops[ops.length-1].type === 'op' &&
               ops[ops.length-1].value !== '(' &&
               prec[ops[ops.length-1].value] >= prec[t.value]) {
          out.push(ops.pop());
        }
        ops.push(t);
      }
    }
  }
  while (ops.length) {
    const op = ops.pop();
    if (op.value === '(' || op.value === ')') throw new Error('Klammern nicht ausgeglichen');
    out.push(op);
  }

  // 4) RPN auswerten
  const stack = [];
  const prevVal = Number.isFinite(context.prev) ? Number(context.prev) : 0;

  for (const t of out) {
    if (t.type === 'num') {
      stack.push(t.value);
    } else if (t.type === 'var') {
      if (t.value !== 'prev') throw new Error(`Unbekannte Variable: ${t.value}`);
      stack.push(prevVal);
    } else { // operator
      const b = stack.pop(); const a = stack.pop();
      if (!Number.isFinite(a) || !Number.isFinite(b)) throw new Error('Ungültiger Operandenwert');
      let r;
      switch (t.value) {
        case '+': r = a + b; break;
        case '-': r = a - b; break;
        case '*': r = a * b; break;
        case '/': r = b === 0 ? NaN : a / b; break;
        default: throw new Error(`Unbekannter Operator: ${t.value}`);
      }
      stack.push(r);
    }
  }

  if (stack.length !== 1) throw new Error('Formel konnte nicht ausgewertet werden');
  return stack[0];
}



function parsePercentToDecimal(str) {
  if (str == null) return null;
  const s = String(str).replace('%','').replace(',','.').trim();
  const num = parseFloat(s);
  return Number.isFinite(num) ? num / 100 : null;
}

function parseNumeric(str) {
  if (str == null) return null;
  const s = String(str).replace(',','.').trim();
  const num = parseFloat(s);
  return Number.isFinite(num) ? num : null;
}

function resolveNotional(inputVal, prevNotional) {
  const s = (inputVal || '').trim();
  if (!s) return null;
  if (s.startsWith('=')) {
    const expr = s.slice(1);
    const ctx  = { prev: parseFloat(prevNotional) || 0 };
    const val  = evaluateFormula(expr, ctx);
    return Number.isFinite(val) ? val : null;
  }
  return parseNumeric(s);
}





          



  
