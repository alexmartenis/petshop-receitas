'use strict';

const MONTHS_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                   'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const STORAGE_KEY = 'crmps_v1';
const IVA_RATE    = 0.23;

// ── DATE HELPERS ───────────────────────────────────────────────────────────────
function getToday()        { return new Date().toISOString().slice(0,10); }
function currentMonthKey() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
}
function monthKeyFromDate(s) { return s.slice(0,7); }
function monthLabel(k) {
  const [y,m] = k.split('-');
  return MONTHS_PT[parseInt(m)-1] + ' ' + y;
}
function shortMonthLabel(k) {
  const [y,m] = k.split('-');
  return MONTHS_PT[parseInt(m)-1].slice(0,3) + ' \'' + y.slice(2);
}
function fmtEur(v) {
  return (parseFloat(v)||0).toLocaleString('pt-PT',{minimumFractionDigits:2,maximumFractionDigits:2}) + ' €';
}
function fmtDatePT(s) {
  if (!s) return '';
  const [y,m,d] = s.split('-');
  return d+'/'+m+'/'+y;
}
function fmtDayLabel(s) {
  return new Date(s+'T12:00:00').toLocaleDateString('pt-PT',{weekday:'long',day:'numeric',month:'long'});
}
function quarterOf(mk) {
  return Math.ceil(parseInt(mk.split('-')[1])/3);
}
function quarterKeys(mk) {
  const [y,m] = mk.split('-').map(Number);
  const q = Math.ceil(m/3);
  const start = (q-1)*3+1;
  return [0,1,2].map(i => y+'-'+String(start+i).padStart(2,'0'));
}

// ── DATA LAYER ─────────────────────────────────────────────────────────────────
function loadData() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
  catch { return {}; }
}
function saveData(d) { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); }

function getMonth(mk) {
  const d = loadData();
  if (!d[mk]) d[mk] = { entries: [], despesas: [] };
  return d[mk];
}
function saveMonth(mk, month) {
  const d = loadData();
  d[mk] = month;
  saveData(d);
}

// ── TOAST ──────────────────────────────────────────────────────────────────────
let toastTimer;
function showToast(msg, icon='ti-check') {
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

// ── VIEW ───────────────────────────────────────────────────────────────────────
function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  document.getElementById('view-'+name).classList.add('active');
  document.querySelector(`[data-view="${name}"]`).classList.add('active');
  closeSidebar();
  if (name==='registos')   renderRegistos();
  if (name==='despesas')   renderDespesas();
  if (name==='movimentos') renderMovimentos();
  if (name==='dashboard')  renderDashboard();
}

// ── DATE FIELD ─────────────────────────────────────────────────────────────────
function initDateField() {
  const el = document.getElementById('inDate');
  el.value = getToday();
  el.max   = getToday();
  updateDateHint();
  el.addEventListener('change', updateDateHint);
  document.getElementById('filterDate').max = getToday();
}
function updateDateHint() {
  const val  = document.getElementById('inDate').value;
  const hint = document.getElementById('dateHint');
  const today = getToday();
  if (!val) { hint.textContent=''; return; }
  if (val===today) {
    hint.className='date-hint';
    hint.innerHTML='<i class="ti ti-circle-check"></i> Hoje — '+fmtDatePT(today);
  } else {
    hint.className='date-hint retro';
    hint.innerHTML='<i class="ti ti-clock-back"></i> Registo retroativo — '+fmtDatePT(val);
  }
}

// ── COMPUTE REVENUE TOTALS ─────────────────────────────────────────────────────
function computeRevTotals(entries) {
  const t = { mb:0, num:0, mbw:0, nF:0, mF:0, nNF:0, mNF:0 };
  (entries||[]).forEach(e => {
    t.mb  += e.mb;
    t.num += e.num;
    t.mbw += e.mbw;
    if (e.numFat) t.nF   += e.num; else t.nNF += e.num;
    if (e.mbwFat) t.mF   += e.mbw; else t.mNF += e.mbw;
  });
  t.tF   = t.mb + t.nF + t.mF;
  t.tNF  = t.nNF + t.mNF;
  t.tG   = t.mb + t.num + t.mbw;
  t.iBase = t.tF / (1 + IVA_RATE);
  t.iVal  = t.tF - t.iBase;
  return t;
}

