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
    checkins: {},
    measurements: {},
    photos: [],
    weeklyReviews: {},
    lockedDays: {}
  };
};

let state = loadState();
let deferredPrompt = null;
let activePhotoIndex = 0;
let viewerScale = 1;
let viewerTranslateX = 0;
let viewerTranslateY = 0;
let dragStartX = 0;
let dragStartY = 0;
let dragLastX = 0;
let dragLastY = 0;
let isDraggingPhoto = false;
let pinchStartDistance = 0;
let pinchStartScale = 1;
let generatedShareBlob = null;
let generatedShareUrl = '';
let compareMode = 'slider';

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
  measurementsForm: document.getElementById('measurementsForm'),
  measurementList: document.getElementById('measurementList'),
  photoForm: document.getElementById('photoForm'),
  photoGrid: document.getElementById('photoGrid'),
  weeklyForm: document.getElementById('weeklyForm'),
  weeklyList: document.getElementById('weeklyList'),
  photoViewer: document.getElementById('photoViewer'),
  viewerImage: document.getElementById('viewerImage'),
  photoViewerTitle: document.getElementById('photoViewerTitle'),
  photoViewerMeta: document.getElementById('photoViewerMeta'),
  closePhotoViewer: document.getElementById('closePhotoViewer'),
  deleteViewerPhoto: document.getElementById('deleteViewerPhoto'),
  viewerPrev: document.getElementById('viewerPrev'),
  viewerNext: document.getElementById('viewerNext'),
  beforePhotoSelect: document.getElementById('beforePhotoSelect'),
  afterPhotoSelect: document.getElementById('afterPhotoSelect'),
  compareStage: document.getElementById('compareStage'),
  beforeCompareImage: document.getElementById('beforeCompareImage'),
  afterCompareImage: document.getElementById('afterCompareImage'),
  afterCompareWrap: document.getElementById('afterCompareWrap'),
  compareHandle: document.getElementById('compareHandle'),
  compareSlider: document.getElementById('compareSlider'),
  summaryWeight: document.getElementById('summaryWeight'),
  summaryStreak: document.getElementById('summaryStreak'),
  summaryHabits: document.getElementById('summaryHabits'),
  summaryNote: document.getElementById('summaryNote'),
  importInput: document.getElementById('importInput'),
  backupReminderBtn: document.getElementById('backupReminderBtn'),
  shareCompareBtn: document.getElementById('shareCompareBtn'),
  shareSheet: document.getElementById('shareSheet'),
  closeShareSheet: document.getElementById('closeShareSheet'),
  sharePreview: document.getElementById('sharePreview'),
  downloadShareBtn: document.getElementById('downloadShareBtn'),
  nativeShareBtn: document.getElementById('nativeShareBtn'),
  autoSelectCompareBtn: document.getElementById('autoSelectCompareBtn'),
  compareModeBtns: Array.from(document.querySelectorAll('.compare-mode-btn[data-mode]')),
  compareSideBySide: document.getElementById('compareSideBySide'),
  beforeSideImage: document.getElementById('beforeSideImage'),
  afterSideImage: document.getElementById('afterSideImage'),
};

init();

