import {useEffect} from 'react';
import * as THREE from 'three';
export type ActiveField={axis:number;kind:'position'|'rotation'|'dimensions'|'scale'};
export const AXIS_COLORS=[0xf05d68,0x57ce86,0x568dff];
export default function AxisHighlight({scene,mesh,field}:{scene:THREE.Scene;mesh:THREE.Mesh;field:ActiveField}){
  useEffect(()=>{
    mesh.updateWorldMatrix(true,false);mesh.geometry.computeBoundingBox();
    const bounds=mesh.geometry.boundingBox;if(!bounds||bounds.isEmpty())return;
    const group=new THREE.Group(),color=AXIS_COLORS[field.axis],center=bounds.getCenter(new THREE.Vector3()).applyMatrix4(mesh.matrixWorld);
    const size=bounds.getSize(new THREE.Vector3()).multiply(mesh.scale).length(),length=Math.max(size*.7,12);
    const axis=new THREE.Vector3().setComponent(field.axis,1);
    if(field.kind==='rotation'){
      // Euler XYZ: X is world X; Y follows Rx; Z follows Rx*Ry.
      const rotation=new THREE.Matrix4().makeRotationX(mesh.rotation.x);
      if(field.axis===2)rotation.multiply(new THREE.Matrix4().makeRotationY(mesh.rotation.y));
      if(field.axis>0)axis.transformDirection(rotation);
    }else if(field.kind!=='position')axis.transformDirection(mesh.matrixWorld);
    const arrow=new THREE.ArrowHelper(axis,center,length,color,Math.min(length*.15,6),Math.min(length*.08,3));group.add(arrow);
    if(field.kind==='rotation'){
      const ring=new THREE.Mesh(new THREE.TorusGeometry(length*.7,.45,8,80),new THREE.MeshBasicMaterial({color,depthTest:false,transparent:true,opacity:.9}));
      ring.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),axis);ring.position.copy(center);group.add(ring);
    }else if(field.kind!=='position'){
      for(const side of ['min','max'] as const){
        const others=[0,1,2].filter(i=>i!==field.axis),a=others[0],b=others[1],coords:number[]=[];
        for(const [u,v]of [[0,0],[1,0],[1,1],[0,0],[1,1],[0,1]]){
          const p=new THREE.Vector3().setComponent(field.axis,bounds[side].getComponent(field.axis));
          p.setComponent(a,bounds[u?'max':'min'].getComponent(a));p.setComponent(b,bounds[v?'max':'min'].getComponent(b));coords.push(...p.applyMatrix4(mesh.matrixWorld).toArray());
        }
        const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(coords,3));
        const face=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide,depthTest:false,depthWrite:false,transparent:true,opacity:.28}));group.add(face);
      }
    }
    group.traverse(child=>{child.renderOrder=1200;if(child instanceof THREE.Mesh||child instanceof THREE.Line){const materials=Array.isArray(child.material)?child.material:[child.material];for(const m of materials){m.depthTest=false;m.depthWrite=false;}}});
    scene.add(group);
    return()=>{scene.remove(group);group.traverse(child=>{if(child instanceof THREE.Mesh||child instanceof THREE.Line){child.geometry.dispose();for(const m of Array.isArray(child.material)?child.material:[child.material])m.dispose();}});};
  },[scene,mesh,field]);
  return null;
}
