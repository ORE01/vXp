// FRONT_END/bootstrap/bootstrapBindings.js

import { bindDropdowns } from '../ui/bindDropdowns.js';
import { bindForwardsButtons } from '../../features/MARKET_DATA/FORWARDS/forwardsUI.js';
import { bindSwaptionDropdownListeners } from '../../features/MARKET_DATA/VOLS/swaptionDropdownListeners.js';
import { bindAppButtons } from '../ui/bindAppButtons.js';

import { installReportsUIBridge } from '../../features/REPORTS/reportsUIBridge.js';
import { setupReportsEnterLeaveBridge } from '../../features/REPORTS/reportsEnterLeaveBridge.js';
import { installBulkUpdateBridge } from '../../features/UPDATES/bulkUpdateBridge.js';

import { installDealsEnhancerBridge } from '../../features/OFFERS/dealsEnhancerBridge.js';

import { initializeTabs } from '../../utils/tabs.js';

export function bootstrapBindings(appState, deps) {
  const {
    dealsActions,
    py,

    handleFWDData,
    handleIRSensData,
    handleCSSensData,

    handleHistoricMetricsAddClick,
    handleExcelImport,

    startOfferImport,
    handleSubmitMatching,
    quickImportWithStandardMapping,

    updateTooltipsFn,

    openPanel,

    setupCustomerReportsPresetUI,
  } = deps;

  bindDropdowns({ appState });

  bindForwardsButtons({
    appState,
    handleFWDData,
    bindings: [
      { buttonId: 'applyCMSButton', applyCubicSpline: false },
      { buttonId: 'applyCMSCubicButton', applyCubicSpline: true },
    ],
  });

  bindSwaptionDropdownListeners();

  bindAppButtons({
    dealsActions,
    py,

    handleHistoricMetricsAddClick,
    handleExcelImport,

    handleSubmitMatchedColumns:
      (typeof handleSubmitMatchedColumns === 'function') ? handleSubmitMatchedColumns : null,

    startOfferImport,
    handleSubmitMatching,
    quickImportWithStandardMapping,

    updateTooltipsFn,
  });

  installReportsUIBridge({
    openPanel,
    appState,
    handleIRSensData,
    handleCSSensData,
  });

  initializeTabs();
  setupReportsEnterLeaveBridge({ setupCustomerReportsPresetUI });

  installBulkUpdateBridge();
  installDealsEnhancerBridge({ appState });
}






