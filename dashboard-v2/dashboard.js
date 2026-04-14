// InfluxDB Configuration
const INFLUXDB_URL = '/influx';
const INFLUXDB_TOKEN = 'ih3lGQ2dVqXG7ec0Ai-flUi5ZWTqp3AChtwI0fu4014-cn5h0MRE6-RcWtlL1yYGUaaSg6NOtcW_TEjQdGGA5A==';
const INFLUXDB_ORG = 'leoiot';
const INFLUXDB_BUCKET = 'server_data';

// Solax API Configuration
const SOLAX_API_URL = '/solax';
const SOLAX_CLIENT_ID = 'b6d55e642b304989be96a3e0f0ce1793';
const SOLAX_CLIENT_SECRET = 'HCRctfp7_ezVhnIWlNrzO3--U_wFSjscVEhdQd5RpUI';
const SOLAX_PLANT_ID = '508819503377442';

// State
let selectedSensor = 'all';
let availableRooms = [];
let currentTimeRange = '6h';
let currentFloorFilter = 'all';
let displayedRoomsCount = 10;
const ROOMS_PER_PAGE = 15;
let currentTab = 'sensors';
let solaxAccessToken = null;

// Chart instances
let tempChart, co2Chart, pvPowerChart, pvEnergyChart;

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

	// Authenticate with Solax API
	await authenticateSolax();

	// Load initial data
	await refreshAllData();

	// Auto-refresh every 30 seconds
	setInterval(refreshAllData, 30000);
});

// Initialize Chart.js charts
function initCharts() {
	const chartOptions = {
		responsive: true,
		maintainAspectRatio: false,
		plugins: {
			legend: {
				labels: {
					color: 'rgba(255, 255, 255, 0.7)',
					font: { size: 12 }
				}
			}
		},
		scales: {
			x: {
				ticks: { color: 'rgba(255, 255, 255, 0.5)' },
				grid: { color: 'rgba(255, 255, 255, 0.05)' }
			},
			y: {
				ticks: { color: 'rgba(255, 255, 255, 0.5)' },
				grid: { color: 'rgba(255, 255, 255, 0.05)' }
			}
		}
	};

	// Temperature History Chart
	const tempCtx = document.getElementById('tempChart').getContext('2d');
	tempChart = new Chart(tempCtx, {
		type: 'line',
		data: { labels: [], datasets: [] },
		options: chartOptions
	});

	// CO2 History Chart
	const co2Ctx = document.getElementById('co2Chart').getContext('2d');
	co2Chart = new Chart(co2Ctx, {
		type: 'line',
		data: { labels: [], datasets: [] },
		options: chartOptions
	});

	// PV Power History Chart
	const pvPowerCtx = document.getElementById('pvPowerChart').getContext('2d');
	pvPowerChart = new Chart(pvPowerCtx, {
		type: 'line',
		data: { labels: [], datasets: [] },
		options: chartOptions
	});

	// PV Energy Overview Chart
	const pvEnergyCtx = document.getElementById('pvEnergyChart').getContext('2d');
	pvEnergyChart = new Chart(pvEnergyCtx, {
		type: 'bar',
		data: { labels: [], datasets: [] },
		options: chartOptions
	});
}

// ==================== TAB SWITCHING ====================

// Switch between tabs
window.switchTab = async (tab) => {
	currentTab = tab;
	document.querySelectorAll('.tab-btn').forEach(btn => {
		btn.classList.remove('active');
		if (btn.dataset.tab === tab) btn.classList.add('active');
	});

	document.querySelectorAll('.tab-content').forEach(content => {
		content.classList.remove('active');
	});
	document.getElementById(`${tab}-tab`).classList.add('active');

	// Update header title
	const title = document.getElementById('dashboardTitle');
	if (tab === 'sensors') {
		title.textContent = '🏢 Building Sensor Dashboard';
	} else {
		title.textContent = '☀️ LeoSolar PV Dashboard';
	}

	// Refresh data for the active tab
	if (tab === 'pv') {
		await refreshPVData();
	}
};

// ==================== SENSOR FUNCTIONS ====================

// Set time range
window.setTimeRange = async (range) => {
	currentTimeRange = range;
	document.querySelectorAll('.time-btn').forEach(btn => {
		btn.classList.remove('active');
		if (btn.textContent === range) btn.classList.add('active');
	});
	await refreshAllData();
};

