// InfluxDB Configuration
const INFLUXDB_URL = '/influx';
const INFLUXDB_TOKEN = 'ih3lGQ2dVqXG7ec0Ai-flUi5ZWTqp3AChtwI0fu4014-cn5h0MRE6-RcWtlL1yYGUaaSg6NOtcW_TEjQdGGA5A==';
const INFLUXDB_ORG = 'leoiot';
const INFLUXDB_BUCKET = 'server_data';

// Solax Configuration
const SOLAX_HOST = '/solax/';
const SOLAX_CLIENT_ID = 'b6d55e642b304989be96a3e0f0ce1793';
const SOLAX_CLIENT_SECRET = 'HCRctfp7_ezVhnIWlNrzO3--U_wFSjscVEhdQd5RpUI';
const SOLAX_USERNAME = 'm.remake';
const SOLAX_PASSWORD = 'Uniformed-Auction-Lanky1';
const SOLAX_PLANT_ID = '508819503377442';

// State
let currentView = 'sensors';
let solaxToken = null;
let selectedSensor = '1Aula';
let availableRooms = [];
let currentTimeRange = '6h';
let currentFloorFilter = 'all';
let displayedRoomsCount = 10;
const ROOMS_PER_PAGE = 15;

// Chart instances
let tempChart, co2Chart, pvSolarChart, pvConsumptionChart;
let ws;
let pvInterval;

// Initialize dashboard
document.addEventListener('DOMContentLoaded', async () => {
	// Hide loading screen
	setTimeout(() => {
		document.getElementById('loading').style.opacity = '0';
		setTimeout(() => {
			document.getElementById('loading').style.display = 'none';
		}, 500);
	}, 1000);

	// Initialize charts
	initCharts();

	// Load initial data
	await refreshAllData();
	
	// Initial animation for the first room
	triggerRoomAnimation();

	// Setup MQTT over WebSocket
	setupMQTT();

	// Set status to Live
	const refreshEl = document.getElementById('tableLastRefresh');
	if (refreshEl) {
		refreshEl.innerHTML = '<span style="color: #4ade80">●</span> Live MQTT Stream';
	}
});

function setupMQTT() {
	const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
	const wsUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
		? `${wsProtocol}//${window.location.hostname}:8090`
		: `${wsProtocol}//${window.location.hostname}/ws`;
	
	console.log(`[MQTT] Attempting connection to ${wsUrl}...`);
	ws = new WebSocket(wsUrl);

	ws.onopen = () => {
		console.log('[MQTT] Successfully connected to WebSocket bridge');
		subscribeToAllRooms();
	};

	ws.onmessage = (event) => {
		try {
			const msg = JSON.parse(event.data);
			if (msg.type !== 'hello' && msg.type !== 'subscribed') {
				handleLiveUpdate(msg);
			}
		} catch (e) {
			console.error('[MQTT] Error parsing message:', e);
		}
	};

	ws.onclose = (e) => {
		console.log(`[MQTT] Connection closed (${e.code}). Retrying in 5s...`);
		setTimeout(setupMQTT, 5000);
	};

	ws.onerror = (err) => {
		console.error('[MQTT] WebSocket error:', err);
	};
}

function subscribeToAllRooms() {
	if (ws && ws.readyState === WebSocket.OPEN && availableRooms.length > 0) {
		console.log(`[MQTT] Subscribing to ${availableRooms.length} rooms...`);
		availableRooms.forEach(room => {
			ws.send(JSON.stringify({ type: 'subscribe', room }));
		});
	}
}

function handleLiveUpdate(msg) {
	if (!msg || !msg.room) return;
	
	// Update global room data state for the table and "all" calculations
	if (!window.lastRoomData) window.lastRoomData = [];
	
	let room = window.lastRoomData.find(r => r.room === msg.room);
	if (!room) {
		room = { room: msg.room, temperature: null, co2: null, time: new Date(msg.ts) };
		window.lastRoomData.push(room);
	}
	
	if (msg.type === 'temp') {
		room.temperature = msg.value;
	} else if (msg.type === 'co2') {
		room.co2 = msg.value;
	}
	room.time = new Date(msg.ts);
	
	// Update table immediately if visible
	updateRoomTable(window.lastRoomData);

	// Update summary cards for "All Rooms" view or specific room
	updateSummaryFromLive(msg);
	
	// update charts if applicable
	if (selectedSensor !== 'all' && msg.room === selectedSensor) {
		if (msg.type === 'temp') {
			updateChartsWithLivePoint(tempChart, msg.value, msg.ts);
		} else if (msg.type === 'co2') {
			updateChartsWithLivePoint(co2Chart, msg.value, msg.ts);
		}
	}
}

function updateSummaryFromLive(msg) {
	const isAllView = selectedSensor === 'all';
	const isCurrentRoom = msg.room === selectedSensor;
	
	if (!isAllView && !isCurrentRoom) return;

	if (isAllView) {
		// Recalculate averages for filtered rooms
		const filteredRooms = window.lastRoomData?.filter(room => {
			return currentFloorFilter === 'all' ||
				(currentFloorFilter === '1' && room.room.startsWith('1')) ||
				(currentFloorFilter === '2' && room.room.startsWith('2')) ||
				(currentFloorFilter === 'E' && room.room.startsWith('E')) ||
				(currentFloorFilter === 'U' && room.room.startsWith('U'));
		}) || [];

		if (msg.type === 'temp') {
			const roomsWithTemp = filteredRooms.filter(r => r.temperature !== null);
			const avgTemp = roomsWithTemp.reduce((acc, r) => acc + r.temperature, 0) / (roomsWithTemp.length || 1);
			document.getElementById('currentTemp').textContent = `${avgTemp.toFixed(1)}°C`;
		} else if (msg.type === 'co2') {
			const roomsWithCo2 = filteredRooms.filter(r => r.co2 !== null);
			const avgCo2 = roomsWithCo2.reduce((acc, r) => acc + r.co2, 0) / (roomsWithCo2.length || 1);
			document.getElementById('currentCo2').textContent = `${avgCo2.toFixed(0)} ppm`;
		}
		document.getElementById('activeSensors').textContent = filteredRooms.length;
	} else {
		// Update single room boxes
		if (msg.type === 'temp') {
			document.getElementById('currentTemp').textContent = `${msg.value.toFixed(1)}°C`;
		} else if (msg.type === 'co2') {
			document.getElementById('currentCo2').textContent = `${msg.value.toFixed(0)} ppm`;
		}
	}
}

