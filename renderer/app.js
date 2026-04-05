let shipDb = null;
let meta = null;
let previousScan = null;
let currentScan = null;
let currentScanRaw = null;  // { onGrid, offGrid, systemName }
let previousScanRaw = null;
let lastClipboard = '';
let scanHistory = [];    // saved scans from disk
let viewingIndex = -1;   // -1 = live view, 0+ = viewing saved scan
let viewMode = 'columns'; // 'columns' or 'grouped'
let gridFilter = 'both'; // 'both' | 'on' | 'off'

// DOM refs
const typeListEl = document.getElementById('typeList');
const groupListEl = document.getElementById('groupList');
const totalCountEl = document.getElementById('totalCount');
const deltaTotalEl = document.getElementById('deltaTotal');
const lastScanEl = document.getElementById('lastScan');
const btnPrev = document.getElementById('btnPrev');
const btnNext = document.getElementById('btnNext');
const btnView = document.getElementById('btnView');
const historyPosEl = document.getElementById('historyPos');
const btnScreenshot = document.getElementById('btnScreenshot');
const viewColumnsEl = document.getElementById('viewColumns');
const viewGroupedEl = document.getElementById('viewGrouped');
const systemNameEl = document.getElementById('systemName');
const btnGrid = document.getElementById('btnGrid');

// ── Init: load ship data via IPC ──

async function init() {
  shipDb = await window.dscan.getShipDb();
  meta = shipDb.__meta;
  scanHistory = await window.dscan.getScanHistory();
  updateHistoryUI();
  setInterval(pollClipboard, 750);
}

init();

// ── History Navigation ──

function updateHistoryUI() {
  const isLive = viewingIndex === -1;
  if (scanHistory.length === 0 && isLive) {
    historyPosEl.textContent = '';
  } else if (isLive) {
    historyPosEl.textContent = 'Last';
  } else {
    historyPosEl.textContent = `${viewingIndex + 1}/${scanHistory.length}`;
  }
}

function viewScan(index) {
  viewingIndex = index;
  if (index === -1) {
    // back to live
    render();
  } else {
    const saved = scanHistory[index];
    renderSaved(saved);
  }
  updateHistoryUI();
}

function savedToRaw(saved) {
  if (saved.onGrid || saved.offGrid) {
    return { onGrid: saved.onGrid || {}, offGrid: saved.offGrid || {}, systemName: saved.systemName || '' };
  }
  // Backward compat: old scans without grid data
  return { onGrid: saved.counts, offGrid: {}, systemName: saved.systemName || '' };
}

function renderSaved(saved) {
  const tmpCurrent = currentScan;
  const tmpPrevious = previousScan;
  const tmpRaw = currentScanRaw;
  const tmpPrevRaw = previousScanRaw;

  currentScanRaw = savedToRaw(saved);
  currentScan = mergeGridCounts(currentScanRaw, gridFilter);
  // Show delta against previous scan in history
  const prevIndex = viewingIndex - 1;
  if (prevIndex >= 0) {
    previousScanRaw = savedToRaw(scanHistory[prevIndex]);
    previousScan = mergeGridCounts(previousScanRaw, gridFilter);
  } else {
    previousScanRaw = null;
    previousScan = null;
  }
  lastScanEl.textContent = saved.label || new Date(saved.time).toLocaleString();
  render();
  currentScan = tmpCurrent;
  previousScan = tmpPrevious;
  currentScanRaw = tmpRaw;
  previousScanRaw = tmpPrevRaw;
}

btnPrev.addEventListener('click', () => {
  if (scanHistory.length === 0) return;
  if (viewingIndex === -1) {
    viewScan(scanHistory.length - 1);
  } else if (viewingIndex > 0) {
    viewScan(viewingIndex - 1);
  }
});

btnNext.addEventListener('click', () => {
  if (viewingIndex === -1) return;
  if (viewingIndex < scanHistory.length - 1) {
    viewScan(viewingIndex + 1);
  } else {
    viewScan(-1);
    // restore live display
    if (currentScan) {
      lastScanEl.textContent = 'Last: ' + new Date().toLocaleTimeString();
      render();
    }
  }
});

const btnPin = document.getElementById('btnPin');

