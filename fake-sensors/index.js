import mqtt from 'mqtt';

// Configuration
const MQTT_HOST = process.env.MQTT_HOST || 'localhost';
const MQTT_PORT = process.env.MQTT_PORT || '1883';
const UPDATE_INTERVAL = parseInt(process.env.UPDATE_INTERVAL) || 10000; // 10 seconds

// All rooms from the 3D model with realistic sensor characteristics
const roomsConfig = [
  // Numeric rooms (Floor 1) - Normal temperature: 20-23°C
  { id: '1Aula', floor: '1', type: 'auditorium', baseTemp: 21.5, occupancy: 'veryhigh', co2Max: 1600, ventilation: 0.08 },
  { id: '103', floor: '1', type: 'classroom', baseTemp: 21.2, occupancy: 'medium', co2Max: 1100, ventilation: 0.12 },
  { id: '104', floor: '1', type: 'classroom', baseTemp: 20.8, occupancy: 'medium', co2Max: 1200, ventilation: 0.11 },
  { id: '106', floor: '1', type: 'classroom', baseTemp: 20.3, occupancy: 'medium', co2Max: 1100, ventilation: 0.12 },
  { id: '107', floor: '1', type: 'classroom', baseTemp: 21.8, occupancy: 'high', co2Max: 1350, ventilation: 0.10 },
  { id: '108', floor: '1', type: 'classroom', baseTemp: 20.5, occupancy: 'low', co2Max: 800, ventilation: 0.15 },
  { id: '109', floor: '1', type: 'classroom', baseTemp: 21.1, occupancy: 'medium', co2Max: 1150, ventilation: 0.11 },
  { id: '110', floor: '1', type: 'classroom', baseTemp: 20.7, occupancy: 'medium', co2Max: 1200, ventilation: 0.12 },
  { id: '111', floor: '1', type: 'classroom', baseTemp: 21.4, occupancy: 'high', co2Max: 1400, ventilation: 0.09 },
  { id: '112', floor: '1', type: 'classroom', baseTemp: 20.9, occupancy: 'medium', co2Max: 1100, ventilation: 0.12 },
  { id: '113', floor: '1', type: 'classroom', baseTemp: 21.6, occupancy: 'high', co2Max: 1300, ventilation: 0.10 },
  { id: '114', floor: '1', type: 'classroom', baseTemp: 20.4, occupancy: 'low', co2Max: 850, ventilation: 0.14 },
  { id: '115', floor: '1', type: 'classroom', baseTemp: 21.9, occupancy: 'medium', co2Max: 1150, ventilation: 0.11 },
  { id: '116', floor: '1', type: 'classroom', baseTemp: 20.6, occupancy: 'medium', co2Max: 1200, ventilation: 0.12 },
  { id: '117', floor: '1', type: 'classroom', baseTemp: 21.3, occupancy: 'high', co2Max: 1350, ventilation: 0.09 },
  { id: '118', floor: '1', type: 'classroom', baseTemp: 20.2, occupancy: 'medium', co2Max: 1100, ventilation: 0.12 },
  { id: '119', floor: '1', type: 'classroom', baseTemp: 21.7, occupancy: 'high', co2Max: 1300, ventilation: 0.10 },
  { id: '120', floor: '1', type: 'classroom', baseTemp: 20.8, occupancy: 'low', co2Max: 800, ventilation: 0.15 },
  { id: '121', floor: '1', type: 'classroom', baseTemp: 21.0, occupancy: 'medium', co2Max: 1150, ventilation: 0.11 },
  { id: '122', floor: '1', type: 'classroom', baseTemp: 20.5, occupancy: 'medium', co2Max: 1200, ventilation: 0.12 },
  { id: '123', floor: '1', type: 'classroom', baseTemp: 21.2, occupancy: 'high', co2Max: 1400, ventilation: 0.09 },
  { id: '124', floor: '1', type: 'classroom', baseTemp: 20.9, occupancy: 'medium', co2Max: 1100, ventilation: 0.12 },
  { id: '125', floor: '1', type: 'classroom', baseTemp: 21.5, occupancy: 'high', co2Max: 1350, ventilation: 0.10 },
  { id: '126', floor: '1', type: 'classroom', baseTemp: 20.3, occupancy: 'low', co2Max: 850, ventilation: 0.14 },
  { id: '127', floor: '1', type: 'classroom', baseTemp: 21.8, occupancy: 'medium', co2Max: 1150, ventilation: 0.11 },
  { id: '128', floor: '1', type: 'classroom', baseTemp: 20.7, occupancy: 'medium', co2Max: 1200, ventilation: 0.12 },
  { id: '129', floor: '1', type: 'classroom', baseTemp: 21.1, occupancy: 'high', co2Max: 1300, ventilation: 0.09 },
  { id: '130', floor: '1', type: 'classroom', baseTemp: 20.4, occupancy: 'medium', co2Max: 1100, ventilation: 0.12 },
  { id: '131', floor: '1', type: 'classroom', baseTemp: 21.6, occupancy: 'high', co2Max: 1350, ventilation: 0.10 },
  { id: '132', floor: '1', type: 'classroom', baseTemp: 20.6, occupancy: 'low', co2Max: 800, ventilation: 0.15 },
  { id: '133', floor: '1', type: 'classroom', baseTemp: 21.3, occupancy: 'medium', co2Max: 1150, ventilation: 0.11 },
  { id: '134', floor: '1', type: 'classroom', baseTemp: 20.8, occupancy: 'medium', co2Max: 1200, ventilation: 0.12 },
  { id: '135', floor: '1', type: 'classroom', baseTemp: 21.9, occupancy: 'high', co2Max: 1400, ventilation: 0.09 },
  { id: '136', floor: '1', type: 'classroom', baseTemp: 20.2, occupancy: 'medium', co2Max: 1100, ventilation: 0.12 },
  { id: '137', floor: '1', type: 'classroom', baseTemp: 21.4, occupancy: 'high', co2Max: 1350, ventilation: 0.10 },
  { id: '138', floor: '1', type: 'classroom', baseTemp: 20.5, occupancy: 'low', co2Max: 850, ventilation: 0.14 },
  { id: '139', floor: '1', type: 'classroom', baseTemp: 21.7, occupancy: 'medium', co2Max: 1150, ventilation: 0.11 },
  { id: '140', floor: '1', type: 'classroom', baseTemp: 20.9, occupancy: 'medium', co2Max: 1200, ventilation: 0.12 },
  { id: '141', floor: '1', type: 'classroom', baseTemp: 21.0, occupancy: 'high', co2Max: 1300, ventilation: 0.09 },
  { id: '142', floor: '1', type: 'classroom', baseTemp: 20.3, occupancy: 'medium', co2Max: 1100, ventilation: 0.12 },
  { id: '143', floor: '1', type: 'classroom', baseTemp: 21.5, occupancy: 'high', co2Max: 1350, ventilation: 0.10 },
  { id: '144', floor: '1', type: 'classroom', baseTemp: 20.7, occupancy: 'low', co2Max: 800, ventilation: 0.15 },
  { id: '145', floor: '1', type: 'classroom', baseTemp: 21.2, occupancy: 'medium', co2Max: 1150, ventilation: 0.11 },
  { id: '146', floor: '1', type: 'classroom', baseTemp: 20.4, occupancy: 'medium', co2Max: 1200, ventilation: 0.12 },
  { id: '147', floor: '1', type: 'classroom', baseTemp: 21.8, occupancy: 'high', co2Max: 1400, ventilation: 0.09 },
  { id: '148', floor: '1', type: 'classroom', baseTemp: 20.6, occupancy: 'medium', co2Max: 1100, ventilation: 0.12 },
  { id: '149', floor: '1', type: 'classroom', baseTemp: 21.1, occupancy: 'medium', co2Max: 1200, ventilation: 0.11 },
  { id: '150', floor: '1', type: 'classroom', baseTemp: 20.8, occupancy: 'low', co2Max: 850, ventilation: 0.14 },
  { id: '151', floor: '1', type: 'classroom', baseTemp: 21.6, occupancy: 'medium', co2Max: 1150, ventilation: 0.11 },
  { id: '152', floor: '1', type: 'classroom', baseTemp: 20.2, occupancy: 'medium', co2Max: 1200, ventilation: 0.12 },
  { id: '153', floor: '1', type: 'classroom', baseTemp: 21.3, occupancy: 'high', co2Max: 1300, ventilation: 0.09 },
  { id: '154', floor: '1', type: 'classroom', baseTemp: 20.5, occupancy: 'medium', co2Max: 1100, ventilation: 0.12 },
  
  // Numeric rooms (Floor 2) - Normal temperature: 20-23°C
  { id: '203', floor: '2', type: 'classroom', baseTemp: 20.8, occupancy: 'medium', co2Max: 1150, ventilation: 0.11 },
  { id: '204', floor: '2', type: 'classroom', baseTemp: 21.2, occupancy: 'medium', co2Max: 1100, ventilation: 0.12 },
  { id: '206', floor: '2', type: 'classroom', baseTemp: 20.5, occupancy: 'low', co2Max: 850, ventilation: 0.14 },
  { id: '213', floor: '2', type: 'classroom', baseTemp: 21.0, occupancy: 'medium', co2Max: 1150, ventilation: 0.11 },
  { id: '214', floor: '2', type: 'classroom', baseTemp: 20.3, occupancy: 'medium', co2Max: 1200, ventilation: 0.12 },
  { id: '215', floor: '2', type: 'classroom', baseTemp: 21.5, occupancy: 'high', co2Max: 1350, ventilation: 0.09 },
  { id: '216', floor: '2', type: 'classroom', baseTemp: 20.7, occupancy: 'medium', co2Max: 1100, ventilation: 0.12 },
  { id: '217', floor: '2', type: 'classroom', baseTemp: 21.8, occupancy: 'high', co2Max: 1300, ventilation: 0.10 },
  { id: '218', floor: '2', type: 'classroom', baseTemp: 20.4, occupancy: 'low', co2Max: 800, ventilation: 0.15 },
  { id: '226', floor: '2', type: 'classroom', baseTemp: 21.1, occupancy: 'medium', co2Max: 1150, ventilation: 0.11 },
  { id: '227', floor: '2', type: 'classroom', baseTemp: 20.6, occupancy: 'medium', co2Max: 1200, ventilation: 0.12 },
  { id: '228', floor: '2', type: 'classroom', baseTemp: 21.4, occupancy: 'high', co2Max: 1400, ventilation: 0.09 },
  { id: '229', floor: '2', type: 'classroom', baseTemp: 20.9, occupancy: 'medium', co2Max: 1100, ventilation: 0.12 },
  { id: '230', floor: '2', type: 'classroom', baseTemp: 21.7, occupancy: 'high', co2Max: 1350, ventilation: 0.10 },
  { id: '231', floor: '2', type: 'classroom', baseTemp: 20.2, occupancy: 'low', co2Max: 850, ventilation: 0.14 },
  { id: '237', floor: '2', type: 'classroom', baseTemp: 21.3, occupancy: 'medium', co2Max: 1150, ventilation: 0.11 },
  { id: '239', floor: '2', type: 'classroom', baseTemp: 20.8, occupancy: 'medium', co2Max: 1200, ventilation: 0.12 },
  { id: '241', floor: '2', type: 'classroom', baseTemp: 21.6, occupancy: 'high', co2Max: 1300, ventilation: 0.09 },
  { id: '251', floor: '2', type: 'lab', baseTemp: 20.0, occupancy: 'low', co2Max: 700, ventilation: 0.20 },
  { id: '252', floor: '2', type: 'lab', baseTemp: 20.5, occupancy: 'medium', co2Max: 900, ventilation: 0.18 },
  { id: '253', floor: '2', type: 'lab', baseTemp: 20.2, occupancy: 'low', co2Max: 750, ventilation: 0.19 },
  { id: '254', floor: '2', type: 'lab', baseTemp: 20.7, occupancy: 'medium', co2Max: 950, ventilation: 0.17 },
  
  // E-series rooms (Ground floor) - Warmer: 22-25°C
  { id: 'E05', floor: 'E', type: 'office', baseTemp: 22.8, occupancy: 'low', co2Max: 800, ventilation: 0.15 },
  { id: 'E07', floor: 'E', type: 'classroom', baseTemp: 23.2, occupancy: 'medium', co2Max: 1200, ventilation: 0.11 },
  { id: 'E08', floor: 'E', type: 'classroom', baseTemp: 22.5, occupancy: 'medium', co2Max: 1150, ventilation: 0.12 },
  { id: 'E09', floor: 'E', type: 'classroom', baseTemp: 23.8, occupancy: 'veryhigh', co2Max: 1600, ventilation: 0.08 },
  { id: 'E10', floor: 'E', type: 'classroom', baseTemp: 23.0, occupancy: 'veryhigh', co2Max: 1700, ventilation: 0.07 },
  { id: 'E11', floor: 'E', type: 'classroom', baseTemp: 22.3, occupancy: 'medium', co2Max: 1100, ventilation: 0.12 },
  { id: 'E22', floor: 'E', type: 'office', baseTemp: 23.5, occupancy: 'low', co2Max: 850, ventilation: 0.14 },
  { id: 'E23', floor: 'E', type: 'office', baseTemp: 22.7, occupancy: 'medium', co2Max: 950, ventilation: 0.13 },
  { id: 'E24', floor: 'E', type: 'office', baseTemp: 23.1, occupancy: 'medium', co2Max: 1000, ventilation: 0.12 },
  { id: 'E25', floor: 'E', type: 'office', baseTemp: 22.4, occupancy: 'low', co2Max: 800, ventilation: 0.15 },
  { id: 'E26', floor: 'E', type: 'office', baseTemp: 23.6, occupancy: 'medium', co2Max: 950, ventilation: 0.13 },
  { id: 'E59', floor: 'E', type: 'classroom', baseTemp: 22.9, occupancy: 'high', co2Max: 1450, ventilation: 0.09 },
  { id: 'E71', floor: 'E', type: 'classroom', baseTemp: 23.3, occupancy: 'high', co2Max: 1350, ventilation: 0.10 },
  { id: 'E72', floor: 'E', type: 'classroom', baseTemp: 22.6, occupancy: 'medium', co2Max: 1150, ventilation: 0.11 },
  { id: 'E73', floor: 'E', type: 'classroom', baseTemp: 23.9, occupancy: 'veryhigh', co2Max: 1650, ventilation: 0.08 },
  { id: 'E581', floor: 'E', type: 'office', baseTemp: 22.2, occupancy: 'low', co2Max: 750, ventilation: 0.16 },
  { id: 'E582', floor: 'E', type: 'office', baseTemp: 23.4, occupancy: 'medium', co2Max: 900, ventilation: 0.13 },
  
  // U-series basement rooms - Cooler: 18-21°C
  { id: 'U04', floor: 'U', type: 'storage', baseTemp: 18.5, occupancy: 'verylow', co2Max: 600, ventilation: 0.25 },
  { id: 'U05', floor: 'U', type: 'classroom', baseTemp: 19.2, occupancy: 'medium', co2Max: 1100, ventilation: 0.12 },
  { id: 'U07', floor: 'U', type: 'storage', baseTemp: 18.8, occupancy: 'verylow', co2Max: 550, ventilation: 0.25 },
  { id: 'U08', floor: 'U', type: 'classroom', baseTemp: 19.5, occupancy: 'high', co2Max: 1300, ventilation: 0.10 },
  { id: 'U10', floor: 'U', type: 'classroom', baseTemp: 18.3, occupancy: 'low', co2Max: 850, ventilation: 0.14 },
  { id: 'UBiolab', floor: 'U', type: 'lab', baseTemp: 19.0, occupancy: 'medium', co2Max: 950, ventilation: 0.16 },
  { id: 'U71', floor: 'U', type: 'classroom', baseTemp: 18.7, occupancy: 'medium', co2Max: 1100, ventilation: 0.12 },
  { id: 'U72', floor: 'U', type: 'classroom', baseTemp: 19.8, occupancy: 'high', co2Max: 1350, ventilation: 0.09 },
  { id: 'U73', floor: 'U', type: 'classroom', baseTemp: 18.4, occupancy: 'medium', co2Max: 1050, ventilation: 0.13 },
  { id: 'U74', floor: 'U', type: 'classroom', baseTemp: 19.3, occupancy: 'medium', co2Max: 1150, ventilation: 0.11 },
  { id: 'U74.1', floor: 'U', type: 'office', baseTemp: 18.9, occupancy: 'low', co2Max: 750, ventilation: 0.15 },
  { id: 'U77', floor: 'U', type: 'classroom', baseTemp: 19.6, occupancy: 'high', co2Max: 1250, ventilation: 0.10 },
  { id: 'U78', floor: 'U', type: 'classroom', baseTemp: 18.2, occupancy: 'low', co2Max: 850, ventilation: 0.14 },
  { id: 'U79', floor: 'U', type: 'classroom', baseTemp: 19.1, occupancy: 'medium', co2Max: 1150, ventilation: 0.11 },
  { id: 'U81', floor: 'U', type: 'classroom', baseTemp: 18.6, occupancy: 'medium', co2Max: 1050, ventilation: 0.12 },
  { id: 'U82', floor: 'U', type: 'classroom', baseTemp: 19.9, occupancy: 'high', co2Max: 1350, ventilation: 0.09 },
  { id: 'U83', floor: 'U', type: 'classroom', baseTemp: 18.1, occupancy: 'medium', co2Max: 1100, ventilation: 0.12 },
  { id: 'U84', floor: 'U', type: 'classroom', baseTemp: 19.4, occupancy: 'high', co2Max: 1250, ventilation: 0.10 },
  { id: 'U85', floor: 'U', type: 'classroom', baseTemp: 18.8, occupancy: 'low', co2Max: 800, ventilation: 0.14 },
  { id: 'U86', floor: 'U', type: 'classroom', baseTemp: 19.7, occupancy: 'medium', co2Max: 1100, ventilation: 0.12 },
  { id: 'U87', floor: 'U', type: 'classroom', baseTemp: 18.3, occupancy: 'medium', co2Max: 1050, ventilation: 0.13 },
  { id: 'U88', floor: 'U', type: 'classroom', baseTemp: 19.2, occupancy: 'high', co2Max: 1300, ventilation: 0.09 },
  { id: 'U89', floor: 'U', type: 'classroom', baseTemp: 18.5, occupancy: 'medium', co2Max: 1100, ventilation: 0.12 },
  { id: 'U90', floor: 'U', type: 'classroom', baseTemp: 19.0, occupancy: 'medium', co2Max: 1150, ventilation: 0.11 },
  { id: 'U91', floor: 'U', type: 'classroom', baseTemp: 18.9, occupancy: 'low', co2Max: 850, ventilation: 0.14 },
  { id: 'U92', floor: 'U', type: 'classroom', baseTemp: 19.5, occupancy: 'medium', co2Max: 1100, ventilation: 0.12 },
];