function init() {
  registerServiceWorker();
  seedDemoIfEmpty();
  attachEvents();
  setupInstallPrompt();
  switchTab(localStorage.getItem(TAB_KEY) || 'dashboard', false);
  renderAll();
  maybeShowBackupReminder();
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
  els.measurementsForm?.addEventListener('submit', handleSaveMeasurements);
  els.photoForm?.addEventListener('submit', handleSavePhoto);
  els.weeklyForm?.addEventListener('submit', handleSaveWeeklyReview);
  els.closePhotoViewer?.addEventListener('click', closePhotoViewer);
  els.viewerPrev?.addEventListener('click', () => movePhotoViewer(-1));
  els.viewerNext?.addEventListener('click', () => movePhotoViewer(1));
  els.deleteViewerPhoto?.addEventListener('click', deleteActiveViewerPhoto);
  els.viewerImage?.addEventListener('pointerdown', handleViewerPointerDown);
  els.viewerImage?.addEventListener('pointermove', handleViewerPointerMove);
  els.viewerImage?.addEventListener('pointerup', handleViewerPointerUp);
  els.viewerImage?.addEventListener('pointercancel', handleViewerPointerUp);
  els.viewerImage?.addEventListener('wheel', handleViewerWheel, { passive: false });
  els.photoViewer?.addEventListener('touchstart', handleViewerTouchStart, { passive: false });
  els.photoViewer?.addEventListener('touchmove', handleViewerTouchMove, { passive: false });
  els.photoViewer?.addEventListener('touchend', handleViewerTouchEnd);
  els.beforePhotoSelect?.addEventListener('change', renderBeforeAfterCompare);
  els.afterPhotoSelect?.addEventListener('change', renderBeforeAfterCompare);
  els.compareSlider?.addEventListener('input', updateCompareSlider);
  els.importInput?.addEventListener('change', handleImportBackup);
  els.backupReminderBtn?.addEventListener('click', handleBackupReminder);
  els.shareCompareBtn?.addEventListener('click', createShareImage);
  els.closeShareSheet?.addEventListener('click', closeShareSheet);
  els.downloadShareBtn?.addEventListener('click', downloadShareImage);
  els.nativeShareBtn?.addEventListener('click', nativeShareImage);
  els.autoSelectCompareBtn?.addEventListener('click', () => {
    autoSelectComparePhotos(true);
    renderBeforeAfterCompare();
  });
  els.compareModeBtns?.forEach(btn => btn.addEventListener('click', () => setCompareMode(btn.dataset.mode)));
  document.addEventListener('keydown', handleViewerKeydown);
}

function switchTab(tab, tactile = true) {
  if (tactile) haptic('light');
  els.tabBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.target === tab));
  els.tabScreens.forEach(screen => screen.classList.toggle('active', screen.dataset.tab === tab));
  localStorage.setItem(TAB_KEY, tab);
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (tab === 'progress') setTimeout(drawWeightChart, 80);
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
  renderMeasurements();
  renderPhotos();
  renderWeeklyReviews();
  renderBeforeAfterOptions();
  renderWeeklyAutoSummary();
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


function handleSaveMeasurements(e) {
  e.preventDefault();
  const today = isoToday();
  const entry = Object.fromEntries(new FormData(els.measurementsForm).entries());
  const hasData = Object.values(entry).some(v => String(v || '').trim() !== '');
  if (!hasData) return showToast('Add at least one measurement');
  state.measurements = state.measurements || {};
  state.measurements[today] = { ...(state.measurements[today] || {}), date: today, ...entry };
  saveState();
  haptic('success');
  renderMeasurements();
  showToast('Measurements saved');
}

function renderMeasurements() {
  if (!els.measurementList) return;
  state.measurements = state.measurements || {};
  const todayEntry = state.measurements[isoToday()] || {};
  ['chest', 'arms', 'hips', 'thighs'].forEach(name => {
    const field = els.measurementsForm?.elements[name];
    if (field) field.value = todayEntry[name] || '';
  });
  const items = Object.values(state.measurements).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  els.measurementList.innerHTML = items.length ? '' : '<div class="empty">No measurements saved yet.</div>';
  items.forEach(item => {
    const row = document.createElement('div');
    row.className = 'measurement-row';
    row.innerHTML = `<div><strong>${formatDateLong(item.date)}</strong><div class="recent-meta">Chest: ${item.chest || '—'} • Arms: ${item.arms || '—'} • Hips: ${item.hips || '—'} • Thighs: ${item.thighs || '—'}</div></div>`;
    els.measurementList.appendChild(row);
  });
}

