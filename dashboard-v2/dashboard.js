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
let customDate = null;
let currentFloorFilter = 'all';
let currentLang = 'de';

const TRANSLATIONS = {
	de: {
		loading: 'Dashboard laden',
		btnSensors: 'Sensoren', btnPV: 'PV System',
		prevDay: 'Vorheriger Tag', nextDay: 'Nächster Tag', pickDate: 'Datum auswählen',
		searchPlaceholder: '🔍 Raum suchen...', floorAll: 'Alle', floorBasement: 'Keller',
		allRooms: 'Alle Räume', allRoomsAvg: 'Alle Räume (Durchschnitt)', room: 'Raum',
		temperature: 'Temperatur', highestTemp: 'Höchste Temp.', co2Level: 'CO₂-Wert',
		highestCo2: 'Höchste CO₂', avg24h: '24h Durchschnitt', avgTemp24h: '24h Durchschn. Temp.',
		avgCo224h: '24h Durchschnitt CO₂',
		tempHistory: 'Temperaturverlauf', co2History: 'CO₂-Verlauf',
		tempPlaceholder: 'Wähle einen Raum um den Temperaturverlauf anzuzeigen',
		co2Placeholder: 'Wähle einen Raum um den CO₂-Verlauf anzuzeigen',
		axisTime: 'Uhrzeit', axisTempUnit: 'Temperatur (°C)', axisCo2Unit: 'CO₂ (ppm)', axisEnergy: 'Energie (kWh)',
		allSensors: 'Alle Sensoren', colRoom: 'Raum', colTemp: 'Temperatur',
		colLastUpdate: 'Letztes Update', colStatus: 'Status', showMore: 'Mehr anzeigen',
		noRooms: 'Keine Räume gefunden',
		justNow: 'Gerade eben', minAgo: 'vor {n} Min.', hoursAgo: 'vor {n} Std.',
		liveMqtt: 'Live MQTT-Stream', historicalData: '📅 Historische Daten ({date})',
		statusAlert: '⚠️ Alarm', statusMedium: '⚡ Mittel', statusOk: '✅ OK',
		solarPowerToday: 'Solarertrag heute', lifetimeTotal: 'Gesamtertrag',
		totalGenerated: 'Gesamte Erzeugung', batteryUsage: 'Batterienutzung',
		gridUsage: 'Netznutzung', importedExported: 'Bezug / Einspeisung',
		updatedAt: 'Aktualisiert: {time}',
		chargingNet: 'Laden (netto)', dischargingNet: 'Entladen (netto)',
		buyingNet: 'Bezug (netto)', sellingNet: 'Einspeisung (netto)',
		pvSolarChartTitle: 'Solarertrag (kWh, kumuliert)',
		pvConsumptionChartTitle: 'Gebäudeverbrauch (kWh, kumuliert)',
		pvSolarSubtitle: 'Vom Solarpanel erzeugte Energie',
		pvConsumptionSubtitle: 'Vom Gebäude verbrauchte Energie',
		pvDetailedStats: 'Detailstatistiken', pvDailyBreakdown: 'Tagesübersicht',
		savedInBattery: 'In Batterie gespeichert:', takenFromBattery: 'Aus Batterie entnommen:',
		boughtFromGrid: 'Aus Netz bezogen:', soldToGrid: 'Ins Netz eingespeist:',
		datasetSolar: 'Solarertrag kumuliert (kWh)', datasetConsumption: 'Verbrauch kumuliert (kWh)',
		sensorDashTitle: '🏢 LeoIOT Sensor Dashboard', pvDashTitle: '☀️ LeoIOT PV Dashboard',
		solarPowerOn: 'Solarertrag am {date}',
	},
	en: {
		loading: 'Loading Dashboard',
		btnSensors: 'Sensors', btnPV: 'PV System',
		prevDay: 'Previous day', nextDay: 'Next day', pickDate: 'Pick a specific date',
		searchPlaceholder: '🔍 Search room...', floorAll: 'All', floorBasement: 'Basement',
		allRooms: 'All Rooms', allRoomsAvg: 'All Rooms (Average)', room: 'Room',
		temperature: 'Temperature', highestTemp: 'Highest Temp', co2Level: 'CO₂ Level',
		highestCo2: 'Highest CO₂', avg24h: '24h Average', avgTemp24h: '24h Avg Temp',
		avgCo224h: '24h Average CO₂',
		tempHistory: 'Temperature History', co2History: 'CO₂ History',
		tempPlaceholder: 'Select a specific room to view its temperature history',
		co2Placeholder: 'Select a specific room to view its CO₂ history',
		axisTime: 'Time', axisTempUnit: 'Temperature (°C)', axisCo2Unit: 'CO₂ (ppm)', axisEnergy: 'Energy (kWh)',
		allSensors: 'All Sensors Overview', colRoom: 'Room', colTemp: 'Temperature',
		colLastUpdate: 'Last Update', colStatus: 'Status', showMore: 'Show More',
		noRooms: 'No rooms found',
		justNow: 'Just now', minAgo: '{n} min ago', hoursAgo: '{n} hours ago',
		liveMqtt: 'Live MQTT Stream', historicalData: '📅 Historical Data ({date})',
		statusAlert: '⚠️ Alert', statusMedium: '⚡ Medium', statusOk: '✅ OK',
		solarPowerToday: 'Solar Power Today', lifetimeTotal: 'Lifetime Total',
		totalGenerated: 'Total Generated', batteryUsage: 'Battery Usage',
		gridUsage: 'Grid Usage', importedExported: 'Imported / Exported',
		updatedAt: 'Updated: {time}',
		chargingNet: 'Charging (Net)', dischargingNet: 'Discharging (Net)',
		buyingNet: 'Buying (Net)', sellingNet: 'Selling (Net)',
		pvSolarChartTitle: 'Solar Yield (kWh, cumulative)',
		pvConsumptionChartTitle: 'Building Consumption (kWh, cumulative)',
		pvSolarSubtitle: 'Energy produced by solar panels',
		pvConsumptionSubtitle: 'Energy used by the building',
		pvDetailedStats: 'Detailed Statistics', pvDailyBreakdown: 'Daily totals breakdown',
		savedInBattery: 'Saved in Battery:', takenFromBattery: 'Taken from Battery:',
		boughtFromGrid: 'Bought from Grid:', soldToGrid: 'Sold to Grid:',
		datasetSolar: 'Cumulative yield (kWh)', datasetConsumption: 'Cumulative consumption (kWh)',
		sensorDashTitle: '🏢 LeoIOT Sensor Dashboard', pvDashTitle: '☀️ LeoIOT PV Dashboard',
		solarPowerOn: 'Solar Power on {date}',
	}
};

