// electron_app/src/renderer/features/products/structureTimeline/structureTimelineGrid.js

'use strict';

import {
  getProductStructureRows,
  normalizeRows,
  groupRowsByDate,
} from './complexTimelineData.js';

import {
  renderGroupedDateDrawer,
} from './complexTimelineDrawer.js';

import {
  renderCreateCouponScheduleEmptyState,
  renderCouponScheduleDrawer,
  renderFloatingCouponScheduleDrawer,
  renderNewCallDrawer,
  renderBulkCallDrawer,
} from './complexTimelineSchedules.js';

// ------------------------------------------------------------
// Refresh
// ------------------------------------------------------------

function scheduleStructureGridRefresh(container, prodId) {
  if (!container || !prodId) return;

  setTimeout(() => {
    renderStructureTimelineGrid(container, prodId);
  }, 500);

  setTimeout(() => {
    renderStructureTimelineGrid(container, prodId);
  }, 1200);

  setTimeout(() => {
    renderStructureTimelineGrid(container, prodId);
  }, 2200);
}

// ------------------------------------------------------------
// Main Grid
// ------------------------------------------------------------

export function renderStructureTimelineGrid(container, prodId) {
  if (!container) return;

  console.log('[STRUCTURE TIMELINE GRID]', { prodId });

  const rawRows = getProductStructureRows();

  console.log('[STRUCTURE TIMELINE RAW ROWS]', rawRows);

  const rows = normalizeRows(rawRows, prodId);

  console.log('[STRUCTURE TIMELINE FILTERED ROWS]', {
    prodId,
    count: rows.length,
    rows,
  });

  const hasRows = rows.length > 0;

  const dateGroups = hasRows
    ? groupRowsByDate(rows)
    : [];

  let selectedGroup = hasRows
    ? dateGroups[0]
    : null;

  container.innerHTML = `
    <div style="display:grid; grid-template-columns: minmax(0, 1fr) 360px; gap:16px; padding:16px;">
      <div style="min-width:0;">
        <h2>Structure Timeline · ${prodId}</h2>

        <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px; flex-wrap:wrap;">
          <strong>Dates:</strong> ${dateGroups.length}
          <span style="color:#777;">Events: ${rows.length}</span>

          <button id="addCouponScheduleRows" type="button">
            + Add Coupon Schedule
          </button>

          <button id="addFloatingCouponScheduleRows" type="button">
            + Add Floating Coupon Schedule
          </button>

          <button id="addCallStructureRow" type="button">
            + Add Call
          </button>

          <button id="addCallScheduleRows" type="button">
            + Add Call Schedule
          </button>
        </div>

        <div class="structure-timeline-table-scroll">
          <table class="structure-timeline-table">
            <thead>
              <tr style="border-bottom:1px solid #ccc;">
                <th style="text-align:left; padding:6px;">#</th>
                <th style="text-align:left; padding:6px;">Date</th>
                <th style="text-align:left; padding:6px;">Types</th>
                <th style="text-align:left; padding:6px;">Active</th>
                <th style="text-align:left; padding:6px;">Payload</th>
              </tr>
            </thead>

            <tbody>
              ${
                hasRows
                  ? dateGroups.map((group, idx) => `
                    <tr
                      data-index="${idx}"
                      style="cursor:pointer; border-bottom:1px solid #eee;"
                    >
                      <td style="padding:6px;">${idx + 1}</td>
                      <td style="padding:6px;">${group.eventDate || ''}</td>
                      <td style="padding:6px;">${group.typeSummary || ''}</td>
                      <td style="padding:6px;">${group.isActive ? '1' : 'mixed'}</td>
                      <td style="padding:6px;">${group.payloadSummary || ''}</td>
                    </tr>
                  `).join('')
                  : `
                    <tr>
                      <td colspan="5" style="padding:12px; opacity:0.75;">
                        No structure events yet. Use the buttons above to create the first structure event.
                      </td>
                    </tr>
                  `
              }
            </tbody>
          </table>
        </div>
      </div>

      <div
        id="structureDetailDrawer"
        style="border:1px solid #ddd; border-radius:8px; padding:14px; background:#fafafa;"
      ></div>
    </div>
  `;

  const drawer = container.querySelector('#structureDetailDrawer');

  // ------------------------------------------------------------
  // Toolbar actions
  // ------------------------------------------------------------

  container
    .querySelector('#addCouponScheduleRows')
    ?.addEventListener('click', () => {
      if (!drawer) return;

      if (!hasRows) {
        // Important:
        // For a brand-new product, this opens the initial schedule form
        // INSIDE THE RIGHT DRAWER, not as full replacement of the grid.
        renderCreateCouponScheduleEmptyState(drawer, prodId, {
          onRefresh: () => scheduleStructureGridRefresh(container, prodId),
        });

        return;
      }

      renderCouponScheduleDrawer(drawer, prodId, container, rows, {
        onRefresh: scheduleStructureGridRefresh,
      });
    });

  container
    .querySelector('#addFloatingCouponScheduleRows')
    ?.addEventListener('click', () => {
      if (!drawer) return;

      renderFloatingCouponScheduleDrawer(drawer, prodId, container, rows, {
        onRefresh: scheduleStructureGridRefresh,
      });
    });

  container
    .querySelector('#addCallStructureRow')
    ?.addEventListener('click', () => {
      if (!drawer) return;

      renderNewCallDrawer(drawer, prodId, container, {
        onRefresh: scheduleStructureGridRefresh,
      });
    });

  container
    .querySelector('#addCallScheduleRows')
    ?.addEventListener('click', () => {
      if (!drawer) return;

      renderBulkCallDrawer(drawer, prodId, container, rows, {
        onRefresh: scheduleStructureGridRefresh,
      });
    });

  // ------------------------------------------------------------
  // Initial right drawer
  // ------------------------------------------------------------

  if (hasRows && selectedGroup) {
    renderGroupedDateDrawer(drawer, selectedGroup, container, prodId, {
      onRefresh: scheduleStructureGridRefresh,
    });
  } else if (drawer) {
    renderCreateCouponScheduleEmptyState(drawer, prodId, {
      onRefresh: () => scheduleStructureGridRefresh(container, prodId),
    });
  }

  // ------------------------------------------------------------
  // Row click binding
  // ------------------------------------------------------------

  if (hasRows) {
    container.querySelectorAll('tbody tr[data-index]').forEach((tr) => {
      tr.addEventListener('click', () => {
        selectedGroup = dateGroups[Number(tr.dataset.index)];

        renderGroupedDateDrawer(drawer, selectedGroup, container, prodId, {
          onRefresh: scheduleStructureGridRefresh,
        });
      });
    });
  }
}