function handleSavePhoto(e) {
  e.preventDefault();
  const file = els.photoForm.elements.photoFile.files?.[0];
  const type = els.photoForm.elements.photoType.value || 'Other';
  if (!file) return showToast('Choose a photo first');
  if (!file.type.startsWith('image/')) return showToast('Please choose an image');
  const reader = new FileReader();
  reader.onload = () => {
    resizeImage(reader.result, 900, 0.82).then((dataUrl) => {
      state.photos = state.photos || [];
      state.photos.unshift({ id: Date.now(), date: isoToday(), type, dataUrl });
      state.photos = state.photos.slice(0, 30);
      saveState();
      els.photoForm.reset();
      haptic('success');
      renderPhotos();
      showToast('Progress photo saved');
    });
  };
  reader.readAsDataURL(file);
}

function resizeImage(dataUrl, maxSize = 900, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}


function renderPhotos() {
  if (!els.photoGrid) return;
  state.photos = state.photos || [];
  els.photoGrid.innerHTML = state.photos.length ? '' : '<div class="empty">No progress photos yet.</div>';
  state.photos.slice(0, 24).forEach((photo, index) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'photo-card gallery-card tap-target';
    card.innerHTML = `
      <img src="${photo.dataUrl}" alt="${photo.type} progress photo" loading="lazy" />
      <div class="photo-gradient"></div>
      <div class="photo-meta">
        <strong>${photo.type}</strong>
        <span>${formatDateLong(photo.date)}</span>
      </div>
    `;
    card.addEventListener('click', () => openPhotoViewer(index));
    els.photoGrid.appendChild(card);
  });
  renderBeforeAfterOptions();
}

function openPhotoViewer(index) {
  state.photos = state.photos || [];
  if (!state.photos.length) return;
  activePhotoIndex = Math.max(0, Math.min(index, state.photos.length - 1));
  resetViewerZoom();
  updatePhotoViewer();
  els.photoViewer?.classList.remove('hidden');
  els.photoViewer?.setAttribute('aria-hidden', 'false');
  document.body.classList.add('viewer-open');
  haptic('light');
}

function closePhotoViewer() {
  resetViewerZoom();
  els.photoViewer?.classList.add('hidden');
  els.photoViewer?.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('viewer-open');
}

function updatePhotoViewer() {
  const photo = state.photos?.[activePhotoIndex];
  if (!photo || !els.viewerImage) return;
  els.viewerImage.classList.remove('viewer-fade-in');
  void els.viewerImage.offsetWidth;
  els.viewerImage.src = photo.dataUrl;
  els.viewerImage.classList.add('viewer-fade-in');
  els.viewerImage.alt = `${photo.type} progress photo from ${photo.date}`;
  els.photoViewerTitle.textContent = `${photo.type} Photo`;
  els.photoViewerMeta.textContent = `${formatDateLong(photo.date)} • ${activePhotoIndex + 1} of ${state.photos.length}`;
  els.viewerPrev.disabled = state.photos.length <= 1;
  els.viewerNext.disabled = state.photos.length <= 1;
}

function movePhotoViewer(direction) {
  if (!state.photos?.length) return;
  activePhotoIndex = (activePhotoIndex + direction + state.photos.length) % state.photos.length;
  resetViewerZoom();
  updatePhotoViewer();
  haptic('medium');
}


function resetViewerZoom() {
  viewerScale = 1;
  viewerTranslateX = 0;
  viewerTranslateY = 0;
  applyViewerTransform();
}

function applyViewerTransform() {
  if (!els.viewerImage) return;
  els.viewerImage.style.transform = `translate(${viewerTranslateX}px, ${viewerTranslateY}px) scale(${viewerScale})`;
  els.viewerImage.classList.toggle('is-zoomed', viewerScale > 1.02);
}

function clampViewerPan() {
  if (viewerScale <= 1) {
    viewerTranslateX = 0;
    viewerTranslateY = 0;
    return;
  }
  const maxX = 120 * viewerScale;
  const maxY = 160 * viewerScale;
  viewerTranslateX = Math.max(-maxX, Math.min(maxX, viewerTranslateX));
  viewerTranslateY = Math.max(-maxY, Math.min(maxY, viewerTranslateY));
}