function t(key, vars = {}) {
	let str = (TRANSLATIONS[currentLang] || TRANSLATIONS.de)[key] ?? key;
	Object.entries(vars).forEach(([k, v]) => { str = str.replace(`{${k}}`, v); });
	return str;
}

function isTodaySelected() {
	if (currentTimeRange !== 'custom' || !customDate) return false;
	const d = new Date();
	const pad = n => n.toString().padStart(2, '0');
	const todayStr = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
	return customDate === todayStr;
}

function getRangeQuery() {
	if (currentTimeRange === 'custom' && customDate) {
		const start = new Date(customDate + 'T00:00:00').toISOString();
		const end = new Date(customDate + 'T23:59:59.999').toISOString();
		return `|> range(start: ${start}, stop: ${end})`;
	}
	return `|> range(start: -${currentTimeRange})`;
}
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
	applyTranslations();

	// Load initial data
	await refreshAllData();
	
	// Initial animation for the first room
	triggerRoomAnimation();

	// Setup MQTT over WebSocket
	setupMQTT();

	// Set status to Live
	const refreshEl = document.getElementById('tableLastRefresh');
	if (refreshEl) {
		refreshEl.innerHTML = `<span style="color: #4ade80">●</span> ${t('liveMqtt')}`;
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
	const isPast = currentTimeRange === 'custom' && !isTodaySelected();
	if (!isPast) {
		updateSummaryFromLive(msg);
	}
	
	// update charts if applicable
	if (selectedSensor !== 'all' && msg.room === selectedSensor) {
		// Only update live charts if we are NOT looking at a historical date
		if ((currentTimeRange !== 'custom' && currentTimeRange !== '7d') || isTodaySelected()) {
			if (msg.type === 'temp') {
				updateChartsWithLivePoint(tempChart, msg.value, msg.ts);
			} else if (msg.type === 'co2') {
				updateChartsWithLivePoint(co2Chart, msg.value, msg.ts);
			}
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
	const axisLabelColor = 'rgba(255, 255, 255, 0.6)';
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
				title: { display: true, text: t('axisTime'), color: axisLabelColor, font: { size: 12 } },
				ticks: {
					color: 'rgba(255, 255, 255, 0.5)',
					maxRotation: 0,
					autoSkip: true,
					maxTicksLimit: 12
				},
				grid: { color: 'rgba(255, 255, 255, 0.05)' }
			},
			y: {
				title: { display: true, text: '', color: axisLabelColor, font: { size: 12 } },
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
	tempOptions.scales.y.title.text = t('axisTempUnit');

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
	co2Options.scales.y.title.text = t('axisCo2Unit');

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
				y: { ...baseOptions.scales.y, suggestedMin: 0, title: { display: true, text: t('axisEnergy'), color: axisLabelColor, font: { size: 12 } } }
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
				y: { ...baseOptions.scales.y, suggestedMin: 0, title: { display: true, text: t('axisEnergy'), color: axisLabelColor, font: { size: 12 } } }
			}
		}
	});
}

