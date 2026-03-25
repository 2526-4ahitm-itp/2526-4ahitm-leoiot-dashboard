import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

/** * 1. SCENE SETUP
 **/
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x3a3d42); // Lightened architectural grey

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 100000);
camera.position.set(100, 80, 100);

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
document.body.appendChild(renderer.domElement);

// Label Renderer (for 3D Text)
const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(window.innerWidth, window.innerHeight);
labelRenderer.domElement.style.position = 'absolute';
labelRenderer.domElement.style.top = '0px';
labelRenderer.domElement.style.pointerEvents = 'none'; // Allows clicking through labels
document.body.appendChild(labelRenderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);

/** * 2. LIGHTING
 **/
const ambientLight = new THREE.AmbientLight(0xffffff, 1.4);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(200, 300, 100);
directionalLight.castShadow = true;
directionalLight.shadow.bias = -0.0005;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
scene.add(directionalLight);

/** * 3. MATERIALS
 **/
const baseMaterial = new THREE.MeshStandardMaterial({
    color: 0xdddddd,
    roughness: 0.9,
    metalness: 0.0
});

const metalMaterial = new THREE.MeshStandardMaterial({
    color: 0xbcbcbc,
    metalness: 0.35,
    roughness: 0.4
});

const glassMaterial = new THREE.MeshStandardMaterial({
    color: 0x88aabb,
    roughness: 0.1,
    metalness: 0.5,
    transparent: true,
    opacity: 0.3
});

/** * 4. MODEL LOADING & CACHE
 **/
const modelIds = ['ModelU.gltf','ModelE.gltf','Model1F.gltf','Model2F.gltf','ModelFull.gltf'];
const modelCache = {};
let currentModel = null;
let clickedObject = null;
let isHeatmapActive = false;

function setHeatmapButtonState(modelId) {
    const btn = document.getElementById('heatMapButton');
    if (!btn) return;

    const enabled = modelId !== 'ModelFull.gltf';
    btn.disabled = !enabled;

    btn.classList.toggle('heatmap-enabled', enabled);
    btn.classList.toggle('heatmap-disabled', !enabled);
    btn.title = enabled ? '' : 'Heatmap is available on single-floor views only';

    if (!enabled) {
        // Force heatmap off for full-building view.
        if (isHeatmapActive) {
            clearHeatmap();
            isHeatmapActive = false;
        }
        btn.innerHTML = 'Show Heatmap';
    }
}

const loader = new GLTFLoader();

const loadPromises = modelIds.map(id => {
    return new Promise((resolve, reject) => {
        loader.load(`./${id}`, (gltf) => {
            modelCache[id] = gltf.scene;
            modelCache[id].traverse(child => {
                if(child.isMesh){
                    child.castShadow = true;
                    child.receiveShadow = true;
                    if(child.name.includes('GLAS')) child.material = glassMaterial;
                    else if(child.name.includes('METALL') || child.name.includes('FENSTERRAHMEN')) child.material = metalMaterial;
                    else child.material = baseMaterial;
                }
            });
            if (id === 'ModelFull.gltf') {
                currentModel = gltf.scene;
                scene.add(currentModel);
            }
            resolve();
        }, undefined, reject);
    });
});

Promise.all(loadPromises).then(() => {
    document.getElementById('loading').style.display = 'none';

    // Initial view is the full building model.
    setHeatmapButtonState('ModelFull.gltf');
});

/** * 5. HEATMAP & LABELS
 **/
function addTempLabel(mesh, temp) {
    const tempDiv = document.createElement('div');
    tempDiv.className = 'temp-label';
    tempDiv.style.color = '#ffffff';
    tempDiv.style.backgroundColor = 'rgba(0,0,0,0.6)';
    tempDiv.style.padding = '2px 6px';
    tempDiv.style.borderRadius = '4px';
    tempDiv.style.fontFamily = 'sans-serif';
    tempDiv.style.fontSize = '12px';
    tempDiv.textContent = `${temp.toFixed(1)}°C`;

    const label = new CSS2DObject(tempDiv);
    label.name = 'tempLabel';

    const box = new THREE.Box3().setFromObject(mesh);
    const center = new THREE.Vector3();
    box.getCenter(center);
    label.position.copy(center);
    mesh.add(label);
}

