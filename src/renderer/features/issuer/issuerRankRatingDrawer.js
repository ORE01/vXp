// electron_app/src/renderer/features/issuer/issuerRankRatingDrawer.js

'use strict';

const DRAWER_ID = 'issuerRankRatingDrawer';

const RANK_ORDER = [
  'senior_secured',
  'senior_preferred',
  'senior_unsecured',
  'senior_subordinated',
  'junior_subordinated',
];

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatRank(rank) {
  return String(rank ?? '')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

function ensureDrawer() {
  let drawer = document.getElementById(DRAWER_ID);
  if (drawer) return drawer;

  drawer = document.createElement('aside');
  drawer.id = DRAWER_ID;
  drawer.className = 'issuer-rating-drawer';

  document.body.appendChild(drawer);
  return drawer;
}

function closeDrawer() {
  const drawer = document.getElementById(DRAWER_ID);
  if (!drawer) return;

  drawer.classList.remove('is-open');
}

function openDrawer({ issuer, ticker, country, baseRating, ratings }) {
  const drawer = ensureDrawer();

  const sortedRatings = [...ratings].sort((a, b) => {
    const ai = RANK_ORDER.indexOf(String(a.RANK ?? ''));
    const bi = RANK_ORDER.indexOf(String(b.RANK ?? ''));

    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });

  const rowsHtml = sortedRatings.map((r) => {
    const source = String(r.SOURCE ?? '').toLowerCase();
    const badgeClass = source === 'explicit'
      ? 'rank-drawer-badge rank-drawer-badge--explicit'
      : 'rank-drawer-badge';

    return `
      <tr>
        <td>${escapeHtml(formatRank(r.RANK))}</td>
        <td class="rank-drawer-rating">${escapeHtml(r.RATING)}</td>
        <td>
          <span class="${badgeClass}">${escapeHtml(r.SOURCE)}</span>
        </td>
      </tr>
    `;
  }).join('');

  drawer.innerHTML = `
    <div class="rank-drawer-header">
      <div>
        <div class="rank-drawer-eyebrow">Issuer Ratings</div>
        <h2 class="rank-drawer-title">
          ${escapeHtml(issuer || ticker)}
        </h2>
        <div class="rank-drawer-subtitle">
          ${escapeHtml(ticker)}${country ? ` · ${escapeHtml(country)}` : ''}
        </div>
      </div>

      <button id="issuerRatingDrawerClose" class="rank-drawer-close">×</button>
    </div>

    <div class="rank-drawer-base-card">
      <div class="rank-drawer-base-label">Base Rating</div>
      <div class="rank-drawer-base-value">
        ${escapeHtml(baseRating || '-')}
      </div>
    </div>

    <table class="rank-drawer-table">
      <thead>
        <tr>
          <th>Rank</th>
          <th>Rating</th>
          <th>Source</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml || `
          <tr>
            <td colspan="3" class="rank-drawer-empty">
              No rank ratings found.
            </td>
          </tr>
        `}
      </tbody>
    </table>
  `;

  drawer
    .querySelector('#issuerRatingDrawerClose')
    ?.addEventListener('click', closeDrawer);

  drawer.classList.add('is-open');
}

export function attachIssuerRankRatingDrawer({
  container,
  issuerRows = [],
  ratingsRows = [],
} = {}) {
  if (!container) return;

  const table = container.querySelector('table');
  if (!table) return;

  const headerRow = table.querySelector('thead tr');
  const bodyRows = Array.from(table.querySelectorAll('tbody tr'));

  if (!headerRow || !bodyRows.length) return;

  // Avoid duplicate Details column on re-render.
  if (!headerRow.querySelector('[data-issuer-details-col="1"]')) {
    const th = document.createElement('th');
    th.className = 'table-header';
    th.textContent = 'Details';
    th.title = 'Details';
    th.dataset.issuerDetailsCol = '1';

    const editHeader = Array.from(headerRow.children)
      .find(cell => String(cell.textContent ?? '').trim().toLowerCase() === 'edit');

    if (editHeader) headerRow.insertBefore(th, editHeader);
    else headerRow.appendChild(th);
  }

  bodyRows.forEach((tr, rowIndex) => {
    if (tr.querySelector('[data-issuer-rating-details="1"]')) return;

    const issuerRow = issuerRows[rowIndex] || {};
    const ticker = String(issuerRow.TICKER ?? '').trim();

    const td = document.createElement('td');
    td.dataset.issuerRatingDetails = '1';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Ratings';
    btn.className = 'rank-drawer-trigger';

    btn.addEventListener('click', (event) => {
      event.stopPropagation();

      const ratings = ratingsRows.filter(r =>
        String(r.TICKER ?? '').trim().toUpperCase() === ticker.toUpperCase()
      );

      openDrawer({
        issuer: issuerRow.ISSUER,
        ticker,
        country: issuerRow.Country,
        baseRating: issuerRow.BASE_RATING,
        ratings,
      });
    });

    td.appendChild(btn);

    const editCell = Array.from(tr.children).find(cell =>
      cell.querySelector?.('.edit-button')
    );

    if (editCell) tr.insertBefore(td, editCell);
    else tr.appendChild(td);
  });
}