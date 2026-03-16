import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x222428); // Matched the dark grey from the image

// Camera
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 100000);
camera.position.set(100,80, 100);
camera.lookAt(0, 0, 0);

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);

// Lights
const ambientLight = new THREE.AmbientLight(0xffffff, 1.1);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(200, 300, 100);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
directionalLight.shadow.camera.near = 1;
directionalLight.shadow.camera.far = 2000;
directionalLight.shadow.camera.left = -500;
directionalLight.shadow.camera.right = 500;
directionalLight.shadow.camera.top = 500;
directionalLight.shadow.camera.bottom = -500;
directionalLight.shadow.bias = -0.0005;
directionalLight.shadow.radius = 2;
scene.add(directionalLight);

const fillLight = new THREE.PointLight(0xffffff, 0.2);
fillLight.position.set(-200, 100, -200);
scene.add(fillLight);

renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2; // Adjust this number to globally brighten/darken everything


const metalMaterial = new THREE.MeshStandardMaterial({
    color: 0xbcbcbc,      // A solid medium-light grey (not white)
    metalness: 0.35,      // Provides a subtle metallic sheen
    roughness: 0.4,       // Softens reflections so it looks like "brushed" metal
    envMapIntensity: 1.0  // Helps it react to your scene lights better
});

// Materials
const baseMaterial = new THREE.MeshStandardMaterial({
    color: 0xdddddd, // Flat light grey for the clay look
    roughness: 0.9,
    metalness: 0.0
});

// Restored original glass material
const glassMaterial = new THREE.MeshStandardMaterial({
    color: 0x88aabb,      // Light grey-blue tint (looks more like glass)
    roughness: 0.1,       // Low roughness for sharp, clean reflections
    metalness: 0.5,       // Adds a bit of "sheen" to the surface
    transparent: true,
    opacity: 0.3,         // More transparent, but the color/reflections keep it visible
});

// Load models
const modelIds = ['ModelBasement.gltf','ModelE.gltf','Model1F.gltf','Model2F.gltf','ModelFull.gltf'];
const modelCache = {};
let currentModel = null;
let clickedObject = null;

const loader = new GLTFLoader();

// 1. Create an array of Promises for each model
const loadPromises = modelIds.map(id => {
    return new Promise((resolve, reject) => {
        loader.load(
            `./${id}`,
            (gltf) => {
                modelCache[id] = gltf.scene;

                modelCache[id].traverse(child => {
                    if(child.isMesh){
                        child.castShadow = true;
                        child.receiveShadow = true;

                        if(child.name.includes('GLAS')){
                            child.material = glassMaterial;
                        }
                        // Example: logic to catch metal parts
                        else if(child.name.includes('METALL') || child.name.includes('FENSTERRAHMEN')){
                            child.material = metalMaterial;
                        }
                        else {
                            child.material = baseMaterial;
                        }
                    }
                });

                if (id === 'ModelFull.gltf') {
                    currentModel = gltf.scene;
                    scene.add(currentModel);
                }

                resolve(); // Tell the promise this specific file is done
            },
            undefined, // onProgress callback (optional)
            (error) => reject(error) // Handle loading errors
        );
    });
});

// 2. Wait for ALL promises to finish
Promise.all(loadPromises).then(() => {
    console.log("All models loaded!");

    // Hide the loading element
    document.getElementById('loading').style.display = 'none'

}).catch(err => {
    console.error("An error occurred while loading models:", err);
});

// Switch models function
window.showOnly = (id)=>{
    if(!modelCache[id]) return;
    if(currentModel) scene.remove(currentModel);




    if(id === 'ModelFull.gltf') {
        camera.position.set(100, 80, 100);
        camera.lookAt(0, 0, 0);
    }
    currentModel = modelCache[id];
    scene.add(currentModel);

    if (isHeatmapActive) {
        isHeatmapActive = false;
        updateBuildingHeatmap()
    } else {
        isHeatmapActive = true;
        updateBuildingHeatmap()
    }
};

