// src/renderer/core/ui/tables/attachHeaderColumnDnd.js
//
// Spalten per Drag & Drop direkt am Tabellen-Header umsortieren. Wird nach jedem
// Render aufgerufen (frische <th>-Elemente). Nur "movable" Spalten (nicht gepinnte/
// gelockte) sind ziehbar. Sortier-Klick und Filter-Funnel im Header bleiben
// unberuehrt: ein Drag aus einem interaktiven Control (Button/Input/Funnel) wird
// abgebrochen, normale Klicks feuern weiter.

'use strict';

export function attachHeaderColumnDnd({ tableContainer, movableKeys, onReorder }) {
  if (!tableContainer || typeof onReorder !== 'function') return;

  const order = Array.isArray(movableKeys) ? [...movableKeys] : [];
  const movable = new Set(order);
  if (!movable.size) return;

  const ths = tableContainer.querySelectorAll('th[data-column-key]');
  if (!ths.length) return;

  let dragKey = null;

  const clearTargets = () => tableContainer
    .querySelectorAll('th.col-drop-target')
    .forEach((t) => t.classList.remove('col-drop-target'));

  ths.forEach((th) => {
    const key = th.getAttribute('data-column-key');
    if (!movable.has(key)) return;   // gelockt/gepinnt -> nicht ziehbar

    th.setAttribute('draggable', 'true');
    th.classList.add('col-draggable');

    th.addEventListener('dragstart', (e) => {
      // Drag NICHT aus interaktiven Header-Controls (Filter-Funnel/Sortier-Button)
      // starten -> Klicks bleiben unangetastet.
      if (e.target.closest && e.target.closest('.tcf-h-btn, button, input, select, a')) {
        e.preventDefault();
        return;
      }
      dragKey = key;
      try {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', key);
      } catch {}
      th.classList.add('col-dragging');
    });

    th.addEventListener('dragend', () => {
      dragKey = null;
      th.classList.remove('col-dragging');
      clearTargets();
    });

    th.addEventListener('dragover', (e) => {
      if (!dragKey || !movable.has(key)) return;
      e.preventDefault();
      try { e.dataTransfer.dropEffect = 'move'; } catch {}
      clearTargets();
      if (key !== dragKey) th.classList.add('col-drop-target');
    });

    th.addEventListener('dragleave', () => th.classList.remove('col-drop-target'));

    th.addEventListener('drop', (e) => {
      e.preventDefault();
      clearTargets();
      const targetKey = key;
      const moved = dragKey;
      dragKey = null;
      if (!moved || moved === targetKey || !movable.has(targetKey)) return;

      const next = [...order];
      const from = next.indexOf(moved);
      const to = next.indexOf(targetKey);
      if (from < 0 || to < 0) return;
      next.splice(from, 1);
      next.splice(to, 0, moved);
      onReorder(next);
    });
  });
}
