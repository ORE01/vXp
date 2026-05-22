// src/renderer/core/bootstrap/bootstrapStores.js

import { installUIStateStore } from '../state/uiStateStore.js';
import { installDropdownFilterEngine } from '../state/dropdownFilterEngine.js';
import { installPortfolioDataStore } from '../state/portfolioDataStore.js';
import { installMarketRiskStore } from '../state/marketRiskStore.js';
import { installCreditRiskStore } from '../state/creditRiskStore.js';
import { installMarketDataStore } from '../state/marketDataStore.js';
import { installProductsStore } from '../state/productsStore.js';
import { installNameListsStore } from '../state/nameListsStore.js';
import { installCustomerReportsStore } from '../state/customerReportsStore.js';
import { installDataUpdatePipeline } from '../state/dataUpdatePipeline.js';

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
}