function updateChartsWithLivePoint(chart, value, ts) {
	if (!chart) return;
	
	// Ensure dataset exists
	if (chart.data.datasets.length === 0) {
		chart.data.datasets.push({
			label: 'Live Data',
			data: [],
			borderColor: '#3b82f6',
			tension: 0.4
		});
	}

	const time = new Date(ts);
	chart.data.labels.push(formatTime(time));
	if (chart.data.tooltipLabels) {
		chart.data.tooltipLabels.push(formatTooltipTime(time));
	}
	chart.data.datasets[0].data.push(value);
	
	// Keep only last 50 points to avoid memory issues
	if (chart.data.labels.length > 50) {
		chart.data.labels.shift();
		if (chart.data.tooltipLabels) chart.data.tooltipLabels.shift();
		chart.data.datasets[0].data.shift();
	}
	
	chart.update('none'); // Update without animation for smooth live feel
}

function triggerRoomAnimation() {
	const elements = document.querySelectorAll('.card, .chart-card, .table-card');
	elements.forEach((el, index) => {
		el.classList.remove('animate-up');
		// Trigger reflow
		void el.offsetWidth;
		// Add class with delay
		setTimeout(() => {
			el.classList.add('animate-up');
		}, index * 50);
	});
}

// Initialize Chart.js charts
function initCharts() {
	const baseOptions = {
		responsive: true,
		maintainAspectRatio: false,
		plugins: {
			legend: {
				labels: {
					color: 'rgba(255, 255, 255, 0.7)',
					font: { size: 12 }
				}
			},
			tooltip: {
				callbacks: {
					title: (context) => {
						const chart = context[0].chart;
						const index = context[0].dataIndex;
						return chart.data.tooltipLabels ? chart.data.tooltipLabels[index] : context[0].label;
					}
				}
			}
		},
		scales: {
			x: {
				ticks: { 
					color: 'rgba(255, 255, 255, 0.5)',
					maxRotation: 0,
					autoSkip: true,
					maxTicksLimit: 12
				},
				grid: { color: 'rgba(255, 255, 255, 0.05)' }
			},
			y: {
				ticks: { color: 'rgba(255, 255, 255, 0.5)' },
				grid: { color: 'rgba(255, 255, 255, 0.05)' }
			}
		}
	};

	// Temperature History Chart Options
	const tempOptions = JSON.parse(JSON.stringify(baseOptions));
	tempOptions.scales.y.suggestedMin = 15;
	tempOptions.scales.y.suggestedMax = 30;
	tempOptions.scales.y.ticks.stepSize = 1;

	// Temperature History Chart
	const tempCtx = document.getElementById('tempChart').getContext('2d');
	tempChart = new Chart(tempCtx, {
		type: 'line',
		data: { labels: [], datasets: [] },
		options: tempOptions
	});

	// CO2 History Chart Options
	const co2Options = JSON.parse(JSON.stringify(baseOptions));
	co2Options.scales.y.suggestedMin = 400;
	co2Options.scales.y.suggestedMax = 1200;
	co2Options.scales.y.ticks.stepSize = 200;

	// CO2 History Chart
	const co2Ctx = document.getElementById('co2Chart').getContext('2d');
	co2Chart = new Chart(co2Ctx, {
		type: 'line',
		data: { labels: [], datasets: [] },
		options: co2Options
	});

	// PV Solar Chart
	const solarCtx = document.getElementById('pvSolarChart').getContext('2d');
	pvSolarChart = new Chart(solarCtx, {
		type: 'line',
		data: { labels: [], datasets: [] },
		options: {
			...baseOptions,
			scales: {
				...baseOptions.scales,
				y: { ...baseOptions.scales.y, suggestedMin: 0 }
			}
		}
	});

	// PV Consumption Chart
	const consumptionCtx = document.getElementById('pvConsumptionChart').getContext('2d');
	pvConsumptionChart = new Chart(consumptionCtx, {
		type: 'line',
		data: { labels: [], datasets: [] },
		options: {
			...baseOptions,
			scales: {
				...baseOptions.scales,
				y: { ...baseOptions.scales.y, suggestedMin: 0 }
			}
		}
	});
}

// Set time range
window.setTimeRange = async (range) => {
	currentTimeRange = range;
	document.querySelectorAll('.time-btn').forEach(btn => {
		btn.classList.remove('active');
		if (btn.textContent === range) btn.classList.add('active');
	});
	await refreshAllData();
};