function applyHeatmapColor(mesh, temp) {
    const minTemp = 20;
    const maxTemp = 25;
    const t = Math.max(0, Math.min(1, (temp - minTemp) / (maxTemp - minTemp)));

    const colorHot = new THREE.Color(0xd68d8d); // Muted Red
    const colorCold = new THREE.Color(0x8da1d6); // Muted Blue
    const finalColor = colorCold.clone().lerp(colorHot, t);

    mesh.material = baseMaterial.clone();
    mesh.material.color.copy(finalColor);
    mesh.material.transparent = false;
    mesh.material.opacity = 1.0;

    addTempLabel(mesh, temp);
}

function updateHeatmapMesh(mesh, temp) {
    const minTemp = 20;
    const maxTemp = 25;
    const t = Math.max(0, Math.min(1, (temp - minTemp) / (maxTemp - minTemp)));

    const colorHot = new THREE.Color(0xd68d8d); // Muted Red
    const colorCold = new THREE.Color(0x8da1d6); // Muted Blue
    const finalColor = colorCold.clone().lerp(colorHot, t);

    // Update/ensure a cloned material for heatmap
    if (mesh.material === baseMaterial || mesh.material === glassMaterial || mesh.material === metalMaterial) {
        mesh.material = baseMaterial.clone();
    }
    mesh.material.color.copy(finalColor);
    mesh.material.transparent = false;
    mesh.material.opacity = 1.0;

    const label = mesh.getObjectByName('tempLabel');
    if (label && label.element) {
        label.element.textContent = `${temp.toFixed(1)}°C`;
    } else {
        addTempLabel(mesh, temp);
    }
}

window.updateBuildingHeatmap = async () => {
    if (!currentModel) return;
    const btn = document.getElementById('heatMapButton');

    if (isHeatmapActive) {
        btn.innerHTML = 'show Heatmap';
        clearHeatmap();
        isHeatmapActive = false;
        return;
    }

    // Determine which floor prefix to look for based on the current model's ID
    // We look for the first character of the filename (U, E, 1, 2)
    // If it's ModelFull, we show everything.
    let activePrefix = null;
    const currentModelId = Object.keys(modelCache).find(key => modelCache[key] === currentModel);

    if (currentModelId && currentModelId !== 'ModelFull.gltf') {
        // Extracts 'E' from 'ModelE.gltf' or '1' from 'Model1F.gltf'
        activePrefix = currentModelId.replace('Model', '').charAt(0);
    }

    // Entering heatmap mode hides the single-room panel/selection.
    const infoDiv = document.getElementById('room-info');
    if (infoDiv) infoDiv.remove();
    if (clickedObject) clickedObject.material = baseMaterial;
    clickedObject = null;
    selectedRoomTag = null;
    selectedObjectName = null;

    // Heatmap should only stream rooms for the active floor.
    wantedRooms.clear();
    reconcileRoomSubscriptions();

    isHeatmapActive = true;
    btn.innerHTML = 'clear Heatmap';

    const roomMeshes = [];
    currentModel.traverse(child => {
        if (child.isMesh) {
            const name = child.name;
            // Filter: Must be a room mesh AND match the current floor prefix
            const isRoom = /^[EU12]/.test(name);
            const matchesFloor = !activePrefix || name.startsWith(activePrefix);

            if (isRoom && matchesFloor) {
                roomMeshes.push(child);
            }
        }
    });

    heatmapMeshesByRoom.clear();

    // Build room -> meshes mapping first so we can batch subscriptions.
    const roomsToSubscribe = new Set();
    for (const mesh of roomMeshes) {
        const roomTag = normalizeRoomName(mesh.name);
        if (!roomTag) continue;

        const list = heatmapMeshesByRoom.get(roomTag) || [];
        list.push(mesh);
        heatmapMeshesByRoom.set(roomTag, list);
        roomsToSubscribe.add(roomTag);
    }

    // Ensure we receive live updates for all heatmap rooms (batch).
    for (const room of roomsToSubscribe) wantedRooms.add(room);
    reconcileRoomSubscriptions();

    await Promise.all(roomMeshes.map(async (mesh) => {
        const roomTag = normalizeRoomName(mesh.name);
        if (!roomTag) return;

        const live = latestLive.get(roomTag);
        const temp = (live && live.temp != null) ? live.temp : await getRoomTemperature(roomTag);
        if (temp !== null && isHeatmapActive) {
            updateHeatmapMesh(mesh, temp);
        }
    }));
};

