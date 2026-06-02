const INFLUX_URL = '/influx';
const INFLUX_TOKEN = 'ih3lGQ2dVqXG7ec0Ai-flUi5ZWTqp3AChtwI0fu4014-cn5h0MRE6-RcWtlL1yYGUaaSg6NOtcW_TEjQdGGA5A==';
const INFLUX_ORG = 'leoiot';
const INFLUX_BUCKET = 'server_data';
const REFRESH_MS = 5 * 60 * 1000;

let dsChart = null;

function getCETMidnightMs() {
  const now = new Date();
  const dateStr = now.toLocaleDateString('sv-SE', { timeZone: 'Europe/Vienna' });
  const fmt = new Intl.DateTimeFormat('en', { timeZone: 'Europe/Vienna', timeZoneName: 'shortOffset' });
  const tzPart = fmt.formatToParts(now).find(p => p.type === 'timeZoneName')?.value ?? 'GMT+1';
  const offset = parseInt(tzPart.replace('GMT', '')) || 1;
  return new Date(`${dateStr}T00:00:00Z`).getTime() - offset * 3600000;
}

async function fetchPowerData() {
  const startMs = getCETMidnightMs();
  const startISO = new Date(startMs).toISOString();

  const query = `
from(bucket: "${INFLUX_BUCKET}")
  |> range(start: ${startISO})
  |> filter(fn: (r) => r._measurement == "solax_stats")
  |> filter(fn: (r) => r._field == "daily_yield" or r._field == "consumption"
       or r._field == "daily_imported" or r._field == "daily_exported")
  |> aggregateWindow(every: 5m, fn: last, createEmpty: false)
  |> derivative(unit: 1h, nonNegative: true)
  |> yield(name: "power")`;

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
    return parsePowerCSV(await resp.text(), startMs);
  } catch (e) {
    console.error('[kiosk2] fetch error:', e);
    return null;
  }
}

function parsePowerCSV(csv, startMs) {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return null;

  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  const vi = headers.indexOf('_value');
  const fi = headers.indexOf('_field');
  const ti = headers.indexOf('_time');
  if (vi < 0 || fi < 0 || ti < 0) return null;

  const byTime = new Map();

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim().replace(/"/g, ''));
    if (!cols[vi] || !cols[fi] || !cols[ti]) continue;
    const field = cols[fi];
    const val = parseFloat(cols[vi]);
    const t = new Date(cols[ti]).getTime();
    const hourDec = (t - startMs) / 3600000;
    if (!isFinite(val) || hourDec < 0 || hourDec > 24.1) continue;
    const key = cols[ti];
    if (!byTime.has(key)) byTime.set(key, { x: hourDec });
    byTime.get(key)[field] = val;
  }

  return [...byTime.values()].sort((a, b) => a.x - b.x);
}

// Plugin: vertical line at current time
const currentTimePlugin = {
  id: 'currentTimeLine',
  afterDraw(chart) {
    const startMs = getCETMidnightMs();
    const hourNow = (Date.now() - startMs) / 3600000;
    if (hourNow < 0 || hourNow > 24) return;
    const { ctx, chartArea, scales } = chart;
    const x = scales.x.getPixelForValue(hourNow);
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(x, chartArea.top);
    ctx.lineTo(x, chartArea.bottom);
    ctx.stroke();

    // time label above line
    const hh = String(Math.floor(hourNow)).padStart(2, '0');
    const mm = String(Math.round((hourNow % 1) * 60)).padStart(2, '0');
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = 'bold 12px Segoe UI, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${hh}:${mm}`, x, chartArea.top - 4);
    ctx.restore();
  },
};

