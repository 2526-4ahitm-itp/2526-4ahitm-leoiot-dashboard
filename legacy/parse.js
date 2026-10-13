const fs = require('fs');

function parse(file) {
  const content = fs.readFileSync(file, 'utf8');
  const json = JSON.parse(content);
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const n of json.nodes) {
    if (n.name && /^[EU12]/.test(n.name)) {
      // translation is not directly there. The mesh vertices are in binary.
      // We can't easily parse without GLTFLoader.
    }
  }
}
parse('frontend/Model1F.gltf');
