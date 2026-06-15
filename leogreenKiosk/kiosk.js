const INFLUX_URL   = '/influx';
const INFLUX_TOKEN = 'ih3lGQ2dVqXG7ec0Ai-flUi5ZWTqp3AChtwI0fu4014-cn5h0MRE6-RcWtlL1yYGUaaSg6NOtcW_TEjQdGGA5A==';
const INFLUX_ORG   = 'leoiot';
const INFLUX_BUCKET = 'server_data';

let consumptionChart = null;
let productionChart  = null;

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtKwh(v) {
  if (v == null) return '--';
  if (v >= 100) return v.toLocaleString('de-AT', { maximumFractionDigits: 0 }) + ' kWh';
  return v.toLocaleString('de-AT', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' kWh';
}

function setCenter(id, v) {
  const str = v == null || !isFinite(v) ? '--'
    : v >= 100 ? v.toLocaleString('de-AT', { maximumFractionDigits: 0 })
    : v.toLocaleString('de-AT', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const digits = str.replace(/\D/g, '').length;
  const size = digits <= 3 ? 'clamp(1.4rem, 3.2vw, 2.8rem)'
             : digits <= 4 ? 'clamp(1.1rem, 2.4vw, 2.1rem)'
             :                'clamp(0.9rem, 1.8vw, 1.6rem)';
  const el = document.getElementById(id);
  el.querySelector('.donut-val').style.fontSize = size;
  el.querySelector('.donut-val').textContent = str;
}

function safePos(v) {
  return (v != null && isFinite(v) && v > 0) ? v : 0;
}

// ── Charts ────────────────────────────────────────────────────────────────────

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

// ── Shared legend renderer (sorted highest → lowest) ──────────────────────────

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

// ── Donut 1: Consumption (PV self-consumed / battery / grid) ─────────────────
// selfConsumed is passed in — same value as "Eigenverbrauch" in production chart.
// Total consumption = selfConsumed + imported + discharged (battery-aware formula).

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

  setCenter('consumptionCenter', total > 0 ? total : null);

  renderLegend('consumptionLegend', segs);
}

// ── Donut 2: Production (self-consumed / exported / charged) ──────────────────

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

  setCenter('productionCenter', production);

  renderLegend('productionLegend', segs);
}

// ── Apply PV data (shared between MQTT and InfluxDB paths) ────────────────────

function applyPvData(d) {
  // Accept both camelCase (Solax API) and snake_case (InfluxDB)
  const production = d.dailyYield      ?? d.daily_yield      ?? null;
  const imported_  = d.dailyImported   ?? d.daily_imported   ?? null;
  const exported_  = d.dailyExported   ?? d.daily_exported   ?? null;
  const charged    = d.dailyCharged    ?? d.daily_charged    ?? null;
  const discharged = d.dailyDischarged ?? d.daily_discharged ?? null;

  // Single authoritative formula: PV energy used on-site (not exported, not stored).
  // Used identically as "Von PV" and "Eigenverbrauch" so both charts always match.
  const selfConsumed = (production != null && exported_ != null && charged != null)
    ? safePos(production - exported_ - charged)
    : null;

  if (selfConsumed != null && imported_ != null) {
    updateConsumptionDonut(selfConsumed, imported_, discharged ?? 0);
  }
  if (selfConsumed != null && production != null && exported_ != null && charged != null) {
    updateProductionDonut(production, exported_, charged, selfConsumed);
  }

  const now = new Date();
  document.getElementById('updated').textContent =
    `Updated: ${now.toLocaleTimeString('de-AT', { timeZone: 'Europe/Vienna', hour: '2-digit', minute: '2-digit' })}`;
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

// ── InfluxDB initial load (today, start-of-CET-day until now) ─────────────────

function getTodayCETStart() {
  const dateStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Vienna' });
  const tzPart  = new Intl.DateTimeFormat('en', {
    timeZone: 'Europe/Vienna', timeZoneName: 'shortOffset',
  }).formatToParts(new Date(`${dateStr}T12:00:00Z`))
    .find(p => p.type === 'timeZoneName')?.value ?? 'GMT+1';
  const offset = parseInt(tzPart.replace('GMT', '')) || 1;
  return new Date(new Date(`${dateStr}T00:00:00Z`).getTime() - offset * 3_600_000).toISOString();
}

async function loadInitialData() {
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
    console.error('[leogreenKiosk] InfluxDB error:', e);
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
  startClock();
  loadInitialData();
  connectMqttBridge();
  setInterval(loadInitialData, 5 * 60 * 1000);
});
