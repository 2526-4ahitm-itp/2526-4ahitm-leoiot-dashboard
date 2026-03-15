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


const loader = new GLTFLoader();

modelIds.forEach(id => {
    loader.load(`./${id}`, (gltf) => {
        modelCache[id] = gltf.scene;

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

window.addEventListener('click', (event) => {
    // 1. Calculate mouse position in normalized device coordinates (-1 to +1)
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // 2. Update the raycaster with the camera and mouse position
    raycaster.setFromCamera(mouse, camera);

    // 3. Calculate objects intersecting the picking ray
    // "true" allows it to search deep into the model groups
    const intersects = raycaster.intersectObjects(scene.children, true);

    if (intersects.length > 0) {
        const clickedObject = intersects[0].object;

        if (clickedObject.name.startsWith('E') ||
            clickedObject.name.startsWith('U') ||
            clickedObject.name.startsWith('1') ||
            clickedObject.name.startsWith('2')) {
            console.log('You clicked on: ' + clickedObject.name);

            // Example: Change color of the clicked classroom
            clickedObject.material.color.set(0xff0000);
        }


    }
});