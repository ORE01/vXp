import { initCurveSelectorGlobal } from "./FRONT_END/MARKET_DATA/INTEREST_RATES/initCurveSelectorGlobal.js";
import { handleIssuerData } from './FRONT_END/NEW_PRODUCTS/ISSUER.js';
import { handleProdData } from './FRONT_END/NEW_PRODUCTS/PROD.js';
import { handleDealsData} from './FRONT_END/CREATE_PORTFOLIO/DEALS.js';
import { handlePortAggData, handlePortProdData} from './FRONT_END/SELECT_PORTFOLIO/PORT.js';
import { handleIRSensData } from './FRONT_END/ANALYSE_PORTFOLIO/MARKET_RISK/IRSens.js';
import { handleCSSensData } from './FRONT_END/ANALYSE_PORTFOLIO/MARKET_RISK/CSSens.js';
import { handleCSMatrixData } from './FRONT_END/MARKET_DATA/CREDIT_SPREADS/CSMatrix.js';
import { handleCSParameterData } from './FRONT_END/MARKET_DATA/CREDIT_SPREADS/CSParameter.js';
//import { handleIRData } from './FRONT_END/MARKET_DATA/INTEREST_RATES/IR.js';
import { handleFWDData, handleSwapForwardCurve } from './FRONT_END/MARKET_DATA/FORWARDS/FORWARDS.js';
import { handleMVaRData } from './FRONT_END/ANALYSE_PORTFOLIO/MARKET_RISK/MVaR.js'; 
import { handleEADData, handleCVaRData } from './FRONT_END/ANALYSE_PORTFOLIO/CREDIT_RISK/CVaR.js'; 
import { handleLossIssuerMainData } from './FRONT_END/ANALYSE_PORTFOLIO/CREDIT_RISK/LossIssuer.js'; 
import { createComparisonCharts } from './FRONT_END/COMPARE_PORTFOLIOS/COMP.js'; 
import { formatPercentage} from './utils/format.js';
import { filterColumnsInData } from './modal_HELPER/dataProcessor.js';
import { handleLiquidityData } from './FRONT_END/ANALYSE_PORTFOLIO/liquidity.js';
import { handleSummaryRMData } from './FRONT_END/ANALYSE_PORTFOLIO/MARKET_RISK/SummaryMarketRM.js';
import { handleSummaryNotionalData } from './FRONT_END/ANALYSE_PORTFOLIO/SummaryNotional.js';
import { handleSummaryYieldData } from './FRONT_END/ANALYSE_PORTFOLIO/SummaryYield.js';

import { appState } from './FRONT_END/renderer.js';


// ---- helpers (außerhalb der Klasse) ----
function runIdle(fn, timeout = 200) {
  if ('requestIdleCallback' in window) {
    return window.requestIdleCallback(fn, { timeout });
  }
  return setTimeout(fn, 0);
}






