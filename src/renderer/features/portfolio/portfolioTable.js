import { filterColumnsInData } from '../../core/ui/modal/modalData.js';
import processData from '../../core/ui/modal/modalData.js';

import { appState } from '../../renderer.js';

import { addTooltipsForTruncatedText, addProdIdTooltips } from '../../utils/tooltips.js';
import { attachIdLinks } from '../../utils/linksToTables.js';
import { applyPortfolioTableColoring, applyCleanPriceHighlight } from '../../utils/tableCellColorize.js';
import { applyTableCellAlignment} from '../../utils/tableCellAlignment.js';

import {
  PORTFOLIO_TABLE_NAME,
  PORTFOLIO_INTERNAL_COLUMNS,
  PORTFOLIO_VISIBLE_COLUMNS,
} from './portfolioColumns.js';

import { enrichPortfolioRowsWithRisk } from './portfolioRiskEnrichment.js';
import { applyPortfolioDisplayNames } from './portfolioDisplayNames.js';

export function handlePortProdData(receivedData, index, port_name) {
  const elementId = `portDataContainer${index}`;

  if (!receivedData || !Array.isArray(receivedData) || receivedData.length === 0) {
    console.error('[portfolioTable] receivedData is empty or invalid');
    return;
  }

  const portDataContainer = document.getElementById(elementId);

  if (!portDataContainer) {
    console.error(`[portfolioTable] Element with id ${elementId} not found`);
    return;
  }

  const enrichedData = enrichPortfolioRowsWithRisk(receivedData, port_name);

  const filteredColumnsPortData = filterColumnsInData(
    enrichedData,
    PORTFOLIO_VISIBLE_COLUMNS
  );

  const filteredPortData = filterColumnsInData(
    enrichedData,
    PORTFOLIO_INTERNAL_COLUMNS
  );

  appState.setFilteredPortData(filteredPortData);

  const displayRows = applyPortfolioDisplayNames(filteredColumnsPortData);

  const portDataHTML = processData(displayRows, PORTFOLIO_TABLE_NAME);
  portDataContainer.innerHTML = portDataHTML;

  applyPortfolioTableColoring(portDataContainer);
  applyTableCellAlignment(portDataContainer);
  applyCleanPriceHighlight(portDataContainer);

  attachIdLinks(portDataContainer);

  addTooltipsForTruncatedText(portDataContainer);
  addProdIdTooltips(portDataContainer);
}

