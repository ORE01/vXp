// electron_app/src/renderer/features/products/issuerRankRatingDrawer.js

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

  drawer.style.cssText = `
    position: fixed;
    top: 0;
    right: 0;
    width: min(460px, 92vw);
    height: 100vh;
    background: #111827;
    color: #f9fafb;
    box-shadow: -12px 0 30px rgba(0,0,0,0.35);
    z-index: 9999;
    transform: translateX(105%);
    transition: transform 180ms ease-out;
    padding: 22px;
    overflow-y: auto;
    border-left: 1px solid rgba(255,255,255,0.12);
  `;

  document.body.appendChild(drawer);
  return drawer;
}

function closeDrawer() {
  const drawer = document.getElementById(DRAWER_ID);
  if (!drawer) return;

  drawer.style.transform = 'translateX(105%)';
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
    const badgeBg = source === 'explicit' ? '#065f46' : '#374151';

    return `
      <tr>
        <td style="padding: 10px 8px; border-bottom: 1px solid rgba(255,255,255,0.10);">
          ${escapeHtml(formatRank(r.RANK))}
        </td>
        <td style="padding: 10px 8px; border-bottom: 1px solid rgba(255,255,255,0.10); font-weight: 700;">
          ${escapeHtml(r.RATING)}
        </td>
        <td style="padding: 10px 8px; border-bottom: 1px solid rgba(255,255,255,0.10);">
          <span style="
            display:inline-block;
            padding: 3px 8px;
            border-radius: 999px;
            background: ${badgeBg};
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: .04em;
          ">
            ${escapeHtml(r.SOURCE)}
          </span>
        </td>
      </tr>
    `;
  }).join('');

  drawer.innerHTML = `
    <div style="display:flex; justify-content:space-between; gap:12px; align-items:flex-start;">
      <div>
        <div style="font-size:13px; color:#9ca3af; margin-bottom:4px;">Issuer Ratings</div>
        <h2 style="margin:0; font-size:22px; line-height:1.2;">
          ${escapeHtml(issuer || ticker)}
        </h2>
        <div style="margin-top:6px; color:#d1d5db; font-size:14px;">
          ${escapeHtml(ticker)}${country ? ` · ${escapeHtml(country)}` : ''}
        </div>
      </div>

      <button id="issuerRatingDrawerClose" style="
        border: 1px solid rgba(255,255,255,0.2);
        background: transparent;
        color: #f9fafb;
        border-radius: 8px;
        padding: 6px 10px;
        cursor: pointer;
        font-size: 18px;
        line-height: 1;
      ">×</button>
    </div>

    <div style="
      margin-top: 18px;
      padding: 14px;
      border-radius: 14px;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.10);
    ">
      <div style="font-size:13px; color:#9ca3af;">Base Rating</div>
      <div style="font-size:28px; font-weight:800; margin-top:2px;">
        ${escapeHtml(baseRating || '-')}
      </div>
    </div>

    <table style="width:100%; border-collapse:collapse; margin-top:20px; font-size:14px;">
      <thead>
        <tr style="color:#9ca3af; text-align:left;">
          <th style="padding:8px;">Rank</th>
          <th style="padding:8px;">Rating</th>
          <th style="padding:8px;">Source</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml || `
          <tr>
            <td colspan="3" style="padding:14px 8px; color:#fca5a5;">
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

  drawer.style.transform = 'translateX(0)';
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

    btn.style.cssText = `
      padding: 5px 9px;
      border-radius: 8px;
      border: 1px solid rgba(255,255,255,0.18);
      background: rgba(255,255,255,0.08);
      color: inherit;
      cursor: pointer;
      font-size: 12px;
    `;

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