function bloco1HTML(t) {
  return `
    <div class="sum-row"><span class="sum-label"><span class="sum-dot" style="background:#2563EB"></span>Multibanco</span><span class="sum-value">${fmtEur(t.mb)}</span></div>
    <div class="sum-row"><span class="sum-label"><span class="sum-dot" style="background:#16A34A"></span>Numerário</span><span class="sum-value">${fmtEur(t.num)}</span></div>
    <div class="sum-row"><span class="sum-label"><span class="sum-dot" style="background:#D97706"></span>MBWay</span><span class="sum-value">${fmtEur(t.mbw)}</span></div>
    <div class="sum-row total-row"><span class="sum-label">Total Geral</span><span class="sum-value">${fmtEur(t.tG)}</span></div>`;
}

function bloco2HTML(t) {
  return `
    <div class="sum-section-label">Faturação</div>
    <div class="sum-row"><span class="sum-label"><span class="sum-dot" style="background:#2563EB"></span>Multibanco</span><span class="sum-value">${fmtEur(t.mb)}</span></div>
    <div class="sum-row"><span class="sum-label"><span class="sum-dot" style="background:#16A34A"></span>Numerário faturado</span><span class="sum-value">${fmtEur(t.nF)}</span></div>
    <div class="sum-row"><span class="sum-label"><span class="sum-dot" style="background:#D97706"></span>MBWay faturado</span><span class="sum-value">${fmtEur(t.mF)}</span></div>
    <div class="sum-row total-row"><span class="sum-label">Total Faturado</span><span class="sum-value">${fmtEur(t.tF)}</span></div>
    <hr class="sum-divider">
    <div class="sum-section-label">IVA sobre faturação (23%)</div>
    <div class="sum-row iva-row"><span class="sum-label" style="color:#5B21B6"><i class="ti ti-receipt-tax" style="font-size:12px"></i> Base (s/ IVA)</span><span class="sum-value" style="color:#5B21B6">${fmtEur(t.iBase)}</span></div>
    <div class="sum-row iva-row" style="margin-top:3px"><span class="sum-label" style="color:#5B21B6"><i class="ti ti-percentage" style="font-size:12px"></i> IVA 23%</span><span class="sum-value" style="color:#DC2626;font-size:17px">${fmtEur(t.iVal)}</span></div>
    <hr class="sum-divider">
    <div class="sum-section-label">S/ Faturação</div>
    <div class="sum-row sfat-row"><span class="sum-label" style="color:#92400E"><span class="sum-dot" style="background:#D97706"></span>Numerário não faturado</span><span class="sum-value" style="color:#92400E">${fmtEur(t.nNF)}</span></div>
    <div class="sum-row sfat-row" style="margin-top:3px"><span class="sum-label" style="color:#92400E"><span class="sum-dot" style="background:#F59E0B"></span>MBWay não faturado</span><span class="sum-value" style="color:#92400E">${fmtEur(t.mNF)}</span></div>
    <div class="sum-row total-row"><span class="sum-label">Total S/ Faturação</span><span class="sum-value">${fmtEur(t.tNF)}</span></div>`;
}

// ── COVER INDICATOR ────────────────────────────────────────────────────────────
function buildCoverIndicator(mk) {
  const month    = getMonth(mk);
  const despesas = month.despesas || [];
  const entries  = month.entries  || [];
  const today    = getToday();
  const totalDesp = despesas.filter(d=>!d.paga).reduce((s,d)=>s+d.valor,0);
  const totalMB   = entries.reduce((s,e)=>s+e.mb,0);
  const falta     = Math.max(0, totalDesp - totalMB);
  const despVenc  = despesas.filter(d=>!d.paga && d.data < today);
  const totalVenc = despVenc.reduce((s,d)=>s+d.valor,0);

  if (despesas.length===0) return `<div class="cover-indicator ok"><div class="cover-title"><i class="ti ti-circle-check"></i> Sem despesas registadas neste mês</div></div>`;
  const cls  = falta===0 ? 'ok' : (totalVenc>0 ? 'danger' : 'warn');
  const icon = falta===0 ? 'ti-circle-check' : (totalVenc>0 ? 'ti-alert-triangle' : 'ti-info-circle');
  return `<div class="cover-indicator ${cls}">
    <div class="cover-title"><i class="ti ${icon}"></i> Cobertura de despesas por Multibanco</div>
    <div class="cover-row"><span>Total despesas não pagas</span><span><b>${fmtEur(totalDesp)}</b></span></div>
    <div class="cover-row"><span>Multibanco faturado (mês)</span><span><b>${fmtEur(totalMB)}</b></span></div>
    ${totalVenc>0?`<div class="cover-row"><span>⚠️ Despesas vencidas não pagas</span><span><b>${fmtEur(totalVenc)}</b></span></div>`:''}
    <hr style="border:none;border-top:1px dashed rgba(0,0,0,.15);margin:8px 0">
    ${falta>0
      ?`<div class="cover-row"><span>Falta faturar em Multibanco</span></div><div class="cover-big">${fmtEur(falta)}</div>`
      :`<div class="cover-row"><span>✅ Multibanco cobre todas as despesas</span></div><div class="cover-big">0,00 €</div>`}
  </div>`;
}

