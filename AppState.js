import { handleIssuerData } from './r_tab/ISSUER.js';
import { handleProdData } from './PROD.js';
import { handleDealsData, handleCreatedPortData} from './DEALS.js';
import { handlePortMainData, handlePortMainFilteredData} from './PORT.js';
import { handleIRSensData } from './IRSens.js';
import { handleCSSensData } from './CSSens.js';
import { handleCSMatrixData } from './CSMatrix.js';
import { handleCSParameterData } from './CSParameter.js';
import { handleIRData } from './IR.js';
import { handleEADMainData, handleCVaRData } from './CVaR.js'; 





export class AppState {
    constructor() {
        //For createdPortData/portTablesData
        this.availablePortPortTablesData = {}; // Stores available tables data
        this.availablePortPortTablesArray = [];

        this.availablePortTablesData = {}; // Object map for direct access by name
        this.availablePortTablesArray = [];
        
        this.currentDealsDataTable = 'DealsMain'; // Default table name
        this.currentPortDataTable = 'DealsMainData'; // Default table name
        this.currentPortPortDataTable = 'DealsMainData'; // Default table name


        this.currentActiveTable = null;

        this.issuerData = null;
        this.prodData = null;
        this.dealsData = null;
        this.createdPortData = null;
        this.createdPortPortData = null;

        this.filteredData = {};

        this.tempSelections = {};
        this.isControlKeyPressed = false;
        
        this.currentReceivedData = null;
        this.selectedTradeIDs = ['ALL'];
        this.selectedDealsTableName = 'DealsMain';

        // New dropdown selections state
        this.dropdownSelections = {
            // Prod dropdowns
            'prodIssuerDropdown': new Set(),
            'prodProdIdDropdown': new Set(),
            'prodCouponTypeDropdown': new Set(),
            'prodRatingProdDropdown': new Set(),
            'prodMaturityDropdown': new Set(),
            'prodRankDropdown': new Set(),
            // Issuer dropdowns
            'issuerIssuerDropdown': new Set(),
            'issuerRatingDropdown': new Set(),
            // Port dropdowns
            'portIssuerDropdown': new Set(),
            'portProdIdDropdown': new Set(),
            'portCouponTypeDropdown': new Set(),
            'portCategoryDropdown': new Set(),
            'portRatingDropdown': new Set(),
            'portMaturityDropdown': new Set(),
            // Deals dropdown
            'createdPortDropdown': new Set(),
            'tradeDropdown': new Set(),
            'createdPortPortDropdown': new Set(),
            // Add other dropdowns as needed
        };
        

        // Binding methods
        this.handleDropdownChange = this.handleDropdownChange.bind(this);
        this.updateUIWithFilteredData = this.updateUIWithFilteredData.bind(this);
        this.updateUIBasedOnAppState = this.updateUIBasedOnAppState.bind(this);
        this.resetFiltersForActiveTable = this.resetFiltersForActiveTable.bind(this);

        //this.someMethod = this.someMethod.bind(this);
        // this.populateCreatedPortDropdown = this.populateCreatedPortDropdown.bind(this);
        this.handlePortDropdownChange = this.handlePortDropdownChange.bind(this);

        this.getCreatedPortPortData = this.getCreatedPortPortData.bind(this);

        this.initDropdownListeners(); // Make sure to call this to initialize listeners

        // Handlers for different data types
        this.handleCreatedPortData = handleCreatedPortData;
        this.handleDealsData = handleDealsData;
        this.handleIRSensData = handleIRSensData;
        this.handleCSSensData = handleCSSensData;
        this.handleCSMatrixData = handleCSMatrixData;
        this.handleCSParameterData = handleCSParameterData;
        this.handlePortMainData = handlePortMainData;
        this.handleEADMainData = handleEADMainData;
        this.handleCVaRData = handleCVaRData;
        this.handleIRData = handleIRData;

        this.handlePortTable = this.handlePortTable.bind(this);
        

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
            portTables: {
                'table_name': new Set(['ALL']),

            },
            portPortTables: {
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
                'portIssuerDropdown': { dataKey: 'ISSUER', selection: ['ALL'] },
                'portProdIdDropdown': { dataKey: 'PROD_ID', selection: ['ALL'] },
                'portCouponTypeDropdown': { dataKey: 'CouponType', selection: ['ALL'] },
                'portCategoryDropdown': { dataKey: 'CATEGORY', selection: ['ALL'] },
                'portRatingDropdown': { dataKey: 'RATING', selection: ['ALL'] },
                'portMaturityDropdown': { dataKey: 'MATURITY', selection: ['ALL'] },
            },
            deals: {
                'tradeDropdown': { dataKey: 'TRADE_ID', selection: ['ALL'] },
                // 'dealsIssuerDropdown': { dataKey: 'ISSUER', selection: ['ALL'] },
                // 'dealsProdIdDropdown': { dataKey: 'PROD_ID', selection: ['ALL'] },
                // 'dealsCategoryDropdown': { dataKey: 'CATEGORY', selection: ['ALL'] },
                // 'dealsMaturityDropdown': { dataKey: 'MATURITY', selection: ['ALL'] },
            },
            portTables: {
                'createdPortDropdown': { dataKey: 'table_name', selection: ['ALL'] },
                //'tradeDropdown': { dataKey: 'TRADE_ID', selection: ['ALL'] },
            },
            portPortTables: {
                // 'createdPortPortDropdown': { dataKey: 'table_name', selection: ['ALL'] },
                //'tradeDropdown': { dataKey: 'TRADE_ID', selection: ['ALL'] },
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
                    'createdPortDropdown': 'portTables', // Assuming 'tables_created' is another dataset you want to associate with this dropdown
                    // 'dealsIssuerDropdown': 'deals',
                }
            },
            'PORT_Tab': {
                default: 'port',
                // dropdowns: {
                //     'createdPortPortDropdown': 'portPortTables', 
                // }
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
                dataHandler: handlePortMainFilteredData,
            },
            portTables: {
                dropdownConfig: this.dropdownConfig.portTables,
                filtersConfig: this.filtersConfig.portTables,
                dataHandler: this.handlePortTable.bind(this),
                // dataHandler: handlePortMainFilteredData,
                },
            
