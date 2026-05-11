import {
  DEFAULT_VISIBLE_PORT_COLUMN_KEYS,
  SELECTABLE_PORT_COLUMN_KEYS,
} from '../../features/SELECT_PORTFOLIO/portTableColumns.js';

const TABLE_ID = 'portTable0';
const CUSTOM_LAYOUT_NAME = 'custom';

function sanitizeVisibleColumns(visibleColumns) {
  if (!Array.isArray(visibleColumns)) return null;

  return visibleColumns.filter((key) =>
    SELECTABLE_PORT_COLUMN_KEYS.includes(key)
  );
}

async function loadStoredTableLayout(appState) {
  try {
    const savedLayout = await window.api.tableLayouts.getOne(
      TABLE_ID,
      CUSTOM_LAYOUT_NAME
    );

    console.log('[TABLE LAYOUT STORE] raw saved custom layout from IPC:', savedLayout);

    const savedVisibleColumns = sanitizeVisibleColumns(savedLayout?.visibleColumns);

    console.log('[TABLE LAYOUT STORE] sanitized custom visible columns:', savedVisibleColumns);

    if (savedVisibleColumns) {
      appState.setVisibleColumns(TABLE_ID, savedVisibleColumns);
      console.log('[TABLE LAYOUT STORE] loaded custom layout', savedVisibleColumns);
    }
  } catch (error) {
    console.error('[TABLE LAYOUT STORE] Failed to load custom layout:', error);
  }
}

export function installTableLayoutStore({ appState }) {
  appState.ensureTableLayout(TABLE_ID, {
    visibleColumns: DEFAULT_VISIBLE_PORT_COLUMN_KEYS,
  });

  loadStoredTableLayout(appState);

  console.log('[TABLE LAYOUT STORE]', appState.tableLayouts);
}