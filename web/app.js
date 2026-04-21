'use strict';

// =====================
// Storage helpers
// =====================
const store = {
  get: (key, fallback) => {
    try {
      const v = localStorage.getItem('tclock_' + key);
      return v !== null ? JSON.parse(v) : fallback;
    } catch { return fallback; }
  },
  set: (key, val) => {
    try { localStorage.setItem('tclock_' + key, JSON.stringify(val)); } catch {}
  }
};

// =====================
// Constants
// =====================
const DEFAULT_PROJECT = { id: 'default', name: 'General', color: '#3b82f6' };

const PALETTE = [
  '#3b82f6','#10b981','#f59e0b','#ef4444',
  '#8b5cf6','#ec4899','#06b6d4','#f97316',
  '#84cc16','#14b8a6'
];

// =====================
// State
// =====================
let entries        = store.get('entries', []);
let projects       = store.get('projects', [DEFAULT_PROJECT]);
let activeSession  = store.get('session', null);   // {clockIn, projectId} | null
let isDark         = store.get('theme', false);
let currentProjectId = store.get('currentProject', 'default');
let tcWindow       = 'day';    // time card window
let ovProjectId    = 'all';    // overview project filter
let editingId      = null;

// Ensure default project is always present
function ensureDefaultProject() {
  if (!projects.find(p => p.id === 'default')) {
    projects.unshift(DEFAULT_PROJECT);
    store.set('projects', projects);
  }
}

function getProjectById(id) {
  return projects.find(p => p.id === id) || DEFAULT_PROJECT;
}

function entryProject(e) {
  return getProjectById(e.projectId || 'default');
}

// =====================
// Project CRUD
// =====================
function addProject(name, color) {
  const id = 'p_' + Date.now().toString(36);
  const proj = { id, name: name.trim(), color };
  projects.push(proj);
  store.set('projects', projects);
  return proj;
}

function deleteProject(id) {
  if (id === 'default') return;
  projects = projects.filter(p => p.id !== id);
  store.set('projects', projects);
  // Reassign entries to default
  entries.forEach(e => { if ((e.projectId || 'default') === id) e.projectId = 'default'; });
  store.set('entries', entries);
  // Reset current project if it was deleted
  if (currentProjectId === id) {
    currentProjectId = 'default';
    store.set('currentProject', 'default');
  }
  if (ovProjectId === id) ovProjectId = 'all';
}

// =====================
// Utility
// =====================
function pad(n) { return String(n).padStart(2, '0'); }

