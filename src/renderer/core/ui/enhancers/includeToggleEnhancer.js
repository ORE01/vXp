// src/renderer/core/ui/enhancers/includeToggleEnhancer.js

const DEALS_TABLE_DEFAULT = 'DealsMain';

// IPC-Helper: setzt INCLUDE per eindeutigem Key in DealsMain
export function updateDealsIncludeByKey(
  keyName,
  keyValue,
  includeVal,
  dealsTable = DEALS_TABLE_DEFAULT
) {
  return new Promise((resolve, reject) => {
    const payload = {
      cleanTableName: dealsTable,
      rowIndex: 0,
      newData: { INCLUDE: includeVal },
      uniqueIdentifier: { column: keyName, value: keyValue },
    };

    const ok = () => resolve(true);
    const err = (msg) => reject(new Error(msg));

    if (window.api?.once) {
      window.api.once('update-data-success', ok);
      window.api.once('update-data-error', err);
    } else {
      // Fallback: kann Listener stapeln, aber bleibt kompatibel
      window.api.receive('update-data-success', ok);
      window.api.receive('update-data-error', err);
    }

    window.api.send('update-data', payload);
  });
}

/**
 * Central enhancer: turns INCLUDE cells into checkboxes and persists via IPC.
 *
 * container can be:
 *  - CSS selector string
 *  - Element
 *  - Array<Element|string>
 *
 * If container is omitted, we try:
 *  1) opts.containers
 *  2) elements with [data-enhance-include="1"]
 *  3) (compat) '#offersDataContainer' with a warning
 */
