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

async function fetchHistory(token, snList, deviceType, startTimeMs, endTimeMs) {
    try {
        const response = await axios.get(`${SOLAX_HOST}/openapi/v2/device/history_data`, {
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            data: {
                snList: snList,
                deviceType: deviceType,
                startTime: startTimeMs.toString(),
                endTime: endTimeMs.toString(),
                timeInterval: "5", // 5 minute intervals (unit is minutes, not seconds!)
                businessType: "4"
            }
        });
        return response.data.result || [];
    } catch (error) {
        console.error(`Fetch error (${deviceType}):`, error.message);
        return [];
    }
}

async function writeToInflux(points) {
    const influxUrl = process.env.INFLUX_URL || INFLUX_URL;
    const lines = points.map(p => {
        return `solax_stats,plant_id=${SOLAX_PLANT_ID} daily_yield=${Number(p.yield).toFixed(2)},consumption=${Number(p.consumption).toFixed(2)} ${p.timestamp}000000000`;
    });

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
            console.error('Influx error chunk:', e.response ? JSON.stringify(e.response.data) : e.message);
            // Log the first line of the failing chunk to see the format
            if (chunk.length > 0) {
                console.error('First line of failing chunk:', chunk[0]);
            }
        }
    }
}

async function backfill() {
    const token = await getSolaxToken();
    if (!token) return;

    const nowSec = Math.floor(Date.now() / 1000);
    const sevenDaysAgoSec = nowSec - (7 * 24 * 3600);
    const stepSec = 11 * 3600; // 11h steps to be safe within 12h limit

    console.log(`Starting backfill from ${new Date(sevenDaysAgoSec * 1000).toLocaleString()}...`);

    let dayBases = {};

    for (let start = sevenDaysAgoSec; start < nowSec; start += stepSec) {
        let end = Math.min(start + stepSec, nowSec);
        console.log(`Processing chunk: ${new Date(start * 1000).toLocaleTimeString()} to ${new Date(end * 1000).toLocaleTimeString()}...`);

        const startMs = start * 1000;
        const endMs = end * 1000;

        const invHistory = await fetchHistory(token, INVERTER_SNS, "1", startMs, endMs);
        const meterHistory = await fetchHistory(token, [METER_SN], "3", startMs, endMs);

        console.log(`  Fetched ${invHistory.length} inverter records and ${meterHistory.length} meter records.`);

        const pointsByTime = {};

        invHistory.forEach(record => {
            if (!record.dataTime) return;
            const ts = Math.floor(new Date(record.dataTime).getTime() / 1000);
            if (!pointsByTime[ts]) pointsByTime[ts] = { yield: 0, import: 0, export: 0, timestamp: ts };
            pointsByTime[ts].yield += (record.dailyYield || 0);
        });

        meterHistory.forEach(record => {
            if (!record.dataTime) return;
            const ts = Math.floor(new Date(record.dataTime).getTime() / 1000);
            if (!pointsByTime[ts]) pointsByTime[ts] = { yield: 0, import: 0, export: 0, timestamp: ts };
            
            const dayStr = new Date(ts * 1000).toISOString().split('T')[0];
            if (!dayBases[dayStr]) {
                dayBases[dayStr] = { import: record.importEnergy || 0, export: record.exportEnergy || 0 };
            }
            
            const dailyImport = (record.importEnergy || 0) - dayBases[dayStr].import;
            const dailyExport = (record.exportEnergy || 0) - dayBases[dayStr].export;
            
            pointsByTime[ts].import = Math.max(0, dailyImport);
            pointsByTime[ts].export = Math.max(0, dailyExport);
        });

        const points = Object.values(pointsByTime).map(p => ({
            ...p,
            consumption: Math.max(0, p.yield - p.export + p.import)
        }));

        if (points.length > 0) {
            await writeToInflux(points);
            console.log(`  Wrote ${points.length} points.`);
        }

        await new Promise(r => setTimeout(r, 2000));
    }

    console.log('Backfill complete!');
}

backfill();
