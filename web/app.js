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
// State
// =====================
let entries       = store.get('entries', []);       // [{id, clockIn, clockOut, note}]
let activeSession = store.get('session', null);     // {clockIn: ms} or null
let schedule      = store.get('schedule', defaultSchedule());
let isDark        = store.get('theme', false);
let editingId     = null;

function defaultSchedule() {
  const days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  return days.map((d, i) => ({
    day: d,
    enabled: i < 5,
    hours: 8
  }));
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
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${pad(h)}:${pad(m)}:${pad(sec)}`;
}

function formatTime(ms) {
  const d = new Date(ms);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function formatDate(ms) {
  const d = new Date(ms);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatDateInput(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

function formatTimeInput(ms) {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function startOfDay(ms) {
  const d = new Date(ms);
  d.setHours(0,0,0,0);
  return d.getTime();
}

function startOfWeek(ms) {
  const d = new Date(ms);
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day; // back to Monday
  d.setDate(d.getDate() + diff);
  d.setHours(0,0,0,0);
  return d.getTime();
}

function startOfMonth(ms) {
  const d = new Date(ms);
  d.setDate(1);
  d.setHours(0,0,0,0);
  return d.getTime();
}

function dayOfWeek(ms) {
  // Returns 0=Mon, 1=Tue, ... 6=Sun
  const d = new Date(ms).getDay(); // 0=Sun
  return d === 0 ? 6 : d - 1;
}

function totalHoursForEntries(ents) {
  return ents.reduce((acc, e) => {
    if (e.clockOut) return acc + (e.clockOut - e.clockIn);
    return acc;
  }, 0);
}

function entriesInRange(start, end) {
  return entries.filter(e => e.clockIn >= start && e.clockIn < end);
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// =====================
// Clock In / Out
// =====================
function clockIn() {
  activeSession = { clockIn: Date.now() };
  store.set('session', activeSession);
  renderTimeCard();
}

function clockOut() {
  if (!activeSession) return;
  const entry = {
    id: generateId(),
    clockIn: activeSession.clockIn,
    clockOut: Date.now(),
    note: ''
  };
  entries.unshift(entry);
  store.set('entries', entries);
  activeSession = null;
  store.set('session', null);
  renderTimeCard();
  renderOverview();
  renderTimesheets();
}

// =====================
// Live clock tick
// =====================
function tick() {
  const now = Date.now();
  const d = new Date(now);
  const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  document.getElementById('live-clock').textContent = timeStr;

  if (activeSession) {
    const elapsed = now - activeSession.clockIn;
    document.getElementById('elapsed-time').textContent = formatElapsed(elapsed);
  }

  // Update today total (includes current session if open)
  updateTodaySummary();
}

function updateTodaySummary() {
  const now = Date.now();
  const todayStart = startOfDay(now);
  const todayEntries = entriesInRange(todayStart, todayStart + 86400000);
  let total = totalHoursForEntries(todayEntries);
  if (activeSession && activeSession.clockIn >= todayStart) {
    total += now - activeSession.clockIn;
  }
  document.getElementById('today-total').textContent = formatDuration(total);
  const sessionCount = todayEntries.length + (activeSession ? 1 : 0);
  document.getElementById('today-sessions').textContent = sessionCount;
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
    statusText.textContent = 'Clocked in since ' + formatTime(activeSession.clockIn);
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

  const now = Date.now();
  const dateStr = new Date(now).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  document.getElementById('current-date-display').textContent = dateStr;
  updateTodaySummary();
}

// =====================
// Render: Overview
// =====================
function renderOverview() {
  const now = Date.now();
  const todayStart = startOfDay(now);
  const weekStart  = startOfWeek(now);
  const monthStart = startOfMonth(now);

  function totalMs(rangeEntries, includeActive) {
    let ms = totalHoursForEntries(rangeEntries);
    if (includeActive && activeSession) {
      const start = Math.max(activeSession.clockIn, rangeEntries._rangeStart || 0);
      ms += now - start;
    }
    return ms;
  }

  const todayEnts  = entriesInRange(todayStart, todayStart + 86400000);
  const weekEnts   = entriesInRange(weekStart, weekStart + 7*86400000);
  const monthEnts  = entriesInRange(monthStart, startOfMonth(now + 32*86400000));

  let todayMs = totalHoursForEntries(todayEnts);
  let weekMs  = totalHoursForEntries(weekEnts);
  let monthMs = totalHoursForEntries(monthEnts);

  if (activeSession) {
    const s = activeSession.clockIn;
    todayMs += s >= todayStart ? now - s : 0;
    weekMs  += s >= weekStart  ? now - s : 0;
    monthMs += s >= monthStart ? now - s : 0;
  }

  document.getElementById('stat-today').textContent  = formatDuration(todayMs);
  document.getElementById('stat-week').textContent   = formatDuration(weekMs);
  document.getElementById('stat-month').textContent  = formatDuration(monthMs);
  document.getElementById('stat-sessions').textContent = entries.length + (activeSession ? 1 : 0);

  // Goal sub-labels
  const todayDow = dayOfWeek(now); // 0=Mon
  const todaySched = schedule[todayDow];
  if (todaySched && todaySched.enabled) {
    const goalMs = todaySched.hours * 3600000;
    const pct = Math.min(100, Math.round(todayMs / goalMs * 100));
    document.getElementById('stat-today-goal').textContent = `${pct}% of ${todaySched.hours}h goal`;
  } else {
    document.getElementById('stat-today-goal').textContent = '';
  }

  const weekGoalMs = schedule.filter(d => d.enabled).reduce((a, d) => a + d.hours * 3600000, 0);
  if (weekGoalMs > 0) {
    const pct = Math.min(100, Math.round(weekMs / weekGoalMs * 100));
    document.getElementById('stat-week-goal').textContent = `${pct}% of ${formatDuration(weekGoalMs)} goal`;
  }

  // Week bar chart
  const weekBars = document.getElementById('week-bars');
  weekBars.innerHTML = '';
  const DAYS_SHORT = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const maxHoursDisplay = Math.max(
    ...schedule.map(d => d.enabled ? d.hours : 0),
    ...DAYS_SHORT.map((_, i) => {
      const dayStart = weekStart + i * 86400000;
      const ents = entriesInRange(dayStart, dayStart + 86400000);
      return totalHoursForEntries(ents) / 3600000;
    }),
    1
  );

  DAYS_SHORT.forEach((label, i) => {
    const dayStart = weekStart + i * 86400000;
    const ents = entriesInRange(dayStart, dayStart + 86400000);
    let hoursMs = totalHoursForEntries(ents);
    if (activeSession && activeSession.clockIn >= dayStart && activeSession.clockIn < dayStart + 86400000) {
      hoursMs += now - activeSession.clockIn;
    }
    const hours = hoursMs / 3600000;
    const goalHours = schedule[i]?.enabled ? schedule[i].hours : 0;
    const heightPct = maxHoursDisplay > 0 ? (hours / maxHoursDisplay) * 100 : 0;
    const isToday = dayOfWeek(now) === i;

    const col = document.createElement('div');
    col.className = 'week-bar-col';
    col.innerHTML = `
      <div class="week-bar-fill-wrap">
        <div class="week-bar-fill ${isToday ? 'today' : ''} ${goalHours > 0 && hours >= goalHours ? 'goal-exceeded' : ''}"
             style="height: ${Math.max(heightPct, hours > 0 ? 4 : 0)}%"></div>
      </div>
      <div class="week-bar-label">${label}</div>
      <div class="week-bar-hours">${hours > 0 ? hours.toFixed(1) + 'h' : ''}</div>`;
    weekBars.appendChild(col);
  });

  // Recent entries
  const recentList = document.getElementById('recent-list');
  recentList.innerHTML = '';
  const recent = entries.slice(0, 8);
  if (recent.length === 0) {
    recentList.innerHTML = '<p style="color:var(--text-muted); font-size:14px;">No entries yet. Clock in to get started!</p>';
  } else {
    recent.forEach(e => {
      const div = document.createElement('div');
      div.className = 'recent-entry';
      const dur = e.clockOut ? formatDuration(e.clockOut - e.clockIn) : 'In progress';
      div.innerHTML = `
        <span class="recent-entry-date">${formatDate(e.clockIn)}</span>
        <span class="recent-entry-time">${formatTime(e.clockIn)} – ${e.clockOut ? formatTime(e.clockOut) : '...'}</span>
        <span class="recent-entry-dur">${dur}</span>`;
      recentList.appendChild(div);
    });
  }
}

// =====================
// Render: Timesheets
// =====================
function renderTimesheets() {
  const period = document.getElementById('ts-filter-period').value;
  const now = Date.now();

  let rangeStart, rangeEnd;
  switch (period) {
    case 'week':
      rangeStart = startOfWeek(now);
      rangeEnd   = rangeStart + 7 * 86400000;
      break;
    case 'last-week':
      rangeEnd   = startOfWeek(now);
      rangeStart = rangeEnd - 7 * 86400000;
      break;
    case 'month':
      rangeStart = startOfMonth(now);
      rangeEnd   = startOfMonth(now + 32 * 86400000);
      break;
    case 'last-month': {
      rangeEnd   = startOfMonth(now);
      const d = new Date(rangeEnd);
      d.setMonth(d.getMonth() - 1);
      rangeStart = d.getTime();
      break;
    }
    default:
      rangeStart = 0;
      rangeEnd   = Infinity;
  }

  const filtered = entries.filter(e => e.clockIn >= rangeStart && e.clockIn < rangeEnd);

  const totalMs = totalHoursForEntries(filtered);
  document.getElementById('ts-total-hours').textContent = formatDuration(totalMs);
  document.getElementById('ts-entry-count').textContent = `${filtered.length} entr${filtered.length === 1 ? 'y' : 'ies'}`;

  const list = document.getElementById('timesheet-list');
  const empty = document.getElementById('timesheet-empty');
  list.innerHTML = '';

  if (filtered.length === 0) {
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  // Group by date
  const groups = {};
  filtered.forEach(e => {
    const key = formatDateInput(e.clockIn);
    if (!groups[key]) groups[key] = [];
    groups[key].push(e);
  });

  const sortedKeys = Object.keys(groups).sort((a, b) => b.localeCompare(a));

  sortedKeys.forEach(key => {
    const dayEntries = groups[key];
    const dayMs = totalHoursForEntries(dayEntries);
    const label = new Date(key + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

    const group = document.createElement('div');
    group.className = 'ts-group';
    group.innerHTML = `
      <div class="ts-group-header">
        <span>${label}</span>
        <span class="ts-group-header-hours">${formatDuration(dayMs)}</span>
      </div>`;

    dayEntries.sort((a, b) => b.clockIn - a.clockIn).forEach(e => {
      const row = document.createElement('div');
      row.className = 'ts-entry';
      const dur = e.clockOut ? formatDuration(e.clockOut - e.clockIn) : '<em style="color:var(--success)">In progress</em>';
      row.innerHTML = `
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

  // Bind entry action buttons
  list.querySelectorAll('.ts-btn-edit').forEach(btn => {
    btn.addEventListener('click', () => openEditModal(btn.dataset.id));
  });
  list.querySelectorAll('.ts-btn-delete').forEach(btn => {
    btn.addEventListener('click', () => deleteEntry(btn.dataset.id));
  });
}

