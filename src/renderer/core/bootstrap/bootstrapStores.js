// src/renderer/core/bootstrap/bootstrapStores.js

import { installUIStateStore } from '../STATE/uiStateStore.js';
import { installDropdownFilterEngine } from '../STATE/dropdownFilterEngine.js';
import { installPortfolioDataStore } from '../STATE/portfolioDataStore.js';
import { installMarketRiskStore } from '../STATE/marketRiskStore.js';
import { installCreditRiskStore } from '../STATE/creditRiskStore.js';
import { installMarketDataStore } from '../STATE/marketDataStore.js';
import { installProductsStore } from '../STATE/productsStore.js';
import { installNameListsStore } from '../STATE/nameListsStore.js';
import { installCustomerReportsStore } from '../STATE/customerReportsStore.js';
import { installDataUpdatePipeline } from '../STATE/dataUpdatePipeline.js';
// import { installTableLayoutStore } from '../state/tableLayoutStore.js';

export function bootstrapStores(appState) {
  installUIStateStore({ appState });
  installDropdownFilterEngine({ appState });
  installPortfolioDataStore({ appState });
  installMarketRiskStore({ appState });
  installCreditRiskStore({ appState });
  installMarketDataStore({ appState });
  installProductsStore({ appState });
  installNameListsStore({ appState });
  installCustomerReportsStore({ appState });
  installDataUpdatePipeline({ appState });
  // installTableLayoutStore({ appState });
}

