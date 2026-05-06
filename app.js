'use strict';

// ── CONSTANTS ──────────────────────────────────────────────────────────────────
const MONTHS_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                   'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const STORAGE_KEY = 'crmps_v1';

// ── HELPERS ────────────────────────────────────────────────────────────────────
function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function currentMonthKey() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

function monthKeyFromDate(dateStr) {
  return dateStr.slice(0, 7);
}

function monthLabel(key) {
  const [y, m] = key.split('-');
  return MONTHS_PT[parseInt(m) - 1] + ' ' + y;
}

function shortMonthLabel(key) {
  const [y, m] = key.split('-');
  return MONTHS_PT[parseInt(m) - 1].slice(0, 3) + ' \'' + y.slice(2);
}

function fmtEur(v) {
  return (parseFloat(v) || 0).toLocaleString('pt-PT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }) + ' €';
}

function fmtDatePT(dateStr) {
  const [y, m, d] = dateStr.split('-');
  return d + '/' + m + '/' + y;
}

function fmtDayLabel(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' });
}

// ── DATA LAYER ─────────────────────────────────────────────────────────────────
function loadData() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// ── TOAST ──────────────────────────────────────────────────────────────────────
let toastTimer;
function showToast(msg, icon = 'ti-check') {
  const el = document.getElementById('toast');
  el.innerHTML = `<i class="ti ${icon}"></i> ${msg}`;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
}

// ── SIDEBAR ────────────────────────────────────────────────────────────────────
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebarOverlay').classList.toggle('open');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('open');
}

// ── VIEW SWITCHING ─────────────────────────────────────────────────────────────
function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  document.getElementById('view-' + name).classList.add('active');
  document.querySelector(`[data-view="${name}"]`).classList.add('active');
  closeSidebar();

  if (name === 'registos') renderRegistos();
  if (name === 'movimentos') renderMovimentos();
  if (name === 'dashboard') renderDashboard();
}

// ── DATE FIELD INIT ────────────────────────────────────────────────────────────
function initDateField() {
  const el = document.getElementById('inDate');
  el.value = getToday();
  el.max = getToday();
  updateDateHint();
  el.addEventListener('change', updateDateHint);

  const filterEl = document.getElementById('filterDate');
  filterEl.max = getToday();
}

function updateDateHint() {
  const val = document.getElementById('inDate').value;
  const hint = document.getElementById('dateHint');
  const today = getToday();
  if (!val) { hint.textContent = ''; return; }
  if (val === today) {
    hint.className = 'date-hint';
    hint.innerHTML = '<i class="ti ti-circle-check"></i> Hoje — ' + fmtDatePT(today);
  } else {
    hint.className = 'date-hint retro';
    hint.innerHTML = '<i class="ti ti-clock-back"></i> Registo retroativo — ' + fmtDatePT(val);
  }
}

// ── ADD ENTRY ──────────────────────────────────────────────────────────────────
function addEntry() {
  const dateVal = document.getElementById('inDate').value;
  if (!dateVal) { showToast('Selecione a data do movimento.', 'ti-alert-circle'); return; }
  if (dateVal > getToday()) { showToast('Não é possível registar datas futuras.', 'ti-alert-circle'); return; }

  const mb  = parseFloat(document.getElementById('inMB').value)  || 0;
  const num = parseFloat(document.getElementById('inNum').value) || 0;
  const mbw = parseFloat(document.getElementById('inMBW').value) || 0;
  if (mb === 0 && num === 0 && mbw === 0) {
    showToast('Introduza pelo menos um valor.', 'ti-alert-circle'); return;
  }

  const mk = monthKeyFromDate(dateVal);
  const data = loadData();
  if (!data[mk]) data[mk] = { entries: [] };
  data[mk].entries.push({ date: dateVal, mb, num, mbw, ts: Date.now() });
  saveData(data);

  document.getElementById('inMB').value = '';
  document.getElementById('inNum').value = '';
  document.getElementById('inMBW').value = '';
  document.getElementById('inDate').value = getToday();
  updateDateHint();

  const retroMsg = dateVal < getToday() ? ' (retroativo ' + fmtDatePT(dateVal) + ')' : '';
  showToast('Entrada registada com sucesso' + retroMsg + '!');
  renderRegistos();
}

