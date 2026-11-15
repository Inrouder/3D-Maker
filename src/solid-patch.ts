import * as THREE from 'three';
import type { ModelObject } from './model';
import { findHoles, fillHole } from './hole-fill';
import type { ManifoldToplevel, Manifold as Solid } from 'manifold-3d';
export type MeshData=NonNullable<ModelObject['geometryData']>;
const edgeKey=(a:number,b:number,n:number)=>Math.min(a,b)*n+Math.max(a,b);

export function prepareVolume(data:MeshData,allowRepair=true) {
  let indexed=findHoles(data).geometryData;
  let removedFaces=0,repairCaps=0;
  const initialFaces=indexed.indices!.length/3;
  const bounds=new THREE.Box3();for(let i=0;i<indexed.positions.length;i+=3)bounds.expandByPoint(new THREE.Vector3(...indexed.positions.slice(i,i+3) as [number,number,number]));
  const maxRepairPerimeter=bounds.getSize(new THREE.Vector3()).length()*.12;
  for(let pass=0;pass<5;pass++){
    const ids=indexed.indices!,n=indexed.positions.length/3,counts=new Map<number,{a:number;b:number;count:number}>();
    for(let i=0;i<ids.length;i+=3)for(let j=0;j<3;j++){
      const a=ids[i+j],b=ids[i+(j+1)%3],key=edgeKey(a,b,n),edge=counts.get(key);
      if(edge)edge.count++;else counts.set(key,{a,b,count:1});
    }
    const bad=new Set<number>(),degree=new Map<number,number>();
    for(const edge of counts.values()){
      if(edge.count>2){bad.add(edge.a);bad.add(edge.b);}
      if(edge.count===1){degree.set(edge.a,(degree.get(edge.a)??0)+1);degree.set(edge.b,(degree.get(edge.b)??0)+1);}
    }
    for(const [v,count]of degree)if(count!==2)bad.add(v);
    if(!bad.size)break;
    if(!allowRepair)throw new Error('Das Mesh enthält Topologiefehler. Kleine Meshfehler bereinigen aktivieren oder das Modell vorher reparieren.');
    const kept:number[]=[];
    for(let i=0;i<ids.length;i+=3){if(bad.has(ids[i])||bad.has(ids[i+1])||bad.has(ids[i+2]))removedFaces++;else kept.push(ids[i],ids[i+1],ids[i+2]);}
    if(removedFaces>Math.max(100,initialFaces*.01))throw new Error('Zu viele fehlerhafte Flächen: automatische lokale Bereinigung abgebrochen. Original bleibt unverändert.');
    indexed={positions:indexed.positions,indices:kept};
  }
  let analysis=findHoles(indexed);
  if(analysis.ambiguous || analysis.nonManifoldEdges)throw new Error('Topologie lässt sich nicht eindeutig lokal bereinigen.');
  if(analysis.holes.length && !allowRepair)throw new Error('Der Körper besitzt offene Ränder. Rand-Modus nutzen oder kleine Fehlstellen bereinigen.');
  indexed=analysis.geometryData;
  const baseN=indexed.positions.length/3,existingEdges=new Set<number>();
  for(let i=0;i<indexed.indices!.length;i+=3)for(let j=0;j<3;j++)existingEdges.add(edgeKey(indexed.indices![i+j],indexed.indices![i+(j+1)%3],baseN));
  for(const hole of analysis.holes){
    if(hole.perimeter>maxRepairPerimeter || hole.vertices.length>128)throw new Error('Der Körper besitzt eine größere offene Kontur. Bitte dafür zunächst den Rand-Modus verwenden.');
    // Small folded defects need a spatial cap; a planar projection may overlap.
    // Minimum-area dynamic programming preserves all original boundary vertices.
    const ring=[...hole.vertices].reverse(),n=ring.length;
    const cost=Array.from({length:n},()=>new Float64Array(n)),split=Array.from({length:n},()=>new Int32Array(n).fill(-1));
    const points=ring.map(id=>new THREE.Vector3(...indexed.positions.slice(id*3,id*3+3) as [number,number,number]));
    for(let span=2;span<n;span++)for(let i=0;i+span<n;i++){
      const j=i+span;cost[i][j]=Infinity;
      for(let k=i+1;k<j;k++){
        const allowed=(a:number,b:number)=>Math.abs(a-b)===1 || (a===0&&b===n-1) || (b===0&&a===n-1) || !existingEdges.has(edgeKey(ring[a],ring[b],baseN));
        if(!allowed(i,k)||!allowed(k,j)||!allowed(i,j))continue;
        const area=points[k].clone().sub(points[i]).cross(points[j].clone().sub(points[i])).length()/2;
        if(area<1e-16)continue;
        const value=cost[i][k]+cost[k][j]+area;
        if(value<cost[i][j]){cost[i][j]=value;split[i][j]=k;}
      }
    }
    const triangles:number[]=[];
    if(!Number.isFinite(cost[0][n-1])){
      const center=points.reduce((sum,p)=>sum.add(p),new THREE.Vector3()).multiplyScalar(1/n);
      const normal=new THREE.Vector3();for(let i=0;i<n;i++)normal.add(points[i].clone().sub(center).cross(points[(i+1)%n].clone().sub(center)));
      if(normal.lengthSq()>1e-20)center.addScaledVector(normal.normalize(),hole.perimeter*1e-4);
      const id=indexed.positions.length/3;indexed.positions.push(...center.toArray());
      for(let i=0;i<n;i++)triangles.push(ring[i],ring[(i+1)%n],id);
    }else {
    const emit=(i:number,j:number)=>{if(j-i<2)return;const k=split[i][j];if(k<0)throw new Error('Fehlstelle ist degeneriert.');triangles.push(ring[i],ring[k],ring[j]);emit(i,k);emit(k,j);};emit(0,n-1);
    }
    indexed.indices!.push(...triangles);repairCaps++;
  }
  analysis=findHoles(indexed);
  if(analysis.holes.length||analysis.ambiguous||analysis.nonManifoldEdges)throw new Error(`Lokale Bereinigung liefert keinen geschlossenen Körper (${analysis.holes.length} Ränder, ${analysis.ambiguous} mehrdeutig, ${analysis.nonManifoldEdges} nicht-manifold).`);
  return {geometryData:analysis.geometryData,removedFaces,repairCaps,maxRepairPerimeter};
}