function clearHeatmap() {
    if (!currentModel) return;
    heatmapMeshesByRoom.clear();
    // Drop heatmap subscriptions, but keep the selected room.
    for (const room of Array.from(wantedRooms)) {
        if (room !== selectedRoomTag) {
            wantedRooms.delete(room);
        }
    }
    reconcileRoomSubscriptions();
    // We traverse everything to ensure all labels are nuked
    currentModel.traverse(child => {
        if (child.isMesh) {
            // If it has a cloned material, reset it
            if (child.material !== baseMaterial && child.material !== glassMaterial && child.material !== metalMaterial) {
                child.material = baseMaterial;
            }
            // Remove the 3D label
            const label = child.getObjectByName('tempLabel');
            if (label) child.remove(label);
        }
    });
}

/** * 6. UI & NAVIGATION
 **/
window.showOnly = (id) => {
    if(!modelCache[id]) return;

    setHeatmapButtonState(id);

    // Clear room selection and panel when switching floors.
    if (clickedObject) clickedObject.material = baseMaterial;
    clickedObject = null;
    selectedRoomTag = null;
    selectedObjectName = null;
    const infoDiv = document.getElementById('room-info');
    if (infoDiv) infoDiv.remove();
    // Unsubscribe from any previously selected room.
    wantedRooms.clear();
    reconcileRoomSubscriptions();

    // Clear old labels first
    clearHeatmap();

    if(currentModel) scene.remove(currentModel);
    currentModel = modelCache[id];
    scene.add(currentModel);

    if (id === 'ModelFull.gltf') {
        camera.position.set(100, 80, 100);
    }

    // If heatmap was already on, refresh it for the new floor
    if (isHeatmapActive) {
        isHeatmapActive = false; // Reset state so the toggle turns it back "on"
        window.updateBuildingHeatmap();
    }

};

window.handleButtonClick = (buttonElement, modelId) => {
    const container = document.getElementById('button-container');
    const buttons = container.querySelectorAll('button');
    buttons.forEach(btn => btn.classList.remove('active'));
    if (modelId !== 'ModelFull.gltf') buttonElement.classList.add('active');
    window.showOnly(modelId);
};

/** * 7. INTERACTION (RAYCASTING)
 **/
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

/**
 * Live pub/sub (WebSocket) for hover updates.
 * This is additive; existing InfluxDB fetch-on-click stays in place.
 */
const LIVE_WS_URL = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.hostname + ':8090';
let liveWs = null;
let liveWsConnected = false;
const wantedRooms = new Set();
const subscribedRooms = new Set();

// Heatmap live update support
// heatmapMeshesByRoom[room] = Mesh[] currently displayed in heatmap
const heatmapMeshesByRoom = new Map();

// latestLive[room] = { temp: number|null, co2: number|null, ts: number|null }
const latestLive = new Map();

function ensureLiveWs() {
    if (liveWs && (liveWs.readyState === WebSocket.OPEN || liveWs.readyState === WebSocket.CONNECTING)) return;

    liveWsConnected = false;
    liveWs = new WebSocket(LIVE_WS_URL);

    liveWs.addEventListener('open', () => {
        liveWsConnected = true;
        // Reconcile subscriptions after reconnect.
        subscribedRooms.clear();
        reconcileRoomSubscriptions();
    });

    liveWs.addEventListener('close', () => {
        liveWsConnected = false;
        // Retry with a small delay
        setTimeout(() => ensureLiveWs(), 1500);
    });

    liveWs.addEventListener('error', () => {
        // Let close handler trigger reconnect
    });

    liveWs.addEventListener('message', (event) => {
        let msg;
        try {
            msg = JSON.parse(event.data);
        } catch {
            return;
        }
        if (!msg || typeof msg !== 'object') return;

        const room = typeof msg.room === 'string' ? msg.room : null;
        if (!room) return;

        const state = latestLive.get(room) || { temp: null, co2: null, ts: null };
        if (msg.type === 'temp' && Number.isFinite(msg.value)) {
            state.temp = msg.value;
            state.ts = msg.ts || Date.now();
            latestLive.set(room, state);

            // If heatmap is active, update any meshes for this room.
            if (isHeatmapActive) {
                const meshes = heatmapMeshesByRoom.get(room);
                if (meshes && meshes.length) {
                    for (const mesh of meshes) {
                        updateHeatmapMesh(mesh, msg.value);
                    }
                }
            }
        } else if (msg.type === 'co2' && Number.isFinite(msg.value)) {
            state.co2 = msg.value;
            state.ts = msg.ts || Date.now();
            latestLive.set(room, state);
        } else {
            return;
        }

        // If the user selected that room, update the panel immediately.
        if (selectedRoomTag && selectedRoomTag === room && selectedObjectName) {
            updateRoomInfoPanel(selectedObjectName, selectedRoomTag);
        }
    });
}

