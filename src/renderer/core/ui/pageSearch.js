// src/renderer/core/ui/pageSearch.js



let searchState = {
  query: '',
  matches: [],
  activeIndex: -1,
};

const DEBUG_PAGE_SEARCH = false;

const PAGE_SEARCH_EXCLUDE_SELECTOR = [
  '.app-page-search',

  // Header / Navigation / Tabs
  'header',
  '#app-header',
  '.app-header',
  '.tablinks',

  // Status / Warning / Scenario Labels
  '.warning-text',
  '#curveWarningText',
  '#creditWarningText',
  '#volWarningText',

  // Buttons, die keine Inhaltstreffer sein sollen
  '#submitToProductsBtn',
  '#submitToOffersBtn',
  '#saveButton',

  // Optional: allgemeine Preview-/Toolbar-Bereiche, falls vorhanden
  '.toolbar',
  '.top-bar',
  '.button-bar',
  '.controls',
].join(',');

function isVisibleElement(el) {
  if (!el) return false;

  const style = window.getComputedStyle(el);

  if (
    el.hidden ||
    el.getAttribute('aria-hidden') === 'true' ||
    style.display === 'none' ||
    style.visibility === 'hidden'
  ) {
    return false;
  }

  return el.getClientRects().length > 0;
}

function getActiveSearchRoot() {
  const candidates = [
    '.tabcontent',
    '.tab-pane.active',
    '.tab-pane.show.active',
    '[role="tabpanel"]:not([hidden]):not([aria-hidden="true"])',
    '.active-tab',
    '.page.active',
    '.content-section.active',
    'main',
  ];

  for (const selector of candidates) {
    const elements = [...document.querySelectorAll(selector)];
    const visible = elements.find(isVisibleElement);

    if (visible) return visible;
  }

  return document.body;
}

function clearHighlights(root = document.body) {
  const marks = root.querySelectorAll('mark.app-search-highlight');

  marks.forEach((mark) => {
    const parent = mark.parentNode;
    if (!parent) return;

    parent.replaceChild(document.createTextNode(mark.textContent), mark);
    parent.normalize();
  });
}

function hasHiddenAncestor(el) {
  let current = el;

  while (current && current !== document.body) {
    const style = window.getComputedStyle(current);

    if (
      current.hidden ||
      current.getAttribute('aria-hidden') === 'true' ||
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      current.classList.contains('hidden') ||
      current.classList.contains('d-none')
    ) {
      return true;
    }

    current = current.parentElement;
  }

  return false;
}

function isSearchableTextNode(node) {
  if (!node || !node.nodeValue || !node.nodeValue.trim()) return false;

  const parent = node.parentElement;
  if (!parent) return false;

  const blockedTags = [
    'SCRIPT',
    'STYLE',
    'NOSCRIPT',
    'INPUT',
    'TEXTAREA',
    'SELECT',
    'OPTION',
    'OPTGROUP',
  ];

  if (blockedTags.includes(parent.tagName)) return false;

  if (parent.closest(PAGE_SEARCH_EXCLUDE_SELECTOR)) return false;

  const style = window.getComputedStyle(parent);
  if (hasHiddenAncestor(parent)) return false;

  return true;
}

function walkTextNodes(root) {
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        return isSearchableTextNode(node)
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT;
      },
    }
  );

  const nodes = [];
  let node;

  while ((node = walker.nextNode())) {
    nodes.push(node);
  }

  return nodes;
}

function highlightMatches(root, query) {
  const matches = [];
  const textNodes = walkTextNodes(root);

  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(escapedQuery, 'gi');

  textNodes.forEach((textNode) => {
    const text = textNode.nodeValue;
    if (!regex.test(text)) return;

    regex.lastIndex = 0;

    const fragment = document.createDocumentFragment();
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      const before = text.slice(lastIndex, match.index);
      if (before) fragment.appendChild(document.createTextNode(before));

      const mark = document.createElement('mark');
      mark.className = 'app-search-highlight';
      mark.textContent = match[0];

      fragment.appendChild(mark);
      matches.push(mark);

      lastIndex = match.index + match[0].length;
    }

    const after = text.slice(lastIndex);
    if (after) fragment.appendChild(document.createTextNode(after));

    textNode.parentNode.replaceChild(fragment, textNode);
  });

  return matches;
}