function handleViewerPointerDown(e) {
  if (els.photoViewer?.classList.contains('hidden')) return;
  isDraggingPhoto = true;
  dragStartX = dragLastX = e.clientX;
  dragStartY = dragLastY = e.clientY;
  els.viewerImage?.setPointerCapture?.(e.pointerId);
}

function handleViewerPointerMove(e) {
  if (!isDraggingPhoto || els.photoViewer?.classList.contains('hidden')) return;
  const dx = e.clientX - dragLastX;
  const dy = e.clientY - dragLastY;
  dragLastX = e.clientX;
  dragLastY = e.clientY;

  if (viewerScale > 1.02) {
    viewerTranslateX += dx;
    viewerTranslateY += dy;
    clampViewerPan();
    applyViewerTransform();
  }
}

function handleViewerPointerUp(e) {
  if (!isDraggingPhoto) return;
  isDraggingPhoto = false;
  const totalDx = dragLastX - dragStartX;
  const totalDy = dragLastY - dragStartY;

  if (viewerScale <= 1.02 && Math.abs(totalDx) > 54 && Math.abs(totalDx) > Math.abs(totalDy) * 1.4) {
    movePhotoViewer(totalDx < 0 ? 1 : -1);
  }
}

function handleViewerWheel(e) {
  if (els.photoViewer?.classList.contains('hidden')) return;
  e.preventDefault();
  const delta = e.deltaY < 0 ? 0.12 : -0.12;
  viewerScale = Math.max(1, Math.min(4, viewerScale + delta));
  if (viewerScale === 1) {
    viewerTranslateX = 0;
    viewerTranslateY = 0;
  }
  clampViewerPan();
  applyViewerTransform();
}

function handleViewerTouchStart(e) {
  if (els.photoViewer?.classList.contains('hidden')) return;
  if (e.touches.length === 2) {
    pinchStartDistance = getTouchDistance(e.touches[0], e.touches[1]);
    pinchStartScale = viewerScale;
  } else if (e.touches.length === 1) {
    dragStartX = dragLastX = e.touches[0].clientX;
    dragStartY = dragLastY = e.touches[0].clientY;
  }
}

function handleViewerTouchMove(e) {
  if (els.photoViewer?.classList.contains('hidden')) return;
  if (e.touches.length === 2) {
    e.preventDefault();
    const currentDistance = getTouchDistance(e.touches[0], e.touches[1]);
    const nextScale = pinchStartScale * (currentDistance / Math.max(1, pinchStartDistance));
    viewerScale = Math.max(1, Math.min(4, nextScale));
    if (viewerScale === 1) {
      viewerTranslateX = 0;
      viewerTranslateY = 0;
    }
    clampViewerPan();
    applyViewerTransform();
  } else if (e.touches.length === 1 && viewerScale > 1.02) {
    e.preventDefault();
    const touch = e.touches[0];
    viewerTranslateX += touch.clientX - dragLastX;
    viewerTranslateY += touch.clientY - dragLastY;
    dragLastX = touch.clientX;
    dragLastY = touch.clientY;
    clampViewerPan();
    applyViewerTransform();
  }
}

function handleViewerTouchEnd(e) {
  if (e.touches.length > 0) return;
  const totalDx = dragLastX - dragStartX;
  const totalDy = dragLastY - dragStartY;
  if (viewerScale <= 1.02 && Math.abs(totalDx) > 54 && Math.abs(totalDx) > Math.abs(totalDy) * 1.4) {
    movePhotoViewer(totalDx < 0 ? 1 : -1);
  }
}

function getTouchDistance(a, b) {
  const dx = a.clientX - b.clientX;
  const dy = a.clientY - b.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}


function deleteActiveViewerPhoto() {
  const photo = state.photos?.[activePhotoIndex];
  if (!photo) return;
  if (!confirm('Delete this progress photo?')) return;
  state.photos = state.photos.filter(p => p.id !== photo.id);
  saveState();
  renderPhotos();
  if (!state.photos.length) {
    closePhotoViewer();
  } else {
    activePhotoIndex = Math.min(activePhotoIndex, state.photos.length - 1);
    updatePhotoViewer();
  }
  showToast('Photo deleted');
}

