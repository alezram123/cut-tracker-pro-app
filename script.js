const STORAGE_KEY = 'cut-tracker-pro-v1';
const INSTALL_BANNER_KEY = 'cut-tracker-pro-install-banner-dismissed';
const TAB_KEY = 'cut-tracker-pro-active-tab';
const HABITS = [
  { id: 'protein', title: 'Hit protein', sub: 'Stay on your target.' },
  { id: 'calories', title: 'Stayed on calories', sub: 'Keep the cut moving.' },
  { id: 'workout', title: 'Workout / steps', sub: 'Gym or daily movement.' },
  { id: 'weight', title: 'Logged weight', sub: 'Morning weigh-in done.' },
];

const initialState = () => {
  const today = isoToday();
  return {
    startDate: today,
    goalDate: addDays(today, 84),
    habitsToday: Object.fromEntries(HABITS.map(h => [h.id, false])),
    checkins: {}
  };
};

let state = loadState();
let deferredPrompt = null;

const els = {
  todayPill: document.getElementById('todayPill'),
  currentStreak: document.getElementById('currentStreak'),
  bestStreak: document.getElementById('bestStreak'),
  todayScore: document.getElementById('todayScore'),
  ringScore: document.getElementById('ringScore'),
  ringProgress: document.getElementById('ringProgress'),
  habitList: document.getElementById('habitList'),
  form: document.getElementById('checkinForm'),
  resetHabitsBtn: document.getElementById('resetHabitsBtn'),
  recentList: document.getElementById('recentList'),
  latestWeight: document.getElementById('latestWeight'),
  latestWaist: document.getElementById('latestWaist'),
  latestBodyFat: document.getElementById('latestBodyFat'),
  startDateCard: document.getElementById('startDateCard'),
  goalDateCard: document.getElementById('goalDateCard'),
  goalPercent: document.getElementById('goalPercent'),
  goalBar: document.getElementById('goalBar'),
  goalMessage: document.getElementById('goalMessage'),
  calendar: document.getElementById('calendar'),
  exportBtn: document.getElementById('exportBtn'),
  clearBtn: document.getElementById('clearBtn'),
  weightChart: document.getElementById('weightChart'),
  chartEmpty: document.getElementById('chartEmpty'),
  toast: document.getElementById('toast'),
  installBanner: document.getElementById('installBanner'),
  closeInstallBanner: document.getElementById('closeInstallBanner'),
  tabBtns: Array.from(document.querySelectorAll('.tab-btn')),
  tabScreens: Array.from(document.querySelectorAll('.tab-screen')),
};

init();

function init() {
  registerServiceWorker();
  seedDemoIfEmpty();
  attachEvents();
  setupInstallPrompt();
  switchTab(localStorage.getItem(TAB_KEY) || 'dashboard', false);
  renderAll();
}

function attachEvents() {
  els.form.addEventListener('submit', handleSaveDay);
  els.resetHabitsBtn.addEventListener('click', () => {
    haptic('light');
    state.habitsToday = Object.fromEntries(HABITS.map(h => [h.id, false]));
    saveState();
    renderAll();
    showToast('Habits reset for today');
  });
  els.exportBtn.addEventListener('click', exportData);
  els.clearBtn.addEventListener('click', () => {
    if (!confirm('Clear all Cut Tracker Pro data on this device?')) return;
    haptic('heavy');
    localStorage.removeItem(STORAGE_KEY);
    state = initialState();
    renderAll();
    showToast('All data cleared');
  });
  els.closeInstallBanner?.addEventListener('click', dismissInstallBanner);
  document.addEventListener('focusin', handleFocusScroll);
  window.addEventListener('resize', drawWeightChart);
  els.tabBtns.forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.target)));
}

function switchTab(tab, tactile = true) {
  if (tactile) haptic('light');
  els.tabBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.target === tab));
  els.tabScreens.forEach(screen => screen.classList.toggle('active', screen.dataset.tab === tab));
  localStorage.setItem(TAB_KEY, tab);
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (tab === 'trends') setTimeout(drawWeightChart, 80);
}

function setupInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    showInstallBanner();
  });
  if (isIosSafari() && !isStandalone() && !localStorage.getItem(INSTALL_BANNER_KEY)) showInstallBanner();
  els.installBanner?.addEventListener('click', async (e) => {
    if (e.target === els.closeInstallBanner) return;
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt = null;
      dismissInstallBanner();
      return;
    }
    if (isIosSafari() && !isStandalone()) showToast('On iPhone: tap Share, then Add to Home Screen');
  });
}

function showInstallBanner() {
  if (!els.installBanner || localStorage.getItem(INSTALL_BANNER_KEY)) return;
  els.installBanner.classList.remove('hidden');
}
function dismissInstallBanner() {
  localStorage.setItem(INSTALL_BANNER_KEY, '1');
  els.installBanner?.classList.add('hidden');
}

function seedDemoIfEmpty() {
  if (Object.keys(state.checkins).length) return;
  const sampleA = addDays(isoToday(), -3);
  const sampleB = isoToday();
  state.startDate = addDays(isoToday(), -3);
  state.goalDate = addDays(state.startDate, 84);
  state.checkins[sampleA] = { date: sampleA, weight: '199.4', steps: '9800', sleep: '', energy: '', waist: '', bodyFat: '', notes: '', score: 4, habits: { protein: true, calories: true, workout: true, weight: true }, success: true };
  state.checkins[sampleB] = { date: sampleB, weight: '200.0', steps: '10000', sleep: '', energy: '', waist: '', bodyFat: '', notes: '', score: 4, habits: { protein: true, calories: true, workout: true, weight: true }, success: true };
  state.habitsToday = { protein: true, calories: true, workout: true, weight: true };
  saveState();
}

function renderAll() {
  const today = isoToday();
  els.todayPill.textContent = formatDateLong(today);
  const score = getTodayScore();
  els.todayScore.textContent = score;
  els.ringScore.textContent = `${score}/4`;
  updateProgressRing(score);
  fillFormFromToday();
  renderHabits();
  renderStats();
  renderRecentList();
  renderSnapshot();
  renderGoalCountdown();
  renderCalendar();
  drawWeightChart();
}

function renderHabits() {
  els.habitList.innerHTML = '';
  HABITS.forEach(habit => {
    const active = !!state.habitsToday[habit.id];
    const item = document.createElement('button');
    item.type = 'button';
    item.className = `habit-item tap-target ${active ? 'active' : ''}`;
    item.innerHTML = `
      <div class="habit-main">
        <div class="habit-check">✓</div>
        <div>
          <div class="habit-title">${habit.title}</div>
          <div class="habit-sub">${habit.sub}</div>
        </div>
      </div>
      <div class="habit-tag">${active ? 'Done' : 'Tap me'}</div>
    `;
    item.addEventListener('click', () => {
      state.habitsToday[habit.id] = !state.habitsToday[habit.id];
      haptic(active ? 'light' : 'medium');
      saveState();
      renderAll();
    });
    els.habitList.appendChild(item);
  });
}

function handleSaveDay(e) {
  e.preventDefault();
  const formData = new FormData(els.form);
  const today = isoToday();
  const entry = Object.fromEntries(formData.entries());
  const score = getTodayScore();
  const existing = state.checkins[today] || {};
  state.checkins[today] = { ...existing, ...entry, date: today, score, habits: { ...state.habitsToday }, success: score >= 3 };
  if (!existing.date) {
    if (Object.keys(state.checkins).length === 1) {
      state.startDate = today;
      state.goalDate = addDays(today, 84);
    } else if (today < state.startDate) {
      state.startDate = today;
      state.goalDate = addDays(today, 84);
    }
  }
  saveState();
  haptic(score >= 3 ? 'success' : 'medium');
  renderAll();
  showToast(score >= 3 ? 'Day saved — success' : 'Day saved');
}

function renderStats() {
  const checkins = getSortedCheckins();
  let current = 0, best = 0, streak = 0, prevDate = null;
  checkins.forEach(entry => {
    if (!entry.success) { streak = 0; prevDate = entry.date; return; }
    if (!prevDate || daysBetween(prevDate, entry.date) === 1) streak += 1;
    else if (daysBetween(prevDate, entry.date) > 1) streak = 1;
    best = Math.max(best, streak);
    prevDate = entry.date;
  });
  const today = isoToday();
  const yesterday = addDays(today, -1);
  const successDates = checkins.filter(c => c.success).map(c => c.date);
  if (successDates.includes(today)) current = trailingSuccessCount(successDates, today);
  else if (successDates.includes(yesterday)) current = trailingSuccessCount(successDates, yesterday);
  els.currentStreak.textContent = current;
  els.bestStreak.textContent = best;
}

