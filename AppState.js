import { handleIssuerData } from './r_tab/ISSUER.js';
import { handleProdData } from './PROD.js';
import { handleDealsData} from './DEALS.js';
import { handlePortMainData, handlePortMainFilteredData} from './PORT.js';
import { handleIRSensData } from './IRSens.js';
import { handleCSSensData } from './CSSens.js';
import { handleCSMatrixData } from './CSMatrix.js';
import { handleCSParameterData } from './CSParameter.js';
import { handleIRData } from './IR.js';
import { handleFWDData, handleSwapForwardCurve } from './FORWARDS.js';
import { handleMVaRData } from './MVaR.js'; 
import { handleEADMainData, handleCVaRData } from './CVaR.js'; 
import { handleCouponData } from './PRODCoupon.js';
import { getPortDataForElement } from './PORT.js';

import { formPortValue, formPortNotional, formFiltPortNotional, formPortYield, formPortYieldA, formPortPV01, formPortCPV01 } from './PORT.js';
import { appState } from './renderer.js';
// import { handleLiquidityData } from './liquidity.js';


const portDataMap = {}; // 🔄 Speichert Daten pro Container



export class AppState {
    constructor() {
        this.availableDealsTablesData = {}; 
        this.availableDealsTablesArray = [];
        
        this.availablePortTablesData = {}; 
        this.availablePortTablesArray = [];

        this.currentDealsDataTable = 'DealsMain'; 

        this.currentPortDataTable0 = 'PortMainData'; 
        this.currentPortDataTable = 'PortMainData'; 
        this.currentPortDataTable2 = 'PortMainData'; 

        this.portfolioData = []; 
        

        this.currentActiveTable = null;

        this.issuerData = null;
        this.prodData = null;
        this.filteredProdData = null,
        this.couponData = null;

        this.dealsData = [];
        this.allDealsData = [];

        this.rankData = null;
        this.mvarData = null,
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
        this.selectedDealsTableName = 'UNI';
        this.selectedPortTableName = 'UNI';

        this.portDataSets = { port0: null, port1: null, port2: null };
        this.mvarDataSets = { port0: null, port1: null, port2: null };
        this.cvarDataSets = { port0: null, port1: null, port2: null };
        




        // Binding methods
        this.handleDropdownChange = this.handleDropdownChange.bind(this);
        this.updateUIWithFilteredData = this.updateUIWithFilteredData.bind(this);
        // this.updateUIBasedOnAppState = this.updateUIBasedOnAppState.bind(this);
        this.resetFiltersForActiveTable = this.resetFiltersForActiveTable.bind(this);

        this.getCreatedPortData = this.getCreatedPortData.bind(this);

        this.initDropdownListeners(); // Make sure to call this to initialize listeners

        // Handlers for different data types
        this.handleDealsData = handleDealsData;
        this.handleIRSensData = handleIRSensData;
        this.handleCSSensData = handleCSSensData;
        this.handleCSMatrixData = handleCSMatrixData;
        this.handleCSParameterData = handleCSParameterData;
        this.handlePortMainData = handlePortMainData;
        this.handleEADMainData = handleEADMainData;
        this.handleCVaRData = handleCVaRData;

        this.handleIRData = handleIRData;
        this.handleFWDData = handleFWDData;
        this.handleSwapForwardCurve = handleSwapForwardCurve;
        
        this.handleMVaRData = handleMVaRData;
        //this.handleCouponData = handleCouponData;

        

        this.applyFiltersAndUpdateDropdowns = this.applyFiltersAndUpdateDropdowns.bind(this);
        this.activeElementId = null;
        this.setActiveElementId = this.setActiveElementId.bind(this);
        this.getActiveElementId = this.getActiveElementId.bind(this);

        this.handleDealsTable = this.handleDealsTable.bind(this);
        this.handlePortTable = this.handlePortTable.bind(this);

        this.fetchAndHandlePortData = this.fetchAndHandlePortData.bind(this);
        this.updatePortData = this.updatePortData.bind(this);
        

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
            port: {
                'ISSUER': new Set(['ALL']),
                'PROD_ID': new Set(['ALL']),
                'CouponType': new Set(['ALL']),
                'CATEGORY': new Set(['ALL']),
                'RATING': new Set(['ALL']),
                'MATURITY': new Set(['ALL']),
            },
            //Auflistung der Deals die ein Portfolio bilden (nicht deals: TRADE_ID...)
            dealsTables: {
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
        }
        this.dropdownConfig = {
            prod: {
                'prodIssuerDropdown': { dataKey: 'ISSUER', selection: ['ALL'] },
                'prodProdIdDropdown': { dataKey: 'PROD_ID', selection: ['ALL'] },
                'prodCouponTypeDropdown': { dataKey: 'CouponType', selection: ['ALL'] },
                'prodRatingProdDropdown': { dataKey: 'RATING_PROD', selection: ['ALL'] },
                'prodMaturityDropdown': { dataKey: 'MATURITY', selection: ['ALL'] },
                'prodRankDropdown': { dataKey: 'RANK', selection: ['ALL'] },
            },
            issuer: {
                'issuerIssuerDropdown': { dataKey: 'ISSUER', selection: ['ALL'] },
                'issuerRatingDropdown': { dataKey: 'RATING', selection: ['ALL'] },
            },
            port: {
                // 'createdPortDropdown0': { dataKey: 'table_name', selection: ['ALL'] },

                'portIssuerDropdown': { dataKey: 'ISSUER', selection: ['ALL'] },
                'portProdIdDropdown': { dataKey: 'PROD_ID', selection: ['ALL'] },
                'portCouponTypeDropdown': { dataKey: 'CouponType', selection: ['ALL'] },
                'portCategoryDropdown': { dataKey: 'CATEGORY', selection: ['ALL'] },
                'portRatingDropdown': { dataKey: 'RATING', selection: ['ALL'] },
                'portMaturityDropdown': { dataKey: 'MATURITY', selection: ['ALL'] },
                'portDepotbankDropdown': { dataKey: 'Depotbank', selection: ['ALL'] },
            },
            deals: {
                'tradeDropdown': { dataKey: 'TRADE_ID', selection: ['ALL'] },
    
                'dealsProdIdDropdown': { dataKey: 'PROD_ID', selection: ['ALL'] },
                'dealsCategoryDropdown': { dataKey: 'CATEGORY', selection: ['ALL'] },
                'dealsNotionalDropdown': { dataKey: 'NOTIONAL', selection: ['ALL'] },
                'dealsDepotbankDropdown': { dataKey: 'Depotbank', selection: ['ALL'] },
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
                default: 'port',
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
                filtersConfig: this.filtersConfig.prod,
                dataHandler: handleProdData,
            },
            deals: {
                dropdownConfig: this.dropdownConfig.deals,
                filtersConfig: this.filtersConfig.deals,
                dataHandler: (receivedData) => {
                    const dealsTableName = this.currentDealsDataTable;
                    handleDealsData(receivedData, dealsTableName);
                },
            },
            port: {
                dropdownConfig: this.dropdownConfig.port,
                filtersConfig: this.filtersConfig.port,
                elementIds: ['portDataContainer0', 'portDataContainer1', 'portDataContainer2'],
                dataHandler: (receivedData) => {
                    const activeElementId = this.getActiveElementId();
                    const selectedPortTableName = this.getSelectedPortTableName();
                    
                    console.log('receivedData:', receivedData);
                    console.log('activeElementId:', activeElementId);
                    console.log('selectedPortTableName:', selectedPortTableName);
            
                    if (receivedData && receivedData.length > 0) {
                        handlePortMainFilteredData(receivedData, this.filtersConfig.port, activeElementId, this.tableConfigs[activeElementId]);
                        handlePortMainData(receivedData, activeElementId);
                    } else {
                        console.warn("⚠️ No portfolio data found in appState!");
                    }
                }
            },
            
            

            dealsTables: {
                dropdownConfig: this.dropdownConfig.dealsTables,
                filtersConfig: this.filtersConfig.dealsTables,
                dataHandler: this.handleDealsTable.bind(this),
                },
            portTables0: {
                dropdownConfig: this.dropdownConfig.portTables0,
                filtersConfig: this.filtersConfig.portTables0,
                dataHandler: this.handlePortTable.bind(this),
                },   
            portTables1: {
                dropdownConfig: this.dropdownConfig.portTables1,
                filtersConfig: this.filtersConfig.portTables1,
                dataHandler: this.handlePortTable.bind(this),
                },    
            portTables2: {
                dropdownConfig: this.dropdownConfig.portTables2,
                filtersConfig: this.filtersConfig.portTables2,
                dataHandler: this.handlePortTable.bind(this),
                },  
        },


        
        
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

        this.initDropdownListeners(); // Initialize listeners for dropdown changes

        
    }

