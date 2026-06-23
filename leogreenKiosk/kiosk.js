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

function fmtKw(v) {
  if (v == null) return '--';
  return v.toLocaleString('de-AT', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' kW';
}

function fmtCenterStr(v) {
  if (v == null || !isFinite(v)) return '--';
  if (v >= 100) return v.toLocaleString('de-AT', { maximumFractionDigits: 0 });
  return v.toLocaleString('de-AT', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function centerFontSize(digits) {
  return digits <= 3 ? 'clamp(1.1rem, 2.4vw, 2.1rem)'
       : digits <= 4 ? 'clamp(0.9rem, 1.9vw, 1.7rem)'
       :               'clamp(0.75rem, 1.5vw, 1.3rem)';
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
    { label: 'In Batterie',    value: safePos(charged),      color: '#14b8a6' },
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
  // External MQTT format: instantaneous kW values from the live broker
  if (d.pv_power_kw != null) {
    updateFlowDiagramKw(d.pv_power_kw, d.load_power_kw, d.grid_power_kw, d.battery_power_kw);
    appendToPowerChart(Date.now(), d.pv_power_kw ?? 0, d.load_power_kw != null ? -d.load_power_kw : null);

    // Patch today's Produziert bar — daily_pv_kwh is the only daily field in this payload
    if (d.daily_pv_kwh != null) {
      const todayKey = new Date().toISOString().slice(0, 10);
      if (!weeklyByDate[todayKey]) weeklyByDate[todayKey] = {};
      weeklyByDate[todayKey].daily_yield = d.daily_pv_kwh;
      updateBarChart(weeklyByDate);
    }

    document.getElementById('updated').textContent =
      new Date().toLocaleTimeString('de-AT', { timeZone: 'Europe/Vienna', hour: '2-digit', minute: '2-digit' });
    return;
  }

  // Solax collector format: cumulative daily kWh values
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
    if (production != null) weeklyByDate[todayKey].daily_yield      = production;
    if (exported_  != null) weeklyByDate[todayKey].daily_exported   = exported_;
    if (charged    != null) weeklyByDate[todayKey].daily_charged    = charged;
    if (imported_  != null) weeklyByDate[todayKey].daily_imported   = imported_;
    if (discharged != null) weeklyByDate[todayKey].daily_discharged = discharged;
    updateBarChart(weeklyByDate);
  }

  // Derive instantaneous power (kW) from consecutive messages via Δ(kWh)/Δt(h)
  const consumption = (production != null && exported_ != null && imported_ != null)
    ? production - exported_ + imported_
    : null;

  const now = Date.now();
  if (pvHistory.ts !== null && pvHistory.yield !== null && production !== null) {
    const dtHrs = (now - pvHistory.ts) / 3_600_000;
    if (dtHrs > 0 && dtHrs < 0.25) {
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

  updateFlowDiagram(production, imported_, exported_, charged, discharged);

  document.getElementById('updated').textContent =
    new Date().toLocaleTimeString('de-AT', { timeZone: 'Europe/Vienna', hour: '2-digit', minute: '2-digit' });
}

// ── MQTT live updates via WebSocket bridge ────────────────────────────────────

let pvWs = null;

function connectMqttBridge() {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
    ? `${proto}//${location.hostname}:8090`
    : `${proto}//${location.hostname}/ws`;

  console.log(`[MQTT] Connecting to ${wsUrl}...`);
  pvWs = new WebSocket(wsUrl);

  pvWs.onopen = () => {
    console.log('[MQTT] Connected to WebSocket bridge');
  };

  pvWs.onmessage = (evt) => {
    let msg;
    try { msg = JSON.parse(evt.data); } catch { return; }
    if (msg.type === 'hello' || msg.type === 'subscribed') return;
    if (msg.type === 'pv') applyPvData(msg.data);
  };

  pvWs.onclose = (e) => {
    console.log(`[MQTT] Connection closed (${e.code}). Retrying in 5s...`);
    setTimeout(connectMqttBridge, 5000);
  };

  pvWs.onerror = (err) => {
    console.error('[MQTT] WebSocket error:', err);
  };
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
    const y  = byDate[d].daily_yield      ?? 0;
    const e  = byDate[d].daily_exported   ?? 0;
    const c  = byDate[d].daily_charged    ?? 0;
    const im = byDate[d].daily_imported   ?? 0;
    const di = byDate[d].daily_discharged ?? 0;
    return Math.max(0, (y - e - c) + im + di);
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
  |> filter(fn: (r) => r._field == "daily_yield" or r._field == "daily_exported" or r._field == "daily_charged" or r._field == "daily_imported" or r._field == "daily_discharged")
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
          offset: false,
          ticks: {
            color: 'rgba(255,255,255,0.6)',
            font: { size: 12 },
            maxTicksLimit: 300,
            maxRotation: 0,
            // Always show 00:00 at left edge; display every 3 hours
            callback: (val) => {
              const lbl = POWER_LABELS[val];
              if (!lbl) return null;
              const [h, m] = lbl.split(':').map(Number);
              return m === 0 && h % 3 === 0 ? lbl : null;
            },
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
  const d = new Date(timestamp);
  d.setMinutes(Math.floor(d.getMinutes() / 5) * 5, 0, 0);
  const label = fmtTimeLabel(d.getTime());
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

// ── Energy flow diagram ───────────────────────────────────────────────────────

function setFlowLine(id, state) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('flow-in', 'flow-out', 'flow-idle');
  el.classList.add(state === 'in' ? 'flow-in' : state === 'out' ? 'flow-out' : 'flow-idle');
}

function updateFlowDiagram(production, imported_, exported_, charged, discharged) {
  const selfConsumed = (production != null && exported_ != null && charged != null)
    ? Math.max(0, production - exported_ - charged) : null;
  const totalConsumption = selfConsumed != null
    ? selfConsumed + (imported_ ?? 0) + (discharged ?? 0) : null;
  const netGrid    = imported_ != null && exported_ != null ? imported_ - exported_    : null;
  const netBattery = discharged != null && charged != null  ? discharged - charged     : null;

  document.getElementById('fvSolar').textContent    = fmtKwh(production);
  document.getElementById('fvLoad').textContent     = fmtKwh(totalConsumption);
  document.getElementById('fvGrid').textContent     = netGrid != null ? fmtKwh(Math.abs(netGrid)) : '--';
  document.getElementById('fvBattery').textContent  = netBattery != null ? fmtKwh(Math.abs(netBattery)) : '--';

  setFlowLine('lineSolar',   (production  ?? 0) > 0.01 ? 'in'  : 'idle');
  setFlowLine('lineLoad',    (totalConsumption ?? 0) > 0.01 ? 'out' : 'idle');
  setFlowLine('lineGrid',    netGrid == null || Math.abs(netGrid) < 0.01 ? 'idle' : netGrid > 0 ? 'in' : 'out');
  setFlowLine('lineBattery', netBattery == null || Math.abs(netBattery) < 0.01 ? 'idle' : netBattery > 0 ? 'in' : 'out');
}

// Variant for external MQTT which provides instantaneous kW values directly.
// grid_power_kw > 0 = importing from grid, < 0 = exporting to grid.
// battery_power_kw > 0 = discharging, < 0 = charging.
function updateFlowDiagramKw(pvKw, loadKw, gridKw, batteryKw) {
  document.getElementById('fvSolar').textContent    = fmtKw(pvKw);
  document.getElementById('fvLoad').textContent     = fmtKw(loadKw);
  document.getElementById('fvGrid').textContent     = gridKw != null ? fmtKw(Math.abs(gridKw)) : '--';
  document.getElementById('fvBattery').textContent  = batteryKw != null ? fmtKw(Math.abs(batteryKw)) : '--';

  setFlowLine('lineSolar',   (pvKw ?? 0) > 0.01 ? 'in' : 'idle');
  setFlowLine('lineLoad',    (loadKw ?? 0) > 0.01 ? 'out' : 'idle');
  setFlowLine('lineGrid',    gridKw == null || Math.abs(gridKw) < 0.01 ? 'idle' : gridKw > 0 ? 'in' : 'out');
  setFlowLine('lineBattery', batteryKw == null || Math.abs(batteryKw) < 0.01 ? 'idle' : batteryKw > 0 ? 'in' : 'out');
}

// ── Theme toggle ──────────────────────────────────────────────────────────────

const CHART_THEME = {
  dark: {
    tick:   'rgba(255,255,255,0.6)',
    grid:   'rgba(255,255,255,0.08)',
    border: 'rgba(255,255,255,0.1)',
    legend: 'rgba(255,255,255,0.7)',
    title:  'rgba(255,255,255,0.5)',
  },
  light: {
    tick:   'rgba(0,0,0,0.5)',
    grid:   'rgba(0,0,0,0.08)',
    border: 'rgba(0,0,0,0.12)',
    legend: 'rgba(0,0,0,0.7)',
    title:  'rgba(0,0,0,0.45)',
  },
};

function applyChartTheme(isLight) {
  const t = isLight ? CHART_THEME.light : CHART_THEME.dark;

  for (const chart of [weeklyChart, powerChart]) {
    if (!chart) continue;
    const x = chart.options.scales.x;
    const y = chart.options.scales.y;
    x.ticks.color  = t.tick;
    x.grid.color   = t.grid;
    x.border.color = t.border;
    y.ticks.color  = t.tick;
    y.grid.color   = t.grid;
    y.border.color = t.border;
    if (y.title) y.title.color = t.title;
    chart.options.plugins.legend.labels.color = t.legend;
    chart.update('none');
  }
}

function initTheme() {
  const toggle = document.getElementById('themeToggle');
  const logo   = document.querySelector('.htl-logo');
  const isLight = localStorage.getItem('leogreen-theme') === 'light';

  const applyLogo = (light) => {
    logo.src = light ? './htllogoblack.png' : './htllogo.png';
  };

  if (isLight) {
    document.body.classList.add('light');
    toggle.checked = true;
    applyLogo(true);
    setTimeout(() => applyChartTheme(true), 100);
  }

  toggle.addEventListener('change', () => {
    const light = toggle.checked;
    document.body.classList.toggle('light', light);
    localStorage.setItem('leogreen-theme', light ? 'light' : 'dark');
    applyLogo(light);
    applyChartTheme(light);
  });
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

function setWeeklyDateRange() {
  const now   = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - 6);
  const fmt = (d) => `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}`;
  const el = document.getElementById('weeklyDateRange');
  if (el) el.textContent = `${fmt(start)} – ${fmt(now)}.${now.getFullYear()}`;
}

document.addEventListener('DOMContentLoaded', () => {
  consumptionChart = makeDonut('consumptionChart');
  productionChart  = makeDonut('productionChart');
  makeBarChart();
  makePowerChart();
  initTheme();
  setWeeklyDateRange();
  startClock();
  loadTodayData();        // seeds donuts + today's bar + flow from InfluxDB
  loadWeeklyData();       // seeds past 7 days in bar chart from InfluxDB
  loadTodayPowerData();   // seeds power curve from InfluxDB
  connectMqttBridge();    // live updates via MQTT when available
  // Fallback polling — keeps data fresh when MQTT broker is unreachable
  setInterval(loadTodayData,     5 * 60 * 1000);
  setInterval(loadWeeklyData,    5 * 60 * 1000);
  setInterval(loadTodayPowerData, 5 * 60 * 1000);
});
