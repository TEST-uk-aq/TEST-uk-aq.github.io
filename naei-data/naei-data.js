const API_BASE = 'https://uk-aq-naei-api.test-uk-aq-research-and-naei-data.workers.dev';
const MAX_GROUPS = 10;
const ACTIVITY_DATA_NAME = 'Activity Data';

const PALETTE = [
  '#E42020',
  '#3CB44B',
  '#D9B800',
  '#4363D8',
  '#F58231',
  '#911EB4',
  '#1F9EA8',
  '#D929C8',
  '#72A90A',
  '#C86C7B',
];

const CATEGORY_COLOURS = [
  ['ecodesign', '#F58231'],
  ['fireplace', '#E42020'],
  ['gas', '#4363D8'],
  ['power', '#3CB44B'],
  ['road', '#1F9EA8'],
];

const dom = {
  status: document.getElementById('naei-status'),
  error: document.getElementById('naei-error'),
  errorMessage: document.getElementById('naei-error-message'),
  retry: document.getElementById('naei-retry'),
  app: document.getElementById('naei-app'),
  metric: document.getElementById('naei-metric'),
  startYear: document.getElementById('naei-start-year'),
  endYear: document.getElementById('naei-end-year'),
  bubbleYear: document.getElementById('naei-bubble-year'),
  groupList: document.getElementById('naei-group-list'),
  addGroup: document.getElementById('naei-add-group'),
  groupCount: document.getElementById('naei-group-count'),
  groupAnnouncement: document.getElementById('naei-group-announcement'),
  copyLink: document.getElementById('naei-copy-link'),
  downloadCsv: document.getElementById('naei-download-csv'),
  downloadXlsx: document.getElementById('naei-download-xlsx'),
  downloadPng: document.getElementById('naei-download-png'),
  smoothing: document.getElementById('naei-smoothing'),
  chart: document.getElementById('naei-chart'),
  legend: document.getElementById('naei-legend'),
  chartHeading: document.getElementById('naei-chart-heading'),
  chartSubtitle: document.getElementById('naei-chart-subtitle'),
  chartMessage: document.getElementById('naei-chart-message'),
  datasetLabel: document.getElementById('naei-dataset-label'),
};

const state = {
  manifest: null,
  dimensions: null,
  groups: [],
  groupData: new Map(),
  view: 'line',
  metricId: null,
  selectedGroupIds: [],
  startYear: 1970,
  endYear: 2024,
  bubbleYear: 2024,
  smoothing: false,
  highlightedGroupId: null,
  renderToken: 0,
};

function escapeCsv(value) {
  const text = value == null ? '' : String(value);
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function formatNumber(value) {
  if (value == null || !Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  if (abs >= 1000000 || (abs > 0 && abs < 0.001)) return value.toExponential(3);
  return new Intl.NumberFormat('en-GB', {
    maximumFractionDigits: abs >= 100 ? 2 : abs >= 1 ? 3 : 5,
  }).format(value);
}

function metricById(id) {
  return state.dimensions?.metrics?.find((item) => Number(item.id) === Number(id)) || null;
}

function metricLabel(metric) {
  const publicName = metric?.public_display_name;
  return typeof publicName === 'string' && publicName.trim() && !/[\x00-\x1f\x7f]/.test(publicName)
    ? publicName.trim()
    : (metric?.display_name || 'Pollutant');
}

function metricOptionLabel(metric, counts) {
  const label = metricLabel(metric);
  if (counts.get(label) === 1) return label;
  return `${label} (${metric.display_name}; ${metric.key})`;
}

function visibleMetricLabel(metric) {
  if (!metric) return 'Pollutant';
  const label = metricLabel(metric);
  const duplicates = (state.dimensions?.metrics || []).filter((item) =>
    item.metric_type === 'emission' && metricLabel(item) === label);
  return duplicates.length > 1 ? metricOptionLabel(metric, new Map([[label, duplicates.length]])) : label;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}

function groupById(id) {
  return state.groups.find((item) => Number(item.group_id) === Number(id)) || null;
}

function activityMetric() {
  return state.dimensions?.metrics?.find((item) => item.display_name === ACTIVITY_DATA_NAME) || null;
}

function selectedGroups() {
  return state.selectedGroupIds.map(groupById).filter(Boolean);
}

function colourForGroup(group, index) {
  const name = String(group?.display_title || '').toLowerCase();
  const preferred = CATEGORY_COLOURS.find(([needle]) => name.includes(needle));
  if (preferred) return preferred[1];
  return PALETTE[index % PALETTE.length];
}

function parseUrlState() {
  const params = new URLSearchParams(location.search);
  const view = params.get('view');
  if (view === 'bubble' || view === 'line') state.view = view;

  const metricId = Number(params.get('metric'));
  if (Number.isInteger(metricId) && metricId > 0) state.metricId = metricId;

  const groups = String(params.get('groups') || '')
    .split(',')
    .map(Number)
    .filter((id) => Number.isInteger(id) && id > 0)
    .filter((id, index, all) => all.indexOf(id) === index)
    .slice(0, MAX_GROUPS);
  if (groups.length) state.selectedGroupIds = groups;

  const start = Number(params.get('start'));
  const end = Number(params.get('end'));
  const year = Number(params.get('year'));
  if (Number.isInteger(start)) state.startYear = start;
  if (Number.isInteger(end)) state.endYear = end;
  if (Number.isInteger(year)) state.bubbleYear = year;
  state.smoothing = params.get('smooth') === '1';
}

function writeUrlState() {
  const params = new URLSearchParams();
  params.set('view', state.view);
  if (state.metricId) params.set('metric', String(state.metricId));
  if (state.selectedGroupIds.length) params.set('groups', state.selectedGroupIds.join(','));
  if (state.view === 'line') {
    params.set('start', String(state.startYear));
    params.set('end', String(state.endYear));
  } else {
    params.set('year', String(state.bubbleYear));
  }
  if (state.smoothing) params.set('smooth', '1');
  history.replaceState(null, '', `${location.pathname}?${params.toString()}`);
}

async function fetchJson(path) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`NAEI API request failed (${response.status})`);
  return response.json();
}