export class AppState {
    constructor() {
        this.euswData = [];
        this.selectedCurve = "EUSWAP";


        this.customerData = null;
        this.euswData= [];
        this.tblTSData = [];
        this.availableDealsTablesData = {}; 
        this.availableDealsTablesArray = [];
        
        this.availablePortTablesData = {}; 
        this.availablePortTablesArray = [];

        this.currentDealsDataTable = 'DealsMain'; 

        this.currentPortDataTable0 = 'PortMainData'; 
        this.currentPortDataTable = 'PortMainData'; 
        this.currentPortDataTable2 = 'PortMainData'; 

        this.currentPortIndex = 0;


        this.portfolioData = []; 
        this.portDataMap = {};
        

        this.currentActiveTable = null;

        this.issuerData = null;
        this.prodData = null;
        this.filteredProdData = null,
        this.couponData = null;

        this.dealsData = [];
        this.allDealsData = [];

        this.rankData = null;

        this.mvarInputData = null;
        this.mvarData = null,
        this.mvarDistData = [],
        this.mlModel = null; 

        this.CSSzenarioData = 'default';
        this.selectedCurve = "EUSWAP",

        this.createdDealsData = null;
        this.createdPortData = null;

        this.filteredData = {};

        this.tempSelections = {};
        this.isControlKeyPressed = false;
        
        this.currentReceivedData = null;
        this.selectedTradeIDs = ['ALL'];
        this.selectedDealsTableName = null;
        this.port_name = null; // "UNI";

        this.portDataSets = { port0: null, port1: null, port2: null };
        this.mvarDataSets = { port0: null, port1: null, port2: null };
        this.cvarDataSets = { port0: null, port1: null, port2: null };
        




        // Binding methods
        this.handleDropdownChange = this.handleDropdownChange.bind(this);
        this.updateUIWithFilteredData = this.updateUIWithFilteredData.bind(this);
        // this.updateUIBasedOnAppState = this.updateUIBasedOnAppState.bind(this);
        this.resetFiltersForActiveTable = this.resetFiltersForActiveTable.bind(this);

        this.getPortNameList = this.getPortNameList.bind(this);

        this.initDropdownListeners(); // Make sure to call this to initialize listeners

        // Handlers for different data types
        this.handleDealsData = handleDealsData;
        this.handleIRSensData = handleIRSensData;
        this.handleCSSensData = handleCSSensData;
        this.handleCSMatrixData = handleCSMatrixData;
        this.handleCSParameterData = handleCSParameterData;
        this.handlePortAggData = handlePortAggData;
        this.handleEADData = handleEADData;
        this.handleCVaRData = handleCVaRData;

        //this.handleIRData = handleIRData;
        this.handleFWDData = handleFWDData;
        this.handleSwapForwardCurve = handleSwapForwardCurve;
        
        this.handleMVaRData = handleMVaRData;
        //this.handleCouponData = handleCouponData;

        

        this.applyFiltersAndUpdateDropdowns = this.applyFiltersAndUpdateDropdowns.bind(this);
        this.activeElementId = null;
        this.setActiveElementId = this.setActiveElementId.bind(this);
        this.getActiveElementId = this.getActiveElementId.bind(this);

        this.handleDealsTable = this.handleDealsTable.bind(this);
        this.handleOffersTable = this.handleOffersTable.bind(this);
        this.handlePortTable = this.handlePortTable.bind(this);

        this.fetchAndHandlePortData = this.fetchAndHandlePortData.bind(this);
      
        // Additional configurations
        this.ratingOrder = ['AAA', 'AA+', 'AA', 'AA-', 'A+', 'A', 'A-', 'BBB+', 'BBB', 'BBB-', 'BB+', 'BB', 'BB-', 'B+', 'B', 'B-', 'CCC+', 'CCC', 'CCC-'];

        
        this.filtersConfig = {
            prod: {
                'ISSUER': new Set(['ALL']),
                'PROD_ID': new Set(['ALL']),
                'CouponType': new Set(['ALL']),
                'RATING_PROD': new Set(['ALL']),
                'MATURITY': new Set(['ALL']),
                'RANK': new Set(['ALL']),
            },
            issuer: {
                'ISSUER': new Set(['ALL']),
                'RATING': new Set(['ALL']),
                // Add more filters for 'issuer'
            },
            deals: {
                'PROD_ID': new Set(['ALL']),
                'CATEGORY': new Set(['ALL']),
                'NOTIONAL': new Set(['ALL']),
                'DEPOTBANK': new Set(['ALL']),
            },
            port: {
                'ISSUER': new Set(['ALL']),
                'PROD_ID': new Set(['ALL']),
                'CouponType': new Set(['ALL']),
                'CATEGORY': new Set(['ALL']),
                'RATING': new Set(['ALL']),
                // 'MATURITY': new Set(['ALL']),
                'MATURITY_YEAR': new Set(['ALL']),
                'RANK': new Set(['ALL']),
            },
              offers: {
                'ISSUER': new Set(['ALL']),
                'PROD_ID': new Set(['ALL']),
                'CouponType': new Set(['ALL']),
                'CATEGORY': new Set(['ALL']),
                'RATING': new Set(['ALL']),
                'RANK': new Set(['ALL']),
                'MATURITY_YEAR': new Set(['ALL']),
                'DEPOTBANK': new Set(['ALL']),
            },
            //Auflistung der Deals die ein Portfolio bilden (nicht deals: TRADE_ID...)
            dealsTables: {
                'table_name': new Set(['ALL']),
            },
            offersTables: {
                'table_name': new Set(['ALL']),
            },
            portTables0: {
                'table_name': new Set(['ALL']),
            },
            portTables1: {
                'table_name': new Set(['ALL']),
            },
            portTables2: {
                'table_name': new Set(['ALL']),
            },
            // liqu: {
            //     'MATURITY': new Set(['ALL']),
            // },

        }
        this.dropdownConfig = {
            issuer: {
                'issuerIssuerDropdown': { dataKey: 'ISSUER', selection: ['ALL'] },
                'issuerRatingDropdown': { dataKey: 'RATING', selection: ['ALL'] },
            },
            port: {
                'portIssuerDropdown': { dataKey: 'ISSUER', selection: ['ALL'] },
                'portProdIdDropdown': { dataKey: 'PROD_ID', selection: ['ALL'] },
                'portCouponTypeDropdown': { dataKey: 'CouponType', selection: ['ALL'] },
                'portCategoryDropdown': { dataKey: 'CATEGORY', selection: ['ALL'] },
                'portRatingDropdown': { dataKey: 'RATING', selection: ['ALL'] },
                'portMaturityDropdown': { dataKey: 'MATURITY_YEAR', selection: ['ALL'] },
                'portRankDropdown': { dataKey: 'RANK', selection: ['ALL'] },
                'portDepotbankDropdown': { dataKey: 'Depotbank', selection: ['ALL'] },
                'liquMaturityDropdown': { dataKey: 'MATURITY_YEAR', selection: ['ALL'] },
            },
            prod: {
                'prodIssuerDropdown': { dataKey: 'ISSUER', selection: ['ALL'] },
                'prodProdIdDropdown': { dataKey: 'PROD_ID', selection: ['ALL'] },
                'prodCouponTypeDropdown': { dataKey: 'CouponType', selection: ['ALL'] },
                'prodRatingProdDropdown': { dataKey: 'RATING_PROD', selection: ['ALL'] },
                'prodMaturityDropdown': { dataKey: 'MATURITY', selection: ['ALL'] },
                'prodRankDropdown': { dataKey: 'RANK', selection: ['ALL'] },
            },
            deals: {
                'tradeDropdown': { dataKey: 'TRADE_ID', selection: ['ALL'] },
    
                'dealsProdIdDropdown': { dataKey: 'PROD_ID', selection: ['ALL'] },
                'dealsCategoryDropdown': { dataKey: 'CATEGORY', selection: ['ALL'] },
                'dealsNotionalDropdown': { dataKey: 'NOTIONAL', selection: ['ALL'] },
                'dealsDepotbankDropdown': { dataKey: 'Depotbank', selection: ['ALL'] },
            },
              offers: {
                'offersIssuerDropdown':     { dataKey: 'ISSUER',        selection: ['ALL'] },
                'offersProdIdDropdown':     { dataKey: 'PROD_ID',       selection: ['ALL'] },
                'offersCouponTypeDropdown': { dataKey: 'CouponType',    selection: ['ALL'] },
                'offersCategoryDropdown':   { dataKey: 'CATEGORY',      selection: ['ALL'] },
                'offersRatingDropdown':     { dataKey: 'RATING',        selection: ['ALL'] },
                'offersRankDropdown':       { dataKey: 'RANK',          selection: ['ALL'] },
                'offersMaturityDropdown':   { dataKey: 'MATURITY_YEAR', selection: ['ALL'] },
                'offersDepotbankDropdown':  { dataKey: 'Depotbank',     selection: ['ALL'] },
            },
            dealsTables: {
                'createdDealsDropdown': { dataKey: 'table_name', selection: ['ALL'] },
            },         
            portTables0: {
                'createdPortDropdown0': { dataKey: 'table_name', selection: ['ALL'] }, 
            },  
            portTables1: {
                'createdPortDropdown1': { dataKey: 'table_name', selection: ['ALL'] },  
            },   
            portTables2: {
                'createdPortDropdown2': { dataKey: 'table_name', selection: ['ALL'] },
            },   
            offersTables: {
                'createdOffersDropdown': { dataKey: 'table_name', selection: ['ALL'] },
            },
        };
        
        this.tabToDataMapping = {
            'ISSUER_Tab': {
                default: 'issuer',
            },
            'PROD_Tab': {
                default: 'prod',
            },
            'DEALS_Tab': {
                default: 'deals',
                dropdowns: {
                    'createdDealsDropdown': 'dealsTables',
                }
            },
            'PORT_Tab': {
                default: 'port',
                dropdowns: {
                    'createdPortDropdown0': 'portTables0',
                }
            },
            'COMP_Tab': {
                default: 'portTables1',
                dropdowns: {
                    'createdPortDropdown1': 'portTables1', 
                    'createdPortDropdown2': 'portTables2', 
                }
            },
            'IR_Tab': {
                default: 'ir',
            },
            'TS_Tab': {
                default: 'ts',
            },
            'MVaR_Tab': {
                default: 'mvar',
            },
            'CVaR_Tab': {
                default: 'cvar',
            },
            'DATA_Tab': {
                default: 'data',
            },
            'Liquidity_Tab': {
                default: 'port',
            },
            'Offers_Tab': {
                default: 'offers',
                dropdowns: {
                    'createdOffersDropdown': 'offersTables',
                }
            },
            // 'Offers_Tab': {
            //     default: 'port',
            // },

            // You can add more tabs and their default contexts or specific dropdowns as needed
        };

        this.tableConfigs = {
            issuer: {
              dropdownConfig: this.dropdownConfig.issuer,
              filtersConfig: this.filtersConfig.issuer,
              dataHandler: (receivedData) => handleIssuerData(receivedData, this),
            },
            
            prod: {
            dropdownConfig: this.dropdownConfig.prod,
            filtersConfig:  this.filtersConfig.prod,
            dataHandler: () => {
                const cfg = this.dropdownConfig.prod; // { dropdownId: { dataKey, selection } }
                const effectiveFilters = Object.fromEntries(
                Object.values(cfg).map(({ dataKey, selection }) => [
                    dataKey,
                    new Set(Array.isArray(selection) ? selection : ['ALL'])
                ])
                );
                handleProdData(effectiveFilters);
            },
            },


            deals: {
              dropdownConfig: this.dropdownConfig.deals,
              filtersConfig: this.filtersConfig.deals,
              dataHandler: (receivedData) => {
                const dealsTableName = this.currentDealsDataTable;
                console.log(`📥 Deals aufgerufen`);
                handleDealsData(receivedData, dealsTableName);
                // handleDealsTable(receivedData, dealsTableName);
              },
            },
            offers: {
              dropdownConfig: this.dropdownConfig.offers,
              filtersConfig: this.filtersConfig.offers,
                dataHandler: (data) => {
                    const index = 4//this.getPortIndex?.() ?? 0; // Fallback auf 0, falls Methode nicht existiert
                    //console.log(`📥 port aufgerufen mit data (port), Index: ${index}`, data);
                    this.handleOffersTable(data, index);
                }
                },
              port: {
                dropdownConfig: this.dropdownConfig.port,
                filtersConfig: this.filtersConfig.port,
                dataHandler: (data) => {
                    const index = this.getPortIndex?.() ?? 0; // Fallback auf 0, falls Methode nicht existiert
                    // console.log(`📥 port aufgerufen mit data (port), Index: ${index}`, data);
                    this.handlePortTable(data, index);
                }
                },

            dealsTables: {
                dropdownConfig: this.dropdownConfig.dealsTables,
                filtersConfig: this.filtersConfig.dealsTables,
                // dataHandler: this.handleDealsTable.bind(this),
                dataHandler: (data) => this.handleDealsTable(data),
                }, 

            offersTables: {
                dropdownConfig: this.dropdownConfig.offersTables,     // ← stelle sicher, dass das existiert
                filtersConfig: this.filtersConfig.offersTables,       // ← in filtersConfig hinzugefügt
                dataHandler: (data) => this.handleOffersTable(data),    // ← trennt OFFER(S)_ und setzt Liste
            },

            portTables0: {
              dropdownConfig: this.dropdownConfig.portTables0,
              filtersConfig: this.filtersConfig.portTables0,
              dataHandler: (data) => this.handlePortTable(data, 0),
            },
            portTables1: {
              dropdownConfig: this.dropdownConfig.portTables1,
              filtersConfig: this.filtersConfig.portTables1,
              dataHandler: (data) => {
                // console.log('📥 handlePortTable1 aufgerufen mit data (port):', data);
                this.handlePortTable(data, 1);
              },
            },
            portTables2: {
              dropdownConfig: this.dropdownConfig.portTables2,
              filtersConfig: this.filtersConfig.portTables2,
              dataHandler: (data) => {
                // console.log('📥 handlePortTable2 aufgerufen mit data (port):', data);
                this.handlePortTable(data, 2);
              }
            },
          };
          


        
        
        this.observers = [];

        // Event listeners for keydown and keyup to manage the state of isControlKeyPressed
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Control') {
                this.isControlKeyPressed = true;
            }
        });

        document.addEventListener('keyup', (e) => {
            if (e.key === 'Control') {
                this.isControlKeyPressed = false;
                // Apply accumulated selections now that Control key is released
                Object.entries(this.tempSelections).forEach(([dropdownId, selections]) => {
                    const dropdown = document.getElementById(dropdownId);
                    if (dropdown) {
                        [...dropdown.options].forEach(option => {
                            option.selected = selections.includes(option.value);
                        });
                        // Manually trigger a "change" event to apply the accumulated selections
                        const changeEvent = new Event('change');
                        dropdown.dispatchEvent(changeEvent);
                    }
                });
                this.tempSelections = {}; // Clear the temporary selections
            }
        });

        

        document.addEventListener("DOMContentLoaded", () => {
        initCurveSelectorGlobal();
        });


        this.initDropdownListeners(); // Initialize listeners for dropdown changes  
    }


