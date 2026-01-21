import { openPanel } from '../UI/panels.js';

export function bootstrapTriggers(appState) {
  // Event Delegation: funktioniert auch bei dynamischem DOM
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('button.section-trigger');
    if (!btn) return;

    e.preventDefault();

    const panelId = btn.dataset.panel;
    if (!panelId) {
      console.warn('[TRIGGER] missing data-panel', btn);
      return;
    }

    // Panels öffnen (nutzt eure bestehende Logik)
    // Wichtig: openPanel muss akzeptieren: ('panel-breakdown') oder ('panel-breakdown', opts)
console.log('[TRIGGER] clicked', {
  panelId,
  breakdownGroup: btn.dataset.breakdownGroup || null,
  aria: btn.getAttribute('aria-controls'),
});




    openPanel(panelId);



console.log('[TRIGGER] openPanel called with:', panelId);


    // aria + chev UI
    const isOpen = btn.getAttribute('aria-expanded') === 'true';
    btn.setAttribute('aria-expanded', String(!isOpen));

    const chev = btn.querySelector('.chev');
    if (chev) chev.innerHTML = !isOpen ? '&#9660;' : '&#9654;';

    // Sub-trigger: Breakdown group setzen, wenn vorhanden
    const group = btn.dataset.breakdownGroup;
    if (group) {
      appState.activeBreakdownGroup = group; // minimaler State, später sauberer
      console.log('[TRIGGER] breakdown group:', group);
      // hier später: render breakdown view / filter
    }
  });

  console.log('[BOOT] bootstrapTriggers active');
}