// Set time range
window.setTimeRange = async (range) => {
	currentTimeRange = range;
	customDate = null;
	document.querySelectorAll('.time-btn').forEach(btn => {
		btn.classList.remove('active');
		if (btn.textContent === range) btn.classList.add('active');
	});
	
	// Reset date picker button
	const dateBtn = document.getElementById('btnDatePicker');
	if (dateBtn) dateBtn.textContent = '🗓️';
	
	// Reset titles
	const solarTitle = document.getElementById('pvSolarPowerTitle');
	if (solarTitle) solarTitle.textContent = t('solarPowerToday');
	const chartTitle1 = document.getElementById('pvSolarChartTitle');
	if (chartTitle1) chartTitle1.textContent = t('pvSolarChartTitle');
	const chartTitle2 = document.getElementById('pvConsumptionChartTitle');
	if (chartTitle2) chartTitle2.textContent = t('pvConsumptionChartTitle');

	await refreshAllData();
};

window.setSpecificDate = async (dateStr) => {
	if (!dateStr) return;
	customDate = dateStr;
	currentTimeRange = 'custom';
	document.querySelectorAll('.time-btn').forEach(btn => {
		btn.classList.remove('active');
	});
	
	// Update date picker button
	const dateBtn = document.getElementById('btnDatePicker');
	if (dateBtn) {
		dateBtn.classList.add('active');
		if (isTodaySelected()) {
			dateBtn.textContent = `🗓️ ${currentLang === 'de' ? 'Heute' : 'Today'}`;
		} else {
			// Format as DD.MM.YYYY
			const parts = dateStr.split('-');
			if (parts.length === 3) {
				dateBtn.textContent = `🗓️ ${parts[2]}.${parts[1]}.${parts[0]}`;
			}
		}
	}
	
	// Update titles
	const formattedDate = dateBtn ? dateBtn.textContent.replace('🗓️ ', '') : dateStr;
	const solarTitle = document.getElementById('pvSolarPowerTitle');
	if (solarTitle) solarTitle.textContent = isTodaySelected() ? t('solarPowerToday') : t('solarPowerOn', { date: formattedDate });
	const chartTitle1 = document.getElementById('pvSolarChartTitle');
	if (chartTitle1) chartTitle1.textContent = isTodaySelected() ? t('pvSolarChartTitle') : `${t('pvSolarChartTitle')} – ${formattedDate}`;
	const chartTitle2 = document.getElementById('pvConsumptionChartTitle');
	if (chartTitle2) chartTitle2.textContent = isTodaySelected() ? t('pvConsumptionChartTitle') : `${t('pvConsumptionChartTitle')} – ${formattedDate}`;

	await refreshAllData();
};

window.navigateDay = async (direction) => {
	let baseDate = customDate;
	if (!baseDate) {
		const d = new Date();
		const pad = n => n.toString().padStart(2, '0');
		baseDate = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
	}
	const d = new Date(baseDate + 'T12:00:00');
	d.setDate(d.getDate() + direction);
	const pad = n => n.toString().padStart(2, '0');
	const newDate = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
	document.getElementById('datePicker').value = newDate;
	await setSpecificDate(newDate);
};

window.switchLang = (lang) => {
	currentLang = lang;
	document.querySelectorAll('.lang-btn').forEach(btn => {
		btn.classList.toggle('active', btn.dataset.lang === lang);
	});
	applyTranslations();
	refreshAllData();
};

