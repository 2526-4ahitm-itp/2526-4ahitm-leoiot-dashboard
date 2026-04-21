const axios = require('axios');

// Configuration
const SOLAX_HOST = 'https://openapi-eu.solaxcloud.com';
const SOLAX_CLIENT_ID = 'b6d55e642b304989be96a3e0f0ce1793';
const SOLAX_CLIENT_SECRET = 'HCRctfp7_ezVhnIWlNrzO3--U_wFSjscVEhdQd5RpUI';
const SOLAX_USERNAME = 'm.remake';
const SOLAX_PASSWORD = 'Uniformed-Auction-Lanky1';
const SOLAX_PLANT_ID = '508819503377442';

// Inverters and Meter SNs
const INVERTER_SNS = ["X3G050J2826027", "X3G050J2806032", "X3G050J2826077", "8013T0020H0S01"];
const METER_SN = "240423171652";

const INFLUX_URL = 'http://influxdb:8086'; // Inside docker
// If running from host for testing, use http://localhost:8086
const INFLUX_URL_LOCAL = 'http://localhost:8086';
const INFLUX_TOKEN = 'ih3lGQ2dVqXG7ec0Ai-flUi5ZWTqp3AChtwI0fu4014-cn5h0MRE6-RcWtlL1yYGUaaSg6NOtcW_TEjQdGGA5A==';
const INFLUX_ORG = 'leoiot';
const INFLUX_BUCKET = 'server_data';

async function getSolaxToken() {
    try {
        const response = await axios.post(`${SOLAX_HOST}/openapi/auth/get_token`, {
            client_id: SOLAX_CLIENT_ID,
            client_secret: SOLAX_CLIENT_SECRET,
            grant_type: 'CICS',
            username: SOLAX_USERNAME,
            password: SOLAX_PASSWORD
        });
        return response.data.result.access_token;
    } catch (error) {
        console.error('Token error:', error.message);
        return null;
    }
}

async function fetchHistory(token, snList, deviceType, startTime, endTime) {
    try {
        const response = await axios.post(`${SOLAX_HOST}/openapi/v2/device/history_data`, {
            snList: snList,
            deviceType: deviceType,
            startTime: startTime.toString(),
            endTime: endTime.toString(),
            timeInterval: "300", // 5 minute intervals for history is plenty
            businessType: "4"
        }, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        return response.data.result || [];
    } catch (error) {
        console.error(`Fetch error (${deviceType}):`, error.message);
        return [];
    }
}

async function writeToInflux(points) {
    const influxUrl = process.env.IN_DOCKER ? INFLUX_URL : INFLUX_URL_LOCAL;
    const lines = points.map(p => {
        return `solax_stats,plant_id=${SOLAX_PLANT_ID} daily_yield=${p.yield},consumption=${p.consumption} ${p.timestamp * 1000000}`;
    });

    // Write in chunks of 500
    for (let i = 0; i < lines.length; i += 500) {
        const chunk = lines.slice(i, i + 500);
        try {
            await axios.post(`${influxUrl}/api/v2/write?org=${INFLUX_ORG}&bucket=${INFLUX_BUCKET}&precision=ns`, 
                chunk.join('\n'), 
                {
                    headers: {
                        'Authorization': `Token ${INFLUX_TOKEN}`,
                        'Content-Type': 'text/plain; charset=utf-8'
                    }
                }
            );
        } catch (e) {
            console.error('Influx error chunk:', e.message);
        }
    }
}

async function backfill() {
    const token = await getSolaxToken();
    if (!token) return;

    const now = Math.floor(Date.now() / 1000);
    const sevenDaysAgo = now - (7 * 24 * 3600);
    const step = 12 * 3600; // 12h steps

    console.log(`Starting backfill from ${new Date(sevenDaysAgo * 1000).toLocaleString()}...`);

    for (let start = sevenDaysAgo; start < now; start += step) {
        let end = Math.min(start + step, now);
        console.log(`Processing chunk: ${new Date(start * 1000).toLocaleTimeString()} to ${new Date(end * 1000).toLocaleTimeString()}...`);

        // Fetch Inverter History (Sum of all 4)
        const invHistory = await fetchHistory(token, INVERTER_SNS, "1", start, end);
        // Fetch Meter History (Grid Import/Export)
        const meterHistory = await fetchHistory(token, [METER_SN], "3", start, end);

        // Process points
        // History data is usually a list of records. We need to align them by timestamp.
        const pointsByTime = {};

        invHistory.forEach(record => {
            const ts = Math.floor(new Date(record.uploadTime).getTime() / 1000);
            if (!pointsByTime[ts]) pointsByTime[ts] = { yield: 0, import: 0, export: 0, timestamp: ts };
            pointsByTime[ts].yield += (record.yieldToday || 0);
        });

        meterHistory.forEach(record => {
            const ts = Math.floor(new Date(record.uploadTime).getTime() / 1000);
            if (!pointsByTime[ts]) pointsByTime[ts] = { yield: 0, import: 0, export: 0, timestamp: ts };
            // For meter, we need import/export to calculate consumption
            pointsByTime[ts].import = record.importEnergyDay || 0;
            pointsByTime[ts].export = record.exportEnergyDay || 0;
        });

        const points = Object.values(pointsByTime).map(p => ({
            ...p,
            consumption: Math.max(0, p.yield - p.export + p.import)
        }));

        if (points.length > 0) {
            await writeToInflux(points);
            console.log(`  Wrote ${points.length} points.`);
        }

        // Sleep to avoid hitting rate limits too hard
        await new Promise(r => setTimeout(r, 2000));
    }

    console.log('Backfill complete!');
}

backfill();