async function loadGroupData(id) {
  if (state.groupData.has(id)) return state.groupData.get(id);
  const data = await fetchJson(`/v1/groups/${id}/data`);
  state.groupData.set(id, data);
  return data;
}

function seriesForMetric(groupData, metricId) {
  const row = groupData?.s?.find((item) => Number(item[0]) === Number(metricId));
  if (!row) return null;
  return { firstYear: Number(row[1]), values: row[2] || [] };
}

function valueAt(groupData, metricId, year) {
  const series = seriesForMetric(groupData, metricId);
  if (!series) return null;
  const index = Number(year) - series.firstYear;
  if (index < 0 || index >= series.values.length) return null;
  const value = series.values[index];
  return value == null ? null : Number(value);
}

function setBusy(message = 'Loading chart data…') {
  dom.chartMessage.textContent = message;
  dom.chartMessage.hidden = false;
}

function clearBusy() {
  dom.chartMessage.hidden = true;
}

function showFatal(error) {
  console.error(error);
  dom.status.hidden = true;
  dom.app.hidden = true;
  dom.error.hidden = false;
  dom.errorMessage.textContent = error?.message || 'The Explorer could not load the published NAEI dataset.';
}

function populateYears() {
  const [first, last] = state.dimensions.year_range || [1970, 2024];
  const years = [];
  for (let year = first; year <= last; year += 1) years.push(year);

  for (const select of [dom.startYear, dom.endYear, dom.bubbleYear]) {
    select.replaceChildren(...years.map((year) => new Option(String(year), String(year))));
  }

  state.startYear = Math.max(first, Math.min(last - 1, state.startYear || first));
  state.endYear = Math.max(state.startYear + 1, Math.min(last, state.endYear || last));
  state.bubbleYear = Math.max(first, Math.min(last, state.bubbleYear || last));

  dom.startYear.value = String(state.startYear);
  dom.endYear.value = String(state.endYear);
  dom.bubbleYear.value = String(state.bubbleYear);
}

// Size every group combobox for the longest published title, not the full card width.
// The flex item may still shrink to fit the row on narrow screens.
function sizeGroupCombos() {
  const input = dom.groupList.querySelector('.naei-group-combo input');
  if (!input || !state.groups.length) return;
  const context = document.createElement('canvas').getContext('2d');
  if (!context) return;
  const style = getComputedStyle(input);
  context.font = style.font;
  const longest = state.groups.reduce((width, group) =>
    Math.max(width, context.measureText(String(group.display_title || '')).width), 0);
  const spacing = ['paddingLeft', 'paddingRight', 'borderLeftWidth', 'borderRightWidth']
    .reduce((sum, property) => sum + (parseFloat(style[property]) || 0), 0);
  dom.groupList.style.setProperty('--naei-group-combo-width', `${Math.ceil(longest + spacing + 2)}px`);
}

function populateMetrics() {
  const emissions = (state.dimensions.metrics || [])
    .filter((metric) => metric.metric_type === 'emission')
    .sort((a, b) => metricLabel(a).localeCompare(metricLabel(b), 'en-GB') || Number(a.id) - Number(b.id));
  const counts = new Map();
  emissions.forEach((metric) => counts.set(metricLabel(metric), (counts.get(metricLabel(metric)) || 0) + 1));

  dom.metric.replaceChildren(...emissions.map((metric) => (
    new Option(metricOptionLabel(metric, counts), String(metric.id))
  )));

  const requested = emissions.find((metric) => Number(metric.id) === Number(state.metricId));
  const pm25 = emissions.find((metric) => metric.display_name === 'PM2.5');
  state.metricId = Number((requested || pm25 || emissions[0])?.id || 0);
  dom.metric.value = String(state.metricId);
}

function applyDefaultGroups() {
  if (state.selectedGroupIds.length) {
    state.selectedGroupIds = state.selectedGroupIds
      .filter((id) => state.groups.some((group) => Number(group.group_id) === Number(id)))
      .filter((id, index, all) => all.indexOf(id) === index)
      .slice(0, MAX_GROUPS);
  }

  if (state.selectedGroupIds.length) return;

  if (state.view === 'bubble') {
    const preferredNames = ['Ecodesign Stove - Ready To Burn', 'Gas Boilers'];
    state.selectedGroupIds = preferredNames
      .map((name) => Number(state.groups.find((group) => group.display_title === name)?.group_id))
      .filter(Boolean);
  }

  if (!state.selectedGroupIds.length) {
    const all = state.groups.find((group) => group.display_title === 'All');
    if (all) state.selectedGroupIds = [Number(all.group_id)];
  }
}

function moveGroup(from, to) {
  if (from < 0 || to < 0 || to >= state.selectedGroupIds.length || from === to) return;
  const [id] = state.selectedGroupIds.splice(from, 1);
  state.selectedGroupIds.splice(to, 0, id);
  renderGroupList(to);
  dom.groupAnnouncement.textContent = `Moved ${groupById(id)?.display_title || 'group'} to position ${to + 1} of ${state.selectedGroupIds.length}`;
  scheduleRender();
}

let closeOpenGroupOptions = null;

