// Minimal glTF 2.0 reader: just enough to get node world transforms and
// decode POSITION/NORMAL/indices for named nodes. No extensions, no skins.
import { readFileSync } from 'node:fs';

function decodeDataUri(uri) {
  const m = /^data:[^;]+;base64,(.*)$/s.exec(uri);
  if (!m) throw new Error('not a data uri');
  return Buffer.from(m[1], 'base64');
}

export function loadGltf(path) {
  const json = JSON.parse(readFileSync(path, 'utf8'));
  const buffers = json.buffers.map((b) => decodeDataUri(b.uri));

  function accessorArray(index) {
    const acc = json.accessors[index];
    const bv = json.bufferViews[acc.bufferView];
    const buf = buffers[bv.buffer];
    const compSizes = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
    const typeComponents = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
    const nComp = typeComponents[acc.type];
    const compSize = compSizes[acc.componentType];
    const stride = bv.byteStride || nComp * compSize;
    const base = (bv.byteOffset || 0) + (acc.byteOffset || 0);
    const out = new Float64Array(acc.count * nComp);
    for (let i = 0; i < acc.count; i++) {
      const off = base + i * stride;
      for (let c = 0; c < nComp; c++) {
        const o = off + c * compSize;
        let v;
        if (acc.componentType === 5126) v = buf.readFloatLE(o);
        else if (acc.componentType === 5125) v = buf.readUInt32LE(o);
        else if (acc.componentType === 5123) v = buf.readUInt16LE(o);
        else if (acc.componentType === 5121) v = buf.readUInt8(o);
        else throw new Error(`componentType ${acc.componentType} not supported`);
        out[i * nComp + c] = v;
      }
    }
    return out;
  }

  // World transform per node (identity composition; these models use plain T/R/S, default identity).
  function multiply(a, b) {
    const r = new Array(16).fill(0);
    for (let c = 0; c < 4; c++)
      for (let row = 0; row < 4; row++)
        for (let k = 0; k < 4; k++) r[c * 4 + row] += a[k * 4 + row] * b[c * 4 + k];
    return r;
  }
  function trsMatrix(node) {
    if (node.matrix) return node.matrix;
    const [tx, ty, tz] = node.translation || [0, 0, 0];
    const [qx, qy, qz, qw] = node.rotation || [0, 0, 0, 1];
    const [sx, sy, sz] = node.scale || [1, 1, 1];
    // quaternion to rotation matrix
    const x2 = qx + qx, y2 = qy + qy, z2 = qz + qz;
    const xx = qx * x2, xy = qx * y2, xz = qx * z2;
    const yy = qy * y2, yz = qy * z2, zz = qz * z2;
    const wx = qw * x2, wy = qw * y2, wz = qw * z2;
    const m = [
      (1 - (yy + zz)) * sx, (xy + wz) * sx, (xz - wy) * sx, 0,
      (xy - wz) * sy, (1 - (xx + zz)) * sy, (yz + wx) * sy, 0,
      (xz + wy) * sz, (yz - wx) * sz, (1 - (xx + yy)) * sz, 0,
      tx, ty, tz, 1,
    ];
    return m;
  }
  function applyMatrix(m, [x, y, z]) {
    return [
      m[0] * x + m[4] * y + m[8] * z + m[12],
      m[1] * x + m[5] * y + m[9] * z + m[13],
      m[2] * x + m[6] * y + m[10] * z + m[14],
    ];
  }

  const worldMatrix = new Map();
  function visit(nodeIndex, parentMatrix) {
    const node = json.nodes[nodeIndex];
    const local = trsMatrix(node);
    const world = parentMatrix ? multiply(parentMatrix, local) : local;
    worldMatrix.set(nodeIndex, world);
    for (const c of node.children || []) visit(c, world);
  }
  for (const root of json.scenes[json.scene || 0].nodes) visit(root, null);

  const nodesByName = new Map();
  json.nodes.forEach((n, i) => {
    if (n.name) {
      const arr = nodesByName.get(n.name) || [];
      arr.push(i);
      nodesByName.set(n.name, arr);
    }
  });

  function nodeTriangles(nodeIndex) {
    const node = json.nodes[nodeIndex];
    if (node.mesh === undefined) return [];
    const mesh = json.meshes[node.mesh];
    const m = worldMatrix.get(nodeIndex);
    const tris = [];
    for (const prim of mesh.primitives) {
      const pos = accessorArray(prim.attributes.POSITION);
      const nrm = prim.attributes.NORMAL !== undefined ? accessorArray(prim.attributes.NORMAL) : null;
      const idx = prim.indices !== undefined ? accessorArray(prim.indices) : null;
      const vertCount = pos.length / 3;
      const getPos = (i) => applyMatrix(m, [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]]);
      const getNrm = (i) => (nrm ? [nrm[i * 3], nrm[i * 3 + 1], nrm[i * 3 + 2]] : null);
      const indices = idx || Array.from({ length: vertCount }, (_, i) => i);
      for (let i = 0; i + 2 < indices.length; i += 3) {
        const a = indices[i], b = indices[i + 1], c = indices[i + 2];
        tris.push({ a: getPos(a), b: getPos(b), c: getPos(c), na: getNrm(a), nb: getNrm(b), nc: getNrm(c) });
      }
    }
    return tris;
  }

  function nodeBoundsXZ(nodeIndex) {
    const node = json.nodes[nodeIndex];
    if (node.mesh === undefined) return null;
    const mesh = json.meshes[node.mesh];
    const m = worldMatrix.get(nodeIndex);
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const prim of mesh.primitives) {
      const acc = json.accessors[prim.attributes.POSITION];
      // accessor min/max are in local space; since all these models use identity
      // node transforms, use world-transformed corners of the local AABB to be safe.
      const [lx0, ly0, lz0] = acc.min;
      const [lx1, ly1, lz1] = acc.max;
      for (const x of [lx0, lx1]) for (const y of [ly0, ly1]) for (const z of [lz0, lz1]) {
        const [wx, wy, wz] = applyMatrix(m, [x, y, z]);
        minX = Math.min(minX, wx); maxX = Math.max(maxX, wx);
        minZ = Math.min(minZ, wz); maxZ = Math.max(maxZ, wz);
        minY = Math.min(minY, wy); maxY = Math.max(maxY, wy);
      }
    }
    return { minX, maxX, minZ, maxZ, minY, maxY };
  }

  return { json, nodesByName, nodeTriangles, nodeBoundsXZ };
}
