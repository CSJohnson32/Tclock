import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  onAuthStateChanged, signOut
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import {
  initializeFirestore, persistentLocalCache,
  collection, doc, onSnapshot, setDoc, deleteDoc, writeBatch
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// =====================
// Firebase Setup
// =====================
const firebaseConfig = {
  apiKey: "AIzaSyDilfuNR2-wMRUzNd2mkp2efXErlqzZ0G8",
  authDomain: "tclock-a199a.firebaseapp.com",
  projectId: "tclock-a199a",
  storageBucket: "tclock-a199a.firebasestorage.app",
  messagingSenderId: "1060722054462",
  appId: "1:1060722054462:web:52a7caf0d252832b3b086f"
};
const firebaseApp = initializeApp(firebaseConfig);
const auth        = getAuth(firebaseApp);
const db          = initializeFirestore(firebaseApp, { localCache: persistentLocalCache({}) });

// =====================
// Constants
// =====================
const DEFAULT_PROJECT = { id: 'default', name: 'General', color: '#3b82f6' };

const DEFAULT_TASKS = [
  { id: 't85c', code: '85C', name: 'Preconstruction Activities' },
  { id: 't87c', code: '87C', name: 'Construction Engineering Management' },
  { id: 't89c', code: '89C', name: 'Project Administration' },
  { id: 't91c', code: '91C', name: 'Field Inspection' },
  { id: 't93c', code: '93C', name: 'Materials Testing' },
  { id: 't95c', code: '95C', name: 'Public Involvement' },
  { id: 't97c', code: '97C', name: 'QC/QA Control' },
  { id: 't99c', code: '99C', name: 'Construction Closeout' }
];

const PALETTE = [
  '#3b82f6','#10b981','#f59e0b','#ef4444',
  '#8b5cf6','#ec4899','#06b6d4','#f97316',
  '#84cc16','#14b8a6'
];

// =====================
// State
// =====================
let entries          = [];
let projects         = [DEFAULT_PROJECT];
let activeSession    = null;
let isDark           = false;
let currentProjectId = 'default';
let tcWindow         = 'day';
let ovProjectId      = 'all';
let editingId        = null;
let tasks            = [...DEFAULT_TASKS];
let currentTaskId    = '';
let currentUser      = null;
let unsubscribers    = [];
let authMode         = 'signin';
let pendingSwitchProjectId = null;

// =====================
// Firestore Refs
// =====================
const entriesCol  = () => collection(db, 'users', currentUser.uid, 'entries');
const projectsCol = () => collection(db, 'users', currentUser.uid, 'projects');
const tasksCol    = () => collection(db, 'users', currentUser.uid, 'tasks');
const entryRef    = id => doc(db, 'users', currentUser.uid, 'entries', id);
const projectRef  = id => doc(db, 'users', currentUser.uid, 'projects', id);
const taskRef     = id => doc(db, 'users', currentUser.uid, 'tasks', id);
const sessionRef  = () => doc(db, 'users', currentUser.uid, 'meta', 'session');

// =====================
// Firestore Listeners
// =====================
function setupListeners() {
  const unsubE = onSnapshot(entriesCol(), snap => {
    entries = snap.docs.map(d => d.data());
    entries.sort((a, b) => b.clockIn - a.clockIn);
    renderTimeCard();
    const active = document.querySelector('.tab-content.active');
    if (active?.id === 'tab-overview')   renderOverview();
    if (active?.id === 'tab-timesheets') { renderDailySummary(); renderTimesheets(); }
  });

  const unsubP = onSnapshot(projectsCol(), snap => {
    const custom = snap.docs.map(d => d.data());
    projects = [DEFAULT_PROJECT, ...custom.sort((a, b) => a.name.localeCompare(b.name))];
    renderTimeCard();
    rebuildOverviewFilter();
    rebuildTsProjectFilter();
    const active = document.querySelector('.tab-content.active');
    if (active?.id === 'tab-overview')   renderOverview();
    if (active?.id === 'tab-timesheets') { renderDailySummary(); renderTimesheets(); }
  });

  const unsubT = onSnapshot(tasksCol(), snap => {
    if (snap.empty) return;
    tasks = snap.docs.map(d => d.data()).sort((a, b) => a.code.localeCompare(b.code));
    rebuildTaskSelector();
    const active = document.querySelector('.tab-content.active');
    if (active?.id === 'tab-projects') renderProjects();
  });

  const unsubS = onSnapshot(sessionRef(), snap => {
    activeSession = snap.exists() ? snap.data() : null;
    renderTimeCard();
  });

  unsubscribers = [unsubE, unsubP, unsubT, unsubS];
}

function teardownListeners() {
  unsubscribers.forEach(fn => fn());
  unsubscribers = [];
  entries = [];
  projects = [DEFAULT_PROJECT];
  tasks = [...DEFAULT_TASKS];
  activeSession = null;
}

// =====================
// Task helpers
// =====================
function getTaskById(id) { return tasks.find(t => t.id === id) || null; }
function getTaskLabel(task) { return task ? `${task.code} — ${task.name}` : '—'; }

// =====================
// Task CRUD
// =====================
async function addTask(code, name) {
  const id = 't_' + Date.now().toString(36);
  await setDoc(taskRef(id), { id, code: code.trim().toUpperCase(), name: name.trim() });
}

async function deleteTask(id) {
  await deleteDoc(taskRef(id));
  if (currentTaskId === id) { currentTaskId = ''; rebuildTaskSelector(); }
}

async function updateTask(id, code, name) {
  const t = getTaskById(id);
  if (t) await setDoc(taskRef(id), { ...t, code: code.trim().toUpperCase(), name: name.trim() });
}

async function setupDefaultTasks() {
  const batch = writeBatch(db);
  DEFAULT_TASKS.forEach(t => batch.set(taskRef(t.id), t));
  await batch.commit();
}

// =====================
// localStorage data migration (runs once per user)
// =====================
async function migrateLocalStorage() {
  const key = 'tclock_migrated_' + currentUser.uid;
  if (localStorage.getItem(key)) return;
  const parse = k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
  const lsE = parse('tclock_entries');
  const lsP = parse('tclock_projects');
  try {
    const batch = writeBatch(db);
    (lsE || []).forEach(e => { if (e?.id) batch.set(entryRef(e.id), e); });
    (lsP || []).filter(p => p?.id && p.id !== 'default').forEach(p => batch.set(projectRef(p.id), p));
    await batch.commit();
    await setupDefaultTasks();
    localStorage.setItem(key, '1');
  } catch (err) { console.error('Migration error:', err); }
}

// Ensure default project is always present
function ensureDefaultProject() {
  if (!projects.find(p => p.id === 'default')) projects.unshift(DEFAULT_PROJECT);
}

function getProjectById(id) {
  return projects.find(p => p.id === id) || DEFAULT_PROJECT;
}

function getProjectLabel(proj) {
  if (!proj) return 'General';
  return proj.number ? `${proj.number} — ${proj.name}` : proj.name;
}

function entryProject(e) {
  return getProjectById(e.projectId || 'default');
}

// =====================
// Project CRUD
// =====================
async function addProject(number, name, color) {
  const id = 'p_' + Date.now().toString(36);
  const proj = { id, number: number.trim(), name: name.trim(), color };
  await setDoc(projectRef(id), proj);
  return proj;
}

async function deleteProject(id) {
  if (id === 'default') return;
  const batch = writeBatch(db);
  batch.delete(projectRef(id));
  entries.filter(e => (e.projectId || 'default') === id)
         .forEach(e => batch.set(entryRef(e.id), { ...e, projectId: 'default' }));
  await batch.commit();
  if (currentProjectId === id) {
    currentProjectId = 'default';
    localStorage.setItem('tclock_currentProject', 'default');
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
async function clockIn() {
  await setDoc(sessionRef(), { clockIn: Date.now(), projectId: currentProjectId, taskId: currentTaskId });
}

function getSessionNote() {
  return (document.getElementById('session-note')?.value || '').trim();
}

function highlightNoteField() {
  const f = document.getElementById('session-note');
  if (!f) return;
  f.focus();
  f.classList.add('field-error');
  setTimeout(() => f.classList.remove('field-error'), 2000);
}

async function clockOut(noteOverride) {
  if (!activeSession) return;
  const note = noteOverride !== undefined ? noteOverride : getSessionNote();
  if (!note) { highlightNoteField(); return; }
  const entry = {
    id: generateId(),
    clockIn: activeSession.clockIn,
    clockOut: Date.now(),
    projectId: activeSession.projectId || 'default',
    taskId: activeSession.taskId || '',
    note
  };
  const batch = writeBatch(db);
  batch.set(entryRef(entry.id), entry);
  batch.delete(sessionRef());
  await batch.commit();
  const f = document.getElementById('session-note');
  if (f) f.value = '';
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
// Task Selector
// =====================
function rebuildTaskSelector() {
  const sel = document.getElementById('task-selector');
  if (!sel) return;
  const prev = sel.value;
  sel.innerHTML = '<option value="">— Select Task —</option>';
  tasks.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = `${t.code} — ${t.name}`;
    sel.appendChild(opt);
  });
  sel.value = tasks.find(t => t.id === prev) ? prev : (tasks.find(t => t.id === currentTaskId) ? currentTaskId : '');
  currentTaskId = sel.value;
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

        const doSave = async () => {
          const name = nameInput.value.trim();
          if (!name) { nameInput.focus(); return; }
          editingProjectId = null;
          renderPickerList(document.getElementById('pp-search').value);
          if (p.id !== 'default') {
            await setDoc(projectRef(p.id), { ...p, name, color: colorInput.value });
          }
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
          <span class="pp-item-name">${escHtml(getProjectLabel(p))}</span>
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
          delBtn.addEventListener('click', async e => {
            e.stopPropagation();
            if (confirm(`Delete "${p.name}"? Its entries will move to General.`)) {
              await deleteProject(p.id);
            }
          });
        }
      }

      ul.appendChild(li);
    });
}

