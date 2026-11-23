import * as THREE from 'three';
import type {ModelObject} from './model';
export const PROJECT_VERSION=2;
export const LEGACY_TO_Z_UP=new THREE.Matrix4().set(0,0,1,0, 1,0,0,0, 0,1,0,0, 0,0,0,1);
export const zUpTuple=(v:number[]):[number,number,number]=>[v[2],v[0],v[1]];
export function migrateLegacyObject(obj:ModelObject):ModelObject{
  const oldRotation=new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...obj.rotation.map(THREE.MathUtils.degToRad) as [number,number,number]));
  const rotation=new THREE.Euler().setFromRotationMatrix(LEGACY_TO_Z_UP.clone().multiply(oldRotation).multiply(LEGACY_TO_Z_UP.clone().invert()),'XYZ');
  const geometryData=obj.geometryData?{...obj.geometryData,positions:obj.geometryData.positions.map((_,i,a)=>a[Math.floor(i/3)*3+[2,0,1][i%3]])}:undefined;
  // Rotation changes basis as P*R*inverse(P), not by permuting Euler angles.
  return {...obj,position:zUpTuple(obj.position),dimensions:zUpTuple(obj.dimensions),scale:zUpTuple(obj.scale),rotation:[rotation.x,rotation.y,rotation.z].map(THREE.MathUtils.radToDeg) as [number,number,number],...(geometryData?{geometryData}:{})};
}
export function resizeObject(obj:ModelObject,key:'position'|'rotation'|'dimensions'|'scale',axis:number,value:number,uniform=false):ModelObject{
  const minimum=key==='dimensions'?.1:key==='scale'?.01:undefined;
  const target=minimum===undefined?value:Math.max(minimum,value);
  if(!Number.isFinite(target))return obj;
  let vector=[...obj[key]] as [number,number,number];
  if(uniform&&(key==='dimensions'||key==='scale')){
    const factor=Math.max(target/vector[axis],...vector.map(v=>minimum!/v));
    vector=vector.map(v=>v*factor) as [number,number,number];
  }else vector[axis]=target;
  return {...obj,[key]:vector};
}