function applyTranslations() {
	// Loading screen
	const loadingEl = document.querySelector('.loading-text');
	if (loadingEl) loadingEl.textContent = t('loading');

	// Header buttons
	const btnSensors = document.getElementById('btnSensors');
	if (btnSensors) btnSensors.textContent = t('btnSensors');
	const btnPV = document.getElementById('btnPV');
	if (btnPV) btnPV.textContent = t('btnPV');

	// Nav buttons titles
	const btnPrev = document.getElementById('btnPrevDay');
	if (btnPrev) btnPrev.title = t('prevDay');
	const btnNext = document.getElementById('btnNextDay');
	if (btnNext) btnNext.title = t('nextDay');
	const btnDate = document.getElementById('btnDatePicker');
	if (btnDate && !customDate) btnDate.title = t('pickDate');

	// Search & floor tabs
	const search = document.getElementById('sensorSearch');
	if (search) search.placeholder = t('searchPlaceholder');
	document.querySelectorAll('.filter-tab').forEach(btn => {
		if (btn.dataset.floor === 'all') btn.textContent = t('floorAll');
		if (btn.dataset.floor === 'U') btn.textContent = t('floorBasement');
	});

	// Summary card titles (only if not dynamically overridden)
	const c1 = document.getElementById('card1Title');
	if (c1) c1.textContent = (currentTimeRange === 'custom' && !isTodaySelected()) ? t('highestTemp') : t('temperature');
	const c2 = document.getElementById('card2Title');
	if (c2) c2.textContent = (currentTimeRange === 'custom' && !isTodaySelected()) ? t('highestCo2') : t('co2Level');
	const c3 = document.getElementById('card3Title');
	if (c3) c3.textContent = (currentTimeRange === 'custom' && !isTodaySelected()) ? t('avgTemp24h') : t('avg24h');
	const c4 = document.getElementById('card4Title');
	if (c4) c4.textContent = t('avgCo224h');

	// Sensor labels (all rooms / selected room)
	const roomLabel = selectedSensor === 'all' ? t('allRooms') : `${t('room')} ${selectedSensor}`;
	['tempSensorLabel', 'co2SensorLabel'].forEach(id => {
		const el = document.getElementById(id);
		if (el) el.textContent = roomLabel;
	});
	['tempChartSubtitle', 'co2ChartSubtitle'].forEach(id => {
		const el = document.getElementById(id);
		if (el) el.textContent = roomLabel;
	});
	['tempSensorLabel2', 'co2SensorLabel2'].forEach(id => {
		const el = document.getElementById(id);
		if (el) el.textContent = selectedSensor === 'all' ? t('allRooms') : `${t('room')} ${selectedSensor}`;
	});

	// Room dropdown trigger
	const trigger = document.getElementById('roomDropdownTrigger');
	if (trigger) trigger.textContent = selectedSensor === 'all' ? `📊 ${t('allRooms')}` : `🏠 ${t('room')} ${selectedSensor}`;

	// Chart titles & placeholders
	const tempChartTitle = document.getElementById('tempChartTitle');
	if (tempChartTitle) tempChartTitle.textContent = t('tempHistory');
	const co2ChartTitle = document.getElementById('co2ChartTitle');
	if (co2ChartTitle) co2ChartTitle.textContent = t('co2History');
	const tempPH = document.getElementById('tempPlaceholderText');
	if (tempPH) tempPH.textContent = t('tempPlaceholder');
	const co2PH = document.getElementById('co2PlaceholderText');
	if (co2PH) co2PH.textContent = t('co2Placeholder');

	// Table
	const allSensorsTitle = document.getElementById('allSensorsTitle');
	if (allSensorsTitle) allSensorsTitle.textContent = t('allSensors');
	const thRoom = document.getElementById('thRoom');
	if (thRoom) thRoom.textContent = t('colRoom');
	const thTemp = document.getElementById('thTemp');
	if (thTemp) thTemp.textContent = t('colTemp');
	const thLastUpdate = document.getElementById('thLastUpdate');
	if (thLastUpdate) thLastUpdate.textContent = t('colLastUpdate');
	const thStatus = document.getElementById('thStatus');
	if (thStatus) thStatus.textContent = t('colStatus');
	const showMoreText = document.getElementById('showMoreText');
	if (showMoreText) showMoreText.textContent = t('showMore');

	// PV cards
	const pvSolarTitle = document.getElementById('pvSolarPowerTitle');
	if (pvSolarTitle) pvSolarTitle.textContent = customDate && !isTodaySelected()
		? t('solarPowerOn', { date: customDate.split('-').reverse().join('.') })
		: t('solarPowerToday');
	const pvLifetime = document.getElementById('pvLifetimeTotalTitle');
	if (pvLifetime) pvLifetime.textContent = t('lifetimeTotal');
	const pvTotalGenLabel = document.getElementById('pvTotalGeneratedLabel');
	if (pvTotalGenLabel) pvTotalGenLabel.textContent = t('totalGenerated');
	const pvBattTitle = document.getElementById('pvBatteryUsageTitle');
	if (pvBattTitle) pvBattTitle.textContent = t('batteryUsage');
	const pvGridTitle = document.getElementById('pvGridUsageTitle');
	if (pvGridTitle) pvGridTitle.textContent = t('gridUsage');

	// PV chart titles & subtitles
	const pvSolarChart = document.getElementById('pvSolarChartTitle');
	if (pvSolarChart) pvSolarChart.textContent = t('pvSolarChartTitle');
	const pvConsChart = document.getElementById('pvConsumptionChartTitle');
	if (pvConsChart) pvConsChart.textContent = t('pvConsumptionChartTitle');
	const pvSolarSub = document.getElementById('pvSolarSubtitle');
	if (pvSolarSub) pvSolarSub.textContent = t('pvSolarSubtitle');
	const pvConsSub = document.getElementById('pvConsumptionSubtitle');
	if (pvConsSub) pvConsSub.textContent = t('pvConsumptionSubtitle');
	const pvStatsTitle = document.getElementById('pvDetailedStatsTitle');
	if (pvStatsTitle) pvStatsTitle.textContent = t('pvDetailedStats');
	const pvStatsSub = document.getElementById('pvDailyBreakdownSubtitle');
	if (pvStatsSub) pvStatsSub.textContent = t('pvDailyBreakdown');

	// PV detail labels
	const lblCharged = document.getElementById('pvLabelCharged');
	if (lblCharged) lblCharged.textContent = t('savedInBattery');
	const lblDischarged = document.getElementById('pvLabelDischarged');
	if (lblDischarged) lblDischarged.textContent = t('takenFromBattery');
	const lblImported = document.getElementById('pvLabelImported');
	if (lblImported) lblImported.textContent = t('boughtFromGrid');
	const lblExported = document.getElementById('pvLabelExported');
	if (lblExported) lblExported.textContent = t('soldToGrid');

	// Chart axis labels
	if (tempChart) {
		tempChart.options.scales.x.title.text = t('axisTime');
		tempChart.options.scales.y.title.text = t('axisTempUnit');
		tempChart.update('none');
	}
	if (co2Chart) {
		co2Chart.options.scales.x.title.text = t('axisTime');
		co2Chart.options.scales.y.title.text = t('axisCo2Unit');
		co2Chart.update('none');
	}
	if (pvSolarChart) {
		pvSolarChart.options.scales.x.title.text = t('axisTime');
		pvSolarChart.options.scales.y.title.text = t('axisEnergy');
		pvSolarChart.update('none');
	}
	if (pvConsumptionChart) {
		pvConsumptionChart.options.scales.x.title.text = t('axisTime');
		pvConsumptionChart.options.scales.y.title.text = t('axisEnergy');
		pvConsumptionChart.update('none');
	}

	// Rebuild room dropdown with translated labels
	updateRoomSelectorTranslations();
}

