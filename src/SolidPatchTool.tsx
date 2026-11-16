import {useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import {MeshBVH,acceleratedRaycast} from 'three-mesh-bvh';
import type {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import type {ModelObject} from './model';
import {geometryFor} from './model';
import type {MeshData} from './solid-patch';
type Point=[number,number];
type Props={object:ModelObject;scene:THREE.Scene;camera:THREE.Camera;mesh:THREE.Mesh;controls:OrbitControls;onClose:()=>void;onApply:(data:MeshData,dimensions:number[])=>void};
const matrixFor=(object:ModelObject)=>new THREE.Matrix4().compose(new THREE.Vector3(...object.position),new THREE.Quaternion().setFromEuler(new THREE.Euler(...object.rotation.map(THREE.MathUtils.degToRad) as [number,number,number])),new THREE.Vector3(...object.scale));
function sampleContour(input:Point[],count=32){
  const path=[...input,input[0]],distances=[0];for(let i=1;i<path.length;i++)distances.push(distances[i-1]+Math.hypot(path[i][0]-path[i-1][0],path[i][1]-path[i-1][1]));
  if(distances[distances.length-1]<40)throw new Error('Markierung ist zu klein.');
  return Array.from({length:count},(_,k)=>{const d=k*distances[distances.length-1]/count;let i=1;while(i<distances.length-1&&distances[i]<d)i++;const t=(d-distances[i-1])/(distances[i]-distances[i-1]||1);return [path[i-1][0]+t*(path[i][0]-path[i-1][0]),path[i-1][1]+t*(path[i][1]-path[i-1][1])] as Point;});
}
export default function SolidPatchTool({object,scene,camera,mesh,controls,onClose,onApply}:Props){
  const [attempt,setAttempt]=useState(0),[initError,setInitError]=useState('');
  const [ready,setReady]=useState(false),[working,setWorking]=useState(true),[message,setMessage]=useState('Volumen wird vorbereitet …'),[repairInfo,setRepairInfo]=useState(''),[points,setPoints]=useState<number[][]>([]),[viewpoint,setViewpoint]=useState<number[]>([]),[lasso,setLasso]=useState<Point[]>([]),[preview,setPreview]=useState<number[]|null>(null),[depth,setDepth]=useState('1.5'),[margin,setMargin]=useState('0.8'),[bulge,setBulge]=useState('0'),[allowRepair,setAllowRepair]=useState(true),[collapsed,setCollapsed]=useState(false);
  const workerRef=useRef<Worker|null>(null),requestRef=useRef(0),stateRef=useRef({working,ready});stateRef.current={working,ready};
  const applyRef=useRef(onApply);applyRef.current=onApply;
  useEffect(()=>{
    setReady(false);setWorking(true);setInitError('');setMessage('Volumen wird vorbereitet …');setRepairInfo('');setPoints([]);setPreview(null);requestRef.current++;
    const worker=new Worker(new URL('./solid-patch.worker.ts',import.meta.url),{type:'module'});workerRef.current=worker;
    worker.onmessage=event=>{
      const data=event.data;
      if(data.kind==='progress'){setMessage(data.message);return;}
      if(data.id!==undefined&&data.id!==requestRef.current)return;
      if(data.kind==='ready'){setRepairInfo(`${data.removedFaces} Flächen lokal bereinigt, ${data.repairCaps} kleine Fehlstellen geschlossen, ${data.stitchedEdges} Kanten verbunden.`);setReady(true);setWorking(false);setMessage(`Bereit. Auf dem Material um das Armloch zeichnen. Lokale Bereinigung: ${data.removedFaces} Flächen, ${data.repairCaps} kleine Fehlstellen.`);}
      if(data.kind==='preview'){setPreview(data.patchPositions);setWorking(false);setMessage(`Gültige Vereinigung: ${data.volumeAdded.toFixed(2)} mm³ ergänzt, ${data.genusBefore-data.genusAfter} Durchgang/Durchgänge geschlossen. Vorschau von allen Seiten prüfen.`);}
      if(data.kind==='apply')applyRef.current(data.geometryData,data.dimensions);
      if(data.kind==='error'){setWorking(false);setPreview(null);setMessage(data.message);if(data.action==='init'){setReady(false);setInitError(data.message);}}
    };
    worker.onerror=()=>{setWorking(false);setReady(false);setInitError('Volumen-Worker konnte nicht gestartet werden.');setMessage('Volumen-Worker konnte nicht gestartet werden.');};
    const geometry=geometryFor(object),positions=Array.from(geometry.getAttribute('position').array),indices=geometry.index?Array.from(geometry.index.array):null;geometry.dispose();
    worker.postMessage({action:'init',data:{positions,indices},allowRepair});
    return()=>{worker.terminate();if(workerRef.current===worker)workerRef.current=null;};
  },[object,allowRepair,attempt]);
  useEffect(()=>{
    const overlay=new THREE.Group();overlay.matrix.copy(matrixFor(object));overlay.matrixAutoUpdate=false;
    if(points.length){const p=points.map(p=>new THREE.Vector3(...p as [number,number,number]));p.push(p[0]);const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(p),new THREE.LineBasicMaterial({color:0xffa133,depthTest:false}));line.renderOrder=1000;overlay.add(line);}
    if(preview){const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(preview,3));const patch=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:0x43e6b5,side:THREE.DoubleSide,transparent:true,opacity:.7,depthWrite:false}));overlay.add(patch);}
    scene.add(overlay);return()=>{scene.remove(overlay);overlay.traverse(child=>{if(child instanceof THREE.Mesh||child instanceof THREE.Line){child.geometry.dispose();(child.material as THREE.Material).dispose();}});};
  },[object,points,preview,scene]);
  useEffect(()=>{
    const canvas=controls.domElement!,oldRight=controls.mouseButtons.RIGHT,oldRaycast=mesh.raycast;mesh.raycast=acceleratedRaycast;controls.mouseButtons.RIGHT=THREE.MOUSE.ROTATE;
    let drawing:Point[]|null=null,pointerId:number|null=null,cancelled=false;
    const local=(event:PointerEvent):Point=>{const r=canvas.getBoundingClientRect();return [event.clientX-r.left,event.clientY-r.top];};
    const down=(event:PointerEvent)=>{if(event.button!==0)return;event.preventDefault();event.stopImmediatePropagation();if(stateRef.current.working||!stateRef.current.ready)return;drawing=[local(event)];pointerId=event.pointerId;controls.enabled=false;canvas.setPointerCapture(event.pointerId);setLasso([...drawing]);};
    const move=(event:PointerEvent)=>{if(!drawing||event.pointerId!==pointerId)return;event.preventDefault();event.stopImmediatePropagation();const p=local(event),last=drawing[drawing.length-1];if(Math.hypot(p[0]-last[0],p[1]-last[1])>3){drawing.push(p);setLasso([...drawing]);}};
    const finish=async(event:PointerEvent)=>{
      if(!drawing||event.pointerId!==pointerId)return;event.preventDefault();event.stopImmediatePropagation();const path=drawing;drawing=null;pointerId=null;controls.enabled=true;if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);setLasso([]);
      if(event.type==='pointercancel'||path.length<5)return;
      setWorking(true);setPreview(null);requestRef.current++;
      try{
        const sampled=sampleContour(path),rect=canvas.getBoundingClientRect(),raycaster=new THREE.Raycaster(),picked:number[][]=[];mesh.updateWorldMatrix(true,false);camera.updateMatrixWorld();
        const cameraSnapshot=camera.clone();cameraSnapshot.updateMatrixWorld();raycaster.firstHitOnly=true;
        if(!mesh.geometry.boundsTree){
          setMessage('Schnelle Suchstruktur für die Markierung wird aufgebaut …');
          await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));if(cancelled)return;
          mesh.geometry.boundsTree=new MeshBVH(mesh.geometry,{indirect:true});
        }
        for(let i=0;i<sampled.length;i++){
          if(cancelled)return;
          if(i%4===0){setMessage(`Markierung wird auf das Mesh übertragen … ${i}/${sampled.length}`);await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));}
          raycaster.setFromCamera(new THREE.Vector2(sampled[i][0]/rect.width*2-1,1-sampled[i][1]/rect.height*2),cameraSnapshot);
          const hit=raycaster.intersectObject(mesh,false)[0];if(!hit)throw new Error('Markierung trifft nicht überall Material. Bitte knapp außerhalb der Öffnung auf dem Rand zeichnen.');
          picked.push(mesh.worldToLocal(hit.point.clone()).toArray());
        }
        const lengths=picked.map((p,i)=>new THREE.Vector3(...p as [number,number,number]).distanceTo(new THREE.Vector3(...picked[(i+1)%picked.length] as [number,number,number]))),sorted=[...lengths].sort((a,b)=>a-b),median=sorted[Math.floor(sorted.length/2)];
        if(lengths.some(length=>length>median*6+.5))throw new Error('Die Markierung springt auf eine Rückwand. Bitte vollständig auf dem nahen Rand zeichnen oder die Ansicht drehen.');
        setPoints(picked);setViewpoint(mesh.worldToLocal(cameraSnapshot.getWorldPosition(new THREE.Vector3())).toArray());setMessage('Markierung übernommen. Dicke und Wölbung wählen, dann Vorschau berechnen.');
      }catch(error){setPoints([]);setMessage(error instanceof Error?error.message:'Markierung fehlgeschlagen.');}
      finally{if(!cancelled)setWorking(false);}
    };
    canvas.addEventListener('pointerdown',down,true);window.addEventListener('pointermove',move,true);window.addEventListener('pointerup',finish,true);window.addEventListener('pointercancel',finish,true);
    return()=>{cancelled=true;canvas.removeEventListener('pointerdown',down,true);window.removeEventListener('pointermove',move,true);window.removeEventListener('pointerup',finish,true);window.removeEventListener('pointercancel',finish,true);controls.enabled=true;controls.mouseButtons.RIGHT=oldRight;mesh.raycast=oldRaycast;if(pointerId!==null&&canvas.hasPointerCapture(pointerId))canvas.releasePointerCapture(pointerId);};
  },[mesh,camera,controls,object,allowRepair,attempt]);
  const valid=Number.isFinite(Number(depth))&&Number(depth)>0&&bulge.trim()!==''&&Number.isFinite(Number(bulge))&&margin.trim()!==''&&Number.isFinite(Number(margin))&&Number(margin)>=0;
  const disabledReason=initError?'Modellvorbereitung fehlgeschlagen. Bitte Fehler beheben und erneut vorbereiten.':working?'Berechnung läuft …':!ready?'Modell wird vorbereitet …':!valid?'Bitte gültige Zahlen eingeben: Dicke größer 0, Überlappung mindestens 0.':points.length<5?'Bitte zuerst die Öffnung auf dem Material umkreisen.':'';
  return <><section className="hole-tool solid-tool" aria-label="Armloch verschließen"><header><strong>Armloch / Durchgang</strong><button aria-label={collapsed?'Werkzeug ausklappen':'Werkzeug einklappen'} onClick={()=>setCollapsed(v=>!v)}>{collapsed?'+':'−'}</button><button aria-label="Volumenwerkzeug schließen" onClick={onClose}>×</button></header><div hidden={collapsed}>
    <p role="status">{message}</p>{initError&&<><p role="alert">Vorbereitung fehlgeschlagen: {initError}</p><button disabled={working} onClick={()=>setAttempt(v=>v+1)}>Modell erneut vorbereiten</button></>}<p>Mit links auf dem Material knapp um die Öffnung zeichnen. Rechts ziehen: Drehen · Rad: Zoom. Die Markierung muss die Öffnung ganz umschließen.</p>
    <label className="creator-field">Dicke (mm)<input type="number" min="0.1" step="0.2" value={depth} disabled={working} onChange={e=>{setDepth(e.target.value);setPreview(null);requestRef.current++;}} /></label>
    <label className="creator-field">Überlappung (mm)<input type="number" min="0" step="0.1" value={margin} disabled={working} onChange={e=>{setMargin(e.target.value);setPreview(null);requestRef.current++;}} /></label>
    <label className="creator-field">Wölbung (mm)<input type="number" step="0.2" value={bulge} disabled={working} onChange={e=>{setBulge(e.target.value);setPreview(null);requestRef.current++;}} /></label>
    <p>{repairInfo}</p><label className="solid-repair"><input type="checkbox" checked={allowRepair} disabled={working} onChange={e=>setAllowRepair(e.target.checked)} /> Kleine Meshfehler lokal bereinigen</label>
    <p>{points.length?`${points.length} Randpunkte markiert.`:'Noch keine Markierung.'} Es wird ein Körper mit Dicke erzeugt und mit dem Modell vereinigt. Änderungen erst nach Übernehmen.</p>
    <p id="solid-preview-reason">{disabledReason}</p><button aria-describedby="solid-preview-reason" disabled={!ready||working||points.length<5||!valid} onClick={()=>{setWorking(true);setPreview(null);const id=++requestRef.current;workerRef.current?.postMessage({action:'preview',id,points,viewpoint,depth:Number(depth),bulge:Number(bulge),margin:Number(margin)});}}>Vorschau berechnen</button>
    <button className="primary" disabled={working||!preview} onClick={()=>{setWorking(true);workerRef.current?.postMessage({action:'apply',id:requestRef.current});}}>Verschluss übernehmen</button><button onClick={onClose}>Abbrechen</button>
  </div></section>{lasso.length>0&&<svg className="hole-lasso"><polyline points={lasso.map(p=>p.join(',')).join(' ')} /></svg>}</>;
}