function initChart() {
  dsChart = new Chart(document.getElementById('dsChart').getContext('2d'), {
    type: 'line',
    data: { datasets: [] },
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
            pointStyle: 'circle',
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
            title: items => {
              const h = items[0].parsed.x;
              const hh = String(Math.floor(h)).padStart(2, '0');
              const mm = String(Math.round((h % 1) * 60)).padStart(2, '0');
              return `${hh}:${mm}`;
            },
            label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y.toFixed(2)} kW`,
          },
        },
      },
      scales: {
        x: {
          type: 'linear',
          min: 0,
          max: 24,
          ticks: {
            stepSize: 2,
            color: 'rgba(255,255,255,0.35)',
            font: { size: 11 },
            callback: v => `${String(v).padStart(2, '0')}:00`,
          },
          grid: { color: 'rgba(255,255,255,0.05)' },
          border: { color: 'rgba(255,255,255,0.06)' },
        },
        y: {
          suggestedMin: 0,
          ticks: {
            color: 'rgba(255,255,255,0.35)',
            font: { size: 11 },
            callback: v => `${v} kW`,
            maxTicksLimit: 8,
          },
          grid: { color: 'rgba(255,255,255,0.05)' },
          border: { color: 'rgba(255,255,255,0.06)' },
        },
      },
    },
  });
}

function buildDatasets(points) {
  const produktion    = points.map(p => ({ x: p.x, y: +(p.daily_yield ?? 0).toFixed(3) }));
  const direktverbrauch = points.map(p => ({
    x: p.x,
    y: +Math.max(0, (p.consumption ?? 0) - (p.daily_imported ?? 0)).toFixed(3),
  }));
  const insNetz = points.map(p => ({ x: p.x, y: +(p.daily_exported ?? 0).toFixed(3) }));
  const vomNetz = points.map(p => ({ x: p.x, y: +(p.daily_imported ?? 0).toFixed(3) }));

  return [
    {
      label: 'Produktion',
      data: produktion,
      borderColor: '#f59e0b',
      backgroundColor: 'rgba(245,158,11,0.18)',
      fill: true,
      borderWidth: 2.5,
      pointRadius: 0,
      tension: 0.4,
      order: 4,
    },
    {
      label: 'Direktverbrauch',
      data: direktverbrauch,
      borderColor: '#14b8a6',
      backgroundColor: 'rgba(20,184,166,0.12)',
      fill: true,
      borderWidth: 2,
      pointRadius: 0,
      tension: 0.4,
      order: 3,
    },
    {
      label: 'Ins Netz',
      data: insNetz,
      borderColor: '#a78bfa',
      backgroundColor: 'transparent',
      borderWidth: 2,
      pointRadius: 0,
      tension: 0.4,
      order: 2,
    },
    {
      label: 'Vom Netz',
      data: vomNetz,
      borderColor: '#ef4444',
      backgroundColor: 'transparent',
      borderWidth: 2,
      pointRadius: 0,
      tension: 0.4,
      order: 1,
    },
  ];
}

function updateStats(points) {
  if (!points.length) return;
  const last = points[points.length - 1];
  const gen  = last.daily_yield    ?? 0;
  const con  = last.consumption    ?? 0;
  const imp  = last.daily_imported ?? 0;
  const exp  = last.daily_exported ?? 0;
  const direkt = Math.max(0, con - imp);

  const fmt = v => `${v.toFixed(2)} kW`;
  document.getElementById('statProduktion').textContent = fmt(gen);
  document.getElementById('statVerbrauch').textContent  = fmt(con);
  document.getElementById('statInsNetz').textContent    = fmt(exp);
  document.getElementById('statVomNetz').textContent    = fmt(imp);
  document.getElementById('statDirekt').textContent     = fmt(direkt);
}

async function refresh() {
  const points = await fetchPowerData();
  if (!points || !points.length) return;

  dsChart.data.datasets = buildDatasets(points);
  dsChart.update();
  updateStats(points);

  const now = new Date();
  document.getElementById('dsUpdated').textContent =
    `Updated: ${now.toLocaleTimeString('de-AT', { timeZone: 'Europe/Vienna', hour: '2-digit', minute: '2-digit' })}`;
}

function startClock() {
  const tick = () => {
    document.getElementById('dsClock').textContent =
      new Date().toLocaleTimeString('de-AT', {
        timeZone: 'Europe/Vienna',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      });
  };
  tick();
  setInterval(tick, 1000);
}

document.addEventListener('DOMContentLoaded', () => {
  initChart();
  startClock();
  refresh();
  setInterval(refresh, REFRESH_MS);
});