function handleViewerKeydown(e) {
  if (els.photoViewer?.classList.contains('hidden')) return;
  if (e.key === 'Escape') closePhotoViewer();
  if (e.key === 'ArrowLeft') movePhotoViewer(-1);
  if (e.key === 'ArrowRight') movePhotoViewer(1);
}

function handleSaveWeeklyReview(e) {
  e.preventDefault();
  const weekKey = getWeekKey();
  const entry = Object.fromEntries(new FormData(els.weeklyForm).entries());
  const hasData = Object.values(entry).some(v => String(v || '').trim() !== '');
  if (!hasData) return showToast('Add something to your review');
  state.weeklyReviews = state.weeklyReviews || {};
  state.weeklyReviews[weekKey] = { weekKey, date: isoToday(), ...entry };
  saveState();
  haptic('success');
  renderWeeklyReviews();
  showToast('Weekly review saved');
}

function renderWeeklyReviews() {
  if (!els.weeklyList) return;
  state.weeklyReviews = state.weeklyReviews || {};
  const current = state.weeklyReviews[getWeekKey()] || {};
  ['rating', 'wins', 'improve', 'focus'].forEach(name => {
    const field = els.weeklyForm?.elements[name];
    if (field) field.value = current[name] || '';
  });
  const items = Object.values(state.weeklyReviews).sort((a, b) => b.weekKey.localeCompare(a.weekKey)).slice(0, 5);
  els.weeklyList.innerHTML = items.length ? '' : '<div class="empty">No weekly reviews saved yet.</div>';
  items.forEach(item => {
    const card = document.createElement('div');
    card.className = 'weekly-review-card';
    card.innerHTML = `<div class="weekly-review-head"><strong>Week of ${formatDateLong(item.weekKey)}</strong><span>${item.rating ? item.rating + '/10' : '—'}</span></div>${item.wins ? `<p><b>Wins:</b> ${escapeHtml(item.wins)}</p>` : ''}${item.improve ? `<p><b>Needs work:</b> ${escapeHtml(item.improve)}</p>` : ''}${item.focus ? `<p><b>Next focus:</b> ${escapeHtml(item.focus)}</p>` : ''}`;
    els.weeklyList.appendChild(card);
  });
}

function getWeekKey() {
  const dt = localDateStringToDate(isoToday());
  dt.setDate(dt.getDate() - dt.getDay());
  return toLocalISO(dt);
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[ch]));
}




function renderBeforeAfterOptions() {
  if (!els.beforePhotoSelect || !els.afterPhotoSelect) return;
  state.photos = state.photos || [];

  const currentBefore = els.beforePhotoSelect.value;
  const currentAfter = els.afterPhotoSelect.value;

  const sorted = getPhotosOldestToNewest();
  const options = sorted.map((photo) => {
    const label = `${photo.type} • ${formatDateLong(photo.date)}`;
    return `<option value="${photo.id}">${label}</option>`;
  }).join('');

  els.beforePhotoSelect.innerHTML = options || '<option value="">No photos yet</option>';
  els.afterPhotoSelect.innerHTML = options || '<option value="">No photos yet</option>';

  if (state.photos.length >= 2) {
    const hasBefore = currentBefore && state.photos.some(p => String(p.id) === String(currentBefore));
    const hasAfter = currentAfter && state.photos.some(p => String(p.id) === String(currentAfter));

    if (hasBefore && hasAfter) {
      els.beforePhotoSelect.value = currentBefore;
      els.afterPhotoSelect.value = currentAfter;
    } else {
      autoSelectComparePhotos(false);
    }
  }

  renderBeforeAfterCompare();
}

function getPhotosOldestToNewest() {
  return [...(state.photos || [])].sort((a, b) => {
    const byDate = String(a.date).localeCompare(String(b.date));
    if (byDate !== 0) return byDate;
    return Number(a.id || 0) - Number(b.id || 0);
  });
}