// DEALS:
// das sind nur die Namen der Deals nicht die einzelnen Deals:
    handleDealsTable(data) {
        //console.log("Handling deals table data:", data);

    }

// OFFERS:
// handleOffersTable(data, index = 4) {
//   //console.log("offersName List:", data);
//   if (!Array.isArray(data) || data.length === 0) return;

 

//   // 1) Port-Daten schon da?
//   const portData = appState.getAllPortfolioData?.();
//   if (!Array.isArray(portData) || portData.length === 0) {
//     // ➜ einmal warten bis Port-Daten eintreffen, dann neu aufrufen
//     const once = () => this.handleOffersTable(data, index);
//     document.addEventListener('portData:ready', once, { once: true });
//     return;
//   }
//   //console.log("portData:", portData);

//   // 2) Ausgewählten Port-Namen holen (Fallback auf Offers-Dropdown)
//   const port_name =
//     this.getSelectedPortTableName?.() ||
//     document.getElementById('createdOffersDropdown')?.value ||
//     '';

//   if (!port_name) return;

//   const filteredData = portData.filter(item => item.port_name === port_name);
//   if (filteredData.length === 0) return;

//   // 3) Render
//   handlePortProdData(filteredData, 4, port_name);

//   // 4) IRSens / CSSens – benutze die vorhandenen Daten statt "filteredOriginalData"
//   const IRSensTable = this.handleIRSensData?.(filteredData);
//   const IRSensDataContainer = document.getElementById('IRSensDataContainer');
//   if (IRSensTable && IRSensDataContainer) {
//     IRSensDataContainer.innerHTML = '';
//     IRSensDataContainer.appendChild(IRSensTable);
//   }

//   const CSSensTable = this.handleCSSensData?.(filteredData);
//   const CSSensDataContainer = document.getElementById('CSSensDataContainer');
//   if (CSSensTable && CSSensDataContainer) {
//     CSSensDataContainer.innerHTML = '';
//     CSSensDataContainer.appendChild(CSSensTable);
//   }
// }
handleOffersTable(data, index = 0) {
  const portData = this.getAllPortfolioData?.() || [];
  const port_name =
    this.getSelectedPortTableName?.() ||
    document.getElementById('createdOffersDropdown')?.value || '';

  // ⬇️ wenn gefilterte Rows übergeben sind, nimm die; sonst fallback auf Port-Filter
  const rows = (Array.isArray(data) && data.length)
    ? data
    : portData.filter(r => String(r.port_name) === String(port_name));
  if (!rows.length) return;

  // rechts Preview + links Grid (dein bestehender Code)
  handlePortProdData(rows, 4, port_name);

  const IRSensTable = this.handleIRSensData?.(rows);
  const irEl = document.getElementById('IRSensDataContainer');
  if (IRSensTable && irEl) { irEl.innerHTML = ''; irEl.appendChild(IRSensTable); }

  const CSSensTable = this.handleCSSensData?.(rows);
  const csEl = document.getElementById('CSSensDataContainer');
  if (CSSensTable && csEl) { csEl.innerHTML = ''; csEl.appendChild(CSSensTable); }
}



