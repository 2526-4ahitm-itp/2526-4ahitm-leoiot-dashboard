const INFLUX_URL = '/influx';
const INFLUX_TOKEN = 'ih3lGQ2dVqXG7ec0Ai-flUi5ZWTqp3AChtwI0fu4014-cn5h0MRE6-RcWtlL1yYGUaaSg6NOtcW_TEjQdGGA5A==';
const INFLUX_ORG = 'leoiot';
const INFLUX_BUCKET = 'server_data';
const REFRESH_MS = 5 * 60 * 1000;
const MAX_DAYS_BACK = 6;

let dsChart = null;
let currentDayOffset = 0;

// ── Date helpers ──────────────────────────────────────────────────────────────

function getCETDayRange(daysAgo) {
  const now = new Date();
  const target = new Date(now.getTime() - daysAgo * 86400000);
  const dateStr = target.toLocaleDateString('sv-SE', { timeZone: 'Europe/Vienna' });
  const fmt = new Intl.DateTimeFormat('en', { timeZone: 'Europe/Vienna', timeZoneName: 'shortOffset' });
  const tzPart = fmt.formatToParts(new Date(`${dateStr}T12:00:00Z`))
    .find(p => p.type === 'timeZoneName')?.value ?? 'GMT+1';
  const offset = parseInt(tzPart.replace('GMT', '')) || 1;
  const startMs = new Date(`${dateStr}T00:00:00Z`).getTime() - offset * 3600000;
  return { startMs, endMs: startMs + 86400000 };
}

function getDayLabel(daysAgo) {
  if (daysAgo === 0) return 'Heute';
  if (daysAgo === 1) return 'Gestern';
  const { startMs } = getCETDayRange(daysAgo);
  return new Date(startMs + 7200000).toLocaleDateString('de-AT', {
    timeZone: 'Europe/Vienna', weekday: 'short', day: '2-digit', month: '2-digit',
  });
}

// ── Data fetching ─────────────────────────────────────────────────────────────

async function fetchHourlyData(daysAgo) {
  const { startMs, endMs } = getCETDayRange(daysAgo);
  const startISO = new Date(startMs).toISOString();
  const stopISO  = daysAgo === 0 ? new Date().toISOString() : new Date(endMs).toISOString();

  const query = `
from(bucket: "${INFLUX_BUCKET}")
  |> range(start: ${startISO}, stop: ${stopISO})
  |> filter(fn: (r) => r._measurement == "solax_stats")
  |> filter(fn: (r) => r._field == "daily_yield" or r._field == "consumption"
       or r._field == "daily_imported" or r._field == "daily_exported"
       or r._field == "daily_charged")
  |> aggregateWindow(every: 1h, fn: last, createEmpty: false)
  |> yield(name: "hourly")`;

  try {
    const resp = await fetch(`${INFLUX_URL}/api/v2/query?org=${INFLUX_ORG}&t=${Date.now()}`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${INFLUX_TOKEN}`,
        'Content-Type': 'application/vnd.flux',
        'Accept': 'application/csv',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
      },
      body: query,
    });
    if (!resp.ok) return null;
    return parseHourlyCSV(await resp.text(), startMs);
  } catch (e) {
    console.error('[kiosk4] fetch error:', e);
    return null;
  }
}

function parseHourlyCSV(csv, startMs) {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return null;

  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  const vi = headers.indexOf('_value');
  const fi = headers.indexOf('_field');
  const ti = headers.indexOf('_time');
  if (vi < 0 || fi < 0 || ti < 0) return null;

  const byHour = new Map();
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim().replace(/"/g, ''));
    if (!cols[vi] || !cols[fi] || !cols[ti]) continue;
    const val = parseFloat(cols[vi]);
    if (!isFinite(val)) continue;
    const hourIdx = Math.round((new Date(cols[ti]).getTime() - startMs) / 3600000);
    if (hourIdx < 0 || hourIdx > 24) continue;
    if (!byHour.has(hourIdx)) byHour.set(hourIdx, { hour: hourIdx });
    byHour.get(hourIdx)[cols[fi]] = val;
  }

  return [...byHour.values()].sort((a, b) => a.hour - b.hour);
}

function computeHourlyKwh(snapshots) {
  const result = [];
  for (let i = 1; i < snapshots.length; i++) {
    const prev = snapshots[i - 1];
    const curr = snapshots[i];
    const diff = field => Math.max(0, (curr[field] ?? prev[field] ?? 0) - (prev[field] ?? 0));

    result.push({
      hour:       curr.hour,
      produktion: diff('daily_yield'),
      vomNetz:    diff('daily_imported'),
      insNetz:    diff('daily_exported'),
      batterie:   diff('daily_charged'),
      verbrauch:  diff('consumption'),
    });
  }
  return result;
}

// ── Chart ─────────────────────────────────────────────────────────────────────

function hourLabel(h) {
  return `${String(h - 1).padStart(2, '0')}:00`;
}

const currentTimePlugin = {
  id: 'currentTimeLine',
  afterDraw(chart) {
    if (currentDayOffset !== 0) return;
    const { startMs } = getCETDayRange(0);
    const hourNow = (Date.now() - startMs) / 3600000;
    if (hourNow < 0 || hourNow > 24) return;
    const { ctx, chartArea, scales } = chart;
    const x = scales.x.getPixelForValue(Math.floor(hourNow));
    if (!x || x < chartArea.left || x > chartArea.right) return;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(x, chartArea.top);
    ctx.lineTo(x, chartArea.bottom);
    ctx.stroke();
    const hh = String(Math.floor(hourNow)).padStart(2, '0');
    const mm = String(Math.round((hourNow % 1) * 60)).padStart(2, '0');
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = 'bold 12px Segoe UI, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${hh}:${mm}`, x, chartArea.top - 6);
    ctx.restore();
  },
};