// Filter by floor
window.filterByFloor = async (floor) => {
	currentFloorFilter = floor;
	document.querySelectorAll('.filter-tab').forEach(btn => {
		btn.classList.remove('active');
		if (btn.dataset.floor === floor) btn.classList.add('active');
	});
	filterSensors();
	await refreshAllData();
};

// Select sensor
window.selectSensor = async (sensor) => {
	selectedSensor = sensor;
	document.querySelectorAll('.sensor-btn').forEach(btn => {
		btn.classList.remove('active');
		if (btn.dataset.sensor === sensor) btn.classList.add('active');
	});

	const label = sensor === 'all' ? 'All Rooms' : `Room ${sensor}`;
	document.getElementById('tempChartSubtitle').textContent = label;
	document.getElementById('co2ChartSubtitle').textContent = label;
	document.getElementById('tempSensorLabel').textContent = label;
	document.getElementById('co2SensorLabel').textContent = label;

	await refreshAllData();
};

// Filter sensors based on search and floor
window.filterSensors = () => {
	const searchTerm = document.getElementById('sensorSearch').value.toLowerCase().trim();
	const buttons = document.querySelectorAll('.sensor-btn[data-sensor]');

	buttons.forEach(btn => {
		const room = btn.dataset.sensor;
		if (room === 'all') {
			btn.style.display = '';
			return;
		}

		const matchesSearch = !searchTerm || room.toLowerCase().includes(searchTerm);
		const matchesFloor = currentFloorFilter === 'all' ||
			(currentFloorFilter === '1' && /^\d{3}$/.test(room)) ||
			(currentFloorFilter === '2' && /^2\d{2}$/.test(room)) ||
			(currentFloorFilter === 'E' && room.startsWith('E')) ||
			(currentFloorFilter === 'U' && room.startsWith('U'));

		btn.style.display = (matchesSearch && matchesFloor) ? '' : 'none';
	});
};

// Show more rooms in table
window.showMoreRooms = () => {
	displayedRoomsCount += ROOMS_PER_PAGE;
	updateRoomTable(window.lastRoomData || []);
};

// Refresh all data
window.refreshAllData = async () => {
	if (currentTab === 'sensors') {
		const [tempData, co2Data, allRoomData, room105CO2] = await Promise.all([
			fetchTemperatureData(),
			fetchCO2Data(),
			fetchAllRoomData(),
			fetchRoom105CO2()
		]);

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
	} else if (currentTab === 'pv') {
		await refreshPVData();
	}
};

// Update room selector buttons
function updateRoomSelector(tempData) {
	const rooms = Object.keys(tempData).sort();
	availableRooms = rooms;

	const container = document.getElementById('sensorButtons');
	const searchTerm = document.getElementById('sensorSearch')?.value.toLowerCase().trim() || '';

	container.innerHTML = `
		<button class="sensor-btn ${selectedSensor === 'all' ? 'active' : ''}"
			  onclick="selectSensor('all')" data-sensor="all">
			📊 All Rooms (Average)
		</button>
	`;

	rooms.forEach(room => {
		const btn = document.createElement('button');
		btn.className = `sensor-btn ${selectedSensor === room ? 'active' : ''}`;
		btn.dataset.sensor = room;
		btn.onclick = () => selectSensor(room);
		btn.innerHTML = `🏠 ${room}`;

		const matchesSearch = !searchTerm || room.toLowerCase().includes(searchTerm);
		const matchesFloor = currentFloorFilter === 'all' ||
			(currentFloorFilter === '1' && /^\d{3}$/.test(room)) ||
			(currentFloorFilter === '2' && /^2\d{2}$/.test(room)) ||
			(currentFloorFilter === 'E' && room.startsWith('E')) ||
			(currentFloorFilter === 'U' && room.startsWith('U'));

		if (!matchesSearch || !matchesFloor) {
			btn.style.display = 'none';
		}

		container.appendChild(btn);
	});
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

	try {
		const [tempResponse, co2Response] = await Promise.all([
			fetchInfluxDB(tempQuery),
			fetchInfluxDB(co2Query)
		]);

		const tempData = parseRoomData(tempResponse, 'room');
		const co2Data = parseCO2RoomData(co2Response);

		const rooms = {};
		tempData.forEach(r => {
			rooms[r.room] = { room: r.room, temperature: r.temperature, co2: null, time: r.time };
		});

		co2Data.forEach(co2 => {
			const match = co2.topic.match(/sensor\/([a-zA-Z0-9.]+)_co2/);
			if (match) {
				let roomId = match[1].toUpperCase();
				if (roomId === 'NILI3') roomId = '105';
				if (rooms[roomId]) {
					rooms[roomId].co2 = co2.co2;
				}
			}
		});

		return Object.values(rooms);
	} catch (error) {
		console.error('Error fetching room data:', error);
		return [];
	}
}