// ── DELETE ENTRY ───────────────────────────────────────────────────────────────
function deleteEntry(mk, idx) {
  if (!confirm('Apagar este registo?')) return;
  const data = loadData();
  data[mk].entries.splice(idx, 1);
  saveData(data);
  showToast('Registo apagado.', 'ti-trash');
  renderRegistos();
  renderMovimentos();
}

// ── NEW MONTH ──────────────────────────────────────────────────────────────────
function confirmReset() {
  if (confirm('Iniciar controlo do novo mês?\n\nOs dados do mês atual ficam guardados no histórico. Confirma?')) {
    showToast('Histórico preservado. Pode iniciar o novo mês!', 'ti-check');
    renderRegistos();
  }
}

// ── COMPUTE MONTH TOTALS ───────────────────────────────────────────────────────
function computeTotals(entries) {
  return entries.reduce((acc, e) => {
    acc.mb  += e.mb;
    acc.num += e.num;
    acc.mbw += e.mbw;
    return acc;
  }, { mb: 0, num: 0, mbw: 0 });
}

function summaryHTML(totals) {
  const total = totals.mb + totals.num + totals.mbw;
  return `
    <div class="sum-row">
      <span class="sum-label"><span class="sum-dot" style="background:#2563EB"></span>Multibanco</span>
      <span class="sum-value">${fmtEur(totals.mb)}</span>
    </div>
    <div class="sum-row">
      <span class="sum-label"><span class="sum-dot" style="background:#16A34A"></span>Numerário</span>
      <span class="sum-value">${fmtEur(totals.num)}</span>
    </div>
    <div class="sum-row">
      <span class="sum-label"><span class="sum-dot" style="background:#D97706"></span>MBWay</span>
      <span class="sum-value">${fmtEur(totals.mbw)}</span>
    </div>
    <div class="sum-row">
      <span class="sum-label">Total</span>
      <span class="sum-value">${fmtEur(total)}</span>
    </div>`;
}

// ── RENDER: REGISTOS ───────────────────────────────────────────────────────────
function renderRegistos() {
  const data = loadData();
  const mk = currentMonthKey();
  const entries = (data[mk] || {}).entries || [];
  const today = getToday();

  // Sidebar & topbar month labels
  document.getElementById('sidebarMonth').textContent = monthLabel(mk);
  document.getElementById('topbarMonth').textContent = monthLabel(mk);

  // Page sub
  const d = new Date();
  document.getElementById('regDateSub').textContent =
    d.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  // Today metrics
  const todayEntries = entries.filter(e => e.date === today);
  const todayTotals  = computeTotals(todayEntries);
  const monthTotals  = computeTotals(entries);
  const todayTotal   = todayTotals.mb + todayTotals.num + todayTotals.mbw;

  document.getElementById('metricsToday').innerHTML = `
    <div class="metric-card highlight">
      <div class="metric-label"><i class="ti ti-sun" style="font-size:13px"></i> Total hoje</div>
      <div class="metric-value">${fmtEur(todayTotal)}</div>
      <div class="metric-sub">${fmtDatePT(today)}</div>
    </div>
    <div class="metric-card">
      <div class="metric-label"><i class="ti ti-credit-card" style="font-size:13px"></i> Multibanco</div>
      <div class="metric-value">${fmtEur(todayTotals.mb)}</div>
    </div>
    <div class="metric-card">
      <div class="metric-label"><i class="ti ti-cash" style="font-size:13px"></i> Numerário</div>
      <div class="metric-value">${fmtEur(todayTotals.num)}</div>
    </div>
    <div class="metric-card">
      <div class="metric-label"><i class="ti ti-device-mobile" style="font-size:13px"></i> MBWay</div>
      <div class="metric-value">${fmtEur(todayTotals.mbw)}</div>
    </div>`;

  // Month summary
  document.getElementById('monthSummary').innerHTML = summaryHTML(monthTotals);
}

// ── RENDER: MOVIMENTOS ─────────────────────────────────────────────────────────
function clearFilter() {
  document.getElementById('filterDate').value = '';
  renderMovimentos();
}

