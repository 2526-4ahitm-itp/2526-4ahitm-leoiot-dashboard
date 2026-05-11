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
// Store initial camera state for reset
const initialCameraPosition = camera.position.clone();
const initialCameraRotation = camera.rotation.clone();
const initialControlsTarget = controls.target.clone();

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
const modelIds = ['ModelU.gltf','ModelE.gltf','Model1F.gltf','Model2F.gltf','ModelFull.gltf','ModelT.gltf'];
const modelCache = {};
let currentModel = null;
let clickedObject = null;
let activeHeatmapType = null; // null, 'temp', 'co2'

function setHeatmapButtonState(modelId) {
    const tempBtn = document.getElementById('heatMapButton');
    const co2Btn = document.getElementById('co2HeatmapButton');
    // Enable heatmap only for floor models (U, E, 1F, 2F)
    const enabled = ['ModelU.gltf', 'ModelE.gltf', 'Model1F.gltf', 'Model2F.gltf'].includes(modelId);

    if (tempBtn) {
        tempBtn.disabled = !enabled;
        tempBtn.title = enabled ? '' : 'Heatmap is available on single-floor views only';
    }
    if (co2Btn) {
        co2Btn.disabled = !enabled;
        co2Btn.title = enabled ? '' : 'CO2 Heatmap is available on single-floor views only';
    }

    if (!enabled) {
        if (activeHeatmapType) {
            clearHeatmap();
            activeHeatmapType = null;
        }
    }

    updateHeatmapButtonClasses();
}

function updateHeatmapButtonClasses() {
    const tempBtn = document.getElementById('heatMapButton');
    const co2Btn = document.getElementById('co2HeatmapButton');

    // Reset all classes
    if (tempBtn) {
        tempBtn.classList.remove('heatmap-active', 'co2-active');
    }
    if (co2Btn) {
        co2Btn.classList.remove('heatmap-active', 'co2-active');
    }

    // Only the active heatmap type should be colored
    if (activeHeatmapType === 'temp') {
        if (tempBtn) tempBtn.classList.add('heatmap-active');
    } else if (activeHeatmapType === 'co2') {
        if (co2Btn) co2Btn.classList.add('co2-active');
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

    // Load waypoints from waypoints.gltf (with cache busting)
    return new Promise((resolve, reject) => {
        loader.load(`./waypoints.gltf?v=${Date.now()}`, (gltf) => {
            window.waypointsData = {};
            gltf.scene.traverse((child) => {
                if (child.isMesh && child.name) {
                    const parts = child.name.split('_');
                    if (parts.length >= 2) {
                        const floor = parts[0];
                        const type = parts.slice(1).join('_');
                        const pos = child.position;
                        if (!window.waypointsData[floor]) window.waypointsData[floor] = {};
                        if (!window.waypointsData[floor][type]) window.waypointsData[floor][type] = [];
                        window.waypointsData[floor][type].push({ x: pos.x, z: pos.z, name: child.name });
                    }
                }
            });
            console.log('Waypoints loaded:', window.waypointsData);
            resolve();
        }, undefined, reject);
    });
}).then(() => {
    // Wire up navigation search suggestions now that all models are loaded.
    window.initNavigationUI();
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

function addCO2Label(mesh, co2) {
    const co2Div = document.createElement('div');
    co2Div.className = 'co2-label';
    co2Div.style.color = '#ffffff';
    co2Div.style.backgroundColor = 'rgba(0,0,0,0.6)';
    co2Div.style.padding = '2px 6px';
    co2Div.style.borderRadius = '4px';
    co2Div.style.fontFamily = 'sans-serif';
    co2Div.style.fontSize = '12px';
    co2Div.textContent = `${co2.toFixed(0)} ppm`;

    const label = new CSS2DObject(co2Div);
    label.name = 'co2Label';

    const box = new THREE.Box3().setFromObject(mesh);
    const center = new THREE.Vector3();
    box.getCenter(center);
    label.position.copy(center);
    mesh.add(label);
}

function getCO2Color(co2) {
    // 400-800: dark green to light green
    // 800-1000: yellow to orange
    // 1000+: orange to red
    
    const colorDarkGreen = new THREE.Color(0x1e6f50);
    const colorLightGreen = new THREE.Color(0x27ae60);
    const colorYellow = new THREE.Color(0xf1c40f);
    const colorOrange = new THREE.Color(0xe67e22);
    const colorRed = new THREE.Color(0xe74c3c);
    
    if (co2 <= 800) {
        // 400-800: dark green to light green
        const t = (co2 - 400) / 400;
        return colorDarkGreen.clone().lerp(colorLightGreen, t);
    } else if (co2 <= 1000) {
        // 800-1000: yellow to orange
        const t = (co2 - 800) / 200;
        return colorYellow.clone().lerp(colorOrange, t);
    } else {
        // 1000+: orange to red
        const t = Math.min(1, (co2 - 1000) / 700);
        return colorOrange.clone().lerp(colorRed, t);
    }
}

function updateCO2HeatmapMesh(mesh, co2) {
    const finalColor = getCO2Color(co2);

    if (mesh.material === baseMaterial || mesh.material === glassMaterial || mesh.material === metalMaterial) {
        mesh.material = baseMaterial.clone();
    }
    mesh.material.color.copy(finalColor);
    mesh.material.transparent = false;
    mesh.material.opacity = 1.0;

    const label = mesh.getObjectByName('co2Label');
    if (label && label.element) {
        label.element.textContent = `${co2.toFixed(0)} ppm`;
    } else {
        addCO2Label(mesh, co2);
    }
}

window.updateBuildingHeatmap = async () => {
    if (!currentModel) return;
    const btn = document.getElementById('heatMapButton');

    // Toggle temp heatmap
    if (activeHeatmapType === 'temp') {
        btn.innerHTML = 'Temperature';
        clearHeatmap();
        activeHeatmapType = null;
        updateHeatmapButtonClasses();
        return;
    }

    // If CO2 heatmap is active, clear it first
    if (activeHeatmapType === 'co2') {
        clearHeatmap();
        activeHeatmapType = null;
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

    activeHeatmapType = 'temp';
    btn.innerHTML = 'Temperature';
    updateHeatmapButtonClasses();

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
        if (temp !== null && activeHeatmapType === 'temp') {
            updateHeatmapMesh(mesh, temp);
        }
    }));
};

