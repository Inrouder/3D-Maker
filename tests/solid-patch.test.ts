import test from 'node:test';
import assert from 'node:assert/strict';
import Module from 'manifold-3d';
import * as THREE from 'three';
import {makePatch,toSolid,unitePatch,prepareVolume} from '../src/solid-patch.ts';
const libPromise=Module().then(lib=>{lib.setup();return lib;});
const ring=Array.from({length:24},(_,i)=>{const angle=i*Math.PI*2/24;return [Math.cos(angle)*3.7,Math.sin(angle)*3.7,1];});
test('solid patch seals an actual thick-walled passage and shares one closed volume',async()=>{
  const lib=await libPromise;
  const outer=lib.Manifold.cylinder(2,6,6,48,true),inner=lib.Manifold.cylinder(4,3,3,48,true),base=outer.subtract(inner);
  try{
    assert.equal(base.genus(),1);
    const patch=makePatch(ring,[0,0,20],1.5,0,.15,.3);
    const result=unitePatch(lib,base,patch.geometryData);
    assert.equal(result.genusAfter,0);assert.equal(result.genusBefore,1);assert.ok(result.volumeAdded>0);
    const verified=toSolid(lib,result.geometryData);try{assert.equal(verified.status(),'NoError');assert.equal(verified.genus(),0);}finally{verified.delete();}
  }finally{base.delete();outer.delete();inner.delete();}
});
test('floating or misplaced solids are not accepted as successful hole closures',async()=>{
  const lib=await libPromise,base=lib.Manifold.cube([10,10,2],true);
  try{
    const patch=makePatch(ring.map(p=>[p[0]+30,p[1],p[2]]),[30,0,20],1,0);
    assert.throws(()=>unitePatch(lib,base,patch.geometryData),/berührt/);
    const onFace=makePatch(ring,[0,0,20],1,0);
    assert.throws(()=>unitePatch(lib,base,onFace.geometryData),/Durchgang/);
  }finally{base.delete();}
});
test('local preparation preserves coordinates and closes a small defect without taking over large openings',()=>{
  const geometry=new THREE.BoxGeometry(10,10,10).toNonIndexed();
  const positions=Array.from(geometry.getAttribute('position').array);geometry.dispose();
  const clean=prepareVolume({positions,indices:null},false);assert.equal(clean.repairCaps,0);assert.equal(clean.removedFaces,0);
  const cylinder=new THREE.CylinderGeometry(3,3,10,16,1,true).toNonIndexed();
  assert.throws(()=>prepareVolume({positions:Array.from(cylinder.getAttribute('position').array),indices:null},true),/größere offene/);cylinder.dispose();
});
test('patch rejects invalid parameters and returns a closed non-planar body',async()=>{
  assert.throws(()=>makePatch(ring,[0,0,20],-1,0));assert.throws(()=>makePatch(ring,[0,0,20],1,0,.15,-1));
  const data=makePatch(ring.map((p,i)=>[p[0],p[1],p[2]+.1*Math.sin(i)]),[0,0,20],1.5,.3).geometryData;
  const lib=await libPromise,solid=toSolid(lib,data);try{assert.equal(solid.status(),'NoError');assert.ok(solid.volume()>0);}finally{solid.delete();}
});

test('a curved patch keeps its wall thickness instead of independently crossing front/back caps',async()=>{
  const points=ring.map((p,i)=>[p[0],p[1],p[2]+Math.sin(i*.7)*.8]);
  const depth=1.5,overlap=.15,patch=makePatch(points,[0,0,20],depth,.6,overlap,.4);
  const data=patch.geometryData,n=points.length,normal=new THREE.Vector3(...patch.normal as [number,number,number]);let projectedArea=0;
  for(let i=0;i<n;i++){
    const a=new THREE.Vector3(...data.positions.slice(i*3,i*3+3) as [number,number,number]);
    const next=(i+1)%n,b=new THREE.Vector3(...data.positions.slice(next*3,next*3+3) as [number,number,number]);projectedArea+=a.cross(b).dot(normal)/2;
  }
  const lib=await libPromise,solid=toSolid(lib,data);
  try{assert.equal(solid.status(),'NoError');assert.ok(Math.abs(solid.volume()-Math.abs(projectedArea)*(depth+overlap))<.001);}finally{solid.delete();}
});

test('small non-manifold damage is locally remeshed into a valid closed solid',async()=>{
  const g=new THREE.BoxGeometry(50,50,50,50,50,50),positions=Array.from(g.getAttribute('position').array),indices=Array.from(g.index!.array);g.dispose();
  indices.push(...indices.slice(2551*3,2551*3+3));
  assert.throws(()=>prepareVolume({positions,indices},false),/Topologiefehler/);
  const prepared=prepareVolume({positions,indices},true);assert.ok(prepared.removedFaces>0);assert.ok(prepared.removedFaces<100);assert.ok(prepared.repairCaps>0);
  const lib=await libPromise,solid=toSolid(lib,prepared.geometryData);
  try{assert.equal(solid.status(),'NoError');assert.ok(Math.abs(solid.volume()-125000)<.001);}finally{solid.delete();}
});

test('closing one of two passages leaves the other opening in the cross section',async()=>{
  const lib=await libPromise,box=lib.Manifold.cube([26,14,2],true),a=lib.Manifold.cylinder(4,3,3,48,true).translate([-6,0,0]),b=lib.Manifold.cylinder(4,3,3,48,true).translate([6,0,0]),cut=box.subtract(a),base=cut.subtract(b);
  try{
    assert.equal(base.genus(),2);
    const patch=makePatch(ring.map(p=>[p[0]+6,p[1],p[2]]),[6,0,20],1.5,0,.15,.3);
    const result=unitePatch(lib,base,patch.geometryData),solid=toSolid(lib,result.geometryData),section=solid.slice(0);
    try{
      assert.equal(solid.genus(),1);const loops=section.toPolygons();assert.equal(loops.length,2);
      const centers=loops.map(loop=>loop.reduce((sum,p)=>sum+p[0],0)/loop.length);assert.ok(centers.some(x=>x<-5));
    }finally{section.delete();solid.delete();}
  }finally{base.delete();cut.delete();box.delete();a.delete();b.delete();}
});
