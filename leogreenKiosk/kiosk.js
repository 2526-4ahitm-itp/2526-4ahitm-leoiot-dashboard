const INFLUX_URL    = '/influx';
const INFLUX_TOKEN  = 'ih3lGQ2dVqXG7ec0Ai-flUi5ZWTqp3AChtwI0fu4014-cn5h0MRE6-RcWtlL1yYGUaaSg6NOtcW_TEjQdGGA5A==';
const INFLUX_ORG    = 'leoiot';
const INFLUX_BUCKET = 'server_data';

let consumptionChart = null;
let productionChart  = null;
let weeklyChart      = null;
let powerChart       = null;

// Persisted across MQTT updates so today's bar can be patched live
let weeklyByDate = {};

// Tracks consecutive MQTT messages to derive instantaneous power (kWh → kW)
const pvHistory = { ts: null, yield: null, consumption: null };

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtKwh(v) {
  if (v == null) return '--';
  if (v >= 100) return v.toLocaleString('de-AT', { maximumFractionDigits: 0 }) + ' kWh';
  return v.toLocaleString('de-AT', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' kWh';
}

function fmtCenterStr(v) {
  if (v == null || !isFinite(v)) return '--';
  if (v >= 100) return v.toLocaleString('de-AT', { maximumFractionDigits: 0 });
  return v.toLocaleString('de-AT', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function centerFontSize(digits) {
  return digits <= 3 ? 'clamp(1.4rem, 3.2vw, 2.8rem)'
       : digits <= 4 ? 'clamp(1.1rem, 2.4vw, 2.1rem)'
       :               'clamp(0.9rem, 1.8vw, 1.6rem)';
}

function syncCenters(consumptionVal, productionVal) {
  const cs = fmtCenterStr(consumptionVal);
  const ps = fmtCenterStr(productionVal);
  const maxDigits = Math.max(cs.replace(/\D/g, '').length, ps.replace(/\D/g, '').length);
  const size = centerFontSize(maxDigits);
  ['consumptionCenter', 'productionCenter'].forEach((id, i) => {
    const el = document.getElementById(id).querySelector('.donut-val');
    el.style.fontSize = size;
    el.textContent = i === 0 ? cs : ps;
  });
}

function safePos(v) {
  return (v != null && isFinite(v) && v > 0) ? v : 0;
}

function fmtDayLabel(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  const day = d.getUTCDate().toString().padStart(2, '0');
  const months = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
  return `${day} ${months[d.getUTCMonth()]}`;
}

function fmtTimeLabel(ts) {
  return new Date(ts).toLocaleTimeString('de-AT', {
    timeZone: 'Europe/Vienna', hour: '2-digit', minute: '2-digit',
  });
}

// ── Donut charts ──────────────────────────────────────────────────────────────

const PLACEHOLDER_COLOR = 'rgba(255,255,255,0.06)';

function makeDonut(canvasId) {
  return new Chart(document.getElementById(canvasId).getContext('2d'), {
    type: 'doughnut',
    data: {
      datasets: [{
        data: [1],
        backgroundColor: [PLACEHOLDER_COLOR],
        borderWidth: 0,
        hoverOffset: 4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      cutout: '70%',
      animation: { duration: 500, easing: 'easeInOutQuart' },
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
      },
    },
  });
}

function renderLegend(ulId, segments) {
  document.getElementById(ulId).innerHTML = segments
    .map(s => `<li class="legend-item">
      <span class="legend-dot" style="background:${s.color}"></span>
      <span class="legend-label">${s.label}</span>
      <span class="legend-value">${fmtKwh(s.value)}</span>
    </li>`)
    .join('');
}

function sortedSegments(segs) {
  return [...segs].sort((a, b) => b.value - a.value);
}

function updateConsumptionDonut(selfConsumed, imported_, discharged) {
  const segs = sortedSegments([
    { label: 'Von PV',       value: safePos(selfConsumed), color: '#22c55e' },
    { label: 'Vom Netz',     value: safePos(imported_),    color: '#f97316' },
    { label: 'Von Batterie', value: safePos(discharged),   color: '#a78bfa' },
  ]);
  const total = segs.reduce((s, seg) => s + seg.value, 0);

  consumptionChart.data.datasets[0].data            = total > 0 ? segs.map(s => s.value) : [1];
  consumptionChart.data.datasets[0].backgroundColor = total > 0 ? segs.map(s => s.color) : [PLACEHOLDER_COLOR];
  consumptionChart.update();

  updateConsumptionDonut._total = total > 0 ? total : null;
  renderLegend('consumptionLegend', segs);
}

function updateProductionDonut(production, exported_, charged, selfConsumed) {
  const segs = sortedSegments([
    { label: 'Eigenverbrauch', value: safePos(selfConsumed), color: '#22c55e' },
    { label: 'Ins Netz',       value: safePos(exported_),    color: '#ef4444' },
    { label: 'Batterie',       value: safePos(charged),      color: '#14b8a6' },
  ]);
  const total = segs.reduce((s, seg) => s + seg.value, 0);

  productionChart.data.datasets[0].data            = total > 0 ? segs.map(s => s.value) : [1];
  productionChart.data.datasets[0].backgroundColor = total > 0 ? segs.map(s => s.color) : [PLACEHOLDER_COLOR];
  productionChart.update();

  updateProductionDonut._production = production;
  renderLegend('productionLegend', segs);
}

// ── Apply PV data (MQTT + initial InfluxDB) ───────────────────────────────────

function applyPvData(d) {
  const production = d.dailyYield      ?? d.daily_yield      ?? null;
  const imported_  = d.dailyImported   ?? d.daily_imported   ?? null;
  const exported_  = d.dailyExported   ?? d.daily_exported   ?? null;
  const charged    = d.dailyCharged    ?? d.daily_charged    ?? null;
  const discharged = d.dailyDischarged ?? d.daily_discharged ?? null;

  const selfConsumed = (production != null && exported_ != null && charged != null)
    ? safePos(production - exported_ - charged)
    : null;

  if (selfConsumed != null && imported_ != null) {
    updateConsumptionDonut(selfConsumed, imported_, discharged ?? 0);
  }
  if (selfConsumed != null && production != null && exported_ != null && charged != null) {
    updateProductionDonut(production, exported_, charged, selfConsumed);
  }

  syncCenters(updateConsumptionDonut._total, updateProductionDonut._production);

  // Patch today's bar in the weekly chart with live values
  if (production != null || exported_ != null || charged != null) {
    const todayKey = new Date().toISOString().slice(0, 10);
    if (!weeklyByDate[todayKey]) weeklyByDate[todayKey] = {};
    if (production != null) weeklyByDate[todayKey].daily_yield    = production;
    if (exported_  != null) weeklyByDate[todayKey].daily_exported = exported_;
    if (charged    != null) weeklyByDate[todayKey].daily_charged  = charged;
    updateBarChart(weeklyByDate);
  }

  // Derive instantaneous power (kW) from consecutive MQTT messages and append to power chart.
  // Formula: Δ(kWh) / Δt(h) = kW. Consumption = daily_yield - daily_exported + daily_imported.
  const consumption = (production != null && exported_ != null && imported_ != null)
    ? production - exported_ + imported_
    : null;

  const now = Date.now();
  if (pvHistory.ts !== null && pvHistory.yield !== null && production !== null) {
    const dtHrs = (now - pvHistory.ts) / 3_600_000;
    if (dtHrs > 0 && dtHrs < 0.25) { // only trust intervals under 15 min
      const prodKw = Math.max(0, (production - pvHistory.yield) / dtHrs);
      const consKw = (consumption !== null && pvHistory.consumption !== null)
        ? -Math.max(0, (consumption - pvHistory.consumption) / dtHrs)
        : null;
      appendToPowerChart(now, prodKw, consKw);
    }
  }
  pvHistory.ts          = now;
  pvHistory.yield       = production;
  pvHistory.consumption = consumption;

  const nowDate = new Date();
  document.getElementById('updated').textContent =
    `Updated: ${nowDate.toLocaleTimeString('de-AT', { timeZone: 'Europe/Vienna', hour: '2-digit', minute: '2-digit' })}`;
}

// ── MQTT live updates via WebSocket bridge ────────────────────────────────────

function connectMqttBridge() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const wsUrl = `${proto}://${location.host}/ws`;

  function connect() {
    const ws = new WebSocket(wsUrl);
    ws.addEventListener('message', (evt) => {
      let msg;
      try { msg = JSON.parse(evt.data); } catch { return; }
      if (msg.type === 'pv') applyPvData(msg.data);
    });
    ws.addEventListener('close', () => setTimeout(connect, 5000));
    ws.addEventListener('error', () => {});
  }

  connect();
}

// ── InfluxDB: one-time initial load for donuts (today) ───────────────────────

function getTodayCETStart() {
  const dateStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Vienna' });
  const tzPart  = new Intl.DateTimeFormat('en', {
    timeZone: 'Europe/Vienna', timeZoneName: 'shortOffset',
  }).formatToParts(new Date(`${dateStr}T12:00:00Z`))
    .find(p => p.type === 'timeZoneName')?.value ?? 'GMT+1';
  const offset = parseInt(tzPart.replace('GMT', '')) || 1;
  return new Date(new Date(`${dateStr}T00:00:00Z`).getTime() - offset * 3_600_000).toISOString();
}

async function loadTodayData() {
  const startISO = getTodayCETStart();
  const stopISO  = new Date().toISOString();

  const query = `
from(bucket: "${INFLUX_BUCKET}")
  |> range(start: ${startISO}, stop: ${stopISO})
  |> filter(fn: (r) => r._measurement == "solax_stats")
  |> filter(fn: (r) => r._field == "daily_yield" or r._field == "consumption"
       or r._field == "daily_imported" or r._field == "daily_exported"
       or r._field == "daily_charged" or r._field == "daily_discharged")
  |> last()
  |> yield(name: "last")`;

  try {
    const resp = await fetch(`${INFLUX_URL}/api/v2/query?org=${INFLUX_ORG}&t=${Date.now()}`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${INFLUX_TOKEN}`,
        'Content-Type': 'application/vnd.flux',
        'Accept': 'application/csv',
        'Cache-Control': 'no-cache',
      },
      body: query,
    });
    if (!resp.ok) return;
    const vals = parseLastCSV(await resp.text());
    if (vals) applyPvData(vals);
  } catch (e) {
    console.error('[leogreenKiosk] InfluxDB today error:', e);
  }
}

function parseLastCSV(csv) {
  const lines = csv.trim().split('\n').filter(l => l && !l.startsWith('#'));
  if (lines.length < 2) return null;
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  const vi = headers.indexOf('_value');
  const fi = headers.indexOf('_field');
  if (vi < 0 || fi < 0) return null;

  const result = {};
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim().replace(/"/g, ''));
    if (!cols[vi] || !cols[fi]) continue;
    const v = parseFloat(cols[vi]);
    if (isFinite(v)) result[cols[fi]] = v;
  }
  return Object.keys(result).length ? result : null;
}

// ── Bar chart: weekly overview ────────────────────────────────────────────────

function makeBarChart() {
  weeklyChart = new Chart(document.getElementById('weeklyChart').getContext('2d'), {
    type: 'bar',
    data: {
      labels: [],
      datasets: [
        { label: 'Produziert', data: [], backgroundColor: '#f59e0b', borderRadius: 4, borderSkipped: false },
        { label: 'Verbraucht', data: [], backgroundColor: '#f87171', borderRadius: 4, borderSkipped: false },
        { label: 'Exportiert', data: [], backgroundColor: '#60a5fa', borderRadius: 4, borderSkipped: false },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 500, easing: 'easeInOutQuart' },
      plugins: {
        legend: {
          display: true,
          position: 'bottom',
          labels: {
            color: 'rgba(255,255,255,0.7)',
            usePointStyle: true,
            pointStyle: 'circle',
            padding: 20,
            font: { size: 14 },
          },
        },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${fmtKwh(ctx.parsed.y)}`,
          },
        },
      },
      scales: {
        x: {
          ticks: { color: 'rgba(255,255,255,0.6)', font: { size: 13 } },
          grid: { color: 'rgba(255,255,255,0.05)', borderDash: [4, 4] },
          border: { color: 'rgba(255,255,255,0.1)' },
        },
        y: {
          beginAtZero: true,
          ticks: {
            color: 'rgba(255,255,255,0.6)',
            font: { size: 13 },
            callback: v => v === 0 ? '0' : (v >= 100 ? Math.round(v) : v.toFixed(1)),
          },
          title: {
            display: true,
            text: 'Werte in kWh',
            color: 'rgba(255,255,255,0.5)',
            font: { size: 12 },
          },
          grid: { color: 'rgba(255,255,255,0.08)', borderDash: [4, 4] },
          border: { color: 'rgba(255,255,255,0.1)' },
        },
      },
    },
  });
}