function renderMovimentos() {
  const data = loadData();
  const mk = currentMonthKey();
  const allEntries = (data[mk] || {}).entries || [];
  const today = getToday();
  const filterDate = document.getElementById('filterDate').value;

  document.getElementById('movDateSub').textContent = monthLabel(mk);

  const entries = filterDate
    ? allEntries.map((e, i) => ({ ...e, idx: i })).filter(e => e.date === filterDate)
    : allEntries.map((e, i) => ({ ...e, idx: i }));

  // Group by day
  const byDay = {};
  entries.forEach(e => {
    if (!byDay[e.date]) byDay[e.date] = [];
    byDay[e.date].push(e);
  });
  const sortedDays = Object.keys(byDay).sort().reverse();

  let html = '';
  if (sortedDays.length === 0) {
    html = `<div class="empty-state"><i class="ti ti-inbox"></i>${filterDate ? 'Sem registos para ' + fmtDatePT(filterDate) : 'Sem movimentos neste mês.'}</div>`;
    document.getElementById('movTable').innerHTML = html;
    document.getElementById('monthSummary2').innerHTML = summaryHTML({ mb: 0, num: 0, mbw: 0 });
    return;
  }

  html = '<table class="mov-table"><thead><tr><th>Data / Hora</th><th>Método</th><th style="text-align:right">Valor</th><th></th></tr></thead><tbody>';

  sortedDays.forEach(day => {
    const isRetro = day < today;
    const label = fmtDayLabel(day);
    const dayTotals = computeTotals(byDay[day]);
    const dayTotal = dayTotals.mb + dayTotals.num + dayTotals.mbw;

    html += `<tr class="day-group-row"><td colspan="4">${label}${isRetro ? ' <span class="badge badge-retro"><i class="ti ti-clock-back" style="font-size:10px"></i> retroativo</span>' : ''}</td></tr>`;

    byDay[day].forEach(e => {
      const t = new Date(e.ts).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
      const dateCell = `<span style="color:var(--text-muted)">${fmtDatePT(e.date)} ${t}</span>`;

      if (e.mb > 0)  html += `<tr><td>${dateCell}</td><td><span class="badge badge-mb"><i class="ti ti-credit-card" style="font-size:10px"></i> Multibanco</span></td><td style="text-align:right;font-family:'DM Serif Display',serif;font-size:15px">${fmtEur(e.mb)}</td><td><button class="del-btn" onclick="deleteEntry('${mk}',${e.idx})" title="Apagar"><i class="ti ti-trash"></i></button></td></tr>`;
      if (e.num > 0) html += `<tr><td>${dateCell}</td><td><span class="badge badge-num"><i class="ti ti-cash" style="font-size:10px"></i> Numerário</span></td><td style="text-align:right;font-family:'DM Serif Display',serif;font-size:15px">${fmtEur(e.num)}</td><td><button class="del-btn" onclick="deleteEntry('${mk}',${e.idx})" title="Apagar"><i class="ti ti-trash"></i></button></td></tr>`;
      if (e.mbw > 0) html += `<tr><td>${dateCell}</td><td><span class="badge badge-mbw"><i class="ti ti-device-mobile" style="font-size:10px"></i> MBWay</span></td><td style="text-align:right;font-family:'DM Serif Display',serif;font-size:15px">${fmtEur(e.mbw)}</td><td><button class="del-btn" onclick="deleteEntry('${mk}',${e.idx})" title="Apagar"><i class="ti ti-trash"></i></button></td></tr>`;
    });

    html += `<tr class="day-total-row"><td colspan="2" style="color:var(--text-muted);font-size:12px">Total do dia</td><td style="text-align:right;font-family:'DM Serif Display',serif;font-size:16px">${fmtEur(dayTotal)}</td><td></td></tr>`;
  });

  html += '</tbody></table>';
  document.getElementById('movTable').innerHTML = html;

  const monthTotals = computeTotals(allEntries);
  document.getElementById('monthSummary2').innerHTML = summaryHTML(monthTotals);
}

// ── RENDER: DASHBOARD ──────────────────────────────────────────────────────────
let dashChartInstance = null;
let selectedDashMonth = null;