            portPortTables: {
                dropdownConfig: this.dropdownConfig.portPortTables,
                filtersConfig: this.filtersConfig.port,
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

    handlePortTable(data) {
        console.log("Handling port table data:", data);
        // Add more functionality here if needed
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
        //this.setReceivedData(data);
        this.notifyObservers();
    }

    // Method to update received data
    setReceivedData(data) {
        this.currentReceivedData = data;
        this.notifyObservers();
    }

    setIssuerData(data) {      
        this.issuerData = data;
        this.notifyObservers(); 
    }
    setProdData(data) {
        this.prodData = data;
        this.notifyObservers(); 
    }

    setDealsData(data) {
        this.dealsData = data;
        this.notifyObservers(); 
    }
    getDealsData() {
        return this.dealsData; 
    }
    
    setPortData(data) {
        this.portData = data;
        this.notifyObservers(); 
    }
    setSelectedDealsTableName(tableName) {
        this.currentDealsDataTable = tableName;
        // Optionally, you might want to notify observers about this change
        this.notifyObservers();
    }
    getSelectedDealsTableName() {
        return this.currentDealsDataTable;
    }
    setSelectedPortTableName(tableName) {
        this.currentPortDataTable = tableName;
        // Optionally, you might want to notify observers about this change
        this.notifyObservers();
    }
    getSelectedPortTableName() {
        return this.currentPortDataTable;
    }
    setSelectedPortPortTableName(tableName) {
        this.currentPortPortDataTable = tableName;
        // Optionally, you might want to notify observers about this change
        this.notifyObservers();
    }
    getSelectedPortPortTableName() {
        return this.currentPortPortDataTable;
    }

    setCreatedPortData(receivedData) {
        if (!Array.isArray(receivedData)) {
            console.error("setCreatedPortData received non-array data:", receivedData);
            return;
        }
        
        // Reset or initialize availableTablesData and availableTablesArray if necessary
        this.availablePortTablesData = {}; // Object map for direct access by name
        this.availablePortTablesArray = []; // Array for iteration
        
        // Populate both the object map and array with table data
        receivedData.forEach(table => {
            this.availablePortTablesData[table.table_name] = table;
            this.availablePortTablesArray.push(table);
        });
        console.log('this.availablePortTablesArray', this.availablePortTablesArray)
        this.notifyObservers();
    }
    getCreatedPortData() {
        return this.availablePortTablesArray;
    }
    setCreatedPortPortData(receivedData) {
        if (!Array.isArray(receivedData)) {
            console.error("setCreatedPortPortData received non-array data:", receivedData);
            return;
        }
        
        // Reset or initialize availableDealsTablesData and availableDealsTablesArray if necessary
        this.availablePortPortTablesData = {}; // Object map for direct access by name
        this.availablePortPortTablesArray = []; // Array for iteration
        
        // Populate both the object map and array with table data
        receivedData.forEach(table => {
            this.availablePortPortTablesData[table.table_name] = table;
            this.availablePortPortTablesArray.push(table); 
        });
        console.log('this.availablePortPortTablesArray', this.availablePortPortTablesArray)
        this.notifyObservers();
    }
    getCreatedPortPortData() {
        return this.availablePortPortTablesArray;
    }
    
    updateDealsDataTable(receivedData) {
        console.log('updateDealsDataTable(receivedData)', receivedData);
        
        this.setDealsData(receivedData);
        this.updateDropdowns('deals');
    }
    updatePortDataTable(receivedData) {
        console.log('updatePortDataTable(receivedData)', receivedData);

        this.setPortData(receivedData);
        this.applyFiltersAndUpdateDropdowns('port');
    }
    updatePortPortDataTable(receivedData) {
        //Tabelle aller Portfolios sprich PortMain, PortABC gibt es nicht!
       this.setDealsData(receivedData);
        this.applyFiltersAndUpdateDropdowns('port');
    }
   
    setSelectedTradeIDs(ids) {
        this.selectedTradeIDs = ids;
        this.notifyObservers();
    }

    // General method for updating filtered data based on table type
    setFilteredDataForTable(tableType, data) {
        this.filteredData[tableType] = data;
        this.notifyObservers(); // Notify observers about the update
    }
    getFilteredData(tableType) {
        return this.filteredData[tableType];
    }
    // Method to add an observer
    addObserver(observerFunction) {
        this.observers.push(observerFunction);
    }

    // Method to notify all observers of state changes
    notifyObservers() {
        this.observers.forEach(observer => observer());
    }
// MY METHODES:

    sortRatings(a, b) {
        return this.ratingOrder.indexOf(a) - this.ratingOrder.indexOf(b);
    }
    // Add dropdown option utility
    addDropdownOption(dropdown, value, text) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = text;
        dropdown.appendChild(option);
    }

// START APP
    updateUIBasedOnAppState() {
        console.log("Current active table:", this.currentActiveTable);
        const tableType = this.currentActiveTable;
        const tableConfig = this.tableConfigs[tableType];

        if (tableConfig && tableConfig.dataHandler) {
            // Assuming you might store either the filtered data for each table
            // or just use the current overall data
            const currentData = this.filteredData[tableType] || this.currentReceivedData;

            // Call the data handler with the current data set for the active table
            tableConfig.dataHandler(currentData, this.filtersConfig[tableType]);
        } else {
            console.error("No data handler or table configuration found for the active table:", tableType);
        }
    }


