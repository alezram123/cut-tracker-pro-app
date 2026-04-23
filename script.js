const STORAGE_KEY = 'cut-tracker-pro-v1';
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
};

init();

function init() {
  registerServiceWorker();
  seedDemoIfEmpty();
  renderHabits();
  attachEvents();
  renderAll();
}

function seedDemoIfEmpty() {
  if (Object.keys(state.checkins).length) return;
  const sampleA = addDays(isoToday(), -3);
  const sampleB = isoToday();
  state.startDate = addDays(isoToday(), -3);
  state.goalDate = addDays(state.startDate, 84);
  state.checkins[sampleA] = {
    date: sampleA, weight: '', steps: '', sleep: '', energy: '', waist: '', bodyFat: '',
    notes: '', score: 4, habits: { protein: true, calories: true, workout: true, weight: true }, success: true,
  };
  state.checkins[sampleB] = {
    date: sampleB, weight: '', steps: '', sleep: '', energy: '', waist: '', bodyFat: '',
    notes: '', score: 4, habits: { protein: true, calories: true, workout: true, weight: true }, success: true,
  };
  state.habitsToday = { protein: true, calories: true, workout: true, weight: true };
  saveState();
}

function attachEvents() {
  els.form.addEventListener('submit', handleSaveDay);
  els.resetHabitsBtn.addEventListener('click', () => {
    state.habitsToday = Object.fromEntries(HABITS.map(h => [h.id, false]));
    saveState();
    renderAll();
  });
  els.exportBtn.addEventListener('click', exportData);
  els.clearBtn.addEventListener('click', () => {
    if (!confirm('Clear all Cut Tracker Pro data on this device?')) return;
    localStorage.removeItem(STORAGE_KEY);
    state = initialState();
    renderHabits();
    renderAll();
  });
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
    item.className = `habit-item ${active ? 'active' : ''}`;
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

  state.checkins[today] = {
    ...existing,
    ...entry,
    date: today,
    score,
    habits: { ...state.habitsToday },
    success: score >= 3,
  };

  if (!state.startDate) state.startDate = today;
  state.goalDate = addDays(state.startDate, 84);
  saveState();
  renderAll();
  alert('Day saved.');
}

function fillFormFromToday() {
  const today = isoToday();
  const entry = state.checkins[today] || {};
  ['weight','steps','sleep','energy','waist','bodyFat','notes'].forEach(name => {
    if (els.form.elements[name]) els.form.elements[name].value = entry[name] ?? '';
  });
}

function renderStats() {
  const { current, best } = calculateStreaks();
  els.currentStreak.textContent = current;
  els.bestStreak.textContent = best;
}

function calculateStreaks() {
  const successDates = Object.values(state.checkins)
    .filter(entry => entry.success)
    .map(entry => entry.date)
    .sort();

  if (!successDates.length) return { current: 0, best: 0 };

  let best = 1;
  let run = 1;
  for (let i = 1; i < successDates.length; i++) {
    if (daysBetween(successDates[i - 1], successDates[i]) === 1) {
      run++;
      best = Math.max(best, run);
    } else {
      run = 1;
    }
  }

  let current = 0;
  const today = isoToday();
  let cursor = today;
  while (state.checkins[cursor]?.success) {
    current++;
    cursor = addDays(cursor, -1);
  }
  return { current, best };
}

function renderRecentList() {
  const entries = Object.values(state.checkins)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 6);

  els.recentList.innerHTML = '';
  if (!entries.length) {
    els.recentList.innerHTML = '<div class="recent-item"><div><strong>No check-ins yet</strong><div class="recent-meta">Save your first day to start tracking.</div></div></div>';
    return;
  }

  entries.forEach(entry => {
    const card = document.createElement('div');
    card.className = 'recent-item';
    card.innerHTML = `
      <div>
        <strong>${formatDateLong(entry.date)}</strong>
        <div class="recent-meta">Weight: ${formatValue(entry.weight)} • Steps: ${formatValue(entry.steps)} • Score: ${entry.score || 0}/4</div>
      </div>
      <div class="badge ${entry.success ? '' : 'saved'}">${entry.success ? 'Success' : 'Saved'}</div>
    `;
    els.recentList.appendChild(card);
  });
}

function renderSnapshot() {
  const entries = Object.values(state.checkins).sort((a, b) => b.date.localeCompare(a.date));
  const withWeight = entries.find(e => e.weight);
  const withWaist = entries.find(e => e.waist);
  const withBodyFat = entries.find(e => e.bodyFat);
  els.latestWeight.textContent = withWeight?.weight || '—';
  els.latestWaist.textContent = withWaist?.waist || '—';
  els.latestBodyFat.textContent = withBodyFat?.bodyFat || '—';
}

