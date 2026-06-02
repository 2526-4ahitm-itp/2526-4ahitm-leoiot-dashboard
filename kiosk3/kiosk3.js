const INFLUX_URL = '/influx';
const INFLUX_TOKEN = 'ih3lGQ2dVqXG7ec0Ai-flUi5ZWTqp3AChtwI0fu4014-cn5h0MRE6-RcWtlL1yYGUaaSg6NOtcW_TEjQdGGA5A==';
const INFLUX_ORG = 'leoiot';
const INFLUX_BUCKET = 'server_data';
const REFRESH_MS = 5 * 60 * 1000;

let chartProd = null;
let chartVerb = null;

function getCETMidnightISO() {
  const now = new Date();
  const dateStr = now.toLocaleDateString('sv-SE', { timeZone: 'Europe/Vienna' });
  const fmt = new Intl.DateTimeFormat('en', { timeZone: 'Europe/Vienna', timeZoneName: 'shortOffset' });
  const tzPart = fmt.formatToParts(now).find(p => p.type === 'timeZoneName')?.value ?? 'GMT+1';
  const offset = parseInt(tzPart.replace('GMT', '')) || 1;
  return new Date(new Date(`${dateStr}T00:00:00Z`).getTime() - offset * 3600000).toISOString();
}

async function fetchTodayData() {
  const startISO = getCETMidnightISO();

  const query = `
from(bucket: "${INFLUX_BUCKET}")
  |> range(start: ${startISO})
  |> filter(fn: (r) => r._measurement == "solax_stats")
  |> filter(fn: (r) => r._field == "daily_yield" or r._field == "daily_exported"
       or r._field == "daily_imported" or r._field == "consumption")
  |> last()`;

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
    return parseLastCSV(await resp.text());
  } catch (e) {
    console.error('[kiosk3] fetch error:', e);
    return null;
  }
}

function parseLastCSV(csv) {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return null;
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  const vi = headers.indexOf('_value');
  const fi = headers.indexOf('_field');
  const result = {};
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim().replace(/"/g, ''));
    if (!cols[fi] || !cols[vi]) continue;
    const val = parseFloat(cols[vi]);
    if (isFinite(val)) result[cols[fi]] = val;
  }
  return Object.keys(result).length ? result : null;
}

function initCharts() {
  const baseOpts = (cutout = '70%') => ({
    cutout,
    animation: { duration: 700 },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(8,10,18,0.94)',
        borderColor: 'rgba(255,255,255,0.09)',
        borderWidth: 1,
        padding: 12,
        bodyColor: 'rgba(255,255,255,0.75)',
        callbacks: {
          label: ctx => ` ${ctx.label}: ${ctx.parsed.toFixed(1)} kWh (${
            ctx.chart.data.datasets[0].data.reduce((a, b) => a + b, 0) > 0
              ? Math.round(ctx.parsed / ctx.chart.data.datasets[0].data.reduce((a, b) => a + b, 0) * 100)
              : 0
          }%)`,
        },
      },
    },
  });

  chartProd = new Chart(document.getElementById('chartProd'), {
    type: 'doughnut',
    data: {
      labels: ['Eigenverbrauch', 'Netzeinspeisung'],
      datasets: [{
        data: [0.001, 0.001],
        backgroundColor: ['#f59e0b', 'rgba(245,158,11,0.22)'],
        borderColor: ['rgba(245,158,11,0.8)', 'rgba(245,158,11,0.3)'],
        borderWidth: 2,
        hoverOffset: 6,
      }],
    },
    options: baseOpts(),
  });

  chartVerb = new Chart(document.getElementById('chartVerb'), {
    type: 'doughnut',
    data: {
      labels: ['Autarkie', 'Netzbezug'],
      datasets: [{
        data: [0.001, 0.001],
        backgroundColor: ['#0ea5e9', 'rgba(14,165,233,0.22)'],
        borderColor: ['rgba(14,165,233,0.8)', 'rgba(14,165,233,0.3)'],
        borderWidth: 2,
        hoverOffset: 6,
      }],
    },
    options: baseOpts(),
  });
}

function fmt1(v) { return (v != null && isFinite(v)) ? v.toFixed(1) : '--'; }
function fmtPct(num, denom) {
  if (!denom || !isFinite(denom) || denom === 0) return '-- %';
  return `${Math.round(num / denom * 100)} %`;
}

function updateUI(data) {
  if (!data) return;

  const yield_  = Math.max(0, data.daily_yield   ?? 0);
  const exported = Math.max(0, data.daily_exported ?? 0);
  const imported = Math.max(0, data.daily_imported ?? 0);
  const cons     = Math.max(0, data.consumption    ?? 0);

  const eigenverbrauch  = Math.max(0, yield_ - exported);
  const netzeinspeisung = exported;
  const autarkie        = Math.max(0, cons - imported);
  const netzbezug       = imported;

  // Produktion card
  document.getElementById('prodTotal').textContent    = `${fmt1(yield_)} kWh`;
  document.getElementById('prodEigenKwh').textContent = fmt1(eigenverbrauch);
  document.getElementById('prodEigenPct').textContent = fmtPct(eigenverbrauch, yield_);
  document.getElementById('prodNetzKwh').textContent  = fmt1(netzeinspeisung);
  document.getElementById('prodNetzPct').textContent  = fmtPct(netzeinspeisung, yield_);
  chartProd.data.datasets[0].data = [
    eigenverbrauch || 0.001,
    netzeinspeisung || 0.001,
  ];
  chartProd.update();

  // Verbrauch card
  document.getElementById('verbTotal').textContent    = `${fmt1(cons)} kWh`;
  document.getElementById('verbAutKwh').textContent   = fmt1(autarkie);
  document.getElementById('verbAutPct').textContent   = fmtPct(autarkie, cons);
  document.getElementById('verbNetzKwh').textContent  = fmt1(netzbezug);
  document.getElementById('verbNetzPct').textContent  = fmtPct(netzbezug, cons);
  chartVerb.data.datasets[0].data = [
    autarkie || 0.001,
    netzbezug || 0.001,
  ];
  chartVerb.update();

  document.getElementById('k3Updated').textContent =
    `Updated: ${new Date().toLocaleTimeString('de-AT', {
      timeZone: 'Europe/Vienna', hour: '2-digit', minute: '2-digit',
    })}`;
}

async function refresh() {
  updateUI(await fetchTodayData());
}

function startClock() {
  const tick = () => {
    document.getElementById('k3Clock').textContent =
      new Date().toLocaleTimeString('de-AT', {
        timeZone: 'Europe/Vienna', hour: '2-digit', minute: '2-digit', second: '2-digit',
      });
  };
  tick();
  setInterval(tick, 1000);
}

document.addEventListener('DOMContentLoaded', () => {
  initCharts();
  startClock();
  refresh();
  setInterval(refresh, REFRESH_MS);
});
