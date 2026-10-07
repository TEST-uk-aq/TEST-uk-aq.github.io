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
  groupSearch: document.getElementById('naei-group-search'),
  groupList: document.getElementById('naei-group-list'),
  clearGroups: document.getElementById('naei-clear-groups'),
  groupCount: document.getElementById('naei-group-count'),
  copyLink: document.getElementById('naei-copy-link'),
  downloadCsv: document.getElementById('naei-download-csv'),
  chart: document.getElementById('naei-chart'),
  legend: document.getElementById('naei-legend'),
  chartHeading: document.getElementById('naei-chart-heading'),
  chartSubtitle: document.getElementById('naei-chart-subtitle'),
  chartModeLabel: document.getElementById('naei-chart-mode-label'),
  chartMessage: document.getElementById('naei-chart-message'),
  datasetLabel: document.getElementById('naei-dataset-label'),
  table: document.getElementById('naei-chart-table'),
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
    .slice(0, MAX_GROUPS);
  if (groups.length) state.selectedGroupIds = groups;

  const start = Number(params.get('start'));
  const end = Number(params.get('end'));
  const year = Number(params.get('year'));
  if (Number.isInteger(start)) state.startYear = start;
  if (Number.isInteger(end)) state.endYear = end;
  if (Number.isInteger(year)) state.bubbleYear = year;
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