function initChart() {
  dsChart = new Chart(document.getElementById('dsChart').getContext('2d'), {
    type: 'bar',
    data: { labels: [], datasets: [] },
    plugins: [currentTimePlugin],
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            color: 'rgba(255,255,255,0.6)',
            font: { size: 13 },
            usePointStyle: true,
            pointStyle: 'rect',
            padding: 22,
          },
        },
        tooltip: {
          backgroundColor: 'rgba(8,10,18,0.94)',
          borderColor: 'rgba(255,255,255,0.09)',
          borderWidth: 1,
          padding: 12,
          titleColor: 'rgba(255,255,255,0.8)',
          bodyColor: 'rgba(255,255,255,0.65)',
          callbacks: {
            label: ctx => {
              const val = Math.abs(ctx.parsed.y).toFixed(3);
              return ` ${ctx.dataset.label}: ${val} kW`;
            },
          },
        },
      },
      scales: {
        x: {
          stacked: true,
          ticks: {
            color: 'rgba(255,255,255,0.35)',
            font: { size: 11 },
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 13,
          },
          grid: { color: 'rgba(255,255,255,0.05)' },
          border: { color: 'rgba(255,255,255,0.06)' },
        },
        y: {
          stacked: true,
          min: 0,
          ticks: {
            color: 'rgba(255,255,255,0.35)',
            font: { size: 11 },
            callback: v => `${v} kW`,
            maxTicksLimit: 9,
          },
          grid: {
            color: 'rgba(255,255,255,0.05)',
          },
          border: { color: 'rgba(255,255,255,0.06)' },
        },
      },
    },
  });
}

