const INFLUX_URL = '/influx';
const INFLUX_TOKEN = 'ih3lGQ2dVqXG7ec0Ai-flUi5ZWTqp3AChtwI0fu4014-cn5h0MRE6-RcWtlL1yYGUaaSg6NOtcW_TEjQdGGA5A==';
const INFLUX_ORG = 'leoiot';
const INFLUX_BUCKET = 'server_data';
const REFRESH_MS = 5 * 60 * 1000;

// Open-Meteo — free, no API key, CORS enabled
const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast?latitude=48.267&longitude=14.253&current=weather_code,temperature_2m&timezone=Europe%2FVienna';
const WMO = {
  0: 'Clear Sky', 1: 'Mainly Clear', 2: 'Partly Cloudy', 3: 'Overcast',
  45: 'Foggy', 48: 'Freezing Fog',
  51: 'Light Drizzle', 53: 'Drizzle', 55: 'Heavy Drizzle',
  61: 'Light Rain', 63: 'Rain', 65: 'Heavy Rain',
  71: 'Light Snow', 73: 'Snow', 75: 'Heavy Snow', 77: 'Snow Grains',
  80: 'Rain Showers', 81: 'Showers', 82: 'Heavy Showers',
  85: 'Snow Showers', 86: 'Heavy Snow Showers',
  95: 'Thunderstorm', 96: 'Thunderstorm', 99: 'Thunderstorm',
};

const SERIES = [
  { field: 'daily_yield',      label: 'PV Generated', color: '#f59e0b', fill: 'rgba(245,158,11,0.12)'  },
  { field: 'consumption',      label: 'PV Consumed',  color: '#3b82f6', fill: 'rgba(59,130,246,0.12)'  },
  { field: 'daily_discharged', label: 'From Battery', color: '#14b8a6', fill: 'rgba(20,184,166,0.12)'  },
  { field: 'daily_imported',   label: 'From Grid',    color: '#ef4444', fill: 'rgba(239,68,68,0.12)'   },
];

let mainChart = null;
const dayCharts = [];
const dayStatEls = [];

// ── Timezone helpers ──────────────────────────────────────────────────────────

// Returns how many hours Europe/Vienna is ahead of UTC at the given date (1 or 2).
function getCETOffset(date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Vienna',
    timeZoneName: 'shortOffset',
  }).formatToParts(date);
  const tz = parts.find(p => p.type === 'timeZoneName')?.value ?? 'GMT+1';
  const m = tz.match(/GMT([+-]\d+)/);
  return m ? parseInt(m[1]) : 1;
}

// Returns { start, end, label, midnightUTC } for a CET calendar day.
// daysAgo=0 → today in CET, daysAgo=1 → yesterday, etc.
function getCETDayRange(daysAgo = 0) {
  const ref = new Date(Date.now() - daysAgo * 86_400_000);
  // Calendar date in Vienna time, e.g. "2026-04-30"
  const dateStr = ref.toLocaleDateString('sv-SE', { timeZone: 'Europe/Vienna' });
  // Offset at noon UTC of that day (avoids any midnight DST edge)
  const offset = getCETOffset(new Date(`${dateStr}T12:00:00.000Z`));
  // Midnight CET expressed as UTC: "dateStr 00:00 CET" = "dateStr 00:00 UTC" − offset hours
  const midnightUTC = new Date(new Date(`${dateStr}T00:00:00.000Z`).getTime() - offset * 3_600_000);
  return {
    start: midnightUTC.toISOString(),
    end: new Date(midnightUTC.getTime() + 86_400_000).toISOString(),
    label: dateStr,
    midnightUTC,
  };
}

// ── Data fetching ─────────────────────────────────────────────────────────────

async function fetchDayData(range) {
  const query = `from(bucket: "${INFLUX_BUCKET}")
  |> range(start: ${range.start}, stop: ${range.end})
  |> filter(fn: (r) => r._measurement == "solax_stats")
  |> filter(fn: (r) => r._field == "daily_yield" or r._field == "consumption" or r._field == "daily_discharged" or r._field == "daily_imported" or r._field == "total_yield")
  |> aggregateWindow(every: 5m, fn: mean, createEmpty: false)
  |> yield(name: "mean")`;

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
    if (!resp.ok) return {};
    return parseCSV(await resp.text(), range.midnightUTC);
  } catch (e) {
    console.error('[kiosk] fetch error:', e);
    return {};
  }
}

