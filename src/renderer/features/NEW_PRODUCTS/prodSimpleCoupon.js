    import { filteredIssuerData } from '../NEW_PRODUCTS/ISSUER.js';
    import { createDropdown } from '../../core/ui/MODAL_HELPER/HandleInputFields.js'
    import { convertDateToISO } from '../../utils/format.js';
    
    
   
export function handleProdAllFields(fieldName, rowData, formRow, label) {
  let couponSection = 'OTHER';
  if (HEADER_FIELDS.includes(fieldName)) {
    couponSection = 'HEADER';
  } else if (FIX_COUPON_FIELDS.includes(fieldName)) {
    couponSection = 'FIX';
  } else if (FLOATER_COUPON_FIELDS.includes(fieldName)) {
    couponSection = 'FLOATER';
  }

  formRow.setAttribute('data-coupon-section', couponSection);

  // ðŸ” Debug: Was passiert wirklich?
  //console.log('FIELD', fieldName, 'â†’ section', couponSection);

  const ctSelect = document.querySelector('select[data-field="CouponType"]');
  if (ctSelect && (couponSection === 'FIX' || couponSection === 'FLOATER')) {
    applyCouponTypeVisibility(ctSelect.value || 'FIX');
  }

  switch (fieldName) {

        case 'RANK': {
          const rankOptions = ['senior_secured', 'senior_preferred', 'senior_unsecured', 'senior_subordinated', 'junior_subordinated'];
          const rankDropdown = createDropdown(fieldName, rankOptions, rowData[fieldName]);
          formRow.appendChild(label);
          formRow.appendChild(rankDropdown);
          return true;
        }

case 'FINLIB': {
  const finLibOptions = ['ql', 'vxp'];

  // Wenn in rowData nichts oder etwas UngÃ¼ltiges steht â†’ auf 'ql' fallen
  const currentFinLib = finLibOptions.includes(rowData.FINLIB)
    ? rowData.FINLIB
    : 'ql';

  const finLibDropdown = createDropdown(fieldName, finLibOptions, currentFinLib);
  finLibDropdown.setAttribute('data-field', fieldName);

  finLibDropdown.addEventListener('change', (e) => {
    const selectedFinLib = e.target.value;
    const modelSelect = document.querySelector('select[data-field="MODEL"]');
    if (!modelSelect) return;

    const rebuildModelOptions = (values) => {
      modelSelect.innerHTML = '';
      values.forEach((val) => {
        const opt = document.createElement('option');
        opt.value = val;
        opt.textContent = val;
        modelSelect.appendChild(opt);
      });
    };

    if (selectedFinLib === 'vxp') {
      // Nur LMM_vxp
      rebuildModelOptions(['LMM_vxp']);
      modelSelect.value = 'LMM_vxp';
    } else {
      // Nur DCF_ql
      rebuildModelOptions(['DCF_ql']);
      modelSelect.value = 'DCF_ql';
    }
  });

  formRow.appendChild(label);
  formRow.appendChild(finLibDropdown);
  return true;
}




case 'MODEL': {
  // FINLIB aus rowData lesen - Default ist ql
  const finLib = rowData.FINLIB === 'vxp' ? 'vxp' : 'ql';

  const modelOptions = finLib === 'vxp'
    ? ['LMM_vxp']
    : ['DCF_ql'];

  // rowData.MODEL nur Ã¼bernehmen, wenn es zu den Options passt
  const initialModel =
    modelOptions.includes(rowData.MODEL) ? rowData.MODEL : modelOptions[0];

  const modelDropdown = createDropdown(fieldName, modelOptions, initialModel);

  // Kennzeichnen, damit wir es im FINLIB-Listener finden
  modelDropdown.setAttribute('data-field', fieldName);

  formRow.appendChild(label);
  formRow.appendChild(modelDropdown);
  return true;
}



        

case 'CouponType': {
  const couponTypeOptions = ['FIX', 'FLOATER'];
  const couponTypeDropdown = createDropdown(fieldName, couponTypeOptions, rowData[fieldName]);

  couponTypeDropdown.classList.add('input-field');
  couponTypeDropdown.setAttribute('data-field', fieldName);

  formRow.appendChild(label);
  formRow.appendChild(couponTypeDropdown);

  const initialType = couponTypeOptions.includes(rowData[fieldName])
    ? rowData[fieldName]
    : 'FIX';

  couponTypeDropdown.value = initialType;

  // nach dem Rendern aller Rows anwenden
  setTimeout(() => {
    applyCouponTypeVisibility(initialType);
  }, 0);

  couponTypeDropdown.addEventListener('change', (e) => {
    applyCouponTypeVisibility(e.target.value);
  });

  return true;
}





        case 'MATURITY':
        case 'START_DATE': {
          // helpers
          const toISO = (d) => {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
          };
          const addYearsISO = (isoYMD, years) => {
            const [y, m, d] = isoYMD.split('-').map(Number);
            const base = new Date(y, m - 1, d);
            base.setFullYear(base.getFullYear() + Number(years || 0));
            return toISO(base);
          };
          const resolveStartToISO = (val) => {
            const s = String(val || '').trim().toLowerCase();
            if (s === 'today') return toISO(new Date());
            return convertDateToISO(val); // your existing function
          };

          // main date input (unchanged)
          const dateInput = document.createElement('input');
          dateInput.type = 'date';
          dateInput.id = `${fieldName.toLowerCase()}Date`;
          dateInput.classList.add('input-field');
          dateInput.setAttribute('data-field', fieldName);

          // compute initial ISO for date input
          let isoDate = '';
          if (fieldName === 'START_DATE') {
            isoDate = rowData.START_DATE ? resolveStartToISO(rowData.START_DATE) : '';
          } else {
            const rawMat = String(rowData.MATURITY ?? '').trim();
            const relY = /^\s*(\d+)\s*y\s*$/i.exec(rawMat);
            if (relY) {
              const baseStartISO = resolveStartToISO(rowData.START_DATE);
              isoDate = baseStartISO ? addYearsISO(baseStartISO, Number(relY[1])) : '';
            } else {
              isoDate = rowData.MATURITY ? convertDateToISO(rowData.MATURITY) : '';
            }
          }
          dateInput.value = isoDate || '';

          // --- NEW: small token input to allow typing 'today' / '11y' ---
          const tokenInput = document.createElement('input');
          tokenInput.type = 'text';
          tokenInput.id = `${fieldName.toLowerCase()}Token`;
          tokenInput.classList.add('input-field');
          tokenInput.style.width = '72px';
          tokenInput.style.marginLeft = '8px';
          tokenInput.placeholder = fieldName === 'START_DATE' ? 'today' : 'e.g. 11y';

          const rawOriginal = String(rowData[fieldName] ?? '').trim();
          if (fieldName === 'START_DATE') {
            if (/^today$/i.test(rawOriginal)) tokenInput.value = 'today';
          } else {
            const m = /^\s*(\d+)\s*y\s*$/i.exec(rawOriginal);
            if (m) tokenInput.value = `${m[1]}y`;
          }

          // wiring: when token changes, recompute the date field
          tokenInput.addEventListener('input', () => {
            const t = tokenInput.value.trim();

            if (fieldName === 'START_DATE') {
              if (/^today$/i.test(t)) {
                dateInput.value = toISO(new Date());
              }
              // otherwise leave date unchanged
            } else {
              const m = /^\s*(\d+)\s*y\s*$/i.exec(t);
              if (m) {
                const baseStartISO =
                  resolveStartToISO(
                    // prefer current start-date input if present in DOM; else fall back to rowData
                    (document.getElementById('start_dateDate')?.value || rowData.START_DATE)
                  ) || toISO(new Date());
                dateInput.value = addYearsISO(baseStartISO, Number(m[1]));
              }
            }
          });

          // if user changes date manually, clear token (date becomes source of truth)
          dateInput.addEventListener('change', () => {
            tokenInput.value = '';
          });

          // append
          formRow.appendChild(label);
          formRow.appendChild(dateInput);
          formRow.appendChild(tokenInput);
          return true;
        }






        case 'TENOR': {
          const tenorOptions = ['1', '2', '4'];
          const tenorDropdown = createDropdown(fieldName, tenorOptions, rowData[fieldName]);
          formRow.appendChild(label);
          formRow.appendChild(tenorDropdown);
          return true;
        }
        case 'ISSUER': {
          const issuerOptions = filteredIssuerData
            .map((issuer) => issuer.ISSUER)
            .filter(Boolean)
            .sort();
          const uniqueIssuerOptions = [...new Set(issuerOptions)];
          const issuerDropdown = createDropdown(fieldName, uniqueIssuerOptions, rowData[fieldName]);
        
          // Event Listener: Update Ticker when ISSUER changes
          issuerDropdown.addEventListener('change', function () {
            updateTickerDropdown(this.value);
          });
        
          formRow.appendChild(label);
          formRow.appendChild(issuerDropdown);
          return true;
        }
        
        case 'TICKER': {
          const tickerOptions = filteredIssuerData
            .map((issuer) => issuer.TICKER)
            .filter(Boolean)
            .sort();
          const uniqueTickerOptions = [...new Set(tickerOptions)];
          const tickerDropdown = createDropdown(fieldName, uniqueTickerOptions, rowData[fieldName]);
        
          // Event Listener: Update ISSUER when Ticker changes
          tickerDropdown.addEventListener('change', function () {
            updateIssuerDropdown(this.value);
          });
        
          formRow.appendChild(label);
          formRow.appendChild(tickerDropdown);
          return true;
        }
        case 'CS_Szenario': {
          const input = document.createElement('input');
          input.type = 'text';
          input.classList.add('input-field');
          input.value = rowData[fieldName] ?? ''; // zeigt auch 0 an
          input.setAttribute('data-field', fieldName);
        
          formRow.appendChild(label);
          formRow.appendChild(input);
          return true;
        }
        
        

        default:
          return false; // Return false if no case matches
      }
    }
        function updateTickerDropdown(selectedIssuer) {
          const tickerDropdown = document.querySelector('[data-field="TICKER"]');
          if (!tickerDropdown) return;
        
          // Find the corresponding Ticker for the selected Issuer
          const matchedTicker = filteredIssuerData.find((item) => item.ISSUER === selectedIssuer)?.TICKER;
        
          // Update the Ticker dropdown
          tickerDropdown.innerHTML = '';
          if (matchedTicker) {
            const option = document.createElement('option');
            option.value = matchedTicker;
            option.textContent = matchedTicker;
            tickerDropdown.appendChild(option);
            tickerDropdown.value = matchedTicker; // Auto-select the value
          }
        }
        function updateIssuerDropdown(selectedTicker) {
          const issuerDropdown = document.querySelector('[data-field="ISSUER"]');
          if (!issuerDropdown) return;
        
          // Find the corresponding Issuer for the selected Ticker
          const matchedIssuer = filteredIssuerData.find((item) => item.TICKER === selectedTicker)?.ISSUER;
        
          // Update the Issuer dropdown
          issuerDropdown.innerHTML = '';
          if (matchedIssuer) {
            const option = document.createElement('option');
            option.value = matchedIssuer;
            option.textContent = matchedIssuer;
            issuerDropdown.appendChild(option);
            issuerDropdown.value = matchedIssuer; // Auto-select the value
          }
        }  