function selectProject(id) {
  closeProjectPicker();
  if (activeSession && (activeSession.projectId || 'default') !== id) {
    const note = getSessionNote();
    if (!note) { highlightNoteField(); return; }
    pendingSwitchProjectId = id;
    showSwitchDialog(id);
    return;
  }
  currentProjectId = id;
  localStorage.setItem('tclock_currentProject', id);
  renderTimeCard();
}

function showSwitchDialog(newProjectId) {
  const from = getProjectById(activeSession?.projectId || 'default');
  const to   = getProjectById(newProjectId);
  document.getElementById('switch-from-name').textContent = from.name;
  document.getElementById('switch-to-name').textContent   = to.name;
  document.getElementById('switch-modal-overlay').classList.remove('hidden');
}

function closeSwitchDialog() {
  document.getElementById('switch-modal-overlay').classList.add('hidden');
  pendingSwitchProjectId = null;
}

async function confirmSwitchProject() {
  const note = getSessionNote();
  const entry = {
    id: generateId(),
    clockIn: activeSession.clockIn,
    clockOut: Date.now(),
    projectId: activeSession.projectId || 'default',
    taskId: activeSession.taskId || '',
    note
  };
  const newSession = { clockIn: Date.now(), projectId: pendingSwitchProjectId, taskId: currentTaskId };
  const batch = writeBatch(db);
  batch.set(entryRef(entry.id), entry);
  batch.set(sessionRef(), newSession);
  await batch.commit();
  currentProjectId = pendingSwitchProjectId;
  localStorage.setItem('tclock_currentProject', pendingSwitchProjectId);
  closeSwitchDialog();
  const f = document.getElementById('session-note');
  if (f) f.value = '';
}

