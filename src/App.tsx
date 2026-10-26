import { useCallback, useEffect, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import helvetikerFont from 'three/examples/fonts/helvetiker_regular.typeface.json';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Brush, Evaluator, ADDITION, SUBTRACTION, INTERSECTION } from 'three-bvh-csg';

type ShapeType = 'box' | 'cylinder' | 'sphere' | 'cone' | 'custom' | 'text' | 'gear' | 'thread';
type CreatorMode = 'text' | 'gear' | 'thread';
type ModelObject = {
  id: string;
  name: string;
  type: ShapeType;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  color: string;
  dimensions: [number, number, number];
  geometryData?: { positions: number[]; indices: number[] | null };
  groupId?: string;
};

const APP_VERSION = '0.1.6';
type AppLanguage = 'de' | 'en';
type AppTheme = 'dark' | 'light';
const uiText: Record<AppLanguage, Record<string, string>> = {
  de: {settings:'Einstellungen',appearance:'Darstellung',theme:'Design',dark:'Dunkel',light:'Hell',language:'Sprache',info:'Programm-Info',version:'Version',contact:'Ansprechpartner',credit:'Shad3pi in cooperation with OpenAI ChatGPT',repository:'GitHub-Repository',close:'Schließen',tools:'WERKZEUGE',project:'PROJEKT',undo:'↶ Rückgängig',redo:'↷ Wiederholen',save:'Speichern',open:'Öffnen',importMesh:'Mesh importieren',export:'STL exportieren',basics:'GRUNDKÖRPER',grouping:'GRUPPIERUNG',geometry:'GEOMETRIE',view:'ANSICHT',explorer:'OBJEKT-EXPLORER',properties:'EIGENSCHAFTEN',box:'Quader',cylinder:'Zylinder',sphere:'Kugel',cone:'Kegel',group:'Gruppieren',ungroup:'Gruppierung lösen',cut:'Ausschnitt / Cut',cutPlane:'EBENE SCHNEIDEN',cutOn:'Schnittmodus beenden',cutOff:'Schnittmodus aktivieren',split:'Objekt teilen',ground:'Auf Boden setzen',frame:'Alles einpassen',reset:'Ansicht zurücksetzen',move:'↔ Bewegen',rotate:'⟳ Drehen',scale:'⤢ Skalieren',noObject:'Kein Objekt ausgewählt',name:'Objektname',color:'Farbe',position:'POSITION',rotation:'DREHUNG °',dimensions:'ABMESSUNGEN MM · GRUNDMAẞ',scaling:'SKALIERUNG ×',duplicate:'Duplizieren',delete:'Löschen',private:'Privat & lokal',noLogin:'Kein Login · Keine Werbung',workspace:'3D-ARBEITSFLÄCHE',perspective:'PERSPEKTIVE',status:'Bereit · Maße in mm'},
  en: {settings:'Settings',appearance:'Appearance',theme:'Theme',dark:'Dark',light:'Light',language:'Language',info:'About',version:'Version',contact:'Contact',credit:'Shad3pi in cooperation with OpenAI ChatGPT',repository:'GitHub repository',close:'Close',tools:'TOOLS',project:'PROJECT',undo:'↶ Undo',redo:'↷ Redo',save:'Save',open:'Open',importMesh:'Import mesh',export:'Export STL',basics:'PRIMITIVES',grouping:'GROUPING',geometry:'GEOMETRY',view:'VIEW',explorer:'OBJECT EXPLORER',properties:'PROPERTIES',box:'Box',cylinder:'Cylinder',sphere:'Sphere',cone:'Cone',group:'Group',ungroup:'Ungroup',cut:'Boolean cut',cutPlane:'PLANE CUT',cutOn:'Exit cut mode',cutOff:'Enable cut mode',split:'Split object',ground:'Place on ground',frame:'Frame all',reset:'Reset view',move:'↔ Move',rotate:'⟳ Rotate',scale:'⤢ Scale',noObject:'No object selected',name:'Object name',color:'Color',position:'POSITION',rotation:'ROTATION °',dimensions:'DIMENSIONS MM · BASE SIZE',scaling:'SCALE ×',duplicate:'Duplicate',delete:'Delete',private:'Private & local',noLogin:'No login · No ads',workspace:'3D WORKSPACE',perspective:'PERSPECTIVE',status:'Ready · Dimensions in mm'}
};