function buildDatasets(hourly) {
  const byHour = new Map(hourly.map(h => [h.hour, h]));
  const hours  = Array.from({ length: 24 }, (_, i) => i + 1);
  const labels = hours.map(h => hourLabel(h));

  const get = (h, field) => {
    const e = byHour.get(h);
    if (!e) return null;
    const v = +e[field].toFixed(3);
    return v === 0 ? null : v;
  };
  return {
    labels,
    datasets: [
      // ── Consumption stack (how energy was consumed) ───────────────────────
      {
        label: 'Vom Netz',
        data: hours.map(h => get(h, 'vomNetz')),
        backgroundColor: 'rgba(239,68,68,0.85)',
        borderWidth: 0,
        stack: 'consumption',
        order: 1,
      },
      {
        label: 'Batterie Ladung',
        data: hours.map(h => get(h, 'batterie')),
        backgroundColor: 'rgba(20,184,166,0.85)',
        borderWidth: 0,
        stack: 'consumption',
        order: 2,
      },
      // ── Production stack (what was generated) ────────────────────────────
      {
        label: 'Produktion',
        data: hours.map(h => get(h, 'produktion')),
        backgroundColor: 'rgba(245,158,11,0.85)',
        borderWidth: 0,
        stack: 'production',
        order: 3,
      },
      // ── Verbrauch ─────────────────────────────────────────────────────────
      {
        label: 'Verbrauch',
        data: hours.map(h => get(h, 'verbrauch')),
        backgroundColor: 'rgba(168,85,247,0.85)',
        borderWidth: 0,
        stack: 'verbrauch',
        order: 5,
      },
      // ── Export ────────────────────────────────────────────────────────────
      {
        label: 'Ins Netz (Export)',
        data: hours.map(h => get(h, 'insNetz')),
        backgroundColor: 'rgba(34,197,94,0.85)',
        borderWidth: 0,
        stack: 'export',
        order: 4,
      },
    ],
  };
}

function updateStats(snapshots) {
  if (!snapshots.length) return;
  const last = snapshots[snapshots.length - 1];
  const fmt = v => `${(v ?? 0).toFixed(2)} kW`;
  document.getElementById('statProduktion').textContent = fmt(last.daily_yield);
  document.getElementById('statVomNetz').textContent    = fmt(last.daily_imported);
  document.getElementById('statBatterie').textContent   = fmt(last.daily_charged);
  document.getElementById('statInsNetz').textContent    = fmt(last.daily_exported);
  document.getElementById('statVerbrauch').textContent  = fmt(last.consumption);
}

// ── Navigation ────────────────────────────────────────────────────────────────

function updateNavUI() {
  document.getElementById('navDate').textContent = getDayLabel(currentDayOffset);
  document.getElementById('navNext').disabled = currentDayOffset <= 0;
  document.getElementById('navPrev').disabled = currentDayOffset >= MAX_DAYS_BACK;
}

async function loadAndRender() {
  updateNavUI();
  const snapshots = await fetchHourlyData(currentDayOffset);
  if (!snapshots || snapshots.length < 2) return;

  const hourly = computeHourlyKwh(snapshots);
  if (!hourly.length) return;

  const { labels, datasets } = buildDatasets(hourly);
  dsChart.data.labels   = labels;
  dsChart.data.datasets = datasets;
  dsChart.update();

  updateStats(snapshots);
  document.getElementById('dsUpdated').textContent =
    `Updated: ${new Date().toLocaleTimeString('de-AT', {
      timeZone: 'Europe/Vienna', hour: '2-digit', minute: '2-digit',
    })}`;
}

function startClock() {
  const tick = () => {
    document.getElementById('dsClock').textContent =
      new Date().toLocaleTimeString('de-AT', {
        timeZone: 'Europe/Vienna', hour: '2-digit', minute: '2-digit', second: '2-digit',
      });
  };
  tick();
  setInterval(tick, 1000);
}

document.addEventListener('DOMContentLoaded', () => {
  initChart();
  startClock();

  document.getElementById('navPrev').addEventListener('click', () => {
    if (currentDayOffset < MAX_DAYS_BACK) { currentDayOffset++; loadAndRender(); }
  });
  document.getElementById('navNext').addEventListener('click', () => {
    if (currentDayOffset > 0) { currentDayOffset--; loadAndRender(); }
  });

  loadAndRender();
  setInterval(() => { if (currentDayOffset === 0) loadAndRender(); }, REFRESH_MS);
});