// Individual sensor state for each room
const sensorState = roomsConfig.map(room => ({
  roomId: room.id,
  topic: `nili3/sensor/${room.id.toLowerCase()}_co2/state`,
  currentCO2: 420 + Math.random() * 30, // Start between 420-450 ppm
  tempOffset: (Math.random() - 0.5) * 0.4, // Each sensor has slight calibration difference
  noiseFactor: 0.15 + Math.random() * 0.15, // Random noise factor 0.15-0.30
}));

// Time tracking
let hourOffset = 0;
let lastUpdate = Date.now();

/**
 * Get the current "simulated" hour (0-23)
 */
function getSimulatedHour() {
  const now = new Date();
  return (now.getHours() + hourOffset + 24) % 24;
}

/**
 * Calculate occupancy factor based on time, day, and room type
 * Returns 0-1 where 1 is full occupancy
 */
function getOccupancyFactor(room) {
  const hour = getSimulatedHour();
  const dayOfWeek = new Date().getDay();
  const minutes = new Date().getMinutes();
  
  // Weekend = much lower occupancy
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return 0.05 + Math.random() * 0.1;
  }
  
  // Very early morning (before 7)
  if (hour < 7) {
    return 0.02 + Math.random() * 0.05;
  }
  
  // Evening (after 17)
  if (hour >= 17) {
    return 0.03 + Math.random() * 0.07;
  }
  
  // Lunch time dip (12:00-13:00) - rooms empty
  if (hour >= 12 && hour < 13) {
    return 0.08 + Math.random() * 0.12;
  }
  
  // Before/after school hours transition
  if (hour === 7 || hour === 16) {
    return 0.15 + Math.random() * 0.15;
  }
  
  // Peak school hours (9-12, 13-15)
  const isPeakHour = (hour >= 9 && hour < 12) || (hour >= 13 && hour < 15);
  
  // Base occupancy by room type
  const baseOccupancy = {
    'veryhigh': 0.90,
    'high': 0.75,
    'medium': 0.50,
    'low': 0.20,
    'verylow': 0.08
  };
  
  const peakMultiplier = isPeakHour ? 1.15 : 0.65;
  const base = baseOccupancy[room.occupancy] || 0.5;
  
  // Add small random variation (people coming/going)
  const randomVariation = (Math.random() - 0.5) * 0.15;
  
  return Math.min(0.98, Math.max(0.02, base * peakMultiplier + randomVariation));
}