// ── RENDER REGISTOS ────────────────────────────────────────────────────────────
function renderRegistos() {
  const mk    = currentMonthKey();
  const month = getMonth(mk);
  const today = getToday();
  const t     = computeRevTotals(month.entries);
  const tT    = computeRevTotals((month.entries||[]).filter(e=>e.date===today));
  const tot   = tT.mb + tT.num + tT.mbw;

  document.getElementById('sidebarMonth').textContent = monthLabel(mk);
  document.getElementById('topbarMonth').textContent  = monthLabel(mk);
  const d = new Date();
  document.getElementById('regDateSub').textContent =
    d.toLocaleDateString('pt-PT',{weekday:'long',day:'numeric',month:'long',year:'numeric'});

  document.getElementById('metricsToday').innerHTML = `
    <div class="metric-card highlight">
      <div class="metric-label"><i class="ti ti-sun" style="font-size:13px"></i> Total hoje</div>
      <div class="metric-value">${fmtEur(tot)}</div>
      <div class="metric-sub">${fmtDatePT(today)}</div>
    </div>
    <div class="metric-card">
      <div class="metric-label"><i class="ti ti-credit-card" style="font-size:13px"></i> Multibanco</div>
      <div class="metric-value">${fmtEur(tT.mb)}</div>
    </div>
    <div class="metric-card">
      <div class="metric-label"><i class="ti ti-cash" style="font-size:13px"></i> Numerário</div>
      <div class="metric-value">${fmtEur(tT.num)}</div>
    </div>
    <div class="metric-card">
      <div class="metric-label"><i class="ti ti-device-mobile" style="font-size:13px"></i> MBWay</div>
      <div class="metric-value">${fmtEur(tT.mbw)}</div>
    </div>`;

  document.getElementById('bloco1Content').innerHTML = bloco1HTML(t);
  document.getElementById('bloco2Content').innerHTML = bloco2HTML(t);
}

// ── ADD / DELETE ENTRY ─────────────────────────────────────────────────────────
function addEntry() {
  const dateVal = document.getElementById('inDate').value;
  if (!dateVal)            { showToast('Selecione a data.','ti-alert-circle'); return; }
  if (dateVal > getToday()){ showToast('Datas futuras não permitidas.','ti-alert-circle'); return; }

  const mb  = parseFloat(document.getElementById('inMB').value)  || 0;
  const num = parseFloat(document.getElementById('inNum').value) || 0;
  const mbw = parseFloat(document.getElementById('inMBW').value) || 0;
  const nF  = document.getElementById('inNumFat').checked;
  const mF  = document.getElementById('inMBWFat').checked;

  if (mb===0 && num===0 && mbw===0) { showToast('Introduza pelo menos um valor.','ti-alert-circle'); return; }

  const mk    = monthKeyFromDate(dateVal);
  const month = getMonth(mk);
  month.entries.push({ date:dateVal, mb, num, mbw, numFat:nF, mbwFat:mF, ts:Date.now() });
  saveMonth(mk, month);

  ['inMB','inNum','inMBW'].forEach(id => document.getElementById(id).value='');
  document.getElementById('inNumFat').checked = false;
  document.getElementById('inMBWFat').checked = false;
  document.getElementById('inDate').value = getToday();
  updateDateHint();

  const retro = dateVal < getToday() ? ' (retroativo '+fmtDatePT(dateVal)+')' : '';
  showToast('Receita registada'+retro+'!');
  renderRegistos();
}