function populateMetrics() {
  const emissions = (state.dimensions.metrics || [])
    .filter((metric) => metric.metric_type === 'emission')
    .sort((a, b) => a.display_name.localeCompare(b.display_name, 'en-GB'));

  dom.metric.replaceChildren(...emissions.map((metric) => (
    new Option(metric.display_name, String(metric.id))
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
      .slice(0, MAX_GROUPS);
  }

  if (state.selectedGroupIds.length) return;

  if (state.view === 'bubble') {
    const preferredNames = ['Ecodesign Stove - Ready To Burn', 'Gas Boilers'];
    state.selectedGroupIds = preferredNames
      .map((name) => state.groups.find((group) => group.display_title === name)?.group_id)
      .filter(Boolean);
  }

  if (!state.selectedGroupIds.length) {
    const all = state.groups.find((group) => group.display_title === 'All');
    if (all) state.selectedGroupIds = [Number(all.group_id)];
  }
}

function renderGroupList() {
  const query = dom.groupSearch.value.trim().toLowerCase();
  const fragment = document.createDocumentFragment();

  state.groups.forEach((group) => {
    if (query && !group.display_title.toLowerCase().includes(query)) return;
    const id = Number(group.group_id);
    const label = document.createElement('label');
    label.className = 'naei-group-option';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = String(id);
    input.checked = state.selectedGroupIds.includes(id);
    input.disabled = !input.checked && state.selectedGroupIds.length >= MAX_GROUPS;
    input.addEventListener('change', () => {
      if (input.checked) {
        if (state.selectedGroupIds.length >= MAX_GROUPS) {
          input.checked = false;
          return;
        }
        state.selectedGroupIds.push(id);
      } else {
        state.selectedGroupIds = state.selectedGroupIds.filter((groupId) => groupId !== id);
      }
      state.highlightedGroupId = null;
      renderGroupList();
      scheduleRender();
    });

    const text = document.createElement('span');
    text.textContent = group.display_title;
    label.append(input, text);
    fragment.append(label);
  });

  dom.groupList.replaceChildren(fragment);
  const count = state.selectedGroupIds.length;
  dom.groupCount.textContent = `${count} selected`;
}

function syncViewUi() {
  document.querySelectorAll('.naei-view-tab').forEach((button) => {
    const active = button.dataset.view === state.view;
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
  document.querySelector('[data-for-view="line"]').hidden = state.view !== 'line';
  document.querySelector('[data-for-view="bubble"]').hidden = state.view !== 'bubble';
  dom.chartModeLabel.textContent = state.view === 'line' ? 'Line chart' : 'Bubble chart';
}

function clampYearControls(changed) {
  let start = Number(dom.startYear.value);
  let end = Number(dom.endYear.value);
  if (start >= end) {
    if (changed === 'start') end = Math.min(2024, start + 1);
    else start = Math.max(1970, end - 1);
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

function drawAxes({ xMin, xMax, yMin = 0, yMax, xTicks, yTicks, xTitle, yTitle }) {
  const width = 960;
  const height = 520;
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

function renderTable(headers, rows) {
  const thead = dom.table.tHead || dom.table.createTHead();
  const tbody = dom.table.tBodies[0] || dom.table.createTBody();
  thead.replaceChildren();
  tbody.replaceChildren();

  const headRow = document.createElement('tr');
  headers.forEach((header) => {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = header;
    headRow.append(th);
  });
  thead.append(headRow);

  rows.forEach((row) => {
    const tr = document.createElement('tr');
    row.forEach((value) => {
      const td = document.createElement('td');
      td.textContent = value;
      tr.append(td);
    });
    tbody.append(tr);
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

function drawLineChart(model) {
  dom.chart.replaceChildren();
  renderLegend(model.groups);

  const numericValues = model.series.flatMap((item) => item.values.filter(Number.isFinite));
  if (!numericValues.length) {
    dom.chartMessage.textContent = 'No reported values are available for this selection.';
    dom.chartMessage.hidden = false;
    renderTable(['Year', ...model.groups.map((g) => g.display_title)], []);
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
    yTitle: model.metric?.unit || model.metric?.display_name || 'Value',
  });

  model.series.forEach((item) => {
    const groupId = Number(item.group.group_id);
    const g = createSvgElement('g', { class: 'series-group' });
    if (state.highlightedGroupId && state.highlightedGroupId !== groupId) g.classList.add('is-subdued');

    let segment = [];
    const flushSegment = () => {
      if (segment.length < 2) {
        segment = [];
        return;
      }
      const path = createSvgElement('path', {
        class: 'series-line',
        stroke: item.colour,
        d: segment.map((point, index) => `${index ? 'L' : 'M'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' '),
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
      g.append(circle);
    });
    flushSegment();
    dom.chart.append(g);
  });

  const tableRows = model.years.map((year, index) => [
    String(year),
    ...model.series.map((item) => formatNumber(item.values[index])),
  ]);
  renderTable(['Year', ...model.groups.map((g) => g.display_title)], tableRows);
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

  return { metric, activity, groups, points };
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
    renderTable(['Group', 'Activity Data', model.metric?.display_name || 'Pollutant'], []);
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
    yTitle: model.metric?.unit || model.metric?.display_name || 'Value',
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
      'aria-label': `${point.group.display_title}: Activity Data ${formatNumber(point.x)}, ${model.metric.display_name} ${formatNumber(point.y)}`,
    });
    if (state.highlightedGroupId && state.highlightedGroupId !== groupId) circle.style.opacity = '0.18';

    const tooltipHtml = `<strong>${point.group.display_title}</strong><br>Activity Data: ${formatNumber(point.x)} ${model.activity.unit || ''}<br>${model.metric.display_name}: ${formatNumber(point.y)} ${model.metric.unit || ''}`;
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

  renderTable(
    ['Group', `Activity Data (${model.activity.unit || 'value'})`, `${model.metric.display_name} (${model.metric.unit || 'value'})`],
    model.points.map((point) => [
      point.group.display_title,
      formatNumber(point.x),
      formatNumber(point.y),
    ]),
  );
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
  dom.chartHeading.textContent = metric?.display_name || 'NAEI emissions';
  dom.chartSubtitle.textContent = state.view === 'line'
    ? `${state.startYear}–${state.endYear} · ${selectedGroups().length} group${selectedGroups().length === 1 ? '' : 's'}`
    : `${state.bubbleYear} · Activity Data vs ${metric?.display_name || 'pollutant'}`;
}

async function renderChart() {
  writeUrlState();
  syncViewUi();
  updateChartText();

  if (!state.selectedGroupIds.length) {
    dom.legend.replaceChildren();
    dom.chart.replaceChildren();
    dom.chartMessage.textContent = 'Select at least one group to draw the chart.';
    dom.chartMessage.hidden = false;
    renderTable([], []);
    lastModel = null;
    return;
  }

  const token = ++state.renderToken;
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
    state.bubbleYear,
  ]);
  return [headers, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\n');
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

  dom.groupSearch.addEventListener('input', renderGroupList);

  dom.clearGroups.addEventListener('click', () => {
    state.selectedGroupIds = [];
    state.highlightedGroupId = null;
    renderGroupList();
    scheduleRender();
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
    const metric = metricById(state.metricId);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const metricKey = String(metric?.display_name || 'naei').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    link.href = url;
    link.download = `uk-aq-naei-${state.view}-${metricKey}.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
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
    await renderChart();
  } catch (error) {
    showFatal(error);
  }
}

initialise();