/**
 * Calculate realistic temperature with multiple factors
 */
function calculateTemperature(room, sensor) {
  const hour = getSimulatedHour();
  const occupancyFactor = getOccupancyFactor(room);
  
  // Daily temperature cycle (circadian rhythm)
  // Minimum at 5-6 AM, maximum at 14-15 PM
  const hourAngle = ((hour - 5) / 24) * Math.PI * 2;
  const dailyVariation = Math.sin(hourAngle) * 1.8;
  
  // Occupancy heat (people generate heat, equipment, etc.)
  const occupancyHeat = occupancyFactor * 1.2;
  
  // HVAC cycle (temperature oscillates slightly as heating/cooling kicks in)
  const hvacCycle = Math.sin(Date.now() / 600000) * 0.3;
  
  // Random fluctuations (doors opening, sunlight, etc.)
  const randomFluctuation = (Math.random() - 0.5) * sensor.noiseFactor;
  
  // Seasonal adjustment
  const month = new Date().getMonth();
  const seasonalVariation = Math.sin((month - 6) * Math.PI / 6) * 0.4;
  
  // Floor adjustment
  const floorAdjustment = room.floor === '2' ? 0.4 : room.floor === 'E' ? 1.0 : room.floor === 'U' ? -0.6 : 0;
  
  // Sensor calibration offset (each sensor reads slightly different)
  const calibrationOffset = sensor.tempOffset;
  
  const temperature = 
    room.baseTemp + 
    dailyVariation * 0.6 +
    occupancyHeat + 
    hvacCycle +
    randomFluctuation + 
    seasonalVariation * 0.3 +
    floorAdjustment +
    calibrationOffset;
  
  return Math.round(temperature * 10) / 10;
}

