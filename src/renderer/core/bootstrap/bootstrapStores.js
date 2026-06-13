// src/renderer/core/bootstrap/bootstrapStores.js

import { installUIStateStore } from '../state/stores/uiStateStore.js';
import { installDropdownFilterEngine } from '../state/dropdownFilterEngine.js';
import { installPortfolioDataStore } from '../state/stores/portfolioDataStore.js';
import { installMarketRiskStore } from '../state/stores/marketRiskStore.js';
import { installCreditRiskStore } from '../state/stores/creditRiskStore.js';
import { installMarketDataStore } from '../state/stores/marketDataStore.js';
import { installProductsStore } from '../state/stores/productsStore.js';
import { installNameListsStore } from '../state/stores/nameListsStore.js';
import { installCustomerReportsStore } from '../state/stores/customerReportsStore.js';
import { installDataUpdatePipeline } from '../data/dataUpdatePipeline.js';
import { installPortfolioRiskSensitivitiesStore } from '../state/stores/portfolioRiskSensitivitiesStore.js';

export function bootstrapStores(appState) {
  installUIStateStore({ appState });
  installDropdownFilterEngine({ appState });
  installPortfolioDataStore({ appState });
  installPortfolioRiskSensitivitiesStore({ appState });
  installMarketRiskStore({ appState });
  installCreditRiskStore({ appState });
  installMarketDataStore({ appState });
  installProductsStore({ appState });
  installNameListsStore({ appState });
  installCustomerReportsStore({ appState });
  installDataUpdatePipeline({ appState });
}