function parseCSV(csv, midnightUTC) {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return {};

  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  const vi = headers.indexOf('_value');
  const ti = headers.indexOf('_time');
  const fi = headers.indexOf('_field');

  const result = { total_yield: [] };
  SERIES.forEach(s => { result[s.field] = []; });

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim().replace(/"/g, ''));
    if (!cols[vi] || !cols[ti] || !cols[fi]) continue;
    const field = cols[fi];
    if (!(field in result)) continue;
    const x = (new Date(cols[ti]) - midnightUTC) / 3_600_000; // hours since CET midnight
    const y = parseFloat(cols[vi]);
    if (isFinite(x) && isFinite(y) && x >= 0 && x <= 24) {
      result[field].push({ x, y });
    }
  }

  return result;
}

// ── Chart helpers ─────────────────────────────────────────────────────────────

function buildDatasets(dataByField) {
  return SERIES.map(s => ({
    label: s.label,
    data: [...(dataByField[s.field] ?? [])].sort((a, b) => a.x - b.x),
    borderColor: s.color,
    backgroundColor: s.fill,
    fill: true,
    tension: 0.4,
    pointRadius: 0,
    pointHoverRadius: 4,
    borderWidth: 2,
  }));
}

function makeOptions(isMain) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    interaction: isMain ? { mode: 'index', intersect: false } : { mode: 'none' },
    plugins: {
      legend: {
        display: isMain,
        position: 'top',
        labels: {
          color: 'rgba(255,255,255,0.75)',
          font: { size: 12 },
          usePointStyle: true,
          pointStyle: 'line',
          boxWidth: 20,
          padding: 10,
        },
      },
      tooltip: {
        enabled: isMain,
        backgroundColor: 'rgba(20, 22, 28, 0.82)',
        borderColor: 'rgba(255, 255, 255, 0.08)',
        borderWidth: 1,
        padding: 10,
        titleColor: 'rgba(255,255,255,0.85)',
        bodyColor: 'rgba(255,255,255,0.7)',
        usePointStyle: true,
        boxWidth: 8,
        boxHeight: 8,
        itemSort: (a, b) => b.parsed.y - a.parsed.y,
        callbacks: {
          title: items => {
            if (!items.length) return '';
            const v = items[0].parsed.x;
            const h = Math.floor(v);
            const m = Math.round((v - h) * 60);
            return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
          },
          label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y.toFixed(2)} kWh`,
        },
      },
    },
    scales: {
      x: {
        type: 'linear',
        min: 0,
        max: 24,
        ticks: {
          color: 'rgba(255,255,255,0.45)',
          stepSize: isMain ? 2 : 6,
          maxRotation: 0,
          font: { size: isMain ? 11 : 8 },
          callback: v => {
            if (!isMain) return `${v}`;
            const h = Math.floor(v);
            const m = Math.round((v - h) * 60);
            return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}h`;
          },
        },
        grid: { color: 'rgba(255,255,255,0.05)' },
      },
      y: {
        suggestedMin: 0,
        ticks: {
          color: 'rgba(255,255,255,0.45)',
          font: { size: isMain ? 11 : 8 },
          maxTicksLimit: isMain ? 6 : 4,
          callback: v => isMain ? `${v} kWh` : `${v}`,
        },
        grid: { color: 'rgba(255,255,255,0.05)' },
      },
    },
  };
}

// ── Date formatting ───────────────────────────────────────────────────────────

function fmtShort(dateStr) {
  // "2026-04-30" → "30.04."
  const [, m, d] = dateStr.split('-');
  return `${d}.${m}.`;
}

function fmtFull(dateStr) {
  // "2026-04-30" → "30.04.2026"
  const [y, m, d] = dateStr.split('-');
  return `${d}.${m}.${y}`;
}

// ── Initialization ────────────────────────────────────────────────────────────