function autoSelectComparePhotos(showMessage = false) {
  const sorted = getPhotosOldestToNewest();
  if (sorted.length < 2) {
    if (showMessage) showToast('Add at least 2 photos first');
    return;
  }
  const before = sorted[0];
  const after = sorted[sorted.length - 1];
  els.beforePhotoSelect.value = String(before.id);
  els.afterPhotoSelect.value = String(after.id);
  if (showMessage) {
    haptic('success');
    showToast('Oldest and newest photos selected');
  }
}

function setCompareMode(mode) {
  compareMode = mode === 'side' ? 'side' : 'slider';
  els.compareModeBtns?.forEach(btn => btn.classList.toggle('active', btn.dataset.mode === compareMode));
  renderBeforeAfterCompare();
  haptic('light');
}


function renderBeforeAfterCompare() {
  if (!els.compareStage) return;
  state.photos = state.photos || [];
  const before = state.photos.find(p => String(p.id) === String(els.beforePhotoSelect?.value));
  const after = state.photos.find(p => String(p.id) === String(els.afterPhotoSelect?.value));

  if (!before || !after || state.photos.length < 2) {
    els.compareStage.classList.add('empty-compare');
    els.compareSideBySide?.classList.add('hidden');
    return;
  }

  els.compareStage.classList.remove('empty-compare');
  els.beforeCompareImage.src = before.dataUrl;
  els.afterCompareImage.src = after.dataUrl;
  if (els.beforeSideImage) els.beforeSideImage.src = before.dataUrl;
  if (els.afterSideImage) els.afterSideImage.src = after.dataUrl;

  const isSide = compareMode === 'side';
  els.compareStage.classList.toggle('hidden', isSide);
  els.compareSideBySide?.classList.toggle('hidden', !isSide);
  updateCompareSlider();
}

function updateCompareSlider() {
  if (!els.compareSlider || !els.afterCompareWrap || !els.compareHandle) return;
  const value = Number(els.compareSlider.value || 50);
  els.afterCompareWrap.style.clipPath = `inset(0 0 0 ${value}%)`;
  els.compareHandle.style.left = `${value}%`;
}

function renderWeeklyAutoSummary() {
  if (!els.summaryWeight) return;

  const today = isoToday();
  const start = getWeekKey();
  const end = addDays(start, 6);
  const weekEntries = getSortedCheckins().filter(entry => entry.date >= start && entry.date <= end);

  const weights = weekEntries
    .filter(entry => entry.weight !== '' && !isNaN(Number(entry.weight)))
    .map(entry => ({ date: entry.date, weight: Number(entry.weight) }));

  let weightText = '—';
  if (weights.length >= 2) {
    const change = weights[weights.length - 1].weight - weights[0].weight;
    weightText = `${change > 0 ? '+' : ''}${change.toFixed(1)} lb`;
  } else if (weights.length === 1) {
    weightText = '1 weigh-in';
  }

  const daysSoFar = Math.max(1, Math.min(7, daysBetween(start, today) + 1));
  const successCount = weekEntries.filter(entry => entry.success).length;
  const streakPct = Math.round((successCount / daysSoFar) * 100);

  const possibleHabits = daysSoFar * HABITS.length;
  const hitHabits = weekEntries.reduce((total, entry) => {
    const habits = entry.habits || {};
    return total + Object.values(habits).filter(Boolean).length;
  }, 0);
  const habitPct = possibleHabits ? Math.round((hitHabits / possibleHabits) * 100) : 0;

  els.summaryWeight.textContent = weightText;
  els.summaryStreak.textContent = `${streakPct}%`;
  els.summaryHabits.textContent = `${habitPct}%`;

  let note = `This week: ${successCount}/${daysSoFar} successful days and ${hitHabits}/${possibleHabits} habits hit.`;
  if (weights.length >= 2) {
    const change = weights[weights.length - 1].weight - weights[0].weight;
    if (change < 0) note += ' Weight is trending down this week.';
    if (change > 0) note += ' Weight is up this week — check calories, sodium, and consistency.';
    if (change === 0) note += ' Weight is steady this week.';
  }
  els.summaryNote.textContent = note;
}