function renderDashboard() {
  const data = loadData();
  const keys = Object.keys(data).sort();

  if (keys.length === 0) {
    document.getElementById('dashMonths').innerHTML = '<span style="font-size:13px;color:var(--text-muted)">Sem dados históricos ainda. Registe as primeiras entradas!</span>';
    document.getElementById('dashDetailContent').innerHTML = '';
    if (dashChartInstance) { dashChartInstance.destroy(); dashChartInstance = null; }
    return;
  }

  if (!selectedDashMonth || !keys.includes(selectedDashMonth)) {
    selectedDashMonth = keys[keys.length - 1];
  }

  // Month chips
  document.getElementById('dashMonths').innerHTML = keys.map(k =>
    `<button class="month-chip${k === selectedDashMonth ? ' active' : ''}" onclick="selectDashMonth('${k}')">${monthLabel(k)}</button>`
  ).join('');

  // Chart data
  const labels  = keys.map(k => shortMonthLabel(k));
  const mbVals  = keys.map(k => +((data[k].entries || []).reduce((s, e) => s + e.mb,  0)).toFixed(2));
  const numVals = keys.map(k => +((data[k].entries || []).reduce((s, e) => s + e.num, 0)).toFixed(2));
  const mbwVals = keys.map(k => +((data[k].entries || []).reduce((s, e) => s + e.mbw, 0)).toFixed(2));

  const ctx = document.getElementById('dashChart').getContext('2d');
  if (dashChartInstance) dashChartInstance.destroy();
  dashChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Multibanco', data: mbVals,  backgroundColor: '#2563EB', borderRadius: 4 },
        { label: 'Numerário',  data: numVals, backgroundColor: '#16A34A', borderRadius: 4 },
        { label: 'MBWay',      data: mbwVals, backgroundColor: '#D97706', borderRadius: 4 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          stacked: true,
          ticks: { autoSkip: false, maxRotation: 45, font: { size: 11, family: 'DM Sans' } },
          grid: { display: false }
        },
        y: {
          stacked: true,
          ticks: {
            callback: v => v.toLocaleString('pt-PT') + ' €',
            font: { size: 11, family: 'DM Sans' }
          },
          grid: { color: 'rgba(0,0,0,0.05)' }
        }
      }
    }
  });

  showDashDetail(selectedDashMonth, data);
}

function selectDashMonth(mk) {
  selectedDashMonth = mk;
  renderDashboard();
}

function showDashDetail(mk, data) {
  const entries = (data[mk] || {}).entries || [];
  const totals = computeTotals(entries);
  document.getElementById('dashDetailContent').innerHTML = `
    <div style="font-family:'DM Serif Display',serif;font-size:16px;margin-bottom:1rem">${monthLabel(mk)}</div>
    ${summaryHTML(totals)}
    <div style="margin-top:0.75rem;font-size:12px;color:var(--text-muted)">${entries.length} registo(s) neste mês</div>`;
}

// ── EXPORT / IMPORT ────────────────────────────────────────────────────────────
function exportData() {
  const data = loadData();
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = 'receitas-petshop-' + getToday() + '.json';
  a.click();
  URL.revokeObjectURL(url);
  showToast('Dados exportados com sucesso!');
}

function importData(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const imported = JSON.parse(e.target.result);
      if (typeof imported !== 'object') throw new Error();
      const existing = loadData();
      // Merge: imported months are added/overwritten
      const merged = { ...existing, ...imported };
      // But for months that exist in both, merge entries
      Object.keys(imported).forEach(mk => {
        if (existing[mk]) {
          const existingTs = new Set(existing[mk].entries.map(x => x.ts));
          const newEntries = (imported[mk].entries || []).filter(x => !existingTs.has(x.ts));
          merged[mk] = { entries: [...existing[mk].entries, ...newEntries] };
        }
      });
      saveData(merged);
      showToast('Dados importados com sucesso!');
      renderRegistos();
    } catch {
      showToast('Ficheiro inválido. Tente novamente.', 'ti-alert-circle');
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

// ── INIT ───────────────────────────────────────────────────────────────────────
initDateField();
renderRegistos();