    handleDealsTable(data) {
        //console.log("Handling deals table data:", data);
    }

    handlePortTable(data) {
        //console.log("Handling port table data:", data);
    } 



    arraysEqual(arr1, arr2) {
        if (arr1.length !== arr2.length) return false;
        for (let i = 0; i < arr1.length; i++) {
            if (arr1[i] !== arr2[i]) return false;
        }
        return true;
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
        // this.notifyObservers(); 
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
        this.dealsData = data;
        // this.notifyObservers(); 
    }
    getDealsData() {
        return this.dealsData; 
    }


    setPortData(data) {
        this.portData = data;
        // this.notifyObservers(); 
    }

    // ✅ Setzt die Portfolios in den AppState
    setPortfolioData(data) {
        this.portfolioData = data;
        console.log('✅ Portfolio-Daten gespeichert:', this.portfolioData);
    }

    // ✅ Holt die Portfolios aus dem AppState
    getPortfolioData() {
        return this.portfolioData;
    }
    

    setMvarData(data) {
        console.log('setMvarData:', data)
        this.mvarData = data;
        // this.notifyObservers(); 
    }
    getMvarData() {
        return this.mvarData;
        
    }
    setCvarData(data) {
        this.cvarData = data;
        // this.notifyObservers(); 
    }
    
    
    getCvarData() {
        return this.cvarData;
        
    }
    setAllCvarData(data) {
        console.log('setAllCvarData:', data)
        this.AllCvarData = data;
        // this.notifyObservers(); 
    }
    
    
    getAllCvarData() {
        return this.AllCvarData;
        
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
        console.log('setSelectedDealsTableName:', tableName);  
        // Optionally, you might want to notify observers about this change
        // this.notifyObservers();
    }
    getSelectedDealsTableName() {
        
        return this.selectedDealsTableName;
    }