btnPin.addEventListener('click', async () => {
  const isOnTop = await window.dscan.toggleOnTop();
  btnPin.classList.toggle('nav-btn-active', isOnTop);
});

btnScreenshot.addEventListener('click', () => {
  window.dscan.screenshot();
});

btnView.addEventListener('click', () => {
  viewMode = viewMode === 'columns' ? 'grouped' : 'columns';
  viewColumnsEl.style.display = viewMode === 'columns' ? '' : 'none';
  viewGroupedEl.style.display = viewMode === 'grouped' ? '' : 'none';
  render();
});

const gridLabels = { both: 'All', on: 'On', off: 'Off' };
const gridCycle = { both: 'on', on: 'off', off: 'both' };

btnGrid.addEventListener('click', () => {
  gridFilter = gridCycle[gridFilter];
  btnGrid.textContent = gridLabels[gridFilter];
  btnGrid.title = 'Grid filter: ' + gridLabels[gridFilter];
  btnGrid.classList.toggle('nav-btn-active', gridFilter !== 'both');
  // Recompute currentScan from raw data
  if (currentScanRaw) {
    currentScan = mergeGridCounts(currentScanRaw, gridFilter);
  }
  if (previousScanRaw) {
    previousScan = mergeGridCounts(previousScanRaw, gridFilter);
  }
  render();
});

// ── D-Scan Detection ──

function isDscan(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 1) return false;

  let matches = 0;
  for (const line of lines.slice(0, 10)) {
    const cols = line.split('\t');
    if (cols.length >= 4 && /^\d+$/.test(cols[0].trim())) {
      const typeName = cols[2].trim();
      if (shipDb[typeName]) {
        matches++;
        if (matches >= 1) return true;
      }
    }
  }
  return false;
}

// ── Parsing ──

function isOffGrid(distStr) {
  return distStr.trim() === '-';
}

function parseDscan(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  const onGrid = {};
  const offGrid = {};
  const systemCandidates = {};

  for (const line of lines) {
    const cols = line.split('\t');
    if (cols.length < 4) continue;
    const typeName = cols[2].trim();
    const dist = cols[3].trim();

    if (shipDb[typeName]) {
      const bucket = isOffGrid(dist) ? offGrid : onGrid;
      bucket[typeName] = (bucket[typeName] || 0) + 1;
    }

    // System name extraction from non-ship entries with " - " pattern
    if (!shipDb[typeName]) {
      const objName = cols[1].trim();
      const dashIdx = objName.indexOf(' - ');
      if (dashIdx > 0) {
        const candidate = objName.substring(0, dashIdx);
        systemCandidates[candidate] = (systemCandidates[candidate] || 0) + 1;
      }
    }
  }

  // Pick the most common system name candidate
  let systemName = '';
  let maxCount = 0;
  for (const [name, count] of Object.entries(systemCandidates)) {
    if (count > maxCount) { maxCount = count; systemName = name; }
  }

  return { onGrid, offGrid, systemName };
}

function mergeGridCounts(raw, filter) {
  if (!raw) return {};
  if (filter === 'on') return { ...raw.onGrid };
  if (filter === 'off') return { ...raw.offGrid };
  // 'both' — merge
  const merged = { ...raw.onGrid };
  for (const [k, v] of Object.entries(raw.offGrid)) {
    merged[k] = (merged[k] || 0) + v;
  }
  return merged;
}

// ── Diffing ──

function diffScans(current, previous) {
  if (!previous) return {};
  const allTypes = new Set([...Object.keys(current), ...Object.keys(previous)]);
  const deltas = {};
  for (const type of allTypes) {
    const diff = (current[type] || 0) - (previous[type] || 0);
    if (diff !== 0) deltas[type] = diff;
  }
  return deltas;
}

// ── Grouping ──

function groupScan(counts) {
  const grouped = {};

  for (const [typeName, count] of Object.entries(counts)) {
    const ship = shipDb[typeName];
    if (!ship) continue;
    const superGroup = meta.groupToSuper[ship.groupID] || 'Other';
    const groupName = meta.groups[ship.groupID];

    if (!grouped[superGroup]) grouped[superGroup] = {};
    if (!grouped[superGroup][groupName]) grouped[superGroup][groupName] = [];
    grouped[superGroup][groupName].push({ name: typeName, count });
  }

  for (const sg of Object.values(grouped)) {
    for (const [gn, ships] of Object.entries(sg)) {
      ships.sort((a, b) => b.count - a.count);
    }
  }

  return grouped;
}