function setActiveMatch(index) {
  searchState.matches.forEach((el) => {
    el.classList.remove('app-search-highlight-active');
  });

  if (!searchState.matches.length) {
    searchState.activeIndex = -1;
    updateCounter();
    return;
  }

  const safeIndex = (index + searchState.matches.length) % searchState.matches.length;
  searchState.activeIndex = safeIndex;

  const active = searchState.matches[safeIndex];
  active.classList.add('app-search-highlight-active');

  active.scrollIntoView({
    behavior: 'smooth',
    block: 'center',
    inline: 'nearest',
  });

  updateCounter();
}

function updateCounter() {
  const counter = document.getElementById('app-page-search-counter');
  if (!counter) return;

  if (!searchState.query) {
    counter.textContent = '';
    return;
  }

  if (!searchState.matches.length) {
    counter.textContent = '0';
    return;
  }

  counter.textContent = `${searchState.activeIndex + 1} / ${searchState.matches.length}`;
}



function runSearch(query) {
  const root = getActiveSearchRoot();

  // Wichtig: Alte Markierungen überall entfernen,
  // nicht nur im aktuell gefundenen Root.
  clearHighlights(document.body);

  searchState.query = query.trim();
  searchState.matches = [];
  searchState.activeIndex = -1;

  if (!searchState.query) {
    updateCounter();
    return;
  }

  searchState.matches = highlightMatches(root, searchState.query)
  .filter((mark) => !mark.closest(PAGE_SEARCH_EXCLUDE_SELECTOR));


    if (DEBUG_PAGE_SEARCH) {
        console.table(
            searchState.matches.map((mark, index) => ({
            index,
            text: mark.textContent,
            parent: mark.parentElement?.tagName,
            className: mark.parentElement?.className,
            id: mark.parentElement?.id,
            visibleText: mark.parentElement?.innerText?.slice(0, 80),
            }))
        );
    }

  if (searchState.matches.length) {
    setActiveMatch(0);
  } else {
    updateCounter();
  }
}

function nextMatch() {
  if (!searchState.matches.length) return;
  setActiveMatch(searchState.activeIndex + 1);
}

function previousMatch() {
  if (!searchState.matches.length) return;
  setActiveMatch(searchState.activeIndex - 1);
}

function injectSearchUI() {
  if (document.getElementById('app-page-search')) return;

  const wrapper = document.createElement('div');
  wrapper.id = 'app-page-search';
  wrapper.className = 'app-page-search';

  wrapper.innerHTML = `
    <span class="app-page-search-icon">🔍</span>
    <input 
      id="app-page-search-input"
      class="app-page-search-input"
      type="search"
      placeholder="Search current page..."
      autocomplete="off"
    />
    <span id="app-page-search-counter" class="app-page-search-counter"></span>
  `;

  const target =
    document.querySelector('#app-header') ||
    document.querySelector('.app-header') ||
    document.querySelector('header') ||
    document.body;

  target.prepend(wrapper);
}

export function installPageSearch() {
  injectSearchUI();

  const input = document.getElementById('app-page-search-input');
  if (!input) return;

  input.addEventListener('input', (event) => {
    runSearch(event.target.value);
  });

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && event.shiftKey) {
      event.preventDefault();
      previousMatch();
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      nextMatch();
      return;
    }

    if (event.key === 'Escape') {
      input.value = '';
      runSearch('');
      input.blur();
    }
  });

  document.addEventListener('keydown', (event) => {
    const isMac = navigator.platform.toUpperCase().includes('MAC');
    const searchShortcut = isMac ? event.metaKey && event.key === 'f' : event.ctrlKey && event.key === 'f';

    if (!searchShortcut) return;

    event.preventDefault();
    input.focus();
    input.select();
  });
}