function trailingSuccessCount(successDates, endDate) {
  const set = new Set(successDates);
  let count = 0, cursor = endDate;
  while (set.has(cursor)) { count += 1; cursor = addDays(cursor, -1); }
  return count;
}
function getTodayScore() { return Object.values(state.habitsToday).filter(Boolean).length; }

function updateProgressRing(score) {
  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  const progress = score / 4;
  els.ringProgress.style.strokeDasharray = `${circumference}`;
  els.ringProgress.style.strokeDashoffset = `${circumference * (1 - progress)}`;
}

function fillFormFromToday() {
  const entry = state.checkins[isoToday()] || {};
  ['weight', 'steps', 'sleep', 'energy', 'waist', 'bodyFat', 'notes'].forEach(name => {
    const field = els.form.elements[name];
    if (field) field.value = entry[name] || '';
  });
}

function renderSnapshot() {
  const checkins = getSortedCheckins();
  const latest = [...checkins].reverse().find(entry => hasAnyValue(entry, ['weight', 'waist', 'bodyFat'])) || {};
  els.latestWeight.textContent = latest.weight || '—';
  els.latestWaist.textContent = latest.waist || '—';
  els.latestBodyFat.textContent = latest.bodyFat || '—';
}

function renderGoalCountdown() {
  els.startDateCard.textContent = formatDateLarge(state.startDate);
  els.goalDateCard.textContent = formatDateLarge(state.goalDate);
  const total = Math.max(1, daysBetween(state.startDate, state.goalDate));
  const elapsed = Math.min(total, Math.max(0, daysBetween(state.startDate, isoToday())));
  const pct = Math.round((elapsed / total) * 100);
  els.goalPercent.textContent = `${pct}%`;
  els.goalBar.style.width = `${pct}%`;
  els.goalMessage.textContent = `You are ${pct}% of the way through your 12-week cut.`;
}

function renderCalendar() {
  const today = localDateStringToDate(isoToday());
  const year = today.getFullYear();
  const month = today.getMonth();
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startWeekday = first.getDay();
  const successDates = new Set(getSortedCheckins().filter(c => c.success).map(c => c.date));
  const savedDates = new Set(Object.keys(state.checkins));

  const wrap = document.createElement('div');
  wrap.className = 'calendar-wrap';
  const head = document.createElement('div');
  head.className = 'calendar-head';
  ['S','M','T','W','T','F','S'].forEach(d => {
    const el = document.createElement('div');
    el.className = 'calendar-dayname';
    el.textContent = d;
    head.appendChild(el);
  });
  wrap.appendChild(head);
  const grid = document.createElement('div');
  grid.className = 'calendar-grid';
  for (let i = 0; i < startWeekday; i++) {
    const spacer = document.createElement('div');
    spacer.className = 'calendar-spacer';
    grid.appendChild(spacer);
  }
  for (let d = 1; d <= last.getDate(); d++) {
    const date = toLocalISO(new Date(year, month, d));
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = d;
    btn.className = 'calendar-cell tap-target';
    if (date === isoToday()) btn.classList.add('active');
    if (successDates.has(date)) btn.classList.add('success');
    else if (savedDates.has(date)) btn.classList.add('saved');
    btn.addEventListener('click', () => {
      const entry = state.checkins[date];
      showToast(entry ? `${formatDateLong(date)} • Score ${entry.score || 0}/4` : formatDateLong(date));
    });
    grid.appendChild(btn);
  }
  wrap.appendChild(grid);
  const legend = document.createElement('div');
  legend.className = 'legend';
  legend.innerHTML = `<span><i class="dot dot-empty"></i>No entry</span><span><i class="dot dot-success"></i>Success day</span><span><i class="dot dot-saved"></i>Saved day</span>`;
  wrap.appendChild(legend);
  els.calendar.innerHTML = '';
  els.calendar.appendChild(wrap);
}