// Super-group display order from ships.json metadata (sorted by avg ship mass, biggest first)
function getSuperOrder() {
  if (!shipDb || !shipDb.__meta || !shipDb.__meta.superGroupOrder) {
    return Object.keys(shipDb?.__meta?.superGroups || {});
  }
  return shipDb.__meta.superGroupOrder;
}

// ── Rendering ──

function render() {
  if (!currentScan) return;

  const minCount = 1;
  const deltas = diffScans(currentScan, previousScan);

  let totalShips = 0;
  for (const c of Object.values(currentScan)) totalShips += c;

  let prevTotal = 0;
  if (previousScan) {
    for (const c of Object.values(previousScan)) prevTotal += c;
  }

  totalCountEl.textContent = `${totalShips} ships`;
  const sysName = currentScanRaw ? currentScanRaw.systemName : '';
  systemNameEl.textContent = sysName ? `@ ${sysName}` : '';
  const totalDelta = previousScan ? totalShips - prevTotal : 0;
  if (totalDelta > 0) {
    deltaTotalEl.textContent = `+${totalDelta}`;
    deltaTotalEl.className = 'delta delta-pos';
  } else if (totalDelta < 0) {
    deltaTotalEl.textContent = `${totalDelta}`;
    deltaTotalEl.className = 'delta delta-neg';
  } else {
    deltaTotalEl.textContent = '';
    deltaTotalEl.className = 'delta';
  }

  if (viewMode === 'columns') {
    renderColumns(minCount, deltas);
  } else {
    renderGrouped(minCount, deltas);
  }
}

function renderColumns(minCount, deltas) {
  // Merge current counts with types that disappeared (delta-only, count=0)
  const merged = { ...currentScan };
  for (const typeName of Object.keys(deltas)) {
    if (!(typeName in merged)) merged[typeName] = 0;
  }
  const typeEntries = Object.entries(merged)
    .filter(([name, count]) => count >= minCount || deltas[name])
    .sort((a, b) => b[1] - a[1]);

  const groupTotals = {};
  for (const [typeName, count] of Object.entries(merged)) {
    const ship = shipDb[typeName];
    if (!ship) continue;
    const gn = meta.groups[ship.groupID];
    if (!groupTotals[gn]) groupTotals[gn] = { count: 0, delta: 0 };
    groupTotals[gn].count += count;
    groupTotals[gn].delta += (deltas[typeName] || 0);
  }
  const groupEntries = Object.entries(groupTotals)
    .filter(([, g]) => g.count >= minCount || g.delta !== 0)
    .sort((a, b) => b[1].count - a[1].count);

  let typesHtml = '';
  for (const [typeName, count] of typeEntries) {
    const ship = shipDb[typeName];
    const groupName = ship ? meta.groups[ship.groupID] : '';
    const d = deltas[typeName] || 0;
    typesHtml += `<div class="row type-row" data-group="${esc(groupName)}"><span class="row-name">${esc(typeName)}</span><span class="row-count">${count}</span><span class="row-delta">${formatDelta(d)}</span></div>`;
  }
  typeListEl.innerHTML = typesHtml || '<div class="placeholder">Copy a D-Scan to clipboard...</div>';

  let groupsHtml = '';
  for (const [groupName, g] of groupEntries) {
    groupsHtml += `<div class="row group-row" data-group="${esc(groupName)}"><span class="row-name">${esc(groupName)}</span><span class="row-count">${g.count}</span><span class="row-delta">${formatDelta(g.delta)}</span></div>`;
  }
  groupListEl.innerHTML = groupsHtml;

  attachHoverListeners();
}