function renderGroupList(focusIndex = null) {
  closeOpenGroupOptions?.();
  const fragment = document.createDocumentFragment();
  state.selectedGroupIds.forEach((id, index) => {
    const group = groupById(id);
    if (!group) return;
    const row = document.createElement('div');
    row.className = 'naei-group-row';
    row.dataset.groupId = String(id);
    const combo = document.createElement('div');
    combo.className = 'naei-group-combo';
    const input = document.createElement('input');
    input.type = 'text';
    input.value = group.display_title;
    input.autocomplete = 'off';
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-label', `Group ${index + 1}`);
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-haspopup', 'listbox');
    input.setAttribute('aria-expanded', 'false');
    const listId = `naei-group-options-${index}`;
    input.setAttribute('aria-controls', listId);
    const options = document.createElement('div');
    options.id = listId;
    options.className = 'naei-group-options';
    options.setAttribute('role', 'listbox');
    options.hidden = true;
    const announcement = document.createElement('span');
    announcement.className = 'naei-visually-hidden';
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', 'polite');
    let matches = [];
    let active = -1;
    let query = '';

    function setActive(next) {
      active = next;
      [...options.querySelectorAll('[role="option"]')].forEach((option, optionIndex) => {
        option.setAttribute('aria-selected', optionIndex === active ? 'true' : 'false');
      });
      const option = options.querySelectorAll('[role="option"]')[active];
      if (option) {
        input.setAttribute('aria-activedescendant', option.id);
        option.scrollIntoView({ block: 'nearest' });
      } else input.removeAttribute('aria-activedescendant');
    }

    function close() {
      options.hidden = true;
      row.classList.remove('is-open');
      input.setAttribute('aria-expanded', 'false');
      input.removeAttribute('aria-activedescendant');
      input.value = groupById(state.selectedGroupIds[index])?.display_title || '';
      query = '';
      document.removeEventListener('pointerdown', closeOnOutsidePointer, true);
      window.removeEventListener('scroll', positionOptions, true);
      window.visualViewport?.removeEventListener('resize', positionOptions);
      window.visualViewport?.removeEventListener('scroll', positionOptions);
      if (closeOpenGroupOptions === close) closeOpenGroupOptions = null;
    }

    function closeOnOutsidePointer(event) {
      if (!combo.contains(event.target)) close();
    }

    function positionOptions() {
      if (options.hidden) return;
      const viewport = window.visualViewport;
      const viewportTop = viewport?.offsetTop || 0;
      const viewportBottom = viewportTop + (viewport?.height || window.innerHeight);
      const bounds = input.getBoundingClientRect();
      const below = Math.max(0, viewportBottom - bounds.bottom - 8);
      const above = Math.max(0, bounds.top - viewportTop - 8);
      const openAbove = below < 170 && above > below;
      row.classList.toggle('opens-above', openAbove);
      options.style.maxHeight = `${Math.min(240, openAbove ? above : below)}px`;
    }

    function choose(chosenId) {
      close();
      state.selectedGroupIds[index] = chosenId;
      state.highlightedGroupId = null;
      renderGroupList();
      scheduleRender();
      dom.groupAnnouncement.textContent = `Selected ${groupById(chosenId)?.display_title || 'group'} for group ${index + 1}`;
      const nextInput = dom.groupList.querySelectorAll('.naei-group-combo input')[index];
      if (nextInput) {
        nextInput.dataset.suppressNextOpen = 'true';
        nextInput.focus({ preventScroll: true });
      }
    }

    function show() {
      if (closeOpenGroupOptions && closeOpenGroupOptions !== close) closeOpenGroupOptions();
      matches = state.groups.filter((candidate) => {
        const candidateId = Number(candidate.group_id);
        return (candidateId === id || !state.selectedGroupIds.includes(candidateId))
          && candidate.display_title.toLocaleLowerCase('en-GB').includes(query.toLocaleLowerCase('en-GB'));
      });
      options.replaceChildren();
      matches.forEach((candidate, optionIndex) => {
        const option = document.createElement('div');
        option.id = `${listId}-${optionIndex}`;
        option.className = 'naei-group-option';
        option.setAttribute('role', 'option');
        option.setAttribute('aria-selected', 'false');
        option.textContent = candidate.display_title;
        option.addEventListener('mousedown', (event) => event.preventDefault());
        option.addEventListener('click', () => choose(Number(candidate.group_id)));
        options.append(option);
      });
      if (!matches.length) {
        const empty = document.createElement('div');
        empty.className = 'naei-group-empty';
        empty.textContent = 'No matching groups';
        options.append(empty);
      }
      options.hidden = false;
      row.classList.add('is-open');
      input.setAttribute('aria-expanded', 'true');
      announcement.textContent = `${matches.length} matching group${matches.length === 1 ? '' : 's'}`;
      closeOpenGroupOptions = close;
      positionOptions();
      document.addEventListener('pointerdown', closeOnOutsidePointer, true);
      window.addEventListener('scroll', positionOptions, true);
      window.visualViewport?.addEventListener('resize', positionOptions);
      window.visualViewport?.addEventListener('scroll', positionOptions);
      setActive(matches.length ? 0 : -1);
    }

    input.addEventListener('focus', () => {
      if (input.dataset.suppressNextOpen) {
        delete input.dataset.suppressNextOpen;
        return;
      }
      query = '';
      input.select();
      show();
    });
    input.addEventListener('click', () => { if (options.hidden) { query = ''; show(); } });
    input.addEventListener('input', () => { query = input.value; show(); });
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') { event.preventDefault(); close(); return; }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        if (options.hidden) {
          show();
          if (event.key === 'ArrowUp' && matches.length) setActive(matches.length - 1);
        } else if (matches.length) {
          setActive((active + (event.key === 'ArrowDown' ? 1 : -1) + matches.length) % matches.length);
        }
      } else if (event.key === 'Enter' && !options.hidden) {
        event.preventDefault();
        if (active >= 0) choose(Number(matches[active].group_id));
      }
    });
    input.addEventListener('blur', () => { window.setTimeout(close, 0); });
    combo.append(input, options, announcement);

    function rowButton(label, symbol, action, disabled = false) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = symbol;
      button.setAttribute('aria-label', `${label}: ${group.display_title}`);
      button.disabled = disabled;
      button.addEventListener('click', action);
      return button;
    }
    const handle = rowButton('Drag or press Alt + Up/Down to reorder group', '⠿', () => {});
    handle.className = 'naei-group-handle';
    handle.draggable = true;
    handle.addEventListener('dragstart', (event) => {
      event.dataTransfer.setData('text/plain', String(id));
      event.dataTransfer.effectAllowed = 'move';
      row.classList.add('is-dragging');
    });
    handle.addEventListener('dragend', () => row.classList.remove('is-dragging'));
    handle.addEventListener('keydown', (event) => {
      if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
        event.preventDefault();
        moveGroup(index, index + (event.key === 'ArrowUp' ? -1 : 1));
      }
    });
    let touchTarget = null;
    handle.addEventListener('pointerdown', (event) => {
      if (event.pointerType === 'mouse') return;
      touchTarget = index;
      handle.setPointerCapture(event.pointerId);
    });
    handle.addEventListener('pointermove', (event) => {
      if (touchTarget === null) return;
      dom.groupList.querySelectorAll('.naei-group-row').forEach((item) => item.classList.remove('is-drop-target'));
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('.naei-group-row');
      if (target && dom.groupList.contains(target)) {
        touchTarget = [...dom.groupList.children].indexOf(target);
        if (touchTarget !== index) target.classList.add('is-drop-target');
      }
    });
    handle.addEventListener('pointerup', () => {
      const target = touchTarget;
      touchTarget = null;
      dom.groupList.querySelectorAll('.naei-group-row').forEach((item) => item.classList.remove('is-drop-target'));
      if (target !== null) moveGroup(index, target);
    });
    handle.addEventListener('pointercancel', () => {
      touchTarget = null;
      dom.groupList.querySelectorAll('.naei-group-row').forEach((item) => item.classList.remove('is-drop-target'));
    });
    row.addEventListener('dragover', (event) => { event.preventDefault(); row.classList.add('is-drop-target'); });
    row.addEventListener('dragleave', () => row.classList.remove('is-drop-target'));
    row.addEventListener('drop', (event) => {
      event.preventDefault();
      const draggedId = Number(event.dataTransfer.getData('text/plain'));
      moveGroup(state.selectedGroupIds.indexOf(draggedId), index);
    });
    row.append(handle, combo);
    if (state.selectedGroupIds.length > 1) {
      const remove = rowButton('Remove group', '×', () => {
        if (state.selectedGroupIds.length <= 1) return;
        state.selectedGroupIds.splice(index, 1);
        state.highlightedGroupId = null;
        renderGroupList();
        scheduleRender();
        dom.groupList.querySelectorAll('.naei-group-combo input')[Math.min(index, state.selectedGroupIds.length - 1)]?.focus();
      });
      row.append(remove);
    }
    fragment.append(row);
  });
  dom.groupList.replaceChildren(fragment);
  dom.groupCount.textContent = `${state.selectedGroupIds.length} of ${MAX_GROUPS} selected`;
  dom.addGroup.disabled = state.selectedGroupIds.length >= Math.min(MAX_GROUPS, state.groups.length);
  if (focusIndex !== null) dom.groupList.querySelectorAll('.naei-group-handle')[focusIndex]?.focus();
}