    setSelectedPortTableName(tableName) {
        this.selectedPortTableName = tableName;  // 🔥 Speichert in `selectedPortTableName`
        console.log('🛠 setSelectedPortTableName speichert:', this.selectedPortTableName);
    }

    getSelectedPortTableName() {
        // console.log('🔎 getSelectedPortTableName gibt zurück:', this.selectedPortTableName);
        return this.selectedPortTableName;  // 🔥 Gibt den korrekten Wert zurück
    }

    // created Deals
    setCreatedDealsData(receivedData) {
        if (!Array.isArray(receivedData)) {
            console.error("setCreatedDealsData received non-array data:", receivedData);
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
        console.log('this.availableDealsTablesArray', this.availableDealsTablesArray)
        this.notifyObservers();
    }
    getCreatedDealsData() {
        //console.log('getCreatedDealsData:', this.availableDealsTablesArray);
        return this.availableDealsTablesArray;
        
    }
    
    // created Port
    setCreatedPortData(receivedData) {
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
            console.error("setCreatedPortData received invalid data:", receivedData);
            return;
        }
        
        console.log('this.availablePortTablesArray', this.availablePortTablesArray);
        this.notifyObservers();
    }

    getCreatedPortData() {
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




    updateDealsDataTable(receivedData) {
        console.log('updateDealsDataTable', receivedData);
        console.trace("🔍 updateDealsDataTable triggered from:");
        
        this.setDealsData(receivedData);
        //this.updateDropdowns('deals');
        this.applyFiltersAndUpdateDropdowns('deals');
    }

    updatePortDataTable(receivedData) {
        console.log('📌 updatePortDataTable called with:', receivedData);
        console.trace("🔍 updatePortDataTable triggered from:");
        
        this.setPortData(receivedData);
        this.applyFiltersAndUpdateDropdowns('port');
    }
    


    updateMvarDataTable(receivedData) {
        //console.log('updateMvarDataTable', receivedData);

        this.setMvarData(receivedData);
    }

    updateCvarDataTable(receivedData) {
        //console.log('updateCvarDataTable', receivedData);

        this.setCvarData(receivedData);
    }
    
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
    
    // Add dropdown option utility
    addDropdownOption(dropdown, value, text) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = text;
        dropdown.appendChild(option);
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
            'portDepotbankDropdown': 'port',
            
            'tradeDropdown': 'deals' ,

            'createdDealsDropdown': 'portTables1',
            'createdPortDropdown0': 'portTables1',
            'createdPortDropdown1': 'portTables1',
            'createdPortDropdown2': 'portTables1',
            
        };
        return mapping[dropdownId] || null; // Fallback to null if no match is found
    }

    updateDropdownSelection(tableType, dropdownId, selectedOptions) {
        console.log(`🔄 Aktualisiere Auswahl für ${dropdownId} (${tableType}):`, selectedOptions);
    
        // Update selection
        if (this.dropdownConfig[tableType] && this.dropdownConfig[tableType][dropdownId]) {
            this.dropdownConfig[tableType][dropdownId].selection = selectedOptions;
            console.log(`✅ Gespeicherte Auswahl für ${dropdownId}:`, this.dropdownConfig[tableType][dropdownId].selection);
        } else {
            console.warn(`⚠️ Kein Eintrag für ${dropdownId} in dropdownConfig[${tableType}] gefunden.`);
        }
    }
    

    applyFiltersAndUpdateDropdowns(tableType) {
        let receivedData;
    
        switch (tableType) {
            case 'issuer':
                receivedData = this.issuerData;
                break;
            case 'prod':
                receivedData = this.prodData;
                break;
            case 'deals':
                receivedData = this.dealsData;
                break; 
            case 'port':
                receivedData = this.portData;
                break;    
            case 'dealsTables':
                receivedData = this.availableDealsTablesArray;
                break;
            case 'portTables0':
            case 'portTables1':
            case 'portTables2':
                receivedData = this.getCreatedPortData();
                break;  
            default:
                console.error("Unknown tableType:", tableType);
                return; // Early exit if tableType is not recognized
        }
    
        if (!Array.isArray(receivedData)) {
            return;
        }
    
        const dropdownConfig = this.dropdownConfig[tableType];

        if (!dropdownConfig) {
            console.error(`🚨 Fehler: Kein dropdownConfig für ${tableType} gefunden!`);
            return; 
        }
        
        let filteredData = receivedData.filter(item => {
                return Object.entries(dropdownConfig).every(([dropdownId, {selection}]) => {
                    const dataKey = dropdownConfig[dropdownId].dataKey;
                    if (selection.includes('ALL')) return true;

                    return selection.includes(item[dataKey]);
                });
            });
        // }
        console.log(`📌 Filtered data for table type "${tableType}":`, filteredData);

        this.setFilteredDataForTable(tableType, filteredData);
    
        // Repopulate dropdowns and update UI as necessary
        this.repopulateDropdownsForTableType(tableType, filteredData);
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

    updateUIWithFilteredData(tableType, filteredData) {
        // const filteredData = this.getFilteredData(tableType);
        console.log("tableType:", tableType);
        console.log("filteredData:", filteredData);
    
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
        selectedTableName,
    }) {
        const dropdownElement = document.getElementById(dropdownElementId);
        if (!dropdownElement) {
            console.error(`⚠️ Dropdown element '${dropdownElementId}' not found.`);
            return;
        }
    
        // 🛠 Get the updated list of data from appState
        const data = getDataFunction();
        if (!Array.isArray(data) || data.length === 0) {
            console.warn(`⚠️ No data found for dropdown '${dropdownElementId}'`);
            dropdownElement.innerHTML = '<option disabled>No data available</option>';
            return;
        }
    
        console.log(`📌 Updating dropdown '${dropdownElementId}' with`, data.length, 'entries.');
    
        // 🛠 Populate dropdown with new options
        dropdownElement.innerHTML = '';
        data.forEach(item => {
            const option = document.createElement('option');
            option.value = item.table_name;
            option.textContent = item.table_name;
            dropdownElement.appendChild(option);
        });
    

        // 🛠 Set selected option
        dropdownElement.value = selectedTableName;
        console.log(`✅ Selected table in '${dropdownElementId}':`, selectedTableName);
    

        appState.setSelectedPortTableName(selectedTableName);

        // Portfolios oder DealsMain geladen werden
        const isPortfolio = dropdownElementId.startsWith('createdPortDropdown');
        const allData = isPortfolio ? appState.getPortfolioData() : appState.getAllDealsData();
        console.log(`📌 Daten für alle Portfolios:`, allData);
        const filteredData = allData.filter(entry => entry.port_name === selectedTableName);

        console.log(`📌 Gefilterte Daten für ${selectedTableName}:`, filteredData);

        if (filteredData.length > 0) {
            updateDataFunction(filteredData);
        } else {
            console.warn(`⚠️ Keine Daten gefunden für '${selectedTableName}' (${isPortfolio ? 'Portfolio' : 'Deals'}).`);
        }

    
        // const dynamicMVaRDataTable = `MVar${selectedTableName}Main_rel`;
        // window.api.send('fetch-table-data', dynamicMVaRDataTable);
        // registerListener(`${dynamicMVaRDataTable}Data`, receivedDynamicMVaRData => {
        //     if (updateMvarDataFunction && receivedDynamicMVaRData?.length) {
        //         updateMvarDataFunction(receivedDynamicMVaRData);
        //     } else {
        //         console.warn(`⚠️ No dynamic MVaR data found for '${selectedTableName}'`);
        //     }
        // });
    
        // const generalMVaRDataTable = 'MVaRMain_rel';
        // window.api.send('fetch-table-data', generalMVaRDataTable);
        // registerListener(`${generalMVaRDataTable}Data`, receivedGeneralMVaRData => {
        //     if (updateMvarDataFunction && receivedGeneralMVaRData?.length) {
        //         updateMvarDataFunction(receivedGeneralMVaRData);
        //     }
        // });
    }

    fetchAndHandlePortData(tableName, dropdownId) {
        console.log(`🔍 Fetching Portfolio Data from appState for: ${tableName}`);
    
        // ✅ Daten direkt aus `appState` holen
        const allPortfolios = appState.getPortfolioData();
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

        console.log(`📌 filteredData für ${tableName}.`,filteredData);
    
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
        this.updatePortData(filteredData, containerId);
    }
    
    updatePortData(receivedData, containerId) {
        
        //this.updatePortDataTable(receivedData);
        
        const portData = receivedData//getPortDataForElement(containerId);


        console.log('receivedData', receivedData, containerId); 
        console.log('portData', portData);


        this.handlePortMainData(portData, containerId);
        this.applyFiltersAndUpdateDropdowns('port');
    
        // Update the form fields based on the active element ID
        // const containerId = this.getActiveElementId();
        const elements = this.getFormElementsForContainer(containerId);

        // console.log('elements', elements)
    
        elements.formPortValue.textContent = formPortValue;
        elements.formPortNotional.textContent = formPortNotional;
        elements.formPortYield.textContent = formPortYield;
        elements.formPortYieldA.textContent = formPortYieldA;
        elements.formPortPV01.textContent = formPortPV01;
        elements.formPortCPV01.textContent = formPortCPV01;
    
        // console.log('formPortNotional', formPortNotional);
        // console.log('formPortValue', formPortValue);
    
        // Reset button for port filters
        const portResetButton = document.getElementById('portResetFiltersButton');
        if (portResetButton) {
            portResetButton.addEventListener('click', () => this.resetFiltersForActiveTable(receivedData, 'port'));
        }
    
        // Update IRSensDataContainer
        const IRSensTable = this.handleIRSensData(receivedData);
        const IRSensDataContainer = document.getElementById('IRSensDataContainer');
        if (IRSensDataContainer) {
            IRSensDataContainer.innerHTML = ''; // Clear existing contents
            IRSensDataContainer.appendChild(IRSensTable); // Append the new table
        }
    
        // Update CSSensDataContainer
        const CSSensTable = this.handleCSSensData(receivedData);
        const CSSensDataContainer = document.getElementById('CSSensDataContainer');
        if (CSSensDataContainer) {
            CSSensDataContainer.innerHTML = ''; // Clear existing contents
            CSSensDataContainer.appendChild(CSSensTable); // Append the new table
        }
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