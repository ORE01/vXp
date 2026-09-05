
import processData from '../../../core/ui/modal/modalData.js';

import { appState } from '../../../renderer.js';

import { addTooltipsForTruncatedText, addProdIdTooltips } from '../../../utils/tooltips.js';
import { formatNumberWithGrouping } from '../../../utils/tableCellFormats.js';
import { attachIdLinks } from '../../../utils/linksToTables.js';

import {
  PORTFOLIO_TABLE_NAME,
  PORTFOLIO_INTERNAL_COLUMNS,
} from './portfolioColumns.js';

import {
  enrichPortfolioRowsWithRisk,
} from './portfolioRiskEnrichment.js';

const pf = (v) => {
  if (v == null) return 0;
  const n = parseFloat(String(v).replace(/\s/g, ''));
  return Number.isFinite(n) ? n : 0;
};

const safeDiv = (num, den) => (den ? num / den : 0);

function mapPortDataToTableRows(data) {
  return [
    { label: 'Notional', value: data.formPortNotional },
    { label: 'NetAssetValue', value: data.formPortValue },
    { label: 'NetAssetValueBuy', value: data.formPortValueBuy },
    { label: 'Portfolio Yield', value: data.formPortYield },
    { label: 'Portfolio Yield (act)', value: data.formPortYieldA },
    { label: 'Interest Rate Sensitivity (PV01)', value: data.formPortPV01 },
    { label: 'Credit Spread Sensitivity (CPV01)', value: data.formPortCPV01 },
  ];
}

export function handlePortAggData(receivedData, index, port_name) {
  const elementId = `portDataContainer${index}`;
  const aggContainerId = `portAggDataContainer${index}`;

  if (!receivedData || !Array.isArray(receivedData)) {
    console.error('[portfolioAggregates] receivedData is empty or invalid');
    return;
  }


const enrichedData = enrichPortfolioRowsWithRisk(receivedData, port_name);
const aggRows = enrichedData;


  let PortValue = 0;
  let PortValueBuy = 0;
  let PortNotional = 0;
  let PortYield = 0;
  let PortYieldA = 0;
  let PortPV01 = 0;
  let PortCPV01 = 0;
  let PortTtM = 0;

  for (let i = 0; i < aggRows.length; i++) {
    const r = aggRows[i];

    const nav = pf(r.NAV);
    const notional = pf(r.NOTIONAL);
    const priceBuy = pf(r.PRICE_BUY);

    PortValue += nav;
    PortValueBuy += (priceBuy / 100) * notional;
    PortNotional += notional;

    PortYield += pf(r.ytmPort);
    PortYieldA += pf(r.ytmPortA);

    // now enriched from PortfolioRiskSensitivities
    PortPV01 += pf(r.PV01_BASE ?? r.RISK_TOTALS_BASE?.PV01 ?? 0);
    PortCPV01 += pf(r.CPV01_BASE ?? r.RISK_TOTALS_BASE?.CPV01 ?? 0);

    PortTtM += pf(r.TtM) * notional;
  }

  const aggData = {
    formPortValue: 'EUR ' + formatNumberWithGrouping(PortValue),
    formPortValueBuy: 'EUR ' + formatNumberWithGrouping(PortValueBuy),
    formPortNotional: 'EUR ' + formatNumberWithGrouping(PortNotional),
    formPortPV01abs: 'EUR ' + formatNumberWithGrouping(PortPV01),
    formPortCPV01abs: 'EUR ' + formatNumberWithGrouping(PortCPV01),
    // Rohe Zahlenwerte parallel zum formatierten String (format-once): "Save to Historic
    // Metrics" liest diese direkt, statt den de-DE-String ("212.380.052") zurueckzuparsen.
    formPortValueRaw: PortValue,
    formPortValueBuyRaw: PortValueBuy,
    formPortNotionalRaw: PortNotional,
    formPortPV01absRaw: PortPV01,
    formPortCPV01absRaw: PortCPV01,
    formPortYield: (safeDiv(PortYield, PortNotional) * 100).toFixed(2) + '%',
    formPortYieldA: (safeDiv(PortYieldA, PortNotional) * 100).toFixed(2) + '%',
    formPortPV01: (safeDiv(PortPV01, PortNotional) * 10000).toFixed(2),
    formPortCPV01: (safeDiv(PortCPV01, PortNotional) * 10000).toFixed(2),
    formPortTtM: safeDiv(PortTtM, PortNotional).toFixed(2),
  };

  appState.setPortAggData(elementId, aggData);

  const aggKeysToShow = [
    'formPortValue',
    'formPortValueBuy',
    'formPortNotional',
    'formPortYield',
    'formPortYieldA',
    'formPortPV01',
    'formPortCPV01',
    'formPortTtM',
  ];

  const portDataAggContainer = document.getElementById(aggContainerId);
  if (!portDataAggContainer) return;

  requestAnimationFrame(() => {
    const filteredAggData = Object.fromEntries(
      Object.entries(aggData).filter(([key]) => aggKeysToShow.includes(key))
    );

    const tableData = mapPortDataToTableRows(filteredAggData);
    const portDataHTML = processData(tableData, PORTFOLIO_TABLE_NAME);

    portDataAggContainer.innerHTML = portDataHTML;

    requestAnimationFrame(() => {
      addTooltipsForTruncatedText(portDataAggContainer);
      addProdIdTooltips?.(portDataAggContainer);
      attachIdLinks?.(portDataAggContainer);
    });
  });
}