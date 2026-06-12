let initialized = false;

function normalizeKey(value) {
  return String(value ?? '').trim().toUpperCase();
}

function findSensTabsByKeys(keys) {
  const wanted = new Set(keys.map(normalizeKey));

  return Array.from(document.querySelectorAll('[data-sens-tab]')).filter(tab => {
    return wanted.has(normalizeKey(tab.dataset.sensTab));
  });
}

function findSensViewsByKeys(keys) {
  const wanted = new Set(keys.map(normalizeKey));

  return Array.from(document.querySelectorAll('[data-sens-view]')).filter(view => {
    return wanted.has(normalizeKey(view.dataset.sensView));
  });
}

function getFirstVisibleSensTab() {
  return Array.from(document.querySelectorAll('[data-sens-tab]')).find(tab => {
    return tab.style.display !== 'none' && !tab.disabled;
  });
}

function activateSensTab(target) {
  const root = document.getElementById('panel-sensitivities');
  if (!root) return;

  const tabs = root.querySelectorAll('[data-sens-tab]');
  const views = root.querySelectorAll('[data-sens-view]');

  tabs.forEach(t => {
    const active = normalizeKey(t.dataset.sensTab) === normalizeKey(target);
    t.classList.toggle('is-active', active);
    t.setAttribute('aria-selected', active ? 'true' : 'false');
  });

  views.forEach(view => {
    const active = normalizeKey(view.dataset.sensView) === normalizeKey(target);
    view.classList.toggle('is-active', active);
    view.hidden = !active;
  });

  console.log('[SENS TABS] active:', target);
}

export function setSensitivityTabGroupVisible(keys, visible) {
  const tabs = findSensTabsByKeys(keys);
  const views = findSensViewsByKeys(keys);

  tabs.forEach(tab => {
    tab.style.display = visible ? '' : 'none';
    tab.disabled = !visible;
    tab.setAttribute('aria-hidden', visible ? 'false' : 'true');

    if (!visible) {
      tab.classList.remove('is-active');
      tab.setAttribute('aria-selected', 'false');
    }
  });

  views.forEach(view => {
    if (!visible) {
      view.classList.remove('is-active');
      view.hidden = true;
    }
  });

  const activeTab = document.querySelector('[data-sens-tab].is-active');

  if (!activeTab || activeTab.style.display === 'none' || activeTab.disabled) {
    const fallback = getFirstVisibleSensTab();

    if (fallback) {
      activateSensTab(fallback.dataset.sensTab);
    }
  }

  console.log('[SENS TABS] group visibility:', {
    keys,
    visible,
    matchedTabs: tabs.map(t => t.dataset.sensTab),
    matchedViews: views.map(v => v.dataset.sensView),
  });
}

export function initMarketRiskSensitivityTabs() {
  if (initialized) return;

  const root = document.getElementById('panel-sensitivities');

  if (!root) {
    console.warn('[SENS TABS] panel-sensitivities not found');
    return;
  }

  const tabs = root.querySelectorAll('[data-sens-tab]');
  const views = root.querySelectorAll('[data-sens-view]');

  if (!tabs.length || !views.length) {
    console.warn('[SENS TABS] tabs/views not found', {
      tabs: tabs.length,
      views: views.length,
    });
    return;
  }

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      if (tab.disabled) return;
      if (tab.style.display === 'none') return;

      const target = tab.dataset.sensTab;

      activateSensTab(target);
    });
  });

  initialized = true;

  console.log('[SENS TABS] initialized');
}