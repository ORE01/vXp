// FRONT_END/bootstrap/bootstrapHandlers.js

import { createIssuerProductHandlers } from '../../features/DATA_PROVIDER/issuerProductHandlers.js';
import { createCustomerHandlers } from '../../features/CUSTOMER/customerHandlers.js';
import { createDealsPortfolioActions } from '../../features/SELECT_PORTFOLIO/dealsPortfolioActions.js';
import { createRatesHandlers } from '../../features/MARKET_DATA/INTEREST_RATES/ratesHandlers.js';
import { createSwaptionDataHandlers } from '../../features/MARKET_DATA/VOLS/swaptionDataHandlers.js';
import { createForwardsHandlers } from '../../features/MARKET_DATA/FORWARDS/forwardsHandlers.js';
import { createAnalysePortfolioHandlers } from '../../features/ANALYSE_PORTFOLIO/analysePortfolioHandlers.js';

import { handleCSMatrixData } from '../../features/MARKET_DATA/CREDIT_SPREADS/CSMatrix.js';
import { handleCSParameterData } from '../../features/MARKET_DATA/CREDIT_SPREADS/CSParameter.js';

import { handleMVaRData, handleMvarInputData } from '../../features/ANALYSE_PORTFOLIO/MARKET_RISK/MVaR.js';
import { handleCVaRData, handleEADData } from '../../features/ANALYSE_PORTFOLIO/CREDIT_RISK/CVaR.js';
import { handleCvarInput } from '../../features/ANALYSE_PORTFOLIO/CREDIT_RISK/CvarInput.js';
import { handleCvarInputThresholdView } from '../../features/ANALYSE_PORTFOLIO/CREDIT_RISK/CvarInputThreshold.js';
import { handleLossIssuerMainData } from '../../features/ANALYSE_PORTFOLIO/CREDIT_RISK/LossIssuer.js';

export function bootstrapHandlers(appState, deps) {
  const {
    api,
    showMessageBox,
    showConfirmationBox,
    handleModalAction,
  } = deps;

  const issuerProdHandlers = createIssuerProductHandlers({ appState });
  const customerHandlers = createCustomerHandlers({ appState });

  const dealsActions = createDealsPortfolioActions({
    appState,
    api,
    showMessageBox,
    showConfirmationBox,
    handleModalAction,
  });

  const ratesHandlers = createRatesHandlers({ appState });

  // Backwards compatibility on appState
  appState.handleCSMatrixData = handleCSMatrixData;
  appState.handleCSParameterData = handleCSParameterData;

  // Swaption handlers (must exist before IPC/refresh)
  const {
    handleSwaptionATMData,
    handleSwaptionSmileData,
    handleSwaptionCubeSurfaceData,
  } = createSwaptionDataHandlers({ appState });

  const forwardsHandlers = createForwardsHandlers({ appState });

  const analyseHandlers = createAnalysePortfolioHandlers({
    appState,

    // imported handler functions
    handleMVaRData,
    handleCVaRData,
    handleEADData,
    handleLossIssuerMainData,

    handleCvarInput,
    handleCvarInputThresholdView,
  });

  return {
    issuerProdHandlers,
    customerHandlers,
    dealsActions,
    ratesHandlers,
    forwardsHandlers,
    analyseHandlers,

    // direct handler functions needed elsewhere
    handleSwaptionATMData,
    handleSwaptionSmileData,
    handleSwaptionCubeSurfaceData,

    // keep exposing the MVaR input handler (used in IPC)
    handleMvarInputData,
  };
}