function formatDuration(ms) {
  if (!ms || ms < 0) return '0h 0m';
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}h ${pad(m)}m`;
}

function formatElapsed(ms) {
  if (ms < 0) ms = 0;
  const s = Math.floor(ms / 1000);
  return `${pad(Math.floor(s/3600))}:${pad(Math.floor((s%3600)/60))}:${pad(s%60)}`;
}

function formatTime(ms) {
  return new Date(ms).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function formatDate(ms) {
  return new Date(ms).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatDateInput(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

function formatTimeInput(ms) {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function startOfDay(ms)   { const d = new Date(ms); d.setHours(0,0,0,0); return d.getTime(); }
function startOfMonth(ms) { const d = new Date(ms); d.setDate(1); d.setHours(0,0,0,0); return d.getTime(); }

function startOfWeek(ms) {
  const d = new Date(ms);
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  d.setHours(0,0,0,0);
  return d.getTime();
}

function dayOfWeek(ms) {
  const d = new Date(ms).getDay();
  return d === 0 ? 6 : d - 1; // 0=Mon … 6=Sun
}

function totalMs(ents) {
  return ents.reduce((a, e) => e.clockOut ? a + (e.clockOut - e.clockIn) : a, 0);
}

function inRange(start, end) {
  return entries.filter(e => e.clockIn >= start && e.clockIn < end);
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// =====================
// Project total for time card window
// =====================
function getProjectWindowMs(projectId, window) {
  const now = Date.now();
  let rangeStart, rangeEnd;
  switch (window) {
    case 'day':   rangeStart = startOfDay(now);   rangeEnd = rangeStart + 86400000; break;
    case 'week':  rangeStart = startOfWeek(now);  rangeEnd = rangeStart + 7*86400000; break;
    case 'month': rangeStart = startOfMonth(now); rangeEnd = startOfMonth(now + 32*86400000); break;
    default:      rangeStart = 0; rangeEnd = Infinity;
  }
  const filtered = entries.filter(e =>
    e.clockIn >= rangeStart && e.clockIn < rangeEnd &&
    (e.projectId || 'default') === projectId
  );
  let ms = totalMs(filtered);
  if (activeSession &&
      activeSession.clockIn >= rangeStart && activeSession.clockIn < rangeEnd &&
      (activeSession.projectId || 'default') === projectId) {
    ms += now - activeSession.clockIn;
  }
  return ms;
}

function getProjectSessionCount(projectId, window) {
  const now = Date.now();
  let rangeStart, rangeEnd;
  switch (window) {
    case 'day':   rangeStart = startOfDay(now);   rangeEnd = rangeStart + 86400000; break;
    case 'week':  rangeStart = startOfWeek(now);  rangeEnd = rangeStart + 7*86400000; break;
    case 'month': rangeStart = startOfMonth(now); rangeEnd = startOfMonth(now + 32*86400000); break;
    default:      rangeStart = 0; rangeEnd = Infinity;
  }
  const count = entries.filter(e =>
    e.clockIn >= rangeStart && e.clockIn < rangeEnd &&
    (e.projectId || 'default') === projectId
  ).length;
  const hasActive = activeSession &&
    activeSession.clockIn >= rangeStart && activeSession.clockIn < rangeEnd &&
    (activeSession.projectId || 'default') === projectId;
  return count + (hasActive ? 1 : 0);
}

// =====================
// Clock In / Out
// =====================
function clockIn() {
  activeSession = { clockIn: Date.now(), projectId: currentProjectId };
  store.set('session', activeSession);
  renderTimeCard();
}

function clockOut() {
  if (!activeSession) return;
  entries.unshift({
    id: generateId(),
    clockIn: activeSession.clockIn,
    clockOut: Date.now(),
    projectId: activeSession.projectId || 'default',
    note: ''
  });
  store.set('entries', entries);
  activeSession = null;
  store.set('session', null);
  renderTimeCard();
  if (document.querySelector('#tab-overview.active')) renderOverview();
  if (document.querySelector('#tab-timesheets.active')) renderTimesheets();
}

// =====================
// Live clock tick
// =====================
function tick() {
  const now = Date.now();
  document.getElementById('live-clock').textContent =
    new Date(now).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

  if (activeSession) {
    document.getElementById('elapsed-time').textContent = formatElapsed(now - activeSession.clockIn);
  }
  updateTCWindowStats();
}

function updateTCWindowStats() {
  const ms = getProjectWindowMs(currentProjectId, tcWindow);
  document.getElementById('project-window-total').textContent = formatDuration(ms);
  document.getElementById('today-sessions').textContent = getProjectSessionCount(currentProjectId, tcWindow);
}

// =====================
// Project Picker
// =====================
let pickerOpen = false;
let editingProjectId = null;

function openProjectPicker() {
  pickerOpen = true;
  document.getElementById('project-picker').classList.remove('hidden');
  document.getElementById('project-selector-btn').classList.add('open');
  document.getElementById('pp-search').value = '';
  renderPickerList('');
  document.getElementById('pp-search').focus();
}

function closeProjectPicker() {
  pickerOpen = false;
  editingProjectId = null;
  document.getElementById('project-picker').classList.add('hidden');
  document.getElementById('project-selector-btn').classList.remove('open');
  hideNewProjectForm();
}

function renderPickerList(query) {
  const ul = document.getElementById('pp-list');
  ul.innerHTML = '';
  const q = query.toLowerCase();
  projects
    .filter(p => p.name.toLowerCase().includes(q))
    .forEach(p => {
      const li = document.createElement('li');

      if (editingProjectId === p.id) {
        // Edit mode
        li.className = 'pp-item pp-item-editing';
        li.innerHTML = `
          <input type="color" class="pp-edit-color" value="${p.color}" title="Pick color" />
          <input type="text" class="pp-edit-name" value="${escHtml(p.name)}" maxlength="40" />
          <button class="pp-edit-save btn-primary btn-sm">Save</button>
          <button class="pp-edit-cancel btn-secondary btn-sm">Cancel</button>`;

        const nameInput  = li.querySelector('.pp-edit-name');
        const colorInput = li.querySelector('.pp-edit-color');

        const doSave = () => {
          const name = nameInput.value.trim();
          if (!name) { nameInput.focus(); return; }
          p.name  = name;
          p.color = colorInput.value;
          store.set('projects', projects);
          editingProjectId = null;
          renderPickerList(document.getElementById('pp-search').value);
          if (p.id === currentProjectId) {
            document.getElementById('ps-dot').style.background = p.color;
            document.getElementById('ps-name').textContent = p.name;
          }
          rebuildOverviewFilter();
          rebuildTsProjectFilter();
        };

        li.querySelector('.pp-edit-save').addEventListener('click', e => { e.stopPropagation(); doSave(); });
        li.querySelector('.pp-edit-cancel').addEventListener('click', e => {
          e.stopPropagation();
          editingProjectId = null;
          renderPickerList(document.getElementById('pp-search').value);
        });
        nameInput.addEventListener('keydown', e => {
          if (e.key === 'Enter')  { e.preventDefault(); doSave(); }
          if (e.key === 'Escape') { editingProjectId = null; renderPickerList(document.getElementById('pp-search').value); }
        });
        // Stop clicks inside edit row from bubbling to document (would close picker)
        li.addEventListener('click', e => e.stopPropagation());
        requestAnimationFrame(() => { nameInput.focus(); nameInput.select(); });

      } else {
        // Normal view
        li.className = 'pp-item' + (p.id === currentProjectId ? ' active' : '');
        li.innerHTML = `
          <span class="project-dot" style="background:${p.color}"></span>
          <span class="pp-item-name">${escHtml(p.name)}</span>
          ${p.id !== 'default' ? `
            <div class="pp-item-actions">
              <button class="pp-item-edit"   title="Rename project">✏</button>
              <button class="pp-item-delete" title="Delete project">✕</button>
            </div>` : ''}`;

        li.addEventListener('click', e => {
          if (e.target.closest('.pp-item-actions')) return;
          selectProject(p.id);
        });

        const editBtn = li.querySelector('.pp-item-edit');
        if (editBtn) {
          editBtn.addEventListener('click', e => {
            e.stopPropagation();
            editingProjectId = p.id;
            hideNewProjectForm();
            renderPickerList(document.getElementById('pp-search').value);
          });
        }

        const delBtn = li.querySelector('.pp-item-delete');
        if (delBtn) {
          delBtn.addEventListener('click', e => {
            e.stopPropagation();
            if (confirm(`Delete "${p.name}"? Its entries will move to General.`)) {
              deleteProject(p.id);
              renderPickerList(document.getElementById('pp-search').value);
              renderTimeCard();
              rebuildOverviewFilter();
              rebuildTsProjectFilter();
            }
          });
        }
      }

      ul.appendChild(li);
    });
}

function selectProject(id) {
  currentProjectId = id;
  store.set('currentProject', id);
  closeProjectPicker();
  renderTimeCard();
}

function showNewProjectForm() {
  document.getElementById('pp-new-form').classList.remove('hidden');
  document.getElementById('pp-new-trigger').classList.add('hidden');
  // Pick a color from the palette cycling by current project count
  document.getElementById('pp-new-color').value = PALETTE[projects.length % PALETTE.length];
  document.getElementById('pp-new-name').value = '';
  document.getElementById('pp-new-name').focus();
}

function hideNewProjectForm() {
  document.getElementById('pp-new-form').classList.add('hidden');
  document.getElementById('pp-new-trigger').classList.remove('hidden');
}

function confirmNewProject() {
  const name = document.getElementById('pp-new-name').value.trim();
  if (!name) return;
  const color = document.getElementById('pp-new-color').value;
  const proj = addProject(name, color);
  selectProject(proj.id);
  rebuildOverviewFilter();
  rebuildTsProjectFilter();
}

// =====================
// Render: Time Card
// =====================
function renderTimeCard() {
  const btn = document.getElementById('clock-btn');
  const statusText = document.getElementById('clock-status-text');
  const elapsedDiv = document.getElementById('elapsed-display');
  const panel = document.getElementById('clock-panel');

  if (activeSession) {
    btn.classList.add('clocked-in');
    btn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
      Clock Out`;
    const sessionProj = getProjectById(activeSession.projectId || 'default');
    statusText.textContent = `Clocked in · ${sessionProj.name} · since ${formatTime(activeSession.clockIn)}`;
    elapsedDiv.classList.remove('hidden');
    panel.classList.add('clocked-in');
  } else {
    btn.classList.remove('clocked-in');
    btn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
      Clock In`;
    statusText.textContent = 'Not clocked in';
    elapsedDiv.classList.add('hidden');
    panel.classList.remove('clocked-in');
  }

  // Update project selector button
  const proj = getProjectById(currentProjectId);
  document.getElementById('ps-dot').style.background = proj.color;
  document.getElementById('ps-name').textContent = proj.name;

  // Date display
  document.getElementById('current-date-display').textContent =
    new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  updateTCWindowStats();
}

// =====================
// Render: Overview
// =====================
function rebuildOverviewFilter() {
  const container = document.getElementById('overview-project-filter');
  container.innerHTML = '';
  [{ id: 'all', label: 'All Projects' }, ...projects.map(p => ({ id: p.id, label: p.name, color: p.color }))].forEach(item => {
    const btn = document.createElement('button');
    btn.className = 'seg-btn' + (item.id === ovProjectId ? ' active' : '');
    if (item.color) {
      btn.innerHTML = `<span class="project-dot" style="background:${item.color};margin-right:5px"></span>${escHtml(item.label)}`;
    } else {
      btn.textContent = item.label;
    }
    btn.addEventListener('click', () => {
      ovProjectId = item.id;
      container.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderOverview();
    });
    container.appendChild(btn);
  });
}

function renderOverview() {
  rebuildOverviewFilter();
  const now = Date.now();
  const todayStart = startOfDay(now);
  const weekStart  = startOfWeek(now);
  const monthStart = startOfMonth(now);

  function filteredEntries(ents) {
    if (ovProjectId === 'all') return ents;
    return ents.filter(e => (e.projectId || 'default') === ovProjectId);
  }

  function sessionMs(rangeStart, rangeEnd) {
    if (!activeSession) return 0;
    if (activeSession.clockIn < rangeStart || activeSession.clockIn >= rangeEnd) return 0;
    if (ovProjectId !== 'all' && (activeSession.projectId || 'default') !== ovProjectId) return 0;
    return now - activeSession.clockIn;
  }

  const todayEnts  = filteredEntries(inRange(todayStart, todayStart + 86400000));
  const weekEnts   = filteredEntries(inRange(weekStart, weekStart + 7*86400000));
  const monthEnts  = filteredEntries(inRange(monthStart, startOfMonth(now + 32*86400000)));

  const todayMs  = totalMs(todayEnts)  + sessionMs(todayStart, todayStart + 86400000);
  const weekMs   = totalMs(weekEnts)   + sessionMs(weekStart, weekStart + 7*86400000);
  const monthMs  = totalMs(monthEnts)  + sessionMs(monthStart, startOfMonth(now + 32*86400000));

  const allFiltered = filteredEntries(entries);
  const sessionCount = allFiltered.length + (activeSession && (ovProjectId === 'all' || (activeSession.projectId||'default') === ovProjectId) ? 1 : 0);

  document.getElementById('stat-today').textContent    = formatDuration(todayMs);
  document.getElementById('stat-week').textContent     = formatDuration(weekMs);
  document.getElementById('stat-month').textContent    = formatDuration(monthMs);
  document.getElementById('stat-sessions').textContent = sessionCount;

  // Week bar chart
  const weekBars = document.getElementById('week-bars');
  weekBars.innerHTML = '';
  const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const weekHours = DAYS.map((_, i) => {
    const ds = weekStart + i * 86400000;
    const de = ds + 86400000;
    const ents = filteredEntries(inRange(ds, de));
    let ms = totalMs(ents);
    if (activeSession && activeSession.clockIn >= ds && activeSession.clockIn < de) {
      if (ovProjectId === 'all' || (activeSession.projectId||'default') === ovProjectId) {
        ms += now - activeSession.clockIn;
      }
    }
    return ms / 3600000;
  });
  const maxH = Math.max(...weekHours, 1);

  DAYS.forEach((label, i) => {
    const hours = weekHours[i];
    const isToday = dayOfWeek(now) === i;
    const col = document.createElement('div');
    col.className = 'week-bar-col';
    col.innerHTML = `
      <div class="week-bar-fill-wrap">
        <div class="week-bar-fill ${isToday ? 'today' : ''}"
             style="height:${Math.max((hours/maxH)*100, hours > 0 ? 3 : 0)}%"></div>
      </div>
      <div class="week-bar-label">${label}</div>
      <div class="week-bar-hours">${hours > 0 ? hours.toFixed(1)+'h' : ''}</div>`;
    weekBars.appendChild(col);
  });

  // Top Projects chart
  const chart = document.getElementById('projects-bar-chart');
  chart.innerHTML = '';
  const projTotals = projects.map(p => {
    const ents = entries.filter(e => (e.projectId||'default') === p.id);
    let ms = totalMs(ents);
    if (activeSession && (activeSession.projectId||'default') === p.id) ms += now - activeSession.clockIn;
    return { proj: p, ms };
  }).filter(x => x.ms > 0).sort((a, b) => b.ms - a.ms);

  if (projTotals.length === 0) {
    chart.innerHTML = '<p style="color:var(--text-muted);font-size:14px">No data yet.</p>';
  } else {
    const maxMs = projTotals[0].ms;
    projTotals.forEach(({ proj, ms }) => {
      const row = document.createElement('div');
      row.className = 'proj-bar-row';
      row.innerHTML = `
        <div class="proj-bar-name">
          <span class="project-dot project-dot-lg" style="background:${proj.color}"></span>
          <span>${escHtml(proj.name)}</span>
        </div>
        <div class="proj-bar-track">
          <div class="proj-bar-fill" style="width:${(ms/maxMs)*100}%;background:${proj.color}"></div>
        </div>
        <div class="proj-bar-dur">${formatDuration(ms)}</div>`;
      chart.appendChild(row);
    });
  }

  // Recent entries
  const recentList = document.getElementById('recent-list');
  recentList.innerHTML = '';
  const recent = filteredEntries(entries).slice(0, 8);
  if (recent.length === 0) {
    recentList.innerHTML = '<p style="color:var(--text-muted);font-size:14px">No entries yet. Clock in to get started!</p>';
  } else {
    recent.forEach(e => {
      const proj = entryProject(e);
      const dur = e.clockOut ? formatDuration(e.clockOut - e.clockIn) : 'In progress';
      const div = document.createElement('div');
      div.className = 'recent-entry';
      div.innerHTML = `
        <span class="recent-entry-project">
          <span class="project-dot" style="background:${proj.color}"></span>
          <span>${escHtml(proj.name)} · ${formatDate(e.clockIn)}</span>
        </span>
        <span class="recent-entry-time">${formatTime(e.clockIn)} – ${e.clockOut ? formatTime(e.clockOut) : '…'}</span>
        <span class="recent-entry-dur">${dur}</span>`;
      recentList.appendChild(div);
    });
  }
}

// =====================
// Render: Timesheets
// =====================
function rebuildTsProjectFilter() {
  const sel = document.getElementById('ts-filter-project');
  const prev = sel.value;
  sel.innerHTML = '<option value="all">All Projects</option>';
  projects.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name;
    sel.appendChild(opt);
  });
  sel.value = prev || 'all';
}

function renderTimesheets() {
  rebuildTsProjectFilter();
  const period   = document.getElementById('ts-filter-period').value;
  const minDurMs = parseInt(document.getElementById('ts-filter-duration').value, 10) * 60000;
  const projFilter = document.getElementById('ts-filter-project').value;
  const now = Date.now();

  let rangeStart, rangeEnd;
  switch (period) {
    case 'week':      rangeStart = startOfWeek(now);  rangeEnd = rangeStart + 7*86400000; break;
    case 'last-week': rangeEnd   = startOfWeek(now);  rangeStart = rangeEnd - 7*86400000; break;
    case 'month':     rangeStart = startOfMonth(now); rangeEnd = startOfMonth(now + 32*86400000); break;
    case 'last-month': {
      rangeEnd = startOfMonth(now);
      const d = new Date(rangeEnd); d.setMonth(d.getMonth()-1);
      rangeStart = d.getTime(); break;
    }
    default: rangeStart = 0; rangeEnd = Infinity;
  }

  let filtered = entries.filter(e => e.clockIn >= rangeStart && e.clockIn < rangeEnd);
  if (minDurMs > 0) filtered = filtered.filter(e => e.clockOut && (e.clockOut - e.clockIn) >= minDurMs);
  if (projFilter !== 'all') filtered = filtered.filter(e => (e.projectId||'default') === projFilter);

  document.getElementById('ts-total-hours').textContent = formatDuration(totalMs(filtered));
  document.getElementById('ts-entry-count').textContent = `${filtered.length} entr${filtered.length === 1 ? 'y' : 'ies'}`;

  const list  = document.getElementById('timesheet-list');
  const empty = document.getElementById('timesheet-empty');
  list.innerHTML = '';

  if (filtered.length === 0) { empty.classList.remove('hidden'); return; }
  empty.classList.add('hidden');

  // Group by date
  const groups = {};
  filtered.forEach(e => {
    const key = formatDateInput(e.clockIn);
    if (!groups[key]) groups[key] = [];
    groups[key].push(e);
  });

  Object.keys(groups).sort((a, b) => b.localeCompare(a)).forEach(key => {
    const dayEnts = groups[key];
    const label = new Date(key + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    const group = document.createElement('div');
    group.className = 'ts-group';
    group.innerHTML = `
      <div class="ts-group-header">
        <span>${label}</span>
        <span class="ts-group-header-hours">${formatDuration(totalMs(dayEnts))}</span>
      </div>`;

    dayEnts.sort((a, b) => b.clockIn - a.clockIn).forEach(e => {
      const proj = entryProject(e);
      const dur = e.clockOut
        ? formatDuration(e.clockOut - e.clockIn)
        : '<em style="color:var(--success)">In progress</em>';
      const row = document.createElement('div');
      row.className = 'ts-entry';
      row.innerHTML = `
        <span class="project-dot ts-entry-project-dot" style="background:${proj.color}" title="${escHtml(proj.name)}"></span>
        <span class="ts-entry-time">${formatTime(e.clockIn)}</span>
        <span class="ts-entry-time">${e.clockOut ? formatTime(e.clockOut) : '–'}</span>
        <span class="ts-entry-dur">${dur}</span>
        <div class="ts-entry-actions">
          <button class="ts-btn ts-btn-edit" data-id="${e.id}">Edit</button>
          <button class="ts-btn ts-btn-delete" data-id="${e.id}">Delete</button>
        </div>`;
      group.appendChild(row);
    });
    list.appendChild(group);
  });

  list.querySelectorAll('.ts-btn-edit').forEach(btn => btn.addEventListener('click', () => openEditModal(btn.dataset.id)));
  list.querySelectorAll('.ts-btn-delete').forEach(btn => btn.addEventListener('click', () => deleteEntry(btn.dataset.id)));
}

// =====================
// Edit Modal
// =====================
function openEditModal(id) {
  const entry = entries.find(e => e.id === id);
  if (!entry) return;
  editingId = id;

  // Populate project select
  const sel = document.getElementById('edit-project');
  sel.innerHTML = '';
  projects.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name;
    sel.appendChild(opt);
  });
  sel.value = entry.projectId || 'default';

  document.getElementById('edit-date').value      = formatDateInput(entry.clockIn);
  document.getElementById('edit-clock-in').value  = formatTimeInput(entry.clockIn);
  document.getElementById('edit-clock-out').value = entry.clockOut ? formatTimeInput(entry.clockOut) : '';
  document.getElementById('edit-note').value      = entry.note || '';
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  editingId = null;
}

function saveModal() {
  if (!editingId) return;
  const entry = entries.find(e => e.id === editingId);
  if (!entry) return;

  const dateStr = document.getElementById('edit-date').value;
  const inStr   = document.getElementById('edit-clock-in').value;
  const outStr  = document.getElementById('edit-clock-out').value;

  if (!dateStr || !inStr) return;

  entry.projectId = document.getElementById('edit-project').value;
  entry.clockIn   = new Date(`${dateStr}T${inStr}:00`).getTime();
  entry.clockOut  = outStr ? new Date(`${dateStr}T${outStr}:00`).getTime() : null;
  entry.note      = document.getElementById('edit-note').value.trim();

  entries.sort((a, b) => b.clockIn - a.clockIn);
  store.set('entries', entries);
  closeModal();
  renderTimesheets();
  if (document.querySelector('#tab-overview.active')) renderOverview();
}

function deleteEntry(id) {
  if (!confirm('Delete this time entry?')) return;
  entries = entries.filter(e => e.id !== id);
  store.set('entries', entries);
  renderTimesheets();
  renderTimeCard();
}

// =====================
// Backup / Restore JSON
// =====================
function backupData() {
  const payload = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), entries, projects }, null, 2);
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([payload], { type: 'application/json' })),
    download: `tclock-backup-${formatDateInput(Date.now())}.json`
  });
  a.click();
  URL.revokeObjectURL(a.href);
}

function restoreData(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      if (!Array.isArray(data.entries) || !Array.isArray(data.projects)) {
        alert('Invalid backup file — please choose a Tclock backup (.json).');
        return;
      }
      if (!confirm(`This will replace all current data with the backup from ${new Date(data.exportedAt).toLocaleDateString()}.\n\nContinue?`)) return;

      entries  = data.entries;
      projects = data.projects;
      ensureDefaultProject();
      if (!projects.find(p => p.id === currentProjectId)) currentProjectId = 'default';

      store.set('entries',  entries);
      store.set('projects', projects);
      store.set('currentProject', currentProjectId);

      renderTimeCard();
      rebuildOverviewFilter();
      rebuildTsProjectFilter();
      if (document.querySelector('#tab-overview.active'))   renderOverview();
      if (document.querySelector('#tab-timesheets.active')) renderTimesheets();
      alert('Data restored successfully!');
    } catch {
      alert('Could not read the file — make sure it\'s a valid Tclock backup.');
    }
  };
  reader.readAsText(file);
}

// =====================
// Export CSV
// =====================
function exportCSV() {
  const rows = entries
    .filter(e => e.clockOut)
    .map(e => {
      const proj = entryProject(e);
      return [
        new Date(e.clockIn).toLocaleDateString('en-US'),
        proj.name,
        formatTime(e.clockIn),
        formatTime(e.clockOut),
        Math.round((e.clockOut - e.clockIn) / 60000),
        e.note || ''
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
    });

  const csv = ['Date,Project,Clock In,Clock Out,Duration (min),Note', ...rows].join('\n');
  const a   = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })),
    download: `tclock-${formatDateInput(Date.now())}.csv`
  });
  a.click();
  URL.revokeObjectURL(a.href);
}

// =====================
// Theme
// =====================
function applyTheme(dark) {
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : '');
  document.getElementById('theme-icon-sun').style.display  = dark ? 'none' : '';
  document.getElementById('theme-icon-moon').style.display = dark ? '' : 'none';
  document.getElementById('theme-label').textContent = dark ? 'Light Mode' : 'Dark Mode';
}

// =====================
// Escape HTML
// =====================
function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// =====================
// Tab Navigation
// =====================
function switchTab(tabId) {
  document.querySelectorAll('.nav-item').forEach(li => li.classList.toggle('active', li.dataset.tab === tabId));
  document.querySelectorAll('.tab-content').forEach(s => s.classList.toggle('active', s.id === 'tab-' + tabId));
  if (tabId === 'overview')   renderOverview();
  if (tabId === 'timesheets') renderTimesheets();
}

// =====================
// Init
// =====================
function init() {
  ensureDefaultProject();

  // Validate currentProjectId still exists
  if (!projects.find(p => p.id === currentProjectId)) {
    currentProjectId = 'default';
    store.set('currentProject', 'default');
  }

  applyTheme(isDark);

  // Tab nav
  document.querySelectorAll('.nav-item').forEach(li => li.addEventListener('click', () => switchTab(li.dataset.tab)));

  // Clock button
  document.getElementById('clock-btn').addEventListener('click', () => activeSession ? clockOut() : clockIn());

  // Time card window segmented control
  document.getElementById('tc-window-control').addEventListener('click', e => {
    const btn = e.target.closest('.seg-btn');
    if (!btn) return;
    tcWindow = btn.dataset.window;
    document.querySelectorAll('#tc-window-control .seg-btn').forEach(b => b.classList.toggle('active', b === btn));
    updateTCWindowStats();
  });

  // Project selector
  const selectorBtn = document.getElementById('project-selector-btn');
  selectorBtn.addEventListener('click', e => {
    e.stopPropagation();
    pickerOpen ? closeProjectPicker() : openProjectPicker();
  });

  document.getElementById('project-picker').addEventListener('click', e => e.stopPropagation());

  document.addEventListener('click', () => { if (pickerOpen) closeProjectPicker(); });

  document.getElementById('pp-search').addEventListener('input', e => renderPickerList(e.target.value));

  document.getElementById('pp-new-trigger').addEventListener('click', e => { e.stopPropagation(); showNewProjectForm(); });
  document.getElementById('pp-new-confirm').addEventListener('click', e => { e.stopPropagation(); confirmNewProject(); });
  document.getElementById('pp-new-cancel').addEventListener('click',  e => { e.stopPropagation(); hideNewProjectForm(); });
  document.getElementById('pp-new-name').addEventListener('keydown', e => { if (e.key === 'Enter') confirmNewProject(); if (e.key === 'Escape') hideNewProjectForm(); });

  // Timesheets filters
  document.getElementById('ts-filter-period').addEventListener('change', renderTimesheets);
  document.getElementById('ts-filter-duration').addEventListener('change', renderTimesheets);
  document.getElementById('ts-filter-project').addEventListener('change', renderTimesheets);

  // Modal
  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  document.getElementById('modal-save').addEventListener('click', saveModal);
  document.getElementById('modal-overlay').addEventListener('click', e => { if (e.target.id === 'modal-overlay') closeModal(); });

  // Backup / Restore
  document.getElementById('backup-btn').addEventListener('click', backupData);
  document.getElementById('restore-btn').addEventListener('click', () => document.getElementById('restore-file-input').click());
  document.getElementById('restore-file-input').addEventListener('change', e => {
    if (e.target.files[0]) { restoreData(e.target.files[0]); e.target.value = ''; }
  });

  // Export / Theme
  document.getElementById('export-btn').addEventListener('click', exportCSV);
  document.getElementById('theme-toggle').addEventListener('click', () => {
    isDark = !isDark;
    store.set('theme', isDark);
    applyTheme(isDark);
  });

  // Initial render
  renderTimeCard();
  tick();
  setInterval(tick, 1000);

  setInterval(() => {
    const active = document.querySelector('.tab-content.active');
    if (active?.id === 'tab-overview') renderOverview();
  }, 60000);
}

document.addEventListener('DOMContentLoaded', init);