function deleteEntry(mk, idx) {
  if (!confirm('Apagar este registo?')) return;
  const month = getMonth(mk);
  month.entries.splice(idx,1);
  saveMonth(mk, month);
  showToast('Registo apagado.','ti-trash');
  renderRegistos();
  renderMovimentos();
}

// ── DESPESAS ───────────────────────────────────────────────────────────────────
function addDespesa() {
  const nome  = document.getElementById('despNome').value.trim();
  const valor = parseFloat(document.getElementById('despValor').value) || 0;
  const data  = document.getElementById('despData').value;
  if (!nome)   { showToast('Indique o nome.','ti-alert-circle'); return; }
  if (valor<=0){ showToast('Indique um valor válido.','ti-alert-circle'); return; }
  if (!data)   { showToast('Indique a data limite.','ti-alert-circle'); return; }

  const mk    = monthKeyFromDate(data);
  const month = getMonth(mk);
  if (!month.despesas) month.despesas = [];
  month.despesas.push({ nome, valor, data, paga:false, ts:Date.now() });
  saveMonth(mk, month);

  document.getElementById('despNome').value  = '';
  document.getElementById('despValor').value = '';
  document.getElementById('despData').value  = '';
  showToast('Despesa adicionada!');
  renderDespesas();
}

function toggleDespPaga(mk, idx) {
  const month = getMonth(mk);
  month.despesas[idx].paga = !month.despesas[idx].paga;
  saveMonth(mk, month);
  renderDespesas();
}

function deleteDespesa(mk, idx) {
  if (!confirm('Apagar esta despesa?')) return;
  const month = getMonth(mk);
  month.despesas.splice(idx,1);
  saveMonth(mk, month);
  showToast('Despesa apagada.','ti-trash');
  renderDespesas();
}

function renderDespesas() {
  const mk    = currentMonthKey();
  const month = getMonth(mk);
  const today = getToday();

  document.getElementById('despDateSub').textContent = monthLabel(mk);
  document.getElementById('despesaIndicator').innerHTML = buildCoverIndicator(mk);

  const despesas = month.despesas || [];
  if (despesas.length===0) {
    document.getElementById('despesaTable').innerHTML =
      '<div class="empty-state"><i class="ti ti-receipt"></i>Sem despesas neste mês.</div>';
    return;
  }

  const sorted = [...despesas.map((d,i)=>({...d,idx:i}))]
    .sort((a,b)=>{ if(a.paga!==b.paga)return a.paga?1:-1; return a.data.localeCompare(b.data); });

  let html = `<table class="mov-table"><thead><tr><th>Despesa</th><th>Vencimento</th><th style="text-align:right">Valor</th><th>Estado</th><th></th></tr></thead><tbody>`;
  sorted.forEach(d => {
    const vencida = !d.paga && d.data < today;
    const eb = d.paga
      ? '<span class="badge badge-paga"><i class="ti ti-check" style="font-size:10px"></i> Paga</span>'
      : (vencida
          ? '<span class="badge badge-venc"><i class="ti ti-alert-triangle" style="font-size:10px"></i> Vencida</span>'
          : '<span class="badge badge-npaga"><i class="ti ti-clock" style="font-size:10px"></i> Pendente</span>');

    html += `<tr class="desp-row${d.paga?' paga':''}">
      <td><b>${d.nome}</b></td>
      <td>${fmtDatePT(d.data)}${vencida?' <span class="desp-venc-badge">vencida</span>':''}</td>
      <td style="text-align:right;font-family:'DM Serif Display',serif;font-size:15px">${fmtEur(d.valor)}</td>
      <td>${eb}</td>
      <td style="display:flex;gap:4px;align-items:center">
        <button class="check-btn${d.paga?' paga':''}" onclick="toggleDespPaga('${mk}',${d.idx})" title="${d.paga?'Marcar não paga':'Marcar paga'}">
          <i class="ti ${d.paga?'ti-rotate-clockwise':'ti-check'}"></i>
        </button>
        <button class="del-btn" onclick="deleteDespesa('${mk}',${d.idx})" title="Apagar">
          <i class="ti ti-trash"></i>
        </button>
      </td>
    </tr>`;
  });

  const tp = despesas.filter(d=>d.paga).reduce((s,d)=>s+d.valor,0);
  const tn = despesas.filter(d=>!d.paga).reduce((s,d)=>s+d.valor,0);
  html += `<tr class="day-total-row"><td colspan="2" style="font-size:12px;color:var(--text-muted)">Pagas: ${fmtEur(tp)} &nbsp;|&nbsp; Pendentes: ${fmtEur(tn)}</td><td style="text-align:right;font-family:'DM Serif Display',serif;font-size:16px">${fmtEur(tp+tn)}</td><td colspan="2"></td></tr>`;
  html += '</tbody></table>';
  document.getElementById('despesaTable').innerHTML = html;
}

