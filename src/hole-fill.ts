import * as THREE from 'three';
import type { ModelObject } from './model';
type Data = NonNullable<ModelObject['geometryData']>;
export type Hole = { id:number; vertices:number[]; points:number[]; perimeter:number };
const edgeKey=(a:number,b:number)=>a<b?`${a},${b}`:`${b},${a}`;

export function findHoles(data:Data) {
  const positions:number[]=[],indices:number[]=[],weld=new Map<string,number>();
  const remap:number[]=[];
  for(let i=0;i<data.positions.length;i+=3){
    const point=data.positions.slice(i,i+3);
    if(point.length!==3 || !point.every(Number.isFinite))throw new Error('Ungültige Mesh-Koordinaten.');
    const key=point.map(v=>Math.round(v/1e-6)).join(',');let id=weld.get(key);
    if(id===undefined){id=positions.length/3;weld.set(key,id);positions.push(...point);}remap.push(id);
  }
  const source=data.indices??Array.from({length:remap.length},(_,i)=>i);
  if(source.length%3)throw new Error('Ungültige Dreiecksanzahl.');
  for(const id of source){if(!Number.isInteger(id)||id<0||id>=remap.length)throw new Error('Ungültiger Mesh-Index.');indices.push(remap[id]);}
  const edges=new Map<string,{a:number;b:number;count:number}>();
  for(let i=0;i<indices.length;i+=3){
    const triangle=indices.slice(i,i+3);if(new Set(triangle).size<3)throw new Error('Degenerierte Flächen: Bitte zuerst Mesh reparieren.');
    for(let j=0;j<3;j++){const a=triangle[j],b=triangle[(j+1)%3],key=edgeKey(a,b);const edge=edges.get(key);if(edge)edge.count++;else edges.set(key,{a,b,count:1});}
  }
  const boundary=[...edges.values()].filter(e=>e.count===1),adj=new Map<number,number[]>();
  for(let i=0;i<boundary.length;i++)for(const id of [boundary[i].a,boundary[i].b]){const list=adj.get(id)??[];list.push(i);adj.set(id,list);}
  const visited=new Set<number>(),holes:Hole[]=[];let ambiguous=0;
  for(let i=0;i<boundary.length;i++){
    if(visited.has(i))continue;
    const component:number[]=[],queue=[i];visited.add(i);
    for(let q=0;q<queue.length;q++){
      const e=boundary[queue[q]];component.push(queue[q]);
      for(const v of [e.a,e.b])for(const n of adj.get(v)??[])if(!visited.has(n)){visited.add(n);queue.push(n);}
    }
    if(component.some(e=>[boundary[e].a,boundary[e].b].some(v=>adj.get(v)?.length!==2))){ambiguous++;continue;}
    const vertices=[boundary[i].a];let current=boundary[i].b,last=i;let consistent=true;
    while(current!==vertices[0]){
      vertices.push(current);const next=adj.get(current)!.find(e=>e!==last)!;const edge=boundary[next];
      if(edge.a!==current)consistent=false;
      current=edge.a===current?edge.b:edge.a;last=next;
      if(vertices.length>component.length)throw new Error('Rand konnte nicht geschlossen verfolgt werden.');
    }
    if(!consistent || vertices.length<3){ambiguous++;continue;}
    let perimeter=0;const points=vertices.flatMap(v=>positions.slice(v*3,v*3+3));
    for(let j=0;j<vertices.length;j++)perimeter+=new THREE.Vector3(...points.slice(j*3,j*3+3) as [number,number,number]).distanceTo(new THREE.Vector3(...points.slice(((j+1)%vertices.length)*3,((j+1)%vertices.length)*3+3) as [number,number,number]));
    holes.push({id:holes.length,vertices,points,perimeter});
  }
  return {geometryData:{positions,indices},holes,ambiguous,nonManifoldEdges:[...edges.values()].filter(e=>e.count>2).length};
}