function syncViewUi() {
  document.querySelectorAll('.naei-view-tab').forEach((button) => {
    const active = button.dataset.view === state.view;
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
    button.classList.toggle('active', active);
  });
  document.querySelector('[data-for-view="line"]').hidden = state.view !== 'line';
  document.querySelector('[data-for-view="bubble"]').hidden = state.view !== 'bubble';
  dom.smoothing.setAttribute('aria-pressed', state.smoothing ? 'true' : 'false');
  dom.smoothing.textContent = state.smoothing ? 'Disable Smoothing' : 'Enable Smoothing';
}

function clampYearControls(changed) {
  let start = Number(dom.startYear.value);
  let end = Number(dom.endYear.value);
  if (start >= end) {
    const [first, last] = state.dimensions.year_range;
    if (changed === 'start') {
      if (start >= last) start = last - 1;
      end = start + 1;
    } else {
      if (end <= first) end = first + 1;
      start = end - 1;
    }
  }
  state.startYear = start;
  state.endYear = end;
  dom.startYear.value = String(start);
  dom.endYear.value = String(end);
}

function createSvgElement(name, attributes = {}) {
  const element = document.createElementNS('http://www.w3.org/2000/svg', name);
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, String(value)));
  return element;
}

function niceTicks(maxValue, count = 5) {
  if (!Number.isFinite(maxValue) || maxValue <= 0) return [0, 1];
  const raw = maxValue / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const residual = raw / magnitude;
  const nice = residual >= 5 ? 10 : residual >= 2 ? 5 : residual >= 1 ? 2 : 1;
  const step = nice * magnitude;
  const top = Math.ceil(maxValue / step) * step;
  const ticks = [];
  for (let value = 0; value <= top + step / 2; value += step) ticks.push(value);
  return ticks;
}

// Keep the full chart card and shared footer within one desktop viewport at the
// bottom of the page. Widen the SVG plot instead of letterboxing a fixed 960x520
// graphic when the available viewport height is shorter than its natural height.
function sizeChartToViewport() {
  const width = 960;
  const naturalHeight = 520;
  const svg = dom.chart;
  if (window.innerWidth < 768 || window.innerHeight < 600) {
    svg.style.removeProperty('height');
    svg.setAttribute('viewBox', `0 0 ${width} ${naturalHeight}`);
    return naturalHeight;
  }

  const chartWidth = svg.getBoundingClientRect().width;
  const card = svg.closest('.naei-chart-card');
  if (!chartWidth || !card) return naturalHeight;

  const svgHeight = svg.getBoundingClientRect().height;
  const cardOverhead = card.getBoundingClientRect().height - svgHeight;
  const footer = document.getElementById('ukaq-site-footer');
  const footerHeight = footer && !footer.hidden ? footer.getBoundingClientRect().height : 56;
  const naturalCssHeight = chartWidth * naturalHeight / width;
  const room = window.innerHeight - footerHeight - cardOverhead - 12;
  const targetCssHeight = Math.min(naturalCssHeight, Math.max(320, room));
  const scaledHeight = targetCssHeight * width / chartWidth;

  svg.style.height = `${targetCssHeight}px`;
  svg.setAttribute('viewBox', `0 0 ${width} ${scaledHeight}`);
  return scaledHeight;
}