function updateRoomSelectorTranslations() {
	const popup = document.getElementById('roomDropdownPopup');
	if (!popup) return;
	let html = `<div class="search-result-item ${selectedSensor === 'all' ? 'active' : ''}" onclick="selectSensor('all')">
		<span class="room-id">📊 ${t('allRoomsAvg')}</span>
	</div>`;
	availableRooms.forEach(room => {
		const matchesFloor = currentFloorFilter === 'all' ||
			(currentFloorFilter === '1' && room.startsWith('1')) ||
			(currentFloorFilter === '2' && room.startsWith('2')) ||
			(currentFloorFilter === 'E' && room.startsWith('E')) ||
			(currentFloorFilter === 'U' && room.startsWith('U'));
		if (matchesFloor) {
			html += `<div class="search-result-item ${selectedSensor === room ? 'active' : ''}" onclick="selectSensor('${room}')">
				<span class="room-id">🏠 ${t('room')} ${room}</span>
			</div>`;
		}
	});
	popup.innerHTML = html;
}

// Build full-day timeline (00:00–23:55 every 5 min) and merge actual data into it
function buildDayTimeline(dateStr, dataPoints) {
	const intervalMs = 5 * 60 * 1000;
	const dataMap = new Map();
	dataPoints.forEach(p => {
		const rounded = Math.round(p.time.getTime() / intervalMs) * intervalMs;
		dataMap.set(rounded, p.value);
	});

	const labels = [], tooltipLabels = [], values = [];
	const start = new Date(dateStr + 'T00:00:00');
	const end   = new Date(dateStr + 'T23:55:00');
	for (let t = start.getTime(); t <= end.getTime(); t += intervalMs) {
		const d = new Date(t);
		labels.push(formatTime(d));
		tooltipLabels.push(formatTooltipTime(d));
		values.push(dataMap.has(t) ? dataMap.get(t) : null);
	}
	return { labels, tooltipLabels, values };
}
// Switch between Sensors and PV view
window.switchView = async (view) => {
	if (currentView === view) return;
	currentView = view;

	const sensorsView = document.getElementById('sensorsView');
	const pvView = document.getElementById('pvView');
	const btnSensors = document.getElementById('btnSensors');
	const btnPV = document.getElementById('btnPV');
	const title = document.getElementById('dashboardTitle');

	if (view === 'sensors') {
		sensorsView.style.display = 'block';
		pvView.style.display = 'none';
		btnSensors.classList.add('active');
		btnPV.classList.remove('active');
		btnSensors.setAttribute('aria-selected', 'true');
		btnPV.setAttribute('aria-selected', 'false');
		title.textContent = t('sensorDashTitle');

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
		btnSensors.setAttribute('aria-selected', 'false');
		btnPV.setAttribute('aria-selected', 'true');
		title.textContent = t('pvDashTitle');

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
		} else {
			console.error('[Solax] Token API error:', data);
			solaxToken = null;
		}
	} catch (error) {
		console.error('Error fetching Solax token:', error);
		solaxToken = null;
	}
	return null;
}

async function refreshPVData() {
	if (currentTimeRange === 'custom' && !isTodaySelected()) {
		await fetchPVHistoryData();
		return;
	}

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
		} else if (data.code === 10401 || data.code === 10402) {
			console.log('[Solax] Token expired or invalid, clearing...');
			solaxToken = null;
		}

		// 2. Fetch History from InfluxDB for the Charts
		await fetchPVHistoryData();

	} catch (error) {
		console.error('Error fetching Solax real-time data:', error);
	}
}

