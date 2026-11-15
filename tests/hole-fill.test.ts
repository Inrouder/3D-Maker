import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { findHoles,fillHole } from '../src/hole-fill.ts';
const dataFor=(geometry:THREE.BufferGeometry)=>({positions:Array.from(geometry.getAttribute('position').array),indices:geometry.index?Array.from(geometry.index.array):null});
test('detect two cylinder openings and close only one, then close the other',()=>{
  const geometry=new THREE.CylinderGeometry(10,10,20,24,1,true),data=dataFor(geometry);
  const found=findHoles(data);assert.equal(found.holes.length,2);
  const result=fillHole(data,0);assert.equal(findHoles(result.geometryData).holes.length,1);
  const closed=fillHole(result.geometryData,0);assert.equal(findHoles(closed.geometryData).holes.length,0);
  assert.equal(findHoles(closed.geometryData).nonManifoldEdges,0);
  assert.deepEqual(result.geometryData.positions.slice(0,found.geometryData.positions.length),found.geometryData.positions);
  geometry.dispose();
});
test('STL triangle soup is welded and patch uses every existing boundary edge oppositely',()=>{
  const geometry=new THREE.CylinderGeometry(10,10,20,16,1,true).toNonIndexed();
  const data=dataFor(geometry),before=findHoles(data),after=fillHole(data,0),edgeMap=new Map<string,number[]>();
  const ids=after.geometryData.indices!;
  for(let i=0;i<ids.length;i+=3)for(let j=0;j<3;j++){const a=ids[i+j],b=ids[i+(j+1)%3],key=a<b?`${a},${b}`:`${b},${a}`,list=edgeMap.get(key)??[];list.push(a<b?1:-1);edgeMap.set(key,list);}
  for(let i=0;i<before.holes[0].vertices.length;i++){
    const a=before.holes[0].vertices[i],b=before.holes[0].vertices[(i+1)%before.holes[0].vertices.length];
    const edge=edgeMap.get(a<b?`${a},${b}`:`${b},${a}`)!;assert.equal(edge.length,2);assert.equal(edge[0]+edge[1],0);
  }
  geometry.dispose();
});
test('concave non-planar contour keeps boundary exact and supports bulge',()=>{
  const positions=[0,0,0,4,0,.2,4,4,0,2,2,.3,0,4,0,0,0,-2,4,0,-2,4,4,-2,2,2,-2,0,4,-2],indices:number[]=[];
  for(let i=0;i<5;i++){const next=(i+1)%5;indices.push(i,next,next+5,i,next+5,i+5);}
  const data={positions,indices},found=findHoles(data);assert.equal(found.holes.length,2);
  const flat=fillHole(data,0),curved=fillHole(data,0,1);
  assert.equal(findHoles(curved.geometryData).holes.length,1);
  assert.deepEqual(curved.geometryData.positions.slice(0,positions.length),found.geometryData.positions);
  assert.notDeepEqual(curved.patchPositions,flat.patchPositions);
});
test('closed manifold and branched boundary do not offer unsafe filling',()=>{
  const geometry=new THREE.BoxGeometry(10,10,10);assert.equal(findHoles(dataFor(geometry)).holes.length,0);
  assert.throws(()=>fillHole(dataFor(geometry),0));geometry.dispose();
  const data={positions:[0,0,0,1,0,0,0,1,0,-1,0,0,0,-1,0],indices:[0,1,2,0,3,4]};
  assert.equal(findHoles(data).holes.length,0);assert.equal(findHoles(data).ambiguous,1);
});
test('projected self-intersecting boundary is rejected without changing source',()=>{
  const data={positions:[0,0,0,4,4,0,0,4,0,4,0,0,0,0,-2,4,4,-2,0,4,-2,4,0,-2],indices:[0,1,5,0,5,4,1,2,6,1,6,5,2,3,7,2,7,6,3,0,4,3,4,7]};
  const snapshot=JSON.stringify(data);assert.throws(()=>fillHole(data,0));assert.equal(JSON.stringify(data),snapshot);
});

test('collinear boundary vertices remain attached to the cap',()=>{
  const ring=[[0,0],[2,0],[4,0],[4,2],[4,4],[2,4],[0,4],[0,2]];
  const positions=[...ring.flatMap(p=>[...p,0]),...ring.flatMap(p=>[...p,-2])],indices:number[]=[];
  for(let i=0;i<ring.length;i++){const n=(i+1)%ring.length;indices.push(i,n,n+ring.length,i,n+ring.length,i+ring.length);}
  const result=fillHole({positions,indices},0);assert.equal(findHoles(result.geometryData).holes.length,1);
});
