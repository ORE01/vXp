CRUD / Refresh Flow
1. Write Path
Renderer Drawer/Form
→ window.api.send('update-data', payload)
→ src/main/ipc/handlers/crud.handlers.js
→ productCanonicalService.saveCanonicalProduct(...)
→ refreshWithOptionalLock(refreshList)
→ event.reply('update-data-success', ...)
2. Product Save Entry Points
Model Setup Drawer:
src/renderer/features/products/structureTimeline/structureModelSetupDrawer.js

Product Setup Drawer:
src/renderer/features/products/structureTimeline/structureProductSetupDrawer.js

Simple Fixed Drawer:
src/renderer/features/products/structureTimeline/structureSimpleFixedDrawer.js

Simple FRN Drawer:
src/renderer/features/products/structureTimeline/structureSimpleFrnDrawer.js
3. Product Tables / Views
UI write target:
v_PRODUCTS_APP

Canonical save service:
src/main/services/productCanonical.service.js

Refreshed product read models:
PRODUCTS_MASTER
PRODUCTS_CONVENTIONS
PRODUCTS_FIXED_TERMS
PRODUCTS_FRN_TERMS
PRODUCTS_PRICING_CONFIG
PRODUCT_STRUCTURE
v_PRODUCTS_CANONICAL
v_PRODUCTS_APP
Portfolios
4. DataPump Contract
src/main/rendererDataPump.js

refreshTable('v_PRODUCTS_APP')
→ sends IPC channel:
v_PRODUCTS_APPData

refreshTable('PRODUCT_STRUCTURE')
→ sends IPC channel:
PRODUCT_STRUCTUREData
5. Renderer Receive Path
src/renderer/core/ipc/installReceivers.js

route('v_PRODUCTS_APPData')
→ routeTableData(...)
6. Router Contract
src/renderer/core/state/dataRouter.js

v_PRODUCTS_APPData
→ handlers.renderProductTableInit(rows)

v_PRODUCTS_CANONICALData
→ must NOT overwrite appState.prodData

PRODUCT_STRUCTUREData
→ appState.productStructureData
7. Product Handler Contract
src/renderer/features/DATA_PROVIDER/issuerProductHandlers.js

renderProductTableInit(receivedData)
→ normalizeProductRowForUi(...)
→ appState.setProdData(updatedData)
→ appState.applyFiltersAndUpdateDropdowns('prod')
→ dispatch products-app-data-refreshed
8. Store Contract
src/renderer/core/state/productsStore.js

setProdData(rows)
→ prodData
→ prodById
→ getProdData()
9. UI Read Path
Valuation Drawer:
src/renderer/features/products/structureTimeline/structureProductValuationDrawer.js

Reads:
appState.getProdData()

Header uses:
row.MODEL || row.pricing_model
10. Modal Refresh Contract
src/renderer/features/products/StructureTimelineModal.js

Owns active product modal/drawers.

On:
products-app-data-refreshed

Must:
- invalidate valuation drawer cache
- re-render valuation drawer if currently open
- optionally re-render model setup drawer if open