function renderGrouped(minCount, deltas) {
  // Merge current counts with types that disappeared
  const merged = { ...currentScan };
  for (const typeName of Object.keys(deltas)) {
    if (!(typeName in merged)) merged[typeName] = 0;
  }
  const grouped = groupScan(merged);
  let html = '';

  for (const superName of getSuperOrder()) {
    const groups = grouped[superName];
    if (!groups) continue;

    let sgTotal = 0;
    let sgDelta = 0;
    let hasVisible = false;

    for (const ships of Object.values(groups)) {
      for (const s of ships) {
        sgTotal += s.count;
        sgDelta += (deltas[s.name] || 0);
        if (s.count >= minCount || deltas[s.name]) hasVisible = true;
      }
    }

    if (!hasVisible) continue;

    html += `<div class="super-group"><span>${superName}</span><span class="sg-count">${sgTotal} ${formatDelta(sgDelta)}</span></div>`;

    const sortedGroups = Object.entries(groups).sort((a, b) => {
      const totalA = a[1].reduce((s, x) => s + x.count, 0);
      const totalB = b[1].reduce((s, x) => s + x.count, 0);
      return totalB - totalA;
    });

    for (const [groupName, ships] of sortedGroups) {
      const filteredShips = ships.filter(s => s.count >= minCount || deltas[s.name]);
      if (filteredShips.length === 0) continue;

      if (sortedGroups.length > 1) {
        const gTotal = ships.reduce((s, x) => s + x.count, 0);
        const gDelta = ships.reduce((s, x) => s + (deltas[x.name] || 0), 0);
        html += `<div class="group-header"><span>${groupName} (${gTotal})</span><span>${formatDelta(gDelta)}</span></div>`;
      }

      for (const s of filteredShips) {
        const d = deltas[s.name] || 0;
        html += `<div class="ship-row"><span class="ship-name">${s.name}</span><span class="ship-count">${s.count}</span><span class="delta">${formatDelta(d)}</span></div>`;
      }
    }
  }

  viewGroupedEl.innerHTML = html || '<div class="placeholder">No ships found in D-Scan</div>';
}

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatDelta(d) {
  if (d > 0) return `<span class="delta-pos">+${d}</span>`;
  if (d < 0) return `<span class="delta-neg">${d}</span>`;
  return '';
}

function attachHoverListeners() {
  const allRows = document.querySelectorAll('.row[data-group]');

  for (const row of allRows) {
    row.addEventListener('mouseenter', () => {
      const group = row.dataset.group;
      for (const r of allRows) {
        r.classList.toggle('highlight', r.dataset.group === group);
      }
    });
    row.addEventListener('mouseleave', () => {
      for (const r of allRows) {
        r.classList.remove('highlight');
      }
    });
  }
}

// ── Clipboard Polling ──

async function pollClipboard() {
  try {
    const text = await window.dscan.readClipboard();
    if (text && text !== lastClipboard) {
      lastClipboard = text;
      if (isDscan(text)) {
        previousScanRaw = currentScanRaw;
        previousScan = currentScan;
        currentScanRaw = parseDscan(text);
        currentScan = mergeGridCounts(currentScanRaw, gridFilter);
        // Auto-save every scan
        const scan = {
          counts: mergeGridCounts(currentScanRaw, 'both'),
          onGrid: { ...currentScanRaw.onGrid },
          offGrid: { ...currentScanRaw.offGrid },
          systemName: currentScanRaw.systemName,
          time: Date.now(),
          label: 'Scan ' + new Date().toLocaleTimeString()
        };
        scanHistory = await window.dscan.saveScan(scan);
        if (viewingIndex === -1) {
          lastScanEl.textContent = 'Last: ' + new Date().toLocaleTimeString();
          render();
        }
        updateHistoryUI();
      }
    }
  } catch (e) {
    console.error('Clipboard error:', e);
  }
}

// ── Font Size ──

const btnFontUp = document.getElementById('btnFontUp');
const btnFontDown = document.getElementById('btnFontDown');
const MIN_FONT = 8;
const MAX_FONT = 18;
let fontSize = parseInt(localStorage.getItem('fontSize')) || 11;
document.body.style.fontSize = fontSize + 'px';

btnFontUp.addEventListener('click', () => {
  if (fontSize < MAX_FONT) {
    fontSize++;
    document.body.style.fontSize = fontSize + 'px';
    localStorage.setItem('fontSize', fontSize);
  }
});

btnFontDown.addEventListener('click', () => {
  if (fontSize > MIN_FONT) {
    fontSize--;
    document.body.style.fontSize = fontSize + 'px';
    localStorage.setItem('fontSize', fontSize);
  }
});

// ── Close Button ──

document.getElementById('btnClose').addEventListener('click', () => {
  window.dscan.closeApp();
});
