import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { geometryFor, validateProject } from '../src/model.ts';
import type { ModelObject } from '../src/model.ts';
const model = (): ModelObject => ({ id:'one', name:'Test', type:'box', color:'#43b6a8', position:[0,0,0], rotation:[20,45,15], scale:[1,1,1], dimensions:[30,12,18] });
for (const type of ['box','sphere','cylinder','cone'] as const) {
  test(`${type}: all three local dimensions match the actual geometry`, () => {
    const obj = { ...model(), type };
    const geometry = geometryFor(obj);
    geometry.computeBoundingBox();
    const size = geometry.boundingBox!.getSize(new THREE.Vector3());
    size.toArray().forEach((v,i) => assert.ok(Math.abs(v-obj.dimensions[i]) < .001));
    geometry.dispose();
  });
}
test('changing width after rotation preserves rotation and independent depth', () => {
  const obj=model(); obj.dimensions[0]=52;
  const mesh=new THREE.Mesh(geometryFor(obj));
  mesh.rotation.set(...obj.rotation.map(THREE.MathUtils.degToRad) as [number,number,number]);
  mesh.geometry.computeBoundingBox();
  assert.deepEqual(mesh.geometry.boundingBox!.getSize(new THREE.Vector3()).toArray(), [52,12,18]);
  assert.ok(Math.abs(mesh.rotation.y-Math.PI/4)<1e-10);
  mesh.geometry.dispose();
});
const project = (objects: unknown[]) => ({ format:'3dmaker-project', version:2, objects });
test('valid project round trips', () => assert.deepEqual(validateProject(project([model()])).objects,[model()]));
for (const [name, patch] of Object.entries({ missingVector:{position:null}, infinite:{rotation:[0,Infinity,0]}, zeroSize:{dimensions:[1,0,1]}, negativeScale:{scale:[-1,1,1]}, unknownType:{type:'oops'}, badColor:{color:null}, badGeometry:{geometryData:{positions:[0,0,0],indices:null}}, badIndex:{geometryData:{positions:[0,0,0,1,0,0,0,1,0],indices:[0,1,99]}} })) {
  test(`reject malformed project: ${name}`, () => assert.throws(()=>validateProject(project([{...model(),...patch}]))));
}
test('reject duplicate IDs and unsupported versions', () => {
  assert.throws(()=>validateProject(project([model(),model()])));
  assert.throws(()=>validateProject({...project([]),version:3}));
});

test('repair removes duplicate and degenerate faces and reports open edges', async()=>{
  const {repairGeometry}=await import('../src/mesh-tools.ts');
  const result=repairGeometry({positions:[0,0,0,1,0,0,0,1,0],indices:[0,1,2,2,1,0,0,0,1]});
  assert.equal(result.removed,2);assert.equal(result.boundaryEdges,3);assert.equal(result.geometryData.indices.length,3);
});
test('repair keeps closed cube manifold and corrects inverted normals',async()=>{
  const {repairGeometry}=await import('../src/mesh-tools.ts');
  const geometry=new THREE.BoxGeometry(10,10,10).toNonIndexed();
  const positions=Array.from(geometry.getAttribute('position').array);
  const inverted=Array.from({length:positions.length/3},(_,i)=>i);
  for(let i=0;i<inverted.length;i+=3)[inverted[i+1],inverted[i+2]]=[inverted[i+2],inverted[i+1]];
  const result=repairGeometry({positions,indices:inverted});
  assert.equal(result.boundaryEdges,0);assert.equal(result.nonManifoldEdges,0);
  assert.equal(result.geometryData.indices.length,36);
  let volume=0;
  for(let i=0;i<result.geometryData.indices.length;i+=3){
    const [a,b,c]=result.geometryData.indices.slice(i,i+3).map(id=>new THREE.Vector3(...result.geometryData.positions.slice(id*3,id*3+3) as [number,number,number]));
    volume+=a.dot(b.cross(c))/6;
  }
  assert.ok(Math.abs(volume-1000)<.001);geometry.dispose();
});

test('legacy projects preserve world surfaces through the Z-up basis change',async()=>{
  const {LEGACY_TO_Z_UP}=await import('../src/coordinates.ts');
  for(const type of ['box','cone','sphere','cylinder','custom'] as const){
    const obj={...model(),type,position:[11,-7,23],scale:[2,.7,1.5],groupId:'g'} as ModelObject;
    let old:THREE.BufferGeometry;
    if(type==='cone')old=new THREE.ConeGeometry(15,12,64).scale(1,1,18/30);
    else if(type==='cylinder')old=new THREE.CylinderGeometry(15,15,12,64).scale(1,1,18/30);
    else if(type==='sphere')old=new THREE.SphereGeometry(15,48,32).scale(1,12/30,18/30);
    else old=new THREE.BoxGeometry(30,12,18);
    if(type==='custom')obj.geometryData={positions:Array.from(old.getAttribute('position').array),indices:Array.from(old.index!.array)};
    const before=JSON.stringify(obj),migrated=validateProject({format:'3dmaker-project',version:1,objects:[obj]}).objects[0];
    const geometry=geometryFor(migrated);
    const matrix=(o:ModelObject)=>new THREE.Matrix4().compose(new THREE.Vector3(...o.position),new THREE.Quaternion().setFromEuler(new THREE.Euler(...o.rotation.map(THREE.MathUtils.degToRad) as [number,number,number])),new THREE.Vector3(...o.scale));
    const oldWorld=LEGACY_TO_Z_UP.clone().multiply(matrix(obj)),newWorld=matrix(migrated);
    for(let i=0;i<old.getAttribute('position').count;i++){
      const a=new THREE.Vector3().fromBufferAttribute(old.getAttribute('position'),i).applyMatrix4(oldWorld),b=new THREE.Vector3().fromBufferAttribute(geometry.getAttribute('position'),i).applyMatrix4(newWorld);
      assert.ok(a.distanceTo(b)<1e-4,`${type} vertex ${i}`);
    }
    assert.equal(JSON.stringify(obj),before);assert.equal(migrated.groupId,'g');
    assert.deepEqual(validateProject({format:'3dmaker-project',version:2,objects:[migrated]}).objects,[migrated]);
    old.dispose();geometry.dispose();
  }
});
test('uniform edits preserve proportions, rotation and minimum sizes',async()=>{
  const {resizeObject}=await import('../src/coordinates.ts');
  const obj={...model(),scale:[2,1,3]} as ModelObject;
  assert.deepEqual(resizeObject(obj,'dimensions',0,60,true).dimensions,[60,24,36]);
  assert.deepEqual(resizeObject(obj,'scale',1,2,true).scale,[4,2,6]);
  assert.deepEqual(resizeObject(obj,'dimensions',0,60,false).dimensions,[60,12,18]);
  const small=resizeObject(obj,'dimensions',0,-1,true);assert.ok(small.dimensions.every(v=>v>=.1));assert.ok(Math.abs(small.dimensions[0]/small.dimensions[1]-2.5)<1e-10);
  assert.deepEqual(small.rotation,obj.rotation);assert.deepEqual(small.position,obj.position);
});
test('new cylinders and cones use Z as their height',()=>{
  for(const type of ['cylinder','cone'] as const){const g=geometryFor({...model(),type,dimensions:[20,20,90]});g.computeBoundingBox();assert.ok(Math.abs(g.boundingBox!.max.z-45)<1e-5);assert.ok(Math.abs(g.boundingBox!.min.z+45)<1e-5);g.dispose();}
});
