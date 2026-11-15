import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
self.onmessage=event=>{
  let geometry:THREE.BufferGeometry|undefined;
  try {
    if(event.data.extension==='stl') geometry=new STLLoader().parse(event.data.buffer);
    else {
      const root=new OBJLoader().parse(new TextDecoder().decode(event.data.buffer));root.updateMatrixWorld(true);
      const parts:THREE.BufferGeometry[]=[];
      root.traverse(child=>{
        if(!(child instanceof THREE.Mesh))return;
        const part=child.geometry.index?child.geometry.toNonIndexed():child.geometry.clone();
        part.applyMatrix4(child.matrixWorld);
        for(const name of Object.keys(part.attributes))if(name!=='position')part.deleteAttribute(name);
        parts.push(part);
        child.geometry.dispose();
      });
      geometry=mergeGeometries(parts,false)??undefined;parts.forEach(part=>part.dispose());
    }
    if(!geometry || !geometry.getAttribute('position') || geometry.getAttribute('position').count<3)throw new Error('Keine gültige Mesh-Geometrie gefunden.');
    const attr=geometry.getAttribute('position');
    for(let i=0;i<attr.array.length;i++)if(!Number.isFinite(attr.array[i]))throw new Error('Mesh enthält ungültige Koordinaten.');
    geometry.computeBoundingBox();
    const center=geometry.boundingBox!.getCenter(new THREE.Vector3()),size=geometry.boundingBox!.getSize(new THREE.Vector3());
    geometry.translate(-center.x,-center.y,-center.z);
    self.postMessage({result:{position:center.toArray(),dimensions:size.toArray(),geometryData:{positions:Array.from(attr.array),indices:geometry.index?Array.from(geometry.index.array):null}}});
  }catch(error){self.postMessage({error:error instanceof Error?error.message:'Import fehlgeschlagen.'});}
  finally{geometry?.dispose();}
};