function initCharts() {
  mainChart = new Chart(document.getElementById('mainChart').getContext('2d'), {
    type: 'line',
    data: { datasets: [] },
    options: makeOptions(true),
  });

  const container = document.querySelector('.history-panel');
  for (let i = 1; i <= 6; i++) {
    const range = getCETDayRange(i);
    const div = document.createElement('div');
    div.className = 'day-panel';
    div.innerHTML = `
      <div class="day-header">
        <span class="day-label">${fmtShort(range.label)}</span>
        <span class="day-stats">
          <span class="day-stat-gen" style="color:#f59e0b">&#8593; --</span>
          <span class="day-stat-con" style="color:#3b82f6">&#8595; --</span>
          <span class="day-stat-co2" style="color:#22c55e">-- kg</span>
        </span>
      </div>
      <div class="day-chart-wrap"><canvas></canvas></div>
    `;
    dayStatEls.push({
      gen: div.querySelector('.day-stat-gen'),
      con: div.querySelector('.day-stat-con'),
      co2: div.querySelector('.day-stat-co2'),
    });
    container.appendChild(div);
    dayCharts.push(
      new Chart(div.querySelector('canvas').getContext('2d'), {
        type: 'line',
        data: { datasets: [] },
        options: makeOptions(false),
      })
    );
  }
}

// ── Weather ───────────────────────────────────────────────────────────────────

async function fetchWeather() {
  try {
    const resp = await fetch(WEATHER_URL);
    if (!resp.ok) return;
    const data = await resp.json();
    const condition = WMO[data.current.weather_code] ?? 'Unknown';
    const temp = data.current.temperature_2m;
    document.getElementById('boxWeather').textContent = condition;
    document.getElementById('boxWeatherTemp').textContent = `${temp.toFixed(1)}°C`;
  } catch (e) {
    console.error('[kiosk] weather error:', e);
  }
}

// ── Info boxes ────────────────────────────────────────────────────────────────

const CO2_KG_PER_KWH = 0.4; // Austrian grid average avoided emission factor

function latestValue(dataByField, field) {
  const pts = dataByField[field] ?? [];
  return pts.length > 0 ? pts[pts.length - 1].y : null;
}

function fmtKwh(v, decimals = 1) {
  if (v == null) return '-- kWh';
  return `${v.toLocaleString('de-AT', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} kWh`;
}

function updateInfoBoxes(todayData) {
  const generated = latestValue(todayData, 'daily_yield');
  const consumed  = latestValue(todayData, 'consumption');
  const lifetime  = latestValue(todayData, 'total_yield');
  const co2       = generated != null ? generated * CO2_KG_PER_KWH : null;

  const el = id => document.getElementById(id);

  el('boxGenerated').textContent = fmtKwh(generated);
  el('boxConsumed').textContent  = fmtKwh(consumed);
  el('boxCO2').textContent       = co2 != null
    ? `${co2.toLocaleString('de-AT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg`
    : '-- kg';
  el('boxLifetime').textContent  = lifetime != null
    ? `${lifetime.toLocaleString('de-AT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} kWh`
    : '-- kWh';
}

// ── Refresh ───────────────────────────────────────────────────────────────────

async function refresh() {
  // Build ranges: [today, yesterday, ..., 6 days ago]
  const ranges = Array.from({ length: 7 }, (_, i) => getCETDayRange(i));
  const [todayRange, ...dayRanges] = ranges;

  // Update static labels
  document.getElementById('mainTitle').textContent = `Today · ${fmtFull(todayRange.label)}`;
  const dayLabelEls = document.querySelectorAll('.day-header .day-label');
  dayRanges.forEach((r, i) => {
    if (dayLabelEls[i]) dayLabelEls[i].textContent = fmtShort(r.label);
  });

  // Fetch all days in parallel
  const allData = await Promise.all(ranges.map(fetchDayData));
  const [todayData, ...daysData] = allData;

  mainChart.data.datasets = buildDatasets(todayData);
  mainChart.update();

  daysData.forEach((data, i) => {
    dayCharts[i].data.datasets = buildDatasets(data);
    dayCharts[i].update();

    const gen = latestValue(data, 'daily_yield');
    const con = latestValue(data, 'consumption');
    if (dayStatEls[i]) {
      dayStatEls[i].gen.textContent = `↑ ${gen != null ? gen.toFixed(1) + ' kWh' : '--'}`;
      dayStatEls[i].con.textContent = `↓ ${con != null ? con.toFixed(1) + ' kWh' : '--'}`;
      const co2 = gen != null ? gen * CO2_KG_PER_KWH : null;
      dayStatEls[i].co2.textContent = co2 != null ? `${co2.toFixed(1)} kg CO₂` : '-- kg';
    }
  });

  updateInfoBoxes(todayData);
  fetchWeather();

  const now = new Date();
  document.getElementById('kioskUpdated').textContent =
    `Updated: ${now.toLocaleTimeString('de-AT', { timeZone: 'Europe/Vienna', hour: '2-digit', minute: '2-digit' })}`;
}