function renderRecentList() {
  const items = getSortedCheckins().slice(-20).reverse();
  els.recentList.innerHTML = items.length ? '' : '<div class="empty">No saved days yet.</div>';
  items.forEach(entry => {
    const card = document.createElement('div');
    card.className = 'recent-item';
    card.innerHTML = `<div><strong>${formatDateLong(entry.date)}</strong><div class="recent-meta">Weight: ${entry.weight || '—'} • Steps: ${entry.steps || '—'} • Score: ${entry.score || 0}/4</div></div><span class="success-badge ${entry.success ? 'is-success' : ''}">${entry.success ? 'Success' : 'Saved'}</span>`;
    els.recentList.appendChild(card);
  });
}

function drawWeightChart() {
  const ctx = els.weightChart.getContext('2d');
  const points = getSortedCheckins().filter(c => c.weight !== '' && !isNaN(Number(c.weight))).map(c => ({ date: c.date, weight: Number(c.weight) }));
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const parentWidth = els.weightChart.clientWidth || els.weightChart.parentElement.clientWidth || 600;
  const cssHeight = 260;
  els.weightChart.width = parentWidth * dpr;
  els.weightChart.height = cssHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, parentWidth, cssHeight);
  if (points.length < 2) { els.chartEmpty.style.display = 'grid'; return; }
  els.chartEmpty.style.display = 'none';
  const pad = 28, w = parentWidth - pad * 2, h = cssHeight - pad * 2;
  const min = Math.min(...points.map(p => p.weight));
  const max = Math.max(...points.map(p => p.weight));
  const range = Math.max(1, max - min);
  ctx.strokeStyle = 'rgba(132,156,196,0.12)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    const y = pad + (h / 3) * i;
    ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(pad + w, y); ctx.stroke();
  }
  ctx.strokeStyle = '#5ea7ff';
  ctx.lineWidth = 3;
  ctx.beginPath();
  points.forEach((point, index) => {
    const x = pad + (w * index) / (points.length - 1);
    const y = pad + h - ((point.weight - min) / range) * h;
    if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();
  points.forEach((point, index) => {
    const x = pad + (w * index) / (points.length - 1);
    const y = pad + h - ((point.weight - min) / range) * h;
    ctx.fillStyle = '#7bc0ff';
    ctx.beginPath(); ctx.arc(x, y, 4.5, 0, Math.PI * 2); ctx.fill();
  });
}

function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `cut-tracker-pro-${isoToday()}.json`; a.click();
  URL.revokeObjectURL(url);
  haptic('light');
  showToast('Data exported');
}

function registerServiceWorker() { if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {}); }
function loadState() { try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? { ...initialState(), ...JSON.parse(raw) } : initialState(); } catch { return initialState(); } }
function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function getSortedCheckins() { return Object.values(state.checkins).sort((a, b) => a.date.localeCompare(b.date)); }
function hasAnyValue(obj, keys) { return keys.some(k => obj[k] !== undefined && obj[k] !== null && obj[k] !== ''); }
function isoToday() { return toLocalISO(new Date()); }
function toLocalISO(date) { const y = date.getFullYear(), m = String(date.getMonth() + 1).padStart(2, '0'), d = String(date.getDate()).padStart(2, '0'); return `${y}-${m}-${d}`; }
function localDateStringToDate(iso) { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); }
function addDays(iso, days) { const dt = localDateStringToDate(iso); dt.setDate(dt.getDate() + days); return toLocalISO(dt); }
function daysBetween(a, b) { return Math.round((localDateStringToDate(b) - localDateStringToDate(a)) / 86400000); }
function formatDateLong(iso) { return localDateStringToDate(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); }
function formatDateLarge(iso) { return localDateStringToDate(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).replace(', ', ',\n'); }
function showToast(message) { if (!els.toast) return; els.toast.textContent = message; els.toast.classList.add('show'); clearTimeout(showToast.t); showToast.t = setTimeout(() => els.toast.classList.remove('show'), 1800); }
function haptic(kind = 'light') {
  if (!('vibrate' in navigator)) return;
  const patterns = { light: 8, medium: 14, heavy: [18, 12, 18], success: [10, 30, 14] };
  navigator.vibrate(patterns[kind] || 8);
}
function isStandalone() { return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true; }
function isIosSafari() {
  const ua = window.navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
}
function handleFocusScroll(e) {
  const tag = e.target?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') setTimeout(() => e.target.scrollIntoView({ block: 'center', behavior: 'smooth' }), 250);
}
