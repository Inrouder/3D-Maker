import * as THREE from 'three';

export type ShapeType = 'box' | 'cylinder' | 'sphere' | 'cone' | 'custom' | 'text' | 'gear' | 'thread';
type CreatorMode = 'text' | 'gear' | 'thread';
export type ModelObject = {
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

export function geometryFor(obj: ModelObject): THREE.BufferGeometry {
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
  // Primitive dimensions describe local X/Y/Z, independent of rotation.
  if (obj.type === 'sphere') g.scale(1, y / x, z / x);
  else if (obj.type === 'cylinder' || obj.type === 'cone') g.scale(1, 1, z / x);
  g.computeVertexNormals();
  return g;
}


export function validateProject(data: unknown): { name?: string; objects: ModelObject[] } {
  const fail = (): never => { throw new Error('Ungültige Projektdatei: Objektwerte oder Geometrie fehlerhaft.'); };
  if (!data || typeof data !== 'object') return fail();
  const project = data as Record<string, unknown>;
  if (project.format !== '3dmaker-project' || project.version !== 1 || !Array.isArray(project.objects)) return fail();
  const ids = new Set<string>();
  for (const value of project.objects) {
    if (!value || typeof value !== 'object') return fail();
    const obj = value as ModelObject;
    if (typeof obj.id !== 'string' || !obj.id || ids.has(obj.id) || typeof obj.name !== 'string') return fail();
    ids.add(obj.id);
    if (!['box','sphere','cylinder','cone','custom','text','gear','thread'].includes(obj.type)) return fail();
    if (typeof obj.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(obj.color)) return fail();
    if (obj.groupId !== undefined && (typeof obj.groupId !== 'string' || !obj.groupId)) return fail();
    for (const key of ['position','rotation','dimensions','scale'] as const) {
      const vector = obj[key];
      if (!Array.isArray(vector) || vector.length !== 3 || !vector.every(v => typeof v === 'number' && Number.isFinite(v))) return fail();
      if ((key === 'dimensions' || key === 'scale') && vector.some(v => v <= 0)) return fail();
    }
    if (obj.geometryData) {
      const { positions, indices } = obj.geometryData;
      if (!Array.isArray(positions) || positions.length < 9 || positions.length % 3 || !positions.every(v => typeof v === 'number' && Number.isFinite(v))) return fail();
      if (indices !== null && (!Array.isArray(indices) || indices.length < 3 || indices.length % 3 || !indices.every(v => Number.isInteger(v) && v >= 0 && v < positions.length / 3))) return fail();
      if (indices === null && positions.length % 9) return fail();
    } else if (['custom','text','gear','thread'].includes(obj.type)) return fail();
  }
  return { name: typeof project.name === 'string' ? project.name : undefined, objects: project.objects };
}