    getCurrentSelectionsForTableType(tableType) {
        const selections = {};
        const config = this.tableConfigs[tableType];
        if (!config) return selections; // Early exit if no config found

        Object.keys(config.dropdownConfig).forEach(dropdownId => {
            const dropdown = document.getElementById(dropdownId);
            if (dropdown) {
                selections[dropdownId] = [...dropdown.selectedOptions].map(option => option.value);
            }
        });
        return selections;
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
        } else {
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
    repopulateDropdownsForTableType(tableType, filteredData) {
        // Implementation similar to the latter part of your original function
        // Adjusted for clarity and brevity
        const config = this.tableConfigs[tableType];
        Object.keys(config.dropdownConfig).forEach(dropdownId => {
            this.populateDropdown(dropdownId, filteredData, `ALL ${config.dropdownConfig[dropdownId].dataKey.toUpperCase()}`, tableType);
        });
    }

    initDropdownListeners() {
        const dropdowns = this.getAllDropdownElements();
        // console.log('alldropdowns', dropdowns)
        dropdowns.forEach(dropdown => {
            // Check if the listener has already been attached
            if (!dropdown.hasAttribute('data-listener-attached')) {
                dropdown.addEventListener('change', (event) => {
                    if (!this.isControlKeyPressed) {
                        // Handle normal dropdown changes
                        console.log('Normal Selection EventListener:', event);
                        this.handleDropdownChange(event);
                    } else {
                        // Accumulate selections for Control key handling
                        console.log('Control Key Selection EventListener:', event);
                        this.accumulateControlKeySelections(event.target.id, [...event.target.selectedOptions].map(opt => opt.value));
                    }
                });
                // Mark this dropdown as having an event listener attached
                dropdown.setAttribute('data-listener-attached', 'true');
            }
        });
    }
    accumulateControlKeySelections(dropdownId, selections) {
        // Implement logic to store or update temporary selections for the dropdownId
        this.tempSelections[dropdownId] = selections;
    }
    applyAccumulatedSelections() {
        Object.entries(this.tempSelections).forEach(([dropdownId, selections]) => {
            // Find the dropdown by ID and update its selections programmatically
            const dropdown = document.getElementById(dropdownId);
            if (dropdown) {
                [...dropdown.options].forEach(option => {
                    option.selected = selections.includes(option.value);
                });
                // Clear temporary selections for this dropdown
                delete this.tempSelections[dropdownId];
                // Trigger the dropdown change logic programmatically to apply filters and update UI
                this.handleDropdownChange({ target: dropdown });
            }
        });
    }
    
    toggleDropdownSelection(dropdownId, optionValue) {
        if (this.dropdownSelections[dropdownId].has(optionValue)) {
            this.dropdownSelections[dropdownId].delete(optionValue);
        } else {
            this.dropdownSelections[dropdownId].add(optionValue);
        }
        this.notifyObservers();
    }
    updateDropdownUI(dropdownId) {
        const dropdown = document.getElementById(dropdownId);
        if (!dropdown) return;

        Array.from(dropdown.options).forEach(option => {
            option.selected = this.dropdownSelections[dropdownId].has(option.value);
        });
    }

    getAllDropdownElements() {
        // Implement a method to retrieve all dropdown elements, e.g., by class name
        return document.querySelectorAll('.select-dropdown');
    }

    // Handler:
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
    
        console.log('Selected options:', selectedOptions);
        this.updateDropdownSelection(tableType, dropdownId, selectedOptions);
    
        // Apply filters and update UI only if Control key is not pressed, or if the selection is "ALL"
        if (!this.isControlKeyPressed || event.target.value === "ALL") {
            this.applyFiltersAndUpdateUI(tableType);
        }
    }
    
    
//PORT dropdown
    handlePortDropdownChange(event) {
        const selectedTable = event.target.value;
        console.log("Selected table:", selectedTable);
    
        // Assuming 'this' refers to an instance of AppState
        // Access the current active table type based on the application state or other logic
        const currentTableType = this.currentActiveTable; // Example: 'deals'
    
        // Retrieve the specific configuration for the current table type
        const tableConfig = this.tableConfigs[currentTableType];
        if (tableConfig) {
            // Now, you have access to the configurations for the current table type
            // Example usage:
            console.log('Dropdown Config:', tableConfig.dropdownConfig);
            console.log('Filters Config:', tableConfig.filtersConfig);
    
            // If you need to call the dataHandler with specific parameters
            if (typeof tableConfig.dataHandler === 'function') {
                // Example: Call dataHandler with additional parameters if necessary
                // This example assumes you have a way to obtain 'filteredData' and 'filtersConfig' relevant to the current context
                const filteredData = this.filteredData[tableType] 
                console.log('filteredData:', filteredData);
                console.log('filteredData.tableTyp:', filteredData.tableType);
                const filtersConfig = tableConfig.filtersConfig;
                // Now calling the dataHandler function with your parameters
                tableConfig.dataHandler(filteredData, filtersConfig);
            }
        } else {
            console.error("Configuration not found for the current table type:", currentTableType);
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

            // 'dealsIssuerDropdown': 'deals',

            'portIssuerDropdown': 'port',
            'portProdIdDropdown': 'port',
            'portCouponTypeDropdown': 'port',
            'portCategoryDropdown': 'port',
            'portRatingDropdown': 'port',
            'portMaturityDropdown': 'port',
            'tradeDropdown': 'deals' ,
            // 'createdPortPortDropdown': 'port',
            
            // Assuming this is correct for your 'deals' table
            // Add other dropdowns here if needed
        };
        return mapping[dropdownId] || null; // Fallback to null if no match is found
    }
    updateDropdownSelection(tableType, dropdownId, selectedOptions) {
        // Update the selection for the specific dropdown in state
        if (this.dropdownConfig[tableType] && this.dropdownConfig[tableType][dropdownId]) {
            this.dropdownConfig[tableType][dropdownId].selection = selectedOptions;
            // Further actions like filtering data based on new selections
        }
    }