// ── NOVO MÊS ───────────────────────────────────────────────────────────────────
function confirmReset() {
  if (confirm('Iniciar controlo do novo mês?\nOs dados ficam guardados no histórico. Confirma?')) {
    showToast('Histórico preservado. Pode iniciar o novo mês!');
    renderRegistos();
  }
}

// ── MOVIMENTOS — com seletor de mês ────────────────────────────────────────────
// Mês atualmente selecionado nos movimentos (null = mês atual)
let _movMK = null;

function clearFilter() {
  document.getElementById('filterDate').value = '';
  renderMovimentos();
}

function selectMovMonth(mk) {
  _movMK = mk;
  document.getElementById('filterDate').value = '';
  renderMovimentos();
}

function renderMovimentos() {
  const data   = loadData();
  const today  = getToday();

  // Determina o mês a mostrar — filtra só chaves no formato YYYY-MM
  const allKeys = Object.keys(data).filter(k=>/^\d{4}-\d{2}$/.test(k)).sort().reverse();
  if (!_movMK || !allKeys.includes(_movMK)) _movMK = allKeys[0] || currentMonthKey();

  // Atualiza o seletor de mês
  const selHTML = allKeys.length > 0
    ? `<div class="mov-month-selector">
        <span class="mov-month-label"><i class="ti ti-calendar-month"></i> Mês:</span>
        <select class="mov-month-select" onchange="selectMovMonth(this.value)">
          ${allKeys.map(k=>`<option value="${k}"${k===_movMK?' selected':''}>${monthLabel(k)}</option>`).join('')}
        </select>
      </div>`
    : '';
  document.getElementById('movMonthSelector').innerHTML = selHTML;
  document.getElementById('movDateSub').textContent = monthLabel(_movMK);

  const month      = getMonth(_movMK);
  const allEntries = month.entries || [];
  const filterDate = document.getElementById('filterDate').value;

  const entries = (filterDate
    ? allEntries.filter(e=>e.date===filterDate)
    : allEntries).map((e,_i) => ({...e, idx: allEntries.indexOf(e)}));

  const byDay = {};
  entries.forEach(e => {
    if (!byDay[e.date]) byDay[e.date]=[];
    byDay[e.date].push(e);
  });
  const sortedDays = Object.keys(byDay).sort().reverse();

  if (sortedDays.length===0) {
    document.getElementById('movTable').innerHTML =
      `<div class="empty-state"><i class="ti ti-inbox"></i>${filterDate?'Sem registos para '+fmtDatePT(filterDate):'Sem movimentos neste mês.'}</div>`;
    document.getElementById('monthSummary2').innerHTML = bloco1HTML(computeRevTotals([]));
    return;
  }

  let html = `<table class="mov-table"><thead><tr><th>Data / Hora</th><th>Método</th><th>Faturação</th><th style="text-align:right">Valor</th><th style="text-align:center">Apagar</th></tr></thead><tbody>`;

  sortedDays.forEach(day => {
    const isRetro = day < today;
    html += `<tr class="day-group-row"><td colspan="5">${fmtDayLabel(day)}${isRetro?' <span class="badge badge-retro"><i class="ti ti-clock-back" style="font-size:10px"></i> retroativo</span>':''}</td></tr>`;

    const mk2 = monthKeyFromDate(day);
    const dayEntries = byDay[day];

    dayEntries.forEach(e => {
      const t2 = new Date(e.ts).toLocaleTimeString('pt-PT',{hour:'2-digit',minute:'2-digit'});
      const dateCell = `<span style="color:var(--text-muted)">${fmtDatePT(e.date)} ${t2}</span>`;
      const fatBadge = f => f
        ? '<span class="badge badge-fat"><i class="ti ti-file-invoice" style="font-size:10px"></i> Faturado</span>'
        : '<span class="badge badge-nofat"><i class="ti ti-file-off" style="font-size:10px"></i> S/Fatura</span>';

      if (e.mb>0)  html += `<tr><td>${dateCell}</td><td><span class="badge badge-mb"><i class="ti ti-credit-card" style="font-size:10px"></i> Multibanco</span></td><td><span class="badge badge-fat"><i class="ti ti-file-invoice" style="font-size:10px"></i> Sempre</span></td><td style="text-align:right;font-family:'DM Serif Display',serif;font-size:15px">${fmtEur(e.mb)}</td><td style="text-align:center"><button style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:6px;border:1px solid #FECACA;background:#FEF2F2;color:#991B1B;font-family:DM Sans,sans-serif;font-size:11px;font-weight:500;cursor:pointer;white-space:nowrap" onclick="deleteEntry('${mk2}',${e.idx})"><i class="ti ti-trash"></i> Apagar</button></td></tr>`;
      if (e.num>0) html += `<tr><td>${dateCell}</td><td><span class="badge badge-num"><i class="ti ti-cash" style="font-size:10px"></i> Numerário</span></td><td>${fatBadge(e.numFat)}</td><td style="text-align:right;font-family:'DM Serif Display',serif;font-size:15px">${fmtEur(e.num)}</td><td style="text-align:center"><button style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:6px;border:1px solid #FECACA;background:#FEF2F2;color:#991B1B;font-family:DM Sans,sans-serif;font-size:11px;font-weight:500;cursor:pointer;white-space:nowrap" onclick="deleteEntry('${mk2}',${e.idx})"><i class="ti ti-trash"></i> Apagar</button></td></tr>`;
      if (e.mbw>0) html += `<tr><td>${dateCell}</td><td><span class="badge badge-mbw"><i class="ti ti-device-mobile" style="font-size:10px"></i> MBWay</span></td><td>${fatBadge(e.mbwFat)}</td><td style="text-align:right;font-family:'DM Serif Display',serif;font-size:15px">${fmtEur(e.mbw)}</td><td style="text-align:center"><button style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:6px;border:1px solid #FECACA;background:#FEF2F2;color:#991B1B;font-family:DM Sans,sans-serif;font-size:11px;font-weight:500;cursor:pointer;white-space:nowrap" onclick="deleteEntry('${mk2}',${e.idx})"><i class="ti ti-trash"></i> Apagar</button></td></tr>`;
    });

    const dayT = computeRevTotals(dayEntries);
    html += `<tr class="day-total-row"><td colspan="3" style="font-size:12px">Total do dia</td><td style="text-align:right;font-family:'DM Serif Display',serif;font-size:16px">${fmtEur(dayT.tG)}</td><td></td></tr>`;
  });

  html += '</tbody></table>';
  document.getElementById('movTable').innerHTML = html;
  document.getElementById('monthSummary2').innerHTML = bloco1HTML(computeRevTotals(allEntries));
}

