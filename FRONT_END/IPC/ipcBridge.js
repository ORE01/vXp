// FRONT_END/IPC/ipcBridge.js
/**
 * IPC Bridge (Public API)
 *
 * This module intentionally re-exports the receiver installer
 * so the renderer imports only from "ipcBridge".
 *
 * ✅ No behavior change
 * ✅ No duplicate dependency list
 */

import { installReceivers } from './installReceivers.js';

// Option B: exact alias / pass-through
export const installIpcBridge = installReceivers;

// das wäre die Installation wenn man public von privat trennt. dann hat man aber zwei Listen!
// import { installReceivers } from './installReceivers.js';

// export function installIpcBridge({
//   api,
//   appState,
//   panelRenderState,
//   initAllPanelsLazyRender,
//   initMarketDataChartsAutoRefresh,

//   // Swaption handlers
//   handleSwaptionATMData,
//   handleSwaptionSmileData,
//   handleSwaptionCubeSurfaceData,

//   // Customer / Rates / Forwards
//   handleCustomerData,
//   handleCustomerTSData,
//   handleEUSWData,
//   handleForwardData,

//   // Issuer / Product
//   handleIssuerDataInit,
//   handleCountryLookupDataInit,
//   handleCSMatrixData,
//   handleCSParameterData,
//   handleRankData,
//   handleProdDataInit,

//   // Deals
//   handleDealsNameList,
//   handleOffersNameList,
//   handleDealsMainData,

//   // Portfolio
//   handlePortNameList,
//   handlePortfolioData,

//   // MVaR
//   handleMvarInputData,
//   handleAllMVaRData,
//   handleMvarDistData,
//   handleMvarProductData,

//   // EAD
//   handleAllEADData,

//   // CVaR
//   initHandleCvarInput,
//   handleCvarInputThreshold,
//   handleAllCVaRData,

//   // Losses
//   handleAllLossData,

//   // ML
//   handleFuturePredictions,
//   handleMLTestData,
//   handleMLTrainedModels,
//   handleMLModels,

//   // TS
//   createTSModals,
//   observePanelTsOpen,

//   // History
//   handlePortfolioHistoryData,
// } = {}) {
//   // installReceivers does the guard (window.__listenersBoundOnce)
//   installReceivers({
//     api,
//     appState,
//     panelRenderState,
//     initAllPanelsLazyRender,
//     initMarketDataChartsAutoRefresh,

//     handleSwaptionATMData,
//     handleSwaptionSmileData,
//     handleSwaptionCubeSurfaceData,

//     handleCustomerData,
//     handleCustomerTSData,
//     handleEUSWData,
//     handleForwardData,

//     handleIssuerDataInit,
//     handleCountryLookupDataInit,
//     handleCSMatrixData,
//     handleCSParameterData,
//     handleRankData,

//     handleProdDataInit,

//     handleDealsNameList,
//     handleOffersNameList,
//     handleDealsMainData,

//     handlePortNameList,
//     handlePortfolioData,

//     handleMvarInputData,
//     handleAllMVaRData,
//     handleMvarDistData,
//     handleMvarProductData,

//     handleAllEADData,

//     initHandleCvarInput,
//     handleCvarInputThreshold,
//     handleAllCVaRData,

//     handleAllLossData,

//     handleFuturePredictions,
//     handleMLTestData,
//     handleMLTrainedModels,
//     handleMLModels,

//     createTSModals,
//     observePanelTsOpen,

//     handlePortfolioHistoryData,
//   });
// }

