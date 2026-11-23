import {useEffect,useState} from 'react';
import * as THREE from 'three';
import type {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
export default function OrientationCompass({camera,controls}:{camera:THREE.Camera;controls:OrbitControls}){
  const [axes,setAxes]=useState<{label:string;x:number;y:number;depth:number}[]>([]);
  useEffect(()=>{
    const update=()=>{const inverse=camera.quaternion.clone().invert();setAxes(['X','Y','Z'].map((label,i)=>{const p=new THREE.Vector3().setComponent(i,1).applyQuaternion(inverse);return {label,x:48+p.x*29,y:48-p.y*29,depth:p.z};}).sort((a,b)=>a.depth-b.depth));};
    update();controls.addEventListener('change',update);return()=>controls.removeEventListener('change',update);
  },[camera,controls]);
  return <svg className="orientation-compass" viewBox="0 0 96 96" role="img" aria-label="Weltachsen: X und Y Bodenebene, Z nach oben"><circle cx="48" cy="48" r="4" fill="currentColor"/>{axes.map(a=><g key={a.label} className={`axis-${a.label.toLowerCase()}`} style={{opacity:a.depth<0?.65:1}}><line x1="48" y1="48" x2={a.x} y2={a.y}/><circle cx={a.x} cy={a.y} r="10"/><text x={a.x} y={a.y+4}>{a.label}</text></g>)}</svg>;
}