// PORFOLIOS:
    handlePortTable(data, index) {
        // console.log("index:", data, index);

        if (!Array.isArray(data) || data.length === 0) {
            //console.warn(`⚠️ Kein gültiges Portfoliodaten-Array empfangen für Index ${index}:`, data);
            return;
        }

        const port_name = this.getSelectedPortTableName();
        // console.log("port_name:", data, index, port_name);

        const filteredData = data.filter(item => item.port_name === port_name);
        
        if (filteredData.length === 0) {
            //console.warn(`⚠️ Keine Daten für Portfolio "${port_name}" bei Index ${index} gefunden.`);
            return;
        }
        
        // 1️⃣ Portfolios: Standart-Auswertung
        handlePortAggData(filteredData, index, port_name);

        // console.log("handlePortAggData:", filteredData, index, port_name);

        handlePortProdData(filteredData, index, port_name);
        handleLiquidityData(filteredData, index, port_name);
        
        handleSummaryNotionalData(filteredData, index, port_name);
        handleSummaryYieldData(filteredData, index, port_name);

        handleSummaryRMData(filteredData, index, port_name);

        
        // 2️⃣ MVaR-Daten
        const mvarData = this.getAllMvarData();
        const filteredMvarData = mvarData.filter(item => item.port_name === port_name);
        // console.log("mvarData:", mvarData, index);
        handleMVaRData(mvarData, index); 
        
        // 3️⃣ CVaR-Daten
        const cvarData = this.getAllCvarData();
        const filteredCvarData = cvarData.filter(item => item.port_name === port_name);
        handleCVaRData(cvarData, index);
        
        // 4️⃣ Kombinieren der Daten in portDataMap
        const elementId = `portDataContainer${index}`;
        const portfolioData = this.getPortAggData(elementId) || {};
        // console.log("portfolioData:", portfolioData, port_name, index);
        
        // 4a. MVaR 
        if (filteredMvarData?.length > 0) {
            const mvar = filteredMvarData[0];
            this.setPortAggData(elementId, {
            formVaR_T_rel: formatPercentage(mvar.VaR_T_rel),
            formVaR_IR_rel: formatPercentage(mvar.VaR_IR_rel),
            formVaR_CS_rel: formatPercentage(mvar.VaR_CS_rel),
            });
        }
        
        // 4b. CVaR 
        if (filteredCvarData.length > 0) {
            const cvarValues = {};
            filteredCvarData.forEach(entry => {
            if (!entry.pd_flag || !entry.VaR_rel) return;
            const key = `formVaR_${entry.pd_flag.toLowerCase()}_rel`;
            cvarValues[key] = formatPercentage(entry.VaR_rel);
            });
            this.setPortAggData(elementId, cvarValues);
        }
        
        // 5️⃣ Vergleichscharts aktualisieren
        createComparisonCharts(this.portDataMap, false);
        
        // 6️⃣ SPEZIAL-FALL: Originaldaten für Vergleich in Container 3
        const OriPortData = this.getAllPortfolioData();
        const filteredOriginalData = OriPortData.filter(item => item.port_name === port_name);
        handlePortAggData(filteredOriginalData, 3, port_name);
        
        // 7️⃣ IRSens aktualisieren
        const IRSensTable = this.handleIRSensData(filteredOriginalData);
        const IRSensDataContainer = document.getElementById('IRSensDataContainer');
        if (IRSensDataContainer) {
            IRSensDataContainer.innerHTML = '';
            IRSensDataContainer.appendChild(IRSensTable);
        }
        
        // 8️⃣ CSSens aktualisieren
        const CSSensTable = this.handleCSSensData(filteredOriginalData);
        const CSSensDataContainer = document.getElementById('CSSensDataContainer');
        if (CSSensDataContainer) {
            CSSensDataContainer.innerHTML = '';
            CSSensDataContainer.appendChild(CSSensTable);
        }

        // 9 EAD aktualisieren

        const EADData = appState.getAllEADData();
        // console.log('📥 EADData:', EADData);
        appState.handleEADData(EADData);

        // 10 EAD aktualisieren

        const LossData = appState.getAllLossData();
        // console.log('📥 LossData:', LossData);
        handleLossIssuerMainData(LossData);

    } 
    
    arraysEqual(arr1, arr2) {
        if (arr1.length !== arr2.length) return false;
        for (let i = 0; i < arr1.length; i++) {
            if (arr1[i] !== arr2[i]) return false;
        }
        return true;
    }

    setCustomerData(data) {
        this.customerData = data;
    }

    getCustomerData() {
        return this.customerData;
    }

    setCustomerTSData(data) {
        this.customerTSData = data;
    }

    getCustomerTSData() {
        return this.customerTSData;
    }

    updateCustomerField(key, value) {
        if (!this.customerData) this.customerData = {};
        this.customerData[key] = value;
    }

        // ✅ Setter for EUSW data
    setPortfolioHistoryData(data) {
        this.PortfolioHistoryMetrics = data;
    }

    // ✅ Getter for EUSW data
    getPortfolioHistoryData() {
        return this.PortfolioHistoryMetrics;
    }






// --- interne Caches als Properties (robust) ---

setEUSWData(data) {
  // nur übernehmen, wenn wirklich Daten da sind
  if (Array.isArray(data) && data.length > 0) {
    this._EUSWDataCache = data;
    this._EUSWLastGoodCache = data; // letzte gültige Kopie merken
  }
  // wenn leer/undefined kommt: IGNORIEREN (sonst verlierst du beim Rückwechsel alles)
}

getEUSWData() {
  if (Array.isArray(this._EUSWDataCache) && this._EUSWDataCache.length > 0) {
    return this._EUSWDataCache;
  }
  // Fallback auf letzte gültige Daten
  if (Array.isArray(this._EUSWLastGoodCache) && this._EUSWLastGoodCache.length > 0) {
    return this._EUSWLastGoodCache;
  }
  return [];
}

setSelectedCurve(curve) {
  this._selectedCurveCache = curve || "EUSWAP";
}

getSelectedCurve() {
  return this._selectedCurveCache || "EUSWAP";
}


getEUSWDataWithSelectedCurve() {
  const curve = this.getSelectedCurve();
  return this.getEUSWData().map(row => {
    const r = { ...row };

    // wichtigste Zeile:
    r.RATES = r[curve];   // immer auf aktuelle Curve mappen

    return r;
  });
}







    // ✅ Setter for EUSW data
    setTblTSData(data) {
        this.tblTSData = data;
        // console.log('tblTSData', data)
    }

    // ✅ Getter for EUSW data
    getTblTSData() {
        return this.tblTSData;
    }







    // Method to update active table
    setActiveTable(tableType) {
        this.currentActiveTable = tableType;
        // this.notifyObservers();
    }

    // Method to update received data
    setReceivedData(data) {
        this.currentReceivedData = data;
        // this.notifyObservers();
    }

    setIssuerData(data) {      
        this.issuerData = data;
    }

    getIssuerData() {
    return this.issuerData;
}




    setRankData(data) {      
        this.rankData = data;
        // this.notifyObservers(); 
        // this.updateUIBasedOnAppState();
    }
    getRankData() {
        return new Promise((resolve, reject) => {
            const checkData = () => {
                if (this.rankData) {
                    resolve(this.rankData);
                } else {
                    setTimeout(checkData, 100);  // Check again after 100ms
                }
            };
            checkData();
        });
    }

    setProdData(data) {
        this.prodData = data;
        // this.notifyObservers(); 
    }

    getProdData() {
        return this.prodData || []; // Return prodData or an empty array if not set
    }

    // Set couponData and notify observers
    setCouponData(data) {
        //console.log('Setting CouponData:', data);
        this.couponData = data;
        // this.notifyObservers(); // Trigger updates
    }

    // Get couponData
    getCouponData() {
        return Array.isArray(this.couponData) ? this.couponData : []; 
        }

    setFilteredProdData(data) {
        this.filteredProdData = data;
    }

    getFilteredProdData() {
        return this.filteredProdData;
    }

    
    
    setAllDealsData(data) {
        this.allDealsData = data;
        // this.notifyObservers(); 
    }
    getAllDealsData() {
        return this.allDealsData; 
    }
    setDealsData(data) {
        //console.log('this.dealsData', data)
        this.dealsData = data;
        // this.notifyObservers(); 
    }
    getDealsData() {
        return this.dealsData; 
    }
    setOffersData(data) {
        this.offersData = data;
        // this.notifyObservers(); 
    }
    getOffersData() {
        return this.offersData; 
    }

    setPortData(data) {
        this.portData = data;
        // this.notifyObservers(); 
    }

    // ✅ Setzt die Portfolios in den AppState
    setPortfolioData(data) {
        this.portfolioData = data;
        //console.log('✅ Portfolio-Daten gespeichert:', this.portfolioData);
    }

    // ✅ Holt die Portfolios aus dem AppState
    getPortfolioData() {
        return this.portfolioData;
    }

