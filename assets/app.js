import { CATEGORIES, GROUPS } from './categories.js';
import { countByCategory, filterSites, indexSites } from './search.js';

const PAGE_SIZE = 60;
const SEARCH_DELAY_MS = 150;
const CATEGORY_LABELS = new Map(CATEGORIES.map((category) => [category.id, category.label]));

const elements = {
  tabs: document.getElementById('tabs'),
  panel: document.getElementById('panel'),
  search: document.getElementById('search-input'),
  filters: document.getElementById('filters'),
  clearFilters: document.getElementById('clear-filters'),
  count: document.getElementById('result-count'),
  results: document.getElementById('results'),
  showMore: document.getElementById('show-more'),
};

let allSites = [];
let state = { group: GROUPS[0].id, query: '', categories: [], visible: PAGE_SIZE };

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function setState(changes) {
  state = { ...state, ...changes };
  render();
}

function createTabs() {
  elements.tabs.replaceChildren(...GROUPS.map((group) => {
    const tab = createElement('button', 'tab', group.label);
    tab.type = 'button';
    tab.id = `tab-${group.id}`;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', 'panel');
    tab.dataset.group = group.id;
    return tab;
  }));
}

// Pas de recreation des onglets pour garder le focus.
function renderTabs() {
  for (const tab of elements.tabs.children) {
    const isSelected = tab.dataset.group === state.group;
    tab.setAttribute('aria-selected', String(isSelected));
    tab.tabIndex = isSelected ? 0 : -1;
  }
  elements.panel.setAttribute('aria-labelledby', `tab-${state.group}`);
}

function renderFilters() {
  const counts = countByCategory(filterSites(allSites, { group: state.group, query: state.query }));
  const available = CATEGORIES.filter((category) => counts.has(category.id) || state.categories.includes(category.id));

  elements.filters.replaceChildren(...available.map((category) => {
    const label = createElement('label', 'chip');
    const checkbox = createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = category.id;
    checkbox.checked = state.categories.includes(category.id);
    label.append(checkbox, createElement('span', null, `${category.label} (${counts.get(category.id) ?? 0})`));
    return label;
  }));
  elements.clearFilters.hidden = state.categories.length === 0;
}

function renderCard(site) {
  const item = createElement('li', 'card');
  const title = createElement('h2', 'card__title');
  const link = createElement('a', 'card__link', site.title);
  link.href = site.url;
  link.rel = 'noopener noreferrer';
  title.append(link);

  const domain = createElement('p', 'card__domain', site.domain);
  const tags = createElement('p', 'card__tags');
  tags.append(createElement('span', 'tag', CATEGORY_LABELS.get(site.category) ?? 'Autres'));
  if (!site.verified) tags.append(createElement('span', 'tag tag--warning', 'Non vérifié'));

  item.append(title, domain);
  if (site.description) item.append(createElement('p', 'card__description', site.description));
  item.append(tags);
  return item;
}

function renderResults() {
  const matches = filterSites(allSites, state);
  const shown = matches.slice(0, state.visible);
  elements.results.replaceChildren(...shown.map(renderCard));
  elements.count.textContent = matches.length === 0
    ? 'Aucun site ne correspond à votre recherche.'
    : `${matches.length} site${matches.length > 1 ? 's' : ''} trouvé${matches.length > 1 ? 's' : ''}`;
  elements.showMore.hidden = shown.length >= matches.length;
}

function render() {
  renderTabs();
  renderFilters();
  renderResults();
}

function selectGroup(groupId) {
  if (groupId !== state.group) setState({ group: groupId, categories: [], visible: PAGE_SIZE });
  document.getElementById(`tab-${groupId}`).focus();
}

function nextTabIndex(key, index) {
  const last = GROUPS.length - 1;
  switch (key) {
    case 'ArrowRight': return index === last ? 0 : index + 1;
    case 'ArrowLeft': return index === 0 ? last : index - 1;
    case 'Home': return 0;
    case 'End': return last;
    default: return null;
  }
}

function bindEvents() {
  elements.tabs.addEventListener('click', (event) => {
    const tab = event.target.closest('[role="tab"]');
    if (tab) selectGroup(tab.dataset.group);
  });

  elements.tabs.addEventListener('keydown', (event) => {
    const index = nextTabIndex(event.key, GROUPS.findIndex((group) => group.id === state.group));
    if (index === null) return;
    event.preventDefault();
    selectGroup(GROUPS[index].id);
  });

  let searchTimer;
  elements.search.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => setState({ query: elements.search.value, visible: PAGE_SIZE }), SEARCH_DELAY_MS);
  });

  elements.filters.addEventListener('change', (event) => {
    const { value, checked } = event.target;
    const categories = checked
      ? [...state.categories, value]
      : state.categories.filter((category) => category !== value);
    setState({ categories, visible: PAGE_SIZE });
    const checkbox = elements.filters.querySelector(`input[value="${value}"]`);
    (checkbox ?? (elements.clearFilters.hidden ? elements.search : elements.clearFilters)).focus();
  });

  elements.clearFilters.addEventListener('click', () => {
    setState({ categories: [], visible: PAGE_SIZE });
    elements.search.focus();
  });

  elements.showMore.addEventListener('click', () => {
    const firstNewIndex = state.visible;
    setState({ visible: state.visible + PAGE_SIZE });
    elements.results.children[firstNewIndex]?.querySelector('a')?.focus();
  });
}

async function init() {
  createTabs();
  renderTabs();
  bindEvents();
  try {
    const response = await fetch('data/sites.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const { sites } = await response.json();
    allSites = indexSites(sites).sort((a, b) => a.sortKey.localeCompare(b.sortKey, 'fr'));
    render();
  } catch (error) {
    elements.count.textContent = `Impossible de charger la liste des sites (${error.message}).`;
  }
}

init();