// Handle window resizing
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
window.addEventListener('click', async (event) => {
    // 1. Calculate mouse position in normalized device coordinates (-1 to +1)
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // 2. Update the raycaster with the camera and mouse position
    raycaster.setFromCamera(mouse, camera);

    // 3. Calculate objects intersecting the picking ray // "true" allows it to search deep into the model groups
    const intersects = raycaster.intersectObjects(scene.children, true);
    if (intersects.length > 0) {
        const currentClickedObject = intersects[0].object;

        if (currentClickedObject.name.startsWith('E')
            || currentClickedObject.name.startsWith('U')
            || currentClickedObject.name.startsWith('1')
            || currentClickedObject.name.startsWith('2')) {
            // 1. Reset the previous object if it exists
            if (clickedObject != null) {
                clickedObject.material.color.set(0xdddddd); // Use your base gray color
            }

            clickedObject = currentClickedObject;

            // 2. CLONE the material so this object has its own private copy
            // This prevents the "red" from spreading to other meshes
            if (clickedObject.material) {
                clickedObject.material = clickedObject.material.clone();

                // 3. Now change the color safely

                currentModel.traverse(child => {
                    if (child.isMesh && (
                        child.name.startsWith('E') ||
                        child.name.startsWith('U') ||
                        child.name.startsWith('1') ||
                        child.name.startsWith('2')
                    )) {
                        if (child !== clickedObject) {
                            child.material = baseMaterial;

                        }
                        // Revert to the shared baseMaterial (this removes the unique colors)
                    }
                });


                isHeatmapActive = false;
                document.getElementById('heatMapButton').innerHTML = 'show Heatmap'


                clickedObject.material.color.set(0xf1c40f);
            }

            // Fetch and display temperature data
            const objectName = clickedObject.name;
            const roomTag = normalizeRoomName(objectName);
            let temperature = await getRoomTemperature(objectName);
            if (temperature === null && roomTag !== objectName) {
                temperature = await getRoomTemperature(roomTag);
            }

            displayTemperature(objectName, roomTag, temperature);

            console.log('You clicked on: ' + clickedObject.name);
        }
    }

});

window.handleButtonClick = (buttonElement, modelId) => {
    // 1. Remove 'active' class from all buttons in the container
    const container = document.getElementById('button-container');
    const buttons = container.querySelectorAll('button');
    buttons.forEach(btn => btn.classList.remove('active'));

    // 2. Add 'active' class to the clicked button
    if (modelId !== 'ModelFull.gltf') {
        buttonElement.classList.add('active');
    }
    // 3. Call your existing 3D logic
    window.showOnly(modelId);
};


// Animate
function animate(){
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}
animate();

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

/**
 * Maps a temperature value to a color and applies it to the room mesh.
 * @param {THREE.Mesh} mesh - The room mesh object
 * @param {number} temp - Temperature in Celsius
 */
function applyHeatmapColor(mesh, temp) {
    if (!mesh || temp === null) return;

    // Define range (e.g., 15°C is blue, 25°C is red)
    const minTemp = 20;
    const maxTemp = 25;

    // Normalize temperature to a 0-1 range
    const t = Math.max(0, Math.min(1, (temp - minTemp) / (maxTemp - minTemp)));

    // Create a color: Blue (0,0,1) to Red (1,0,0)
    // You can use lerp for a smoother transition
    const colorHot = new THREE.Color(0xd68d8d);  // Muted Coral/Red
    const colorCold = new THREE.Color(0x8da1d6);
    const finalColor = colorCold.clone().lerp(colorHot, t);

    // Ensure material is unique so we don't color the whole building
    mesh.material = mesh.material.clone();
    mesh.material.color.copy(finalColor);

    // Optional: make rooms slightly more opaque when heatmapped
    mesh.material.opacity = 0.8;
}

let isHeatmapActive = false; // Track the state globally

window.updateBuildingHeatmap = async () => {
    if (!currentModel) return;


    const btn = document.getElementById('heatMapButton')

    // TOGGLE OFF: If it's already on, clear it and stop
    if (isHeatmapActive) {

        btn.innerHTML = 'show Heatmap'
        clearHeatmap();
        isHeatmapActive = false;

        return;
    } else {
        let infoDiv = document.getElementById('room-info');
        if (infoDiv) {
            infoDiv.remove()
            console.log(infoDiv)
            clickedObject = null;
        }
        btn.innerHTML = 'clear Heatmap'
    }

    // TOGGLE ON: Proceed with fetching data
    isHeatmapActive = true;
    console.log("Activating Heatmap...");

    const roomMeshes = [];
    currentModel.traverse(child => {
        if (child.isMesh && (
            child.name.startsWith('E') ||
            child.name.startsWith('U') ||
            child.name.startsWith('1') ||
            child.name.startsWith('2')
        )) {
            roomMeshes.push(child);
        }
    });

    // Use Promise.all for faster parallel loading so the user doesn't wait
    const heatmapPromises = roomMeshes.map(async (mesh) => {
        const roomTag = normalizeRoomName(mesh.name);
        const temp = await getRoomTemperature(roomTag);

        // Only apply if the user hasn't toggled it off while loading
        if (temp !== null && isHeatmapActive) {
            applyHeatmapColor(mesh, temp);
        }
    });

    await Promise.all(heatmapPromises);
};
function clearHeatmap() {
    if (!currentModel) return;

    currentModel.traverse(child => {
        if (child.isMesh && (
            child.name.startsWith('E') ||
            child.name.startsWith('U') ||
            child.name.startsWith('1') ||
            child.name.startsWith('2')
        )) {
            // Revert to the shared baseMaterial (this removes the unique colors)
            child.material = baseMaterial;
        }
    });
    console.log("Heatmap cleared.");
}