// ── DASHBOARD ──────────────────────────────────────────────────────────────────
let dashChartInstance = null;
let selectedDashMonth = null;

function renderDashboard() {
  const data = loadData();
  const mk   = currentMonthKey();
  const month = getMonth(mk);
  const t     = computeRevTotals(month.entries||[]);

  document.getElementById('dashDateSub').textContent = monthLabel(mk);
  document.getElementById('dashCoverAlert').innerHTML = buildCoverIndicator(mk);

  const despesas  = month.despesas || [];
  const totalDesp = despesas.filter(d=>!d.paga).reduce((s,d)=>s+d.valor,0);
  const faltaMB   = Math.max(0, totalDesp - t.mb);

  document.getElementById('dashKpiGrid').innerHTML = `
    <div class="kpi-card"><div class="kpi-label"><i class="ti ti-credit-card" style="font-size:12px"></i> Multibanco</div><div class="kpi-value">${fmtEur(t.mb)}</div></div>
    <div class="kpi-card"><div class="kpi-label"><i class="ti ti-file-invoice" style="font-size:12px"></i> Total Faturado</div><div class="kpi-value">${fmtEur(t.tF)}</div></div>
    <div class="kpi-card"><div class="kpi-label"><i class="ti ti-ban" style="font-size:12px"></i> S/ Faturação</div><div class="kpi-value">${fmtEur(t.tNF)}</div></div>
    <div class="kpi-card ${faltaMB>0?'danger':'ok'}"><div class="kpi-label"><i class="ti ti-receipt" style="font-size:12px"></i> Falta faturar (MB)</div><div class="kpi-value">${fmtEur(faltaMB)}</div></div>
    <div class="kpi-card"><div class="kpi-label"><i class="ti ti-percentage" style="font-size:12px"></i> IVA do mês</div><div class="kpi-value" style="color:#7C3AED">${fmtEur(t.iVal)}</div></div>
    <div class="kpi-card"><div class="kpi-label"><i class="ti ti-sigma" style="font-size:12px"></i> Total Geral</div><div class="kpi-value">${fmtEur(t.tG)}</div></div>`;

  // IVA Trimestral
  const qKeys = quarterKeys(mk);
  const qNum  = quarterOf(mk);
  let ivaH = `<div style="font-size:13px;color:var(--text-muted);margin-bottom:.75rem">${qNum}º trimestre de ${mk.slice(0,4)} (${qKeys.map(k=>monthLabel(k).slice(0,3)).join(', ')})</div>`;
  let ivaT = 0;
  qKeys.forEach(qk => {
    const qt = computeRevTotals((getMonth(qk).entries||[]));
    ivaT += qt.iVal;
    ivaH += `<div class="sum-row"><span class="sum-label">${monthLabel(qk)}</span><span class="sum-value" style="color:#7C3AED">${fmtEur(qt.iVal)}</span></div>`;
  });
  ivaH += `<div class="sum-row total-row"><span class="sum-label">Total IVA trimestre</span><span class="sum-value" style="color:#DC2626;font-size:22px">${fmtEur(ivaT)}</span></div>`;
  document.getElementById('dashIvaContent').innerHTML = ivaH;

  // Gráfico
  const keys = Object.keys(data).sort();
  if (!keys.length) { document.getElementById('dashMonths').innerHTML='<span style="font-size:13px;color:var(--text-muted)">Sem dados ainda.</span>'; return; }
  if (!selectedDashMonth || !keys.includes(selectedDashMonth)) selectedDashMonth = keys[keys.length-1];

  document.getElementById('dashMonths').innerHTML = keys.map(k=>
    `<button class="month-chip${k===selectedDashMonth?' active':''}" onclick="selectDashMonth('${k}')">${monthLabel(k)}</button>`
  ).join('');

  const labels  = keys.map(k=>shortMonthLabel(k));
  const mbVals  = keys.map(k=>+computeRevTotals((data[k].entries||[])).mb.toFixed(2));
  const numVals = keys.map(k=>+computeRevTotals((data[k].entries||[])).num.toFixed(2));
  const mbwVals = keys.map(k=>+computeRevTotals((data[k].entries||[])).mbw.toFixed(2));

  const ctx = document.getElementById('dashChart').getContext('2d');
  if (dashChartInstance) dashChartInstance.destroy();
  dashChartInstance = new Chart(ctx, {
    type:'bar',
    data:{ labels, datasets:[
      {label:'Multibanco',data:mbVals, backgroundColor:'#2563EB',borderRadius:4},
      {label:'Numerário', data:numVals,backgroundColor:'#16A34A',borderRadius:4},
      {label:'MBWay',     data:mbwVals,backgroundColor:'#D97706',borderRadius:4}
    ]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},
      scales:{
        x:{stacked:true,ticks:{autoSkip:false,maxRotation:45,font:{size:11,family:'DM Sans'}},grid:{display:false}},
        y:{stacked:true,ticks:{callback:v=>v.toLocaleString('pt-PT')+' €',font:{size:11,family:'DM Sans'}},grid:{color:'rgba(0,0,0,.05)'}}
      }}
  });

  showDashDetail(selectedDashMonth, data);
}