function exportData() {
  const backup = {
    app: 'Cut Tracker Pro',
    version: 2,
    exportedAt: new Date().toISOString(),
    data: state
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cut-tracker-pro-backup-${isoToday()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  haptic('light');
  showToast('Backup exported');
}

function handleImportBackup(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      const imported = parsed.data || parsed;
      if (!imported || typeof imported !== 'object' || !imported.checkins) {
        showToast('Not a valid backup file');
        return;
      }
      if (!confirm('Import this backup and replace current app data?')) return;
      state = {
        ...initialState(),
        ...imported,
        habitsToday: imported.habitsToday || initialState().habitsToday,
        checkins: imported.checkins || {},
        measurements: imported.measurements || {},
        photos: imported.photos || [],
        weeklyReviews: imported.weeklyReviews || {}
      };
      saveState();
      renderAll();
      haptic('success');
      showToast('Backup imported');
    } catch {
      showToast('Could not read backup');
    } finally {
      e.target.value = '';
    }
  };
  reader.readAsText(file);
}

function handleBackupReminder() {
  const today = isoToday();
  localStorage.setItem('cut-tracker-pro-last-backup-reminder', today);
  showToast('Backup reminder noted — export weekly');
  haptic('light');
}

function getSelectedComparePhotos() {
  const before = state.photos?.find(p => String(p.id) === String(els.beforePhotoSelect?.value));
  const after = state.photos?.find(p => String(p.id) === String(els.afterPhotoSelect?.value));
  return { before, after };
}

async function createShareImage() {
  const { before, after } = getSelectedComparePhotos();
  if (!before || !after) {
    showToast('Pick two photos first');
    return;
  }
  showToast('Creating share image...');
  try {
    const [beforeImg, afterImg] = await Promise.all([loadImage(before.dataUrl), loadImage(after.dataUrl)]);
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1350;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, '#061123');
    grad.addColorStop(1, '#02060f');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#eef4ff';
    ctx.font = '800 64px Inter, system-ui, sans-serif';
    ctx.fillText('Cut Tracker Pro', 64, 96);
    ctx.fillStyle = 'rgba(238,244,255,.68)';
    ctx.font = '500 30px Inter, system-ui, sans-serif';
    ctx.fillText(compareMode === 'side' ? 'Side-by-Side Transformation' : 'Before / After Transformation', 64, 142);

    const imgY = 220;
    const imgW = 464;
    const imgH = 760;
    drawCoverImage(ctx, beforeImg, 64, imgY, imgW, imgH, 36);
    drawCoverImage(ctx, afterImg, 552, imgY, imgW, imgH, 36);

    drawImageLabel(ctx, 'BEFORE', 88, imgY + 42);
    drawImageLabel(ctx, 'AFTER', 576, imgY + 42);

    ctx.fillStyle = '#eef4ff';
    ctx.font = '800 38px Inter, system-ui, sans-serif';
    ctx.fillText(formatDateLong(before.date), 64, 1048);
    ctx.fillText(formatDateLong(after.date), 552, 1048);

    const summary = buildShareSummary();
    ctx.fillStyle = 'rgba(16, 28, 48, .82)';
    roundRect(ctx, 64, 1100, 952, 150, 32);
    ctx.fill();

    ctx.fillStyle = '#bfdbfe';
    ctx.font = '800 30px Inter, system-ui, sans-serif';
    ctx.fillText(summary.title, 104, 1152);
    ctx.fillStyle = 'rgba(238,244,255,.78)';
    ctx.font = '500 28px Inter, system-ui, sans-serif';
    ctx.fillText(summary.subtitle, 104, 1198);

    ctx.fillStyle = 'rgba(238,244,255,.52)';
    ctx.font = '500 24px Inter, system-ui, sans-serif';
    ctx.fillText('Generated with Cut Tracker Pro', 64, 1292);

    generatedShareBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png', 0.95));
    if (generatedShareUrl) URL.revokeObjectURL(generatedShareUrl);
    generatedShareUrl = URL.createObjectURL(generatedShareBlob);
    els.sharePreview.src = generatedShareUrl;
    els.shareSheet.classList.remove('hidden');
    els.shareSheet.setAttribute('aria-hidden', 'false');
    haptic('success');
  } catch {
    showToast('Could not create image');
  }
}