export function fillHole(data:Data,holeId:number,bulge=0) {
  if(!Number.isFinite(bulge))throw new Error('Ungültige Wölbung.');
  const analysis=findHoles(data),hole=analysis.holes.find(h=>h.id===holeId);
  if(!hole)throw new Error('Öffnung nicht mehr vorhanden. Bitte neu erkennen.');
  if(hole.vertices.length>4096)throw new Error('Der Rand ist sehr komplex (>4096 Punkte). Bitte Mesh zuerst vereinfachen.');
  const {positions,indices}=analysis.geometryData;
  const point=(id:number)=>new THREE.Vector3(...positions.slice(id*3,id*3+3) as [number,number,number]);
  // Reverse the existing boundary so new faces share each edge with opposite winding.
  const border=[...hole.vertices].reverse();
  const normal=new THREE.Vector3();
  for(let i=0;i<border.length;i++)normal.add(point(border[i]).cross(point(border[(i+1)%border.length])));
  if(normal.lengthSq()<1e-16)throw new Error('Rand nicht eindeutig projizierbar. Bitte Mesh prüfen.');normal.normalize();
  const u=new THREE.Vector3().crossVectors(Math.abs(normal.y)<.9?new THREE.Vector3(0,1,0):new THREE.Vector3(1,0,0),normal).normalize();
  const v=new THREE.Vector3().crossVectors(normal,u);
  const origin=point(border[0]);const projected=border.map(id=>{const p=point(id).sub(origin);return new THREE.Vector2(p.dot(u),p.dot(v));});
  const cross=(a:THREE.Vector2,b:THREE.Vector2,c:THREE.Vector2)=>new THREE.Vector2().subVectors(b,a).cross(new THREE.Vector2().subVectors(c,a));
  const scale=Math.max(...projected.map(p=>p.length()),1),epsilon=scale*scale*1e-12;
  // Ear clipping assumes a simple projected contour; reject crossing/overlapping edges.
  for(let i=0;i<projected.length;i++)for(let j=i+1;j<projected.length;j++){
    if(j===i+1 || (i===0&&j===projected.length-1))continue;
    const a=projected[i],b=projected[(i+1)%projected.length],c=projected[j],d=projected[(j+1)%projected.length];
    const abC=cross(a,b,c),abD=cross(a,b,d),cdA=cross(c,d,a),cdB=cross(c,d,b);
    if(abC*abD<=epsilon*epsilon && cdA*cdB<=epsilon*epsilon && Math.max(Math.min(a.x,b.x),Math.min(c.x,d.x))<=Math.min(Math.max(a.x,b.x),Math.max(c.x,d.x))+1e-10 && Math.max(Math.min(a.y,b.y),Math.min(c.y,d.y))<=Math.min(Math.max(a.y,b.y),Math.max(c.y,d.y))+1e-10)throw new Error('Der Rand überlappt in der Projektion. Automatisches Füllen wäre mehrdeutig.');
  }
  let faces=THREE.ShapeUtils.triangulateShape(projected,[]).map(t=>t.map(i=>border[i]));
  if(faces.length!==border.length-2)throw new Error('Rand konnte nicht vollständig trianguliert werden.');
  const boundaryEdges=new Set(border.map((a,i)=>edgeKey(a,border[(i+1)%border.length])));
  // Refine only interior edges; the existing mesh boundary stays bit-for-bit attached.
  const baseVertexCount=positions.length/3;
  for(let pass=0;pass<2;pass++){
    const mids=new Map<string,number>(),next:number[][]=[];
    for(const triangle of faces){
      const polygon:number[]=[];
      for(let j=0;j<3;j++){
        const a=triangle[j],b=triangle[(j+1)%3],key=edgeKey(a,b);polygon.push(a);
        if(!boundaryEdges.has(key)){
          let mid=mids.get(key);if(mid===undefined){mid=positions.length/3;positions.push(...point(a).add(point(b)).multiplyScalar(.5).toArray());mids.set(key,mid);}polygon.push(mid);
        }
      }
      const center=positions.length/3;positions.push(...triangle.reduce((sum,id)=>sum.add(point(id)),new THREE.Vector3()).multiplyScalar(1/3).toArray());
      for(let j=0;j<polygon.length;j++)next.push([polygon[j],polygon[(j+1)%polygon.length],center]);
    }
    faces=next;
  }
  const neighbours=new Map<number,Set<number>>();
  for(const face of faces)for(let j=0;j<3;j++){const set=neighbours.get(face[j])??new Set<number>();set.add(face[(j+1)%3]);set.add(face[(j+2)%3]);neighbours.set(face[j],set);}
  for(let pass=0;pass<12;pass++){
    const changes=new Map<number,THREE.Vector3>();
    for(const [id,near] of neighbours)if(id>=baseVertexCount)changes.set(id,[...near].reduce((sum,n)=>sum.add(point(n)),new THREE.Vector3()).multiplyScalar(1/near.size));
    const previous=new Map([...changes.keys()].map(id=>[id,point(id)]));
    const sign=Math.sign(point(faces[0][1]).sub(point(faces[0][0])).cross(point(faces[0][2]).sub(point(faces[0][0]))).dot(normal));
    let accepted=false;
    for(let step=1;step>1/1024;step/=2){
      for(const [id,target]of changes){const p=previous.get(id)!.clone().lerp(target,step);positions[id*3]=p.x;positions[id*3+1]=p.y;positions[id*3+2]=p.z;}
      if(faces.every(face=>sign*point(face[1]).sub(point(face[0])).cross(point(face[2]).sub(point(face[0]))).dot(normal)>1e-20)){accepted=true;break;}
    }
    if(!accepted)for(const [id,p]of previous){positions[id*3]=p.x;positions[id*3+1]=p.y;positions[id*3+2]=p.z;}
  }
  if(bulge){
    const distances=new Map<number,number>();let maxDistance=0;
    for(const id of neighbours.keys())if(id>=baseVertexCount){
      const p=point(id);let distance=Infinity;
      for(let i=0;i<border.length;i++){const line=new THREE.Line3(point(border[i]),point(border[(i+1)%border.length]));distance=Math.min(distance,p.distanceTo(line.closestPointToPoint(p,true,new THREE.Vector3())));}
      distances.set(id,distance);maxDistance=Math.max(maxDistance,distance);
    }
    for(const [id,distance]of distances){const p=point(id).addScaledVector(normal,bulge*distance/Math.max(maxDistance,1e-10));positions[id*3]=p.x;positions[id*3+1]=p.y;positions[id*3+2]=p.z;}
  }
  const patch=faces.flat();
  // ShapeUtils may normalize polygon winding. Explicitly match it to the mesh boundary.
  const directed=new Set(border.map((a,i)=>`${a},${border[(i+1)%border.length]}`));
  const firstFace=faces.find(face=>face.some((a,i)=>boundaryEdges.has(edgeKey(a,face[(i+1)%3]))));
  if(!firstFace)throw new Error('Verschlussfläche hat keinen Randanschluss.');
  const directionCorrect=firstFace.some((a,i)=>directed.has(`${a},${firstFace[(i+1)%3]}`));
  if(!directionCorrect)for(let i=0;i<patch.length;i+=3)[patch[i+1],patch[i+2]]=[patch[i+2],patch[i+1]];
  // Refuse degenerate fills instead of committing a broken mesh.
  for(let i=0;i<patch.length;i+=3)if(point(patch[i+1]).sub(point(patch[i])).cross(point(patch[i+2]).sub(point(patch[i]))).lengthSq()<1e-20)throw new Error('Die Verschlussfläche enthält degenerierte Dreiecke.');
  const patchPositions=patch.flatMap(id=>positions.slice(id*3,id*3+3));
  const bounds=new THREE.Box3();for(let i=0;i<positions.length;i+=3)bounds.expandByPoint(new THREE.Vector3(positions[i],positions[i+1],positions[i+2]));
  return {geometryData:{positions,indices:[...indices,...patch]},patchPositions,dimensions:bounds.getSize(new THREE.Vector3()).toArray(),triangles:patch.length/3};
}
