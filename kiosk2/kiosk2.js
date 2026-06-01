const INFLUX_URL = '/influx';
const INFLUX_TOKEN = 'ih3lGQ2dVqXG7ec0Ai-flUi5ZWTqp3AChtwI0fu4014-cn5h0MRE6-RcWtlL1yYGUaaSg6NOtcW_TEjQdGGA5A==';
const INFLUX_ORG = 'leoiot';
const INFLUX_BUCKET = 'server_data';
const REFRESH_MS = 5 * 60 * 1000;
const CO2_KG_PER_KWH = 0.4;
const DAYS = 45;

let historyChart = null;

// ── Fetch ─────────────────────────────────────────────────────────────────────

async function fetchHistory() {
  const query = `from(bucket: "${INFLUX_BUCKET}")
  |> range(start: -${DAYS}d)
  |> filter(fn: (r) => r._measurement == "solax_stats")
  |> filter(fn: (r) => r._field == "daily_yield" or r._field == "consumption" or r._field == "daily_imported")
  |> aggregateWindow(every: 1d, fn: last, createEmpty: false)
  |> yield(name: "daily")`;

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
    if (!resp.ok) return [];
    return parseCSV(await resp.text());
  } catch (e) {
    console.error('[kiosk2] fetch error:', e);
    return [];
  }
}

// Returns array of {date, daily_yield, consumption, daily_imported} sorted oldest→newest
function parseCSV(csv) {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  const vi = headers.indexOf('_value');
  const fi = headers.indexOf('_field');
  const ti = headers.indexOf('_time');

  const byDate = new Map();

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim().replace(/"/g, ''));
    if (!cols[vi] || !cols[fi] || !cols[ti]) continue;
    const field = cols[fi];
    const val = parseFloat(cols[vi]);
    const date = cols[ti].substring(0, 10);
    if (!isFinite(val)) continue;
    if (!byDate.has(date)) byDate.set(date, { date });
    byDate.get(date)[field] = val;
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

// ── Chart ─────────────────────────────────────────────────────────────────────

function fmtDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00Z');
  return d.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });
}

function initChart() {
  historyChart = new Chart(document.getElementById('historyChart').getContext('2d'), {
    type: 'bar',
    data: { labels: [], datasets: [] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            color: 'rgba(255,255,255,0.65)',
            font: { size: 12 },
            usePointStyle: true,
            pointStyle: 'rect',
            boxWidth: 14,
            padding: 16,
          },
        },
        tooltip: {
          backgroundColor: 'rgba(15,17,22,0.92)',
          borderColor: 'rgba(255,255,255,0.08)',
          borderWidth: 1,
          padding: 10,
          titleColor: 'rgba(255,255,255,0.85)',
          bodyColor: 'rgba(255,255,255,0.7)',
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${Math.abs(ctx.parsed.y).toFixed(2)} W`,
          },
        },
      },
      scales: {
        x: {
          stacked: true,
          ticks: {
            color: 'rgba(255,255,255,0.45)',
            font: { size: 10 },
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 14,
          },
          grid: { color: 'rgba(255,255,255,0.04)' },
        },
        y: {
          stacked: true,
          ticks: {
            color: 'rgba(255,255,255,0.45)',
            font: { size: 11 },
            maxTicksLimit: 8,
            callback: v => `${v}`,
          },
          grid: {
            color: ctx => ctx.tick.value === 0
              ? 'rgba(255,255,255,0.25)'
              : 'rgba(255,255,255,0.04)',
          },
        },
      },
    },
  });
}

function buildDatasets(rows) {
  const labels   = rows.map(r => fmtDate(r.date));
  const generated = rows.map(r => r.daily_yield      ?? 0);
  const gridUse   = rows.map(r => r.daily_imported   ?? 0);
  const consumed  = rows.map(r => r.consumption      ?? 0);
  const exported  = rows.map(r => {
    const direct = Math.max(0, (r.consumption ?? 0) - (r.daily_imported ?? 0));
    return -Math.max(0, (r.daily_yield ?? 0) - direct);
  });

  return {
    labels,
    datasets: [
      {
        label: 'Generated',
        data: generated,
        backgroundColor: 'rgba(196,222,50,0.80)',
        borderWidth: 0,
        stack: 'usage',
      },
      {
        label: 'Grid Import',
        data: gridUse,
        backgroundColor: 'rgba(56,189,248,0.80)',
        borderWidth: 0,
        stack: 'usage',
      },
      {
        label: 'Consumed',
        data: consumed,
        backgroundColor: 'rgba(239,68,68,0.80)',
        borderWidth: 0,
        stack: 'usage',
      },
      {
        label: 'Exported Solar',
        data: exported,
        backgroundColor: 'rgba(196,222,50,0.65)',
        borderWidth: 0,
        stack: 'export',
      },
    ],
  };
}

// ── Stats ─────────────────────────────────────────────────────────────────────

function fmtKwh(v) {
  if (v == null) return '-- W';
  return `${v.toLocaleString('de-AT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} W`;
}

function fmtPct(v) {
  if (v == null) return '--%';
  return `${Math.round(v)}%`;
}

function updateStats(today) {
  const gen  = today?.daily_yield  ?? null;
  const con  = today?.consumption  ?? null;
  const grid = today?.daily_imported ?? null;

  document.getElementById('statGenerated').textContent = fmtKwh(gen);
  document.getElementById('statConsumed').textContent  = fmtKwh(con);
  document.getElementById('statGrid').textContent      = fmtKwh(grid);

  const direct    = con != null && grid != null ? Math.max(0, con - grid) : null;
  const directPct = con != null && con > 0 && direct != null ? (direct / con * 100) : null;
  const gridPct   = con != null && con > 0 && grid  != null ? (grid  / con * 100) : null;
  const co2       = gen != null ? gen * CO2_KG_PER_KWH : null;

  document.getElementById('bGenerated').textContent = fmtKwh(gen);
  document.getElementById('bConsumed').textContent  = fmtKwh(con);
  document.getElementById('bDirect').textContent    = fmtPct(directPct);
  document.getElementById('bDirectKwh').textContent = fmtKwh(direct);
  document.getElementById('bGrid').textContent      = fmtPct(gridPct);
  document.getElementById('bGridKwh').textContent   = fmtKwh(grid);
  document.getElementById('bCo2').textContent       =
    co2 != null
      ? `${co2.toLocaleString('de-AT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg`
      : '-- kg';
}

// ── Refresh ───────────────────────────────────────────────────────────────────

async function refresh() {
  const rows = await fetchHistory();
  if (!rows.length) return;

  const { labels, datasets } = buildDatasets(rows);
  historyChart.data.labels   = labels;
  historyChart.data.datasets = datasets;
  historyChart.update();

  updateStats(rows[rows.length - 1]);

  const now = new Date();
  document.getElementById('k2Updated').textContent =
    `Updated: ${now.toLocaleTimeString('de-AT', { timeZone: 'Europe/Vienna', hour: '2-digit', minute: '2-digit' })}`;
}

// ── Clock ─────────────────────────────────────────────────────────────────────

function startClock() {
  const tick = () => {
    const now = new Date();
    const date = now.toLocaleDateString('en-GB', {
      timeZone: 'Europe/Vienna', weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
    });
    const time = now.toLocaleTimeString('en-GB', {
      timeZone: 'Europe/Vienna', hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    document.getElementById('k2Clock').textContent = `${date}, ${time}`;
  };
  tick();
  setInterval(tick, 1000);
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  initChart();
  startClock();
  refresh();
  setInterval(refresh, REFRESH_MS);
});