function selectDashMonth(mk) { selectedDashMonth=mk; renderDashboard(); }

function showDashDetail(mk, data) {
  const month    = data[mk]||{entries:[],despesas:[]};
  const t        = computeRevTotals(month.entries||[]);
  const despesas = month.despesas||[];
  const tD       = despesas.reduce((s,d)=>s+d.valor,0);
  const pD       = despesas.filter(d=>d.paga).reduce((s,d)=>s+d.valor,0);
  document.getElementById('dashDetailContent').innerHTML = `
    <div style="font-family:'DM Serif Display',serif;font-size:16px;margin-bottom:1rem">${monthLabel(mk)}</div>
    ${bloco1HTML(t)}<hr class="sum-divider">
    <div class="sum-row"><span class="sum-label" style="color:#7C3AED"><i class="ti ti-receipt-tax" style="font-size:13px"></i> IVA faturado</span><span class="sum-value" style="color:#7C3AED">${fmtEur(t.iVal)}</span></div>
    <div class="sum-row"><span class="sum-label"><i class="ti ti-receipt" style="font-size:13px"></i> Total despesas</span><span class="sum-value">${fmtEur(tD)}</span></div>
    <div class="sum-row"><span class="sum-label" style="color:#16A34A"><i class="ti ti-check" style="font-size:13px"></i> Despesas pagas</span><span class="sum-value" style="color:#16A34A">${fmtEur(pD)}</span></div>
    <div style="margin-top:.75rem;font-size:12px;color:var(--text-muted)">${(month.entries||[]).length} receita(s) · ${despesas.length} despesa(s)</div>`;
}