/**
 * Calculate realistic CO2 with buildup, decay, and random events
 */
function calculateCO2(room, sensor) {
  const occupancyFactor = getOccupancyFactor(room);
  
  // Target CO2 based on occupancy
  const targetCO2 = 400 + (occupancyFactor * (room.co2Max - 400));
  
  // Random events: doors opening, windows, meetings starting/ending
  const eventFactor = Math.random();
  let eventImpact = 0;
  
  if (eventFactor > 0.97) {
    // Sudden spike (meeting started, many people entered)
    eventImpact = 80 + Math.random() * 120;
  } else if (eventFactor < 0.03) {
    // Sudden drop (window opened, ventilation increased)
    eventImpact = -60 - Math.random() * 90;
  }
  
  // Calculate rate of change based on ventilation
  const effectiveVentilation = room.ventilation * (1 + occupancyFactor * 0.3);
  
  // Gradual approach to target with inertia
  const difference = targetCO2 + eventImpact - sensor.currentCO2;
  const changeRate = 0.08 + Math.random() * 0.06;
  
  sensor.currentCO2 = sensor.currentCO2 + (difference * changeRate * effectiveVentilation);
  
  // Add sensor noise (measurement uncertainty)
  const sensorNoise = (Math.random() - 0.5) * sensor.noiseFactor * 50;
  
  // Ensure reasonable bounds (400-2000 ppm)
  const co2 = Math.max(380, Math.min(2000, sensor.currentCO2 + sensorNoise));
  
  return Math.round(co2);
}