function drawAxes({ xMin, xMax, yMin = 0, yMax, xTicks, yTicks, xTitle, yTitle }) {
  const width = 960;
  const height = sizeChartToViewport();
  const margin = { top: 24, right: 28, bottom: 72, left: 88 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const xScale = (value) => margin.left + ((value - xMin) / (xMax - xMin || 1)) * plotWidth;
  const yScale = (value) => margin.top + plotHeight - ((value - yMin) / (yMax - yMin || 1)) * plotHeight;

  yTicks.forEach((value) => {
    const y = yScale(value);
    dom.chart.append(createSvgElement('line', {
      x1: margin.left, x2: width - margin.right, y1: y, y2: y, class: 'grid-line',
    }));
    const label = createSvgElement('text', {
      x: margin.left - 12, y: y + 4, 'text-anchor': 'end', class: 'axis-label',
    });
    label.textContent = formatNumber(value);
    dom.chart.append(label);
  });

  dom.chart.append(createSvgElement('line', {
    x1: margin.left, x2: margin.left, y1: margin.top, y2: height - margin.bottom, class: 'axis-line',
  }));
  dom.chart.append(createSvgElement('line', {
    x1: margin.left, x2: width - margin.right, y1: height - margin.bottom, y2: height - margin.bottom, class: 'axis-line',
  }));

  xTicks.forEach((value) => {
    const x = xScale(value);
    const tick = createSvgElement('line', {
      x1: x, x2: x, y1: height - margin.bottom, y2: height - margin.bottom + 6, class: 'axis-line',
    });
    const label = createSvgElement('text', {
      x, y: height - margin.bottom + 24, 'text-anchor': 'middle', class: 'axis-label',
    });
    label.textContent = String(value);
    dom.chart.append(tick, label);
  });

  const xLabel = createSvgElement('text', {
    x: margin.left + plotWidth / 2, y: height - 16, 'text-anchor': 'middle', class: 'axis-title',
  });
  xLabel.textContent = xTitle;
  dom.chart.append(xLabel);

  const yLabel = createSvgElement('text', {
    x: 19, y: margin.top + plotHeight / 2, 'text-anchor': 'middle', class: 'axis-title',
    transform: `rotate(-90 19 ${margin.top + plotHeight / 2})`,
  });
  yLabel.textContent = yTitle;
  dom.chart.append(yLabel);

  return { xScale, yScale, margin, width, height, plotWidth, plotHeight };
}

function yearTicks(start, end) {
  const span = end - start;
  const step = span <= 10 ? 1 : span <= 20 ? 2 : span <= 40 ? 5 : 10;
  const ticks = [];
  const first = Math.ceil(start / step) * step;
  if (start !== first) ticks.push(start);
  for (let year = first; year <= end; year += step) ticks.push(year);
  if (!ticks.includes(end)) ticks.push(end);
  return [...new Set(ticks)];
}

function showTooltip(event, html) {
  let tip = document.querySelector('.naei-chart-tooltip');
  if (!tip) {
    tip = document.createElement('div');
    tip.className = 'naei-chart-tooltip';
    document.body.append(tip);
  }
  tip.innerHTML = html;
  tip.hidden = false;
  tip.style.left = `${Math.min(window.innerWidth - 275, event.clientX + 14)}px`;
  tip.style.top = `${Math.max(8, event.clientY - 18)}px`;
}

function hideTooltip() {
  const tip = document.querySelector('.naei-chart-tooltip');
  if (tip) tip.hidden = true;
}

function renderLegend(groups) {
  dom.legend.replaceChildren();
  groups.forEach((group, index) => {
    const id = Number(group.group_id);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'naei-legend-button';
    button.setAttribute('aria-pressed', state.highlightedGroupId === id ? 'true' : 'false');
    if (state.highlightedGroupId && state.highlightedGroupId !== id) button.classList.add('is-subdued');

    const swatch = document.createElement('span');
    swatch.className = 'naei-legend-swatch';
    swatch.style.setProperty('--series-colour', colourForGroup(group, index));
    const label = document.createElement('span');
    label.textContent = group.display_title;
    button.append(swatch, label);

    button.addEventListener('click', () => {
      state.highlightedGroupId = state.highlightedGroupId === id ? null : id;
      renderCurrentChartFromCache();
    });
    dom.legend.append(button);
  });
}

function buildLineModel(groupPayloads) {
  const metric = metricById(state.metricId);
  const groups = selectedGroups();
  const years = [];
  for (let year = state.startYear; year <= state.endYear; year += 1) years.push(year);

  const series = groups.map((group, index) => {
    const data = groupPayloads.get(Number(group.group_id));
    return {
      group,
      colour: colourForGroup(group, index),
      values: years.map((year) => valueAt(data, state.metricId, year)),
    };
  });

  return { metric, groups, years, series };
}

// Centered cardinal tangents keep curves flowing through observations. Limit their
// handles locally so sharp changes produce only small overshoot at a turn.
function linePath(points, smoothing, zeroY) {
  if (!smoothing || points.length < 3) {
    return points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ');
  }

  const secants = points.slice(1).map((point, index) => {
    const previous = points[index];
    return (point.y - previous.y) / (point.x - previous.x);
  });
  const tangents = points.map((point, index) => {
    if (index === 0) return secants[0];
    if (index === points.length - 1) return secants.at(-1);

    const left = secants[index - 1];
    const right = secants[index];
    if (!left || !right) return 0; // Keep repeated observations exactly flat.

    const leftWidth = point.x - points[index - 1].x;
    const rightWidth = points[index + 1].x - point.x;
    const centered = (points[index + 1].y - points[index - 1].y) / (leftWidth + rightWidth);
    if (Math.sign(left) === Math.sign(right)) {
      // Keep both Bézier handles within each monotone span's observed range.
      return Math.sign(centered) * Math.min(Math.abs(centered), 3 * Math.abs(left), 3 * Math.abs(right));
    }

    // A small tangent at an asymmetric peak/trough avoids a forced horizontal
    // shoulder. Its outer handle can exceed the observation by at most 5% of
    // the smaller adjacent change; a zero-valued trough cannot dip below zero.
    const maxWidth = Math.max(leftWidth, rightWidth);
    let maxHandle = 0.05 * Math.min(Math.abs(point.y - points[index - 1].y),
      Math.abs(points[index + 1].y - point.y));
    if (point.y > points[index - 1].y && point.y > points[index + 1].y) {
      maxHandle = Math.min(maxHandle, Math.max(0, zeroY - point.y));
    }
    const maxSlope = 3 * maxHandle / maxWidth;
    return Math.max(-maxSlope, Math.min(centered, maxSlope));
  });

  const curves = points.slice(1).map((point, index) => {
    const previous = points[index];
    const thirdWidth = (point.x - previous.x) / 3;
    return `C ${previous.x + thirdWidth} ${previous.y + thirdWidth * tangents[index]} ${point.x - thirdWidth} ${point.y - thirdWidth * tangents[index + 1]} ${point.x} ${point.y}`;
  });
  return `M ${points[0].x} ${points[0].y} ${curves.join(' ')}`;
}

function drawLineChart(model) {
  dom.chart.replaceChildren();
  renderLegend(model.groups);

  const numericValues = model.series.flatMap((item) => item.values.filter(Number.isFinite));
  if (!numericValues.length) {
    dom.chartMessage.textContent = 'No reported values are available for this selection.';
    dom.chartMessage.hidden = false;
    return;
  }

  clearBusy();
  const maxValue = Math.max(...numericValues, 0);
  const yTicks = niceTicks(maxValue, 5);
  const axes = drawAxes({
    xMin: state.startYear,
    xMax: state.endYear,
    yMax: yTicks[yTicks.length - 1],
    xTicks: yearTicks(state.startYear, state.endYear),
    yTicks,
    xTitle: 'Year',
    yTitle: model.metric?.unit || visibleMetricLabel(model.metric),
  });

  model.series.forEach((item) => {
    const groupId = Number(item.group.group_id);
    const g = createSvgElement('g', { class: 'series-group' });
    if (state.highlightedGroupId && state.highlightedGroupId !== groupId) g.classList.add('is-subdued');

    let segment = [];
    const markers = [];
    const flushSegment = () => {
      if (segment.length < 2) {
        segment = [];
        return;
      }
      const path = createSvgElement('path', {
        class: 'series-line',
        stroke: item.colour,
        d: linePath(segment, state.smoothing, axes.yScale(0)),
      });
      g.append(path);
      segment = [];
    };

    item.values.forEach((value, index) => {
      const year = model.years[index];
      if (!Number.isFinite(value)) {
        flushSegment();
        return;
      }
      const point = { x: axes.xScale(year), y: axes.yScale(value) };
      segment.push(point);

      const circle = createSvgElement('circle', {
        class: 'series-point',
        cx: point.x,
        cy: point.y,
        r: 3.6,
        fill: item.colour,
        tabindex: 0,
        role: 'button',
        'aria-label': `${item.group.display_title}, ${year}: ${formatNumber(value)} ${model.metric?.unit || ''}`,
      });
      circle.addEventListener('mouseenter', (event) => showTooltip(
        event,
        `<strong>${item.group.display_title}</strong><br>${year}: ${formatNumber(value)} ${model.metric?.unit || ''}`,
      ));
      circle.addEventListener('mousemove', (event) => showTooltip(
        event,
        `<strong>${item.group.display_title}</strong><br>${year}: ${formatNumber(value)} ${model.metric?.unit || ''}`,
      ));
      circle.addEventListener('mouseleave', hideTooltip);
      circle.addEventListener('focus', (event) => {
        const rect = event.target.getBoundingClientRect();
        showTooltip(
          { clientX: rect.left, clientY: rect.top },
          `<strong>${item.group.display_title}</strong><br>${year}: ${formatNumber(value)} ${model.metric?.unit || ''}`,
        );
      });
      circle.addEventListener('blur', hideTooltip);
      markers.push(circle);
    });
    flushSegment();
    g.append(...markers);
    dom.chart.append(g);
  });
}

function buildBubbleModel(groupPayloads) {
  const metric = metricById(state.metricId);
  const activity = activityMetric();
  const groups = selectedGroups();

  const points = groups.map((group, index) => {
    const data = groupPayloads.get(Number(group.group_id));
    return {
      group,
      colour: colourForGroup(group, index),
      x: activity ? valueAt(data, activity.id, state.bubbleYear) : null,
      y: valueAt(data, state.metricId, state.bubbleYear),
    };
  }).filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));

  return { metric, activity, groups, points, year: state.bubbleYear };
}

