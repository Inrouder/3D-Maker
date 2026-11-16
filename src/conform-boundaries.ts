import * as THREE from 'three';
import type {MeshData} from './solid-patch';
// CSG may leave T junctions: one face has A--B while its neighbour has A--C--B.
// Join boundary vertices within floating-point tolerance, then split unmatched
// edges at existing vertices. Triangle interiors retain their source planes.
export function conformBoundaries(data:MeshData,welded=false):{geometryData:MeshData;stitchedEdges:number;removedFaces:number}{
  const positions=[...data.positions],ids=data.indices!,n=positions.length/3;
  const key=(a:number,b:number)=>Math.min(a,b)*n+Math.max(a,b);
  const edges=new Map<number,{a:number;b:number;count:number}>();
  for(let i=0;i<ids.length;i+=3)for(let j=0;j<3;j++){const a=ids[i+j],b=ids[i+(j+1)%3],k=key(a,b),e=edges.get(k);if(e)e.count++;else edges.set(k,{a,b,count:1});}
  const boundary=[...edges.values()].filter(e=>e.count===1),vertices=[...new Set(boundary.flatMap(e=>[e.a,e.b]))];
  if(!vertices.length)return {geometryData:data,stitchedEdges:0,removedFaces:0};
  if(!welded){
    const box=new THREE.Box3();for(const id of vertices)box.expandByPoint(new THREE.Vector3(...positions.slice(id*3,id*3+3) as [number,number,number]));
    const eps=Math.max(1e-6,box.getSize(new THREE.Vector3()).length()*1e-6),grid=new Map<string,number[]>(),remap=new Map<number,number>();
    for(const id of vertices){
      const p=positions.slice(id*3,id*3+3),cell=p.map(v=>Math.floor(v/eps));let match:number|undefined;
      for(let x=-1;x<=1&&match===undefined;x++)for(let y=-1;y<=1&&match===undefined;y++)for(let z=-1;z<=1&&match===undefined;z++)for(const candidate of grid.get(`${cell[0]+x},${cell[1]+y},${cell[2]+z}`)??[]){if(p.reduce((sum,v,axis)=>sum+(v-positions[candidate*3+axis])**2,0)<=eps*eps){match=candidate;break;}}
      if(match!==undefined)remap.set(id,match);else{const key=cell.join(',');const bucket=grid.get(key)??[];bucket.push(id);grid.set(key,bucket);}
    }
    const cleaned:number[]=[],verticesSet=new Set(vertices);
    for(let i=0;i<ids.length;i+=3){const tri=ids.slice(i,i+3).map(id=>remap.get(id)??id),[a,b,c]=tri.map(id=>new THREE.Vector3(...positions.slice(id*3,id*3+3) as [number,number,number]));const ab=b.clone().sub(a),ac=c.clone().sub(a),maxEdge=Math.max(ab.length(),ac.length(),b.distanceTo(c));if(new Set(tri).size<3||(tri.some(id=>verticesSet.has(id))&&ab.clone().cross(ac).length()<=eps*maxEdge))continue;cleaned.push(...tri);}
    const result=conformBoundaries({positions,indices:cleaned},true);
    return {...result,removedFaces:result.removedFaces+(ids.length-cleaned.length)/3};
  }
  const sorted=[0,1,2].map(axis=>[...vertices].sort((a,b)=>positions[a*3+axis]-positions[b*3+axis]));
  const bounds=new THREE.Box3();for(let i=0;i<positions.length;i+=3)bounds.expandByPoint(new THREE.Vector3(positions[i],positions[i+1],positions[i+2]));
  const tolerance=Math.max(1e-6,bounds.getSize(new THREE.Vector3()).length()*1e-6),splits=new Map<number,number[]>();
  let checks=0;
  for(const edge of boundary){
    const a=new THREE.Vector3(...positions.slice(edge.a*3,edge.a*3+3) as [number,number,number]),b=new THREE.Vector3(...positions.slice(edge.b*3,edge.b*3+3) as [number,number,number]),delta=b.clone().sub(a),length=delta.length(),axis=Math.abs(delta.x)>=Math.abs(delta.y)&&Math.abs(delta.x)>=Math.abs(delta.z)?0:Math.abs(delta.y)>=Math.abs(delta.z)?1:2;
    if(length<=tolerance)continue;
    const lo=Math.min(a.getComponent(axis),b.getComponent(axis))-tolerance,hi=Math.max(a.getComponent(axis),b.getComponent(axis))+tolerance,list=sorted[axis];
    let left=0,right=list.length;while(left<right){const mid=(left+right)>>>1;if(positions[list[mid]*3+axis]<lo)left=mid+1;else right=mid;}
    const found:{id:number;t:number}[]=[];
    for(let i=left;i<list.length&&positions[list[i]*3+axis]<=hi;i++){
      if(++checks>20000000)throw new Error('Zu viele offene Kanten für eine lokale Verbindung. Bitte Mesh zuerst reparieren.');
      const id=list[i];if(id===edge.a||id===edge.b)continue;
      const p=new THREE.Vector3(...positions.slice(id*3,id*3+3) as [number,number,number]),t=p.clone().sub(a).dot(delta)/(length*length);
      if(t*length<=tolerance||(1-t)*length<=tolerance)continue;
      if(p.distanceToSquared(a.clone().addScaledVector(delta,t))<=tolerance*tolerance)found.push({id,t});
    }
    if(found.length)splits.set(key(edge.a,edge.b),found.sort((a,b)=>a.t-b.t).map(p=>p.id));
  }
  if(!splits.size)return {geometryData:data,stitchedEdges:0,removedFaces:0};
  const indices:number[]=[];
  for(let i=0;i<ids.length;i+=3){
    const polygon:number[]=[];let changed=false;
    for(let j=0;j<3;j++){const a=ids[i+j],b=ids[i+(j+1)%3];polygon.push(a);const split=splits.get(key(a,b));if(split){const edge=edges.get(key(a,b))!;polygon.push(...(edge.a===a?split:[...split].reverse()));changed=true;}}
    if(!changed){indices.push(ids[i],ids[i+1],ids[i+2]);continue;}
    const center=positions.length/3;for(let axis=0;axis<3;axis++)positions.push((data.positions[ids[i]*3+axis]+data.positions[ids[i+1]*3+axis]+data.positions[ids[i+2]*3+axis])/3);
    for(let j=0;j<polygon.length;j++)indices.push(polygon[j],polygon[(j+1)%polygon.length],center);
  }
  return {geometryData:{positions,indices},stitchedEdges:splits.size,removedFaces:0};
}