/**
 * Format temperature message for MQTT
 */
function formatTemperatureMessage(roomId, temperature) {
  return JSON.stringify({
    room: roomId,
    temperature: temperature
  });
}

// Main sensor simulation class
class FakeSensorSimulator {
  constructor() {
    this.client = null;
    this.connected = false;
    this.publishCount = 0;
  }

  async connect() {
    const url = `mqtt://${MQTT_HOST}:${MQTT_PORT}`;
    console.log(`Connecting to MQTT broker at ${url}...`);

    return new Promise((resolve, reject) => {
      this.client = mqtt.connect(url, {
        clientId: `fake-sensor-${Date.now()}`,
        clean: true,
        reconnectPeriod: 5000,
        connectTimeout: 10000,
      });

      this.client.on('connect', () => {
        this.connected = true;
        console.log('Connected to MQTT broker!');
        console.log(`Publishing ${roomsConfig.length} room sensors every ${UPDATE_INTERVAL/1000}s`);
        
        // Group rooms by floor
        const byFloor = roomsConfig.reduce((acc, room) => {
          acc[room.floor] = (acc[room.floor] || 0) + 1;
          return acc;
        }, {});
        
        console.log('Rooms by floor:', Object.entries(byFloor).map(([f, c]) => `Floor ${f}: ${c}`).join(', '));
        console.log('');
        resolve();
      });

      this.client.on('error', (err) => {
        console.error('MQTT connection error:', err.message);
        if (!this.connected) reject(err);
      });

      this.client.on('reconnect', () => {
        console.log('Reconnecting to MQTT broker...');
      });

      this.client.on('offline', () => {
        console.log('MQTT client offline');
        this.connected = false;
      });
    });
  }

