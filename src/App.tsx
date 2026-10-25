import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
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
  const meshGroupRef = useRef<THREE.Group | null>(null);
  const meshMapRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const [objects, setObjects] = useState<ModelObject[]>([initialObject()]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [status, setStatus] = useState('Bereit · Maße in mm');
  const [busy, setBusy] = useState(false);
  const [projectName, setProjectName] = useState('Unbenanntes Projekt');
  const selected = objects.find(o => o.id === selectedIds[0]);

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
      if (event.button !== 0) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects([...meshMapRef.current.values()], false);
      if (!hits.length) return;
      const id = hits[0].object.userData.modelId as string;
      setSelectedIds(previous => event.shiftKey ? (previous.includes(id) ? previous.filter(x => x !== id) : [...previous, id]) : [id]);
    };
    renderer.domElement.addEventListener('pointerdown', onPointerDown);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      controls.dispose();
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
  }, [objects, selectedIds]);

  const addShape = (type: ShapeType) => {
    const names: Record<ShapeType, string> = { box: 'Quader', cylinder: 'Zylinder', sphere: 'Kugel', cone: 'Kegel', custom: 'Importiertes Mesh' };
    const dimensions: Record<ShapeType, [number, number, number]> = {
      box: [30, 12, 30], cylinder: [6, 100, 6], sphere: [20, 20, 20], cone: [20, 30, 20], custom: [20, 20, 20]
    };
    const obj: ModelObject = {
      id: makeId(), name: names[type], type, position: [0, type === 'cylinder' ? 50 : 0, 0],
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
      geometry.computeVertexNormals();
      const positions = Array.from(geometry.getAttribute('position').array as ArrayLike<number>);
      const index = geometry.getIndex();
      const indices = index ? Array.from(index.array as ArrayLike<number>) : null;
      if (positions.length < 9) throw new Error('Das Ergebnis enthält keine gültige Oberfläche.');
      const replacement: ModelObject = {
        ...targetData, type: 'custom', position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
        geometryData: { positions, indices }
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
  const importStl = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const geometry = new STLLoader().parse(reader.result as ArrayBuffer);
        geometry.computeBoundingBox();
        const box = geometry.boundingBox!;
        const positions = Array.from(geometry.getAttribute('position').array as ArrayLike<number>);
        const index = geometry.getIndex();
        const indices = index ? Array.from(index.array as ArrayLike<number>) : null;
        const obj: ModelObject = {
          id: makeId(), name: file.name.replace(/\.stl$/i, ''), type: 'custom',
          position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], color: '#43b6a8',
          dimensions: [box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z],
          geometryData: { positions, indices }
        };
        setObjects(prev => [...prev, obj]); setSelectedIds([obj.id]); setStatus('STL-Modell importiert.');
      } catch { setStatus('STL-Datei konnte nicht gelesen werden.'); }
    };
    reader.readAsArrayBuffer(file);
  };
  const exportStl = () => {
    const group = meshGroupRef.current;
    if (!group || objects.length === 0) { setStatus('Keine Geometrie zum Exportieren.'); return; }
    group.updateMatrixWorld(true);
    const text = new STLExporter().parse(group, { binary: false });
    downloadFile('3dmaker-export.stl', text, 'model/stl');
    setStatus('STL exportiert.');
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
        <label className="button secondary">STL importieren<input hidden type="file" accept=".stl" onChange={e => importStl(e.target.files?.[0])} /></label>
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
          <button className="wide-tool" onClick={focusView}><span className="tool-glyph">⌖</span><span><strong>Alles einpassen</strong><small>Modelle im Blick zentrieren</small></span></button>
          <button className="wide-tool" onClick={() => { controlsRef.current?.reset(); }}><span className="tool-glyph">⟳</span><span><strong>Ansicht zurücksetzen</strong><small>Kamera zurücksetzen</small></span></button>
        </div>
        <div className="left-footer"><span className="privacy-icon">◈</span><span><strong>Privat & lokal</strong><small>Kein Login · Keine Werbung</small></span></div>
      </aside>

      <section className="viewport-section">
        <div className="viewport-toolbar">
          <div className="view-title"><span className="live-dot" /> 3D-ARBEITSFLÄCHE <span className="view-separator">/</span> <span className="muted">PERSPEKTIVE</span></div>
          <div className="viewport-help"><span>Linke Maustaste: Auswählen</span><span>Umschalt + Klick: Mehrfachauswahl</span><span>Rad: Zoom · Ziehen: Orbit</span></div>
        </div>
        <div className="viewport" ref={hostRef}>
          <div className="viewport-badge">XYZ <span>·</span> MM</div>
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
          {!selected.geometryData && <VectorFields title="ABMESSUNGEN MM" labels={['B', 'H', 'T']} values={selected.dimensions} onChange={(i, v) => updateVector('dimensions', i, Math.max(0.1, v))} />}
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
