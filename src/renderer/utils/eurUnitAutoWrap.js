// Globaler Auto-Wrap fuer das Waehrungswort "EUR": setzt es in KPI-Wert-/Sub-Elementen
// (.conc-kpi__val / .conc-kpi__sub) klein (span.cur-unit) — vollautomatisch fuer JEDES Panel,
// ohne panel-spezifischen Code. Ein MutationObserver reagiert auf DOM-Aenderungen; das Wrappen
// selbst laeuft mit disconnect (kein Loop) und ist idempotent (bereits gewickeltes "EUR" wird
// uebersprungen). Mirror-Tabellen (.conc-report-table, textContent/PDF) und die Home-Overview
// (.home-kpi, eigener Nachlauf) bleiben unberuehrt, da anderer Selektor.

const SELECTOR = '.conc-kpi__val, .conc-kpi__sub';
const OBS_OPTS = { subtree: true, childList: true, characterData: true };

let _observer = null;
let _scheduled = false;

// "EUR" (als eigenstaendiges Wort) in einem Element in <span class="cur-unit"> wickeln.
function wrapEl(el) {
  if (!el || typeof document.createTreeWalker !== 'function') return;
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const v = node.nodeValue;
      if (!v || v.indexOf('EUR') === -1) return NodeFilter.FILTER_REJECT;
      let p = node.parentNode;
      while (p && p !== el) {
        if (p.classList && p.classList.contains('cur-unit')) return NodeFilter.FILTER_REJECT;
        p = p.parentNode;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const nodes = [];
  let n;
  while ((n = walker.nextNode())) nodes.push(n);
  nodes.forEach((textNode) => {
    const parts = textNode.nodeValue.split(/(\bEUR\b)/g);
    if (parts.length < 2) return;
    const frag = document.createDocumentFragment();
    parts.forEach((part) => {
      if (part === 'EUR') {
        const span = document.createElement('span');
        span.className = 'cur-unit';
        span.textContent = 'EUR';
        frag.appendChild(span);
      } else if (part) {
        frag.appendChild(document.createTextNode(part));
      }
    });
    textNode.parentNode.replaceChild(frag, textNode);
  });
}

function processAll() {
  document.querySelectorAll(SELECTOR).forEach(wrapEl);
}

function schedule() {
  if (_scheduled) return;
  _scheduled = true;
  requestAnimationFrame(() => {
    _scheduled = false;
    if (!_observer) return;
    _observer.disconnect();                 // eigene Mutationen nicht beobachten -> kein Loop
    try { processAll(); } finally { _observer.observe(document.body, OBS_OPTS); }
  });
}

export function initEurUnitAutoWrap() {
  if (_observer || !document.body) return;
  processAll();
  _observer = new MutationObserver(() => schedule());
  _observer.observe(document.body, OBS_OPTS);
}
