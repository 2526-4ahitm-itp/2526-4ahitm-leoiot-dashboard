// InfluxDB Configuration
const INFLUXDB_URL = 'http://localhost:8086';
const INFLUXDB_TOKEN = 'ih3lGQ2dVqXG7ec0Ai-flUi5ZWTqp3AChtwI0fu4014-cn5h0MRE6-RcWtlL1yYGUaaSg6NOtcW_TEjQdGGA5A==';
const INFLUXDB_ORG = 'leoiot';
const INFLUXDB_BUCKET = 'server_data';

// State
let selectedSensor = 'all';
let availableRooms = [];
let currentTimeRange = '6h';
let currentFloorFilter = 'all';
let displayedRoomsCount = 10;
const ROOMS_PER_PAGE = 15;

// Chart instances
let tempChart, co2Chart;

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

// Filter by floor
window.filterByFloor = (floor) => {
	currentFloorFilter = floor;
	document.querySelectorAll('.filter-tab').forEach(btn => {
		btn.classList.remove('active');
		if (btn.dataset.floor === floor) btn.classList.add('active');
	});
	filterSensors();
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
	const [tempData, co2Data, allRoomData] = await Promise.all([
		fetchTemperatureData(),
		fetchCO2Data(),
		fetchAllRoomData()
	]);

	updateRoomSelector(tempData);
	updateSummaryCards(tempData, co2Data);
	updateTemperatureChart(tempData);
	updateCO2Chart(co2Data);
	updateRoomTable(allRoomData);
	window.lastRoomData = allRoomData;
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
		
		// Apply filters
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
				const roomId = match[1].toUpperCase();
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
function updateSummaryCards(tempData, co2Data) {
	let currentTemp, avgTemp24h;

	if (selectedSensor === 'all') {
		let tempSum = 0, tempCount = 0;
		Object.values(tempData).forEach(values => {
			if (values.length > 0) {
				tempSum += values[values.length - 1].value;
				tempCount++;
			}
		});
		currentTemp = tempCount > 0 ? tempSum / tempCount : 0;

		let allTempSum = 0, allTempCount = 0;
		Object.values(tempData).forEach(values => {
			values.forEach(({ value }) => {
				allTempSum += value;
				allTempCount++;
			});
		});
		avgTemp24h = allTempCount > 0 ? allTempSum / allTempCount : 0;
	} else {
		const roomData = tempData[selectedSensor] || [];
		currentTemp = roomData.length > 0 ? roomData[roomData.length - 1].value : 0;
		let sum = 0;
		roomData.forEach(({ value }) => { sum += value; });
		avgTemp24h = roomData.length > 0 ? sum / roomData.length : 0;
	}

	document.getElementById('currentTemp').textContent = `${currentTemp.toFixed(1)}°C`;
	document.getElementById('avgTemp24h').textContent = `${avgTemp24h.toFixed(1)}°C`;

	let currentCo2;
	if (selectedSensor === 'all') {
		const co2Values = Object.values(co2Data).flat();
		if (co2Values.length > 0) {
			let sum = 0;
			co2Values.forEach(({ value }) => { sum += value; });
			currentCo2 = sum / co2Values.length;
		} else {
			currentCo2 = 0;
		}
	} else {
		const topic = `nili3/sensor/${selectedSensor.toLowerCase()}_co2/state`;
		const roomCo2Data = co2Data[topic] || [];
		currentCo2 = roomCo2Data.length > 0 ? roomCo2Data[roomCo2Data.length - 1].value : 0;
	}
	
	document.getElementById('currentCo2').textContent = `${currentCo2.toFixed(0)} ppm`;
	document.getElementById('activeSensors').textContent = Object.keys(tempData).length;
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
	
	// Show CO2 for selected room
	const topic = `nili3/sensor/${selectedSensor.toLowerCase()}_co2/state`;
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

// Helper: Format time
function formatTime(date) {
	return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

// Helper: Format relative time
function formatRelativeTime(date) {
	const now = new Date();
	const diff = Math.floor((now - date) / 1000);
	if (diff < 60) return 'Just now';
	if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
	return `${Math.floor(diff / 3600)}h ago`;
}