setPortAggData(elementId, data) {
  const before = this.portDataMap[elementId] || {};

//   console.log("🔵 [setPortAggData] BEFORE:", {
//     elementId,
//     before
//   });

  this.portDataMap[elementId] = {
    ...before,
    ...data
  };

  const after = this.portDataMap[elementId];

//   console.log("🟢 [setPortAggData] AFTER (full object):", {
//     elementId,
//     after
//   });

  // Werte einzeln loggen: Key = Value
  console.log("📌 [setPortAggData] VALUES:");
  Object.entries(after).forEach(([key, value]) => {
    // console.log(`   • ${key}:`, value);
  });
}



    getPortAggData(elementId) {
    return this.portDataMap[elementId] || {};
    }

    setPortIndex(index) {
    this.currentPortIndex = index;
    }

    getPortIndex() {
    return this.currentPortIndex ?? 0;
    }

      
    
    setMvarInputData(data) {
        //console.log('setMvarInputData:', data)
        this.mvarInputData = data;
        // this.notifyObservers(); 
    }
    getMvarInputData() {
        return this.mvarInputData;
        
    }
    setMvarData(data) {
        //console.log('setMvarData:', data)
        this.mvarData = data;
        // this.notifyObservers(); 
    }
    getMvarData() {
        return this.mvarData;
        
    }

    setMvarDistData(data) {
        //console.log('setMvarData:', data)
        this.mvarDistData = data;
        // this.notifyObservers(); 
    }
    getMvarDistData() {
        return this.mvarDistData;
        
    }

    setCvarData(data) {
        this.cvarData = data;
        //console.log('setCvarData:', data)

        // this.notifyObservers(); 
    }
    
    
    getCvarData() {
        return this.cvarData;
        
    }

        // ✅ Setzt die Portfolios in den AppState
        setAllPortfolioData(data) {
            this.AllPortfolioData = data;
            //console.log('✅ Portfolio-Daten gespeichert:', data);
        }
    
        // ✅ Holt die Portfolios aus dem AppState
        getAllPortfolioData() {
            //console.log('✅ Portfolio-Daten gespeichert:', this.AllPortfolioData);
            return this.AllPortfolioData;
        }

    setAllMvarData(data) {
        // console.log('setAllMvarData:', data)
        this.AllMvarData = data;
        // this.notifyObservers(); 
    }
    
    
    getAllMvarData() {
        return this.AllMvarData;
        
    }

    setAllEADData(data) {
        //console.log('setAllEADData', data);
        this.AllEADData = data;
    }

    getAllEADData() {
        return this.AllEADData;
        
    }

    setAllCvarData(data) {
        //console.log('setAllCvarData:', data)
        this.AllCvarData = data;
        // this.notifyObservers(); 
    }
    
    
    getAllCvarData() {
        return this.AllCvarData;
        
    }

    setAllLossData(data) {
        //console.log('setAllLossData:', data)
        this.AllLossData = data;
        // this.notifyObservers(); 
    }
    
    
    getAllLossData() {
        return this.AllLossData;
        
    }

// Filtered Portfolio

    setFilteredPortData(data) {
        //console.log('filteredPortData:', data)
        this.filteredPortData = data
        
        // this.notifyObservers();
    }

    getFilteredPortData() {
        //console.log('check daten appstate', this.filteredPortData)
            return this.filteredPortData;
            
        }

    setSelectedDealsTableName(tableName) {
        
        this.selectedDealsTableName = tableName;
        //console.log('setSelectedDealsTableName:', tableName);  
        // Optionally, you might want to notify observers about this change
        // this.notifyObservers();
    }
    getSelectedDealsTableName() {
        
        return this.selectedDealsTableName;
    }

    setSelectedPortTableName(tableName) {
        this.port_name = tableName;  // 🔥 Speichert in `port_name`
        //console.log('🛠 setSelectedPortTableName speichert:', this.port_name);
    }

    getSelectedPortTableName() {
        // console.log('🔎 getSelectedPortTableName gibt zurück:', this.port_name);
        return this.port_name;  // 🔥 Gibt den korrekten Wert zurück
    }

    

    // created Deals
    setDealsNameList(receivedData) {
        if (!Array.isArray(receivedData)) {
            console.error("setDealsNameList received non-array data:", receivedData);
            return;
        }
        
        // Reset or initialize availableTablesData and availableTablesArray if necessary
        this.availableDealsTablesData = {}; // Object map for direct access by name
        this.availableDealsTablesArray = []; // Array for iteration
        
        // Populate both the object map and array with table data
        receivedData.forEach(table => {
            this.availableDealsTablesData[table.table_name] = table;
            this.availableDealsTablesArray.push(table);
        });
        
        this.notifyObservers();
    }

    getDealsNameList() {
        return this.availableDealsTablesArray; 
    }

        // created Offers
    setOffersNameList(receivedData) {
        if (!Array.isArray(receivedData)) {
            console.error("setOffersNameList received non-array data:", receivedData);
            return;
        }
        
        // Reset or initialize availableTablesData and availableTablesArray if necessary
        this.availableOffersTablesData = {}; // Object map for direct access by name
        this.availableOffersTablesArray = []; // Array for iteration
        
        // Populate both the object map and array with table data
        receivedData.forEach(table => {
            this.availableOffersTablesData[table.table_name] = table;
            this.availableOffersTablesArray.push(table);
        });
        
        this.notifyObservers();
    }

    getOffersNameList() {
        //console.log('getOffersNameList', this.availableOffersTablesArray);
        return this.availableOffersTablesArray; 
    }
    
    // created Port
    setPortNameList(receivedData) {
        if (Array.isArray(receivedData)) {
            // Reset or initialize availablePortTablesData and availablePortTablesArray if necessary
            this.availablePortTablesData = {}; // Object map for direct access by name
            this.availablePortTablesArray = []; // Array for iteration
            
            // Populate both the object map and array with table data
            receivedData.forEach(table => {
                this.availablePortTablesData[table.table_name] = table;
                this.availablePortTablesArray.push(table); 
            });
        } else if (receivedData && receivedData.table_name) {
            // Handle adding a single new entry
            if (!this.availablePortTablesData[receivedData.table_name]) {
                this.availablePortTablesData[receivedData.table_name] = receivedData;
                this.availablePortTablesArray.push(receivedData);
            }
        } else {
            console.error("setPortNameList received invalid data:", receivedData);
            return;
        }
        
        //console.log('this.availablePortTablesArray', this.availablePortTablesArray);
        this.notifyObservers();
    }

    getPortNameList() {
        return this.availablePortTablesArray;
    }

    setCSSzenarioData(data) {
        this.CSSzenarioData = data || 'default'; 
        // this.notifyObservers(); 
    }
    getCSSzenarioData() {
        return this.CSSzenarioData;
        
    }

    setSelectedCurve(curveName) {
        this.selectedCurve = curveName;
      }
    
    getSelectedCurve() {
    return this.selectedCurve;
    }