// ðŸ§± Abschnitts-Definitionen
const HEADER_FIELDS = [
  'INCLUDE',
  'PROD_ID',
  'DESCRIPTION',
  'ISSUER',
  'TICKER',
  'RANK',
  'RATING_PROD',
  'CouponType'
];

// Nur bei FIX anzeigen
const FIX_COUPON_FIELDS = [
// 'START_DATE',
// 'MATURITY',
  'COUPON',
];

// Nur bei FLOATER anzeigen
const FLOATER_COUPON_FIELDS = [
// 'START_DATE',
// 'MATURITY',
  'GEARING',
  'SPREADS',
  'CAP',
  'FLOOR',
];


// Helper zum Ein-/Ausblenden je nach CouponType
function applyCouponTypeVisibility(couponType) {
  console.log('ðŸ’¡ applyCouponTypeVisibility called with:', couponType);

  // GLOBAL suchen - egal in welchem Modal der Editor steckt
  const fixRows = document.querySelectorAll('[data-coupon-section="FIX"]');
  const floaterRows = document.querySelectorAll('[data-coupon-section="FLOATER"]');

  console.log('ðŸ’¡ GLOBAL FIX rows:', fixRows.length, 'FLOATER rows:', floaterRows.length);

  fixRows.forEach(row => {
    row.style.display = (couponType === 'FIX') ? '' : 'none';
  });

  floaterRows.forEach(row => {
    row.style.display = (couponType === 'FLOATER') ? '' : 'none';
  });
}