  publishTemperature(roomId, temperature) {
    if (!this.connected) return;
    const message = formatTemperatureMessage(roomId, temperature);
    this.client.publish('room-temperature', message, { qos: 1 });
  }

  publishCO2(topic, co2Value) {
    if (!this.connected) return;
    const message = co2Value.toString();
    this.client.publish(topic, message, { qos: 1 });
  }

  publishAllSensors() {
    this.publishCount++;
    const timestamp = new Date().toLocaleTimeString();
    
    const showDetails = this.publishCount <= 1 || this.publishCount % 20 === 0;
    
    if (showDetails) {
      console.log(`\n--- ${timestamp} ---`);
      console.log(`Publishing ${roomsConfig.length} rooms...`);
    }
    
    // Publish temperature and CO2 for each room
    roomsConfig.forEach((room, index) => {
      const sensor = sensorState[index];
      
      const temp = calculateTemperature(room, sensor);
      this.publishTemperature(room.id, temp);
      
      const co2 = calculateCO2(room, sensor);
      this.publishCO2(sensor.topic, co2);
      
      if (showDetails && index < 10) {
        console.log(`  ${room.id}: ${temp}°C, ${co2} ppm`);
      }
    });
    
    if (showDetails) {
      console.log('  ... and ' + (roomsConfig.length - 10) + ' more rooms');
    }
  }

  startPublishing() {
    console.log('Starting sensor simulation...');
    this.publishAllSensors();
    
    setInterval(() => {
      this.publishAllSensors();
    }, UPDATE_INTERVAL);
  }

  async disconnect() {
    if (this.client) {
      console.log('\nDisconnecting from MQTT broker...');
      await this.client.end();
      this.connected = false;
      console.log('Disconnected');
    }
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nReceived SIGINT, shutting down gracefully...');
  if (simulator) {
    await simulator.disconnect();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nReceived SIGTERM, shutting down gracefully...');
  if (simulator) {
    await simulator.disconnect();
  }
  process.exit(0);
});

// Start the simulator
const simulator = new FakeSensorSimulator();

simulator.connect()
  .then(() => {
    simulator.startPublishing();
  })
  .catch((err) => {
    console.error('Failed to connect:', err.message);
    console.log('Make sure MQTT broker (mosquitto) is running');
    process.exit(1);
  });

// Log status periodically
setInterval(() => {
  const hour = getSimulatedHour();
  const occupancy = getOccupancyFactor({ occupancy: 'medium' });
  console.log(`Hour: ${hour}:00, Occupancy: ${(occupancy * 100).toFixed(0)}%`);
}, 60000);
