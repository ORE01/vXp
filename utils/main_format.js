const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { spawn } = require('child_process');
const electron = require('electron');
const app = electron.app || electron.remote.app;
require('dotenv').config();





function formatColumns(rows) {
    const firstRow = rows[0];
    const formatColumns = [
      'TRADE_ID', 'EUSWAP', 'EUSWAP_SZ1', 'RATES', 'NOTIONAL', 'NAV', 'COUPON', 'START_DATE', 'MATURITY', 'TRADE_DATE',
      'CS_Szenario', 'clean_price', 'GEARING', 'FLOOR', 'CAP', 'SPREADS',
      'DATE', 'EU_1Y', 'EU_5Y', 'EU_10Y', 'EU_20Y', 'EU_30Y', 'US_AAA', 'US_AA', 'US_A', 'US_BBB', 'US_BB',
      'VaR', 'ES'
    ];
  
    return rows.map(row => {
      const formattedRow = { ...row };
      
      formatColumns.forEach(column => {
        if (column in firstRow) {
          switch (column) {
            case 'NOTIONAL':
            case 'NAV':
            case 'LGD':
              const Value = Math.trunc(row[column]);
              formattedRow[column] = Value.toString();
              break; 
            case 'TRADE_ID':
              formattedRow[column] = row[column].toString();
              break;
            case 'START_DATE':
            case 'MATURITY':
            case 'TRADE_DATE':
            case 'DATE':
              const date = new Date(row[column]);
              const day = date.getDate().toString().padStart(2, '0');
              const month = (date.getMonth() + 1).toString().padStart(2, '0');
              const year = date.getFullYear();
              const formattedDate = `${day}-${month}-${year}`;
              formattedRow[column] = formattedDate;
              break;
            case 'CS_Szenario': 
              formattedRow[column] = row[column];
              break;
            case 'clean_price':
              // Display as an empty string if value is null or NaN
              formattedRow[column] = row[column] != null ? `<span style="color: orange; display: flex; justify-content: center;">${(row[column] * 100).toFixed(3)}%</span>` : "";
              break;
            case 'COUPON':
            case 'GEARING':
            case 'FLOOR':
            case 'CAP':
            case 'SPREADS':
            case 'EUSWAP':
            case 'EUSWAP_SZ1':
            case 'RATES':
              // Display as an empty string if value is null or NaN
              formattedRow[column] = row[column] != null ? (row[column] * 100).toFixed(3) + '%' : "";
              break;
            case 'EU_1Y':
            case 'EU_5Y':
            case 'EU_10Y':
            case 'EU_20Y':
            case 'EU_30Y':
            case 'VaR':
            case 'ES':
              // Display as an empty string if value is null or NaN
              formattedRow[column] = row[column] != null ? row[column].toFixed(3) : "";
              break;
            default:
              break;
          }
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
  