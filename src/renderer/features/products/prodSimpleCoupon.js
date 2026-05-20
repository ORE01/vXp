    import { filteredIssuerData } from '../products/ISSUER.js';
    import { createDropdown } from '../../core/ui/modal/modalFields.js'
    import { convertDateToISO } from '../../utils/format.js';
    import { PRODUCT_FIELD_CONFIG } from './productFieldConfig.js';
    
    
   
export function handleProductFields(fieldName, rowData, formRow, label) {
  const uiMode = rowData.__UI_MODE__ || 'FIX';
  let couponSection = 'OTHER';
  if (HEADER_FIELDS.includes(fieldName)) {
    couponSection = 'HEADER';
  } else if (FIX_COUPON_FIELDS.includes(fieldName)) {
    couponSection = 'FIX';
  } else if (
    FLOATER_COUPON_FIELDS.includes(fieldName) ||
    FRN_INDEX_FIELDS.includes(fieldName)
  ) {
    couponSection = 'FLOATER';
  }

  formRow.setAttribute('data-coupon-section', couponSection);

  // Debug: Was passiert wirklich?
  //console.log('FIELD', fieldName, 'â†’ section', couponSection);

    if (couponSection === 'FIX' || couponSection === 'FLOATER') {
      applyCouponTypeVisibility(uiMode);
    }

    const fieldConfig = PRODUCT_FIELD_CONFIG?.[fieldName];

    if (fieldConfig?.type === 'select') {
      const options = fieldConfig.options || [];
      const value = rowData[fieldName] ?? fieldConfig.defaultValue ?? '';

      const dropdown = createDropdown(
        fieldName,
        options,
        value
      );

      dropdown.setAttribute('data-field', fieldName);

      formRow.appendChild(label);
      formRow.appendChild(dropdown);
      return true;
    }

    if (fieldConfig?.type === 'number') {
      const input = document.createElement('input');
      input.type = 'number';
      input.classList.add('input-field');
      input.value = rowData[fieldName] ?? fieldConfig.defaultValue ?? '';
      input.setAttribute('data-field', fieldName);

      formRow.appendChild(label);
      formRow.appendChild(input);
      return true;
    }

  switch (fieldName) {
    case '__PRODUCT_TEMPLATE__':
    case '__UI_MODE__': {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.value = rowData[fieldName] || '';
      input.setAttribute('data-field', fieldName);

      formRow.appendChild(input);
      return true;
    }

    case 'RANK': {
      const rankOptions = [
        'senior_secured',
        'senior_preferred',
        'senior_unsecured',
        'senior_subordinated',
        'junior_subordinated',
      ];

      const rankDropdown = createDropdown(
        fieldName,
        rankOptions,
        rowData[fieldName]
      );

      formRow.appendChild(label);
      formRow.appendChild(rankDropdown);
      return true;
    }

    case 'FINLIB': {
      const finLibOptions = ['ql', 'vxp'];

      const currentFinLib = finLibOptions.includes(rowData.FINLIB)
        ? rowData.FINLIB
        : 'ql';

      const finLibDropdown = createDropdown(
        fieldName,
        finLibOptions,
        currentFinLib
      );

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
          rebuildModelOptions(['LMM_vxp']);
          modelSelect.value = 'LMM_vxp';
        } else {
          rebuildModelOptions(['DCF_ql']);
          modelSelect.value = 'DCF_ql';
        }
      });

      formRow.appendChild(label);
      formRow.appendChild(finLibDropdown);
      return true;
    }

    case 'MODEL': {
      const finLib = rowData.FINLIB === 'vxp' ? 'vxp' : 'ql';

      const modelOptions = finLib === 'vxp'
        ? ['LMM_vxp']
        : ['DCF_ql'];

      const initialModel = modelOptions.includes(rowData.MODEL)
        ? rowData.MODEL
        : modelOptions[0];

      const modelDropdown = createDropdown(
        fieldName,
        modelOptions,
        initialModel
      );

      modelDropdown.setAttribute('data-field', fieldName);

      formRow.appendChild(label);
      formRow.appendChild(modelDropdown);
      return true;
    }

    case 'CouponType': {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.value = rowData[fieldName] || '';
      input.setAttribute('data-field', fieldName);

      formRow.appendChild(input);
      return true;
    }

    case 'MATURITY':
      
    case 'START_DATE': {
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
        return convertDateToISO(val);
      };

      const dateInput = document.createElement('input');
      dateInput.type = 'date';
      dateInput.id = `${fieldName.toLowerCase()}Date`;
      dateInput.classList.add('input-field');
      dateInput.setAttribute('data-field', fieldName);

      let isoDate = '';

      if (fieldName === 'START_DATE') {
        isoDate = rowData.START_DATE
          ? resolveStartToISO(rowData.START_DATE)
          : '';
      } else {
        const rawMat = String(rowData.MATURITY ?? '').trim();
        const relY = /^\s*(\d+)\s*y\s*$/i.exec(rawMat);

        if (relY) {
          const baseStartISO = resolveStartToISO(rowData.START_DATE);
          isoDate = baseStartISO
            ? addYearsISO(baseStartISO, Number(relY[1]))
            : '';
        } else {
          isoDate = rowData.MATURITY
            ? convertDateToISO(rowData.MATURITY)
            : '';
        }
      }

      dateInput.value = isoDate || '';

      const tokenInput = document.createElement('input');
      tokenInput.type = 'text';
      tokenInput.id = `${fieldName.toLowerCase()}Token`;
      tokenInput.classList.add('input-field');
      tokenInput.style.width = '72px';
      tokenInput.style.marginLeft = '8px';
      tokenInput.placeholder = fieldName === 'START_DATE'
        ? 'today'
        : 'e.g. 11y';

      const rawOriginal = String(rowData[fieldName] ?? '').trim();

      if (fieldName === 'START_DATE') {
        if (/^today$/i.test(rawOriginal)) {
          tokenInput.value = 'today';
        }
      } else {
        const m = /^\s*(\d+)\s*y\s*$/i.exec(rawOriginal);
        if (m) tokenInput.value = `${m[1]}y`;
      }

      tokenInput.addEventListener('input', () => {
        const t = tokenInput.value.trim();

        if (fieldName === 'START_DATE') {
          if (/^today$/i.test(t)) {
            dateInput.value = toISO(new Date());
          }
          return;
        }

        const m = /^\s*(\d+)\s*y\s*$/i.exec(t);
        if (!m) return;

        const baseStartISO =
          resolveStartToISO(
            document.getElementById('start_dateDate')?.value ||
            rowData.START_DATE
          ) || toISO(new Date());

        dateInput.value = addYearsISO(baseStartISO, Number(m[1]));
      });

      dateInput.addEventListener('change', () => {
        tokenInput.value = '';
      });

      formRow.appendChild(label);
      formRow.appendChild(dateInput);
      formRow.appendChild(tokenInput);
      return true;
    }

    case 'TENOR': {
      const tenorOptions = ['1', '2', '4'];
      const tenorDropdown = createDropdown(
        fieldName,
        tenorOptions,
        rowData[fieldName]
      );

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

      const issuerDropdown = createDropdown(
        fieldName,
        uniqueIssuerOptions,
        rowData[fieldName]
      );

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

      const tickerDropdown = createDropdown(
        fieldName,
        uniqueTickerOptions,
        rowData[fieldName]
      );

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
      input.value = rowData[fieldName] ?? '';
      input.setAttribute('data-field', fieldName);

      formRow.appendChild(label);
      formRow.appendChild(input);
      return true;
    }

    default:
      return false;
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




// Abschnitts-Definitionen
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
  'GEARING',
  'SPREADS',
  'CAP',
  'FLOOR',
];

const FRN_INDEX_FIELDS = [
  'REFERENCE_INDEX',
  'INDEX_TENOR',
  'RESET_TENOR',
  'PAYMENT_TENOR',
];


// Helper zum Ein-/Ausblenden je nach CouponType
function applyCouponTypeVisibility(couponType) {
  // console.log('applyCouponTypeVisibility called with:', couponType);

  // GLOBAL suchen - egal in welchem Modal der Editor steckt
  const fixRows = document.querySelectorAll('[data-coupon-section="FIX"]');
  const floaterRows = document.querySelectorAll('[data-coupon-section="FLOATER"]');

  // console.log('GLOBAL FIX rows:', fixRows.length, 'FLOATER rows:', floaterRows.length);

  fixRows.forEach(row => {
    row.style.display = (couponType === 'FIX') ? '' : 'none';
  });

  floaterRows.forEach(row => {
    row.style.display = (couponType === 'FLOATER') ? '' : 'none';
  });
}





