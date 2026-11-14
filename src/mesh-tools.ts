import * as THREE from 'three';
import type { ModelObject } from './model';

export function repairGeometry(data: NonNullable<ModelObject['geometryData']>) {
  const positions: number[] = [], indices: number[] = [];
  const vertices = new Map<string, number>(), faces = new Set<string>();
  let removed = 0;
  const count = data.indices?.length ?? data.positions.length / 3;
  for (let i = 0; i < count; i += 3) {
    const points = [0,1,2].map(j => {
      const offset = (data.indices ? data.indices[i+j] : i+j) * 3;
      return new THREE.Vector3(...data.positions.slice(offset, offset+3) as [number,number,number]);
    });
    if (points.some(p => ![p.x,p.y,p.z].every(Number.isFinite)) || new THREE.Vector3().subVectors(points[1],points[0]).cross(new THREE.Vector3().subVectors(points[2],points[0])).lengthSq() <= 1e-20) { removed++; continue; }
    const triangle = points.map(p => {
      const key = [p.x,p.y,p.z].map(v => Math.round(v / 1e-6)).join(',');
      let index = vertices.get(key);
      if (index === undefined) { index = positions.length / 3; vertices.set(key,index); positions.push(p.x,p.y,p.z); }
      return index;
    });
    const key = [...triangle].sort((a,b)=>a-b).join(',');
    if (new Set(triangle).size !== 3 || faces.has(key)) { removed++; continue; }
    faces.add(key); indices.push(...triangle);
  }
  if (!indices.length) throw new Error('Keine gültigen Dreiecke nach der Reparatur.');
  // Reconcile neighbouring face winding, without guessing the inside of open surfaces.
  const edges = new Map<string, {face:number; direction:number}[]>();
  for(let i=0;i<indices.length;i+=3) for(let j=0;j<3;j++) {
    const a=indices[i+j], b=indices[i+(j+1)%3], key=a<b?`${a},${b}`:`${b},${a}`;
    const entries=edges.get(key) ?? []; entries.push({face:i/3,direction:a<b?1:-1}); edges.set(key,entries);
  }
  const neighbours = new Map<number, {face:number; flip:boolean}[]>();
  for(const entries of edges.values()) if(entries.length===2) {
    const [a,b]=entries;
    for(const [from,to] of [[a,b],[b,a]]) {const list=neighbours.get(from.face)??[];list.push({face:to.face,flip:from.direction===to.direction});neighbours.set(from.face,list);}
  }
  const flipped = new Map<number,boolean>();
  for(let face=0;face<indices.length/3;face++) {
    if(flipped.has(face))continue;
    flipped.set(face,false);const queue=[face];
    for(let q=0;q<queue.length;q++) for(const next of neighbours.get(queue[q])??[]) if(!flipped.has(next.face)) {flipped.set(next.face,flipped.get(queue[q])!==next.flip);queue.push(next.face);}
    // For closed components use signed volume to orient surfaces outwards.
    let volume=0;
    for(const f of queue) {
      const ids=indices.slice(f*3,f*3+3);if(flipped.get(f))ids.reverse();
      const [a,b,c]=ids.map(id=>new THREE.Vector3(...positions.slice(id*3,id*3+3) as [number,number,number]));volume+=a.dot(b.cross(c));
    }
    const closed=queue.every(f=>[0,1,2].every(j=>{const a=indices[f*3+j],b=indices[f*3+(j+1)%3];return edges.get(a<b?`${a},${b}`:`${b},${a}`)?.length===2;}));
    for(const f of queue) if(Boolean(flipped.get(f)) !== (closed && volume<0)) [indices[f*3+1],indices[f*3+2]]=[indices[f*3+2],indices[f*3+1]];
  }
  return { geometryData:{positions,indices}, removed, boundaryEdges:[...edges.values()].filter(v=>v.length===1).length, nonManifoldEdges:[...edges.values()].filter(v=>v.length>2).length };
}
