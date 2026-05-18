import * as THREE from 'three';
import * as WebIFC from 'web-ifc';

export interface SpatialNode {
  expressID: number;
  type: string;
  name: string;
  globalId?: string;
  children: SpatialNode[];
}

let ifcApi: WebIFC.IfcAPI | null = null;

async function initIfcApi(): Promise<WebIFC.IfcAPI> {
  if (ifcApi) return ifcApi;
  ifcApi = new WebIFC.IfcAPI();
  // Using unpkg CDN to load the WASM logic required by web-ifc in the browser snippet
  ifcApi.SetWasmPath('https://unpkg.com/web-ifc@0.0.56/');
  await ifcApi.Init();
  return ifcApi;
}

export async function processIfc(
  file: File,
  onProgress: (msg: string) => void
): Promise<{ rootGroup: THREE.Group; spatialTree: SpatialNode }> {
  const api = await initIfcApi();
  
  onProgress('Reading file...');
  const data = new Uint8Array(await file.arrayBuffer());
  
  onProgress('Parsing IFC model...');
  const modelID = api.OpenModel(data);
  
  try {
    onProgress('Extracting geometries...');
    const meshesByExpressId = new Map<number, THREE.Group>();
    
    // We stream all geometries to get their vertices/indices and convert them to THREE.js Meshes
    api.StreamAllMeshes(modelID, (mesh: WebIFC.FlatMesh) => {
      const expressID = mesh.expressID;
      const placedGeometries = mesh.geometries;
      const size = placedGeometries.size();
      
      const group = new THREE.Group();
      group.name = `Geometries_${expressID}`;
      
      for (let i = 0; i < size; i++) {
        const placedGeometry = placedGeometries.get(i);
        const geometry = api.GetGeometry(modelID, placedGeometry.geometryExpressID);
        
        const verts = api.GetVertexArray(geometry.GetVertexData(), geometry.GetVertexDataSize()) as Float32Array;
        const indices = api.GetIndexArray(geometry.GetIndexData(), geometry.GetIndexDataSize()) as Uint32Array;
        
        const threeGeom = new THREE.BufferGeometry();
        
        // web-ifc vertex format: x, y, z, nx, ny, nz
        const pos = new Float32Array(verts.length / 2);
        const norm = new Float32Array(verts.length / 2);
        
        for (let j = 0, k = 0; j < verts.length; j += 6, k += 3) {
          pos[k] = verts[j];
          pos[k + 1] = verts[j + 1];
          pos[k + 2] = verts[j + 2];
          norm[k] = verts[j + 3];
          norm[k + 1] = verts[j + 4];
          norm[k + 2] = verts[j + 5];
        }
        
        threeGeom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        threeGeom.setAttribute('normal', new THREE.BufferAttribute(norm, 3));
        threeGeom.setIndex(new THREE.BufferAttribute(indices, 1));
        
        const color = placedGeometry.color;
        const material = new THREE.MeshStandardMaterial({
          color: new THREE.Color(color.x, color.y, color.z),
          transparent: color.w < 1,
          opacity: color.w,
          side: THREE.DoubleSide
        });
        
        const threeMesh = new THREE.Mesh(threeGeom, material);
        
        const matrix = new THREE.Matrix4().fromArray(placedGeometry.flatTransformation);
        threeMesh.applyMatrix4(matrix);
        
        group.add(threeMesh);
      }
      
      meshesByExpressId.set(expressID, group);
    });

    onProgress('Extracting spatial hierarchy...');
    const projectIds = api.GetLineIDsWithType(modelID, WebIFC.IFCPROJECT);
    if (projectIds.size() === 0) {
      throw new Error("No IfcProject found in the file.");
    }
    const projectID = projectIds.get(0);
    
    // Build adjacency map (parentId -> childIds)
    const childrenMap = new Map<number, number[]>();
    
    const relAggs = api.GetLineIDsWithType(modelID, WebIFC.IFCRELAGGREGATES);
    for (let i = 0; i < relAggs.size(); i++) {
        const relId = relAggs.get(i);
        const rel = api.GetLine(modelID, relId);
        const parentId = rel.RelatingObject?.value;
        const childIds = rel.RelatedObjects?.map((r: any) => r.value) || [];
        if (parentId != null) {
            if (!childrenMap.has(parentId)) childrenMap.set(parentId, []);
            childrenMap.get(parentId)!.push(...childIds);
        }
    }
    
    const relConts = api.GetLineIDsWithType(modelID, WebIFC.IFCRELCONTAINEDINSPATIALSTRUCTURE);
    for (let i = 0; i < relConts.size(); i++) {
        const relId = relConts.get(i);
        const rel = api.GetLine(modelID, relId);
        const parentId = rel.RelatingStructure?.value;
        const childIds = rel.RelatedElements?.map((r: any) => r.value) || [];
        if (parentId != null) {
            if (!childrenMap.has(parentId)) childrenMap.set(parentId, []);
            childrenMap.get(parentId)!.push(...childIds);
        }
    }

    function traverseTree(expressID: number): SpatialNode {
      const line = api.GetLine(modelID, expressID);
      const type = line?.constructor?.name || 'Unknown';
      let name = line?.Name?.value || type;
      if (name === type && line?.GlobalId?.value) {
        name = `${type} [${line.GlobalId.value.substring(0, 8)}]`;
      }
      
      const node: SpatialNode = {
        expressID,
        type,
        name,
        globalId: line?.GlobalId?.value,
        children: []
      };
      
      const childIds = childrenMap.get(expressID) || [];
      for (const cid of childIds) {
        node.children.push(traverseTree(cid));
      }
      return node;
    }
    
    const spatialTree = traverseTree(projectID);
    
    onProgress('Building 3D hierarchy...');
    function buildThreeTree(node: SpatialNode): THREE.Group {
      const group = new THREE.Group();
      group.name = node.name;
      group.userData = { expressID: node.expressID, type: node.type, globalId: node.globalId };
      
      if (meshesByExpressId.has(node.expressID)) {
        group.add(meshesByExpressId.get(node.expressID)!);
      }
      
      for (const child of node.children) {
        group.add(buildThreeTree(child));
      }
      return group;
    }
    
    const rootGroup = buildThreeTree(spatialTree);
    
    // Normalize model orientation (IFC is often Z-Up, THREE.js is Y-Up)
    // Actually, usually in web-ifc it's handled or we just leave it for the viewer to adjust.
    // It is best to export exactly how it was parsed to avoid rotation matrix in root.
    // So we don't apply any static rotations out of the gate unless requested.
    
    onProgress('Done.');
    return { rootGroup, spatialTree };
  } finally {
    // Free WASM memory
    api.CloseModel(modelID);
  }
}
