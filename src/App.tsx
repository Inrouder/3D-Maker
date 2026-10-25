import { useCallback, useEffect, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg';

type ShapeType = 'box' | 'cylinder' | 'sphere' | 'cone' | 'custom';
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
  const selectedIdRef = useRef<string | undefined>(undefined);
  const [transformMode, setTransformMode] = useState<'translate' | 'rotate' | 'scale'>('scale');
  const [liveTransform, setLiveTransform] = useState<{ dimensions: number[]; delta: number[]; rotation: number[] } | null>(null);
  const meshGroupRef = useRef<THREE.Group | null>(null);
  const meshMapRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const dragRef = useRef<{ id: string; pointerId: number; startPoint: THREE.Vector3; startPosition: THREE.Vector3; plane: THREE.Plane } | null>(null);
  const [objects, setObjects] = useState<ModelObject[]>([initialObject()]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
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
    transformControls.setSpace('local');
    scene.add(transformControls.getHelper());
    transformControlsRef.current = transformControls;
    transformControls.addEventListener('dragging-changed', event => {
      controls.enabled = !event.value;
      if (!event.value) {
        const object = transformControls.object;
        const id = object?.userData.modelId as string | undefined;
        if (object && id) {
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
      setSelectedIds(previous => event.shiftKey ? (previous.includes(id) ? previous.filter(x => x !== id) : [...previous, id]) : [id]);
      if (!event.shiftKey) {
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -mesh.position.y);
        const startPoint = new THREE.Vector3();
        if (raycaster.ray.intersectPlane(plane, startPoint)) {
          dragRef.current = { id, pointerId: event.pointerId, startPoint, startPosition: mesh.position.clone(), plane };
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
      const mesh = meshMapRef.current.get(drag.id);
      if (!mesh) return;
      mesh.position.set(drag.startPosition.x + point.x - drag.startPoint.x, drag.startPosition.y, drag.startPosition.z + point.z - drag.startPoint.z);
    };
    const onPointerUp = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const mesh = meshMapRef.current.get(drag.id);
      if (mesh) {
        const position: [number, number, number] = [mesh.position.x, mesh.position.y, mesh.position.z];
        setObjects(prev => prev.map(obj => obj.id === drag.id ? { ...obj, position } : obj));
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
    };
  }, []);

  useEffect(() => {
    const group = meshGroupRef.current;
    if (!group) return;
    group.clear();
    meshMapRef.current.clear();
    for (const obj of objects) {
      const geometry = geometryFor(obj);
      const material = new THREE.MeshStandardMaterial({
        color: obj.color, roughness: 0.58, metalness: 0.04,
        side: THREE.DoubleSide,
        emissive: selectedIds.includes(obj.id) ? new THREE.Color('#0b514b') : new THREE.Color('#000000'),
        emissiveIntensity: selectedIds.includes(obj.id) ? 0.65 : 0
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(...obj.position);
      mesh.rotation.set(...obj.rotation.map(v => THREE.MathUtils.degToRad(v)) as [number, number, number]);
      mesh.scale.set(...obj.scale);
      mesh.userData.modelId = obj.id;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      meshMapRef.current.set(obj.id, mesh);
    }
    const gizmo = transformControlsRef.current;
    const activeMesh = selectedIds.length === 1 ? meshMapRef.current.get(selectedIds[0]) : undefined;
    if (gizmo) {
      if (activeMesh) { gizmo.attach(activeMesh); gizmo.setMode(transformMode); }
      else gizmo.detach();
    }
  }, [objects, selectedIds, transformMode]);

  useEffect(() => { setLiveTransform(null); }, [selectedIds[0]]);

  useEffect(() => {
    for (const [id, mesh] of meshMapRef.current) {
      const material = mesh.material as THREE.MeshStandardMaterial;
      const isSelected = selectedIds.includes(id);
      material.emissive.set(isSelected ? '#0b514b' : '#000000');
      material.emissiveIntensity = isSelected ? 0.65 : 0;
    }
  }, [selectedIds]);

  const addShape = (type: ShapeType) => {
    const names: Record<ShapeType, string> = { box: 'Quader', cylinder: 'Zylinder', sphere: 'Kugel', cone: 'Kegel', custom: 'Importiertes Mesh' };
    const dimensions: Record<ShapeType, [number, number, number]> = {
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
    if (selectedIds.length !== 2) {
      setStatus('Bitte zuerst das Zielobjekt, dann mit Umschalt-Klick den Schneidkörper auswählen.');
      return;
    }
    const [targetId, cutterId] = selectedIds;
    const target = meshMapRef.current.get(targetId);
    const cutter = meshMapRef.current.get(cutterId);
    const targetData = objects.find(o => o.id === targetId);
    if (!target || !cutter || !targetData) {
      setStatus('Objekte konnten nicht für die Schnittoperation vorbereitet werden.');
      return;
    }
    setBusy(true);
    try {
      target.updateMatrixWorld(true);
      cutter.updateMatrixWorld(true);
      const targetGeometry = target.geometry.clone().applyMatrix4(target.matrixWorld);
      const cutterGeometry = cutter.geometry.clone().applyMatrix4(cutter.matrixWorld);
      const targetBrush = new Brush(targetGeometry, new THREE.MeshStandardMaterial({ color: targetData.color, side: THREE.DoubleSide }));
      const cutterBrush = new Brush(cutterGeometry, new THREE.MeshStandardMaterial({ side: THREE.DoubleSide }));
      targetBrush.updateMatrixWorld(true);
      cutterBrush.updateMatrixWorld(true);
      const evaluator = new Evaluator();
      const result = evaluator.evaluate(targetBrush, cutterBrush, SUBTRACTION);
      const geometry = result.geometry;
      geometry.computeBoundingBox();
      const bounds = geometry.boundingBox;
      if (!bounds) throw new Error('Das Ergebnis hat keine gültigen Abmessungen.');
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      bounds.getSize(size);
      bounds.getCenter(center);
      geometry.translate(-center.x, -center.y, -center.z);
      geometry.computeVertexNormals();
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      const positions = Array.from(geometry.getAttribute('position').array as ArrayLike<number>);
      const index = geometry.getIndex();
      const indices = index ? Array.from(index.array as ArrayLike<number>) : null;
      if (positions.length < 9) throw new Error('Das Ergebnis enthält keine gültige Oberfläche.');
      const replacement: ModelObject = {
        ...targetData, type: 'custom', position: [center.x, center.y, center.z], rotation: [0, 0, 0], scale: [1, 1, 1],
        dimensions: [size.x, size.y, size.z], geometryData: { positions, indices }
      };
      setObjects(prev => prev.filter(o => o.id !== cutterId).map(o => o.id === targetId ? replacement : o));
      setSelectedIds([targetId]);
      setStatus('Ausschnitt erstellt. Der Schneidkörper wurde entfernt.');
    } catch (error) {
      console.error(error);
      setStatus(`Ausschnitt fehlgeschlagen: ${error instanceof Error ? error.message : 'Geometriefehler'}`);
    } finally {
      setBusy(false);
    }
  }, [objects, selectedIds]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if (event.key.toLowerCase() === 'h') { event.preventDefault(); subtract(); }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); saveProject(); }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        setObjects(prev => prev.filter(o => !selectedIds.includes(o.id)));
        setSelectedIds([]);
      }
      if (event.key === 'Escape') setSelectedIds([]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [subtract, selectedIds]);

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

  return <main className="app-shell">
    <header className="topbar">
      <div className="brand-mark">3D</div><div className="brand-copy"><strong>3DMaker</strong><span>OFFLINE 3D MODELLIERER</span></div>
      <div className="top-divider" />
      <label className="project-label">PROJEKT <input value={projectName} onChange={e => setProjectName(e.target.value)} aria-label="Projektname" /></label>
      <div className="top-actions">
        <button onClick={saveProject} title="Projekt speichern (Strg+S)">Speichern</button>
        <label className="button secondary">Öffnen<input hidden type="file" accept=".json,.3dmaker.json" onChange={e => openProject(e.target.files?.[0])} /></label>
        <label className="button secondary">Mesh importieren<input hidden type="file" accept=".stl,.obj" onChange={e => handleDroppedFiles(e.target.files ?? [])} /></label>
        <button className="primary" onClick={exportStl}>STL exportieren</button>
      </div>
    </header>

    <div className="workspace">
      <aside className="left-panel">
        <div className="panel-heading"><span>WERKZEUGE</span><span className="tiny-dot" /></div>
        <div className="tool-section">
          <div className="section-label">GRUNDKÖRPER</div>
          <div className="shape-grid">
            <button className="shape-button" onClick={() => addShape('box')}><span className="shape-icon cube-icon">▰</span><span>Quader</span></button>
            <button className="shape-button" onClick={() => addShape('cylinder')}><span className="shape-icon">⬭</span><span>Zylinder</span></button>
            <button className="shape-button" onClick={() => addShape('sphere')}><span className="shape-icon">●</span><span>Kugel</span></button>
            <button className="shape-button" onClick={() => addShape('cone')}><span className="shape-icon">▲</span><span>Kegel</span></button>
          </div>
        </div>
        <div className="tool-section">
          <div className="section-label">GEOMETRIE</div>
          <button className="wide-tool" disabled={busy} onClick={subtract}><span className="cut-symbol">−</span><span><strong>Ausschnitt / Cut</strong><small>Ziel minus Schneidkörper</small></span><kbd>H</kbd></button>
          <p className="hint">Erst das Werkstück wählen, dann mit Umschalt-Klick den Körper für das Loch.</p>
        </div>
        <div className="tool-section">
          <div className="section-label">ANSICHT</div>
          <button className="wide-tool" onClick={placeOnGround} disabled={!selected}><span className="tool-glyph">↓</span><span><strong>Auf Boden setzen</strong><small>Unterkante auf Y = 0 ausrichten</small></span></button>
          <button className="wide-tool" onClick={focusView}><span className="tool-glyph">⌖</span><span><strong>Alles einpassen</strong><small>Modelle im Blick zentrieren</small></span></button>
          <button className="wide-tool" onClick={() => { controlsRef.current?.reset(); }}><span className="tool-glyph">⟳</span><span><strong>Ansicht zurücksetzen</strong><small>Kamera zurücksetzen</small></span></button>
        </div>
        <div className="left-footer"><span className="privacy-icon">◈</span><span><strong>Privat & lokal</strong><small>Kein Login · Keine Werbung</small></span></div>
      </aside>

      <section className="viewport-section">
        <div className="viewport-toolbar">
          <div className="view-title"><span className="live-dot" /> 3D-ARBEITSFLÄCHE <span className="view-separator">/</span> <span className="muted">PERSPEKTIVE</span></div>
          <div className="transform-tools"><button className={transformMode === 'translate' ? 'active' : ''} onClick={() => setTransformMode('translate')} title="Verschieben">↔ Bewegen</button><button className={transformMode === 'rotate' ? 'active' : ''} onClick={() => setTransformMode('rotate')} title="Drehen">⟳ Drehen</button><button className={transformMode === 'scale' ? 'active' : ''} onClick={() => setTransformMode('scale')} title="Skalieren">⤢ Skalieren</button></div><div className="viewport-help"><span>Griffe ziehen · Umschalt + Klick: Mehrfachauswahl</span><span>Rad: Zoom · Ziehen: Orbit</span></div>
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
        <div className="panel-heading"><span>OBJEKT-EXPLORER</span><span className="object-count">{objects.length}</span></div>
        <div className="object-list">
          {objects.map((obj, index) => <button key={obj.id} className={`object-row ${selectedIds.includes(obj.id) ? 'selected' : ''}`} onClick={e => setSelectedIds(prev => e.shiftKey ? (prev.includes(obj.id) ? prev.filter(id => id !== obj.id) : [...prev, obj.id]) : [obj.id])}>
            <span className="object-index">{String(index + 1).padStart(2, '0')}</span><span className="object-color" style={{ background: obj.color }} /><span className="object-name">{obj.name}</span>{selectedIds.includes(obj.id) && <span className="selected-mark">●</span>}
          </button>)}
          {objects.length === 0 && <div className="empty-list">Noch keine Objekte vorhanden.</div>}
        </div>
        <div className="properties-heading"><span>EIGENSCHAFTEN</span>{selected && <span className="property-type">{selected.type.toUpperCase()}</span>}</div>
        {selected ? <div className="properties">
          <label className="field-label">Objektname<input value={selected.name} onChange={e => updateSelected({ name: e.target.value })} /></label>
          <label className="field-label">Farbe<div className="color-field"><input type="color" value={selected.color} onChange={e => updateSelected({ color: e.target.value })} /><span>{selected.color.toUpperCase()}</span></div></label>
          <VectorFields title="POSITION" labels={['X', 'Y', 'Z']} values={selected.position} onChange={(i, v) => updateVector('position', i, v)} />
          <VectorFields title="DREHUNG °" labels={['X', 'Y', 'Z']} values={selected.rotation} onChange={(i, v) => updateVector('rotation', i, v)} />
          <VectorFields title="ABMESSUNGEN MM · GRUNDMAẞ" labels={['B', 'H', 'T']} values={selected.dimensions} onChange={(i, v) => updateVector('dimensions', i, Math.max(0.1, v))} />
          <VectorFields title="SKALIERUNG ×" labels={['X', 'Y', 'Z']} values={selected.scale} onChange={(i, v) => updateVector('scale', i, Math.max(0.01, v))} />
          <div className="actual-dimensions"><span>AKTUELLE GESAMTMAẞE</span><strong>{selected.dimensions.map((v, i) => `${(v * selected.scale[i]).toFixed(2)} mm`).join(' × ')}</strong></div>
          <div className="property-actions"><button className="secondary full-button" onClick={() => setObjects(prev => [...prev, { ...selected, id: makeId(), name: `${selected.name} Kopie`, position: [selected.position[0] + 10, selected.position[1], selected.position[2] + 10], geometryData: selected.geometryData ? { positions: [...selected.geometryData.positions], indices: selected.geometryData.indices ? [...selected.geometryData.indices] : null } : undefined }])}>Duplizieren</button><button className="danger" onClick={() => { setObjects(prev => prev.filter(o => o.id !== selected.id)); setSelectedIds(prev => prev.filter(id => id !== selected.id)); }}>Löschen</button></div>
        </div> : <div className="no-selection"><span>◇</span><strong>Kein Objekt ausgewählt</strong><p>Wähle ein Objekt in der Szene oder im Explorer, um seine Eigenschaften zu bearbeiten.</p></div>}
        {selectedIds.length === 2 && <div className="cut-info"><strong>Boolean bereit</strong><p>1. {objects.find(o => o.id === selectedIds[0])?.name} minus 2. {objects.find(o => o.id === selectedIds[1])?.name}</p><button className="primary full-button" disabled={busy} onClick={subtract}>Ausschnitt berechnen · H</button></div>}
        <div className="right-footer"><span>3DMAKER</span><span>v0.1.0 · EXPERIMENTELL</span></div>
      </aside>
    </div>
  </main>;
}

function VectorFields({ title, labels, values, onChange }: { title: string; labels: string[]; values: number[]; onChange: (axis: number, value: number) => void }) {
  return <div className="vector-fields"><div className="section-label">{title}</div><div className="vector-row">{labels.map((label, i) => <label key={label}><span>{label}</span><input type="number" step="1" value={Number(values[i].toFixed(3))} onChange={e => onChange(i, Number(e.target.value))} /></label>)}</div></div>;
}