const makeId = () => `obj-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const initialObject = (): ModelObject => ({
  id: makeId(), name: 'Quader', type: 'box', position: [0, 0, 0],
  rotation: [0, 0, 0], scale: [1, 1, 1], color: '#43b6a8', dimensions: [40, 12, 40]
});

function geometryFor(obj: ModelObject): THREE.BufferGeometry {
  if (obj.geometryData) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(obj.geometryData.positions, 3));
    if (obj.geometryData.indices) g.setIndex(obj.geometryData.indices);
    g.computeBoundingBox();
    const bounds = g.boundingBox;
    if (bounds) {
      const size = new THREE.Vector3();
      bounds.getSize(size);
      g.scale(
        size.x > 1e-6 ? obj.dimensions[0] / size.x : 1,
        size.y > 1e-6 ? obj.dimensions[1] / size.y : 1,
        size.z > 1e-6 ? obj.dimensions[2] / size.z : 1
      );
    }
    g.computeVertexNormals();
    g.computeBoundingBox();
    g.computeBoundingSphere();
    return g;
  }
  const [x, y, z] = obj.dimensions;
  let g: THREE.BufferGeometry;
  switch (obj.type) {
    case 'cylinder': g = new THREE.CylinderGeometry(x / 2, x / 2, y, 64); break;
    case 'sphere': g = new THREE.SphereGeometry(x / 2, 48, 32); break;
    case 'cone': g = new THREE.ConeGeometry(x / 2, y, 64); break;
    default: g = new THREE.BoxGeometry(x, y, z);
  }
  g.computeVertexNormals();
  return g;
}

function downloadFile(name: string, content: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

export default function App() {
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const transformControlsRef = useRef<TransformControls | null>(null);
  const objectsRef = useRef<ModelObject[]>([]);
  const undoStackRef = useRef<ModelObject[][]>([]);
  const redoStackRef = useRef<ModelObject[][]>([]);
  const historyReadyRef = useRef(false);
  const [historyVersion, setHistoryVersion] = useState(0);
  const [appTheme, setAppTheme] = useState<AppTheme>(() => (localStorage.getItem('3dmaker-theme') as AppTheme) || 'dark');
  const [appLanguage, setAppLanguage] = useState<AppLanguage>(() => (localStorage.getItem('3dmaker-language') as AppLanguage) || 'de');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [creatorMode, setCreatorMode] = useState<CreatorMode | null>(null);
  const [textValue, setTextValue] = useState('3D Maker');
  const [textSize, setTextSize] = useState(20);
  const [textDepth, setTextDepth] = useState(5);
  const [gearTeeth, setGearTeeth] = useState(16);
  const [gearModule, setGearModule] = useState(2);
  const [gearThickness, setGearThickness] = useState(8);
  const [threadDiameter, setThreadDiameter] = useState(20);
  const [threadPitch, setThreadPitch] = useState(2.5);
  const [threadLength, setThreadLength] = useState(20);
  const t = (key: string) => uiText[appLanguage][key] ?? key;
  const selectedIdRef = useRef<string | undefined>(undefined);
  const [transformMode, setTransformMode] = useState<'translate' | 'rotate' | 'scale'>('scale');
  const [liveTransform, setLiveTransform] = useState<{ dimensions: number[]; delta: number[]; rotation: number[] } | null>(null);
  const meshGroupRef = useRef<THREE.Group | null>(null);
  const meshMapRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const visualGroupMapRef = useRef<Map<string, THREE.Group>>(new Map());
  const cutPreviewRef = useRef<THREE.LineSegments | null>(null);
  const cutHandleRef = useRef<THREE.Object3D | null>(null);
  const dragRef = useRef<{ id: string; groupId?: string; pointerId: number; startPoint: THREE.Vector3; startPosition: THREE.Vector3; plane: THREE.Plane } | null>(null);
  const [objects, setObjectsState] = useState<ModelObject[]>([initialObject()]);
  const cloneObjects = (items: ModelObject[]) => JSON.parse(JSON.stringify(items)) as ModelObject[];
  const setObjects = (update: ModelObject[] | ((previous: ModelObject[]) => ModelObject[])) => {
    const next = typeof update === 'function' ? update(objectsRef.current) : update;
    if (historyReadyRef.current) {
      undoStackRef.current.push(cloneObjects(objectsRef.current));
      if (undoStackRef.current.length > 100) undoStackRef.current.shift();
      redoStackRef.current = [];
    }
    objectsRef.current = next;
    setObjectsState(next);
    setHistoryVersion(v => v + 1);
  };
  const undo = () => {
    const previous = undoStackRef.current.pop();
    if (!previous) { setStatus('Nichts zum Rückgängigmachen vorhanden.'); return; }
    redoStackRef.current.push(cloneObjects(objectsRef.current));
    objectsRef.current = cloneObjects(previous);
    setObjectsState(objectsRef.current);
    setSelectedIds([]);
    setStatus('Letzte Aktion rückgängig gemacht.');
  };
  const redo = () => {
    const next = redoStackRef.current.pop();
    if (!next) { setStatus('Nichts zum Wiederholen vorhanden.'); return; }
    undoStackRef.current.push(cloneObjects(objectsRef.current));
    objectsRef.current = cloneObjects(next);
    setObjectsState(objectsRef.current);
    setSelectedIds([]);
    setStatus('Aktion wiederhergestellt.');
  };
  useEffect(() => { historyReadyRef.current = true; }, []);
  useEffect(() => { localStorage.setItem('3dmaker-theme', appTheme); document.documentElement.dataset.theme = appTheme; }, [appTheme]);
  useEffect(() => { localStorage.setItem('3dmaker-language', appLanguage); document.documentElement.lang = appLanguage; }, [appLanguage]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [cutAxis, setCutAxis] = useState<'x' | 'y' | 'z'>('y');
  const [cutPosition, setCutPosition] = useState(0);
  const [cutMode, setCutMode] = useState(false);
  const [status, setStatus] = useState('Bereit · Maße in mm');
  const [busy, setBusy] = useState(false);
  const [projectName, setProjectName] = useState('Unbenanntes Projekt');
  const selected = objects.find(o => o.id === selectedIds[0]);
  objectsRef.current = objects;
  selectedIdRef.current = selectedIds[0];

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#171a21');
    sceneRef.current = scene;
    const camera = new THREE.PerspectiveCamera(45, host.clientWidth / host.clientHeight, 0.1, 10000);
    camera.position.set(110, 100, 150);
    cameraRef.current = camera;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(host.clientWidth, host.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    scene.add(new THREE.HemisphereLight(0xffffff, 0x343b49, 2.1));
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
    keyLight.position.set(90, 150, 80);
    scene.add(keyLight);
    const grid = new THREE.GridHelper(240, 24, 0x5b6577, 0x303642);
    scene.add(grid);
    const axes = new THREE.AxesHelper(35);
    scene.add(axes);
    const group = new THREE.Group();
    scene.add(group);
    meshGroupRef.current = group;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(0, 0, 0);
    controlsRef.current = controls;
    const transformControls = new TransformControls(camera, renderer.domElement);
    transformControls.setMode('scale');
    const cutHandle = new THREE.Object3D();
    cutHandle.userData.isCutHandle = true;
    scene.add(cutHandle);
    cutHandleRef.current = cutHandle;
    transformControls.setSpace('local');
    scene.add(transformControls.getHelper());
    transformControlsRef.current = transformControls;
    transformControls.addEventListener('dragging-changed', event => {
      controls.enabled = !event.value;
      if (!event.value) {
        const object = transformControls.object;
        if (object?.userData.isCutHandle) {
          const axis = object.userData.cutAxis as 'x' | 'y' | 'z';
          const value = axis === 'x' ? object.position.x : axis === 'y' ? object.position.y : object.position.z;
          setStatus(`Schnittposition eingestellt: ${value.toFixed(2)} mm · Alt+C zum Teilen.`);
          return;
        }
        const id = object?.userData.modelId as string | undefined;
        const groupId = object?.userData.groupId as string | undefined;
        if (object && groupId) {
          setObjects(prev => prev.map(item => {
            if (item.groupId !== groupId) return item;
            const member = meshMapRef.current.get(item.id); if (!member) return item;
            member.updateMatrixWorld(true);
            const p = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3(); member.matrixWorld.decompose(p,q,sc);
            const e = new THREE.Euler().setFromQuaternion(q, 'XYZ');
            return { ...item, position:[p.x,p.y,p.z], rotation:[THREE.MathUtils.radToDeg(e.x),THREE.MathUtils.radToDeg(e.y),THREE.MathUtils.radToDeg(e.z)], scale:[Math.max(.01,sc.x),Math.max(.01,sc.y),Math.max(.01,sc.z)] };
          }));
          setStatus('Gruppenänderung übernommen.');
        } else if (object && id) {
          const position: [number, number, number] = [object.position.x, object.position.y, object.position.z];
          const rotation: [number, number, number] = [THREE.MathUtils.radToDeg(object.rotation.x), THREE.MathUtils.radToDeg(object.rotation.y), THREE.MathUtils.radToDeg(object.rotation.z)];
          const scale: [number, number, number] = [Math.max(0.01, object.scale.x), Math.max(0.01, object.scale.y), Math.max(0.01, object.scale.z)];
          setObjects(prev => prev.map(obj => obj.id === id ? { ...obj, position, rotation, scale } : obj));
          const model = objectsRef.current.find(obj => obj.id === id);
          if (model) setLiveTransform({ dimensions: model.dimensions.map((v, i) => v * scale[i]), delta: model.dimensions.map((v, i) => v * (scale[i] - model.scale[i])), rotation });
        }
      }
    });
    transformControls.addEventListener('objectChange', () => {
      const object = transformControls.object;
      if (object?.userData.isCutHandle) {
        const axis = object.userData.cutAxis as 'x' | 'y' | 'z';
        setCutPosition(axis === 'x' ? object.position.x : axis === 'y' ? object.position.y : object.position.z);
        return;
      }
      const id = object?.userData.modelId as string | undefined;
      const model = objectsRef.current.find(obj => obj.id === id);
      if (!object || !model) return;
      const dimensions = model.dimensions.map((v, i) => v * object.scale.toArray()[i]);
      setLiveTransform({ dimensions, delta: dimensions.map((v, i) => v - model.dimensions[i] * model.scale[i]), rotation: object.rotation.toArray().slice(0, 3).map(v => THREE.MathUtils.radToDeg(v as number)) });
    });

    let frame = 0;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();
    const resize = () => {
      if (!hostRef.current) return;
      const w = hostRef.current.clientWidth;
      const h = hostRef.current.clientHeight;
      camera.aspect = w / Math.max(h, 1);
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', resize);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || transformControls.axis !== null) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects([...meshMapRef.current.values()], false);
      if (!hits.length) return;
      const mesh = hits[0].object as THREE.Mesh;
      const id = mesh.userData.modelId as string;
      const groupId = mesh.userData.groupId as string | undefined;
      setSelectedIds(previous => event.shiftKey ? (previous.includes(id) ? previous.filter(x => x !== id) : [...previous, id]) : groupId ? objectsRef.current.filter(item => item.groupId === groupId).map(item => item.id) : [id]);
      if (!event.shiftKey) {
        // Drag the group pivot rather than an individual mesh when the clicked object belongs to a group.
        const dragObject = groupId ? visualGroupMapRef.current.get(groupId) : mesh;
        if (!dragObject) return;
        const worldPosition = dragObject.getWorldPosition(new THREE.Vector3());
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -worldPosition.y);
        const startPoint = new THREE.Vector3();
        if (raycaster.ray.intersectPlane(plane, startPoint)) {
          dragRef.current = { id, pointerId: event.pointerId, startPoint, startPosition: dragObject.position.clone(), plane, ...(groupId ? { groupId } : {}) };
          controls.enabled = false;
          renderer.domElement.setPointerCapture(event.pointerId);
        }
      }
    };
    const onPointerMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const point = new THREE.Vector3();
      if (!raycaster.ray.intersectPlane(drag.plane, point)) return;
      const dragObject = drag.groupId ? visualGroupMapRef.current.get(drag.groupId) : meshMapRef.current.get(drag.id);
      if (!dragObject) return;
      dragObject.position.set(drag.startPosition.x + point.x - drag.startPoint.x, drag.startPosition.y, drag.startPosition.z + point.z - drag.startPoint.z);
    };
    const onPointerUp = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      if (drag.groupId) {
        const groupPivot = visualGroupMapRef.current.get(drag.groupId);
        if (groupPivot) {
          groupPivot.updateMatrixWorld(true);
          setObjects(prev => prev.map(obj => {
            if (obj.groupId !== drag.groupId) return obj;
            const member = meshMapRef.current.get(obj.id); if (!member) return obj;
            member.updateMatrixWorld(true);
            const p = new THREE.Vector3(), q = new THREE.Quaternion(), scale = new THREE.Vector3();
            member.matrixWorld.decompose(p, q, scale);
            const e = new THREE.Euler().setFromQuaternion(q, 'XYZ');
            return { ...obj, position: [p.x,p.y,p.z], rotation: [THREE.MathUtils.radToDeg(e.x),THREE.MathUtils.radToDeg(e.y),THREE.MathUtils.radToDeg(e.z)], scale: [Math.max(.01,scale.x),Math.max(.01,scale.y),Math.max(.01,scale.z)] };
          }));
          setStatus('Gruppe gemeinsam verschoben.');
        }
      } else {
        const mesh = meshMapRef.current.get(drag.id);
        if (mesh) {
          const position: [number, number, number] = [mesh.position.x, mesh.position.y, mesh.position.z];
          setObjects(prev => prev.map(obj => obj.id === drag.id ? { ...obj, position } : obj));
        }
      }
      dragRef.current = null;
      controls.enabled = true;
      if (renderer.domElement.hasPointerCapture(event.pointerId)) renderer.domElement.releasePointerCapture(event.pointerId);
    };
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      controls.dispose();
      transformControls.dispose();
      transformControlsRef.current = null;
      renderer.dispose();
      host.removeChild(renderer.domElement);
      meshMapRef.current.clear();
      visualGroupMapRef.current.clear();
      if (cutPreviewRef.current) { scene.remove(cutPreviewRef.current); cutPreviewRef.current.geometry.dispose(); (cutPreviewRef.current.material as THREE.Material).dispose(); cutPreviewRef.current = null; }
    };
  }, []);

  useEffect(() => {
    const group = meshGroupRef.current;
    if (!group) return;
    group.clear();
    meshMapRef.current.clear();
    visualGroupMapRef.current.clear();
    const membersByGroup = new Map<string, ModelObject[]>();
    for (const obj of objects) if (obj.groupId) membersByGroup.set(obj.groupId,[...(membersByGroup.get(obj.groupId) ?? []),obj]);
    const pivots = new Map<string, THREE.Group>();
    for (const [groupId,members] of membersByGroup) if (members.length > 1) {
      const pivot = new THREE.Group();
      const center = members.reduce((sum,obj)=>sum.add(new THREE.Vector3(...obj.position)),new THREE.Vector3()).multiplyScalar(1/members.length);
      pivot.position.copy(center); pivot.userData.groupId=groupId; group.add(pivot); pivots.set(groupId,pivot); visualGroupMapRef.current.set(groupId,pivot);
    }
    for (const obj of objects) {
      const geometry = geometryFor(obj);
      const material = new THREE.MeshStandardMaterial({
        color: obj.color, roughness: 0.58, metalness: 0.04,
        side: THREE.DoubleSide,
        emissive: selectedIds.includes(obj.id) ? new THREE.Color('#0b514b') : new THREE.Color('#000000'),
        emissiveIntensity: selectedIds.includes(obj.id) ? 0.65 : 0
      });
      const mesh = new THREE.Mesh(geometry, material);
      const pivot = obj.groupId ? pivots.get(obj.groupId) : undefined;
      if (pivot) mesh.position.set(obj.position[0]-pivot.position.x,obj.position[1]-pivot.position.y,obj.position[2]-pivot.position.z); else mesh.position.set(...obj.position);
      mesh.rotation.set(...obj.rotation.map(v => THREE.MathUtils.degToRad(v)) as [number, number, number]);
      mesh.scale.set(...obj.scale); mesh.userData.modelId = obj.id;
      if (pivot) mesh.userData.groupId=obj.groupId;
      mesh.castShadow = true; mesh.receiveShadow = true; (pivot ?? group).add(mesh); meshMapRef.current.set(obj.id, mesh);
    }
    const gizmo = transformControlsRef.current;
    const selectedObjects = objects.filter(obj=>selectedIds.includes(obj.id));
    const groupedSelection = selectedObjects.length > 1 && selectedObjects.every(obj=>obj.groupId && obj.groupId===selectedObjects[0].groupId);
    const activeMesh = selectedObjects.length===1 ? (selectedObjects[0].groupId ? visualGroupMapRef.current.get(selectedObjects[0].groupId!) : meshMapRef.current.get(selectedObjects[0].id)) : undefined;
    if (gizmo) {
      if (cutMode) {
        const handle = cutHandleRef.current;
        if (handle && selectedObjects.length === 1) {
          const mesh = meshMapRef.current.get(selectedObjects[0].id);
          if (mesh) {
            mesh.updateMatrixWorld(true);
            const bounds = new THREE.Box3().setFromObject(mesh);
            if (!bounds.isEmpty()) {
              const center = bounds.getCenter(new THREE.Vector3());
              handle.userData.cutAxis = cutAxis;
              // Keep the live handle position while dragging; otherwise sync it to the numeric controls.
              if (!gizmo.dragging) {
                handle.position.copy(center);
                if (cutAxis === 'x') handle.position.x = cutPosition;
                else if (cutAxis === 'y') handle.position.y = cutPosition;
                else handle.position.z = cutPosition;
                gizmo.attach(handle);
                gizmo.setMode('translate');
                gizmo.setSpace('world');
              }
              gizmo.showX = cutAxis === 'x'; gizmo.showY = cutAxis === 'y'; gizmo.showZ = cutAxis === 'z';
            } else gizmo.detach();
          } else gizmo.detach();
        } else gizmo.detach();
      } else {
        gizmo.showX = true; gizmo.showY = true; gizmo.showZ = true;
        if (groupedSelection) { const pivot=visualGroupMapRef.current.get(selectedObjects[0].groupId!); if(pivot){gizmo.attach(pivot);gizmo.setMode(transformMode);}else gizmo.detach(); }
        else if (activeMesh) { gizmo.attach(activeMesh); gizmo.setMode(transformMode); } else gizmo.detach();
      }
    }
  }, [objects, selectedIds, transformMode, cutMode, cutAxis, cutPosition]);

  useEffect(() => {
    const scene=sceneRef.current; if(!scene)return;
    if(cutPreviewRef.current){scene.remove(cutPreviewRef.current);cutPreviewRef.current.geometry.dispose();(cutPreviewRef.current.material as THREE.Material).dispose();cutPreviewRef.current=null;}
    if(!cutMode || selectedIds.length!==1)return;
    const mesh=meshMapRef.current.get(selectedIds[0]); if(!mesh)return; mesh.updateMatrixWorld(true);
    const bounds=new THREE.Box3().setFromObject(mesh); if(bounds.isEmpty())return;
    const p=Number(cutPosition), a=bounds.min, b=bounds.max; let corners:THREE.Vector3[];
    if(cutAxis==='x') corners=[new THREE.Vector3(p,a.y,a.z),new THREE.Vector3(p,b.y,a.z),new THREE.Vector3(p,b.y,b.z),new THREE.Vector3(p,a.y,b.z)];
    else if(cutAxis==='y') corners=[new THREE.Vector3(a.x,p,a.z),new THREE.Vector3(b.x,p,a.z),new THREE.Vector3(b.x,p,b.z),new THREE.Vector3(a.x,p,b.z)];
    else corners=[new THREE.Vector3(a.x,a.y,p),new THREE.Vector3(b.x,a.y,p),new THREE.Vector3(b.x,b.y,p),new THREE.Vector3(a.x,b.y,p)];
    const points:THREE.Vector3[]=[]; for(let i=0;i<4;i++)points.push(corners[i],corners[(i+1)%4]);
    const line=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:0xffb347,depthTest:false,transparent:true,opacity:.95}));
    line.renderOrder=999;line.frustumCulled=false;scene.add(line);cutPreviewRef.current=line;
    return ()=>{if(cutPreviewRef.current===line){scene.remove(line);line.geometry.dispose();(line.material as THREE.Material).dispose();cutPreviewRef.current=null;}};
  }, [cutMode,cutAxis,cutPosition,selectedIds,objects]);

  useEffect(() => { setLiveTransform(null); }, [selectedIds[0]]);

  useEffect(() => {
    for (const [id, mesh] of meshMapRef.current) {
      const material = mesh.material as THREE.MeshStandardMaterial;
      const isSelected = selectedIds.includes(id);
      material.emissive.set(isSelected ? '#0b514b' : '#000000');
      material.emissiveIntensity = isSelected ? 0.65 : 0;
    }
  }, [selectedIds]);

  const addShape = (type: Exclude<ShapeType, 'text' | 'gear' | 'thread'>) => {
    const names: Record<Exclude<ShapeType, 'text' | 'gear' | 'thread'>, string> = { box: 'Quader', cylinder: 'Zylinder', sphere: 'Kugel', cone: 'Kegel', custom: 'Importiertes Mesh' };
    const dimensions: Record<Exclude<ShapeType, 'text' | 'gear' | 'thread'>, [number, number, number]> = {
      box: [30, 12, 30], cylinder: [6, 100, 6], sphere: [20, 20, 20], cone: [20, 30, 20], custom: [20, 20, 20]
    };
    const obj: ModelObject = {
      id: makeId(), name: names[type], type, position: [0, 0, 0],
      rotation: [0, 0, 0], scale: [1, 1, 1], color: type === 'cylinder' ? '#e7a64b' : '#43b6a8',
      dimensions: dimensions[type]
    };
    setObjects(prev => [...prev, obj]);
    setSelectedIds([obj.id]);
    setStatus(`${obj.name} erstellt`);
  };

  const addGeneratedGeometry = (name: string, geometry: THREE.BufferGeometry, type: ShapeType) => {
    geometry.computeBoundingBox();
    const bounds = geometry.boundingBox;
    if (!bounds) { setStatus('Geometrie konnte nicht erstellt werden.'); geometry.dispose(); return; }
    const center = new THREE.Vector3(), size = new THREE.Vector3();
    bounds.getCenter(center); bounds.getSize(size);
    geometry.translate(-center.x, -center.y, -center.z);
    geometry.computeVertexNormals();
    const positions = Array.from(geometry.getAttribute('position').array as ArrayLike<number>);
    const index = geometry.getIndex();
    const indices = index ? Array.from(index.array as ArrayLike<number>) : null;
    geometry.dispose();
    const obj: ModelObject = {
      id: makeId(), name, type, position: [0, Math.max(size.y / 2, 0), 0],
      rotation: [0, 0, 0], scale: [1, 1, 1], color: type === 'gear' ? '#e7a64b' : '#43b6a8',
      dimensions: [Math.max(size.x, .1), Math.max(size.y, .1), Math.max(size.z, .1)],
      geometryData: { positions, indices }
    };
    setObjects(prev => [...prev, obj]); setSelectedIds([obj.id]); setCreatorMode(null);
    setStatus(name + ' erstellt · ' + obj.dimensions.map(v => v.toFixed(1)).join(' × ') + ' mm');
  };

  const createAdvancedObject = () => {
    try {
      if (creatorMode === 'text') {
        const value = textValue.trim();
        if (!value) { setStatus('Bitte einen Text eingeben.'); return; }
        const font = new FontLoader().parse(helvetikerFont as unknown as Parameters<FontLoader['parse']>[0]);
        const geometry = new TextGeometry(value.slice(0, 100), {
          font, size: THREE.MathUtils.clamp(textSize, 2, 200), depth: THREE.MathUtils.clamp(textDepth, .5, 100),
          curveSegments: 8, bevelEnabled: false
        });
        addGeneratedGeometry('Text: ' + value.slice(0, 24), geometry, 'text');
      } else if (creatorMode === 'gear') {
        const teeth = Math.round(THREE.MathUtils.clamp(gearTeeth, 6, 120));
        const m = THREE.MathUtils.clamp(gearModule, .5, 20);
        const outer = m * (teeth + 2) / 2, root = m * (teeth - 2.5) / 2;
        const shape = new THREE.Shape();
        for (let i = 0; i < teeth * 4; i++) {
          const a = i * Math.PI * 2 / (teeth * 4) - Math.PI / 2;
          const r = (i % 4 === 1 || i % 4 === 2) ? outer : root;
          const x = Math.cos(a) * r, y = Math.sin(a) * r;
          if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
        }
        shape.closePath();
        const hole = new THREE.Path();
        hole.absarc(0, 0, Math.max(m * 1.5, root * .18), 0, Math.PI * 2, true);
        shape.holes.push(hole);
        const geometry = new THREE.ExtrudeGeometry(shape, { depth: THREE.MathUtils.clamp(gearThickness, 1, 100), bevelEnabled: false, curveSegments: 2 });
        geometry.rotateX(-Math.PI / 2);
        addGeneratedGeometry('Zahnrad ' + teeth + ' Zähne', geometry, 'gear');
      } else if (creatorMode === 'thread') {
        const diameter = THREE.MathUtils.clamp(threadDiameter, 3, 200);
        const pitch = THREE.MathUtils.clamp(threadPitch, .5, 20);
        const length = THREE.MathUtils.clamp(threadLength, pitch, 500);
        const radius = diameter / 2;
        const turns = Math.max(1, Math.ceil(length / pitch));
        // Erzeuge eine einzige geschlossene Mantelfläche: Der Radius folgt
        // einem trapezförmigen Gewindeprofil entlang der Helix. Anders als
        // Kernzylinder + separate Helix gibt es hier keine überlappenden
        // Teilkörper und keine offenen Kanten zwischen den Teilen.
        const around = Math.min(4096, turns * 64);
        const along = Math.min(4096, turns * 32);
        const rootRadius = Math.max(0.5, radius - pitch * 0.42);
        const crestRadius = Math.max(rootRadius + 0.1, radius);
        const vertices: number[] = [];
        const indices: number[] = [];
        const profileRadius = (phase: number) => {
          const p = ((phase % 1) + 1) % 1;
          // Crest, flank, root, flank: trapezförmiger Gewindequerschnitt.
          if (p < 0.125 || p >= 0.875) return crestRadius;
          if (p < 0.5) return crestRadius + (rootRadius - crestRadius) * ((p - 0.125) / 0.375);
          if (p < 0.75) return rootRadius;
          return rootRadius + (crestRadius - rootRadius) * ((p - 0.75) / 0.125);
        };
        // Mantelraster mit doppelter Nahtspalte, damit die Oberfläche an
        // theta=0/2π exakt geschlossen trianguliert werden kann.
        for (let j = 0; j <= along; j++) {
          const y = (j / along) * length;
          for (let i = 0; i <= around; i++) {
            const theta = (i / around) * Math.PI * 2;
            const phase = y / pitch - theta / (Math.PI * 2);
            const r = profileRadius(phase);
            vertices.push(Math.cos(theta) * r, y, Math.sin(theta) * r);
          }
        }
        const stride = around + 1;
        for (let j = 0; j < along; j++) {
          for (let i = 0; i < around; i++) {
            const a = j * stride + i;
            const b = a + 1;
            const c = a + stride;
            const d = c + 1;
            indices.push(a, c, b, b, c, d);
          }
        }
        // Stirnflächen schließen den Körper vollständig. Jeweils ein
        // Mittelpunkt und ein Dreiecksfächer, dessen Rand auf dem Mantel liegt.
        const bottomCenter = vertices.length / 3;
        vertices.push(0, 0, 0);
        const topCenter = vertices.length / 3;
        vertices.push(0, length, 0);
        for (let i = 0; i < around; i++) {
          const b0 = i;
          const b1 = i + 1;
          const t0 = along * stride + i;
          const t1 = t0 + 1;
          // Gegenläufige Wicklung für äußere Flächennormalen.
          indices.push(bottomCenter, b0, b1);
          indices.push(topCenter, t1, t0);
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();
        geometry.computeBoundingBox();
        geometry.computeBoundingSphere();
        addGeneratedGeometry('Gewinde M' + diameter + ' × ' + pitch, merged, 'thread');
      }
    } catch (error) {
      setStatus('Erstellung fehlgeschlagen: ' + (error instanceof Error ? error.message : 'Unbekannter Fehler'));
    }
  };

  const updateSelected = (patch: Partial<ModelObject>) => {
    if (!selected) return;
    setObjects(prev => prev.map(o => o.id === selected.id ? { ...o, ...patch } : o));
  };
  const updateVector = (key: 'position' | 'rotation' | 'scale' | 'dimensions', axis: number, value: number) => {
    if (!selected || !Number.isFinite(value)) return;
    const vector = [...selected[key]] as [number, number, number];
    vector[axis] = value;
    updateSelected({ [key]: vector } as Partial<ModelObject>);
  };

  const subtract = useCallback(() => {
    if (selectedIds.length < 2) {
      setStatus('Bitte zuerst das Zielobjekt bzw. die Gruppe wählen, dann mit Umschalt-Klick den Schneidkörper auswählen.');
      return;
    }
    const firstTarget = objects.find(o => o.id === selectedIds[0]);
    if (!firstTarget) {
      setStatus('Zielobjekt konnte nicht gefunden werden.');
      return;
    }
    const targetMembers = firstTarget.groupId
      ? objects.filter(o => o.groupId === firstTarget.groupId)
      : [firstTarget];
    const targetIds = new Set(targetMembers.map(o => o.id));
    const cutterSelectedId = selectedIds.find(id => !targetIds.has(id));
    const cutterData = cutterSelectedId ? objects.find(o => o.id === cutterSelectedId) : undefined;
    if (!cutterSelectedId || !cutterData) {
      setStatus('Bitte zuerst ein Zielobjekt oder eine Gruppe auswählen und anschließend den Schneidkörper mit Umschalt-Klick hinzufügen.');
      return;
    }
    // Selecting any member of a group as the cutter means the entire group is used
    // as one combined cutting volume, even when only one member was shift-clicked.
    const cutterMembers = cutterData.groupId
      ? objects.filter(o => o.groupId === cutterData.groupId)
      : [cutterData];
    const cutterIds = new Set(cutterMembers.map(o => o.id));
    const targets = targetMembers.filter(item => !cutterIds.has(item.id));
    if (!targets.length) {
      setStatus('Ziel- und Schneidgruppe müssen unterschiedliche Objekte enthalten.');
      return;
    }
    setBusy(true);
    setStatus(cutterMembers.length > 1
      ? `Schneidgruppe wird zusammengeführt · ${cutterMembers.length} Körper …`
      : targets.length > 1
        ? `Gruppenschnitt wird vorbereitet · ${targets.length} Objekte …`
        : 'Ausschnitt wird vorbereitet …');
    try {
      const prepareCsgGeometry = (mesh: THREE.Mesh) => {
        let geometry = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
        const position = geometry.getAttribute('position');
        if (!position || position.count < 3 || position.itemSize !== 3) {
          geometry.dispose();
          throw new Error('Ein Körper besitzt keine gültigen Positionsdaten.');
        }
        const uv = geometry.getAttribute('uv');
        if (!uv || uv.count !== position.count || uv.itemSize !== 2) {
          geometry.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(position.count * 2), 2));
        }
        const normal = geometry.getAttribute('normal');
        if (!normal || normal.count !== position.count || normal.itemSize !== 3) {
          geometry.deleteAttribute('normal');
          geometry.computeVertexNormals();
        }
        for (const name of Object.keys(geometry.attributes)) {
          const attribute = geometry.getAttribute(name);
          if (attribute.count !== position.count) geometry.deleteAttribute(name);
        }
        if (!geometry.getIndex()) {
          const indexed = mergeVertices(geometry, 1e-5);
          geometry.dispose();
          geometry = indexed;
        }
        geometry.clearGroups();
        geometry.computeVertexNormals();
        geometry.computeBoundingBox();
        geometry.computeBoundingSphere();
        const indexCount = geometry.getIndex()?.count ?? geometry.getAttribute('position').count;
        geometry.addGroup(0, indexCount, 0);
        return geometry;
      };
      const evaluator = new Evaluator();
      evaluator.useGroups = false;
      let cutterBrush: Brush | null = null;
      let cutterGeometry: THREE.BufferGeometry | null = null;
      let cutterMaterial: THREE.MeshStandardMaterial | null = null;
      for (let i = 0; i < cutterMembers.length; i++) {
        const member = cutterMembers[i];
        const mesh = meshMapRef.current.get(member.id);
        if (!mesh) throw new Error(`Schneidobjekt „${member.name}“ ist nicht in der Szene vorhanden.`);
        mesh.updateMatrixWorld(true);
        const geometry = prepareCsgGeometry(mesh);
        const material = new THREE.MeshStandardMaterial({ color: member.color, side: THREE.DoubleSide });
        const brush = new Brush(geometry, material);
        brush.updateMatrixWorld(true);
        if (!cutterBrush) {
          cutterBrush = brush;
          cutterGeometry = geometry;
          cutterMaterial = material;
        } else {
          setStatus(`Schneidgruppe: ${i + 1} von ${cutterMembers.length} Körpern zusammenführen …`);
          const combined: Brush = evaluator.evaluate(cutterBrush, brush, ADDITION);
          cutterGeometry?.dispose();
          cutterMaterial?.dispose();
          geometry.dispose();
          material.dispose();
          cutterBrush = combined;
          cutterGeometry = combined.geometry;
          cutterMaterial = null;
          combined.updateMatrixWorld(true);
        }
      }
      if (!cutterBrush) throw new Error('Die Schneidgruppe enthält keine gültigen Körper.');
      const replacements = new Map<string, ModelObject>();
      for (let i = 0; i < targets.length; i++) {
        const targetData = targets[i];
        const target = meshMapRef.current.get(targetData.id);
        if (!target) throw new Error(`Zielobjekt „${targetData.name}“ ist nicht in der Szene vorhanden.`);
        target.updateMatrixWorld(true);
        const targetGeometry = prepareCsgGeometry(target);
        const targetMaterial = new THREE.MeshStandardMaterial({ color: targetData.color, side: THREE.DoubleSide });
        const targetBrush = new Brush(targetGeometry, targetMaterial);
        targetBrush.updateMatrixWorld(true);
        setStatus(targets.length > 1
          ? `Gruppenschnitt: ${i + 1} von ${targets.length} Objekten …`
          : 'Boolean-Schnitt wird berechnet …');
        const result = evaluator.evaluate(targetBrush, cutterBrush, SUBTRACTION);
        targetGeometry.dispose();
        targetMaterial.dispose();
        if (!result.geometry.getAttribute('position') || result.geometry.getAttribute('position').count < 3) {
          result.geometry.dispose();
          throw new Error(`Der Schnitt bei „${targetData.name}“ lieferte keine gültige Geometrie. Prüfe, ob sich Schneidkörper und Objekt überschneiden.`);
        }
        const geometry = result.geometry;
        geometry.computeBoundingBox();
        const bounds = geometry.boundingBox;
        if (!bounds) {
          geometry.dispose();
          throw new Error(`Für „${targetData.name}“ konnten keine Abmessungen ermittelt werden.`);
        }
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        bounds.getSize(size);
        bounds.getCenter(center);
        geometry.translate(-center.x, -center.y, -center.z);
        geometry.clearGroups();
        const positionAttribute = geometry.getAttribute('position');
        if (!positionAttribute || positionAttribute.count < 3) {
          geometry.dispose();
          throw new Error(`„${targetData.name}“ lieferte keine gültigen Positionsdaten.`);
        }
        geometry.computeVertexNormals();
        geometry.computeBoundingBox();
        geometry.computeBoundingSphere();
        const positions = Array.from(positionAttribute.array as ArrayLike<number>);
        const index = geometry.getIndex();
        const indices = index?.array ? Array.from(index.array as ArrayLike<number>) : null;
        if (positions.length < 9) {
          geometry.dispose();
          throw new Error(`„${targetData.name}“ enthält keine gültige Oberfläche.`);
        }
        replacements.set(targetData.id, {
          ...targetData,
          type: 'custom',
          position: [center.x, center.y, center.z],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
          dimensions: [size.x, size.y, size.z],
          geometryData: { positions, indices }
        });
        geometry.dispose();
      }
      cutterGeometry?.dispose();
      cutterMaterial?.dispose();
      setObjects(prev => prev
        .filter(o => !cutterIds.has(o.id))
        .map(o => replacements.get(o.id) ?? o));
      setSelectedIds(targets.map(o => o.id));
      setStatus(cutterMembers.length > 1
        ? `Gruppenschnitt erfolgreich: ${cutterMembers.length} Schneidkörper angewendet; ${targets.length} Zielobjekt(e) ausgeschnitten.`
        : targets.length > 1
          ? `Gruppenschnitt erfolgreich: ${targets.length} Objekte wurden ausgeschnitten.`
          : 'Ausschnitt erfolgreich erstellt. Der Schneidkörper wurde entfernt.');
    } catch (error) {
      console.error(error);
      setStatus(`Ausschnitt fehlgeschlagen: ${error instanceof Error ? error.message : 'Geometriefehler'}`);
    } finally {
      setBusy(false);
    }
  }, [objects, selectedIds]);

  useEffect(() => {
    if (selectedIds.length !== 1) return;
    const selectedObject = objects.find(obj => obj.id === selectedIds[0]);
    if (!selectedObject) return;
    const axis = cutAxis === 'x' ? 0 : cutAxis === 'y' ? 1 : 2;
    setCutPosition(selectedObject.position[axis]);
  }, [selectedIds[0], cutAxis]);
  const cutAtPlane = useCallback(() => {
    if (selectedIds.length !== 1) {
      setStatus('Bitte genau ein Objekt auswählen, das an einer Ebene geteilt werden soll.');
      return;
    }
    const targetId = selectedIds[0];
    const mesh = meshMapRef.current.get(targetId);
    const original = objectsRef.current.find(o => o.id === targetId);
    if (!mesh || !original) return;
    setBusy(true);
    try {
      mesh.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(mesh);
      if (bounds.isEmpty()) throw new Error('Für dieses Objekt konnten keine Abmessungen ermittelt werden.');
      const size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      const axis = cutAxis === 'x' ? 0 : cutAxis === 'y' ? 1 : 2;
      const extent = Math.max(size.x, size.y, size.z, 10) * 3 + 10;
      const plane = Number(cutPosition);
      if (!Number.isFinite(plane)) throw new Error('Bitte eine gültige Schnittposition in mm eingeben.');
      const inputGeometry = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
      const pos = inputGeometry.getAttribute('position');
      if (!pos || pos.count < 3) throw new Error('Das Objekt enthält keine gültigen Positionsdaten.');
      if (!inputGeometry.getAttribute('uv') || inputGeometry.getAttribute('uv').count !== pos.count) {
        inputGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(pos.count * 2), 2));
      }
      inputGeometry.deleteAttribute('normal');
      inputGeometry.computeVertexNormals();
      for (const name of Object.keys(inputGeometry.attributes)) {
        if (inputGeometry.getAttribute(name).count !== pos.count) inputGeometry.deleteAttribute(name);
      }
      let indexedGeometry = inputGeometry;
      if (!indexedGeometry.getIndex()) {
        indexedGeometry = mergeVertices(inputGeometry, 1e-5);
        inputGeometry.dispose();
      }
      indexedGeometry.clearGroups();
      indexedGeometry.computeVertexNormals();
      indexedGeometry.addGroup(0, indexedGeometry.getIndex()?.count ?? indexedGeometry.getAttribute('position').count, 0);
      const targetBrush = new Brush(indexedGeometry, new THREE.MeshStandardMaterial({ color: original.color, side: THREE.DoubleSide }));
      targetBrush.updateMatrixWorld(true);

      const cutterSize: [number, number, number] = [size.x + extent * 2, size.y + extent * 2, size.z + extent * 2];
      cutterSize[axis] = extent * 2;
      const cutterGeometry = new THREE.BoxGeometry(...cutterSize);
      const cutterMesh = new THREE.Mesh(cutterGeometry);
      cutterMesh.position.copy(center);
      if (axis === 0) cutterMesh.position.x = plane + extent;
      if (axis === 1) cutterMesh.position.y = plane + extent;
      if (axis === 2) cutterMesh.position.z = plane + extent;
      cutterMesh.updateMatrixWorld(true);
      const worldCutterGeometry = cutterGeometry.clone().applyMatrix4(cutterMesh.matrixWorld);
      worldCutterGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(worldCutterGeometry.getAttribute('position').count * 2), 2));
      worldCutterGeometry.computeVertexNormals();
      worldCutterGeometry.clearGroups();
      worldCutterGeometry.addGroup(0, worldCutterGeometry.getIndex()?.count ?? worldCutterGeometry.getAttribute('position').count, 0);
      const cutterBrush = new Brush(worldCutterGeometry, new THREE.MeshStandardMaterial({ side: THREE.DoubleSide }));
      cutterBrush.updateMatrixWorld(true);
      const evaluator = new Evaluator();
      evaluator.useGroups = false;
      setStatus('Schnittfläche wird berechnet …');
      const positive = evaluator.evaluate(targetBrush, cutterBrush, INTERSECTION).geometry;
      const negative = evaluator.evaluate(targetBrush, cutterBrush, SUBTRACTION).geometry;
      const makeHalf = (geometry: THREE.BufferGeometry, suffix: string): ModelObject | null => {
        const p = geometry.getAttribute('position');
        if (!p || p.count < 3) { geometry.dispose(); return null; }
        geometry.computeBoundingBox();
        if (!geometry.boundingBox) { geometry.dispose(); return null; }
        const halfSize = geometry.boundingBox.getSize(new THREE.Vector3());
        const halfCenter = geometry.boundingBox.getCenter(new THREE.Vector3());
        geometry.translate(-halfCenter.x, -halfCenter.y, -halfCenter.z);
        geometry.computeVertexNormals();
        const index = geometry.getIndex();
        const data = { positions: Array.from(geometry.getAttribute('position').array as ArrayLike<number>), indices: index?.array ? Array.from(index.array as ArrayLike<number>) : null };
        geometry.dispose();
        if (data.positions.length < 9) return null;
        return { ...original, id: makeId(), name: original.name + suffix, type: 'custom', position: halfCenter.toArray() as [number, number, number], rotation: [0, 0, 0], scale: [1, 1, 1], dimensions: [halfSize.x, halfSize.y, halfSize.z], geometryData: data, groupId: original.groupId };
      };
      const halves = [makeHalf(negative, ' – Teil A'), makeHalf(positive, ' – Teil B')].filter((o): o is ModelObject => o !== null);
      indexedGeometry.dispose();
      cutterBrush.geometry.dispose();
      (targetBrush.material as THREE.Material).dispose();
      (cutterBrush.material as THREE.Material).dispose();
      cutterGeometry.dispose();
      if (halves.length !== 2) throw new Error('Die Ebene hat den Körper nicht in zwei gültige Teile getrennt. Verschiebe die Schnittposition in den Körper hinein.');
      setObjects(prev => [...prev.filter(o => o.id !== targetId), ...halves]);
      setSelectedIds(halves.map(o => o.id));
      setStatus('Objekt an der gewählten Ebene in zwei Teile getrennt.');
    } catch (error) {
      console.error(error);
      setStatus('Schnitt fehlgeschlagen: ' + (error instanceof Error ? error.message : 'Geometriefehler'));
    } finally {
      setBusy(false);
    }
  }, [selectedIds, cutAxis, cutPosition]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); undo(); return; }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'r') { event.preventDefault(); redo(); return; }
      if (event.key.toLowerCase() === 'h' && !event.altKey) { event.preventDefault(); subtract(); }
      if (event.altKey && event.key.toLowerCase() === 'c') { event.preventDefault(); cutAtPlane(); return; }
      if (event.key.toLowerCase() === 'c' && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        setCutMode(previous => { const next = !previous; setStatus(next ? 'Schnittmodus aktiv · Ebene einstellen und Objekt teilen.' : 'Schnittmodus beendet.'); return next; });
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); saveProject(); }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        setObjects(prev => prev.filter(o => !selectedIds.includes(o.id)));
        setSelectedIds([]);
      }
      if (event.key === 'Escape') setSelectedIds([]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [subtract, cutAtPlane, selectedIds, historyVersion]);

  const saveProject = () => {
    const project = { format: '3dmaker-project', version: 1, name: projectName, objects };
    downloadFile(`${projectName.replace(/[^a-z0-9-_ ]/gi, '_')}.3dmaker.json`, JSON.stringify(project, null, 2), 'application/json');
    setStatus('Projekt lokal exportiert.');
  };
  const openProject = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        if (data.format !== '3dmaker-project' || !Array.isArray(data.objects)) throw new Error('Keine gültige 3DMaker-Projektdatei.');
        setObjects(data.objects);
        setProjectName(typeof data.name === 'string' ? data.name : 'Importiertes Projekt');
        setSelectedIds([]);
        setStatus('Projekt geöffnet.');
      } catch (e) { setStatus(e instanceof Error ? e.message : 'Projekt konnte nicht geöffnet werden.'); }
    };
    reader.readAsText(file);
  };
  const importMesh = (file?: File) => {
    if (!file) return;
    const extension = file.name.split('.').pop()?.toLowerCase();
    const finishImport = (sourceGeometry: THREE.BufferGeometry) => {
      sourceGeometry.computeBoundingBox();
      const bounds = sourceGeometry.boundingBox;
      if (!bounds) throw new Error('Keine gültigen Mesh-Abmessungen gefunden.');
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      bounds.getSize(size);
      bounds.getCenter(center);
      sourceGeometry.translate(-center.x, -center.y, -center.z);
      sourceGeometry.computeVertexNormals();
      sourceGeometry.computeBoundingBox();
      sourceGeometry.computeBoundingSphere();
      const positions = Array.from(sourceGeometry.getAttribute('position').array as ArrayLike<number>);
      const index = sourceGeometry.getIndex();
      const indices = index ? Array.from(index.array as ArrayLike<number>) : null;
      const obj: ModelObject = {
        id: makeId(), name: file.name.replace(/\.(stl|obj)$/i, ''), type: 'custom',
        position: [center.x, center.y, center.z], rotation: [0, 0, 0], scale: [1, 1, 1], color: '#43b6a8',
        dimensions: [size.x, size.y, size.z], geometryData: { positions, indices }
      };
      setObjects(prev => [...prev, obj]); setSelectedIds([obj.id]); setStatus(extension?.toUpperCase() + '-Modell importiert.');
    };
    if (extension === 'stl') {
      const reader = new FileReader();
      reader.onload = () => {
        try { finishImport(new STLLoader().parse(reader.result as ArrayBuffer)); }
        catch (error) { setStatus('STL-Import fehlgeschlagen: ' + (error instanceof Error ? error.message : 'Dateifehler')); }
      };
      reader.readAsArrayBuffer(file);
    } else if (extension === 'obj') {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const root = new OBJLoader().parse(String(reader.result));
          root.updateMatrixWorld(true);
          const parts: THREE.BufferGeometry[] = [];
          root.traverse(child => {
            if (!(child instanceof THREE.Mesh)) return;
            const geometry = child.geometry.clone();
            geometry.applyMatrix4(child.matrixWorld);
            if (!geometry.getAttribute('position')) return;
            parts.push(geometry);
          });
          if (!parts.length) throw new Error('Die OBJ-Datei enthält keine Mesh-Geometrie.');
          const merged = mergeGeometries(parts, false);
          parts.forEach(g => g.dispose());
          if (!merged) throw new Error('Die OBJ-Teile konnten nicht zusammengefügt werden.');
          finishImport(merged);
        } catch (error) { setStatus('OBJ-Import fehlgeschlagen: ' + (error instanceof Error ? error.message : 'Dateifehler')); }
      };
      reader.readAsText(file);
    } else {
      setStatus('Bitte eine STL-, OBJ- oder .3dmaker.json-Datei verwenden.');
    }
  };
  const handleDroppedFiles = (files: FileList | File[]) => {
    const file = Array.from(files)[0];
    if (!file) return;
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (extension === 'stl' || extension === 'obj') importMesh(file);
    else if (extension === 'json' || file.name.toLowerCase().endsWith('.3dmaker.json')) openProject(file);
    else setStatus('Dateiformat nicht unterstützt. Erlaubt: STL, OBJ und 3DMaker-Projekte.');
  };
  const onDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  };
  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    handleDroppedFiles(event.dataTransfer.files);
  };
  const exportStl = () => {
    const group = meshGroupRef.current;
    if (!group || objects.length === 0) { setStatus('Keine Geometrie zum Exportieren.'); return; }
    group.updateMatrixWorld(true);
    const text = new STLExporter().parse(group, { binary: false });
    downloadFile('3dmaker-export.stl', text, 'model/stl');
    setStatus('STL exportiert.');
  };
  const placeOnGround = () => {
    if (!selected) { setStatus('Bitte zuerst ein Objekt auswählen.'); return; }
    const mesh = meshMapRef.current.get(selected.id);
    if (!mesh) return;
    mesh.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(mesh);
    if (bounds.isEmpty()) { setStatus('Für dieses Objekt konnten keine Abmessungen ermittelt werden.'); return; }
    const nextY = mesh.position.y - bounds.min.y;
    updateSelected({ position: [selected.position[0], nextY, selected.position[2]] });
    setStatus('„' + selected.name + '“ auf den Boden gesetzt (Unterkante Y = 0).');
  };

  const focusView = () => {
    const camera = cameraRef.current; const controls = controlsRef.current;
    if (!camera || !controls) return;
    const box = new THREE.Box3();
    for (const mesh of meshMapRef.current.values()) box.expandByObject(mesh);
    if (box.isEmpty()) { controls.target.set(0, 0, 0); camera.position.set(110, 100, 150); }
    else {
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      controls.target.copy(center);
      const distance = Math.max(size.x, size.y, size.z, 30) * 2.2;
      camera.position.copy(center).add(new THREE.Vector3(distance, distance * 0.75, distance));
    }
    controls.update();
  };

  return <main className={`app-shell theme-${appTheme}`}>
    {settingsOpen && <div className="settings-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setSettingsOpen(false); }}><section className="settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title"><header className="settings-heading"><div><span className="settings-kicker">3DMAKER · v{APP_VERSION}</span><h2 id="settings-title">{t("settings")}</h2></div><button className="settings-close" onClick={() => setSettingsOpen(false)} aria-label={t("close")}>×</button></header><div className="settings-content"><section className="settings-section"><h3>{t("appearance")}</h3><label>{t("theme")}<select value={appTheme} onChange={e => setAppTheme(e.target.value as AppTheme)}><option value="dark">{t("dark")}</option><option value="light">{t("light")}</option></select></label></section><section className="settings-section"><h3>{t("language")}</h3><label>{t("language")}<select value={appLanguage} onChange={e => setAppLanguage(e.target.value as AppLanguage)}><option value="de">Deutsch</option><option value="en">English</option></select></label></section><section className="settings-section settings-about"><h3>{t("info")}</h3><div className="about-row"><span>{t("version")}</span><strong>3D-Maker v{APP_VERSION}</strong></div><div className="about-row"><span>{t("contact")}</span><strong>Shad3pi</strong></div><p>{t("credit")}</p><a href="https://github.com/Inrouder/3D-Maker" target="_blank" rel="noreferrer">↗ {t("repository")}</a></section></div><footer className="settings-footer"><button className="primary" onClick={() => setSettingsOpen(false)}>{t("close")}</button></footer></section></div>}

    {creatorMode && <div className="settings-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setCreatorMode(null); }}><section className="settings-dialog creator-dialog" role="dialog" aria-modal="true" aria-labelledby="creator-title"><header className="settings-heading"><div><span className="settings-kicker">3DMAKER · PARAMETRISCHE FORM</span><h2 id="creator-title">{creatorMode === 'text' ? '3D-Text erstellen' : creatorMode === 'gear' ? 'Zahnrad erstellen' : 'Gewinde erstellen'}</h2></div><button className="settings-close" onClick={() => setCreatorMode(null)} aria-label="Schließen">×</button></header><div className="settings-content">
      {creatorMode === 'text' && <><label className="creator-field">Text<input autoFocus maxLength={100} value={textValue} onChange={e => setTextValue(e.target.value)} placeholder="Dein Text" /></label><label className="creator-field">Buchstabenhöhe (mm)<input type="number" min="2" max="200" step="1" value={textSize} onChange={e => setTextSize(Number(e.target.value))} /></label><label className="creator-field">Extrusionstiefe (mm)<input type="number" min="0.5" max="100" step="0.5" value={textDepth} onChange={e => setTextDepth(Number(e.target.value))} /></label><p className="creator-hint">Erzeugt echte extrudierte 3D-Geometrie, keine Textur.</p></>}
      {creatorMode === 'gear' && <><label className="creator-field">Zähnezahl<input type="number" min="6" max="120" step="1" value={gearTeeth} onChange={e => setGearTeeth(Number(e.target.value))} /></label><label className="creator-field">Modul (mm)<input type="number" min="0.5" max="20" step="0.5" value={gearModule} onChange={e => setGearModule(Number(e.target.value))} /></label><label className="creator-field">Dicke (mm)<input type="number" min="1" max="100" step="1" value={gearThickness} onChange={e => setGearThickness(Number(e.target.value))} /></label><p className="creator-hint">Außendurchmesser ungefähr Modul × (Zähnezahl + 2). Das Zahnrad hat eine zentrale Bohrung.</p></>}
      {creatorMode === 'thread' && <><label className="creator-field">Nenndurchmesser (mm)<input type="number" min="3" max="200" step="1" value={threadDiameter} onChange={e => setThreadDiameter(Number(e.target.value))} /></label><label className="creator-field">Steigung (mm)<input type="number" min="0.5" max="20" step="0.5" value={threadPitch} onChange={e => setThreadPitch(Number(e.target.value))} /></label><label className="creator-field">Gewindelänge (mm)<input type="number" min="1" max="500" step="1" value={threadLength} onChange={e => setThreadLength(Number(e.target.value))} /></label><p className="creator-hint">Erstellt ein Außengewinde mit spiralförmigem Gewindegang und Kernkörper. Für passgenaue Normgewinde Maße nachbearbeiten.</p></>}
      </div><footer className="settings-footer"><button className="secondary" onClick={() => setCreatorMode(null)}>Abbrechen</button><button className="primary" onClick={createAdvancedObject}>3D-Objekt erstellen</button></footer></section></div>}

    <header className="topbar">
      <div className="brand-mark">3D</div><div className="brand-copy"><strong>3DMaker</strong><span>OFFLINE 3D MODELLIERER</span></div>
      <div className="top-divider" />
      <label className="project-label">{t("project")} <input value={projectName} onChange={e => setProjectName(e.target.value)} aria-label="Projektname" /></label>
      <div className="top-actions">
        <button className="settings-trigger" onClick={() => setSettingsOpen(true)} title={t("settings")}>⚙ <span>{t("settings")}</span></button>
        <button onClick={undo} disabled={undoStackRef.current.length === 0} title="Rückgängig (Strg+Z)">{t("undo")}</button>
        <button onClick={redo} disabled={redoStackRef.current.length === 0} title="Wiederholen (Strg+R)">{t("redo")}</button>
        <button onClick={saveProject} title="Projekt speichern (Strg+S)">{t("save")}</button>
        <label className="button secondary">{t("open")}<input hidden type="file" accept=".json,.3dmaker.json" onChange={e => openProject(e.target.files?.[0])} /></label>
        <label className="button secondary">{t("importMesh")}<input hidden type="file" accept=".stl,.obj" onChange={e => handleDroppedFiles(e.target.files ?? [])} /></label>
        <button className="primary" onClick={exportStl}>{t("export")}</button>
      </div>
    </header>

    <div className="workspace">
      <aside className="left-panel">
        <div className="panel-heading"><span>{t("tools")}</span><span className="tiny-dot" /></div>
        <div className="tool-section">
          <div className="section-label">{t("basics")}</div>
          <div className="shape-grid">
            <button className="shape-button" onClick={() => addShape('box')}><span className="shape-icon cube-icon">▰</span><span>{t("box")}</span></button>
            <button className="shape-button" onClick={() => addShape('cylinder')}><span className="shape-icon">⬭</span><span>{t("cylinder")}</span></button>
            <button className="shape-button" onClick={() => addShape('sphere')}><span className="shape-icon">●</span><span>{t("sphere")}</span></button>
            <button className="shape-button" onClick={() => addShape('cone')}><span className="shape-icon">▲</span><span>{t("cone")}</span></button>
            <button className="shape-button" onClick={() => setCreatorMode('text')}><span className="shape-icon">T₃</span><span>3D-Text</span></button>
            <button className="shape-button" onClick={() => setCreatorMode('gear')}><span className="shape-icon">⚙</span><span>Zahnrad</span></button>
            <button className="shape-button" onClick={() => setCreatorMode('thread')}><span className="shape-icon">⤿</span><span>Gewinde</span></button>
          </div>
        </div>
        <div className="tool-section">
          <div className="section-label">{t("grouping")}</div>
          <button className="wide-tool" disabled={selectedIds.length < 2} onClick={() => {
            if (selectedIds.length < 2) return;
            const groupId = makeId();
            setObjects(prev => prev.map(o => selectedIds.includes(o.id) ? { ...o, groupId } : o));
            setStatus(`${selectedIds.length} Objekte gruppiert und gemeinsam transformierbar.`);
          }}><span className="tool-glyph">▦</span><span><strong>{t("group")}</strong><small>Ausgewählte Objekte zusammenfassen</small></span></button>
          <button className="wide-tool" disabled={!selectedIds.some(id => objects.some(o => o.id === id && o.groupId))} onClick={() => {
            const ids = new Set(selectedIds.map(id => objects.find(o => o.id === id)?.groupId).filter((id): id is string => Boolean(id)));
            setObjects(prev => prev.map(o => o.groupId && ids.has(o.groupId) ? { ...o, groupId: undefined } : o));
            setStatus("Gruppierung aufgehoben.");
          }}><span className="tool-glyph">▤</span><span><strong>{t("ungroup")}</strong><small>Gruppe wieder in Einzelobjekte aufteilen</small></span></button>
        </div>
        <div className="tool-section">
          <div className="section-label">{t("geometry")}</div>
          <button className="wide-tool" disabled={busy} onClick={subtract}><span className="cut-symbol">−</span><span><strong>{t("cut")}</strong><small>Ziel minus Schneidkörper</small></span><kbd>H</kbd></button>
          <p className="hint">Erst das Werkstück wählen, dann mit Umschalt-Klick den Körper für das Loch.</p>
          <div className="section-label">{t("cutPlane")}</div>
          <button className={`wide-tool ${cutMode ? 'active' : ''}`} aria-pressed={cutMode} onClick={() => setCutMode(previous => { const next = !previous; setStatus(next ? 'Schnittmodus aktiv · Orange Linie zeigt die Schnittebene.' : 'Schnittmodus beendet.'); return next; })}><span className="cut-symbol">✂</span><span><strong>{cutMode ? t("cutOn") : t("cutOff")}</strong><small>Orange Schnittebene ein-/ausblenden</small></span><kbd>C</kbd></button>
          <div className="vector-row">
            <label><span>Achse</span><select value={cutAxis} onChange={e => setCutAxis(e.target.value as 'x' | 'y' | 'z')}><option value="x">X</option><option value="y">Y</option><option value="z">Z</option></select></label>
            <label><span>Position (mm)</span><input type="number" step="1" value={cutPosition} onChange={e => setCutPosition(Number(e.target.value))} /></label>
          </div>
          <button className="wide-tool" disabled={busy || selectedIds.length !== 1} onClick={cutAtPlane}><span className="cut-symbol">✂</span><span><strong>{t("split")}</strong><small>Ebene teilt in zwei eigenständige Teile</small></span></button>
        </div>
        <div className="tool-section">
          <div className="section-label">{t("view")}</div>
          <button className="wide-tool" onClick={placeOnGround} disabled={!selected}><span className="tool-glyph">↓</span><span><strong>{t("ground")}</strong><small>Unterkante auf Y = 0 ausrichten</small></span></button>
          <button className="wide-tool" onClick={focusView}><span className="tool-glyph">⌖</span><span><strong>{t("frame")}</strong><small>Modelle im Blick zentrieren</small></span></button>
          <button className="wide-tool" onClick={() => { controlsRef.current?.reset(); }}><span className="tool-glyph">⟳</span><span><strong>{t("reset")}</strong><small>Kamera zurücksetzen</small></span></button>
        </div>
        <div className="left-footer"><span className="privacy-icon">◈</span><span><strong>{t("private")}</strong><small>{t("noLogin")}</small></span></div>
      </aside>

      <section className="viewport-section">
        <div className="viewport-toolbar">
          <div className="view-title"><span className="live-dot" /> {t("workspace")} <span className="view-separator">/</span> <span className="muted">{t("perspective")}</span></div>
          <div className="transform-tools"><button className={transformMode === 'translate' ? 'active' : ''} onClick={() => setTransformMode('translate')} title="Verschieben">{t("move")}</button><button className={transformMode === 'rotate' ? 'active' : ''} onClick={() => setTransformMode('rotate')} title="Drehen">{t("rotate")}</button><button className={transformMode === 'scale' ? 'active' : ''} onClick={() => setTransformMode('scale')} title="Skalieren">{t("scale")}</button></div><div className="viewport-help"><span>Griffe ziehen · Umschalt + Klick: Mehrfachauswahl</span><span>Rad: Zoom · Ziehen: Orbit</span></div>
        </div>
        <div className="viewport" ref={hostRef} onDragOver={onDragOver} onDrop={onDrop}>
          <div className="viewport-badge">XYZ <span>·</span> MM</div>
          {selected && <div className="transform-readout"><strong>{transformMode === 'scale' ? 'SKALIERUNG LIVE' : transformMode === 'rotate' ? 'DREHUNG LIVE' : 'POSITION LIVE'}</strong>{transformMode === 'scale' ? <div>{['X','Y','Z'].map((axis, i) => <span key={axis}>{axis}: <b>{(liveTransform?.dimensions[i] ?? selected.dimensions[i] * selected.scale[i]).toFixed(2)} mm</b> <em>{(liveTransform?.delta[i] ?? 0) >= 0 ? '+' : ''}{(liveTransform?.delta[i] ?? 0).toFixed(2)} mm</em></span>)}</div> : transformMode === 'rotate' ? <div>{['X','Y','Z'].map((axis, i) => <span key={axis}>{axis}: <b>{(liveTransform?.rotation[i] ?? selected.rotation[i]).toFixed(1)}°</b></span>)}</div> : <div>{['X','Y','Z'].map((axis, i) => <span key={axis}>{axis}: <b>{selected.position[i].toFixed(2)} mm</b></span>)}</div>}</div>}
          <div className="drop-hint">STL / OBJ / .3dmaker.json hier ablegen</div>
          <div className="axis-badge"><span className="axis-x">X</span><span className="axis-y">Y</span><span className="axis-z">Z</span></div>
          {objects.length === 0 && <div className="empty-viewport">Erstelle links deinen ersten Körper.</div>}
        </div>
        <div className="statusbar"><span className="status-icon">✓</span><span>{status}</span><span className="status-spacer" /><span>{objects.length} Objekt{objects.length === 1 ? '' : 'e'}</span><span className="status-unit">Einheit: mm</span></div>
      </section>

      <aside className="right-panel">
        <div className="panel-heading"><span>{t("explorer")}</span><span className="object-count">{objects.length}</span></div>
        <div className="object-list">
          {objects.map((obj, index) => <button key={obj.id} className={`object-row ${selectedIds.includes(obj.id) ? 'selected' : ''}`} onClick={e => {
            if (e.shiftKey) setSelectedIds(prev => prev.includes(obj.id) ? prev.filter(id => id !== obj.id) : [...prev, obj.id]);
            else if (obj.groupId) setSelectedIds(objects.filter(item => item.groupId === obj.groupId).map(item => item.id));
            else setSelectedIds([obj.id]);
          }}>
            <span className="object-index">{String(index + 1).padStart(2, '0')}</span><span className="object-color" style={{ background: obj.color }} /><span className="object-name">{obj.groupId && <span className="group-mark" title={`Gruppenmitglied · ${obj.groupId}`}>GRUPPE</span>}{obj.name}</span>{selectedIds.includes(obj.id) && <span className="selected-mark">●</span>}
          </button>)}
          {objects.length === 0 && <div className="empty-list">Noch keine Objekte vorhanden.</div>}
        </div>
        <div className="properties-heading"><span>{t("properties")}</span>{selected && <span className="property-type">{selected.type.toUpperCase()}</span>}</div>
        {selected ? <div className="properties">
          <label className="field-label">{t("name")}<input value={selected.name} onChange={e => updateSelected({ name: e.target.value })} /></label>
          <label className="field-label">{t("color")}<div className="color-field"><input type="color" value={selected.color} onChange={e => updateSelected({ color: e.target.value })} /><span>{selected.color.toUpperCase()}</span></div></label>
          <VectorFields title="POSITION" labels={['X', 'Y', 'Z']} values={selected.position} onChange={(i, v) => updateVector('position', i, v)} />
          <VectorFields title="DREHUNG °" labels={['X', 'Y', 'Z']} values={selected.rotation} onChange={(i, v) => updateVector('rotation', i, v)} />
          <VectorFields title="ABMESSUNGEN MM · GRUNDMAẞ" labels={['B', 'H', 'T']} values={selected.dimensions} onChange={(i, v) => updateVector('dimensions', i, Math.max(0.1, v))} />
          <VectorFields title="SKALIERUNG ×" labels={['X', 'Y', 'Z']} values={selected.scale} onChange={(i, v) => updateVector('scale', i, Math.max(0.01, v))} />
          <div className="actual-dimensions"><span>AKTUELLE GESAMTMAẞE</span><strong>{selected.dimensions.map((v, i) => `${(v * selected.scale[i]).toFixed(2)} mm`).join(' × ')}</strong></div>
          <div className="property-actions"><button className="secondary full-button" onClick={() => setObjects(prev => [...prev, { ...selected, id: makeId(), name: `${selected.name} Kopie`, position: [selected.position[0] + 10, selected.position[1], selected.position[2] + 10], geometryData: selected.geometryData ? { positions: [...selected.geometryData.positions], indices: selected.geometryData.indices ? [...selected.geometryData.indices] : null } : undefined }])}>{t("duplicate")}</button><button className="danger" onClick={() => { setObjects(prev => prev.filter(o => o.id !== selected.id)); setSelectedIds(prev => prev.filter(id => id !== selected.id)); }}>{t("delete")}</button></div>
        </div> : <div className="no-selection"><span>◇</span><strong>{t("noObject")}</strong><p>Wähle ein Objekt in der Szene oder im Explorer, um seine Eigenschaften zu bearbeiten.</p></div>}
        {selectedIds.length === 2 && <div className="cut-info"><strong>Boolean bereit</strong><p>1. {objects.find(o => o.id === selectedIds[0])?.name} minus 2. {objects.find(o => o.id === selectedIds[1])?.name}</p><button className="primary full-button" disabled={busy} onClick={subtract}>Ausschnitt berechnen · H</button></div>}
        <div className="right-footer"><span>3DMAKER</span><span>v{APP_VERSION} · EXPERIMENTELL</span></div>
      </aside>
    </div>
  </main>;
}

function VectorFields({ title, labels, values, onChange }: { title: string; labels: string[]; values: number[]; onChange: (axis: number, value: number) => void }) {
  return <div className="vector-fields"><div className="section-label">{title}</div><div className="vector-row">{labels.map((label, i) => <label key={label}><span>{label}</span><input type="number" step="1" value={Number(values[i].toFixed(3))} onChange={e => onChange(i, Number(e.target.value))} /></label>)}</div></div>;
}