// UPDATE DATA:
    updatePortfolioDealsDataTable(receivedData, { isFull = false } = {}) {
        console.log('updateDealsDataTable', receivedData)
        if (!Array.isArray(receivedData)) return;

        // Nur wenn explizit der *volle* DealsMain-Dump kommt, den ALL-State setzen
        if (isFull && typeof this.setAllDealsData === 'function') {
            this.setAllDealsData(receivedData.map(r => ({ ...r }))); // defensiv kopieren
        }

        // View-/Working-Set aktualisieren (gefiltert nach prev)
        if (typeof this.setDealsData === 'function') {
        const prev =
            this.getSelectedDealsTableName?.() ||
            document.getElementById('createdDealsDropdown')?.value ||
            '';

        const norm = s => (s ?? '').toString().trim().toLowerCase();
        const filtered = prev
            ? receivedData.filter(r => norm(r.port_name || r.PORT_NAME) === norm(prev))
            : receivedData;

        this.setDealsData(filtered.map(r => ({ ...r })));
        }


        const prev = this.getSelectedDealsTableName?.()
                    || document.getElementById('createdDealsDropdown')?.value
                    || '';

        console.log('dealsTableName', prev)

        this.applyFiltersAndUpdateDropdowns?.('deals', { preselect: prev });
        //this.handleDealsTable?.(receivedData);
        document.dispatchEvent(new Event('dealsData:ready'));
    }
    updateDealsDataTable(receivedData, { isFull = false } = {}) {
        console.log('updateDealsDataTable', receivedData)
        if (!Array.isArray(receivedData)) return;

        // Nur wenn explizit der *volle* DealsMain-Dump kommt, den ALL-State setzen
        if (isFull && typeof this.setAllDealsData === 'function') {
            this.setAllDealsData(receivedData.map(r => ({ ...r }))); // defensiv kopieren
        }

        // View-/Working-Set aktualisieren (gefiltert nach prev)
        if (typeof this.setDealsData === 'function') {
        const prev =
            this.getSelectedDealsTableName?.() ||
            document.getElementById('createdDealsDropdown')?.value ||
            '';

        const norm = s => (s ?? '').toString().trim().toLowerCase();
        const filtered = prev
            ? receivedData.filter(r => norm(r.port_name || r.PORT_NAME) === norm(prev))
            : receivedData;

        this.setDealsData(filtered.map(r => ({ ...r })));
        }


        const prev = this.getSelectedDealsTableName?.()
                    || document.getElementById('createdDealsDropdown')?.value
                    || '';

        console.log('dealsTableName', prev)

        this.applyFiltersAndUpdateDropdowns?.('deals', { preselect: prev });
        //this.handleDealsTable?.(receivedData);
        document.dispatchEvent(new Event('dealsData:ready'));
    }
    updateOffersDataTable(receivedData) {
    this.setOffersData?.(receivedData);
    const filtered = this.applyFiltersAndUpdateDropdowns?.('offers') || receivedData;

    const targetEl = document.getElementById('offersDataContainer');
    if (!targetEl) { console.warn('[offers] container fehlt'); return; }

    // show container (einmalig, keine unnötigen style-writes später)
    targetEl.style.cssText = 'display:block;visibility:visible;height:auto;overflow:visible;';

    if (!Array.isArray(filtered) || filtered.length === 0) {
        targetEl.innerHTML = '<div style="padding:8px;opacity:.7;">No offers data.</div>';
        return;
    }

    const prevActive = this.getActiveElementId?.();
    this.setActiveElementId?.('offersDataContainer');
    try {
        this.handleOffersTable?.(filtered); // ← hier wird DOM gerendert
    } finally {
        if (prevActive) this.setActiveElementId?.(prevActive);
    }

    // WICHTIG: nur EINEN follow-up-Call, idle & ohne Selector
    runIdle(() => {
        if (typeof enhanceDealsIncludeCheckboxes === 'function') {
        enhanceDealsIncludeCheckboxes(targetEl); // übergib Element statt '#offersDataContainer'
        }
        // Event danach – erst wenn die Enhancement-Phase durch ist
        document.dispatchEvent(new Event('offersData:ready'));
    });
    }
    updatePortDataTable(receivedData) {
        //console.log('📌 updatePortDataTable:', receivedData);
        this.setPortData(receivedData); // ✅ speichert die Daten (global verfügbar)
        this.applyFiltersAndUpdateDropdowns('port');        
    }     
    updateMvarDataTable(receivedData, index) {
        // console.log('📌 updateMvarDataTable', receivedData);
        // console.trace("🔍 updateMvarDataTable triggered from:");
    
        this.setMvarData(receivedData);
        this.setAllMvarData(receivedData);
        const mvarData = this.getAllMvarData();
        
        //console.log("mvarData:", mvarData, index);
        handleMVaRData(mvarData, index); 

    }
    updateMvarDistData(receivedData, index, port_name ) {
    console.log('📌 updateMvarDistData', receivedData);
    // console.trace("🔍 updateMvarDataTable triggered from:");

    this.setMvarDistData(receivedData);
    handleSummaryRMData(receivedData, 0, port_name);

    }
    updateCvarDataTable(receivedData) {
        console.log('📌 updateCvarDataTable', receivedData);
        this.setCvarData(receivedData);
        this.setAllCvarData(receivedData);
    }
    updateEADDataTable(receivedData) {
        console.log('📌 updateEADDataTable', receivedData);
        //this.setEADData(receivedData);
        this.setAllEADData(receivedData);
    }

// SET/GET DATA:    
    setSelectedTradeIDs(ids) {
        this.selectedTradeIDs = ids;
        // this.notifyObservers();
    }

    // General method for updating filtered data based on table type
    setFilteredDataForTable(tableType, data) {
        this.filteredData[tableType] = data;
        // this.notifyObservers(); // Notify observers about the update
    }
    getFilteredData(tableType) {
        return this.filteredData[tableType];
    }

    setActiveElementId(elementId) {
        this.activeElementId = elementId;
    }
    getActiveElementId() {
        return this.activeElementId;
    }

    // Set the forward data and notify observers
    setForwardData(data) {
        this.forwardData = data;
        // this.notifyObservers();  // Notify observers if applicable
    }

    // Retrieve the forward data
    getForwardData() {
        return this.forwardData;
    }

    // Set the ML Model
    setMLTrainedModel(model) {
        this.mlModel = model || null; // Store the full object or clear it if null/undefined
        //console.log('MLModel updated:', this.mlModel);
        // this.notifyObservers();
    }

    // Retrieve the ML Model
    getMLTrainedModel() {
        return this.mlModel; // Return the stored object directly
    }


    // Set the MLModelType and notify observers
    setMLModelType(modelType) {
        this.mlModelType = modelType;
        //console.log('MLModelType updated:', this.mlModelType);
        // this.notifyObservers(); // Notify observers, if applicable
    }

    // Retrieve the MLModel
    getMLModelType() {
        return this.mlModelType;
    }

    setOfferData(data) {
        this.offerData = Array.isArray(data) ? data : [];
    }
    
    getOfferData() {
        return this.offerData || [];
    }

    // Method to add an observer
    addObserver(observerFunction) {
        this.observers.push(observerFunction);
    }

    // Method to notify all observers of state changes
    notifyObservers() {
        this.observers.forEach(observer => observer());
    }

