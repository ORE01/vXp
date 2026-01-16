// FRONT_END/DATA_PROVIDER/issuerModalUI.js

export function initIssuerModalUI() {
  if (window.__issuerModalUIInstalled) return;
  window.__issuerModalUIInstalled = true;

  const $$  = (sel, root = document) => Array.from((root && root.querySelectorAll(sel)) || []);
  const $id = (id) => document.getElementById(id);

  function bindUI() {
    // --- Delegation: Panel öffnen ---
    document.addEventListener('click', (ev) => {
      const trigger = ev.target.closest('.section-trigger');
      if (!trigger) return;

      const id = trigger?.dataset?.panel; // z.B. "panel-issuer"

      // alle Panels zu
      $$('.sub-panel').forEach((p) => { if (p) p.hidden = true; });

      // dieses Panel auf
      const panel = $id(id);
      if (panel) panel.hidden = false;

      // aria-States
      $$('.section-trigger').forEach((b) => b.setAttribute('aria-expanded', 'false'));
      trigger.setAttribute('aria-expanded', 'true');
    }, true);

    // --- Delegation: Panel schließen ---
    document.addEventListener('click', (ev) => {
      const closeBtn = ev.target.closest('.sub-panel-close');
      if (!closeBtn) return;

      const id = closeBtn?.dataset?.close; // z.B. "panel-issuer"
      const panel = $id(id);
      if (panel) panel.hidden = true;

      const trigger = document.querySelector(`.section-trigger[data-panel="${id}"]`);
      if (trigger) trigger.setAttribute('aria-expanded', 'false');
    }, true);

    // --- Delegation: Issuer Fetch ---
    document.addEventListener('click', async (ev) => {
      const fetchBtn = ev.target.closest('#issuerFetchButton');
      if (!fetchBtn) return;

      const input = $id('isinInputIssuer');
      const out   = $id('issuerOut');
      const table = $id('issuerTable');

      const isins = String(input?.value || '')
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean);

      if (!isins.length) {
        if (out) out.textContent = 'Bitte mindestens eine ISIN eingeben.';
        if (table) table.innerHTML = '';
        return;
      }

      if (out) out.textContent = '⏳ fetching…';
      if (table) table.innerHTML = '';

      try {
        const res = await (window.api?.fetchBondsTermsOnly
          ? window.api.fetchBondsTermsOnly(isins)
          : Promise.resolve([]));

        if (out) out.textContent = JSON.stringify(res, null, 2);

        const list = Array.isArray(res) ? res : [];
        const items = list.map(r => ({
          isin: r.isin,
          coupon: r?.terms?.coupon,
          issueDate: r?.terms?.issueDate,
          maturity: r?.terms?.maturity,
          frequency: r?.terms?.frequency,
          pdfUrl: r?.terms?.pdfUrl || ''
        }));

        if (!items.length) {
          if (table) table.innerHTML = '<p>Keine Terms gefunden.</p>';
          return;
        }

        if (table) table.innerHTML = renderIssuerTermsTable(items);
      } catch (err) {
        if (out) out.textContent = '❌ ' + (err?.message || String(err));
        console.error(err);
      }
    }, true);
  }

  // robust init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindUI, { once: true });
  } else {
    bindUI();
  }
}

function renderIssuerTermsTable(items) {
  const pct = v => (typeof v === 'number' ? (v * 100).toFixed(3) + ' %' : (v ?? '–'));
  const s = v => (v ?? '–');

  const thead = `
    <thead><tr>
      <th>ISIN</th><th>Coupon</th><th>Issue</th>
      <th>Maturity</th><th>Freq</th><th>PDF</th>
    </tr></thead>`;

  const tbody = items.map(i => `
    <tr>
      <td>${s(i.isin)}</td>
      <td>${pct(i.coupon)}</td>
      <td>${s(i.issueDate)}</td>
      <td>${s(i.maturity)}</td>
      <td>${s(i.frequency)}</td>
      <td>${i.pdfUrl ? `<a href="${i.pdfUrl}" target="_blank" rel="noopener">open</a>` : '–'}</td>
    </tr>`
  ).join('');

  return `<table>${thead}<tbody>${tbody}</tbody></table>`;
}
