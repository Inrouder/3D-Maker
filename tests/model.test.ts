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
const project = (objects: unknown[]) => ({ format:'3dmaker-project', version:1, objects });
test('valid project round trips', () => assert.deepEqual(validateProject(project([model()])).objects,[model()]));
for (const [name, patch] of Object.entries({ missingVector:{position:null}, infinite:{rotation:[0,Infinity,0]}, zeroSize:{dimensions:[1,0,1]}, negativeScale:{scale:[-1,1,1]}, unknownType:{type:'oops'}, badColor:{color:null}, badGeometry:{geometryData:{positions:[0,0,0],indices:null}}, badIndex:{geometryData:{positions:[0,0,0,1,0,0,0,1,0],indices:[0,1,99]}} })) {
  test(`reject malformed project: ${name}`, () => assert.throws(()=>validateProject(project([{...model(),...patch}]))));
}
test('reject duplicate IDs and unsupported versions', () => {
  assert.throws(()=>validateProject(project([model(),model()])));
  assert.throws(()=>validateProject({...project([]),version:2}));
});