export function makePatch(points:number[][],viewpoint:number[],depth:number,bulge:number,overlap=.15,margin=.8) {
  if(points.length<5 || points.length>128)throw new Error('Bitte mindestens fünf Punkte entlang des Randes markieren.');
  if(!Number.isFinite(depth)||depth<=0 || !Number.isFinite(bulge)||!Number.isFinite(overlap)||overlap<0||!Number.isFinite(margin)||margin<0)throw new Error('Ungültige Dicke oder Wölbung.');
  if(!points.every(p=>p.length===3&&p.every(Number.isFinite)))throw new Error('Ungültige Randkoordinaten.');
  const contour=points.map(p=>new THREE.Vector3(...p as [number,number,number]));
  const center=contour.reduce((sum,p)=>sum.add(p),new THREE.Vector3()).multiplyScalar(1/contour.length);
  const normal=new THREE.Vector3();for(let i=0;i<contour.length;i++)normal.add(contour[i].clone().sub(center).cross(contour[(i+1)%contour.length].clone().sub(center)));
  if(normal.lengthSq()<1e-12)throw new Error('Markierung hat keine eindeutige Fläche.');normal.normalize();
  if(normal.dot(new THREE.Vector3(...viewpoint as [number,number,number]).sub(center))<0){contour.reverse();normal.negate();}
  for(const p of contour){const tangent=p.clone().sub(center).addScaledVector(normal,-p.clone().sub(center).dot(normal));if(tangent.lengthSq()>1e-16)p.addScaledVector(tangent.normalize(),margin);}
  const n=contour.length,positions:number[]=[],indices:number[]=[];
  for(const p of contour)positions.push(...p.clone().addScaledVector(normal,overlap).toArray());
  for(const p of contour)positions.push(...p.clone().addScaledVector(normal,-depth).toArray());
  for(let i=0;i<n;i++){const j=(i+1)%n;indices.push(i,i+n,j,j,i+n,j+n);}
  let analysis=findHoles({positions,indices});
  const front=[...analysis.holes].sort((a,b)=>{const score=(h:typeof a)=>h.vertices.reduce((sum,id)=>sum+new THREE.Vector3(...analysis.geometryData.positions.slice(id*3,id*3+3) as [number,number,number]).sub(center).dot(normal),0)/h.vertices.length;return score(b)-score(a);})[0];
  if(!front)throw new Error('Vorderseite des Verschlusses konnte nicht bestimmt werden.');
  const filled=fillHole(analysis.geometryData,front.id,bulge);
  const frontFaces=filled.geometryData.indices!.slice(indices.length);
  const backMap=new Map<number,number>(Array.from({length:n},(_,i)=>[i,i+n]));
  const backVertex=(id:number)=>{
    let back=backMap.get(id);
    if(back===undefined){
      const p=new THREE.Vector3(...filled.geometryData.positions.slice(id*3,id*3+3) as [number,number,number]).addScaledVector(normal,-depth-overlap);
      back=filled.geometryData.positions.length/3;filled.geometryData.positions.push(...p.toArray());backMap.set(id,back);
    }
    return back;
  };
  // Translate the SAME triangulation. Independent caps can cross on curved rims
  // and create paper-thin spots despite nominal wall thickness.
  for(let i=0;i<frontFaces.length;i+=3)filled.geometryData.indices!.push(backVertex(frontFaces[i]),backVertex(frontFaces[i+2]),backVertex(frontFaces[i+1]));
  return {geometryData:filled.geometryData,normal:normal.toArray()};
}

