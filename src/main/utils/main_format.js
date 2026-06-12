const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { spawn } = require('child_process');
const electron = require('electron');
const app = electron.app || electron.remote.app;
require('dotenv').config();


function formatColumns(rows) {
  const firstRow = rows[0];
  const formatColumnsList = [
    'TRADE_ID', 'EUSWAP', 'EUSWAP_SZ1', 'RATES', 'NOTIONAL', 'NAV', 'COUPON',
    'START_DATE', 'MATURITY', 'TRADE_DATE', 'CS_SPREAD_OVERRIDE_BP', 'clean_price',
    'GEARING', 'FLOOR', 'CAP', 'SPREADS', 'DATE',
    'EU_1Y', 'EU_5Y', 'EU_10Y', 'EU_20Y', 'EU_30Y',
    'US_AAA', 'US_AA', 'US_A', 'US_BBB', 'US_BB', 'VaR', 'ES'
  ];

  return rows.map(row => {
    const formattedRow = { ...row };

    formatColumnsList.forEach(column => {
      if (!(column in firstRow)) return;

      switch (column) {
        case 'NOTIONAL':
        case 'NAV':
        case 'LGD': {
          const Value = Math.trunc(row[column]);
          formattedRow[column] = Value.toString();
          break;
        }

        case 'TRADE_ID': {
          formattedRow[column] = row[column]?.toString?.() ?? row[column];
          break;
        }

        case 'START_DATE':
        case 'MATURITY':
        case 'TRADE_DATE':
        case 'DATE': {
          const raw = row[column];
          if (raw == null || raw === '') { formattedRow[column] = ''; break; }
          const s = String(raw).trim();

          // keep tokens/relative strings untouched (renderer will handle them)
          if (/^today(?:\s*[+-]\s*\d+)?$/i.test(s) || /^(\d+)\s*[dwmy]$/i.test(s)) {
            formattedRow[column] = s;
            break;
          }

          // already DD-MM-YYYY -> keep
          if (/^\d{2}-\d{2}-\d{4}$/.test(s)) {
            formattedRow[column] = s;
            break;
          }

          // ISO/SQLite YYYY-MM-DD[...] -> convert to DD-MM-YYYY
          if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
            const d = s.slice(8, 10), m = s.slice(5, 7), y = s.slice(0, 4);
            formattedRow[column] = `${d}-${m}-${y}`;
            break;
          }

          // If it's a real Date object or a parseable timestamp, format it; else keep as-is
          const maybeDate = (raw instanceof Date) ? raw : new Date(s);
          if (!Number.isNaN(maybeDate.getTime())) {
            const dd = String(maybeDate.getDate()).padStart(2, '0');
            const mm = String(maybeDate.getMonth() + 1).padStart(2, '0');
            const yy = maybeDate.getFullYear();
            formattedRow[column] = `${dd}-${mm}-${yy}`;
          } else {
            formattedRow[column] = s; // do NOT turn into NaN-NaN-NaN
          }
          break;
        }

        case 'CS_SPREAD_OVERRIDE_BP': {
          formattedRow[column] = row[column];
          break;
        }

        case 'clean_price': {
          formattedRow[column] = row[column] != null
            ? `<span style="color: orange; display: flex; justify-content: center;">${(row[column] * 100).toFixed(3)}%</span>`
            : "";
          break;
        }

        case 'COUPON':
        case 'GEARING':
        case 'FLOOR':
        case 'CAP':
        case 'SPREADS':
        case 'EUSWAP':
        case 'EUSWAP_SZ1':
        case 'RATES': {
          formattedRow[column] = row[column] != null ? (row[column] * 100).toFixed(3) + '%' : "";
          break;
        }

        case 'EU_1Y':
        case 'EU_5Y':
        case 'EU_10Y':
        case 'EU_20Y':
        case 'EU_30Y':
        case 'VaR':
        case 'ES': {
          formattedRow[column] = row[column] != null ? row[column].toFixed(3) : "";
          break;
        }

        default:
          break;
      }
    });

    return formattedRow;
  });
}



  //Transform Date
  function formatDate(row, allowedColumns = null) {
    const cleanRow = {};
    const excelEpoch = new Date(Date.UTC(1899, 11, 30)); // Excel epoch = 1899-12-30
  
    for (const [key, value] of Object.entries(row)) {
      if (
        key &&
        !key.startsWith('__EMPTY') &&
        key.trim() !== '' &&
        key !== 'TRADE_ID' &&
        (!allowedColumns || allowedColumns.includes(key))
      ) {
        const keyUpper = key.toUpperCase();
        const isDateField = ['DATE', 'MATURITY', 'START_DATE', 'TRADE_DATE'].some(keyword =>
          keyUpper.includes(keyword)
        );
  
        if (isDateField && typeof value === 'number') {
          const date = new Date(excelEpoch.getTime() + value * 86400 * 1000);
          cleanRow[key] = date.toISOString().split('T')[0]; // e.g., "2025-04-28"
        } else {
          cleanRow[key] = value;
        }
      }
    }
  
    return cleanRow;
  }
  


  
  
   
  
module.exports = { formatColumns, formatDate };
  