// =====================
// Render: Schedule
// =====================
function renderSchedule() {
  const container = document.getElementById('schedule-days');
  container.innerHTML = '';

  schedule.forEach((d, i) => {
    const row = document.createElement('div');
    row.className = 'sched-day-row';
    row.innerHTML = `
      <label class="sched-day-toggle">
        <input type="checkbox" data-idx="${i}" class="sched-toggle" ${d.enabled ? 'checked' : ''} />
        <div class="toggle-track"></div>
        <div class="toggle-thumb"></div>
      </label>
      <span class="sched-day-name">${d.day}</span>
      <div class="sched-day-hours">
        <input type="number" min="0.5" max="24" step="0.5" value="${d.hours}"
               data-idx="${i}" class="sched-hours-input" ${d.enabled ? '' : 'disabled'} />
        <span>hours</span>
      </div>`;
    container.appendChild(row);
  });

  updateScheduleTotals();

  container.querySelectorAll('.sched-toggle').forEach(cb => {
    cb.addEventListener('change', () => {
      const i = +cb.dataset.idx;
      schedule[i].enabled = cb.checked;
      container.querySelectorAll('.sched-hours-input')[i].disabled = !cb.checked;
      updateScheduleTotals();
    });
  });

  container.querySelectorAll('.sched-hours-input').forEach(input => {
    input.addEventListener('input', () => {
      const i = +input.dataset.idx;
      schedule[i].hours = parseFloat(input.value) || 0;
      updateScheduleTotals();
    });
  });
}