// APP METHODES:

    //Sortings:
    sortRatings(a, b) {
        return this.ratingOrder.indexOf(a) - this.ratingOrder.indexOf(b);
    }

    sortDates(a, b) {
        const dateA = new Date(a.replace(/(\d{2})-(\d{2})-(\d{4})/, '$2/$1/$3'));
        const dateB = new Date(b.replace(/(\d{2})-(\d{2})-(\d{4})/, '$2/$1/$3'));
        return dateA - dateB;
    }
    
    sortNotionals(a, b) {
        // Parse notional values as numbers
        // console.log(a.NOTIONAL)
        const notionalA = parseFloat((a && a.NOTIONAL) || 0);
        const notionalB = parseFloat((b && b.NOTIONAL) || 0);
    
        // Compare notional values and return the result
        return notionalA - notionalB;
    }
    


    // app start

    initDropdownListeners() {
        const dropdowns = this.getAllDropdownElements();
        //console.log('alldropdowns', dropdowns)
        dropdowns.forEach(dropdown => {
            // Check if the listener has already been attached
            if (!dropdown.hasAttribute('data-listener-attached')) {
                dropdown.addEventListener('change', (event) => {
                    if (!this.isControlKeyPressed) {
                        // Handle normal dropdown changes
                        //console.log('Normal Selection EventListener:', event);
                        this.handleDropdownChange(event);
                    } else {
                        // Accumulate selections for Control key handling
                        //console.log('Control Key Selection EventListener:', event);
                        this.accumulateControlKeySelections(event.target.id, [...event.target.selectedOptions].map(opt => opt.value));
                    }
                });
                // Mark this dropdown as having an event listener attached
                dropdown.setAttribute('data-listener-attached', 'true');
            }
        });
    }
        getAllDropdownElements() {
            // Implement a method to retrieve all dropdown elements, e.g., by class name
            return document.querySelectorAll('.select-dropdown');
        }
        accumulateControlKeySelections(dropdownId, selections) {
            // Implement logic to store or update temporary selections for the dropdownId
            this.tempSelections[dropdownId] = selections;
        }

    handleDropdownChange(event) {
        const dropdownId = event.target.id;
        const tableType = this.getTableTypeFromDropdownId(dropdownId);
        let selectedOptions;
    
        console.log('Dropdown ID:', dropdownId);
        console.log('Table Type:', tableType);
    
        // Handling "ALL" selection specifically
        if (event.target.value === "ALL") {
            selectedOptions = ["ALL"];
        } else if (this.tempSelections.hasOwnProperty(dropdownId) && this.tempSelections[dropdownId].length > 0) {
            // Use temp selections directly without converting to integers. Adjust if necessary based on your data.
            selectedOptions = this.tempSelections[dropdownId];
            delete this.tempSelections[dropdownId];
        } else {
            // Keep the options as strings unless you are certain all values should be numeric
            selectedOptions = [...event.target.selectedOptions].map(opt => opt.value);
        }
    
        //console.log('Selected options:', selectedOptions);
        this.updateDropdownSelection(tableType, dropdownId, selectedOptions);
    
        // Apply filters and update UI only if Control key is not pressed, or if the selection is "ALL"
        if (!this.isControlKeyPressed || event.target.value === "ALL") {
            this.applyFiltersAndUpdateDropdowns(tableType);
        }
    }
        getTableTypeFromDropdownId(dropdownId) {
            const mapping = {
                'prodIssuerDropdown': 'prod',
                'prodProdIdDropdown': 'prod',
                'prodCouponTypeDropdown': 'prod',
                'prodRatingProdDropdown': 'prod',
                'prodMaturityDropdown': 'prod',
                'prodRankDropdown': 'prod',

                'issuerIssuerDropdown': 'issuer',
                'issuerRatingDropdown': 'issuer',

                'dealsProdIdDropdown': 'deals',
                'dealsCategoryDropdown': 'deals',
                'dealsNotionalDropdown': 'deals',
                'dealsDepotbankDropdown': 'deals',

                'portIssuerDropdown': 'port',
                'portProdIdDropdown': 'port',
                'portCouponTypeDropdown': 'port',
                'portCategoryDropdown': 'port',
                'portRatingDropdown': 'port',
                'portMaturityDropdown': 'port',
                'portRankDropdown': 'port',
                'portDepotbankDropdown': 'port',
                'liquMaturityDropdown': 'port',

                'offersIssuerDropdown': 'offers',
                'offersProdIdDropdown': 'offers',
                'offersCouponTypeDropdown': 'offers',
                'offersCategoryDropdown': 'offers',
                'offersRatingDropdown': 'offers',
                'offersRankDropdown': 'offers',
                'offersMaturityDropdown': 'offers',
                'offersDepotbankDropdown': 'offers',
                
                'createdDealsDropdown': 'dealsTables',

                'createdOffersDropdown': 'offersTables', 

                'createdPortDropdown0': 'portTables0',
                'createdPortDropdown1': 'portTables1',
                'createdPortDropdown2': 'portTables2',

                'tradeDropdown': 'deals' ,

                // 'liquMaturityDropdown': 'liqu',

                
            };
            return mapping[dropdownId] || null; // Fallback to null if no match is found
        }
        updateDropdownSelection(tableType, dropdownId, selectedOptions) {
            //console.log(`🔄 Aktualisiere Auswahl für ${dropdownId} (${tableType}):`, selectedOptions);
        
            // Update selection
            if (this.dropdownConfig[tableType] && this.dropdownConfig[tableType][dropdownId]) {
                this.dropdownConfig[tableType][dropdownId].selection = selectedOptions;
                //console.log(`✅ Gespeicherte Auswahl für ${dropdownId}:`, this.dropdownConfig[tableType][dropdownId].selection);
            } else {
                console.warn(`⚠️ Kein Eintrag für ${dropdownId} in dropdownConfig[${tableType}] gefunden.`);
            }
        }            
        applyFiltersAndUpdateDropdowns(tableType, opts = {}) {
            const { preselect } = (typeof opts === 'string') ? { preselect: opts } : opts;

            let receivedData;
            switch (tableType) {
                case 'issuer':
                receivedData = this.issuerData; break;
                case 'prod':
                receivedData = this.prodData; break;
                case 'deals':
                receivedData = this.dealsData; break;
                case 'port':
                receivedData = this.portData; break;

                case 'offers':
                receivedData = this.offersData; break;

                case 'offersTables': // nur Name-Listen für Offers-Dropdown
                receivedData = this.getOffersNameList(); break;
                case 'dealsTables': // nur Name-Listen für Deals-Dropdown
                receivedData = this.getDealsNameList(); break;
                case 'portTables0':
                case 'portTables1':
                case 'portTables2':
                receivedData = this.getPortNameList(); break;
                default:
                console.error("Unknown tableType:", tableType);
                return;
            }

            if (!Array.isArray(receivedData)) return;

            const dropdownConfig = this.dropdownConfig[tableType];
            if (!dropdownConfig) {
                console.error(`🚨 Kein dropdownConfig für ${tableType} gefunden!`);
                return;
            }

            // Helper: „ALL“-Auswahl erkennen
            const isAllSelected = (selArr) =>
                Array.isArray(selArr) && selArr.some(v => v === 'ALL' || v === 'ALL_TABLE_NAME' || v === '*');

            // Filtern (funktioniert auch für Table-Name-Listen, wenn dataKey=table_name konfiguriert ist)
            const filteredData = receivedData.filter(item => {
                return Object.entries(dropdownConfig).every(([dropdownId, { selection, dataKey }]) => {
                if (isAllSelected(selection)) return true;
                return selection.includes(item[dataKey]);
                });
            });

            this.setFilteredDataForTable(tableType, filteredData);
            this.repopulateDropdownsForTableType(tableType, filteredData);

            // Nach dem Rebuild ggf. vorherige Auswahl wiederherstellen
            if (preselect && (tableType === 'dealsTables' || tableType === 'offersTables')) {
                const ddId = (tableType === 'dealsTables') ? 'createdDealsDropdown' : 'createdOffersDropdown';
                const dd = document.getElementById(ddId);
                if (dd) {
                const norm = s => String(s || '').trim();
                const opt = Array.from(dd.options).find(o =>
                    norm(o.value) === norm(preselect) || norm(o.textContent) === norm(preselect)
                );
                if (opt) {
                    dd.value = opt.value;
                    // internen State syncen
                    if (tableType === 'dealsTables') {
                    this.setSelectedDealsTableName?.(opt.value);
                    } else {
                    this.setSelectedOffersTableName?.(opt.value);
                    }
                    dd.dispatchEvent(new Event('change', { bubbles: true }));
                }
                }
            }

            this.updateUIWithFilteredData(tableType, filteredData);
        }

            repopulateDropdownsForTableType(tableType, filteredData) {
                const config = this.tableConfigs[tableType];
                Object.keys(config.dropdownConfig).forEach(dropdownId => {
                    this.populateDropdown(dropdownId, filteredData, `ALL ${config.dropdownConfig[dropdownId].dataKey.toUpperCase()}`, tableType);
                    // console.log('filteredData:', filteredData);
                });
            }
                populateDropdown(dropdownId, data, allText, tableType) {
                    const config = this.dropdownConfig[tableType];
                    const dropdown = document.getElementById(dropdownId);
                    if (!config || !dropdown) {
                        console.error("Configuration or Dropdown not found:", dropdownId, tableType);
                        return; // Early exit if config or dropdown is not found
                    }
                    
                    let uniqueValues = [...new Set(data.map(item => item[config[dropdownId]?.dataKey]))];
                
                    // Determine the appropriate sorting method based on the dropdownId
                    if (dropdownId.endsWith('RatingDropdown')) {
                        uniqueValues = uniqueValues.sort((a, b) => this.sortRatings(a, b));
                    } else if (dropdownId.endsWith('MaturityDropdown')) {
                        // Assume sortDates is another method you might have for sorting dates
                        uniqueValues.sort(this.sortDates);
                    } else if (dropdownId.endsWith('NotionalDropdown')) {
                        uniqueValues.sort(this.sortNotionals);
                    }
                    else {
                        uniqueValues.sort(); // Default sorting for other dropdowns
                    }
                
                    // Repopulate the dropdown
                    const currentOptions = [...dropdown.options].map(option => option.value);
                    if (!this.arraysEqual(currentOptions, ['ALL', ...uniqueValues])) {
                        dropdown.innerHTML = ''; // Clear existing options
                        this.addDropdownOption(dropdown, 'ALL', allText); // Add 'ALL' option as the first option
                        uniqueValues.forEach(value => this.addDropdownOption(dropdown, value, value)); // Add all unique values as options
                    }
                }
                    addDropdownOption(dropdown, value, text) {
                        const option = document.createElement('option');
                        option.value = value;
                        option.textContent = text;
                        dropdown.appendChild(option);
                    }

            updateUIWithFilteredData(tableType, filteredData) {
                // const filteredData = this.getFilteredData(tableType);
                //console.log("tableType:", tableType);
                //console.log("filteredData:", filteredData);
            
                const config = this.tableConfigs[tableType];
                if (config && typeof config.dataHandler === 'function') {
                    // Pass both filteredData and filtersConfig to the data handler
                    config.dataHandler(filteredData, config.filtersConfig);
                    //console.log("dataHandler called with filteredData:", filteredData);
                    //console.log("filtersConfig:", config.filtersConfig);
                } else {
                    console.error("No data handler found for tableType:", tableType);
                }
            }
        

    // resetButton
    resetFiltersForActiveTable(receivedData, currentActiveTable) {
        // Assuming you have access to the activeConfig and dropdownConfig
        // console.log('currentActiveTable:', currentActiveTable)
        const activeConfig = this.tableConfigs[currentActiveTable];
        const dropdownConfig = activeConfig.dropdownConfig;
    
        // Reset all selections in the dropdowns for the active table
        Object.keys(dropdownConfig).forEach(dropdownId => {
            dropdownConfig[dropdownId].selection = ['ALL']; // Assuming 'ALL' is the value for selecting all options
        });
    
        this.applyFiltersAndUpdateDropdowns(currentActiveTable);
    
        // Optionally, you can also update the UI or perform any other necessary actions after resetting the filters
        // console.log('Filters reset for table:', currentActiveTable);
    };





