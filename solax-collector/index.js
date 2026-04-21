const axios = require('axios');

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
            // Token usually valid for 30 days, we'll just keep it in memory for now
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
        } else {
            console.error('[Collector] Data fetch error:', response.data);
            // 10401 = Token expired, 10402 = Invalid token
            if (response.data.code === 10401 || response.data.code === 10402) {
                console.log('[Collector] Clearing invalid token...');
                cachedToken = null; 
            }
        }
    } catch (error) {
        console.error('[Collector] Error fetching data:', error.message);
    }
}

async function writeToInflux(data, consumption) {
    const timestamp = new Date().getTime() * 1000000; // Nanoseconds
    
    // Line protocol format
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
