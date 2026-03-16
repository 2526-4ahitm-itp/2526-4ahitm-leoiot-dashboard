# Fake MQTT Sensors

Simulates 7 realistic IoT sensors publishing temperature and CO₂ data via MQTT.

## Features

- **7 Rooms** across different floors (1st floor, 2nd floor, Ground floor, Basement)
- **Realistic temperature patterns**:
  - Daily cycles (cooler at night, warmer during day)
  - Occupancy heat contribution (people generate heat!)
  - Small random fluctuations
  - Seasonal variations
- **Realistic CO₂ patterns**:
  - Baseline ~400-450 ppm (outdoor air)
  - Builds up during occupied hours
  - Decays when rooms are empty
  - Different levels based on room occupancy
- **Smart occupancy simulation**:
  - School hours: 7:30 - 17:00
  - Peak hours: 9:00 - 15:00
  - Reduced weekend occupancy

## Rooms

| Room | Floor | Type        | Base Temp | Occupancy |
|------|-------|-------------|-----------|-----------|
| 103  | 1     | Classroom   | 21.2°C    | Medium    |
| 104  | 1     | Classroom   | 20.8°C    | Medium    |
| 137  | 1     | Classroom   | 21.5°C    | High      |
| 214  | 2     | Classroom   | 20.5°C    | Medium    |
| 251  | 2     | Lab         | 20.0°C    | Low       |
| E10  | E     | Classroom   | 23.0°C    | High      |
| E24  | E     | Office      | 22.5°C    | Medium    |
| U07  | U     | Storage     | 19.0°C    | Low       |

## Usage

### With Docker Compose (Recommended)

```bash
# Start all services including fake sensors
docker-compose up

# Or start only fake sensors
docker-compose up fake-sensors
```

### Standalone (for testing)

```bash
# Install dependencies
npm install

# Run with default settings (connects to localhost:1883)
npm start

# Or with custom MQTT broker
MQTT_HOST=192.168.1.100 npm start
```

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `MQTT_HOST`         | localhost | MQTT broker hostname |
| `MQTT_PORT`         | 1883    | MQTT broker port |
| `UPDATE_INTERVAL`   | 10000   | Publish interval in milliseconds |

## MQTT Topics

### Temperature
- **Topic**: `room-temperature`
- **Format**: JSON
- **Example**: `{"room": "105", "temperature": 21.5}`

### CO₂
- **Topic**: `nili3/sensor/{room_id}_co2/state`
- **Format**: Plain number (ppm)
- **Example**: `850`

## Output Example

```
📡 Connecting to MQTT broker at mqtt://mosquitto:1883...
✅ Connected to MQTT broker!
📊 Publishing 7 room sensors every 10s
🏠 Rooms: 103, 104, 137, 214, 251, E10, E24, U07 (and 109 more)
🚀 Starting sensor simulation...

--- 14:32:15 ---
🌡️  Room 103: 21.5°C
🌡️  Room 104: 20.9°C
🌡️  Room 137: 21.8°C
🌡️  Room 214: 20.6°C
🌡️  Room 251: 20.1°C
🌡️  Room E10: 23.4°C
🌡️  Room E24: 22.7°C
🌡️  Room U07: 18.9°C
💨 Room 103 CO₂: 850 ppm
💨 Room 104 CO₂: 720 ppm
💨 Room 137 CO₂: 920 ppm
💨 Room 214 CO₂: 680 ppm
💨 Room 251 CO₂: 520 ppm
💨 Room E10 CO₂: 1150 ppm
💨 Room E24 CO₂: 780 ppm
💨 Room U07 CO₂: 480 ppm
```

## Patterns Explained

### Temperature
- **Night (0-6h)**: Base temperature -1°C
- **Morning (7-9h)**: Warming up as occupancy increases
- **Day (10-15h)**: Peak temperature (base +1°C)
- **Evening (16-23h)**: Cooling down

### CO₂
- **Empty room**: ~400-500 ppm (baseline)
- **Low occupancy**: ~500-700 ppm
- **Medium occupancy**: ~700-1000 ppm
- **High occupancy**: ~900-1400 ppm

## Stopping

```bash
# Stop with docker-compose
docker-compose down fake-sensors

# Or press Ctrl+C if running standalone
```