function renderGoalCountdown() {
  const start = state.startDate || isoToday();
  const goal = state.goalDate || addDays(start, 84);
  const elapsed = Math.max(0, daysBetween(start, isoToday()));
  const total = Math.max(1, daysBetween(start, goal));
  const percent = Math.max(0, Math.min(100, Math.round((elapsed / total) * 100)));
  els.startDateCard.textContent = formatDateCard(start);
  els.goalDateCard.textContent = formatDateCard(goal);
  els.goalPercent.textContent = `${percent}%`;
  els.goalBar.style.width = `${percent}%`;
  els.goalMessage.textContent = `You are ${percent}% of the way through your 12-week cut.`;
}

function renderCalendar() {
  const labels = ['S','M','T','W','T','F','S'];
  els.calendar.innerHTML = labels.map(d => `<div class="calendar-label">${d}</div>`).join('');

  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const firstDay = first.getDay();

  for (let i = 0; i < firstDay; i++) {
    const spacer = document.createElement('div');
    spacer.className = 'calendar-day';
    spacer.style.visibility = 'hidden';
    els.calendar.appendChild(spacer);
  }

  for (let day = 1; day <= last.getDate(); day++) {
    const date = new Date(year, month, day);
    const iso = localIso(date);
    const entry = state.checkins[iso];
    const cell = document.createElement('div');
    const classes = ['calendar-day'];
    if (entry) classes.push(entry.success ? 'success' : 'saved');
    if (iso === isoToday()) classes.push('today');
    cell.className = classes.join(' ');
    cell.textContent = day;
    els.calendar.appendChild(cell);
  }
}

function drawWeightChart() {
  const canvas = els.weightChart;
  const ctx = canvas.getContext('2d');
  const ratio = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * ratio;
  canvas.height = 260 * ratio;
  ctx.scale(ratio, ratio);
  ctx.clearRect(0, 0, rect.width, 260);

  const entries = Object.values(state.checkins)
    .filter(e => e.weight !== '' && !isNaN(Number(e.weight)))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (entries.length < 2) {
    els.chartEmpty.style.display = 'block';
    return;
  }
  els.chartEmpty.style.display = 'none';

  const padding = 32;
  const w = rect.width;
  const h = 260;
  const weights = entries.map(e => Number(e.weight));
  const min = Math.min(...weights) - 1;
  const max = Math.max(...weights) + 1;

  ctx.strokeStyle = 'rgba(132, 156, 196, 0.14)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    const y = padding + ((h - padding * 2) / 3) * i;
    ctx.beginPath(); ctx.moveTo(padding, y); ctx.lineTo(w - padding, y); ctx.stroke();
  }

  const points = entries.map((entry, index) => {
    const x = padding + (index * (w - padding * 2)) / (entries.length - 1);
    const y = h - padding - ((Number(entry.weight) - min) / (max - min || 1)) * (h - padding * 2);
    return { x, y, entry };
  });

  const line = new Path2D();
  points.forEach((p, i) => i === 0 ? line.moveTo(p.x, p.y) : line.lineTo(p.x, p.y));
  ctx.strokeStyle = '#60a5fa';
  ctx.lineWidth = 3;
  ctx.stroke(line);

  points.forEach(p => {
    ctx.fillStyle = '#78b9ff';
    ctx.beginPath(); ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2); ctx.fill();
  });

  ctx.fillStyle = '#a6b4cc';
  ctx.font = '12px Inter';
  ctx.fillText(entries[0].date.slice(5).replace('-', '/'), padding, h - 10);
  ctx.fillText(entries.at(-1).date.slice(5).replace('-', '/'), w - padding - 36, h - 10);
}

function updateProgressRing(score) {
  const circle = els.ringProgress;
  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 4) * circumference;
  circle.style.strokeDasharray = `${circumference}`;
  circle.style.strokeDashoffset = `${offset}`;
}

function getTodayScore() {
  return Object.values(state.habitsToday).filter(Boolean).length;
}

function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cut-tracker-pro-${isoToday()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : initialState();
  } catch {
    return initialState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function localIso(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function isoToday() {
  return localIso(new Date());
}

function addDays(iso, days) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return localIso(d);
}

function daysBetween(startIso, endIso) {
  const a = new Date(`${startIso}T12:00:00`);
  const b = new Date(`${endIso}T12:00:00`);
  return Math.round((b - a) / 86400000);
}

function formatDateLong(iso) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
function formatDateCard(iso) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
function formatValue(value) { return value === '' || value == null ? '—' : value; }

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}