// Switch between Sensors and PV view
window.switchView = async (view) => {
	if (currentView === view) return;
	currentView = view;

	const sensorsView = document.getElementById('sensorsView');
	const pvView = document.getElementById('pvView');
	const btnSensors = document.getElementById('btnSensors');
	const btnPV = document.getElementById('btnPV');
	const title = document.getElementById('dashboardTitle');
	const timeSelector = document.getElementById('sensorTimeSelector');

	if (view === 'sensors') {
		sensorsView.style.display = 'block';
		pvView.style.display = 'none';
		btnSensors.classList.add('active');
		btnPV.classList.remove('active');
		title.textContent = '🏢 LeoIOT Sensor Dashboard';
		timeSelector.style.visibility = 'visible';
		
		// Stop PV polling
		if (pvInterval) {
			clearInterval(pvInterval);
			pvInterval = null;
		}
	} else {
		sensorsView.style.display = 'none';
		pvView.style.display = 'block';
		btnSensors.classList.remove('active');
		btnPV.classList.add('active');
		title.textContent = '☀️ LeoIOT PV Dashboard';
		timeSelector.style.visibility = 'hidden';
		
		// Start PV polling (every 30s)
		await refreshPVData();
		pvInterval = setInterval(refreshPVData, 30000);
	}
	
	triggerRoomAnimation();
};

async function getSolaxToken() {
	if (solaxToken) return solaxToken;
	
	try {
		const url = `${SOLAX_HOST}openapi/auth/get_token`;
		console.log(`[Solax] Fetching token from: ${url}`);
		const response = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				client_id: SOLAX_CLIENT_ID,
				client_secret: SOLAX_CLIENT_SECRET,
				grant_type: 'CICS',
				username: SOLAX_USERNAME,
				password: SOLAX_PASSWORD
			})
		});
		
		if (!response.ok) {
			const text = await response.text();
			console.error(`Solax token request failed with status ${response.status}: ${text}`);
			return null;
		}

		const data = await response.json();
		if (data.code === 0) {
			solaxToken = data.result.access_token;
			return solaxToken;
		}
	} catch (error) {
		console.error('Error fetching Solax token:', error);
	}
	return null;
}

async function refreshPVData() {
	const token = await getSolaxToken();
	if (!token) return;

	try {
		// 1. Fetch Real-time Snapshot
		const url = `${SOLAX_HOST}openapi/v2/plant/realtime_data?plantId=${SOLAX_PLANT_ID}&businessType=4`;
		const response = await fetch(url, {
			method: 'GET',
			headers: {
				'Authorization': `Bearer ${token}`,
				'Content-Type': 'application/json'
			}
		});
		
		const data = await response.json();
		if (data.code === 10000) {
			updatePVDashboard(data.result);
		}

		// 2. Fetch History from InfluxDB for the Charts
		await fetchPVHistoryData();

	} catch (error) {
		console.error('Error fetching Solax real-time data:', error);
	}
}

async function fetchPVHistoryData() {
	const query = `from(bucket: "${INFLUXDB_BUCKET}")
       |> range(start: -${currentTimeRange})
       |> filter(fn: (r) => r._measurement == "solax_stats")
       |> filter(fn: (r) => r._field == "daily_yield" or r._field == "consumption")
       |> aggregateWindow(every: 5m, fn: mean, createEmpty: false)
       |> yield(name: "mean")`;

	try {
		const csvData = await fetchInfluxDB(query);
		const dataByField = parsePVHistoryResponse(csvData);
		
		updatePVCharts(dataByField);
	} catch (error) {
		console.error('Error fetching PV history from InfluxDB:', error);
	}
}