function updateBarChart(byDate) {
  const days = Object.keys(byDate).sort();
  weeklyChart.data.labels = days.map(fmtDayLabel);
  weeklyChart.data.datasets[0].data = days.map(d => byDate[d].daily_yield ?? 0);
  weeklyChart.data.datasets[1].data = days.map(d => {
    const y = byDate[d].daily_yield    ?? 0;
    const e = byDate[d].daily_exported ?? 0;
    const c = byDate[d].daily_charged  ?? 0;
    return Math.max(0, y - e - c);
  });
  weeklyChart.data.datasets[2].data = days.map(d => byDate[d].daily_exported ?? 0);
  weeklyChart.update();
}

// Uses fn: max because daily_* counters reset at CET/CEST midnight, which falls
// inside the UTC day window — max captures the end-of-day peak before the reset.
async function loadWeeklyData() {
  const query = `
from(bucket: "${INFLUX_BUCKET}")
  |> range(start: -7d)
  |> filter(fn: (r) => r._measurement == "solax_stats")
  |> filter(fn: (r) => r._field == "daily_yield" or r._field == "daily_exported" or r._field == "daily_charged")
  |> aggregateWindow(every: 1d, fn: max, createEmpty: false, timeSrc: "_start")
  |> yield(name: "daily_max")`;

  try {
    const resp = await fetch(`${INFLUX_URL}/api/v2/query?org=${INFLUX_ORG}&t=${Date.now()}`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${INFLUX_TOKEN}`,
        'Content-Type': 'application/vnd.flux',
        'Accept': 'application/csv',
        'Cache-Control': 'no-cache',
      },
      body: query,
    });
    if (!resp.ok) return;
    const parsed = parseWeeklyCSV(await resp.text());
    if (Object.keys(parsed).length) {
      weeklyByDate = parsed;
      updateBarChart(weeklyByDate);
    }
  } catch (e) {
    console.error('[leogreenKiosk] InfluxDB weekly error:', e);
  }
}

function parseWeeklyCSV(csv) {
  const lines = csv.trim().split('\n').filter(l => l && !l.startsWith('#'));
  if (lines.length < 2) return {};
  const headers  = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  const timeIdx  = headers.indexOf('_time');
  const valIdx   = headers.indexOf('_value');
  const fieldIdx = headers.indexOf('_field');
  if ([timeIdx, valIdx, fieldIdx].includes(-1)) return {};

  const byDate = {};
  for (let i = 1; i < lines.length; i++) {
    const cols  = lines[i].split(',').map(c => c.trim().replace(/"/g, ''));
    const time  = cols[timeIdx];
    const val   = parseFloat(cols[valIdx]);
    const field = cols[fieldIdx];
    if (!time || !field || !isFinite(val)) continue;
    const dateKey = time.slice(0, 10);
    if (!byDate[dateKey]) byDate[dateKey] = {};
    byDate[dateKey][field] = val;
  }
  return byDate;
}

// ── Line chart: today's power curve (kW) ─────────────────────────────────────

function generate24hLabels() {
  const labels = [];
  for (let h = 0; h < 24; h++)
    for (let m = 0; m < 60; m += 5)
      labels.push(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`);
  return labels; // 288 slots: 00:00 … 23:55
}

const POWER_LABELS = generate24hLabels();

function makePowerChart() {
  powerChart = new Chart(document.getElementById('powerChart').getContext('2d'), {
    type: 'line',
    data: {
      labels: [...POWER_LABELS],
      datasets: [
        {
          label: 'Produktion',
          data: new Array(288).fill(null),
          borderColor: '#22c55e',
          backgroundColor: 'rgba(34,197,94,0.08)',
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          pointHoverRadius: 4,
          borderWidth: 2,
        },
        {
          label: 'Verbrauch',
          data: new Array(288).fill(null),
          borderColor: '#f97316',
          backgroundColor: 'rgba(249,115,22,0.08)',
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          pointHoverRadius: 4,
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 300 },
      plugins: {
        legend: {
          display: true,
          position: 'bottom',
          labels: {
            color: 'rgba(255,255,255,0.7)',
            usePointStyle: true,
            pointStyle: 'circle',
            padding: 20,
            font: { size: 14 },
          },
        },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y.toFixed(2)} kW`,
          },
        },
      },
      scales: {
        x: {
          ticks: {
            color: 'rgba(255,255,255,0.6)',
            font: { size: 12 },
            maxTicksLimit: 8,
            maxRotation: 0,
          },
          grid: { color: 'rgba(255,255,255,0.05)', borderDash: [4, 4] },
          border: { color: 'rgba(255,255,255,0.1)' },
        },
        y: {
          ticks: {
            color: 'rgba(255,255,255,0.6)',
            font: { size: 13 },
            callback: v => v.toFixed(1),
          },
          title: {
            display: true,
            text: 'Leistung in kW',
            color: 'rgba(255,255,255,0.5)',
            font: { size: 12 },
          },
          grid: { color: 'rgba(255,255,255,0.08)', borderDash: [4, 4] },
          border: { color: 'rgba(255,255,255,0.1)' },
        },
      },
    },
  });
}

function appendToPowerChart(timestamp, prodKw, consKw) {
  const label = fmtTimeLabel(timestamp);
  const idx = POWER_LABELS.indexOf(label);
  if (idx < 0) return;
  powerChart.data.datasets[0].data[idx] = prodKw;
  powerChart.data.datasets[1].data[idx] = consKw ?? null;
  powerChart.update('none');
}

// Loads today's power history by computing derivative of cumulative kWh fields.
// derivative(unit: 1h) on kWh values yields kW (power = dEnergy/dTime).
async function loadTodayPowerData() {
  const startISO = getTodayCETStart();

  const query = `
from(bucket: "${INFLUX_BUCKET}")
  |> range(start: ${startISO})
  |> filter(fn: (r) => r._measurement == "solax_stats")
  |> filter(fn: (r) => r._field == "daily_yield" or r._field == "consumption")
  |> aggregateWindow(every: 5m, fn: last, createEmpty: false)
  |> derivative(unit: 1h, nonNegative: true)
  |> yield(name: "power_kw")`;

  try {
    const resp = await fetch(`${INFLUX_URL}/api/v2/query?org=${INFLUX_ORG}&t=${Date.now()}`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${INFLUX_TOKEN}`,
        'Content-Type': 'application/vnd.flux',
        'Accept': 'application/csv',
        'Cache-Control': 'no-cache',
      },
      body: query,
    });
    if (!resp.ok) return;
    const { labels, production, consumption } = parsePowerCSV(await resp.text());
    if (!labels.length) return;
    // Merge into fixed 24h slots; leave future slots as null
    const prod288 = new Array(288).fill(null);
    const cons288 = new Array(288).fill(null);
    labels.forEach((lbl, i) => {
      const idx = POWER_LABELS.indexOf(lbl);
      if (idx >= 0) { prod288[idx] = production[i]; cons288[idx] = consumption[i]; }
    });
    powerChart.data.datasets[0].data = prod288;
    powerChart.data.datasets[1].data = cons288;
    powerChart.update();
  } catch (e) {
    console.error('[leogreenKiosk] InfluxDB power error:', e);
  }
}

function parsePowerCSV(csv) {
  const lines = csv.trim().split('\n').filter(l => l && !l.startsWith('#'));
  if (lines.length < 2) return { labels: [], production: [], consumption: [] };
  const headers  = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  const timeIdx  = headers.indexOf('_time');
  const valIdx   = headers.indexOf('_value');
  const fieldIdx = headers.indexOf('_field');
  if ([timeIdx, valIdx, fieldIdx].includes(-1)) return { labels: [], production: [], consumption: [] };

  const byTime = {};
  for (let i = 1; i < lines.length; i++) {
    const cols  = lines[i].split(',').map(c => c.trim().replace(/"/g, ''));
    const time  = cols[timeIdx];
    const val   = parseFloat(cols[valIdx]);
    const field = cols[fieldIdx];
    if (!time || !field || !isFinite(val)) continue;
    if (!byTime[time]) byTime[time] = {};
    byTime[time][field] = val;
  }

  const times = Object.keys(byTime).sort();
  return {
    labels:      times.map(t => fmtTimeLabel(t)),
    production:  times.map(t => byTime[t].daily_yield  ?? null),
    consumption: times.map(t => byTime[t].consumption != null ? -byTime[t].consumption : null),
  };
}

// ── Clock ─────────────────────────────────────────────────────────────────────

function startClock() {
  const tick = () => {
    document.getElementById('clock').textContent = new Date().toLocaleTimeString('de-AT', {
      timeZone: 'Europe/Vienna', hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  };
  tick();
  setInterval(tick, 1000);
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  consumptionChart = makeDonut('consumptionChart');
  productionChart  = makeDonut('productionChart');
  makeBarChart();
  makePowerChart();
  startClock();
  loadTodayData();        // seeds donuts + today's bar from InfluxDB
  loadWeeklyData();       // seeds past 7 days in bar chart from InfluxDB
  loadTodayPowerData();   // seeds power curve from InfluxDB
  connectMqttBridge();    // all live updates from here on
});