async function fetchPVHistoryData() {
	const query = `from(bucket: "${INFLUXDB_BUCKET}")
       ${getRangeQuery()}
       |> filter(fn: (r) => r._measurement == "solax_stats")
       |> aggregateWindow(every: 5m, fn: mean, createEmpty: false)
       |> yield(name: "mean")`;

	try {
		const csvData = await fetchInfluxDB(query);
		const dataByField = parsePVHistoryResponse(csvData);
		
		updatePVCharts(dataByField);

		if (currentTimeRange === 'custom' && !isTodaySelected()) {
			const getLast = (arr) => arr && arr.length > 0 ? arr[arr.length - 1].value : 0;
			const mockData = {
				dailyYield: getLast(dataByField.daily_yield),
				totalYield: getLast(dataByField.total_yield),
				dailyCharged: getLast(dataByField.daily_charged),
				dailyDischarged: getLast(dataByField.daily_discharged),
				dailyImported: getLast(dataByField.daily_imported),
				dailyExported: getLast(dataByField.daily_exported),
				plantLocalTime: `${customDate} (End of Day)`
			};
			updatePVDashboard(mockData);
		}
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

	const dataByField = { 
		daily_yield: [], 
		consumption: [],
		total_yield: [],
		daily_charged: [],
		daily_discharged: [],
		daily_imported: [],
		daily_exported: []
	};

	for (let i = 1; i < lines.length; i++) {
		const columns = lines[i].split(',').map(c => c.trim().replace(/"/g, ''));
		if (!columns[valueIndex] || !columns[timeIndex] || !columns[fieldIndex]) continue;

		const field = columns[fieldIndex];
		const value = parseFloat(columns[valueIndex]);
		const time = new Date(columns[timeIndex]);

		if (dataByField[field] !== undefined) {
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
			label: t('datasetSolar'),
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
			label: t('datasetConsumption'),
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
	document.getElementById('pvBatteryStatus').textContent = batteryFlow >= 0 ? t('chargingNet') : t('dischargingNet');
	
	// Grid Usage (Imported - Exported)
	const gridFlow = data.dailyImported - data.dailyExported;
	document.getElementById('pvGridFlow').textContent = `${Math.abs(gridFlow).toFixed(1)} kWh`;
	document.getElementById('pvGridStatus').textContent = gridFlow >= 0 ? t('buyingNet') : t('sellingNet');
	
	document.getElementById('pvTimeLabel').textContent = t('updatedAt', { time: data.plantLocalTime });
	
	// Details
	document.getElementById('pvDailyCharged').textContent = `${data.dailyCharged.toFixed(1)} kWh`;
	document.getElementById('pvDailyDischarged').textContent = `${data.dailyDischarged.toFixed(1)} kWh`;
	document.getElementById('pvDailyImported').textContent = `${data.dailyImported.toFixed(1)} kWh`;
	document.getElementById('pvDailyExported').textContent = `${data.dailyExported.toFixed(1)} kWh`;
}


// Filter by floor
window.filterByFloor = async (floor) => {
	currentFloorFilter = floor;
	displayedRoomsCount = ROOMS_PER_PAGE; // Reset pagination when filter changes
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
	displayedRoomsCount = ROOMS_PER_PAGE; // Reset pagination when focus changes
	
	// Update custom dropdown display
	const trigger = document.getElementById('roomDropdownTrigger');
	if (trigger) trigger.textContent = sensor === 'all' ? `📊 ${t('allRooms')}` : `🏠 ${t('room')} ${sensor}`;

	const label = sensor === 'all' ? t('allRooms') : `${t('room')} ${sensor}`;
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
				<span class="room-id">🏠 ${t('room')} ${room}</span>
			</div>
		`).join('');
		resultsPopup.classList.add('visible');
	} else {
		resultsPopup.innerHTML = `<div class="search-result-item">${t('noRooms')}</div>`;
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
          <span class="room-id">📊 ${t('allRoomsAvg')}</span>
       </div>
    `;

	rooms.forEach(room => {
		const matchesFloor = currentFloorFilter === 'all' ||
			(currentFloorFilter === '1' && room.startsWith('1')) ||
			(currentFloorFilter === '2' && room.startsWith('2')) ||
			(currentFloorFilter === 'E' && room.startsWith('E')) ||
			(currentFloorFilter === 'U' && room.startsWith('U'));

		if (matchesFloor) {
			html += `
				<div class="search-result-item ${selectedSensor === room ? 'active' : ''}" onclick="selectSensor('${room}')">
					<span class="room-id">🏠 ${t('room')} ${room}</span>
				</div>
			`;
		}
	});

	popup.innerHTML = html;

	const trigger = document.getElementById('roomDropdownTrigger');
	if (trigger) trigger.textContent = selectedSensor === 'all' ? `📊 ${t('allRooms')}` : `🏠 ${t('room')} ${selectedSensor}`;
}

// Fetch temperature data
async function fetchTemperatureData() {
	const query = `from(bucket: "${INFLUXDB_BUCKET}")
       ${getRangeQuery()}
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
       ${getRangeQuery()}
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
      ${getRangeQuery()}
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
	let currentTemp = 0, avgTemp24h = 0, highestTemp = -Infinity;
	let currentCo2 = 0, avgCo224h = 0, highestCo2 = -Infinity;

	const isPast = currentTimeRange === 'custom' && !isTodaySelected();

	// Set Titles based on isPast
	const title1 = document.getElementById('card1Title');
	if (title1) title1.textContent = isPast ? t('highestTemp') : t('temperature');
	const title2 = document.getElementById('card2Title');
	if (title2) title2.textContent = isPast ? t('highestCo2') : t('co2Level');
	const title3 = document.getElementById('card3Title');
	if (title3) title3.textContent = isPast ? t('avgTemp24h') : t('avg24h');
	const title4 = document.getElementById('card4Title');
	if (title4) title4.textContent = t('avgCo224h');

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

				// All values in range for "24h Average" and highest
				values.forEach(v => {
					historySum += v.value;
					historyCount++;
					if (v.value > highestTemp) highestTemp = v.value;
				});
			}
		});

		currentTemp = tempCount > 0 ? tempSum / tempCount : 0;
		avgTemp24h = historyCount > 0 ? historySum / historyCount : 0;

		// Calculate Average CO2 for filtered rooms
		let co2Sum = 0, co2Count = 0;
		let co2HistorySum = 0, co2HistoryCount = 0;

		filteredRooms.forEach(room => {
			let currentCo2Val = null;

			const topic = room === '105' ? "nili3/sensor/nili3_co2/state" : `nili3/sensor/${room.toLowerCase()}_co2/state`;
			const roomCo2Data = co2Data[topic] || [];

			if (roomCo2Data.length > 0) {
				roomCo2Data.forEach(v => {
					co2HistorySum += v.value;
					co2HistoryCount++;
					if (v.value > highestCo2) highestCo2 = v.value;
				});
			}

			if (room === '105' && !isPast && room105CO2.length > 0) {
				currentCo2Val = room105CO2[0].co2;
			} else if (roomCo2Data.length > 0) {
				currentCo2Val = roomCo2Data[roomCo2Data.length - 1].value;
			}

			if (currentCo2Val !== null) {
				co2Sum += currentCo2Val;
				co2Count++;
			}
		});

		currentCo2 = co2Count > 0 ? co2Sum / co2Count : 0;
		avgCo224h = co2HistoryCount > 0 ? co2HistorySum / co2HistoryCount : 0;

	} else {
		// Single room logic
		const roomData = tempData[selectedSensor] || [];
		currentTemp = roomData.length > 0 ? roomData[roomData.length - 1].value : 0;
		let sum = 0;
		roomData.forEach(({ value }) => { 
			sum += value; 
			if (value > highestTemp) highestTemp = value;
		});
		avgTemp24h = roomData.length > 0 ? sum / roomData.length : 0;

		const topic = selectedSensor === '105' ? "nili3/sensor/nili3_co2/state" : `nili3/sensor/${selectedSensor.toLowerCase()}_co2/state`;
		const roomCo2Data = co2Data[topic] || [];

		let cSum = 0;
		roomCo2Data.forEach(({ value }) => {
			cSum += value;
			if (value > highestCo2) highestCo2 = value;
		});
		avgCo224h = roomCo2Data.length > 0 ? cSum / roomCo2Data.length : 0;

		if (selectedSensor === '105' && !isPast && room105CO2.length > 0) {
			currentCo2 = room105CO2[0].co2;
		} else {
			currentCo2 = roomCo2Data.length > 0 ? roomCo2Data[roomCo2Data.length - 1].value : 0;
		}
	}

	if (highestTemp === -Infinity) highestTemp = 0;
	if (highestCo2 === -Infinity) highestCo2 = 0;

	const val1 = isPast ? highestTemp : currentTemp;
	const val2 = isPast ? highestCo2 : currentCo2;

	const tempEl = document.getElementById('currentTemp');
	if (tempEl) tempEl.textContent = `${val1.toFixed(1)}°C`;
	
	const co2El = document.getElementById('currentCo2');
	if (co2El) co2El.textContent = `${val2.toFixed(0)} ppm`;
	
	const avgTempEl = document.getElementById('avgTemp24h');
	if (avgTempEl) avgTempEl.textContent = `${avgTemp24h.toFixed(1)}°C`;
	
	const avgCo2El = document.getElementById('avgCo224h');
	if (avgCo2El) avgCo2El.textContent = `${avgCo224h.toFixed(0)} ppm`;
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
	if (currentTimeRange === 'custom' && customDate) {
		const timeline = buildDayTimeline(customDate, roomData);
		tempChart.data.labels = timeline.labels;
		tempChart.data.tooltipLabels = timeline.tooltipLabels;
		tempChart.data.datasets = [{
			label: `${t('room')} ${selectedSensor}`,
			data: timeline.values,
			borderColor: '#ef4444',
			backgroundColor: 'rgba(239, 68, 68, 0.1)',
			fill: true,
			tension: 0.4,
			spanGaps: false
		}];
	} else {
		tempChart.data.labels = roomData.map(({ time }) => formatTime(time));
		tempChart.data.tooltipLabels = roomData.map(({ time }) => formatTooltipTime(time));
		tempChart.data.datasets = [{
			label: `${t('room')} ${selectedSensor}`,
			data: roomData.map(({ value }) => value),
			borderColor: '#ef4444',
			backgroundColor: 'rgba(239, 68, 68, 0.1)',
			fill: true,
			tension: 0.4
		}];
	}
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

	if (currentTimeRange === 'custom' && customDate) {
		const timeline = buildDayTimeline(customDate, roomCo2Data);
		co2Chart.data.labels = timeline.labels;
		co2Chart.data.tooltipLabels = timeline.tooltipLabels;
		co2Chart.data.datasets = [{
			label: `${t('room')} ${selectedSensor}`,
			data: timeline.values,
			borderColor: '#f59e0b',
			backgroundColor: 'rgba(245, 158, 11, 0.1)',
			fill: true,
			tension: 0.4,
			spanGaps: false
		}];
	} else {
		co2Chart.data.labels = roomCo2Data.map(({ time }) => formatTime(time));
		co2Chart.data.tooltipLabels = roomCo2Data.map(({ time }) => formatTooltipTime(time));
		co2Chart.data.datasets = [{
			label: `${t('room')} ${selectedSensor}`,
			data: roomCo2Data.map(({ value }) => value),
			borderColor: '#f59e0b',
			backgroundColor: 'rgba(245, 158, 11, 0.1)',
			fill: true,
			tension: 0.4
		}];
	}
	co2Chart.update();
}

// Update room table with pagination
function updateRoomTable(roomData) {
	const tbody = document.getElementById('roomTableBody');
	const showMoreBtn = document.getElementById('showMoreBtn');
	const showMoreCount = document.getElementById('showMoreCount');
	const refreshEl = document.getElementById('tableLastRefresh');

	// Update status indicator
	const isPast = currentTimeRange === 'custom' && !isTodaySelected();
	if (refreshEl) {
		if (isPast) {
			refreshEl.innerHTML = t('historicalData', { date: customDate });
		} else {
			refreshEl.innerHTML = `<span style="color: #4ade80">●</span> ${t('liveMqtt')}`;
		}
	}

	// Filter rooms by floor
	const filteredData = roomData.filter(room => {
		return currentFloorFilter === 'all' ||
			(currentFloorFilter === '1' && room.room.startsWith('1')) ||
			(currentFloorFilter === '2' && room.room.startsWith('2')) ||
			(currentFloorFilter === 'E' && room.room.startsWith('E')) ||
			(currentFloorFilter === 'U' && room.room.startsWith('U'));
	});

	// Sort rooms
	filteredData.sort((a, b) => a.room.localeCompare(b.room));

	// Show only displayedRoomsCount
	const visibleRooms = filteredData.slice(0, displayedRoomsCount);

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
			statusText = t('statusAlert');
			statusClass = 'status-warning';
		} else if (co2Medium) {
			statusText = t('statusMedium');
			statusClass = 'status-medium';
		} else {
			statusText = t('statusOk');
			statusClass = 'status-ok';
		}

		row.innerHTML = `
          <td data-label="Room"><strong>${room.room}</strong></td>
          <td data-label="Temperature" class="${tempClass}">${tempValue}</td>
          <td data-label="CO₂" class="${co2Class}">${co2Value}</td>
          <td data-label="Last Update">${formatRelativeTime(room.time)}</td>
          <td data-label="Status" class="${statusClass}">${statusText}</td>
       `;
		tbody.appendChild(row);
	});

	// Update show more button
	if (displayedRoomsCount >= filteredData.length) {
		showMoreBtn.style.display = 'none';
	} else {
		showMoreBtn.style.display = '';
		showMoreCount.textContent = `(${displayedRoomsCount}/${filteredData.length})`;
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
	
	const timeStr = date.toLocaleTimeString('en-GB', options);
	
	// If range is > 24h, show date
	if (currentTimeRange === '7d') {
		const dateStr = date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' });
		return `${dateStr} ${timeStr}`;
	}
	
	return timeStr;
}

// Helper: Format time for tooltips (always includes date)
function formatTooltipTime(date) {
	const timeStr = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
	const dateStr = date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
	return `${dateStr} ${timeStr}`;
}

// Helper: Format relative time
function formatRelativeTime(date) {
	const now = new Date();
	const diff = Math.floor((now - date) / 1000);
	if (diff < 60) return t('justNow');
	if (diff < 3600) return t('minAgo', { n: Math.floor(diff / 60) });
	if (diff < 86400) return t('hoursAgo', { n: Math.floor(diff / 3600) });
	return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