// ── EXPORT / IMPORT ────────────────────────────────────────────────────────────
function exportData() {
  const blob = new Blob([JSON.stringify(loadData(),null,2)],{type:'application/json'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href=url; a.download='petshop-dados-'+getToday()+'.json'; a.click();
  URL.revokeObjectURL(url);
  showToast('Dados exportados!');
}

function importData(event) {
  const file = event.target.files[0]; if(!file)return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const raw = JSON.parse(e.target.result);
      if(typeof raw!=='object') throw new Error();

      // Detecta formato antigo: tem chave "entries" diretamente ou
      // tem chaves que são meses (YYYY-MM) com entries dentro
      // Formato antigo (crmps_data): { "2026-05": { entries: [...] } }
      // Formato novo  (crmps_v1):    { "2026-05": { entries: [...], despesas: [...] } }
      // Ambos são compatíveis — a diferença é só a chave do localStorage
      // O problema era que o ficheiro exportado da versão antiga
      // usava localStorage.getItem('crmps_data') mas era guardado
      // com a mesma estrutura de meses

      let imp = raw;

      // Se o ficheiro tiver uma chave "crmps_data" ou "crmps_v1" dentro
      // (exportação incorreta que guardou o wrapper)
      if (raw['crmps_data']) imp = JSON.parse(raw['crmps_data']);
      else if (raw['crmps_v1']) imp = JSON.parse(raw['crmps_v1']);

      const ex = loadData(); const mg={...ex};
      let count = 0;

      Object.keys(imp).forEach(mk=>{
        // Valida que a chave é um mês válido (YYYY-MM)
        if(!/^\d{4}-\d{2}$/.test(mk)) return;

        const impMonth = imp[mk];
        // Suporte a formato antigo onde entries pode estar diretamente
        const impEntries  = impMonth.entries  || [];
        const impDespesas = impMonth.despesas || [];

        if(!mg[mk]) {
          mg[mk] = { entries: impEntries, despesas: impDespesas };
        } else {
          const et  = new Set((mg[mk].entries||[]).map(x=>x.ts));
          const edt = new Set((mg[mk].despesas||[]).map(x=>x.ts));
          mg[mk]={
            entries:  [...(mg[mk].entries||[]),  ...impEntries.filter(x=>!et.has(x.ts))],
            despesas: [...(mg[mk].despesas||[]), ...impDespesas.filter(x=>!edt.has(x.ts))]
          };
        }
        count += impEntries.length;
      });

      saveData(mg);
      if(count > 0) {
        showToast(`Importado! ${count} registo(s) carregado(s).`);
      } else {
        showToast('Ficheiro importado — sem registos novos encontrados.','ti-alert-circle');
      }
      renderRegistos();
    } catch { showToast('Ficheiro inválido ou corrompido.','ti-alert-circle'); }
  };
  reader.readAsText(file); event.target.value='';
}

// ── INIT ───────────────────────────────────────────────────────────────────────
initDateField();
renderRegistos();
