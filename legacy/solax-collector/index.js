const axios = require('axios');
const mqtt  = require('mqtt');

// Configuration from environment variables
const SOLAX_HOST = 'https://openapi-eu.solaxcloud.com';
const SOLAX_CLIENT_ID = process.env.SOLAX_CLIENT_ID || 'b6d55e642b304989be96a3e0f0ce1793';
const SOLAX_CLIENT_SECRET = process.env.SOLAX_CLIENT_SECRET || 'HCRctfp7_ezVhnIWlNrzO3--U_wFSjscVEhdQd5RpUI';
const SOLAX_USERNAME = process.env.SOLAX_USERNAME || 'm.remake';
const SOLAX_PASSWORD = process.env.SOLAX_PASSWORD || 'Uniformed-Auction-Lanky1';
const SOLAX_PLANT_ID = process.env.SOLAX_PLANT_ID || '508819503377442';

const INFLUX_URL = process.env.INFLUX_URL || 'http://influxdb:8086';
const INFLUX_TOKEN = process.env.INFLUX_TOKEN || 'ih3lGQ2dVqXG7ec0Ai-flUi5ZWTqp3AChtwI0fu4014-cn5h0MRE6-RcWtlL1yYGUaaSg6NOtcW_TEjQdGGA5A==';
const INFLUX_ORG = process.env.INFLUX_ORG || 'leoiot';
const INFLUX_BUCKET = process.env.INFLUX_BUCKET || 'server_data';

const MQTT_HOST = process.env.MQTT_HOST || 'mosquitto';
const MQTT_PORT = process.env.MQTT_PORT || '1883';
const PV_TOPIC  = 'leoenergy/solax_pv/overall_inverter';

const mqttClient = mqtt.connect(`mqtt://${MQTT_HOST}:${MQTT_PORT}`, {
  username: 'leoiot',
  password: 'leogreen',
  reconnectPeriod: 5000,
});
mqttClient.on('connect', () => console.log(`[Collector] MQTT connected to ${MQTT_HOST}:${MQTT_PORT}`));
mqttClient.on('error',   (err) => console.error('[Collector] MQTT error:', err.message));

let cachedToken = null;

async function getSolaxToken() {
    if (cachedToken) return cachedToken;
    console.log('[Collector] Fetching new Solax token...');
    try {
        const response = await axios.post(`${SOLAX_HOST}/openapi/auth/get_token`, {
            client_id: SOLAX_CLIENT_ID,
            client_secret: SOLAX_CLIENT_SECRET,
            grant_type: 'CICS',
            username: SOLAX_USERNAME,
            password: SOLAX_PASSWORD
        });
        if (response.data.code === 0) {
            cachedToken = response.data.result.access_token;
            return cachedToken;
        }
        console.error('[Collector] Token error:', response.data);
    } catch (error) {
        console.error('[Collector] Error fetching token:', error.message);
    }
    return null;
}

async function collectData() {
    const token = await getSolaxToken();
    if (!token) return;

    try {
        const url = `${SOLAX_HOST}/openapi/v2/plant/realtime_data?plantId=${SOLAX_PLANT_ID}&businessType=4`;
        const response = await axios.get(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.data.code === 10000) {
            const data = response.data.result;
            const consumption = data.dailyYield - data.dailyExported + data.dailyImported;

            console.log(`[Collector] Data fetched at ${data.plantLocalTime}: Yield=${data.dailyYield}, Consumption=${consumption}`);

            await writeToInflux(data, consumption);
            publishToMqtt(data);
        } else {
            console.error('[Collector] Data fetch error:', response.data);
            if (response.data.code === 10401 || response.data.code === 10402) {
                console.log('[Collector] Clearing invalid token...');
                cachedToken = null;
            }
        }
    } catch (error) {
        console.error('[Collector] Error fetching data:', error.message);
    }
}

function publishToMqtt(data) {
    if (mqttClient.connected) {
        mqttClient.publish(PV_TOPIC, JSON.stringify(data), { qos: 0, retain: true });
        console.log('[Collector] Published PV data to MQTT');
    }
}

async function writeToInflux(data, consumption) {
    const timestamp = new Date().getTime() * 1000000; // Nanoseconds

    const lines = [
        `solax_stats,plant_id=${SOLAX_PLANT_ID} daily_yield=${data.dailyYield},total_yield=${data.totalYield},consumption=${consumption},daily_charged=${data.dailyCharged},daily_discharged=${data.dailyDischarged},daily_imported=${data.dailyImported},daily_exported=${data.dailyExported} ${timestamp}`
    ];

    try {
        await axios.post(`${INFLUX_URL}/api/v2/write?org=${INFLUX_ORG}&bucket=${INFLUX_BUCKET}&precision=ns`,
            lines.join('\n'),
            {
                headers: {
                    'Authorization': `Token ${INFLUX_TOKEN}`,
                    'Content-Type': 'text/plain; charset=utf-8'
                }
            }
        );
        console.log('[Collector] Successfully wrote to InfluxDB');
    } catch (error) {
        console.error('[Collector] Error writing to InfluxDB:', error.response ? error.response.data : error.message);
    }
}

// Initial run
collectData();

// Run every 1 minute
setInterval(collectData, 1 * 60 * 1000);
