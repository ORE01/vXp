export class AppState {
    constructor() {
        
        // Panel-open hooks (for lazy rendering)
        this.__panelOpenHooks = Object.create(null);

        this.customerData = null;
      
        this.currentDealsDataTable = 'DealsMain'; 

        this.currentActiveTable = null;

        this.issuerData = null;
        this.prodData = null;
        this.filteredProdData = null,
        this.couponData = null;

        this.rankData = null;

        this.mlModel = null; 

        this.CSSzenarioData = 'default';
        this.CSActive = [];
        this.CSData = [];
        
       
        this.currentReceivedData = null;

        // Handlers werden im renderer/bootstrap injiziert
        this.handleIssuerData = null;
        this.handleProdData   = null;
        this.handleDealsData  = null;
        this.handleIRSensData = null;
        this.handleCSSensData = null;

                  
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
                'Depotbank': new Set(['ALL']),
            },
            port: {
                'ISSUER': new Set(['ALL']),
                'PROD_ID': new Set(['ALL']),
                'CouponType': new Set(['ALL']),
                'CATEGORY': new Set(['ALL']),
                'RATING': new Set(['ALL']),
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
                'Depotbank': new Set(['ALL']),
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
                'portRegionDropdown':  { dataKey: 'IssuerRegion', selection: ['ALL'] },
                'portCountryDropdown': { dataKey: 'IssuerCountry',      selection: ['ALL'] },
                
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
              dataHandler: (receivedData) => {
                if (typeof this.handleIssuerData !== 'function') return;
                this.handleIssuerData(receivedData, this);
                },

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
                    if (typeof this.handleProdData !== 'function') return;
                    this.handleProdData(effectiveFilters);

            },
            },


            deals: {
              dropdownConfig: this.dropdownConfig.deals,
              filtersConfig: this.filtersConfig.deals,
              dataHandler: (receivedData) => {
                const dealsTableName = this.currentDealsDataTable;
                //console.log(`Deals aufgerufen`);
                if (typeof this.handleDealsData !== 'function') return;
                    this.handleDealsData(receivedData, dealsTableName);

              },
            },
            offers: {
              dropdownConfig: this.dropdownConfig.offers,
              filtersConfig: this.filtersConfig.offers,
                dataHandler: (data) => {
                    const index = 4//this.getPortIndex?.() ?? 0; // Fallback auf 0, falls Methode nicht existiert
                    //console.log(`port aufgerufen mit data (port), Index: ${index}`, data);
                    this.handleOffersTable(data, index);
                }
                },
              port: {
                dropdownConfig: this.dropdownConfig.port,
                filtersConfig: this.filtersConfig.port,
                dataHandler: (data) => {
                    const index = this.getPortIndex?.() ?? 0; // Fallback auf 0, falls Methode nicht existiert
                    //console.log(`port aufgerufen mit data (port), Index: ${index}`, data);
                    this.handlePortTable(data, index);
                }
                },

            dealsTables: {
                dropdownConfig: this.dropdownConfig.dealsTables,
                filtersConfig: this.filtersConfig.dealsTables,
                
                dataHandler: (data) => this.handleDealsTable(data),
                }, 

            offersTables: {
                dropdownConfig: this.dropdownConfig.offersTables,     // â† stelle sicher, dass das existiert
                filtersConfig: this.filtersConfig.offersTables,       // â† in filtersConfig hinzugefÃ¼gt
                dataHandler: (data) => this.handleOffersTable(data),    // â† trennt OFFER(S)_ und setzt Liste
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
                // console.log('ðŸ“¥ handlePortTable1 aufgerufen mit data (port):', data);
                this.handlePortTable(data, 1);
              },
            },
            portTables2: {
              dropdownConfig: this.dropdownConfig.portTables2,
              filtersConfig: this.filtersConfig.portTables2,
              dataHandler: (data) => {
                // console.log('ðŸ“¥ handlePortTable2 aufgerufen mit data (port):', data);
                this.handlePortTable(data, 2);
              }
            },
        };
    }

    installHandlers({
        handleIssuerData,
        handleProdData,
        handleDealsData,
        handleIRSensData,
        handleCSSensData,
        } = {}) {
        if (handleIssuerData) this.handleIssuerData = handleIssuerData;
        if (handleProdData)   this.handleProdData   = handleProdData;
        if (handleDealsData)  this.handleDealsData  = handleDealsData;
        if (handleIRSensData) this.handleIRSensData = handleIRSensData;
        if (handleCSSensData) this.handleCSSensData = handleCSSensData;
        }

    registerPanelOpenHook(panelId, fn) {
    const id = String(panelId || '');
    if (!id || typeof fn !== 'function') return;
    (this.__panelOpenHooks[id] ||= []).push(fn);
    }

    emitPanelOpen(panelId) {
    const id = String(panelId || '');
    const hooks = this.__panelOpenHooks?.[id] || [];
    for (const fn of hooks) {
        try { fn(); } catch (e) { console.warn('[panelOpenHook] error', id, e); }
    }
    }




    handleDealsTable(data) {
        //console.log("Handling deals table data:", data);

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

    setPortfolioHistoryData(data) {
        this.PortfolioHistoryMetrics = data;
    }

    getPortfolioHistoryData() {
        return this.PortfolioHistoryMetrics;
    }

    setActiveTable(tableType) {
        this.currentActiveTable = tableType;
    }

    setReceivedData(data) {
        this.currentReceivedData = data;
    }

    setIssuerData(data) {      
        this.issuerData = data;
    }

    getIssuerData() {
    return this.issuerData;
}

    // COUNTRY LOOKUP
    setCountryLookup(data) {
    this.countryLookup = Array.isArray(data) ? data : [];
    }

    getCountryLookup() {
        return this.countryLookup;
    }

    setRankData(data) {      
        this.rankData = data;
    }

    getRankData() {
    return this.rankData;
    }

    setCouponData(data) {
        //console.log('Setting CouponData:', data);
        this.couponData = data;
    }

    getCouponData() {
        return Array.isArray(this.couponData) ? this.couponData : []; 
        }

    setFilteredProdData(data) {
        this.filteredProdData = data;
    }

    getFilteredProdData() {
        return this.filteredProdData;
    }

    setFilteredPortData(data) {
        //console.log('filteredPortData:', data)
        this.filteredPortData = data
        
        // this.notifyObservers();
    }

    getFilteredPortData() {
        //console.log('check daten appstate', this.filteredPortData)
            return this.filteredPortData;
            
    }

    // =====================
    // Compare Portfolio Names
    // =====================

    // Set compare portfolio names (slot-based)
    setComparePortNames(data) {
        // erwartet z.B. { 1: 'DDD', 2: 'CCC' }
        this.comparePortNames = data;
    }

    // Get compare portfolio names
    getComparePortNames() {
        return this.comparePortNames || {};
    }

    setCSData(data) {
        this.CSData = Array.isArray(data) ? data : [];
    }

    getCSData() {
        return Array.isArray(this.CSData) ? this.CSData : [];
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
        this.mlModel = model || null; 
    }

    // Retrieve the ML Model
    getMLTrainedModel() {
        return this.mlModel;
    }


    // Set the MLModelType and notify observers
    setMLModelType(modelType) {
        this.mlModelType = modelType;
        //console.log('MLModelType updated:', this.mlModelType);  
    }

    // Retrieve the MLModel
    getMLModelType() {
        return this.mlModelType;
    }

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
}


