import mqtt from 'mqtt';
import { WebSocketServer } from 'ws';

const MQTT_HOST = process.env.MQTT_HOST || 'mosquitto';
const MQTT_PORT = process.env.MQTT_PORT || '1883';
const WS_PORT = parseInt(process.env.WS_PORT || '8090', 10);

const MQTT_URL = `mqtt://${MQTT_HOST}:${MQTT_PORT}`;

// Cache latest values per room
// rooms[room] = { temp: { value, ts }, co2: { value, ts } }
const rooms = new Map();

function nowTs() {
  return Date.now();
}

function getRoomState(room) {
  if (!rooms.has(room)) rooms.set(room, {});
  return rooms.get(room);
}

function parseRoomTemperatureMessage(payload) {
  // expected: { room: "105", temperature: 21.2 }
  let obj;
  try {
    obj = JSON.parse(payload);
  } catch {
    return null;
  }
  if (!obj || typeof obj !== 'object') return null;
  const room = typeof obj.room === 'string' ? obj.room.trim() : null;
  const value = typeof obj.temperature === 'number' ? obj.temperature : Number(obj.temperature);
  if (!room || !Number.isFinite(value)) return null;
  return { room, value };
}

function parseRoomFromCo2Topic(topic) {
  // fake-sensors: nili3/sensor/<roomid lower>_co2/state
  // Example: nili3/sensor/105_co2/state -> room 105
  // Example: nili3/sensor/e10_co2/state -> room E10
  const m = topic.match(/^nili3\/sensor\/([^/]+)_co2\/state$/);
  if (!m) return null;
  const raw = m[1];
  if (!raw) return null;
  const upper = raw.toUpperCase();
  return upper;
}

function parseFloatPayload(payload) {
  const v = Number(String(payload).trim());
  return Number.isFinite(v) ? v : null;
}

// WS: room subscriptions
const wss = new WebSocketServer({ port: WS_PORT });

// ws -> Set(room)
const subscriptions = new Map();

function safeSend(ws, obj) {
  if (ws.readyState !== ws.OPEN) return;
  ws.send(JSON.stringify(obj));
}

function broadcastToRoom(room, message) {
  for (const [ws, roomsSet] of subscriptions.entries()) {
    if (!roomsSet || roomsSet.size === 0) continue;
    if (roomsSet.has(room)) safeSend(ws, message);
  }
}

function sendSnapshot(ws, room) {
  const state = rooms.get(room);
  if (!state) return;
  if (state.temp) {
    safeSend(ws, { type: 'temp', room, value: state.temp.value, ts: state.temp.ts, snapshot: true });
  }
  if (state.co2) {
    safeSend(ws, { type: 'co2', room, value: state.co2.value, ts: state.co2.ts, snapshot: true });
  }
}

wss.on('connection', (ws) => {
  subscriptions.set(ws, new Set());
  safeSend(ws, { type: 'hello', wsPort: WS_PORT });

  ws.on('message', (data) => {
    let msg;
    try {
      msg = JSON.parse(String(data));
    } catch {
      return;
    }
    if (!msg || typeof msg !== 'object') return;

    const type = msg.type;
    if (type === 'subscribe') {
      const room = typeof msg.room === 'string' ? msg.room.trim() : '';
      if (!room) return;
      subscriptions.get(ws).add(room);
      safeSend(ws, { type: 'subscribed', room });
      sendSnapshot(ws, room);
      return;
    }
    if (type === 'unsubscribe') {
      const room = typeof msg.room === 'string' ? msg.room.trim() : '';
      if (!room) return;
      subscriptions.get(ws).delete(room);
      safeSend(ws, { type: 'unsubscribed', room });
      return;
    }
    if (type === 'unsubscribeAll') {
      subscriptions.get(ws).clear();
      safeSend(ws, { type: 'unsubscribedAll' });
    }
  });

  ws.on('close', () => {
    subscriptions.delete(ws);
  });
});

console.log(`[mqtt-ws-bridge] WS server listening on :${WS_PORT}`);

// MQTT client
const mqttClient = mqtt.connect(MQTT_URL, {
  reconnectPeriod: 1000,
});

mqttClient.on('connect', () => {
  console.log(`[mqtt-ws-bridge] Connected to MQTT at ${MQTT_URL}`);
  mqttClient.subscribe(['room-temperature', 'nili3/sensor/#'], { qos: 0 }, (err) => {
    if (err) console.error('[mqtt-ws-bridge] Subscribe error:', err.message);
    else console.log('[mqtt-ws-bridge] Subscribed to room-temperature + nili3/sensor/#');
  });
});

mqttClient.on('message', (topic, payloadBuf) => {
  const payload = payloadBuf.toString('utf8');
  const ts = nowTs();

  if (topic === 'room-temperature') {
    const parsed = parseRoomTemperatureMessage(payload);
    if (!parsed) return;

    const { room, value } = parsed;
    const state = getRoomState(room);
    state.temp = { value, ts };

    broadcastToRoom(room, { type: 'temp', room, value, ts });
    return;
  }

  const co2Room = parseRoomFromCo2Topic(topic);
  if (co2Room) {
    const value = parseFloatPayload(payload);
    if (value === null) return;

    const state = getRoomState(co2Room);
    state.co2 = { value, ts };
    broadcastToRoom(co2Room, { type: 'co2', room: co2Room, value, ts, topic });
  }
});

mqttClient.on('reconnect', () => console.log('[mqtt-ws-bridge] MQTT reconnecting...'));
mqttClient.on('error', (err) => console.error('[mqtt-ws-bridge] MQTT error:', err.message));