function drawBubbleChart(model) {
  dom.chart.replaceChildren();
  renderLegend(model.groups);

  if (!model.activity) {
    dom.chartMessage.textContent = 'Activity Data is not available in the published dataset.';
    dom.chartMessage.hidden = false;
    return;
  }

  if (!model.points.length) {
    dom.chartMessage.textContent = 'The selected groups do not have both Activity Data and pollutant values for this year.';
    dom.chartMessage.hidden = false;
    return;
  }

  clearBusy();
  const maxX = Math.max(...model.points.map((point) => point.x), 0);
  const maxY = Math.max(...model.points.map((point) => point.y), 0);
  const xTicks = niceTicks(maxX, 5);
  const yTicks = niceTicks(maxY, 5);
  const axes = drawAxes({
    xMin: 0,
    xMax: xTicks[xTicks.length - 1],
    yMin: 0,
    yMax: yTicks[yTicks.length - 1],
    xTicks,
    yTicks,
    xTitle: model.activity.unit || 'Activity Data',
    yTitle: model.metric?.unit || visibleMetricLabel(model.metric),
  });

  model.points.forEach((point) => {
    const groupId = Number(point.group.group_id);
    const circle = createSvgElement('circle', {
      class: 'bubble-point',
      cx: axes.xScale(point.x),
      cy: axes.yScale(point.y),
      r: 10,
      fill: point.colour,
      tabindex: 0,
      role: 'button',
      'aria-label': `${point.group.display_title}: Activity Data ${formatNumber(point.x)}, ${visibleMetricLabel(model.metric)} ${formatNumber(point.y)}`,
    });
    if (state.highlightedGroupId && state.highlightedGroupId !== groupId) circle.style.opacity = '0.18';

    const tooltipHtml = `<strong>${point.group.display_title}</strong><br>Activity Data: ${formatNumber(point.x)} ${model.activity.unit || ''}<br>${escapeHtml(visibleMetricLabel(model.metric))}: ${formatNumber(point.y)} ${model.metric.unit || ''}`;
    circle.addEventListener('mouseenter', (event) => showTooltip(event, tooltipHtml));
    circle.addEventListener('mousemove', (event) => showTooltip(event, tooltipHtml));
    circle.addEventListener('mouseleave', hideTooltip);
    circle.addEventListener('focus', (event) => {
      const rect = event.target.getBoundingClientRect();
      showTooltip({ clientX: rect.left, clientY: rect.top }, tooltipHtml);
    });
    circle.addEventListener('blur', hideTooltip);
    dom.chart.append(circle);
  });
}