function updateScheduleTotals() {
  const total = schedule.filter(d => d.enabled).reduce((a, d) => a + d.hours, 0);
  document.getElementById('sched-weekly-total').textContent = total + 'h';
}

// =====================
// Edit Modal
// =====================
function openEditModal(id) {
  const entry = entries.find(e => e.id === id);
  if (!entry) return;
  editingId = id;

  document.getElementById('edit-date').value     = formatDateInput(entry.clockIn);
  document.getElementById('edit-clock-in').value  = formatTimeInput(entry.clockIn);
  document.getElementById('edit-clock-out').value = entry.clockOut ? formatTimeInput(entry.clockOut) : '';
  document.getElementById('edit-note').value       = entry.note || '';

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

  const dateStr    = document.getElementById('edit-date').value;
  const inStr      = document.getElementById('edit-clock-in').value;
  const outStr     = document.getElementById('edit-clock-out').value;
  const note       = document.getElementById('edit-note').value.trim();

  if (!dateStr || !inStr) return;

  entry.clockIn  = new Date(`${dateStr}T${inStr}:00`).getTime();
  entry.clockOut = outStr ? new Date(`${dateStr}T${outStr}:00`).getTime() : null;
  entry.note     = note;

  entries.sort((a, b) => b.clockIn - a.clockIn);
  store.set('entries', entries);
  closeModal();
  renderTimesheets();
  renderOverview();
}