export function toSolid(lib:ManifoldToplevel,data:MeshData):Solid {
  const mesh=new lib.Mesh({numProp:3,vertProperties:Float32Array.from(data.positions),triVerts:Uint32Array.from(data.indices??Array.from({length:data.positions.length/3},(_,i)=>i))});
  return new lib.Manifold(mesh);
}
export function fromSolid(solid:Solid):MeshData {
  const mesh=solid.getMesh();const positions:number[]=[];
  for(let i=0;i<mesh.vertProperties.length;i+=mesh.numProp)positions.push(mesh.vertProperties[i],mesh.vertProperties[i+1],mesh.vertProperties[i+2]);
  return {positions,indices:Array.from(mesh.triVerts)};
}
export function unitePatch(lib:ManifoldToplevel,base:Solid,patchData:MeshData){
  const patch=toSolid(lib,patchData);let intersection:Solid|undefined,result:Solid|undefined;
  try{
    intersection=base.intersect(patch);
    if(intersection.volume()<1e-7)throw new Error('Verschluss berührt das Modell nicht ausreichend. Markierung auf Material legen oder Dicke erhöhen.');
    result=base.add(patch);const volumeAdded=result.volume()-base.volume();
    if(volumeAdded<1e-7)throw new Error('Der Verschluss liegt vollständig im vorhandenen Material. Bitte das Armloch umfahren.');
    if(result.genus()>=base.genus())throw new Error('Der Durchgang ist noch nicht vollständig geschlossen. Rand weiter außen markieren oder Dicke erhöhen.');
    return {geometryData:fromSolid(result),volumeAdded,genusBefore:base.genus(),genusAfter:result.genus()};
  }finally{intersection?.delete();result?.delete();patch.delete();}
}