export function enhanceIncludeCheckboxes(container, opts = {}) {
  const {
    includeColName = 'include',
    observe = true,
    maxScanPerTick = 200,
    dealsTable = DEALS_TABLE_DEFAULT,
    appState = window.appState,
  } = opts;

  const resolveRoots = () => {
    const fromArg = container;
    const fromOpts = opts.containers;

    const normalizeOne = (c) => {
      if (!c) return [];
      if (typeof c === 'string') return Array.from(document.querySelectorAll(c));
      if (c instanceof Element) return [c];
      return [];
    };

    // 1) explicit param
    if (fromArg) {
      if (Array.isArray(fromArg)) return fromArg.flatMap(normalizeOne);
      return normalizeOne(fromArg);
    }

    // 2) opts.containers
    if (fromOpts) {
      if (Array.isArray(fromOpts)) return fromOpts.flatMap(normalizeOne);
      return normalizeOne(fromOpts);
    }

    // 3) attribute-based auto-discovery
    const auto = Array.from(document.querySelectorAll('[data-enhance-include="1"]'));
    if (auto.length) return auto;

    // 4) compat fallback (keeps current behavior but signals it's not central)
    const compat = document.querySelector('#offersDataContainer');
    if (compat) {
      console.warn(
        '[enhanceIncludeCheckboxes] No container provided. Using compat fallback #offersDataContainer. ' +
          'Please pass container(s) explicitly or add data-enhance-include="1".'
      );
      return [compat];
    }

    return [];
  };

  const roots = resolveRoots();
  if (!roots.length) {
    console.warn('[enhanceIncludeCheckboxes] no valid container(s) found');
    return;
  }

  const norm = (v) =>
    String(v ?? '')
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, '_');

  // ---------- Helpers (robust, no :has)
  const getHeaderCells = (host) => {
    const tableLike = host.querySelector('table') || host;
    let cells = Array.from(tableLike.querySelectorAll('thead th, thead td'));
    let rowEl = null;

    if (cells.length) {
      rowEl = cells[0].parentElement || null;
    } else {
      // ✅ Robust fallback: find first row that contains TH
      const allRows = Array.from(tableLike.querySelectorAll('tr'));
      const thRow = allRows.find((r) => r.querySelector('th'));
      if (thRow) {
        cells = Array.from(thRow.children);
        rowEl = thRow;
      }
    }

    if (!cells.length) {
      const aria = Array.from(tableLike.querySelectorAll('[role="columnheader"]'));
      if (aria.length) {
        cells = aria;
        rowEl = aria[0]?.parentElement || null;
      }
    }

    return { cells, rowEl, tableLike };
  };

  const getColNameFromCell = (cell) =>
    norm(
      cell?.getAttribute?.('data-col') ||
        cell?.getAttribute?.('aria-colname') ||
        cell?.textContent ||
        ''
    );

  const findIndexByName = (cells, name) =>
    cells.findIndex((c) => getColNameFromCell(c) === norm(name));

  const getDataRows = (host) => {
    const { tableLike } = getHeaderCells(host);
    let rows = Array.from(tableLike.querySelectorAll('tbody tr'));

    if (!rows.length) {
      const allRows = Array.from(tableLike.querySelectorAll('tr'));
      const headerRow =
        tableLike.querySelector('thead tr') || allRows.find((r) => r.querySelector('th'));

      rows = allRows.filter((tr) => {
        if (tr === headerRow) return false;
        if (tr.closest('thead')) return false;
        if (Array.from(tr.children).some((c) => c.tagName === 'TH')) return false;
        if (/header/i.test(tr.className)) return false;
        return true;
      });
    }

    return rows;
  };

  const keyCandidates = ['TRADE_ID', 'PROD_ID', 'row_id', 'rowid', 'id', '_id', 'uid'];

  const resolveKeyIndex = (rows, headerCells) => {
    if (headerCells && headerCells.length) {
      for (const k of keyCandidates) {
        const i = findIndexByName(headerCells, k);
        if (i >= 0) return { keyIndex: i, keyName: k };
      }
    }

    const first = rows[0];
    if (first) {
      const cells = Array.from(first.children);
      for (let i = 0; i < cells.length; i++) {
        const name = (
          cells[i].getAttribute?.('data-col') ||
          cells[i].getAttribute?.('aria-colname') ||
          ''
        ).toUpperCase();
        if (keyCandidates.includes(name)) {
          return { keyIndex: i, keyName: name };
        }
      }
    }

    return { keyIndex: -1, keyName: 'PROD_ID' };
  };

  const resolveIncludeIndex = (rows, headerCells) => {
    if (headerCells && headerCells.length) {
      const i = findIndexByName(headerCells, includeColName);
      if (i >= 0) return i;
    }

    const first = rows[0];
    if (!first) return -1;

    const byAttr = first.querySelector(
      '[data-col="include"], [aria-colname="include"], .include-col'
    );
    if (byAttr) {
      const cells = Array.from(first.children);
      const idx = cells.indexOf(byAttr);
      if (idx >= 0) return idx;
    }

    const cb = first.querySelector('input[type="checkbox"][title="Toggle INCLUDE"]');
    if (cb) {
      const td = cb.closest('td,th,div');
      if (td) {
        const cells = Array.from(first.children);
        const idx = cells.indexOf(td);
        if (idx >= 0) return idx;
      }
    }

    return -1;
  };

  // ---------- One root at a time
  const enhanceOnRoot = (root) => {
    if (!root) return;

    // ✅ prevent multiple observers / mounts
    if (root.__includeEnhancerMO) {
      root.__includeEnhancerMO.disconnect();
      root.__includeEnhancerMO = null;
    }

    if (root.dataset.includeEnhancerMounted !== '1') {
      root.dataset.includeEnhancerMounted = '1';
      root.dataset.includeEnhancerVersion = 'v2';
    }

    const enhanceBatch = () => {
      const { cells: headerCells } = getHeaderCells(root);
      const rows = getDataRows(root);
      if (!rows.length) return false;

      const idxInclude = resolveIncludeIndex(rows, headerCells);
      if (idxInclude < 0) return false;

      const { keyIndex, keyName: keyNameResolved } = resolveKeyIndex(rows, headerCells);
      let keyName = keyNameResolved;

      let enhancedCount = 0;

      for (const tr of rows) {
        if (enhancedCount >= maxScanPerTick) break;

        const cells = Array.from(tr.children);

        const tdInclude =
          cells[idxInclude] ||
          tr.querySelector('[data-col="include"], [aria-colname="include"], .include-col');

        if (!tdInclude) continue;

        if (tdInclude.querySelector('input[type="checkbox"][title="Toggle INCLUDE"]')) continue;

        let keyVal =
          keyIndex >= 0 && cells[keyIndex] ? cells[keyIndex].textContent.trim() : null;

        if (!keyVal && tr.dataset) {
          for (const k of keyCandidates) {
            if (tr.dataset[k] != null) {
              keyVal = tr.dataset[k];
              keyName = k.toUpperCase();
              break;
            }
          }
        }

        if (!keyVal) {
          const guess = tr.querySelector('[data-col="PROD_ID"], [aria-colname="PROD_ID"]');
          if (guess) {
            keyVal = guess.textContent.trim();
            keyName = 'PROD_ID';
          }
        }
        if (!keyVal) continue;

        const rawTxt = String(tdInclude.textContent || '').trim();
        const attrVal = tdInclude.getAttribute?.('data-value');
        const current =
          rawTxt === '1' ||
          norm(rawTxt) === 'true' ||
          attrVal === '1' ||
          norm(attrVal) === 'true';

        tdInclude.setAttribute('data-col', 'include');
        tdInclude.setAttribute('aria-colname', 'include');
        tdInclude.classList.add('include-col', 'enhanced-include');

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = current;
        cb.title = 'Toggle INCLUDE';
        cb.style.transform = 'scale(1.05)';
        cb.style.cursor = 'pointer';

        tdInclude.textContent = '';
        tdInclude.appendChild(cb);

        cb.addEventListener(
          'change',
          async () => {
            const newVal = cb.checked ? 1 : 0;
            try {
              cb.disabled = true;
              await updateDealsIncludeByKey(keyName, keyVal, newVal, dealsTable);

              const AS = appState;
              if (AS?.getAllDealsData && AS?.setAllDealsData) {
                const allDeals = AS.getAllDealsData() || [];
                const idEq = (a, b) =>
                  String(a ?? '').trim() === String(b ?? '').trim();
                const row = allDeals.find((r) => idEq(r?.[keyName], keyVal));
                if (row) row.INCLUDE = newVal;
                AS.setAllDealsData(allDeals);
              }

              tdInclude.setAttribute('data-value', String(newVal));
              document.dispatchEvent(new Event('dealsData:ready'));
            } catch (err) {
              console.warn(
                '[enhanceIncludeCheckboxes] INCLUDE update failed, reverting',
                err
              );
              cb.checked = !cb.checked;
            } finally {
              cb.disabled = false;
            }
          },
          { passive: true }
        );

        enhancedCount++;
      }

      return enhancedCount > 0;
    };

    // initial pass
    enhanceBatch();

    if (observe) {
      const mo = new MutationObserver((mlist) => {
        const needs = mlist.some(
          (m) =>
            m.addedNodes &&
            Array.from(m.addedNodes).some(
              (n) =>
                n.nodeType === 1 &&
                (n.matches?.('tr, tbody, table') ||
                  n.querySelector?.(
                    'tr, tbody, table, [data-col="include"], [aria-colname="include"]'
                  ))
            )
        );
        if (needs) enhanceBatch();
      });

      mo.observe(root, { childList: true, subtree: true });
      root.__includeEnhancerMO = mo;
    }
  };

  roots.forEach(enhanceOnRoot);
}

/** explicit teardown (optional but clean) */
export function teardownIncludeCheckboxes(container) {
  const roots =
    typeof container === 'string'
      ? Array.from(document.querySelectorAll(container))
      : container instanceof Element
        ? [container]
        : Array.isArray(container)
          ? container.filter((x) => x instanceof Element)
          : [];

  roots.forEach((root) => {
    if (root?.__includeEnhancerMO) {
      root.__includeEnhancerMO.disconnect();
      root.__includeEnhancerMO = null;
    }
    if (root?.dataset) {
      delete root.dataset.includeEnhancerMounted;
      delete root.dataset.includeEnhancerVersion;
    }
  });
}

// ✅ Backward compatibility (old name still works)
export const enhanceDealsIncludeCheckboxes = enhanceIncludeCheckboxes;