function deleteEntry(id) {
  if (!confirm('Delete this time entry?')) return;
  entries = entries.filter(e => e.id !== id);
  store.set('entries', entries);
  renderTimesheets();
  renderOverview();
  renderTimeCard();
}

// =====================
// Export CSV
// =====================
function exportCSV() {
  const headers = ['Date', 'Clock In', 'Clock Out', 'Duration (min)', 'Note'];
  const rows = entries
    .filter(e => e.clockOut)
    .map(e => {
      const date = new Date(e.clockIn).toLocaleDateString('en-US');
      const cin  = formatTime(e.clockIn);
      const cout = formatTime(e.clockOut);
      const mins = Math.round((e.clockOut - e.clockIn) / 60000);
      return [date, cin, cout, mins, e.note || ''].map(v => `"${v}"`).join(',');
    });

  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `tclock-export-${formatDateInput(Date.now())}.csv`;
  a.click();
  URL.revokeObjectURL(url);
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
// Tab Navigation
// =====================
function switchTab(tabId) {
  document.querySelectorAll('.nav-item').forEach(li => {
    li.classList.toggle('active', li.dataset.tab === tabId);
  });
  document.querySelectorAll('.tab-content').forEach(sec => {
    sec.classList.toggle('active', sec.id === 'tab-' + tabId);
  });
  if (tabId === 'overview')    renderOverview();
  if (tabId === 'timesheets')  renderTimesheets();
  if (tabId === 'schedule')    renderSchedule();
}

// =====================
// Init
// =====================
function init() {
  // Apply saved theme
  applyTheme(isDark);

  // Tab clicks
  document.querySelectorAll('.nav-item').forEach(li => {
    li.addEventListener('click', () => switchTab(li.dataset.tab));
  });

  // Clock button
  document.getElementById('clock-btn').addEventListener('click', () => {
    if (activeSession) clockOut();
    else clockIn();
  });

  // Timesheet filter
  document.getElementById('ts-filter-period').addEventListener('change', renderTimesheets);

  // Modal
  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  document.getElementById('modal-save').addEventListener('click', saveModal);
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('modal-overlay')) closeModal();
  });

  // Export
  document.getElementById('export-btn').addEventListener('click', exportCSV);

  // Theme toggle
  document.getElementById('theme-toggle').addEventListener('click', () => {
    isDark = !isDark;
    store.set('theme', isDark);
    applyTheme(isDark);
  });

  // Schedule save
  document.getElementById('save-schedule-btn').addEventListener('click', () => {
    store.set('schedule', schedule);
    const msg = document.getElementById('schedule-saved-msg');
    msg.classList.remove('hidden');
    setTimeout(() => msg.classList.add('hidden'), 2500);
    renderOverview();
  });

  // Initial renders
  renderTimeCard();

  // Live clock — tick immediately then every second
  tick();
  setInterval(tick, 1000);

  // Refresh overview every minute if on that tab
  setInterval(() => {
    const active = document.querySelector('.tab-content.active');
    if (active && active.id === 'tab-overview') renderOverview();
  }, 60000);
}

document.addEventListener('DOMContentLoaded', init);