function parsePVHistoryResponse(csvData) {
	const lines = csvData.trim().split('\n');
	if (lines.length < 2) return {};

	const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
	const valueIndex = headers.indexOf('_value');
	const timeIndex = headers.indexOf('_time');
	const fieldIndex = headers.indexOf('_field');

	const dataByField = { daily_yield: [], consumption: [] };

	for (let i = 1; i < lines.length; i++) {
		const columns = lines[i].split(',').map(c => c.trim().replace(/"/g, ''));
		if (!columns[valueIndex] || !columns[timeIndex] || !columns[fieldIndex]) continue;

		const field = columns[fieldIndex];
		const value = parseFloat(columns[valueIndex]);
		const time = new Date(columns[timeIndex]);

		if (dataByField[field]) {
			dataByField[field].push({ time, value });
		}
	}

	return dataByField;
}

function updatePVCharts(dataByField) {
	if (dataByField.daily_yield && dataByField.daily_yield.length > 0) {
		const yieldData = dataByField.daily_yield.sort((a, b) => a.time - b.time);
		pvSolarChart.data.labels = yieldData.map(({ time }) => formatTime(time));
		pvSolarChart.data.tooltipLabels = yieldData.map(({ time }) => formatTooltipTime(time));
		pvSolarChart.data.datasets = [{
			label: 'Solar Power Today (kWh)',
			data: yieldData.map(({ value }) => value),
			borderColor: '#f59e0b',
			backgroundColor: 'rgba(245, 158, 11, 0.1)',
			fill: true,
			tension: 0.4
		}];
		pvSolarChart.update();
	}

	if (dataByField.consumption && dataByField.consumption.length > 0) {
		const consumptionData = dataByField.consumption.sort((a, b) => a.time - b.time);
		pvConsumptionChart.data.labels = consumptionData.map(({ time }) => formatTime(time));
		pvConsumptionChart.data.tooltipLabels = consumptionData.map(({ time }) => formatTooltipTime(time));
		pvConsumptionChart.data.datasets = [{
			label: 'Building Consumption (kWh)',
			data: consumptionData.map(({ value }) => value),
			borderColor: '#3b82f6',
			backgroundColor: 'rgba(59, 130, 246, 0.1)',
			fill: true,
			tension: 0.4
		}];
		pvConsumptionChart.update();
	}
}

function updatePVDashboard(data) {
	document.getElementById('pvDailyYield').textContent = `${data.dailyYield.toFixed(1)} kWh`;
	document.getElementById('pvTotalYield').textContent = `${data.totalYield.toFixed(1)} kWh`;
	
	// Battery Usage (Charged - Discharged)
	const batteryFlow = data.dailyCharged - data.dailyDischarged;
	document.getElementById('pvBatteryFlow').textContent = `${Math.abs(batteryFlow).toFixed(1)} kWh`;
	document.getElementById('pvBatteryStatus').textContent = batteryFlow >= 0 ? 'Charging (Net)' : 'Discharging (Net)';
	
	// Grid Usage (Imported - Exported)
	const gridFlow = data.dailyImported - data.dailyExported;
	document.getElementById('pvGridFlow').textContent = `${Math.abs(gridFlow).toFixed(1)} kWh`;
	document.getElementById('pvGridStatus').textContent = gridFlow >= 0 ? 'Buying (Net)' : 'Selling (Net)';
	
	document.getElementById('pvTimeLabel').textContent = `Updated: ${data.plantLocalTime}`;
	
	// Details
	document.getElementById('pvDailyCharged').textContent = `${data.dailyCharged.toFixed(1)} kWh`;
	document.getElementById('pvDailyDischarged').textContent = `${data.dailyDischarged.toFixed(1)} kWh`;
	document.getElementById('pvDailyImported').textContent = `${data.dailyImported.toFixed(1)} kWh`;
	document.getElementById('pvDailyExported').textContent = `${data.dailyExported.toFixed(1)} kWh`;
}


// Filter by floor
window.filterByFloor = async (floor) => {
	currentFloorFilter = floor;
	document.querySelectorAll('.filter-tab').forEach(btn => {
		btn.classList.remove('active');
		if (btn.dataset.floor === floor) btn.classList.add('active');
	});

	// 1. Visually filter the buttons
	filterSensors();

	// 2. Re-run the calculations for the summary cards
	await refreshAllData();
};

// Select sensor
window.selectSensor = async (sensor) => {
	if (selectedSensor === sensor) return; // No change
	
	const oldSensor = selectedSensor;
	selectedSensor = sensor;
	
	// Update custom dropdown display
	const trigger = document.getElementById('roomDropdownTrigger');
	if (trigger) {
		const label = sensor === 'all' ? '📊 All Rooms' : `🏠 Room ${sensor}`;
		trigger.textContent = label;
	}

	const label = sensor === 'all' ? 'All Rooms' : `Room ${sensor}`;
	document.getElementById('tempChartSubtitle').textContent = label;
	document.getElementById('co2ChartSubtitle').textContent = label;
	document.getElementById('tempSensorLabel').textContent = label;
	document.getElementById('co2SensorLabel').textContent = label;
	
	// Clear popups
	document.getElementById('searchResults')?.classList.remove('visible');
	document.getElementById('roomDropdownPopup')?.classList.remove('visible');

	// Trigger animation
	triggerRoomAnimation();

	await refreshAllData();
};

// Toggle room dropdown
window.toggleRoomDropdown = () => {
	const popup = document.getElementById('roomDropdownPopup');
	const isVisible = popup.classList.contains('visible');
	
	// Close other popups
	document.getElementById('searchResults')?.classList.remove('visible');
	
	if (isVisible) {
		popup.classList.remove('visible');
	} else {
		popup.classList.add('visible');
	}
};

// Filter sensors based on search (shows popup, ignores floor filters)
window.filterSensors = () => {
	const searchTerm = document.getElementById('sensorSearch').value.toLowerCase().trim();
	const resultsPopup = document.getElementById('searchResults');
	
	if (!searchTerm) {
		resultsPopup.classList.remove('visible');
		resultsPopup.innerHTML = '';
		return;
	}

	// Filter all available rooms, ignoring the current floor filter
	const matches = availableRooms.filter(room => 
		room.toLowerCase().includes(searchTerm)
	);

	if (matches.length > 0) {
		resultsPopup.innerHTML = matches.map(room => `
			<div class="search-result-item" onclick="selectSensor('${room}')">
				<span class="room-id">🏠 Room ${room}</span>
			</div>
		`).join('');
		resultsPopup.classList.add('visible');
	} else {
		resultsPopup.innerHTML = '<div class="search-result-item">No rooms found</div>';
		resultsPopup.classList.add('visible');
	}
};

// Close search results when clicking outside
document.addEventListener('click', (e) => {
	const searchContainer = document.querySelector('.sensor-search-container');
	const dropdownContainer = document.querySelector('.sensor-dropdown-container');
	
	if (searchContainer && !searchContainer.contains(e.target)) {
		document.getElementById('searchResults')?.classList.remove('visible');
	}
	
	if (dropdownContainer && !dropdownContainer.contains(e.target)) {
		document.getElementById('roomDropdownPopup')?.classList.remove('visible');
	}
});

// Show more rooms in table
window.showMoreRooms = () => {
	displayedRoomsCount += ROOMS_PER_PAGE;
	updateRoomTable(window.lastRoomData || []);
};

// Refresh all data
window.refreshAllData = async () => {
	if (currentView === 'pv') {
		await refreshPVData();
		return;
	}

	const [tempData, co2Data, allRoomData, room105CO2, room105Temp] = await Promise.all([
		fetchTemperatureData(),
		fetchCO2Data(),
		fetchAllRoomData(),
		fetchRoom105CO2(), // Special fetch for Room 105 latest CO2
		fetchRoom105Temperature() // Special fetch for Room 105 latest temperature
	]);

	// Inject Room 105 temperature into tempData so chart/summary cards work
	if (room105Temp.length > 0) {
		tempData['105'] = room105Temp;
	} else if (!tempData['105']) {
		tempData['105'] = [];
	}

	// Apply the specific 20s Room 105 query to the general room data array
	let room105 = allRoomData.find(r => r.room === '105');
	if (room105 && room105CO2.length > 0) {
		room105.co2 = room105CO2[0].co2;
	} else if (!room105 && room105CO2.length > 0) {
		allRoomData.push({
			room: '105',
			temperature: null,
			co2: room105CO2[0].co2,
			time: room105CO2[0].time
		});
	}

	updateRoomSelector(tempData);
	updateSummaryCards(tempData, co2Data, room105CO2);
	updateTemperatureChart(tempData);
	updateCO2Chart(co2Data);
	updateRoomTable(allRoomData);
	window.lastRoomData = allRoomData;
};

// Update room selector custom dropdown
function updateRoomSelector(tempData) {
	const rooms = Object.keys(tempData).sort();

	// Ensure Room 105 always appears in the selector (live WS feed may have data even if InfluxDB doesn't)
	if (!rooms.includes('105')) {
		tempData['105'] = [];
		rooms.push('105');
		rooms.sort();
	}
	
	availableRooms = rooms;

	const popup = document.getElementById('roomDropdownPopup');
	if (!popup) return;

	let html = `
       <div class="search-result-item ${selectedSensor === 'all' ? 'active' : ''}" onclick="selectSensor('all')">
          <span class="room-id">📊 All Rooms (Average)</span>
       </div>
    `;

	rooms.forEach(room => {
		// Apply floor filters
		const matchesFloor = currentFloorFilter === 'all' ||
			(currentFloorFilter === '1' && room.startsWith('1')) ||
			(currentFloorFilter === '2' && room.startsWith('2')) ||
			(currentFloorFilter === 'E' && room.startsWith('E')) ||
			(currentFloorFilter === 'U' && room.startsWith('U'));

		if (matchesFloor) {
			html += `
				<div class="search-result-item ${selectedSensor === room ? 'active' : ''}" onclick="selectSensor('${room}')">
					<span class="room-id">🏠 Room ${room}</span>
				</div>
			`;
		}
	});
	
	popup.innerHTML = html;
	
	// Update trigger label too
	const trigger = document.getElementById('roomDropdownTrigger');
	if (trigger) {
		trigger.textContent = selectedSensor === 'all' ? '📊 All Rooms' : `🏠 Room ${selectedSensor}`;
	}
}

// Fetch temperature data
async function fetchTemperatureData() {
	const query = `from(bucket: "${INFLUXDB_BUCKET}")
       |> range(start: -${currentTimeRange})
       |> filter(fn: (r) => r._measurement == "room_temperature")
       |> filter(fn: (r) => r._field == "temperature")
       |> aggregateWindow(every: 5m, fn: mean, createEmpty: false)
       |> yield(name: "mean")`;

	try {
		const response = await fetchInfluxDB(query);
		return parseInfluxDBResponse(response, 'room');
	} catch (error) {
		console.error('Error fetching temperature data:', error);
		return {};
	}
}

// Fetch CO2 data
async function fetchCO2Data() {
	const query = `from(bucket: "${INFLUXDB_BUCKET}")
       |> range(start: -${currentTimeRange})
       |> filter(fn: (r) => r._measurement == "mqtt_consumer")
       |> filter(fn: (r) => r.topic =~ /co2/)
       |> filter(fn: (r) => r._field == "value")
       |> aggregateWindow(every: 5m, fn: mean, createEmpty: false)
       |> yield(name: "mean")`;

	try {
		const response = await fetchInfluxDB(query);
		return parseInfluxDBResponse(response, 'topic');
	} catch (error) {
		console.error('Error fetching CO2 data:', error);
		return {};
	}
}

// Custom Fetch for Room 105 latest CO2
async function fetchRoom105CO2() {
	const topic = "nili3/sensor/nili3_co2/state";
	const query = `from(bucket: "${INFLUXDB_BUCKET}")
      |> range(start: -20s)
      |> filter(fn: (r) => r._measurement == "mqtt_consumer" and r.topic == "${topic}")
      |> filter(fn: (r) => r._field == "value")
      |> last()`;

	try {
		const response = await fetchInfluxDB(query);
		return parseCO2RoomData(response);
	} catch (error) {
		console.error('Error fetching Room 105 CO2 data:', error);
		return [];
	}
}

// Custom Fetch for Room 105 temperature history (from nili3/sensor/nili3_temperature/state)
async function fetchRoom105Temperature() {
	const topic = "nili3/sensor/nili3_temperature/state";
	const query = `from(bucket: "${INFLUXDB_BUCKET}")
      |> range(start: -${currentTimeRange})
      |> filter(fn: (r) => r._measurement == "mqtt_consumer" and r.topic == "${topic}")
      |> filter(fn: (r) => r._field == "value")
      |> aggregateWindow(every: 5m, fn: mean, createEmpty: false)
      |> yield(name: "mean")`;

	try {
		const csvData = await fetchInfluxDB(query);
		const lines = csvData.trim().split('\n');
		if (lines.length < 2) return [];

		const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
		const valueIndex = headers.indexOf('_value');
		const timeIndex = headers.indexOf('_time');

		const data = [];
		for (let i = 1; i < lines.length; i++) {
			const columns = lines[i].split(',').map(c => c.trim().replace(/"/g, ''));
			if (!columns[valueIndex] || !columns[timeIndex]) continue;
			data.push({ time: new Date(columns[timeIndex]), value: parseFloat(columns[valueIndex]) });
		}
		data.sort((a, b) => a.time - b.time);
		return data;
	} catch (error) {
		console.error('Error fetching Room 105 temperature data:', error);
		return [];
	}
}

// Fetch all room data for table
async function fetchAllRoomData() {
	const tempQuery = `from(bucket: "${INFLUXDB_BUCKET}")
       |> range(start: -1h)
       |> filter(fn: (r) => r._measurement == "room_temperature")
       |> filter(fn: (r) => r._field == "temperature")
       |> last()
       |> group(columns: ["room"])`;

	const co2Query = `from(bucket: "${INFLUXDB_BUCKET}")
       |> range(start: -1h)
       |> filter(fn: (r) => r._measurement == "mqtt_consumer")
       |> filter(fn: (r) => r.topic =~ /co2/)
       |> filter(fn: (r) => r._field == "value")
       |> last()
       |> group(columns: ["topic"])`;

	// Also fetch Room 105 temperature from nili3/sensor/nili3_temperature/state topic
	const room105TempQuery = `from(bucket: "${INFLUXDB_BUCKET}")
       |> range(start: -1h)
       |> filter(fn: (r) => r._measurement == "mqtt_consumer")
       |> filter(fn: (r) => r._field == "value")
       |> filter(fn: (r) => r.topic == "nili3/sensor/nili3_temperature/state")
       |> last()`;

	try {
		const [tempResponse, co2Response, room105TempResponse] = await Promise.all([
			fetchInfluxDB(tempQuery),
			fetchInfluxDB(co2Query),
			fetchInfluxDB(room105TempQuery)
		]);

		const tempData = parseRoomData(tempResponse, 'room');
		const co2Data = parseCO2RoomData(co2Response);

		// Parse Room 105 temperature from nili3/sensor/nili3_temperature/state topic
		let room105Temp = null;
		let room105Time = new Date();
		try {
			const lines = room105TempResponse.trim().split('\n');
			if (lines.length > 1) {
				const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
				const valueIndex = headers.indexOf('_value');
				const timeIndex = headers.indexOf('_time');
				const columns = lines[lines.length - 1].split(',').map(c => c.trim().replace(/"/g, ''));
				if (columns[valueIndex]) {
					room105Temp = parseFloat(columns[valueIndex]);
					if (columns[timeIndex]) room105Time = new Date(columns[timeIndex]);
				}
			}
		} catch (e) { /* ignore */ }

		const rooms = {};
		tempData.forEach(r => {
			rooms[r.room] = {
				room: r.room,
				temperature: r.temperature,
				co2: null,
				time: r.time
			};
		});

		co2Data.forEach(co2 => {
			const match = co2.topic.match(/sensor\/([a-zA-Z0-9.]+)_co2/);
			if (match) {
				let roomId = match[1].toUpperCase();
				if (roomId === 'NILI3') roomId = '105'; // Maps 'nili3_co2' specifically to Room 105

				if (rooms[roomId]) {
					rooms[roomId].co2 = co2.co2;
				}
			}
		});

		// Ensure Room 105 always appears in the table with temperature from nili3/sensor/nili3_temperature/state
		if (!rooms['105']) {
			rooms['105'] = {
				room: '105',
				temperature: room105Temp,
				co2: rooms['105']?.co2 || null,
				time: room105Time
			};
		} else if (room105Temp !== null) {
			// Override with nili3_temperature data if available
			rooms['105'].temperature = room105Temp;
			rooms['105'].time = room105Time;
		}

		return Object.values(rooms);
	} catch (error) {
		console.error('Error fetching room data:', error);
		return [];
	}
}

// Fetch from InfluxDB
async function fetchInfluxDB(query) {
	const response = await fetch(`${INFLUXDB_URL}/api/v2/query?org=${INFLUXDB_ORG}&t=${Date.now()}`, {
		method: 'POST',
		headers: {
			'Authorization': `Token ${INFLUXDB_TOKEN}`,
			'Content-Type': 'application/vnd.flux',
			'Accept': 'application/csv',
			'Cache-Control': 'no-cache, no-store, must-revalidate',
			'Pragma': 'no-cache'
		},
		body: query
	});

	if (!response.ok) throw new Error(`InfluxDB error: ${response.status}`);
	return await response.text();
}

// Parse InfluxDB CSV response
function parseInfluxDBResponse(csvData, groupColumn) {
	const lines = csvData.trim().split('\n');
	if (lines.length < 2) return {};

	const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
	const valueIndex = headers.indexOf('_value');
	const timeIndex = headers.indexOf('_time');
	const groupIndex = groupColumn ? headers.indexOf(groupColumn) : -1;

	const dataByGroup = {};

	for (let i = 1; i < lines.length; i++) {
		const columns = lines[i].split(',').map(c => c.trim().replace(/"/g, ''));
		if (!columns[valueIndex] || !columns[timeIndex]) continue;

		const value = parseFloat(columns[valueIndex]);
		const time = new Date(columns[timeIndex]);
		const group = groupIndex > -1 ? columns[groupIndex] : 'default';

		if (!dataByGroup[group]) dataByGroup[group] = [];
		dataByGroup[group].push({ time, value });
	}

	Object.keys(dataByGroup).forEach(key => {
		dataByGroup[key].sort((a, b) => a.time - b.time);
	});

	return dataByGroup;
}

// Parse room data
function parseRoomData(csvData, groupColumn) {
	const lines = csvData.trim().split('\n');
	if (lines.length < 2) return [];

	const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
	const valueIndex = headers.indexOf('_value');
	const groupIndex = headers.indexOf(groupColumn);
	const timeIndex = headers.indexOf('_time');

	const rooms = [];
	for (let i = 1; i < lines.length; i++) {
		const columns = lines[i].split(',').map(c => c.trim().replace(/"/g, ''));
		if (!columns[valueIndex] || !columns[groupIndex]) continue;

		rooms.push({
			[groupColumn]: columns[groupIndex],
			temperature: groupColumn === 'room' ? parseFloat(columns[valueIndex]) : null,
			time: new Date(columns[timeIndex])
		});
	}

	return rooms;
}

// Parse CO2 room data
function parseCO2RoomData(csvData) {
	const lines = csvData.trim().split('\n');
	if (lines.length < 2) return [];

	const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
	const valueIndex = headers.indexOf('_value');
	const topicIndex = headers.indexOf('topic');
	const timeIndex = headers.indexOf('_time');

	const co2Data = [];
	for (let i = 1; i < lines.length; i++) {
		const columns = lines[i].split(',').map(c => c.trim().replace(/"/g, ''));
		if (!columns[valueIndex] || !columns[topicIndex]) continue;

		co2Data.push({
			topic: columns[topicIndex],
			co2: parseFloat(columns[valueIndex]),
			time: new Date(columns[timeIndex])
		});
	}

	return co2Data;
}

// Update summary cards
function updateSummaryCards(tempData, co2Data, room105CO2 = []) {
	let currentTemp, avgTemp24h;

	if (selectedSensor === 'all') {
		// Get only rooms that match the current floor filter
		const filteredRooms = Object.keys(tempData).filter(room => {
			return currentFloorFilter === 'all' ||
				(currentFloorFilter === '1' && room.startsWith('1')) ||
				(currentFloorFilter === '2' && room.startsWith('2')) ||
				(currentFloorFilter === 'E' && room.startsWith('E')) ||
				(currentFloorFilter === 'U' && room.startsWith('U'));
		});

		// Calculate Average Temperature for filtered rooms
		let tempSum = 0, tempCount = 0;
		let historySum = 0, historyCount = 0;

		filteredRooms.forEach(room => {
			const values = tempData[room] || [];
			if (values.length > 0) {
				// Latest value for "Current"
				tempSum += values[values.length - 1].value;
				tempCount++;

				// All values in range for "24h Average"
				values.forEach(v => {
					historySum += v.value;
					historyCount++;
				});
			}
		});

		currentTemp = tempCount > 0 ? tempSum / tempCount : 0;
		avgTemp24h = historyCount > 0 ? historySum / historyCount : 0;

		// Calculate Average CO2 for filtered rooms
		let co2Sum = 0, co2Count = 0;
		filteredRooms.forEach(room => {
			let currentCo2Val = null;

			if (room === '105') {
				if (room105CO2.length > 0) {
					currentCo2Val = room105CO2[0].co2;
				} else {
					const topic = "nili3/sensor/nili3_co2/state";
					const roomCo2Data = co2Data[topic] || [];
					if (roomCo2Data.length > 0) currentCo2Val = roomCo2Data[roomCo2Data.length - 1].value;
				}
			} else {
				const topic = `nili3/sensor/${room.toLowerCase()}_co2/state`;
				const roomCo2Data = co2Data[topic] || [];
				if (roomCo2Data.length > 0) currentCo2Val = roomCo2Data[roomCo2Data.length - 1].value;
			}

			if (currentCo2Val !== null) {
				co2Sum += currentCo2Val;
				co2Count++;
			}
		});

		const currentCo2 = co2Count > 0 ? co2Sum / co2Count : 0;

		// Update UI
		document.getElementById('currentTemp').textContent = `${currentTemp.toFixed(1)}°C`;
		document.getElementById('avgTemp24h').textContent = `${avgTemp24h.toFixed(1)}°C`;
		document.getElementById('currentCo2').textContent = `${currentCo2.toFixed(0)} ppm`;
		document.getElementById('activeSensors').textContent = filteredRooms.length;

	} else {
		const roomData = tempData[selectedSensor] || [];
		currentTemp = roomData.length > 0 ? roomData[roomData.length - 1].value : 0;
		let sum = 0;
		roomData.forEach(({ value }) => { sum += value; });
		avgTemp24h = roomData.length > 0 ? sum / roomData.length : 0;

		document.getElementById('currentTemp').textContent = `${currentTemp.toFixed(1)}°C`;
		document.getElementById('avgTemp24h').textContent = `${avgTemp24h.toFixed(1)}°C`;

		// Setup correct CO2 logic for custom room mapping
		let currentCo2 = 0;
		if (selectedSensor === '105') {
			if (room105CO2.length > 0) {
				currentCo2 = room105CO2[0].co2;
			} else {
				const topic = "nili3/sensor/nili3_co2/state";
				const roomCo2Data = co2Data[topic] || [];
				currentCo2 = roomCo2Data.length > 0 ? roomCo2Data[roomCo2Data.length - 1].value : 0;
			}
		} else {
			const topic = `nili3/sensor/${selectedSensor.toLowerCase()}_co2/state`;
			const roomCo2Data = co2Data[topic] || [];
			currentCo2 = roomCo2Data.length > 0 ? roomCo2Data[roomCo2Data.length - 1].value : 0;
		}

		document.getElementById('currentCo2').textContent = `${currentCo2.toFixed(0)} ppm`;
		document.getElementById('activeSensors').textContent = Object.keys(tempData).length;
	}
}

// Update temperature chart
function updateTemperatureChart(tempData) {
	const tempCanvas = document.getElementById('tempChart');
	const tempPlaceholder = document.getElementById('tempPlaceholder');

	if (selectedSensor === 'all') {
		// Hide chart, show placeholder
		tempCanvas.style.display = 'none';
		tempPlaceholder.classList.add('visible');
		return;
	}

	// Show chart, hide placeholder
	tempCanvas.style.display = '';
	tempPlaceholder.classList.remove('visible');

	// Show single room
	const roomData = tempData[selectedSensor] || [];
	tempChart.data.labels = roomData.map(({ time }) => formatTime(time));
	tempChart.data.tooltipLabels = roomData.map(({ time }) => formatTooltipTime(time));
	tempChart.data.datasets = [{
		label: `Room ${selectedSensor}`,
		data: roomData.map(({ value }) => value),
		borderColor: '#ef4444',
		backgroundColor: 'rgba(239, 68, 68, 0.1)',
		fill: true,
		tension: 0.4
	}];
	tempChart.update();
}

// Update CO2 chart
function updateCO2Chart(co2Data) {
	const co2Canvas = document.getElementById('co2Chart');
	const co2Placeholder = document.getElementById('co2Placeholder');

	if (selectedSensor === 'all') {
		// Hide chart, show placeholder
		co2Canvas.style.display = 'none';
		co2Placeholder.classList.add('visible');
		return;
	}

	// Show chart, hide placeholder
	co2Canvas.style.display = '';
	co2Placeholder.classList.remove('visible');

	// Map Room 105 history correctly
	let topic = `nili3/sensor/${selectedSensor.toLowerCase()}_co2/state`;
	if (selectedSensor === '105') {
		topic = "nili3/sensor/nili3_co2/state";
	}
	const roomCo2Data = co2Data[topic] || [];

	co2Chart.data.labels = roomCo2Data.map(({ time }) => formatTime(time));
	co2Chart.data.tooltipLabels = roomCo2Data.map(({ time }) => formatTooltipTime(time));
	co2Chart.data.datasets = [{
		label: `Room ${selectedSensor}`,
		data: roomCo2Data.map(({ value }) => value),
		borderColor: '#f59e0b',
		backgroundColor: 'rgba(245, 158, 11, 0.1)',
		fill: true,
		tension: 0.4
	}];
	co2Chart.update();
}

// Update room table with pagination
function updateRoomTable(roomData) {
	const tbody = document.getElementById('roomTableBody');
	const showMoreBtn = document.getElementById('showMoreBtn');
	const showMoreCount = document.getElementById('showMoreCount');

	// Sort rooms
	roomData.sort((a, b) => a.room.localeCompare(b.room));

	// Show only displayedRoomsCount
	const visibleRooms = roomData.slice(0, displayedRoomsCount);

	tbody.innerHTML = '';
	visibleRooms.forEach(room => {
		const row = document.createElement('tr');

		// Temperature status
		const tempValue = room.temperature !== null ? room.temperature.toFixed(1) + '°C' : '--';
		const tempClass = room.temperature > 24 ? 'status-warning' : room.temperature < 19 ? 'status-cold' : 'status-ok';

		// CO2 status
		const co2Value = room.co2 !== null ? room.co2.toFixed(0) + ' ppm' : '--';
		const co2Class = room.co2 > 1000 ? 'status-warning' : room.co2 > 800 ? 'status-medium' : 'status-ok';

		// Combined status for STATUS column
		const tempBad = room.temperature > 24 || room.temperature < 19;
		const co2Bad = room.co2 > 1000;
		const co2Medium = room.co2 > 800 && room.co2 <= 1000;

		let statusText, statusClass;
		if (tempBad || co2Bad) {
			statusText = '⚠️ Alert';
			statusClass = 'status-warning';
		} else if (co2Medium) {
			statusText = '⚡ Medium';
			statusClass = 'status-medium';
		} else {
			statusText = '✅ OK';
			statusClass = 'status-ok';
		}

		row.innerHTML = `
          <td><strong>${room.room}</strong></td>
          <td class="${tempClass}">${tempValue}</td>
          <td class="${co2Class}">${co2Value}</td>
          <td>${formatRelativeTime(room.time)}</td>
          <td class="${statusClass}">${statusText}</td>
       `;
		tbody.appendChild(row);
	});

	// Update show more button
	if (displayedRoomsCount >= roomData.length) {
		showMoreBtn.style.display = 'none';
	} else {
		showMoreBtn.style.display = '';
		showMoreCount.textContent = `(${displayedRoomsCount}/${roomData.length})`;
	}
}

// Helper: Get room color
function getRoomColor(index, alpha = 1) {
	const colors = [
		'rgba(59, 130, 246, ' + alpha + ')',
		'rgba(239, 68, 68, ' + alpha + ')',
		'rgba(34, 197, 94, ' + alpha + ')',
		'rgba(245, 158, 11, ' + alpha + ')',
		'rgba(139, 92, 246, ' + alpha + ')',
		'rgba(236, 72, 153, ' + alpha + ')',
		'rgba(16, 185, 129, ' + alpha + ')',
		'rgba(244, 63, 94, ' + alpha + ')',
		'rgba(99, 102, 241, ' + alpha + ')',
		'rgba(20, 184, 166, ' + alpha + ')',
	];
	return colors[index % colors.length];
}

// Helper: Format time for charts
function formatTime(date) {
	const options = { 
		hour: '2-digit', 
		minute: '2-digit', 
		hour12: false 
	};
	
	const timeStr = date.toLocaleTimeString('de-DE', options);
	
	// If range is > 24h, show date
	if (currentTimeRange === '7d') {
		const dateStr = date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
		return `${dateStr} ${timeStr}`;
	}
	
	return timeStr;
}

// Helper: Format time for tooltips (always includes date)
function formatTooltipTime(date) {
	const timeStr = date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', hour12: false });
	const dateStr = date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
	return `${dateStr} ${timeStr}`;
}

// Helper: Format relative time
function formatRelativeTime(date) {
	const now = new Date();
	const diff = Math.floor((now - date) / 1000);
	if (diff < 60) return 'Gerade eben';
	if (diff < 3600) return `vor ${Math.floor(diff / 60)} Min.`;
	if (diff < 86400) return `vor ${Math.floor(diff / 3600)} Std.`;
	return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}