    applyFiltersAndUpdateUI(tableType) {
        // This method applies filters based on current selections and updates the UI
        this.applyFiltersAndUpdateDropdowns(tableType);
    
        // Assuming a method exists to update the UI with filtered data
        // this.updateUIWithFilteredData(tableType);
    }

    applyFiltersAndUpdateDropdowns(tableType) {
        console.log('tableType', tableType);
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
            case 'portTables':
                receivedData = this.availablePortTablesArray;
                break;
            case 'portPortTables':
                receivedData = this.availablePortPortTablesArray;
                break;        
            // Handle other cases...
            default:
                console.error("Unknown tableType:", tableType);
                return; // Early exit if tableType is not recognized
        }
    
        if (!Array.isArray(receivedData)) {
            console.log('tableType', tableType );
            console.log('receivedData', receivedData );
            console.error("Received data is not an array:", receivedData);
            
            return;
        }
        
// Debugging: Log current selections
const dropdownConfig = this.dropdownConfig[tableType];
console.log("Dropdown Config:", dropdownConfig);
console.log("receivedData:", receivedData);

// Ensure the filter applies correctly by matching the data structure
let filteredData;
if (tableType === 'portTables') {
    // Bypass filtering for portTables
    filteredData = receivedData;
} else {
    filteredData = receivedData.filter(item => {
        return Object.entries(dropdownConfig).every(([dropdownId, {selection}]) => {
            const dataKey = dropdownConfig[dropdownId].dataKey;
            if (selection.includes('ALL')) return true;
            // console.log(`Filtering for ${dropdownId} (${dataKey}): Item value=${item[dataKey]}, Selection=`, selection);
            return selection.includes(item[dataKey]);
        });
    });
}

console.log('Filtered Data:', filteredData, tableType);
this.setFilteredDataForTable(tableType, filteredData);

    
        // Repopulate dropdowns and update UI as necessary
        this.repopulateDropdownsForTableType(tableType, filteredData);
        this.updateUIWithFilteredData(tableType);
    }
    
    updateDropdowns(tableType) {
        console.log('tableType', tableType);
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
            case 'portTables':
                receivedData = this.availablePortTablesArray;
                break;
            case 'portPortTables':
                receivedData = this.availablePortPortTablesArray;
                break;        
            // Handle other cases...
            default:
                console.error("Unknown tableType:", tableType);
                return; // Early exit if tableType is not recognized
        }
    
        if (!Array.isArray(receivedData)) {
            console.log('tableType', tableType );
            console.log('receivedData', receivedData );
            console.error("Received data is not an array:", receivedData);
            
            return;
        }
        
        // Debugging: Log current selections
        const dropdownConfig = this.dropdownConfig[tableType];
        console.log("Dropdown Config:", dropdownConfig);
        console.log("receivedData:", receivedData);

        // Ensure the filter applies correctly by matching the data structure
        let filteredData;

            filteredData = receivedData;


        console.log('Filtered Data:', filteredData, tableType);
        this.setFilteredDataForTable(tableType, filteredData);

    
        // Repopulate dropdowns and update UI as necessary
        this.repopulateDropdownsForTableType(tableType, filteredData);
        this.updateUIWithFilteredData(tableType);
    } 
    
    applyFiltersBasedOnSelections(tableType) {
        // Implementation for filtering data based on the current selections
        return this.applyFiltersAndUpdateDropdowns(tableType);
    }

    updateUIWithFilteredData(tableType) {

        const filteredData = this.filteredData[tableType];
        console.log("tableType:", tableType);
        console.log("filteredData:", filteredData);
        const config = this.tableConfigs[tableType];
        if (config && typeof config.dataHandler === 'function') {
            // Pass both filteredData and filtersConfig to the data handler
            config.dataHandler(filteredData, config.filtersConfig);
            console.log("dataHandler:", filteredData, config.filtersConfig);
        } else {
            console.error("No data handler found for tableType:", tableType);
        }
    }
    updateTableBasedOnFilters(tableType) {
        // Use the filtered data to update the corresponding table
        // This could involve calling a method like `handleTableData` for the specific tableType
        if(this.tableConfigs[tableType] && this.tableConfigs[tableType].dataHandler) {
            // const filteredData = this.applyFiltersAndUpdateDropdowns(receivedData, tableType);
            console.log('tableType:', tableType);
            this.tableConfigs[tableType].dataHandler(filteredData);
        }
    }


    updateStateWithNewRow(tableName, newRowData) {
        // Update the appropriate part of the state with the new row data
        this.state[tableName].push(newRowData);
        this.notifyObservers();
    }
      
    updateStateWithChanges(tableName, newData, rowIndex) {
    // Find the item by rowIndex or uniqueIdentifier and update it
    Object.assign(this.state[tableName][rowIndex], newData);
    this.notifyObservers();
    }
      
    updateStateAfterErasure(tableName, uniqueIdentifier) {
    // Remove the item from the state
    const index = this.state[tableName].findIndex(item => item.id === uniqueIdentifier.id); // Assuming 'id' is a unique identifier
    if (index > -1) {
        this.state[tableName].splice(index, 1);
        this.notifyObservers();
    }
    }

    resetFiltersForActiveTable(receivedData, currentActiveTable) {
        // Assuming you have access to the activeConfig and dropdownConfig
        console.log('currentActiveTable:', currentActiveTable)
        const activeConfig = this.tableConfigs[currentActiveTable];
        const dropdownConfig = activeConfig.dropdownConfig;
    
        // Reset all selections in the dropdowns for the active table
        Object.keys(dropdownConfig).forEach(dropdownId => {
            dropdownConfig[dropdownId].selection = ['ALL']; // Assuming 'ALL' is the value for selecting all options
        });
    
        // Now that the selections are reset, you may want to reapply the filters
        // Based on your existing logic, you might need to call functions like 'applyFiltersAndUpdateDropdowns' here
        this.applyFiltersAndUpdateDropdowns(currentActiveTable);
    
        // Optionally, you can also update the UI or perform any other necessary actions after resetting the filters
        console.log('Filters reset for table:', currentActiveTable);
    };

}