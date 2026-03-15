import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050505);

// Set far plane very high (100,000) so nothing "disappears" 
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 100000);
camera.position.set(100, 100, 100);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);

// Over-the-top lighting so the model doesn't look like a wireframe
scene.add(new THREE.AmbientLight(0xffffff, 1.5));
const sun = new THREE.DirectionalLight(0xffffff, 1.5);
sun.position.set(1000, 2000, 1000);
scene.add(sun);

let buildingParts = [];
const modelIds = ['ModelBasement.gltf', 'ModelE.gltf', 'Model1F.gltf', 'Model2F.gltf']
const modelCache = {};
let currentModel = null;
let clickedObject = null;


const loader = new GLTFLoader();

modelIds.forEach(id => {
    loader.load(`./${id}`, (gltf) => {
        modelCache[id] = gltf.scene;

        modelCache[id].traverse((child) => {
            if (child.isMesh) {
                child.material.color.set(0xffffff);
            }
        });

        // Set the default model ONLY once it's actually finished loading
        if (id === 'ModelE.gltf') {
            currentModel = gltf.scene;
            scene.add(currentModel);
        }
    });
});

window.showOnly = (id) => {
    // Check if the model actually exists in the cache yet
    if (!modelCache[id]) {
        console.warn(`Model ${id} hasn't loaded yet!`);
        return;
    }

    if (currentModel) {
        scene.remove(currentModel);
    }

    console.log('Showing: ' + id);
    currentModel = modelCache[id];
    scene.add(currentModel); // Use parentheses ()
};



window.resetBuilding = () => {
    buildingParts.forEach(part => part.visible = true);
};

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}
animate();



const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// InfluxDB configuration
const INFLUXDB_URL = 'http://localhost:8086';
const INFLUXDB_TOKEN = 'ih3lGQ2dVqXG7ec0Ai-flUi5ZWTqp3AChtwI0fu4014-cn5h0MRE6-RcWtlL1yYGUaaSg6NOtcW_TEjQdGGA5A==';
const INFLUXDB_ORG = 'leoiot';
const INFLUXDB_BUCKET = 'server_data';

// Function to query room temperature from InfluxDB
async function getRoomTemperature(roomName) {
    const query = `from(bucket: "${INFLUXDB_BUCKET}")
  |> range(start: -10m)
  |> filter(fn: (r) => r._measurement == "room_temperature" and r.room == "${roomName}")
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

        if (!response.ok) {
            throw new Error(`InfluxDB query failed: ${response.status}`);
        }

        const csvData = await response.text();
        const lines = csvData.trim().split('\n');
        
        // CSV format: header line, then data lines
        // We want the last data line with the temperature value
        if (lines.length > 1) {
            const dataLine = lines[lines.length - 1];
            const columns = dataLine.split(',');
            
            // Find the _value column (temperature)
            const headerLine = lines[0];
            const headers = headerLine.split(',');
            const valueIndex = headers.indexOf('_value');
            
            if (valueIndex !== -1 && columns[valueIndex]) {
                return parseFloat(columns[valueIndex]);
            }
        }
        
        return null;
    } catch (error) {
        console.error('Error fetching temperature:', error);
        return null;
    }
}

function normalizeRoomName(objectName) {
    if (!objectName) return objectName;

    let name = String(objectName).trim();

    // Common pattern in glTF exports: "134_1", "E07_2", etc.
    if (name.includes('_')) {
        name = name.split('_')[0];
    }

    // Some basement meshes appear as "U741" (likely "U74" + part "1")
    if (/^U\d{3}$/.test(name)) {
        name = `U${name.substring(1, 3)}`;
    }

    return name;
}

// Function to display temperature info
function displayTemperature(objectName, roomTag, temperature) {
    let infoDiv = document.getElementById('room-info');
    
    if (!infoDiv) {
        infoDiv = document.createElement('div');
        infoDiv.id = 'room-info';
        infoDiv.style.position = 'fixed';
        infoDiv.style.top = '20px';
        infoDiv.style.right = '20px';
        infoDiv.style.padding = '15px';
        infoDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        infoDiv.style.color = 'white';
        infoDiv.style.borderRadius = '8px';
        infoDiv.style.fontFamily = 'Arial, sans-serif';
        infoDiv.style.fontSize = '16px';
        infoDiv.style.zIndex = '1000';
        document.body.appendChild(infoDiv);
    }
    
    if (temperature !== null) {
        infoDiv.innerHTML = `<strong>Room:</strong> ${objectName}<br><strong>Influx tag:</strong> ${roomTag}<br><strong>Temperature:</strong> ${temperature.toFixed(1)}°C`;
    } else {
        infoDiv.innerHTML = `<strong>Room:</strong> ${objectName}<br><strong>Influx tag:</strong> ${roomTag}<br><strong>Temperature:</strong> No data available`;
    }
}

window.addEventListener('click', async (event) => {
    // 1. Calculate mouse position in normalized device coordinates (-1 to +1)
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // 2. Update the raycaster with the camera and mouse position
    raycaster.setFromCamera(mouse, camera);

    // 3. Calculate objects intersecting the picking ray
    // "true" allows it to search deep into the model groups
    const intersects = raycaster.intersectObjects(scene.children, true);

    if (intersects.length > 0) {
        const currentClickedObject = intersects[0].object;

        if (currentClickedObject.name.startsWith('E') ||
            currentClickedObject.name.startsWith('U') ||
            currentClickedObject.name.startsWith('1') ||
            currentClickedObject.name.startsWith('2')) {

            if (clickedObject != null) {
                clickedObject.material.color.set(0xffffff)
            }

            clickedObject = currentClickedObject;

            console.log('You clicked on: ' + clickedObject.name);

            // Change color of the clicked classroom
            clickedObject.material.color.set(0xff0000);
            
            // Fetch and display temperature data
            const objectName = clickedObject.name;
            const roomTag = normalizeRoomName(objectName);
            let temperature = await getRoomTemperature(objectName);
            if (temperature === null && roomTag !== objectName) {
                temperature = await getRoomTemperature(roomTag);
            }
            displayTemperature(objectName, roomTag, temperature);
        }


    }
});