async function switchDialogClockOut() {
  const note = getSessionNote();
  const entry = {
    id: generateId(),
    clockIn: activeSession.clockIn,
    clockOut: Date.now(),
    projectId: activeSession.projectId || 'default',
    taskId: activeSession.taskId || '',
    note
  };
  const batch = writeBatch(db);
  batch.set(entryRef(entry.id), entry);
  batch.delete(sessionRef());
  await batch.commit();
  currentProjectId = pendingSwitchProjectId;
  localStorage.setItem('tclock_currentProject', pendingSwitchProjectId);
  closeSwitchDialog();
  const f = document.getElementById('session-note');
  if (f) f.value = '';
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

async function confirmNewProject() {
  const name   = document.getElementById('pp-new-name').value.trim();
  const number = document.getElementById('pp-new-number').value.trim();
  if (!name) return;
  const color = document.getElementById('pp-new-color').value;
  const proj = await addProject(number, name, color);
  selectProject(proj.id);
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
    const sessionTask = getTaskById(activeSession.taskId || '');
    const taskPart = sessionTask ? ` · ${sessionTask.code}` : '';
    statusText.textContent = `Clocked in · ${sessionProj.name}${taskPart} · since ${formatTime(activeSession.clockIn)}`;
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

  // Show/hide session note field
  const noteWrap = document.getElementById('session-note-wrap');
  if (noteWrap) noteWrap.classList.toggle('hidden', !activeSession);

  // Update project selector button
  const proj = getProjectById(currentProjectId);
  document.getElementById('ps-dot').style.background = proj.color;
  document.getElementById('ps-name').textContent = getProjectLabel(proj);

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
      const entTask = getTaskById(e.taskId || '');
      row.innerHTML = `
        <span class="ts-entry-project">
          <span class="project-dot" style="background:${proj.color}"></span>
          <span class="ts-entry-project-name">${escHtml(getProjectLabel(proj))}${entTask ? ' · ' + escHtml(entTask.code) : ''}</span>
        </span>
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
    opt.textContent = getProjectLabel(p);
    sel.appendChild(opt);
  });
  sel.value = entry.projectId || 'default';

  // Populate task select
  const tsel = document.getElementById('edit-task');
  tsel.innerHTML = '<option value="">— No Task —</option>';
  tasks.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = `${t.code} — ${t.name}`;
    tsel.appendChild(opt);
  });
  tsel.value = entry.taskId || '';

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

async function saveModal() {
  if (!editingId) return;
  const entry = entries.find(e => e.id === editingId);
  if (!entry) return;
  const dateStr = document.getElementById('edit-date').value;
  const inStr   = document.getElementById('edit-clock-in').value;
  const outStr  = document.getElementById('edit-clock-out').value;
  if (!dateStr || !inStr) return;
  const updated = {
    ...entry,
    projectId: document.getElementById('edit-project').value,
    taskId:    document.getElementById('edit-task').value,
    clockIn:   new Date(`${dateStr}T${inStr}:00`).getTime(),
    clockOut:  outStr ? new Date(`${dateStr}T${outStr}:00`).getTime() : null,
    note:      document.getElementById('edit-note').value.trim()
  };
  await setDoc(entryRef(editingId), updated);
  closeModal();
}

async function deleteEntry(id) {
  if (!confirm('Delete this time entry?')) return;
  await deleteDoc(entryRef(id));
}

// =====================
// Daily Summary
// =====================
let dailySummaryDate = formatDateInput(Date.now());

function roundToQuarterMs(ms) {
  const q = 15 * 60000;
  return Math.round(ms / q) * q;
}

function formatDecimalHours(ms) {
  return (ms / 3600000).toFixed(2) + 'h';
}

function getDaySummaryRows(dateStr) {
  const dayStart = new Date(dateStr + 'T00:00:00').getTime();
  const dayEnd   = dayStart + 86400000;
  const dayEntries = entries.filter(e => e.clockIn >= dayStart && e.clockIn < dayEnd && e.clockOut);

  const lineMap = {};
  dayEntries.forEach(e => {
    const key = `${e.projectId || 'default'}||${e.taskId || ''}`;
    if (!lineMap[key]) lineMap[key] = { projectId: e.projectId || 'default', taskId: e.taskId || '', ms: 0, notes: [] };
    lineMap[key].ms += (e.clockOut - e.clockIn);
    if (e.note) lineMap[key].notes.push(e.note);
  });

  return Object.values(lineMap)
    .map(({ projectId, taskId, ms, notes }) => ({
      proj: getProjectById(projectId),
      task: getTaskById(taskId),
      ms, rounded: roundToQuarterMs(ms),
      notes: [...new Set(notes)]
    }))
    .sort((a, b) => b.ms - a.ms);
}

function renderDailySummary() {
  const dateStr = dailySummaryDate;
  document.getElementById('ds-date').value = dateStr;

  const dateLabel = new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
  });
  document.getElementById('ds-day-label').textContent = dateLabel;

  const rows  = getDaySummaryRows(dateStr);
  const table = document.getElementById('ds-table');
  const empty = document.getElementById('ds-empty');
  table.innerHTML = '';

  if (rows.length === 0) {
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  // Column headers
  const head = document.createElement('div');
  head.className = 'ds-row';
  head.innerHTML = `
    <span class="ds-col-head">Project</span>
    <span class="ds-col-head">Actual</span>
    <span class="ds-col-head">Payroll (¼h)</span>`;
  table.appendChild(head);

  let totalMs = 0, totalRounded = 0;
  rows.forEach(({ proj, task, ms, rounded, notes }) => {
    totalMs      += ms;
    totalRounded += rounded;
    const row = document.createElement('div');
    row.className = 'ds-row';
    const projLabel = proj.number ? `${proj.number}` : proj.name;
    const taskLabel = task ? `${task.code} — ${task.name}` : '(no task)';
    row.innerHTML = `
      <span class="ds-project">
        <span class="project-dot" style="background:${proj.color}"></span>
        <span><strong>${escHtml(projLabel)}</strong> · ${escHtml(taskLabel)}</span>
      </span>
      <span class="ds-actual">${formatDuration(ms)}</span>
      <span class="ds-payroll">${formatDecimalHours(rounded)}</span>`;
    table.appendChild(row);
    if (notes.length) {
      const noteRow = document.createElement('div');
      noteRow.className = 'ds-notes-row';
      noteRow.textContent = notes.join(' · ');
      table.appendChild(noteRow);
    }
  });

  const total = document.createElement('div');
  total.className = 'ds-row ds-total-row';
  total.innerHTML = `
    <span>Total</span>
    <span class="ds-actual">${formatDuration(totalMs)}</span>
    <span class="ds-payroll">${formatDecimalHours(totalRounded)}</span>`;
  table.appendChild(total);
}

function copyDailySummary() {
  const rows = getDaySummaryRows(dailySummaryDate);
  if (rows.length === 0) return;

  const dateLabel = new Date(dailySummaryDate + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
  });

  let totalRounded = 0;
  let text = `Daily Summary — ${dateLabel}\n`;
  rows.forEach(({ proj, task, rounded, notes }) => {
    totalRounded += rounded;
    const projLabel = proj.number || proj.name;
    const taskLabel = task ? task.code : '';
    const notePart  = notes.length ? ` — ${notes.join('; ')}` : '';
    text += `${projLabel}${taskLabel ? ' ' + taskLabel : ''}: ${formatDecimalHours(rounded)}${notePart}\n`;
  });
  text += `Total: ${formatDecimalHours(totalRounded)}`;

  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById('ds-copy-btn');
    const orig = btn.innerHTML;
    btn.innerHTML = 'Copied!';
    btn.style.background = 'var(--success)';
    btn.style.color = '#fff';
    setTimeout(() => { btn.innerHTML = orig; btn.style.background = ''; btn.style.color = ''; }, 2000);
  });
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
  reader.onload = async e => {
    try {
      const data = JSON.parse(e.target.result);
      if (!Array.isArray(data.entries) || !Array.isArray(data.projects)) {
        alert('Invalid backup file — please choose a Tclock backup (.json).');
        return;
      }
      if (!confirm(`This will replace all current data with the backup from ${new Date(data.exportedAt).toLocaleDateString()}.\n\nContinue?`)) return;
      const batch = writeBatch(db);
      entries.forEach(en => batch.delete(entryRef(en.id)));
      projects.filter(p => p.id !== 'default').forEach(p => batch.delete(projectRef(p.id)));
      data.entries.forEach(en => { if (en?.id) batch.set(entryRef(en.id), en); });
      data.projects.filter(p => p?.id && p.id !== 'default').forEach(p => batch.set(projectRef(p.id), p));
      await batch.commit();
      if (!data.projects.find(p => p.id === currentProjectId)) {
        currentProjectId = 'default';
        localStorage.setItem('tclock_currentProject', 'default');
      }
      alert('Data restored successfully!');
    } catch {
      alert("Could not read the file — make sure it's a valid Tclock backup.");
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
// Render: Projects Page
// =====================
let editingProjectFormId = null;

function renderProjects() {
  // Project list
  const list  = document.getElementById('project-list');
  const empty = document.getElementById('project-list-empty');
  const customProjects = projects.filter(p => p.id !== 'default');
  list.innerHTML = '';
  if (customProjects.length === 0) {
    empty.classList.remove('hidden');
  } else {
    empty.classList.add('hidden');
    customProjects.forEach(p => {
      const row = document.createElement('div');
      row.className = 'proj-list-row';
      row.innerHTML = `
        <span class="project-dot project-dot-lg" style="background:${p.color}"></span>
        <span class="proj-list-number">${escHtml(p.number || '')}</span>
        <span class="proj-list-name">${escHtml(p.name)}</span>
        <div class="proj-list-actions">
          <button class="ts-btn ts-btn-edit" data-id="${p.id}">Edit</button>
          <button class="ts-btn ts-btn-delete" data-id="${p.id}">Delete</button>
        </div>`;
      list.appendChild(row);
    });
    list.querySelectorAll('.ts-btn-edit').forEach(btn => btn.addEventListener('click', () => openProjectForm(btn.dataset.id)));
    list.querySelectorAll('.ts-btn-delete').forEach(btn => btn.addEventListener('click', async () => {
      const p = projects.find(x => x.id === btn.dataset.id);
      if (!p) return;
      if (confirm(`Delete "${p.number ? p.number + ' — ' : ''}${p.name}"? Its entries will move to General.`)) {
        await deleteProject(p.id);
      }
    }));
  }

  // Task list
  const taskList = document.getElementById('task-list');
  taskList.innerHTML = '';
  tasks.forEach(t => {
    const row = document.createElement('div');
    row.className = 'task-list-row';
    row.innerHTML = `
      <span class="task-code">${escHtml(t.code)}</span>
      <span class="task-name">${escHtml(t.name)}</span>
      <div class="proj-list-actions">
        ${DEFAULT_TASKS.find(d => d.id === t.id) ? '' : `<button class="ts-btn ts-btn-delete" data-id="${t.id}">Delete</button>`}
      </div>`;
    taskList.appendChild(row);
  });
  taskList.querySelectorAll('.ts-btn-delete').forEach(btn => btn.addEventListener('click', async () => {
    if (confirm('Delete this task?')) await deleteTask(btn.dataset.id);
  }));
}

function openProjectForm(id) {
  editingProjectFormId = id || null;
  const p = id ? projects.find(x => x.id === id) : null;
  document.getElementById('project-form-title').textContent = p ? 'Edit Project' : 'New Project';
  document.getElementById('pf-number').value = p?.number || '';
  document.getElementById('pf-name').value   = p?.name   || '';
  document.getElementById('pf-color').value  = p?.color  || '#3b82f6';
  document.getElementById('project-form-card').classList.remove('hidden');
  document.getElementById('pf-number').focus();
}

function closeProjectForm() {
  editingProjectFormId = null;
  document.getElementById('project-form-card').classList.add('hidden');
}

async function saveProjectForm() {
  const number = document.getElementById('pf-number').value.trim();
  const name   = document.getElementById('pf-name').value.trim();
  const color  = document.getElementById('pf-color').value;
  if (!name) { document.getElementById('pf-name').focus(); return; }

  if (editingProjectFormId) {
    const p = projects.find(x => x.id === editingProjectFormId);
    if (p) await setDoc(projectRef(p.id), { ...p, number, name, color });
  } else {
    await addProject(number, name, color);
  }
  closeProjectForm();
}

// =====================
// Tab Navigation
// =====================
function switchTab(tabId) {
  document.querySelectorAll('.nav-item').forEach(li => li.classList.toggle('active', li.dataset.tab === tabId));
  document.querySelectorAll('.tab-content').forEach(s => s.classList.toggle('active', s.id === 'tab-' + tabId));
  if (tabId === 'overview')   renderOverview();
  if (tabId === 'timesheets') { renderDailySummary(); renderTimesheets(); }
  if (tabId === 'projects')   renderProjects();
}

// =====================
// Auth helpers
// =====================
function showAuthOverlay(showForm) {
  document.getElementById('auth-overlay').classList.remove('hidden');
  document.getElementById('app').classList.add('app-hidden');
  document.getElementById('auth-loading').classList.toggle('hidden', showForm);
  document.getElementById('auth-card').classList.toggle('hidden', !showForm);
}

function hideAuthOverlay() {
  document.getElementById('auth-overlay').classList.add('hidden');
  document.getElementById('app').classList.remove('app-hidden');
}

function setAuthMode(mode) {
  authMode = mode;
  document.querySelectorAll('.auth-tab').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  document.getElementById('auth-submit').textContent = mode === 'signin' ? 'Sign In' : 'Create Account';
  document.getElementById('auth-error').classList.add('hidden');
}

function showAuthError(msg) {
  const el = document.getElementById('auth-error');
  el.textContent = msg;
  el.classList.remove('hidden');
}

function authErrMsg(code) {
  return ({
    'auth/user-not-found':       'No account found with this email.',
    'auth/wrong-password':       'Incorrect password.',
    'auth/email-already-in-use': 'An account with this email already exists.',
    'auth/weak-password':        'Password must be at least 6 characters.',
    'auth/invalid-email':        'Please enter a valid email address.',
    'auth/invalid-credential':   'Incorrect email or password.',
    'auth/too-many-requests':    'Too many attempts. Try again later.',
    'auth/network-request-failed': 'Network error. Check your connection.'
  })[code] || 'Something went wrong. Please try again.';
}

async function handleAuthSubmit() {
  const email    = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  if (!email || !password) { showAuthError('Please enter your email and password.'); return; }
  const btn = document.getElementById('auth-submit');
  btn.disabled = true;
  btn.textContent = authMode === 'signin' ? 'Signing in…' : 'Creating account…';
  document.getElementById('auth-error').classList.add('hidden');
  try {
    if (authMode === 'signin') await signInWithEmailAndPassword(auth, email, password);
    else                       await createUserWithEmailAndPassword(auth, email, password);
  } catch (err) {
    showAuthError(authErrMsg(err.code));
    btn.disabled = false;
    btn.textContent = authMode === 'signin' ? 'Sign In' : 'Create Account';
  }
}

// =====================
// Init
// =====================
function init() {
  dailySummaryDate = formatDateInput(Date.now());
  isDark = (() => { try { return JSON.parse(localStorage.getItem('tclock_theme') || 'false'); } catch { return false; } })();
  applyTheme(isDark);

  // Auth UI
  document.querySelectorAll('.auth-tab').forEach(btn => btn.addEventListener('click', () => setAuthMode(btn.dataset.mode)));
  document.getElementById('auth-submit').addEventListener('click', handleAuthSubmit);
  document.getElementById('auth-email').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('auth-password').focus(); });
  document.getElementById('auth-password').addEventListener('keydown', e => { if (e.key === 'Enter') handleAuthSubmit(); });

  // Projects page
  document.getElementById('add-project-btn').addEventListener('click', () => openProjectForm(null));
  document.getElementById('pf-cancel').addEventListener('click', closeProjectForm);
  document.getElementById('pf-save').addEventListener('click', saveProjectForm);
  document.getElementById('pf-name').addEventListener('keydown', e => { if (e.key === 'Enter') saveProjectForm(); });

  // Task form
  document.getElementById('add-task-btn').addEventListener('click', () => {
    document.getElementById('task-form').classList.remove('hidden');
    document.getElementById('task-form').style.display = 'flex';
    document.getElementById('tf-code').focus();
  });
  document.getElementById('tf-cancel').addEventListener('click', () => {
    document.getElementById('task-form').classList.add('hidden');
    document.getElementById('tf-code').value = '';
    document.getElementById('tf-name').value = '';
  });
  document.getElementById('tf-save').addEventListener('click', async () => {
    const code = document.getElementById('tf-code').value.trim();
    const name = document.getElementById('tf-name').value.trim();
    if (!code || !name) return;
    await addTask(code, name);
    document.getElementById('task-form').classList.add('hidden');
    document.getElementById('tf-code').value = '';
    document.getElementById('tf-name').value = '';
  });

  // Switch project modal
  document.getElementById('switch-cancel-btn').addEventListener('click', closeSwitchDialog);
  document.getElementById('switch-clockout-btn').addEventListener('click', switchDialogClockOut);
  document.getElementById('switch-confirm-btn').addEventListener('click', confirmSwitchProject);
  document.getElementById('switch-modal-overlay').addEventListener('click', e => {
    if (e.target.id === 'switch-modal-overlay') closeSwitchDialog();
  });

  // Sign out
  document.getElementById('signout-btn').addEventListener('click', async () => {
    if (confirm('Sign out of Tclock?')) await signOut(auth);
  });

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

  // Task selector
  document.getElementById('task-selector').addEventListener('change', e => {
    currentTaskId = e.target.value;
    localStorage.setItem('tclock_currentTask', currentTaskId);
  });

  // Project selector
  document.getElementById('project-selector-btn').addEventListener('click', e => {
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

  // Daily summary
  document.getElementById('ds-date').addEventListener('change', e => { dailySummaryDate = e.target.value; renderDailySummary(); });
  document.getElementById('ds-prev').addEventListener('click', () => {
    const d = new Date(dailySummaryDate + 'T12:00:00'); d.setDate(d.getDate() - 1);
    dailySummaryDate = formatDateInput(d.getTime()); renderDailySummary();
  });
  document.getElementById('ds-next').addEventListener('click', () => {
    const d = new Date(dailySummaryDate + 'T12:00:00'); d.setDate(d.getDate() + 1);
    dailySummaryDate = formatDateInput(d.getTime()); renderDailySummary();
  });
  document.getElementById('ds-copy-btn').addEventListener('click', copyDailySummary);

  // Timesheets filters
  document.getElementById('ts-filter-period').addEventListener('change', renderTimesheets);
  document.getElementById('ts-filter-duration').addEventListener('change', renderTimesheets);
  document.getElementById('ts-filter-project').addEventListener('change', renderTimesheets);

  // Modal
  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  document.getElementById('modal-save').addEventListener('click', saveModal);
  document.getElementById('modal-overlay').addEventListener('click', e => { if (e.target.id === 'modal-overlay') closeModal(); });

  // Backup / Restore / Export
  document.getElementById('backup-btn').addEventListener('click', backupData);
  document.getElementById('restore-btn').addEventListener('click', () => document.getElementById('restore-file-input').click());
  document.getElementById('restore-file-input').addEventListener('change', e => {
    if (e.target.files[0]) { restoreData(e.target.files[0]); e.target.value = ''; }
  });
  document.getElementById('export-btn').addEventListener('click', exportCSV);

  // Theme
  document.getElementById('theme-toggle').addEventListener('click', () => {
    isDark = !isDark;
    localStorage.setItem('tclock_theme', JSON.stringify(isDark));
    applyTheme(isDark);
  });

  // Tick
  tick();
  setInterval(tick, 1000);
  setInterval(() => {
    if (currentUser && document.querySelector('.tab-content.active')?.id === 'tab-overview') renderOverview();
  }, 60000);

  // Show loading spinner while Firebase resolves auth state
  showAuthOverlay(false);

  // Firebase auth state observer
  onAuthStateChanged(auth, async user => {
    if (user) {
      currentUser = user;
      currentProjectId = localStorage.getItem('tclock_currentProject') || 'default';
      currentTaskId    = localStorage.getItem('tclock_currentTask') || '';
      hideAuthOverlay();
      await migrateLocalStorage();
      setupListeners();
    } else {
      teardownListeners();
      currentUser = null;
      showAuthOverlay(true);
      setAuthMode('signin');
    }
  });
}

document.addEventListener('DOMContentLoaded', init);
