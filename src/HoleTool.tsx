import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { ModelObject } from './model';
import { geometryFor } from './model';
import type { Hole } from './hole-fill';
type Data=NonNullable<ModelObject['geometryData']>;
type Fill={geometryData:Data;patchPositions:number[];dimensions:number[];triangles:number};
type Props={object:ModelObject;scene:THREE.Scene;camera:THREE.Camera;mesh:THREE.Mesh;controls:OrbitControls;onClose:()=>void;onApply:(data:Data,dimensions:number[])=>void};
type Point=[number,number];
const inside=(p:Point,polygon:Point[])=>{
  let result=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++)if((polygon[i][1]>p[1])!==(polygon[j][1]>p[1]) && p[0]<(polygon[j][0]-polygon[i][0])*(p[1]-polygon[i][1])/(polygon[j][1]-polygon[i][1])+polygon[i][0])result=!result;
  return result;
};
const matrixFor=(object:ModelObject)=>new THREE.Matrix4().compose(new THREE.Vector3(...object.position),new THREE.Quaternion().setFromEuler(new THREE.Euler(...object.rotation.map(THREE.MathUtils.degToRad) as [number,number,number])),new THREE.Vector3(...object.scale));
export default function HoleTool({object,scene,camera,mesh,controls,onClose,onApply}:Props){
  const [holes,setHoles]=useState<Hole[]>([]),[chosen,setChosen]=useState<number|null>(null),[bulge,setBulge]=useState(0),[bulgeDraft,setBulgeDraft]=useState('0'),[collapsed,setCollapsed]=useState(false),[lassoMode,setLassoMode]=useState(false),[lasso,setLasso]=useState<Point[]>([]),[preview,setPreview]=useState<Fill|null>(null),[working,setWorking]=useState(true),[message,setMessage]=useState('Offene Ränder werden im Hintergrund erkannt …');
  const dataRef=useRef<Data|null>(null),analysisWorker=useRef<Worker|null>(null),fillWorker=useRef<Worker|null>(null),analysisVersion=useRef(0),fillVersion=useRef(0),analyzedObject=useRef<ModelObject|null>(null);
  const stateRef=useRef({holes,lassoMode,working});stateRef.current={holes,lassoMode,working};
  const request=<T,>(payload:unknown,channel:'analyze'|'fill')=>new Promise<T>((resolve,reject)=>{
    const workerRef=channel==='analyze'?analysisWorker:fillWorker;
    workerRef.current?.terminate();const worker=new Worker(new URL('./hole.worker.ts',import.meta.url),{type:'module'});workerRef.current=worker;
    worker.onmessage=event=>{worker.terminate();if(workerRef.current===worker)workerRef.current=null;event.data.error?reject(new Error(event.data.error)):resolve(event.data.result);};
    worker.onerror=()=>{worker.terminate();reject(new Error('Löcher-Worker konnte nicht ausgeführt werden.'));};worker.postMessage(payload);
  });
  useEffect(()=>{
    const token=++analysisVersion.current;analyzedObject.current=null;setHoles([]);setChosen(null);setPreview(null);setWorking(true);setBulge(0);setBulgeDraft('0');setMessage('Offene Ränder werden im Hintergrund erkannt …');
    const geometry=geometryFor(object);const data={positions:Array.from(geometry.getAttribute('position').array),indices:geometry.index?Array.from(geometry.index.array):null};geometry.dispose();dataRef.current=data;
    void request<{holes:Hole[];ambiguous:number;nonManifoldEdges:number}>({action:'analyze',data},'analyze').then(result=>{
      if(token!==analysisVersion.current)return;analyzedObject.current=object;setHoles(result.holes);
      setMessage(result.holes.length?`${result.holes.length} Öffnung(en). Rand anklicken oder eine Öffnung umkreisen.${result.ambiguous||result.nonManifoldEdges?' Problematische Randbereiche wurden ausgelassen; ggf. zuerst Mesh reparieren.':''}`:'Keine eindeutigen offenen Ränder gefunden. Bereits geschlossene, dickwandige Durchgangslöcher lassen sich mit diesem Werkzeug nicht füllen.');
    }).catch(error=>{if(token===analysisVersion.current)setMessage(error.message);}).finally(()=>{if(token===analysisVersion.current)setWorking(false);});
    return()=>{analysisVersion.current++;analysisWorker.current?.terminate();};
  },[object]);
  useEffect(()=>{
    if(chosen===null || !dataRef.current || analyzedObject.current!==object){setPreview(null);return;}
    const token=++fillVersion.current;setPreview(null);setWorking(true);setMessage('Verschlussfläche wird berechnet …');
    const timer=window.setTimeout(()=>{
      void request<Fill>({action:'fill',data:dataRef.current,holeId:chosen,bulge},'fill').then(result=>{
        if(token!==fillVersion.current)return;setPreview(result);setMessage(`Vorschau: Öffnung ${chosen+1} · ${result.triangles} neue Dreiecke. Nur diese Öffnung wird geschlossen.`);
      }).catch(error=>{if(token===fillVersion.current)setMessage(error.message);}).finally(()=>{if(token===fillVersion.current)setWorking(false);});
    },120);
    return()=>{window.clearTimeout(timer);fillVersion.current++;fillWorker.current?.terminate();};
  },[object,chosen,bulge]);
  useEffect(()=>{
    const overlay=new THREE.Group();overlay.matrix.copy(matrixFor(object));overlay.matrixAutoUpdate=false;
    for(const hole of holes){
      const points=hole.points.slice();points.push(...points.slice(0,3));const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(points,3));
      const line=new THREE.Line(geometry,new THREE.LineBasicMaterial({color:hole.id===chosen?0x43e6b5:0xffac42,depthTest:false,transparent:true,opacity:.95}));line.renderOrder=1000;line.frustumCulled=false;overlay.add(line);
    }
    if(preview){
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(preview.patchPositions,3));geometry.computeVertexNormals();
      const patch=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:0x43e6b5,side:THREE.DoubleSide,transparent:true,opacity:.65,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1}));overlay.add(patch);
    }
    scene.add(overlay);
    return()=>{scene.remove(overlay);overlay.traverse(child=>{if(child instanceof THREE.Mesh || child instanceof THREE.Line){child.geometry.dispose();(child.material as THREE.Material).dispose();}});};
  },[holes,chosen,preview,mesh,object,scene]);
  useEffect(()=>{
    const canvas=controls.domElement!;const oldRight=controls.mouseButtons.RIGHT;controls.mouseButtons.RIGHT=THREE.MOUSE.ROTATE;let drawing:Point[]|null=null,pointerId:number|null=null;
    const local=(event:PointerEvent):Point=>{const rect=canvas.getBoundingClientRect();return [event.clientX-rect.left,event.clientY-rect.top];};
    const project=(hole:Hole)=>{
      camera.updateMatrixWorld();const rect=canvas.getBoundingClientRect();
      const points:Point[]=[];for(let i=0;i<hole.points.length;i+=3){const p=new THREE.Vector3(hole.points[i],hole.points[i+1],hole.points[i+2]).applyMatrix4(matrixFor(object)).project(camera);if(p.z<-1 || p.z>1)return [];points.push([(p.x+1)*rect.width/2,(1-p.y)*rect.height/2]);}return points;
    };
    const down=(event:PointerEvent)=>{
      if(event.button!==0)return;event.preventDefault();event.stopImmediatePropagation();if(stateRef.current.working)return;
      if(stateRef.current.lassoMode){drawing=[local(event)];pointerId=event.pointerId;controls.enabled=false;canvas.setPointerCapture(event.pointerId);setLasso([...drawing]);return;}
      const p=local(event);let best=18,selection:number|null=null;
      for(const hole of stateRef.current.holes){const points=project(hole);for(let i=0;i<points.length;i++){
        const a=points[i],b=points[(i+1)%points.length],dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1))),distance=Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);
        if(distance<best){best=distance;selection=hole.id;}
      }}
      if(selection!==null)setChosen(selection);else setMessage('Bitte nahe an einen orange markierten Rand klicken oder die Öffnung umkreisen.');
    };
    const move=(event:PointerEvent)=>{if(!drawing || event.pointerId!==pointerId)return;event.preventDefault();event.stopImmediatePropagation();const p=local(event),last=drawing[drawing.length-1];if(Math.hypot(p[0]-last[0],p[1]-last[1])>=3){drawing.push(p);setLasso([...drawing]);}};
    const finish=(event:PointerEvent)=>{
      if(!drawing || event.pointerId!==pointerId)return;event.preventDefault();event.stopImmediatePropagation();
      const polygon=drawing;drawing=null;pointerId=null;controls.enabled=true;if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);setLasso([]);
      if(event.type==='pointercancel' || polygon.length<4){setMessage('Bitte einen geschlossenen Kreis um den gewünschten Rand zeichnen.');return;}
      const matches=stateRef.current.holes.filter(hole=>{const points=project(hole);return points.length && points.every(p=>inside(p,polygon));});
      if(matches.length===1)setChosen(matches[0].id);else setMessage(matches.length?'Mehrere Öffnungen umkreist. Bitte enger markieren oder eine Öffnung in der Liste wählen.':'Kein vollständiger Rand umkreist. Bitte die ganze Öffnung einschließen.');
    };
    canvas.addEventListener('pointerdown',down,true);window.addEventListener('pointermove',move,true);window.addEventListener('pointerup',finish,true);window.addEventListener('pointercancel',finish,true);
    return()=>{canvas.removeEventListener('pointerdown',down,true);window.removeEventListener('pointermove',move,true);window.removeEventListener('pointerup',finish,true);window.removeEventListener('pointercancel',finish,true);controls.enabled=true;controls.mouseButtons.RIGHT=oldRight;if(pointerId!==null && canvas.hasPointerCapture(pointerId))canvas.releasePointerCapture(pointerId);};
  },[controls,mesh,camera,object]);
  return <><section className="hole-tool" aria-label="Löcher schließen"><header><strong>Löcher schließen</strong><button aria-label={collapsed?"Werkzeug ausklappen":"Werkzeug einklappen"} onClick={()=>setCollapsed(value=>!value)}>{collapsed?"+":"−"}</button><button aria-label="Löcherwerkzeug schließen" onClick={onClose}>×</button></header>
    <div hidden={collapsed}><p role="status">{message}</p><div className="hole-modes"><button aria-pressed={!lassoMode} onClick={()=>setLassoMode(false)}>Rand anklicken</button><button aria-pressed={lassoMode} onClick={()=>setLassoMode(true)}>Umkreisen</button></div>
    <div className="hole-list">{holes.map(hole=><button key={hole.id} aria-pressed={chosen===hole.id} onClick={()=>setChosen(hole.id)}>Öffnung {hole.id+1} · {hole.perimeter.toFixed(1)} mm Rand</button>)}</div>
    <label className="creator-field">Wölbung (mm)<input type="number" step="0.5" value={bulgeDraft} disabled={chosen===null} onChange={event=>{setBulgeDraft(event.target.value);const value=event.target.valueAsNumber;if(Number.isFinite(value))setBulge(value);}} onBlur={()=>{if(bulgeDraft.trim()==='' || !Number.isFinite(Number(bulgeDraft)))setBulgeDraft(String(bulge));}} /></label>
    <p>Rand bleibt unverändert. Wölbung passt die neue Fläche an. Rechts ziehen: Drehen · Rad: Zoom · Esc: Abbrechen.</p>
    <button className="primary" disabled={working || !preview || bulgeDraft.trim()==='' || !Number.isFinite(Number(bulgeDraft))} onClick={()=>{if(preview)onApply(preview.geometryData,preview.dimensions);}}>Verschluss übernehmen</button><button onClick={onClose}>Abbrechen</button></div>
  </section>{lasso.length>0 && <svg className="hole-lasso"><polyline points={lasso.map(p=>p.join(',')).join(' ')} /></svg>}</>;
}