function reconcileRoomSubscriptions() {
    ensureLiveWs();
    if (!liveWsConnected || !liveWs || liveWs.readyState !== WebSocket.OPEN) return;

    // Subscribe new rooms
    for (const room of wantedRooms) {
        if (subscribedRooms.has(room)) continue;
        liveWs.send(JSON.stringify({ type: 'subscribe', room }));
        subscribedRooms.add(room);
    }

    // Unsubscribe removed rooms
    for (const room of Array.from(subscribedRooms)) {
        if (wantedRooms.has(room)) continue;
        liveWs.send(JSON.stringify({ type: 'unsubscribe', room }));
        subscribedRooms.delete(room);
    }
}

function wantRoom(room) {
    if (!room) return;
    wantedRooms.add(room);
    reconcileRoomSubscriptions();
}

function unwantRoom(room) {
    if (!room) return;
    wantedRooms.delete(room);
    reconcileRoomSubscriptions();
}

let selectedRoomTag = null;
let selectedObjectName = null;

window.addEventListener('click', async (event) => {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObjects(scene.children, true);
    if (intersects.length > 0) {
        const obj = intersects[0].object;

        if (/^[EU12]/.test(obj.name)) {
            const roomTag = normalizeRoomName(obj.name);

            // If heatmap is active, clicking a room should behave like "Clear Heatmap"
            // and then switch to single-room highlight/value view.
            if (isHeatmapActive) {
                clearHeatmap();
                isHeatmapActive = false;
                const heatBtn = document.getElementById('heatMapButton');
                if (heatBtn) heatBtn.innerHTML = 'Show Heatmap';

                // Drop all heatmap room subscriptions; we'll re-add the clicked room below.
                wantedRooms.clear();
                reconcileRoomSubscriptions();
            }

            // Reset previous room
            if (clickedObject) clickedObject.material = baseMaterial;

            clickedObject = obj;
            clickedObject.material = baseMaterial.clone();
            clickedObject.material.color.set(0xf1c40f); // Normal Yellow Highlight

            // Live pub/sub: keep updating while selected.
            if (selectedRoomTag) {
                // If heatmap is active and the previous selection is part of the heatmap,
                // keep it subscribed for heatmap live updates.
                const keepForHeatmap = isHeatmapActive && heatmapMeshesByRoom.has(selectedRoomTag);
                if (!keepForHeatmap) unwantRoom(selectedRoomTag);
            }
            selectedRoomTag = roomTag;
            selectedObjectName = obj.name;
            wantRoom(roomTag);

            // Keep existing Influx path (do not remove/change it)
            const temp = await getRoomTemperature(roomTag);
            let co2 = null;
            if (roomTag === '105') {
                co2 = await getRoomCO2();
            }

            // Prefer live cached values if present; otherwise show Influx result.
            const live = latestLive.get(roomTag);
            if (live && (live.temp != null || live.co2 != null)) {
                updateRoomInfoPanel(obj.name, roomTag);
            } else {
                displayRoomInfo(obj.name, roomTag, temp, co2);
            }
        }
    }
});

/** * 8. DATA FETCHING (INFLUXDB)
 **/
const INFLUXDB_URL = 'http://localhost:8086';
const INFLUXDB_TOKEN = 'ih3lGQ2dVqXG7ec0Ai-flUi5ZWTqp3AChtwI0fu4014-cn5h0MRE6-RcWtlL1yYGUaaSg6NOtcW_TEjQdGGA5A==';
const INFLUXDB_ORG = 'leoiot';
const INFLUXDB_BUCKET = 'server_data';

