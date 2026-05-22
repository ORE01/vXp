// src/renderer/core/bootstrap/bootstrapStores.js

<<<<<<< HEAD
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
=======
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
>>>>>>> vXp2.0

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