window.updateCO2Heatmap = async () => {
    if (!currentModel) return;
    const btn = document.getElementById('co2HeatmapButton');

    // Toggle CO2 heatmap
    if (activeHeatmapType === 'co2') {
        btn.innerHTML = 'CO2';
        clearHeatmap();
        activeHeatmapType = null;
        updateHeatmapButtonClasses();
        return;
    }

    // If temp heatmap is active, clear it first
    if (activeHeatmapType === 'temp') {
        clearHeatmap();
        activeHeatmapType = null;
    }

    // Determine which floor prefix to look for based on the current model's ID
    let activePrefix = null;
    const currentModelId = Object.keys(modelCache).find(key => modelCache[key] === currentModel);

    if (currentModelId && currentModelId !== 'ModelFull.gltf') {
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

    activeHeatmapType = 'co2';
    btn.innerHTML = 'CO2';
    updateHeatmapButtonClasses();

    const roomMeshes = [];
    currentModel.traverse(child => {
        if (child.isMesh) {
            const name = child.name;
            const isRoom = /^[EU12]/.test(name);
            const matchesFloor = !activePrefix || name.startsWith(activePrefix);

            if (isRoom && matchesFloor) {
                roomMeshes.push(child);
            }
        }
    });

    co2MeshesByRoom.clear();

    const roomsToSubscribe = new Set();
    for (const mesh of roomMeshes) {
        const roomTag = normalizeRoomName(mesh.name);
        if (!roomTag) continue;

        const list = co2MeshesByRoom.get(roomTag) || [];
        list.push(mesh);
        co2MeshesByRoom.set(roomTag, list);
        roomsToSubscribe.add(roomTag);
    }

    for (const room of roomsToSubscribe) wantedRooms.add(room);
    reconcileRoomSubscriptions();

    // For CO2, we first show live data if we have it, 
    // otherwise we fetch the latest value from InfluxDB for each room.
    await Promise.all(roomMeshes.map(async (mesh) => {
        const roomTag = normalizeRoomName(mesh.name);
        if (!roomTag) return;

        const live = latestLive.get(roomTag);
        let co2 = (live && live.co2 != null) ? live.co2 : null;
        
        if (co2 === null) {
            co2 = await getRoomCO2ForRoom(roomTag);
        }

        if (co2 !== null && activeHeatmapType === 'co2') {
            updateCO2HeatmapMesh(mesh, co2);
        }
    }));
};

function clearHeatmap() {
    if (!currentModel) return;
    heatmapMeshesByRoom.clear();
    co2MeshesByRoom.clear();

    // Reset button text
    const tempBtn = document.getElementById('heatMapButton');
    const co2Btn = document.getElementById('co2HeatmapButton');
    if (tempBtn) tempBtn.innerHTML = 'Temperature';
    if (co2Btn) co2Btn.innerHTML = 'CO2';

    // Update button classes to show inactive state
    if (tempBtn) {
        tempBtn.classList.remove('heatmap-active', 'co2-active');
    }
    if (co2Btn) {
        co2Btn.classList.remove('heatmap-active', 'co2-active');
    }

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
            // Remove the temp label
            const tempLabel = child.getObjectByName('tempLabel');
            if (tempLabel) child.remove(tempLabel);
            // Remove the CO2 label
            const co2Label = child.getObjectByName('co2Label');
            if (co2Label) child.remove(co2Label);
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

    console.log('SHOWONLY: Switching to model:', id);
    console.log('SHOWONLY: Current camera rotation before animation:', camera.rotation.clone().toArray());

    // Store initial camera state for reset (when not going to gym)
    if (id !== 'ModelT.gltf' && !window.initialCameraPosition) {
        window.initialCameraPosition = camera.position.clone();
        window.initialCameraRotation = camera.rotation.clone();
        // Also store the OrbitControls target if it exists
        if (controls.target) {
            window.initialControlsTarget = controls.target.clone();
        }
    }

    // Handle model switching and camera animation based on model
    console.log('SHOWONLY: About to handle camera animation for model:', id);
    if (id === 'ModelT.gltf') {
        // Going TO gym - add gym model to scene, animate camera, then remove school model
        console.log('ANIMATING TO GYM - Adding gym model to scene');
        const gymModel = modelCache[id];
        scene.add(gymModel); // Add gym model to scene
        
        const targetRotation = getCameraRotationForModel(id);
        console.log('ANIMATING TO GYM - targetRotation:', targetRotation.toArray());
        console.log('Current rotation before anim:', camera.rotation.clone().toArray());
        // Temporarily disable OrbitControls to prevent conflict
        controls.enabled = false;
        animateCameraRotationTo(targetRotation, () => {
            // After animation completes, remove school model and keep only gym model
            if(currentModel) scene.remove(currentModel);
            currentModel = gymModel;
            
            // Re-enable OrbitControls after animation
            controls.enabled = true;
            
            // If heatmap was already on, refresh it for the new floor
            if (activeHeatmapType === 'temp') {
                activeHeatmapType = null;
                window.updateBuildingHeatmap();
            } else if (activeHeatmapType === 'co2') {
                activeHeatmapType = null;
                window.updateCO2Heatmap();
            }
        });
    } else if (window.initialCameraRotation) {
        // Going FROM gym back to school - add school model to scene, animate camera, then remove gym model
        console.log('ANIMATING FROM GYM - Adding school model to scene');
        const schoolModel = modelCache[id];
        scene.add(schoolModel); // Add school model to scene
        
        console.log('ANIMATING FROM GYM - targetRotation:', window.initialCameraRotation.toArray());
        console.log('Current rotation before anim:', camera.rotation.clone().toArray());
        // Temporarily disable OrbitControls to prevent conflict
        controls.enabled = false;
        animateCameraRotationTo(window.initialCameraRotation, () => {
            // After animation completes, remove gym model and keep only school model
            if(currentModel) scene.remove(currentModel);
            currentModel = schoolModel;
            
            // Re-enable OrbitControls after animation
            controls.enabled = true;
            // Reset stored values after use so we capture them again next time
            window.initialCameraPosition = null;
            window.initialCameraRotation = null;
            if (window.initialControlsTarget) {
                window.initialControlsTarget = null;
            }
        });
    } else {
        // For other model switches (not involving gym), switch immediately
        if(currentModel) scene.remove(currentModel);
        currentModel = modelCache[id];
        scene.add(currentModel);
        
        // If heatmap was already on, refresh it for the new floor
        if (activeHeatmapType === 'temp') {
            activeHeatmapType = null;
            window.updateBuildingHeatmap();
        } else if (activeHeatmapType === 'co2') {
            activeHeatmapType = null;
            window.updateCO2Heatmap();
        }
    }
};

// Get target camera rotation for each model
function getCameraRotationForModel(modelId) {
    // Default rotation (looking at center of school)
    const defaultRotation = new THREE.Euler(0, 0, 0, 'YXZ');
    
    switch(modelId) {
        case 'ModelT.gltf': // Gym model
            // Rotate camera slightly to the LEFT (negative Y rotation in Three.js) 
            // to begin showing the gym (positioned to the RIGHT) 
            // Using a small rotation so gym only becomes visible near end of animation
            return new THREE.Euler(0, -0.2, 0, 'YXZ'); // Approximately -11.5 degrees (left)
        default:
            // Default rotation for all other models (face center)
            return defaultRotation;
    }
}

// Animate camera rotation to target rotation
function animateCameraRotationTo(targetRotation, callback) {
    console.log('Starting animation from:', camera.rotation.clone(), 'to:', targetRotation.clone());
    const startRotation = camera.rotation.clone();
    const duration = 800; // Reduced duration for quicker response
    const startTime = performance.now();

    function animateRotation(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function for smoother animation
        const easedProgress = progress < 0.5 
            ? 2 * progress * progress 
            : -1 + (4 - 2 * progress) * progress;
        
        // Interpolate between start and target rotation
        camera.rotation.x = THREE.MathUtils.lerp(startRotation.x, targetRotation.x, easedProgress);
        camera.rotation.y = THREE.MathUtils.lerp(startRotation.y, targetRotation.y, easedProgress);
        camera.rotation.z = THREE.MathUtils.lerp(startRotation.z, targetRotation.z, easedProgress);
        
        // Update the camera's projection matrix (important for Three.js)
        camera.updateProjectionMatrix();
        
        // Render the scene during animation
        renderer.render(scene, camera);
        labelRenderer.render(scene, camera);
        
        // Log progress every 100ms to reduce console spam
        if (Math.floor(elapsed / 100) !== Math.floor((elapsed - 16) / 100)) {
            console.log(`Animation progress: ${Math.round(progress * 100)}% - rotation: [${camera.rotation.x.toFixed(3)}, ${camera.rotation.y.toFixed(3)}, ${camera.rotation.z.toFixed(3)}]`);
        }
        
        if (progress < 1) {
            requestAnimationFrame(animateRotation);
        } else {
            console.log('Animation complete. Final rotation:', camera.rotation.clone());
            console.log('Camera position after animation:', camera.position.clone());
            // Call callback if provided
            if (callback && typeof callback === 'function') {
                callback();
            }
        }
    }
    
    requestAnimationFrame(animateRotation);
}

window.handleButtonClick = (buttonElement, modelId) => {
    console.log('Button clicked for model:', modelId);
    console.log('Camera position before:', camera.position.clone().toArray());
    console.log('Camera rotation before:', camera.rotation.clone().toArray());
    clearNavigation();
    const container = document.getElementById('button-container');
    const buttons = container.querySelectorAll('button');
    buttons.forEach(btn => btn.classList.remove('active'));
    if (modelId !== 'ModelFull.gltf') buttonElement.classList.add('active');
    
    // Special handling for reset view - also reset camera to default
    if (modelId === 'ModelFull.gltf') {
        // Reset camera to default position and rotation
        console.log('RESET VIEW - Resetting camera to default position');
        camera.position.copy(initialCameraPosition);
        camera.rotation.copy(initialCameraRotation);
        controls.target.copy(initialControlsTarget);
        controls.update();
        console.log('Camera position after reset:', camera.position.clone().toArray());
        console.log('Camera rotation after reset:', camera.rotation.clone().toArray());
    }
    
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
const LIVE_WS_URL = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.hostname + '/ws';
let liveWs = null;
let liveWsConnected = false;
const wantedRooms = new Set();
const subscribedRooms = new Set();

// Heatmap live update support
// heatmapMeshesByRoom[room] = Mesh[] currently displayed in temp heatmap
const heatmapMeshesByRoom = new Map();
// co2MeshesByRoom[room] = Mesh[] currently displayed in CO2 heatmap
const co2MeshesByRoom = new Map();

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

            // If temp heatmap is active, update any meshes for this room.
            if (activeHeatmapType === 'temp') {
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

            // If CO2 heatmap is active, update any meshes for this room.
            if (activeHeatmapType === 'co2') {
                const meshes = co2MeshesByRoom.get(room);
                if (meshes && meshes.length) {
                    for (const mesh of meshes) {
                        updateCO2HeatmapMesh(mesh, msg.value);
                    }
                }
            }
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

        if (/^[EU12T]/.test(obj.name)) {
            const roomTag = normalizeRoomName(obj.name);

            // If heatmap is active, clicking a room should behave like "Clear Heatmap"
            // and then switch to single-room highlight/value view.
            if (activeHeatmapType) {
                clearHeatmap();
                activeHeatmapType = null;

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
                unwantRoom(selectedRoomTag);
            }
            selectedRoomTag = roomTag;
            selectedObjectName = obj.name;
            wantRoom(roomTag);

            // Keep existing Influx path (do not remove/change it)
            const temp = await getRoomTemperature(roomTag);
            let co2 = null;

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
const INFLUXDB_URL = '/influx';
const INFLUXDB_TOKEN = 'ih3lGQ2dVqXG7ec0Ai-flUi5ZWTqp3AChtwI0fu4014-cn5h0MRE6-RcWtlL1yYGUaaSg6NOtcW_TEjQdGGA5A==';
const INFLUXDB_ORG = 'leoiot';
const INFLUXDB_BUCKET = 'server_data';

async function getRoomTemperature(roomName) {
    // For Room 105, also check mqtt_consumer measurement with nili3_temperature topic
    if (roomName === '105') {
        const query = `from(bucket: "${INFLUXDB_BUCKET}")
          |> range(start: -24h)
          |> filter(fn: (r) => r._measurement == "mqtt_consumer")
          |> filter(fn: (r) => r.topic == "nili3/sensor/nili3_temperature/state")
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

async function getRoomCO2ForRoom(roomName) {
    let topic = `nili3/sensor/${roomName.toLowerCase()}_co2/state`;
    if (roomName === '105') {
        topic = "nili3/sensor/nili3_co2/state";
    }
    
    const query = `from(bucket: "${INFLUXDB_BUCKET}")
      |> range(start: -24h)
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
    // Handle gym room names (T followed by 3 digits)
    if (/^T\d{3}$/.test(name)) name = `T${name.substring(1, 3)}`;
    return name;
}

function displayRoomInfo(objectName, roomTag, temperature, co2) {
    let infoDiv = document.getElementById('room-info');
    if (!infoDiv) {
        infoDiv = document.createElement('div');
        infoDiv.id = 'room-info';
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

let navPath = null;
let navPathLower = null; // ghost ground-floor tube shown after floor switch
let navDot = null;
let navAnimationProgress = 0;
let isNavigating = false;
let navPoints = [];
let navTimer = null;

function clearNavigation() {
    if (navPath)      { scene.remove(navPath);      navPath      = null; }
    if (navPathLower) { scene.remove(navPathLower); navPathLower = null; }
    if (navDot)       { scene.remove(navDot);       navDot       = null; }
    if (navTimer)     { cancelAnimationFrame(navTimer); navTimer  = null; }
    isNavigating = false;
    navPoints = [];
    navAnimationProgress = 0;
}
window.clearNavigation = clearNavigation;

window.initNavigationUI = () => {
    const searchInput = document.getElementById('room-search');
    const suggestionsBox = document.getElementById('search-suggestions');
    if (!searchInput || !suggestionsBox) return;
    
    const roomNames = new Set();
    Object.values(modelCache).forEach(model => {
        if (!model) return;
        model.traverse(child => {
            if (child.isMesh && /^[EU12]/.test(child.name)) {
                roomNames.add(normalizeRoomName(child.name));
            }
        });
    });
    
    const sortedRooms = Array.from(roomNames).filter(Boolean).sort();

    searchInput.addEventListener('input', (e) => {
        const val = e.target.value.toLowerCase().trim();
        suggestionsBox.innerHTML = '';
        
        if (!val) {
            suggestionsBox.style.display = 'none';
            return;
        }

        const matches = sortedRooms.filter(room => room.toLowerCase().includes(val)).slice(0, 10);
        
        if (matches.length > 0) {
            suggestionsBox.style.display = 'block';
            matches.forEach(room => {
                const div = document.createElement('div');
                div.textContent = room;
                div.style.padding = '10px 15px';
                div.style.cursor = 'pointer';
                div.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
                div.style.fontFamily = 'sans-serif';
                div.style.fontSize = '14px';
                div.style.transition = 'background 0.2s';
                
                div.addEventListener('mouseenter', () => {
                    div.style.backgroundColor = 'rgba(255,255,255,0.1)';
                });
                div.addEventListener('mouseleave', () => {
                    div.style.backgroundColor = 'transparent';
                });
                
                div.addEventListener('mousedown', (ev) => {
                    // Prevent blur from firing before click
                    ev.preventDefault();
                });

                div.addEventListener('click', () => {
                    searchInput.value = room;
                    suggestionsBox.style.display = 'none';
                    window.startNavigation(room);
                });
                suggestionsBox.appendChild(div);
            });
        } else {
            suggestionsBox.innerHTML = '<div style="padding: 10px 15px; color: #aaa; font-size: 14px;">No rooms found</div>';
            suggestionsBox.style.display = 'block';
        }
    });

    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            suggestionsBox.style.display = 'none';
            window.startNavigation(searchInput.value);
        }
    });

    searchInput.addEventListener('blur', () => {
        // slight delay to allow click event on suggestions to fire
        setTimeout(() => { suggestionsBox.style.display = 'none'; }, 150);
    });

    searchInput.addEventListener('focus', (e) => {
        if (e.target.value.trim()) {
            e.target.dispatchEvent(new Event('input'));
        }
    });
};



// --- HTL Leonding Corridor Navigation ---

// Floor Y heights derived from GLTF mesh accessor bounds (floor surface level).
// Trail floats TRAIL_OFFSET above these — no terrain raycasting needed.
const FLOOR_Y = {
    'ModelU.gltf':  -3.106,
    'ModelE.gltf':   0.058,
    'Model1F.gltf':  3.205,
    'Model2F.gltf':  6.263,
    'ModelT.gltf':   0.058, // Gym is on ground floor level
};
const TRAIL_OFFSET = 0.6;

// Corridor segments used to snap a room centre to the nearest hallway centreline.
// 'all'   = every floor (ring + wing corridors at their actual positions).
// 'upper' = ground / 1F / 2F only (Aula cross segments for central rooms).
// 'U'     = basement only (north extension beyond the ring).
const segments = [
    // ── Ring (courtyard perimeter) — hallway edge used on every floor ─────────
    { id: 'RingN',  x1: -11.15, x2:  16.2,  z1: -13.9, z2: -13.9, type: 'H', floors: 'all' },
    { id: 'RingS',  x1: -11.15, x2:  16.2,  z1:   5.1, z2:   5.1, type: 'H', floors: 'all' },
    { id: 'RingW',  x1: -11.15, x2: -11.15, z1: -13.9, z2:   5.1, type: 'V', floors: 'all' },
    { id: 'RingE',  x1:  16.2,  x2:  16.2,  z1: -13.9, z2:   5.1, type: 'V', floors: 'all' },
    // ── Wing corridors — extend from ring corners outward, every floor ─────────
    { id: 'WestW',  x1: -70.0,  x2: -11.15, z1:   5.1, z2:   5.1, type: 'H', floors: 'all' },
    { id: 'EastW',  x1:  16.2,  x2:  70.0,  z1: -13.9, z2: -13.9, type: 'H', floors: 'all' },
    { id: 'NorthW', x1:  16.2,  x2:  16.2,  z1: -70.0, z2: -13.9, type: 'V', floors: 'all' },
    { id: 'South1', x1: -11.15, x2: -11.15, z1:   5.1, z2:  70.0, type: 'V', floors: 'all' },
    { id: 'South2', x1:  16.2,  x2:  16.2,  z1:   5.1, z2:  70.0, type: 'V', floors: 'all' },
    // ── Aula cross corridors (upper floors) — rooms in central area snap here ──
    { id: 'AulaEW', x1: -11.15, x2:  16.2,  z1:  -4.4, z2:  -4.4, type: 'H', floors: 'upper' },
    { id: 'AulaNS', x1:   5.5,  x2:   5.5,  z1: -13.9, z2:   5.1, type: 'V', floors: 'upper' },
    // ── Basement-only north extension ─────────────────────────────────────────
    { id: 'U_WestN', x1: -41.45, x2: -41.45, z1: -51.0, z2:   5.1, type: 'V', floors: 'U' },
    { id: 'U_TopH',  x1: -57.9,  x2:  16.2,  z1: -52.0, z2: -52.0, type: 'H', floors: 'U' },
];

// Graph nodes (X, Z only — Y is resolved at runtime from FLOOR_Y).
//
// The Aula (entrance hall) has four arm-nodes that form an X:
//   NorthAula / SouthAula on the NS arm (x = 5.5)
//   WestAula  / EastAula  on the EW arm (z = −4.4)
// These sit exactly on the ring boundary, so Dijkstra routes paths through the
// centre of the building rather than around the ring perimeter.
const graphNodes = {
    // ── Aula centre and its four arm-ends ─────────────────────────────────────
    'Entrance':  { x:  5.5,   z:  -4.4 }, // X crossing inside the Aula
    'WestAula':  { x: -11.15, z:  -4.4 }, // EW arm, west end  (on RingW)
    'EastAula':  { x:  16.2,  z:  -4.4 }, // EW arm, east end  (on RingE)
    'NorthAula': { x:  5.5,   z: -13.9 }, // NS arm, north end (on RingN)
    'SouthAula': { x:  5.5,   z:   5.1 }, // NS arm, south end (on RingS)
    // ── Ring corners (where Aula arms meet the wing corridors) ────────────────
    'NW':        { x: -11.15, z: -13.9 },
    'NE':        { x:  16.2,  z: -13.9 },
    'SW':        { x: -11.15, z:   5.1 },
    'SE':        { x:  16.2,  z:   5.1 },
    // ── Wing far ends ─────────────────────────────────────────────────────────
    'W_End':     { x: -70.0,  z:   5.1 },
    'E_End':     { x:  70.0,  z: -13.9 },
    'N_End':     { x:  16.2,  z: -70.0 },
    'S1_End':    { x: -11.15, z:  70.0 },
    'S2_End':    { x:  16.2,  z:  70.0 },
    // ── Basement north extension ───────────────────────────────────────────────
    'U_WN_Jct':  { x: -41.45, z:   5.1 },
    'U_WN_End':  { x: -41.45, z: -51.0 },
    'U_Top_W':   { x: -57.9,  z: -52.0 },
    'U_Top_E':   { x:  16.2,  z: -52.0 },
};

const graphEdges = [
    // ── Aula EW arm: Entrance ↔ WestAula and Entrance ↔ EastAula ─────────────
    ['Entrance', 'WestAula'],
    ['Entrance', 'EastAula'],
    // ── Aula NS arm: Entrance ↔ NorthAula and Entrance ↔ SouthAula ───────────
    ['Entrance', 'NorthAula'],
    ['Entrance', 'SouthAula'],
    // ── Aula arm-ends → ring corners ─────────────────────────────────────────
    ['WestAula',  'NW'], ['WestAula',  'SW'],
    ['EastAula',  'NE'], ['EastAula',  'SE'],
    ['NorthAula', 'NW'], ['NorthAula', 'NE'],
    ['SouthAula', 'SW'], ['SouthAula', 'SE'],
    // ── Wing corridors from ring corners ──────────────────────────────────────
    ['SW', 'W_End'],
    ['NE', 'E_End'],
    ['NE', 'N_End'],
    ['SW', 'S1_End'],
    ['SE', 'S2_End'],
    // ── Basement north extension ──────────────────────────────────────────────
    ['SW', 'U_WN_Jct'], ['U_WN_Jct', 'W_End'],
    ['U_WN_Jct', 'U_WN_End'],
    ['U_WN_End', 'U_Top_W'],
    ['U_Top_W',  'U_Top_E'],
    ['U_Top_E',  'N_End'],
];

const graph = {};
for (const key in graphNodes) { graph[key] = { id: key, ...graphNodes[key], edges: {} }; }
for (const [u, v] of graphEdges) {
    const d = Math.hypot(graph[u].x - graph[v].x, graph[u].z - graph[v].z);
    graph[u].edges[v] = d; graph[v].edges[u] = d;
}

function findShortestPath(startId, endId) {
    const dists = {}, prev = {}, q = new Set();
    for (const id in graph) { dists[id] = Infinity; q.add(id); }
    dists[startId] = 0;
    while (q.size > 0) {
        let u = null;
        for (const id of q) if (!u || dists[id] < dists[u]) u = id;
        if (dists[u] === Infinity || u === endId) break;
        q.delete(u);
        for (const [v, cost] of Object.entries(graph[u].edges)) {
            const alt = dists[u] + cost;
            if (alt < dists[v]) { dists[v] = alt; prev[v] = u; }
        }
    }
    if (!prev[endId] && startId !== endId) return [graph[startId], graph[endId]];
    const path = []; let curr = endId;
    while (curr) { path.push(graph[curr]); curr = prev[curr]; }
    return path.reverse();
}

// Returns graph distances from startId to every node (used for entry-node selection).
function dijkstraDists(startId) {
    const dists = {}, q = new Set();
    for (const id in graph) { dists[id] = Infinity; q.add(id); }
    dists[startId] = 0;
    while (q.size > 0) {
        let u = null;
        for (const id of q) if (!u || dists[id] < dists[u]) u = id;
        if (dists[u] === Infinity) break;
        q.delete(u);
        for (const [v, cost] of Object.entries(graph[u].edges)) {
            const alt = dists[u] + cost;
            if (alt < dists[v]) dists[v] = alt;
        }
    }
    return dists;
}

// Finds the "entry node" — the graph node that lies on the door segment and
// that you would naturally pass through when walking from startId toward doorPoint,
// without overshooting past the doorPoint and reversing.
// Strategy: among all nodes that lie on doorSeg, pick the one minimising
//   graphDist(start → node) + Euclidean(node → doorPoint).
function entryNode(startId, doorSeg, doorPoint) {
    const dists = dijkstraDists(startId);
    const SNAP_TOL = 0.2;
    let bestId = null, bestCost = Infinity;
    for (const [id, node] of Object.entries(graphNodes)) {
        let onSeg;
        if (doorSeg.type === 'H') {
            const xMin = Math.min(doorSeg.x1, doorSeg.x2), xMax = Math.max(doorSeg.x1, doorSeg.x2);
            onSeg = Math.abs(node.z - doorSeg.z1) < SNAP_TOL &&
                    node.x >= xMin - SNAP_TOL && node.x <= xMax + SNAP_TOL;
        } else {
            const zMin = Math.min(doorSeg.z1, doorSeg.z2), zMax = Math.max(doorSeg.z1, doorSeg.z2);
            onSeg = Math.abs(node.x - doorSeg.x1) < SNAP_TOL &&
                    node.z >= zMin - SNAP_TOL && node.z <= zMax + SNAP_TOL;
        }
        if (!onSeg || !isFinite(dists[id])) continue;
        const cost = dists[id] + Math.hypot(doorPoint.x - node.x, doorPoint.z - node.z);
        if (cost < bestCost) { bestCost = cost; bestId = id; }
    }
    return bestId || 'Entrance';
}

window.startNavigation = async (targetRoomName) => {
    let inputName = targetRoomName || document.getElementById('room-search').value;
    inputName = inputName.trim();
    if (!inputName) return;

    clearNavigation();

    const navBtn = document.getElementById('nav-btn');
    if (navBtn) { navBtn.textContent = '...'; navBtn.style.opacity = '0.7'; }

    let targetMesh = null;
    Object.values(modelCache).forEach(model => {
        if (!model) return;
        model.traverse(child => {
            if (child.isMesh && normalizeRoomName(child.name).toLowerCase() === inputName.toLowerCase())
                targetMesh = child;
        });
    });

    if (!targetMesh) {
        alert('Room not found.');
        if (navBtn) { navBtn.textContent = 'GO'; navBtn.style.opacity = '1'; }
        return;
    }

    const name = normalizeRoomName(targetMesh.name);
    document.getElementById('room-search').value = name;

    const endBox = new THREE.Box3().setFromObject(targetMesh);
    const endCenter = new THREE.Vector3();
    endBox.getCenter(endCenter);

    // Determine target floor
    let floorId = 'ModelE.gltf';
    if (name.startsWith('1'))      floorId = 'Model1F.gltf';
    else if (name.startsWith('2')) floorId = 'Model2F.gltf';
    else if (name.startsWith('U')) floorId = 'ModelU.gltf';

    const isGroundFloor = (floorId === 'ModelE.gltf');
    const groundY      = FLOOR_Y['ModelE.gltf'] + TRAIL_OFFSET;
    const targetFloorY = FLOOR_Y[floorId]       + TRAIL_OFFSET;

    // Snap room centre to nearest hallway centreline (door point)
    const activeSegs = segments.filter(s => {
        if (s.floors === 'all')   return true;
        if (s.floors === 'upper') return floorId !== 'ModelU.gltf';
        if (s.floors === 'U')     return floorId === 'ModelU.gltf';
        return false;
    });

    let minDist = Infinity, doorPoint = { x: 0, z: 0 }, doorSeg = activeSegs[0];
    for (const seg of activeSegs) {
        let px, pz;
        if (seg.type === 'H') {
            const xMin = Math.min(seg.x1, seg.x2), xMax = Math.max(seg.x1, seg.x2);
            px = Math.max(xMin, Math.min(xMax, endCenter.x));
            pz = seg.z1;
        } else {
            const zMin = Math.min(seg.z1, seg.z2), zMax = Math.max(seg.z1, seg.z2);
            px = seg.x1;
            pz = Math.max(zMin, Math.min(zMax, endCenter.z));
        }
        const d = Math.hypot(endCenter.x - px, endCenter.z - pz);
        if (d < minDist) { minDist = d; doorPoint = { x: px, z: pz }; doorSeg = seg; }
    }

    // Always start by showing the ground floor model (navigation begins at the entrance)
    if (modelCache['ModelE.gltf']) {
        if(currentModel) scene.remove(currentModel);
        currentModel = modelCache['ModelE.gltf'];
        scene.add(currentModel);
    }
    // Update button active state to reflect ground floor
    {
        const container = document.getElementById('button-container');
        if (container) {
            container.querySelectorAll('button').forEach(btn => btn.classList.remove('active'));
            const groundBtn = Array.from(container.querySelectorAll('button'))
                .find(b => b.textContent.trim() === 'Ground');
            if (groundBtn) groundBtn.classList.add('active');
        }
    }

    // Use waypoints from waypoints.gltf - greedy pathfinding to next closest waypoint that gets closer to room
    const floorKey = name.startsWith('U') ? 'U' : (name.startsWith('1') ? '1' : (name.startsWith('2') ? '2' : 'E'));
    
    navPoints = [];
    const destPoint = { x: doorPoint.x, z: doorPoint.z };
    
    // Get waypoints for ground floor
    const groundStart = window.waypointsData['E']?.['start']?.[0];
    const groundStairs = window.waypointsData['E']?.['stairs']?.[0];
    const groundIntersections = [];
    for (const [type, points] of Object.entries(window.waypointsData['E'] || {})) {
        if (type.includes('Intersection') || type.includes('intersection')) {
            groundIntersections.push(...points);
        }
    }
    console.log('Ground: start=', groundStart, 'stairs=', groundStairs, 'intersections=', groundIntersections.length, 'doorPoint=', doorPoint);
    
    // Get waypoints for target floor
    const targetStart = window.waypointsData[floorKey]?.['start']?.[0];
    const targetStairs = window.waypointsData[floorKey]?.['stairs']?.[0];
    const targetIntersections = [];
    for (const [type, points] of Object.entries(window.waypointsData[floorKey] || {})) {
        if (type.includes('Intersection') || type.includes('intersection')) {
            targetIntersections.push(...points);
        }
    }
    console.log('Target: start=', targetStart, 'stairs=', targetStairs, 'intersections=', targetIntersections.length);
    
// Build waypoint lists with Y coordinates (NO door - add it after greedy path)
    const groundWaypoints = [
        groundStart ? { ...groundStart, y: groundY } : null,
        ...groundIntersections.map(i => ({ ...i, y: groundY, isHallway: true })),
        groundStairs ? { ...groundStairs, y: groundY, isHallway: true } : null,
        { x: doorPoint.x, y: groundY, z: doorPoint.z, name: 'door_ground', isDoor: true }
    ].filter(Boolean);
    const targetWaypoints = [
        ...targetIntersections.map(i => ({ ...i, y: targetFloorY, isHallway: true })),
        targetStart ? { ...targetStart, y: targetFloorY, isHallway: true } : null,
        { x: doorPoint.x, y: targetFloorY, z: doorPoint.z, name: 'door_target', isDoor: true }
    ].filter(Boolean);
    
    // Start at ground floor entrance
    const startPos = groundStart ? { x: groundStart.x, y: groundY, z: groundStart.z } : { x: 4, y: groundY, z: -8 };
    navPoints.push(new THREE.Vector3(startPos.x, startPos.y, startPos.z));
    
    if (isGroundFloor) {
        // Always go to intersection one or two first (pick closest to start)
        const groundIntersectionsOneTwo = groundIntersections.filter(i => 
            i.name.includes('Intersection_one') || i.name.includes('Intersection_two')
        );
        let firstWP = null;
        if (groundIntersectionsOneTwo.length > 0) {
            let minDist = Infinity;
            for (const i of groundIntersectionsOneTwo) {
                const d = Math.hypot(i.x - startPos.x, i.z - startPos.z);
                if (d < minDist) { minDist = d; firstWP = i; }
            }
            if (firstWP) navPoints.push(new THREE.Vector3(firstWP.x, groundY, firstWP.z));
        }
        
        // Then greedy path to room from that intersection
        let current = firstWP ? { x: firstWP.x, y: groundY, z: firstWP.z } : { x: startPos.x, y: startPos.y, z: startPos.z };
        const visited = new Set();
        if (firstWP) visited.add(firstWP.name);
        
        while (true) {
            let bestWP = null;
            let bestScore = Infinity;
            
            for (const wp of groundWaypoints) {
                if (visited.has(wp.name)) continue;
                
                const distToWP = Math.hypot(wp.x - current.x, wp.z - current.z);
                const remainingToDest = Math.hypot(wp.x - destPoint.x, wp.z - destPoint.z);
                const currentToDest = Math.hypot(current.x - destPoint.x, current.z - destPoint.z);
                
                // Must get closer to destination
                if (remainingToDest >= currentToDest) continue;
                
                // Pick waypoint with best score (closest that gets closer)
                const score = distToWP;
                if (score < bestScore) {
                    bestScore = score;
                    bestWP = wp;
                }
            }
            
            if (!bestWP) break;
            visited.add(bestWP.name);
            current = { x: bestWP.x, y: bestWP.y, z: bestWP.z };
            navPoints.push(new THREE.Vector3(bestWP.x, bestWP.y, bestWP.z));
            
            // Stop at door - then go to room center
            if (bestWP.isDoor) {
                navPoints.push(new THREE.Vector3(endCenter.x, groundY, endCenter.z));
                break;
            }
        }
        
        // Fallback: if no waypoints were visited, go directly to door then room center
        if (navPoints.length === 1) {
            navPoints.push(new THREE.Vector3(doorPoint.x, groundY, doorPoint.z));
            navPoints.push(new THREE.Vector3(endCenter.x, groundY, endCenter.z));
        }
    } else {
        // Multi-floor: go to stairs first
        let current = { x: startPos.x, y: startPos.y, z: startPos.z };
        const visited = new Set();
        
        // Phase 1: Ground floor path to stairs
        while (groundStairs && !(Math.abs(current.x - groundStairs.x) < 0.1 && Math.abs(current.z - groundStairs.z) < 0.1)) {
            let bestWP = null;
            let bestScore = Infinity;
            
            for (const wp of groundWaypoints) {
                if (visited.has(wp.name)) continue;
                
                const distToWP = Math.hypot(wp.x - current.x, wp.z - current.z);
                const remainingToStairs = Math.hypot(wp.x - groundStairs.x, wp.z - groundStairs.z);
                const currentToStairs = Math.hypot(current.x - groundStairs.x, current.z - groundStairs.z);
                
                if (remainingToStairs >= currentToStairs) continue;
                
                const score = distToWP;
                if (score < bestScore) {
                    bestScore = score;
                    bestWP = wp;
                }
            }
            
            if (!bestWP) break;
            visited.add(bestWP.name);
            current = { x: bestWP.x, y: bestWP.y, z: bestWP.z };
            navPoints.push(new THREE.Vector3(bestWP.x, bestWP.y, bestWP.z));
        }
        
        // Add stairs transition
        if (groundStairs) {
            navPoints.push(new THREE.Vector3(groundStairs.x, groundY, groundStairs.z));
            navPoints.push(new THREE.Vector3(targetStairs?.x || groundStairs.x, targetFloorY, targetStairs?.z || groundStairs.z));
        }
        
        // Phase 2: After stairs, always go to start first
        if (targetStart) {
            navPoints.push(new THREE.Vector3(targetStart.x, targetFloorY, targetStart.z));
        }
        
        // Then always go to intersection one or two next (pick closest to start)
        const targetIntersectionsOneTwo = targetIntersections.filter(i => 
            i.name.includes('Intersection_one') || i.name.includes('Intersection_two')
        );
        let targetFirstWP = null;
        if (targetIntersectionsOneTwo.length > 0 && targetStart) {
            let minDist = Infinity;
            for (const i of targetIntersectionsOneTwo) {
                const d = Math.hypot(i.x - targetStart.x, i.z - targetStart.z);
                if (d < minDist) { minDist = d; targetFirstWP = i; }
            }
            if (targetFirstWP) navPoints.push(new THREE.Vector3(targetFirstWP.x, targetFloorY, targetFirstWP.z));
        }
        
// Then greedy path to room from start
        current = { 
            x: targetFirstWP?.x || targetStart?.x || targetStairs?.x || current.x, 
            y: targetFloorY, 
            z: targetFirstWP?.z || targetStart?.z || targetStairs?.z || current.z 
        };
        const visited2 = new Set();
        if (targetStart) visited2.add(targetStart.name);
        if (targetFirstWP) visited2.add(targetFirstWP.name);
        
        while (true) {
            let bestWP = null;
            let bestScore = Infinity;
            
            for (const wp of targetWaypoints) {
                if (visited2.has(wp.name)) continue;
                
                const distToWP = Math.hypot(wp.x - current.x, wp.z - current.z);
                const remainingToDest = Math.hypot(wp.x - destPoint.x, wp.z - destPoint.z);
                const currentToDest = Math.hypot(current.x - destPoint.x, current.z - destPoint.z);
                
                if (remainingToDest >= currentToDest) continue;
                
                const score = distToWP;
                if (score < bestScore) {
                    bestScore = score;
                    bestWP = wp;
                }
            }
            
            if (!bestWP) break;
            visited2.add(bestWP.name);
            current = { x: bestWP.x, y: bestWP.y, z: bestWP.z };
            navPoints.push(new THREE.Vector3(bestWP.x, bestWP.y, bestWP.z));
            
            // Stop at door - then go to room center
            if (bestWP.isDoor) {
                navPoints.push(new THREE.Vector3(endCenter.x, targetFloorY, endCenter.z));
                break;
            }
        }
        
        // Fallback: if only start was visited (no other waypoints), add door then room center
        if (navPoints.length <= 2) {
            navPoints.push(new THREE.Vector3(doorPoint.x, targetFloorY, doorPoint.z));
            navPoints.push(new THREE.Vector3(endCenter.x, targetFloorY, endCenter.z));
        }
    }
    
    // Find split index for floor transition
    let navSplitIdx = navPoints.length - 1;
    for (let i = 0; i < navPoints.length - 1; i++) {
        if (Math.abs(navPoints[i].y - groundY) < 0.1 && Math.abs(navPoints[i + 1].y - targetFloorY) < 0.1) {
            navSplitIdx = i + 1;
            break;
        }
    }
    const splitProgress = navSplitIdx / (navPoints.length - 1);
    
    // Create tube geometry from waypoints
    const curve = new THREE.CatmullRomCurve3(navPoints, false, 'catmullrom', 0);
    const tubeGeom = new THREE.TubeGeometry(curve, Math.max(128, navPoints.length * 2), 0.3, 8, false);
    const tubeMat  = new THREE.MeshBasicMaterial({ color: 0x2ecc71, transparent: true, opacity: 0.85, depthTest: false });
    navPath = new THREE.Mesh(tubeGeom, tubeMat);
    tubeGeom.setDrawRange(0, 0);
    navPath.renderOrder = 999;
    scene.add(navPath);

    // For multi-floor: build the ground-floor ghost tube (transparent, shown after floor switch)
    if (!isGroundFloor && navSplitIdx < navPoints.length - 1) {
        const lowerPts = navPoints.slice(0, navSplitIdx + 1);
        if (lowerPts.length >= 2) {
            const lowerCurve = new THREE.CatmullRomCurve3(lowerPts, false, 'catmullrom', 0);
            const lowerSubdivs = Math.max(64, lowerPts.length * 2);
            const lowerGeom = new THREE.TubeGeometry(lowerCurve, lowerSubdivs, 0.3, 8, false);
            const lowerMat  = new THREE.MeshBasicMaterial({ color: 0x2ecc71, transparent: true, opacity: 0.18, depthTest: false });
            navPathLower = new THREE.Mesh(lowerGeom, lowerMat);
            navPathLower.renderOrder = 997;
            // Added to scene only after the floor switches
        }
    }

    const dotGeom = new THREE.SphereGeometry(1.2, 16, 16);
    const dotMat  = new THREE.MeshBasicMaterial({ color: 0xe74c3c, depthTest: false });
    navDot = new THREE.Mesh(dotGeom, dotMat);
    navDot.position.copy(navPoints[0]);
    navDot.renderOrder = 1000;
    scene.add(navDot);

    if (navBtn) { navBtn.textContent = 'GO'; navBtn.style.opacity = '1'; }

    navAnimationProgress = 0;
    isNavigating = true;
    let floorSwitched = false;

    const totalVerts = tubeGeom.index ? tubeGeom.index.count : tubeGeom.attributes.position.count;

    const animateNav = () => {
        if (!isNavigating) return;
        navAnimationProgress += 0.003;
        if (navAnimationProgress >= 1) { navAnimationProgress = 1; isNavigating = false; }

        const point = curve.getPoint(navAnimationProgress);
        navDot.position.copy(point);

        // Switch to target floor model exactly when the staircase climb finishes
        if (!isGroundFloor && !floorSwitched && navAnimationProgress >= splitProgress) {
            // Directly switch model instead of calling showOnly (avoids extra logic)
            if (modelCache[floorId]) {
                if(currentModel) scene.remove(currentModel);
                currentModel = modelCache[floorId];
                scene.add(currentModel);
            }
            // Update button active state
            const floorLabel = { 'ModelU.gltf': 'Basement', 'Model1F.gltf': 'Floor\u00a01', 'Model2F.gltf': 'Floor\u00a02' }[floorId];
            const container = document.getElementById('button-container');
            if (container && floorLabel) {
                container.querySelectorAll('button').forEach(btn => btn.classList.remove('active'));
                const floorBtn = Array.from(container.querySelectorAll('button'))
                    .find(b => b.textContent.trim() === floorLabel.trim());
                if (floorBtn) floorBtn.classList.add('active');
            }
            floorSwitched = true;
            // Make the ghost ground-floor tube appear (transparent, always visible through model)
            if (navPathLower) {
                scene.add(navPathLower);
                const lv = navPathLower.geometry.index
                    ? navPathLower.geometry.index.count
                    : navPathLower.geometry.attributes.position.count;
                navPathLower.geometry.setDrawRange(0, lv);
            }
        }

        tubeGeom.setDrawRange(0, Math.floor(totalVerts * navAnimationProgress));

        if (navAnimationProgress < 1) {
            navTimer = requestAnimationFrame(animateNav);
        }
    };
    animateNav();
};

function animate(){
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    labelRenderer.setSize(window.innerWidth, window.innerHeight);
});

animate();