async function getRoomTemperature(roomName) {
    const query = `from(bucket: "${INFLUXDB_BUCKET}")
      |> range(start: -24h)
      |> filter(fn: (r) => r._measurement == "room_temperature" and r.room == "${roomName}")
      |> filter(fn: (r) => r._field == "temperature")
      |> last()`;

    try {
        const response = await fetch(`${INFLUXDB_URL}/api/v2/query?org=${INFLUXDB_ORG}`, {
            method: 'POST',
            headers: {
                'Authorization': `Token ${INFLUXDB_TOKEN}`,
                'Content-Type': 'application/vnd.flux',
                'Accept': 'application/csv'
            },
            body: query
        });
        if (!response.ok) return null;
        const csvData = await response.text();
        const lines = csvData.trim().split('\n');
        if (lines.length > 1) {
            const dataLine = lines[lines.length - 1];
            const columns = dataLine.split(',');
            const headers = lines[0].split(',');
            const valueIndex = headers.indexOf('_value');
            if (valueIndex !== -1 && columns[valueIndex]) return parseFloat(columns[valueIndex]);
        }
        return null;
    } catch (error) {
        return null;
    }
}

async function getRoomCO2() {
    const topic = "nili3/sensor/nili3_co2/state";
    const query = `from(bucket: "${INFLUXDB_BUCKET}")
      |> range(start: -5s)
      |> filter(fn: (r) => r._measurement == "mqtt_consumer" and r.topic == "${topic}")
      |> filter(fn: (r) => r._field == "value")
      |> last()`;

    try {
        const response = await fetch(`${INFLUXDB_URL}/api/v2/query?org=${INFLUXDB_ORG}`, {
            method: 'POST',
            headers: {
                'Authorization': `Token ${INFLUXDB_TOKEN}`,
                'Content-Type': 'application/vnd.flux',
                'Accept': 'application/csv'
            },
            body: query
        });
        if (!response.ok) return null;
        const csvData = await response.text();
        const lines = csvData.trim().split('\n');
        if (lines.length > 1) {
            const dataLine = lines[lines.length - 1];
            const columns = dataLine.split(',');
            const headers = lines[0].split(',');
            const valueIndex = headers.indexOf('_value');
            if (valueIndex !== -1 && columns[valueIndex]) return parseFloat(columns[valueIndex]);
        }
        return null;
    } catch (error) {
        return null;
    }
}

function normalizeRoomName(objectName) {
    if (!objectName) return objectName;
    let name = String(objectName).trim().split('_')[0];
    if (/^U\d{3}$/.test(name)) name = `U${name.substring(1, 3)}`;
    return name;
}

function displayRoomInfo(objectName, roomTag, temperature, co2) {
    let infoDiv = document.getElementById('room-info');
    if (!infoDiv) {
        infoDiv = document.createElement('div');
        infoDiv.id = 'room-info';
        infoDiv.style.position = 'fixed';
        infoDiv.style.top = '20px';
        infoDiv.style.right = '20px';
        infoDiv.style.padding = '15px';
        infoDiv.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
        infoDiv.style.color = '#333';
        infoDiv.style.borderRadius = '8px';
        infoDiv.style.fontFamily = 'sans-serif';
        infoDiv.style.zIndex = '1000';
        infoDiv.style.border = '1px solid #ccc';
        document.body.appendChild(infoDiv);
    }
    const tempText = temperature !== null ? `${temperature.toFixed(1)}°C` : 'No data';
    let content = `<strong>Room:</strong> ${objectName}<br><strong>Tag:</strong> ${roomTag}<br><strong>Temp:</strong> ${tempText}`;
    
    if (co2 !== null) {
        content += `<br><strong>CO2:</strong> ${co2.toFixed(0)} ppm`;
    } else if (roomTag === '105') {
        content += `<br><strong>CO2:</strong> No data`;
    }
    
    infoDiv.innerHTML = content;
}

function updateRoomInfoPanel(objectName, roomTag) {
    const live = latestLive.get(roomTag) || { temp: null, co2: null, ts: null };
    const temp = (live.temp !== null && live.temp !== undefined) ? live.temp : null;
    const co2 = (live.co2 !== null && live.co2 !== undefined) ? live.co2 : null;
    displayRoomInfo(objectName, roomTag, temp, co2);
}

/** * 9. RENDER LOOP
 **/
function animate(){
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera); // Render the 3D labels
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    labelRenderer.setSize(window.innerWidth, window.innerHeight);
});

animate();
