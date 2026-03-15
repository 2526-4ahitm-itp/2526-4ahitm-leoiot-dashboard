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
const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
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


// Materials
const baseMaterial = new THREE.MeshStandardMaterial({
    color: 0xdddddd, // Flat light grey for the clay look
    roughness: 0.9,
    metalness: 0.0
});

// Restored original glass material
const glassMaterial = new THREE.MeshStandardMaterial({
    color: 0x111111,  // dark glass
    roughness: 0.9,
    metalness: 0,
    transparent: true,
    opacity: 0.5
});

// Load models
const modelIds = ['ModelBasement.gltf','ModelE.gltf','Model1F.gltf','Model2F.gltf','ModelFull.gltf'];
const modelCache = {};
let currentModel = null;
let clickedObject = null;

const loader = new GLTFLoader();

modelIds.forEach(id => {
    loader.load(`./${id}`, (gltf) => {
        modelCache[id] = gltf.scene;

        modelCache[id].traverse(child => {
            if(child.isMesh){
                child.castShadow = true;
                child.receiveShadow = true;

                if(child.name.toLowerCase().includes('window') || child.name.includes('GLAS')){
                    child.material = glassMaterial;
                } else {
                    child.material = baseMaterial;
                }

                // CRITICAL: Ensure no "outline" or "edges" are added here
                // If you had "child.add(outline)" before, remove it.
            }
        });

        if(id === 'ModelFull.gltf'){
            currentModel = gltf.scene;
            scene.add(currentModel);
        }
    });
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
};

// Handle window resizing
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
window.addEventListener('click', (event) => {
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
            clickedObject.material.color.set(0xff0000);
        }

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
    buttonElement.classList.add('active');

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