function buildShareSummary() {
  const entries = getSortedCheckins().filter(e => e.weight !== '' && !isNaN(Number(e.weight)));
  if (entries.length >= 2) {
    const change = Number(entries[entries.length - 1].weight) - Number(entries[0].weight);
    return {
      title: `${change > 0 ? '+' : ''}${change.toFixed(1)} lb total change`,
      subtitle: `${entries.length} weigh-ins tracked`
    };
  }
  return {
    title: 'Transformation in progress',
    subtitle: 'Consistency, photos, and weekly reviews'
  };
}

function closeShareSheet() {
  els.shareSheet?.classList.add('hidden');
  els.shareSheet?.setAttribute('aria-hidden', 'true');
}

function downloadShareImage() {
  if (!generatedShareUrl) return showToast('Create image first');
  const a = document.createElement('a');
  a.href = generatedShareUrl;
  a.download = `cut-tracker-before-after-${isoToday()}.png`;
  a.click();
  showToast('Share image downloaded');
}

async function nativeShareImage() {
  if (!generatedShareBlob) return showToast('Create image first');
  const file = new File([generatedShareBlob], `cut-tracker-before-after-${isoToday()}.png`, { type: 'image/png' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    await navigator.share({ files: [file], title: 'Cut Tracker Pro', text: 'My before/after progress' });
  } else {
    downloadShareImage();
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function drawCoverImage(ctx, img, x, y, w, h, r) {
  ctx.save();
  roundRect(ctx, x, y, w, h, r);
  ctx.clip();
  const scale = Math.max(w / img.width, h / img.height);
  const iw = img.width * scale;
  const ih = img.height * scale;
  ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
  ctx.restore();
}

function drawImageLabel(ctx, text, x, y) {
  ctx.fillStyle = 'rgba(2, 6, 15, .72)';
  roundRect(ctx, x - 14, y - 34, 140, 48, 18);
  ctx.fill();
  ctx.fillStyle = '#eef4ff';
  ctx.font = '800 24px Inter, system-ui, sans-serif';
  ctx.fillText(text, x, y);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}



function maybeShowBackupReminder() {
  const last = localStorage.getItem('cut-tracker-pro-last-backup-reminder');
  if (!last) return;
  if (daysBetween(last, isoToday()) >= 7) {
    setTimeout(() => showToast('Reminder: export a backup this week'), 900);
  }
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


// === Today Lock ===
function lockToday() {
  const today = isoToday();
  state.lockedDays = state.lockedDays || {};
  state.lockedDays[today] = true;
  saveState();
  showToast('Today locked');
}

function isTodayLocked() {
  return state.lockedDays?.[isoToday()];
}

// === Smart Insights ===
function getInsights() {
  const entries = getSortedCheckins();
  if (!entries.length) return 'Start tracking to unlock insights';
  const last7 = entries.slice(-7);
  const success = last7.filter(e => e.success).length;
  return `You completed ${success}/7 successful days this week`;
}

// === Simple Chart Upgrade (weight trend) ===
function drawSimpleTrend() {
  const canvas = document.getElementById('progressChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const data = getSortedCheckins().map(e => Number(e.weight)).filter(n => !isNaN(n));
  if (data.length < 2) return;

  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.beginPath();
  data.forEach((v,i)=>{
    const x = (i/(data.length-1))*canvas.width;
    const y = canvas.height - (v/Math.max(...data))*canvas.height;
    if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  });
  ctx.strokeStyle = '#60a5fa';
  ctx.lineWidth = 2;
  ctx.stroke();
}