updateDropdownOptions({
  dropdownElementId,
  getDataFunction,
  updateDataFunction,
  updateMvarDataFunction,
  updateCvarDataFunction,
  updateEADDataFunction,
  selectedTableName,
  index,
}) {
  const dropdownElement = document.getElementById(dropdownElementId);
  console.log('START:', dropdownElementId);
  if (!dropdownElement) { console.error(`⚠️ Dropdown element '${dropdownElementId}' not found.`); return; }

  const isPortfolio = dropdownElementId.startsWith('createdPortDropdown');
  const isOffers    = dropdownElementId === 'createdOffersDropdown';
  const isDeals     = dropdownElementId === 'createdDealsDropdown';

  if (isPortfolio && typeof this.setPortIndex === 'function') this.setPortIndex(index);

  const data = getDataFunction();
  if (!Array.isArray(data) || data.length === 0) {
    dropdownElement.innerHTML = '<option disabled>No data available</option>';
    return;
  }

  dropdownElement.innerHTML = '';
  data.forEach(item => {
    const option = document.createElement('option');
    option.value = String(item.table_name);        // ⚠️ String-cast
    option.textContent = item.table_name;
    dropdownElement.appendChild(option);
  });

  const desired = String(selectedTableName ?? '');
  const isValid = [...dropdownElement.options].some(opt => opt.value === desired);
  dropdownElement.value = isValid ? desired : String(data[0].table_name);

  // ✅ Richtigen State setzen:
  if (isPortfolio || isOffers) {
    appState.setSelectedPortTableName(dropdownElement.value);   // ⚠️ vorher falsch
  } else if (isDeals) {
    appState.setSelectedDealsTableName(dropdownElement.value);
  }

  // ✅ Richtige Datenquelle wählen:
  const usePortfolioData = isPortfolio || isOffers;             // ⚠️ Offers nutzt Portfolios
  const allData = usePortfolioData ? appState.getAllPortfolioData()
                                   : appState.getAllDealsData();
  //console.log('allData', allData);

  const filteredData = allData.filter(e => e.port_name === dropdownElement.value);
  if (filteredData.length === 0) {
    console.warn(`⚠️ Keine Daten für '${dropdownElement.value}' (${usePortfolioData ? 'Portfolio/Offers' : 'Deals'}).`);
    return;
  }

  const safeIndex = isPortfolio ? (index ?? 0) : 0;

  if (typeof updateDataFunction === 'function') {
    updateDataFunction(filteredData, safeIndex);
  }

  if (isPortfolio) {
    if (typeof updateMvarDataFunction === 'function') {
      const filteredMvar = appState.getAllMvarData().filter(e => e.port_name === dropdownElement.value);
      updateMvarDataFunction(filteredMvar, safeIndex);
    }
    if (typeof updateCvarDataFunction === 'function') {
      const filteredCvar = appState.getAllCvarData().filter(e => e.port_name === dropdownElement.value);
      updateCvarDataFunction(filteredCvar, safeIndex);
    }
    if (typeof updateEADDataFunction === 'function') {
      const filteredEAD = appState.getAllEADData().filter(e => e.port_name === dropdownElement.value);
      updateEADDataFunction(filteredEAD, safeIndex);
    }
  }
}



fetchAndHandlePortData(tableName, dropdownId) {
        console.log(`🔍 Fetching Portfolio Data from appState for: ${tableName}`);
    
        // ✅ Daten direkt aus `appState` holen
        const allPortfolios = appState.getAllPortfolioData();

        if (!allPortfolios || allPortfolios.length === 0) {
            console.warn(`⚠️ No portfolio data available in appState.`);
            return;
        }
    
        console.log('📌 Alle gespeicherten Portfolios:', allPortfolios);
    
        // 🔹 Das richtige Portfolio filtern
        const filteredData = allPortfolios.filter(entry => entry.port_name === tableName);
        if (!filteredData.length) {
            console.warn(`⚠️ Kein Portfolio gefunden für ${tableName} in Portfolios.`);
            return;
        }

        //console.log(`📌 filteredData für ${tableName}.`,filteredData);
    
        // 🔹 Richtigen Container ermitteln
        let containerId;
        switch (dropdownId) {
            case 'createdPortDropdown0': containerId = 'portDataContainer0'; break;
            case 'createdPortDropdown1': containerId = 'portDataContainer1'; break;
            case 'createdPortDropdown2': containerId = 'portDataContainer2'; break;
            default: containerId = 'portDataContainer0';
        }
    
        console.log(`📌 Aktualisiere Container: ${containerId} mit Daten für: ${tableName}`);
    
        // 🔹 Aktives Element setzen & Daten aktualisieren
        this.setActiveElementId(containerId);
    }
    
    getFormElementsForContainer(containerId) {
        switch (containerId) {
            case 'portDataContainer1':
                return {
                    formPortValue: document.getElementById('formPortValue1'),
                    formPortNotional: document.getElementById('formPortNotional1'),
                    formPortYield: document.getElementById('formPortYield1'),
                    formPortYieldA: document.getElementById('formPortYieldA1'),
                    formPortPV01: document.getElementById('formPortPV011'),
                    formPortCPV01: document.getElementById('formPortCPV011')
                };
            case 'portDataContainer2':
                return {
                    formPortValue: document.getElementById('formPortValue2'),
                    formPortNotional: document.getElementById('formPortNotional2'),
                    formPortYield: document.getElementById('formPortYield2'),
                    formPortYieldA: document.getElementById('formPortYieldA2'),
                    formPortPV01: document.getElementById('formPortPV012'),
                    formPortCPV01: document.getElementById('formPortCPV012')
                };
            default:
                return {
                    formPortValue: document.getElementById('formPortValue'),
                    formPortNotional: document.getElementById('formPortNotional'),
                    formPortYield: document.getElementById('formPortYield'),
                    formPortYieldA: document.getElementById('formPortYieldA'),
                    formPortPV01: document.getElementById('formPortPV01'),
                    formPortCPV01: document.getElementById('formPortCPV01')
                };
        }
    }
    
}