let lastModel = null;

function renderCurrentChartFromCache() {
  if (!lastModel) return;
  if (state.view === 'line') drawLineChart(lastModel);
  else drawBubbleChart(lastModel);
  renderLegend(selectedGroups());
}

function updateChartText() {
  const metric = metricById(state.metricId);
  dom.chartHeading.textContent = `UK ${metric ? visibleMetricLabel(metric) : 'NAEI'} Emissions`;
  dom.chartSubtitle.textContent = state.view === 'line'
    ? `${state.startYear} - ${state.endYear}`
    : String(state.bubbleYear);
}

async function renderChart() {
  const token = ++state.renderToken;
  lastModel = null;
  writeUrlState();
  syncViewUi();
  updateChartText();

  if (!state.selectedGroupIds.length) {
    dom.legend.replaceChildren();
    dom.chart.replaceChildren();
    dom.chartMessage.textContent = 'Select at least one group to draw the chart.';
    dom.chartMessage.hidden = false;
    lastModel = null;
    return;
  }

  setBusy();
  try {
    const payloads = new Map();
    await Promise.all(state.selectedGroupIds.map(async (id) => {
      payloads.set(id, await loadGroupData(id));
    }));
    if (token !== state.renderToken) return;

    lastModel = state.view === 'line'
      ? buildLineModel(payloads)
      : buildBubbleModel(payloads);

    if (state.view === 'line') drawLineChart(lastModel);
    else drawBubbleChart(lastModel);
  } catch (error) {
    if (token !== state.renderToken) return;
    console.error(error);
    dom.chart.replaceChildren();
    dom.legend.replaceChildren();
    dom.chartMessage.textContent = 'The selected chart data could not be loaded. Please try again.';
    dom.chartMessage.hidden = false;
  }
}

let renderTimer = 0;
function scheduleRender() {
  state.renderToken += 1;
  lastModel = null;
  window.clearTimeout(renderTimer);
  renderTimer = window.setTimeout(renderChart, 40);
}

