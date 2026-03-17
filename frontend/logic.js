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

    let infoDiv = document.getElementById('room-info');
    if (infoDiv) infoDiv.remove();
    clickedObject = null;

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

    await Promise.all(roomMeshes.map(async (mesh) => {
        const roomTag = normalizeRoomName(mesh.name);
        const temp = await getRoomTemperature(roomTag);
        if (temp !== null && isHeatmapActive) {
            applyHeatmapColor(mesh, temp);
        }
    }));
};

function clearHeatmap() {
    if (!currentModel) return;
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

    // Clear old labels first
    clearHeatmap();

    if(currentModel) scene.remove(currentModel);
    currentModel = modelCache[id];
    scene.add(currentModel);

    if (id === 'ModelFull.gltf') {
        camera.position.set(100, 80, 100);
        isHeatmapActive = true; // Reset state so the toggle turns it back "on"
        window.updateBuildingHeatmap();
        clickedObject = null;
        document.getElementById('room-info').remove()

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

window.addEventListener('click', async (event) => {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObjects(scene.children, true);
    if (intersects.length > 0) {
        const obj = intersects[0].object;

        if (/^[EU12]/.test(obj.name)) {
            // Reset previous room
            if (clickedObject) clickedObject.material = baseMaterial;

            // Kill heatmap if user clicks a specific room
            if (isHeatmapActive) {
                clearHeatmap();
                isHeatmapActive = false;
                const heatBtn = document.getElementById('heatMapButton');
                if(heatBtn) heatBtn.innerHTML = 'show Heatmap';
            }

            clickedObject = obj;
            clickedObject.material = baseMaterial.clone();
            clickedObject.material.color.set(0xf1c40f); // Normal Yellow Highlight

            const roomTag = normalizeRoomName(obj.name);
            const temp = await getRoomTemperature(roomTag);
            let co2 = null;
            if (roomTag === '105') {
                co2 = await getRoomCO2();
            }
            displayRoomInfo(obj.name, roomTag, temp, co2);
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
      |> range(start: -20s)
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