// Fetch from InfluxDB
async function fetchInfluxDB(query) {
	const response = await fetch(`${INFLUXDB_URL}/api/v2/query?org=${INFLUXDB_ORG}`, {
		method: 'POST',
		headers: {
			'Authorization': `Token ${INFLUXDB_TOKEN}`,
			'Content-Type': 'application/vnd.flux',
			'Accept': 'application/csv'
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
		const filteredRooms = Object.keys(tempData).filter(room => {
			return currentFloorFilter === 'all' ||
				(currentFloorFilter === '1' && /^\d{3}$/.test(room)) ||
				(currentFloorFilter === '2' && /^2\d{2}$/.test(room)) ||
				(currentFloorFilter === 'E' && room.startsWith('E')) ||
				(currentFloorFilter === 'U' && room.startsWith('U'));
		});

		let tempSum = 0, tempCount = 0;
		let historySum = 0, historyCount = 0;

		filteredRooms.forEach(room => {
			const values = tempData[room] || [];
			if (values.length > 0) {
				tempSum += values[values.length - 1].value;
				tempCount++;
				values.forEach(v => {
					historySum += v.value;
					historyCount++;
				});
			}
		});

		currentTemp = tempCount > 0 ? tempSum / tempCount : 0;
		avgTemp24h = historyCount > 0 ? historySum / historyCount : 0;

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
		tempCanvas.style.display = 'none';
		tempPlaceholder.classList.add('visible');
		return;
	}

	tempCanvas.style.display = '';
	tempPlaceholder.classList.remove('visible');

	const roomData = tempData[selectedSensor] || [];
	tempChart.data.labels = roomData.map(({ time }) => formatTime(time));
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
		co2Canvas.style.display = 'none';
		co2Placeholder.classList.add('visible');
		return;
	}

	co2Canvas.style.display = '';
	co2Placeholder.classList.remove('visible');

	let topic = `nili3/sensor/${selectedSensor.toLowerCase()}_co2/state`;
	if (selectedSensor === '105') {
		topic = "nili3/sensor/nili3_co2/state";
	}
	const roomCo2Data = co2Data[topic] || [];

	co2Chart.data.labels = roomCo2Data.map(({ time }) => formatTime(time));
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

	roomData.sort((a, b) => a.room.localeCompare(b.room));
	const visibleRooms = roomData.slice(0, displayedRoomsCount);

	tbody.innerHTML = '';
	visibleRooms.forEach(room => {
		const row = document.createElement('tr');

		const tempValue = room.temperature !== null ? room.temperature.toFixed(1) + '°C' : '--';
		const tempClass = room.temperature > 24 ? 'status-warning' : room.temperature < 19 ? 'status-cold' : 'status-ok';

		const co2Value = room.co2 !== null ? room.co2.toFixed(0) + ' ppm' : '--';
		const co2Class = room.co2 > 1000 ? 'status-warning' : room.co2 > 800 ? 'status-medium' : 'status-ok';

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

	if (displayedRoomsCount >= roomData.length) {
		showMoreBtn.style.display = 'none';
	} else {
		showMoreBtn.style.display = '';
		showMoreCount.textContent = `(${displayedRoomsCount}/${roomData.length})`;
	}
}

// ==================== PV FUNCTIONS ====================

// Authenticate with Solax API
async function authenticateSolax() {
	try {
		const response = await fetch(`${SOLAX_API_URL}/token/${SOLAX_CLIENT_ID}/${SOLAX_CLIENT_SECRET}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' }
		});

		if (!response.ok) throw new Error(`Solax auth error: ${response.status}`);

		const data = await response.json();
		solaxAccessToken = data.access_token;
		console.log('Solax authentication successful');
	} catch (error) {
		console.error('Error authenticating with Solax:', error);
	}
}

// Refresh PV data
async function refreshPVData() {
	const [realTimeData, historyData, deviceList] = await Promise.all([
		fetchPVRealTimeData(),
		fetchPVHistoryData(),
		fetchDeviceList()
	]);

	// Check if all data is null (API unavailable)
	if (!realTimeData && !historyData && !deviceList) {
		showPVError('The SolaX cloud API is currently unavailable. Data will appear once the connection is restored.');
		return;
	}

	hidePVError();
	updatePVSummaryCards(realTimeData, deviceList);
	updatePVCharts(historyData);
	updatePVDeviceTable(deviceList);
}

// Show PV error banner
function showPVError(message) {
	const banner = document.getElementById('pvErrorBanner');
	const msg = document.getElementById('pvErrorMessage');
	if (msg) msg.textContent = message;
	if (banner) banner.style.display = 'flex';
}

// Hide PV error banner
function hidePVError() {
	const banner = document.getElementById('pvErrorBanner');
	if (banner) banner.style.display = 'none';
}

// Fetch PV real-time data
async function fetchPVRealTimeData() {
	if (!solaxAccessToken) return null;

	try {
		const response = await fetch(`${SOLAX_API_URL}/openapi/v2/monitor/inverter/realTimeData?plantId=${SOLAX_PLANT_ID}`, {
			method: 'GET',
			headers: {
				'Authorization': `bearer ${solaxAccessToken}`,
				'Content-Type': 'application/json'
			}
		});

		if (!response.ok) throw new Error(`Solax API error: ${response.status}`);
		return await response.json();
	} catch (error) {
		console.error('Error fetching PV real-time data:', error);
		return null;
	}
}

// Fetch PV history data
async function fetchPVHistoryData() {
	if (!solaxAccessToken) return null;

	let timeRange = 360;
	if (currentTimeRange === '1h') timeRange = 60;
	else if (currentTimeRange === '6h') timeRange = 360;
	else if (currentTimeRange === '24h') timeRange = 1440;
	else if (currentTimeRange === '7d') timeRange = 10080;

	try {
		const response = await fetch(`${SOLAX_API_URL}/openapi/v2/monitor/inverter/history?plantId=${SOLAX_PLANT_ID}&deviceType=1&timeRange=${timeRange}`, {
			method: 'GET',
			headers: {
				'Authorization': `bearer ${solaxAccessToken}`,
				'Content-Type': 'application/json'
			}
		});

		if (!response.ok) throw new Error(`Solax API error: ${response.status}`);
		return await response.json();
	} catch (error) {
		console.error('Error fetching PV history data:', error);
		return null;
	}
}

// Fetch device list
async function fetchDeviceList() {
	if (!solaxAccessToken) return null;

	try {
		const response = await fetch(`${SOLAX_API_URL}/openapi/v2/device/page_device_info?deviceType=1&businessType=1&plantId=${SOLAX_PLANT_ID}`, {
			method: 'GET',
			headers: {
				'Authorization': `bearer ${solaxAccessToken}`,
				'Content-Type': 'application/json'
			}
		});

		if (!response.ok) throw new Error(`Solax API error: ${response.status}`);
		return await response.json();
	} catch (error) {
		console.error('Error fetching device list:', error);
		return null;
	}
}

// Update PV summary cards
function updatePVSummaryCards(realTimeData, deviceList) {
	let totalPac = 0;
	let totalBatterySoc = 0;
	let batteryCount = 0;
	let inverterCount = 0;
	let todayEnergy = 0;

	if (realTimeData && realTimeData.data && realTimeData.data.list) {
		realTimeData.data.list.forEach(device => {
			if (device.deviceType === 1) {
				totalPac += device.pac || 0;
				inverterCount++;
				if (device.eToday) todayEnergy = device.eToday;
			} else if (device.deviceType === 2) {
				if (device.soc) {
					totalBatterySoc += device.soc;
					batteryCount++;
				}
			}
		});
	}

	if (deviceList && deviceList.data && deviceList.data.list) {
		deviceList.data.list.forEach(device => {
			if (device.deviceType === 1) inverterCount++;
		});
	}

	document.getElementById('pvCurrentPower').textContent = `${(totalPac / 1000).toFixed(2)} kW`;
	document.getElementById('pvTodayEnergy').textContent = `${todayEnergy.toFixed(1)} kWh`;
	document.getElementById('pvBatterySoc').textContent = batteryCount > 0 ? `${(totalBatterySoc / batteryCount).toFixed(0)}%` : '--%';
	document.getElementById('pvActiveInverters').textContent = inverterCount;
}

// Update PV charts
function updatePVCharts(historyData) {
	if (!historyData || !historyData.data || !historyData.data.list || historyData.data.list.length === 0) {
		pvPowerChart.data.labels = [];
		pvPowerChart.data.datasets = [];
		pvPowerChart.update();

		pvEnergyChart.data.labels = [];
		pvEnergyChart.data.datasets = [];
		pvEnergyChart.update();
		return;
	}

	const historyList = historyData.data.list;
	const labels = historyList.map(item => formatTime(new Date(item.dataTime)));
	const pvData = historyList.map(item => (item.ppv || 0) / 1000);
	const pacData = historyList.map(item => (item.pac || 0) / 1000);

	pvPowerChart.data.labels = labels;
	pvPowerChart.data.datasets = [
		{
			label: 'PV Generation (kW)',
			data: pvData,
			borderColor: '#fbbf24',
			backgroundColor: 'rgba(251, 191, 36, 0.1)',
			fill: true,
			tension: 0.4
		},
		{
			label: 'Total Power (kW)',
			data: pacData,
			borderColor: '#3b82f6',
			backgroundColor: 'rgba(59, 130, 246, 0.1)',
			fill: true,
			tension: 0.4
		}
	];
	pvPowerChart.update();

	// Energy overview - daily aggregation
	const dailyEnergy = {};
	historyList.forEach(item => {
		const date = new Date(item.dataTime);
		const dayKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
		if (item.eToday) {
			dailyEnergy[dayKey] = item.eToday;
		}
	});

	const energyLabels = Object.keys(dailyEnergy);
	const energyValues = Object.values(dailyEnergy);

	pvEnergyChart.data.labels = energyLabels;
	pvEnergyChart.data.datasets = [{
		label: 'Daily Energy (kWh)',
		data: energyValues,
		backgroundColor: 'rgba(251, 191, 36, 0.6)',
		borderColor: '#fbbf24',
		borderWidth: 1
	}];
	pvEnergyChart.update();

	// Update subtitle
	const timeRangeLabels = { '1h': 'Last 1 hour', '6h': 'Last 6 hours', '24h': 'Last 24 hours', '7d': 'Last 7 days' };
	document.getElementById('pvPowerSubtitle').textContent = timeRangeLabels[currentTimeRange] || 'Last 6 hours';
}

// Update PV device table
function updatePVDeviceTable(deviceList) {
	const tbody = document.getElementById('pvDeviceTableBody');
	tbody.innerHTML = '';

	if (!deviceList || !deviceList.data || !deviceList.data.list) {
		tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;">No device data available</td></tr>';
		return;
	}

	const deviceTypeNames = { 1: 'Inverter', 2: 'Battery', 3: 'Meter', 4: 'EV Charger' };

	deviceList.data.list.forEach(device => {
		const row = document.createElement('tr');

		const power = device.pac ? `${(device.pac / 1000).toFixed(2)} kW` : '--';
		const soc = device.soc ? `${device.soc}%` : '--';
		const status = device.runStatus ? '✅ Online' : '⚪ Offline';
		const statusClass = device.runStatus ? 'status-ok' : 'status-warning';

		row.innerHTML = `
			<td><strong>${device.deviceSN || '--'}</strong></td>
			<td>${deviceTypeNames[device.deviceType] || 'Unknown'}</td>
			<td>${power}</td>
			<td>${soc}</td>
			<td class="${statusClass}">${status}</td>
			<td>${device.dataTime ? formatRelativeTime(new Date(device.dataTime)) : '--'}</td>
		`;
		tbody.appendChild(row);
	});
}

// ==================== HELPER FUNCTIONS ====================

function formatTime(date) {
	return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function formatRelativeTime(date) {
	const now = new Date();
	const diff = Math.floor((now - date) / 1000);
	if (diff < 60) return 'Just now';
	if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
	return `${Math.floor(diff / 3600)}h ago`;
}