function currentCsv() {
  if (!lastModel) return '';

  if (state.view === 'line') {
    const headers = ['Year', ...lastModel.groups.map((group) => group.display_title)];
    const rows = lastModel.years.map((year, index) => [
      year,
      ...lastModel.series.map((series) => series.values[index]),
    ]);
    return [headers, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\n');
  }

  const headers = [
    'Group',
    `Activity Data (${lastModel.activity?.unit || ''})`,
    `${lastModel.metric?.display_name || 'Pollutant'} (${lastModel.metric?.unit || ''})`,
    'Year',
  ];
  const rows = lastModel.points.map((point) => [
    point.group.display_title,
    point.x,
    point.y,
    lastModel.year,
  ]);
  return [headers, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\n');
}

function exportRows() {
  if (!lastModel) return [];
  if (state.view === 'line') return [
    ['Year', ...lastModel.groups.map((group) => group.display_title)],
    ...lastModel.years.map((year, index) => [year, ...lastModel.series.map((series) => series.values[index])]),
  ];
  return [
    ['Group', `Activity Data (${lastModel.activity?.unit || ''})`, `${lastModel.metric?.display_name || 'Pollutant'} (${lastModel.metric?.unit || ''})`, 'Year'],
    ...lastModel.points.map((point) => [point.group.display_title, point.x, point.y, lastModel.year]),
  ];
}

function exportName(extension) {
  const metric = String(visibleMetricLabel(lastModel?.metric)).toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const years = state.view === 'line' ? `${state.startYear}-${state.endYear}` : String(lastModel?.year || state.bubbleYear);
  return `uk-aq-naei-${state.view}-${metric}-${years}.${extension}`;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function xmlEscape(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function zipStored(files) {
  const encoder = new TextEncoder();
  const local = [];
  const central = [];
  let offset = 0;
  files.forEach(([name, content]) => {
    const nameBytes = encoder.encode(name);
    const bytes = encoder.encode(content);
    const crc = crc32(bytes);
    const header = new Uint8Array(30 + nameBytes.length);
    const view = new DataView(header.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint32(14, crc, true);
    view.setUint32(18, bytes.length, true);
    view.setUint32(22, bytes.length, true);
    view.setUint16(26, nameBytes.length, true);
    header.set(nameBytes, 30);
    local.push(header, bytes);
    const directory = new Uint8Array(46 + nameBytes.length);
    const directoryView = new DataView(directory.buffer);
    directoryView.setUint32(0, 0x02014b50, true);
    directoryView.setUint16(4, 20, true);
    directoryView.setUint16(6, 20, true);
    directoryView.setUint32(16, crc, true);
    directoryView.setUint32(20, bytes.length, true);
    directoryView.setUint32(24, bytes.length, true);
    directoryView.setUint16(28, nameBytes.length, true);
    directoryView.setUint32(42, offset, true);
    directory.set(nameBytes, 46);
    central.push(directory);
    offset += header.length + bytes.length;
  });
  const centralSize = central.reduce((sum, entry) => sum + entry.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);
  return new Blob([...local, ...central, end], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

function currentXlsx() {
  const rows = exportRows();
  if (!rows.length) return null;
  const letters = (index) => {
    let result = '';
    for (let current = index + 1; current; current = Math.floor((current - 1) / 26)) result = String.fromCharCode(65 + (current - 1) % 26) + result;
    return result;
  };
  const sheetRows = rows.map((row, rowIndex) => `<row r="${rowIndex + 1}">${row.map((value, columnIndex) => {
    const cell = `${letters(columnIndex)}${rowIndex + 1}`;
    return typeof value === 'number' && Number.isFinite(value)
      ? `<c r="${cell}"><v>${value}</v></c>`
      : `<c r="${cell}" t="inlineStr"><is><t>${xmlEscape(value ?? '')}</t></is></c>`;
  }).join('')}</row>`).join('');
  const sheet = `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`;
  return zipStored([
    ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'],
    ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
    ['xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="NAEI Data" sheetId="1" r:id="rId1"/></sheets></workbook>'],
    ['xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'],
    ['xl/worksheets/sheet1.xml', sheet],
  ]);
}

async function downloadPng() {
  if (!lastModel || !dom.chart.children.length) return;
  const svg = dom.chart.cloneNode(true);
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  svg.setAttribute('width', '960');
  svg.setAttribute('height', '520');
  const style = createSvgElement('style');
  style.textContent = '.grid-line{stroke:#d8e0e7;stroke-width:1;stroke-dasharray:2 5}.axis-line{stroke:#8d9aa5;stroke-width:1}.axis-label{fill:#53616d;font:12px Arial,sans-serif}.axis-title{fill:#34424e;font:700 13px Arial,sans-serif}.series-line{fill:none;stroke-width:3;stroke-linejoin:round;stroke-linecap:round}.series-point{stroke:white;stroke-width:1.5}.bubble-point{stroke:white;stroke-width:2}';
  svg.prepend(style);
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = document.createElement('canvas');
    const legendRows = Math.ceil(lastModel.groups.length / 2);
    canvas.width = 1920;
    canvas.height = (610 + legendRows * 30) * 2;
    const context = canvas.getContext('2d');
    context.scale(2, 2);
    context.fillStyle = '#fff';
    context.fillRect(0, 0, 960, canvas.height / 2);
    context.fillStyle = '#101822';
    context.font = 'bold 22px Arial, sans-serif';
    context.fillText(dom.chartHeading.textContent, 35, 35);
    context.font = '14px Arial, sans-serif';
    context.fillStyle = '#5f6d7a';
    context.fillText(dom.chartSubtitle.textContent, 35, 58);
    context.drawImage(img, 0, 70, 960, 520);
    lastModel.groups.forEach((group, index) => {
      const x = 40 + (index % 2) * 460;
      const y = 615 + Math.floor(index / 2) * 30;
      context.fillStyle = colourForGroup(group, index);
      context.fillRect(x, y - 11, 16, 5);
      context.fillStyle = '#273641';
      context.fillText(group.display_title, x + 25, y);
    });
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (blob) downloadBlob(blob, exportName('png'));
  } finally { URL.revokeObjectURL(url); }
}

function bindUi() {
  document.querySelectorAll('.naei-view-tab').forEach((button) => {
    button.addEventListener('click', () => {
      const nextView = button.dataset.view;
      if (nextView === state.view) return;
      state.view = nextView;
      state.highlightedGroupId = null;
      if (state.view === 'bubble' && state.selectedGroupIds.length === 1 && state.selectedGroupIds[0] === 1) {
        state.selectedGroupIds = [];
        applyDefaultGroups();
        renderGroupList();
      }
      scheduleRender();
    });
  });

  dom.metric.addEventListener('change', () => {
    state.metricId = Number(dom.metric.value);
    scheduleRender();
  });

  dom.startYear.addEventListener('change', () => {
    clampYearControls('start');
    scheduleRender();
  });

  dom.endYear.addEventListener('change', () => {
    clampYearControls('end');
    scheduleRender();
  });

  dom.bubbleYear.addEventListener('change', () => {
    state.bubbleYear = Number(dom.bubbleYear.value);
    scheduleRender();
  });

  dom.addGroup.addEventListener('click', () => {
    if (state.selectedGroupIds.length >= MAX_GROUPS) return;
    const group = state.groups.find((candidate) => !state.selectedGroupIds.includes(Number(candidate.group_id)));
    if (!group) return;
    state.selectedGroupIds.push(Number(group.group_id));
    state.highlightedGroupId = null;
    renderGroupList();
    scheduleRender();
    dom.groupList.querySelector('.naei-group-row:last-child input')?.focus();
  });

  dom.smoothing.addEventListener('click', () => {
    state.smoothing = !state.smoothing;
    writeUrlState();
    syncViewUi();
    renderCurrentChartFromCache();
  });

  dom.copyLink.addEventListener('click', async () => {
    writeUrlState();
    try {
      await navigator.clipboard.writeText(location.href);
      const original = dom.copyLink.textContent;
      dom.copyLink.textContent = 'Link copied';
      window.setTimeout(() => { dom.copyLink.textContent = original; }, 1600);
    } catch {
      window.prompt('Copy this chart link:', location.href);
    }
  });

  dom.downloadCsv.addEventListener('click', () => {
    const csv = currentCsv();
    if (!csv) return;
    downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), exportName('csv'));
  });
  dom.downloadXlsx.addEventListener('click', () => {
    const blob = currentXlsx();
    if (blob) downloadBlob(blob, exportName('xlsx'));
  });
  dom.downloadPng.addEventListener('click', () => {
    downloadPng().catch((error) => {
      console.error(error);
      dom.chartMessage.textContent = 'The chart image could not be created.';
      dom.chartMessage.hidden = false;
    });
  });

  dom.retry.addEventListener('click', () => location.reload());
}

async function initialise() {
  parseUrlState();
  bindUi();

  try {
    const [manifest, dimensions, groupsResponse] = await Promise.all([
      fetchJson('/v1/manifest'),
      fetchJson('/v1/dimensions'),
      fetchJson('/v1/groups'),
    ]);

    state.manifest = manifest;
    state.dimensions = dimensions;
    state.groups = groupsResponse.groups || [];

    populateMetrics();
    populateYears();
    applyDefaultGroups();
    renderGroupList();
    syncViewUi();

    dom.datasetLabel.textContent = `Inventory ${manifest.inventory_year} · ${manifest.dataset_id}`;
    dom.status.hidden = true;
    dom.error.hidden = true;
    dom.app.hidden = false;
    sizeGroupCombos();
    document.fonts?.ready.then(() => {
      sizeGroupCombos();
      renderCurrentChartFromCache();
    });
    window.addEventListener('resize', () => {
      sizeGroupCombos();
      renderCurrentChartFromCache();
    });
    window.addEventListener('ukaq:sidebar-ready', renderCurrentChartFromCache);
    await renderChart();
  } catch (error) {
    showFatal(error);
  }
}

initialise();