// ── Clock ─────────────────────────────────────────────────────────────────────

function startClock() {
  const tick = () => {
    const now = new Date();
    const date = now.toLocaleDateString('en-GB', {
      timeZone: 'Europe/Vienna',
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    const time = now.toLocaleTimeString('en-GB', {
      timeZone: 'Europe/Vienna',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    document.getElementById('kioskClock').textContent = `${date}, ${time}`;
  };
  tick();
  setInterval(tick, 1000);
}

// ── MQTT live updates via WebSocket bridge ────────────────────────────────────

function addLiveChartPoint(generated, consumed, discharged, imported_) {
  if (!mainChart || !mainChart.data.datasets.length) return;
  const { midnightUTC } = getCETDayRange(0);
  const x = (Date.now() - midnightUTC) / 3_600_000;
  const values = { daily_yield: generated, consumption: consumed, daily_discharged: discharged, daily_imported: imported_ };
  SERIES.forEach((s, i) => {
    const v = values[s.field];
    if (v == null || !isFinite(v)) return;
    const dataset = mainChart.data.datasets[i];
    if (!dataset) return;
    dataset.data = dataset.data.filter(p => Math.abs(p.x - x) > 0.008);
    dataset.data.push({ x, y: v });
    dataset.data.sort((a, b) => a.x - b.x);
  });
  mainChart.update('none');
}

function applyPvMessage(d) {
  // Accept both camelCase (Solax API) and snake_case (InfluxDB) field names
  const generated  = d.dailyYield      ?? d.daily_yield      ?? null;
  const discharged = d.dailyDischarged ?? d.daily_discharged ?? null;
  const imported_  = d.dailyImported   ?? d.daily_imported   ?? null;
  const exported_  = d.dailyExported   ?? d.daily_exported   ?? null;
  const lifetime   = d.totalYield      ?? d.total_yield      ?? null;
  const consumed   = d.consumption
    ?? (generated != null && exported_ != null && imported_ != null
        ? generated - exported_ + imported_ : null);
  const co2 = generated != null ? generated * CO2_KG_PER_KWH : null;

  const el = id => document.getElementById(id);
  if (generated != null) el('boxGenerated').textContent = fmtKwh(generated);
  if (consumed  != null) el('boxConsumed').textContent  = fmtKwh(consumed);
  if (co2       != null) el('boxCO2').textContent       =
    `${co2.toLocaleString('de-AT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg`;
  if (lifetime  != null) el('boxLifetime').textContent  =
    `${lifetime.toLocaleString('de-AT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} kWh`;

  addLiveChartPoint(generated, consumed, discharged, imported_);

  const now = new Date();
  el('kioskUpdated').textContent =
    `Updated: ${now.toLocaleTimeString('de-AT', { timeZone: 'Europe/Vienna', hour: '2-digit', minute: '2-digit' })}`;
}

function connectMqttBridge() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const wsUrl = `${proto}://${location.host}/ws`;

  function connect() {
    const ws = new WebSocket(wsUrl);

    ws.addEventListener('message', (evt) => {
      let msg;
      try { msg = JSON.parse(evt.data); } catch { return; }
      if (msg.type === 'pv') applyPvMessage(msg.data);
    });

    ws.addEventListener('close', () => {
      setTimeout(connect, 5000);
    });

    ws.addEventListener('error', () => {});
  }

  connect();
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  initCharts();
  startClock();
  refresh();
  connectMqttBridge();
  setInterval(refresh, REFRESH_MS);
});
