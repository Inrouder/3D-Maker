import { repairGeometry } from './mesh-tools';
self.onmessage = event => {
  try { self.postMessage({result:repairGeometry(event.data)}); }
  catch(error) {self.postMessage({error:error instanceof Error?error.message:'Reparatur fehlgeschlagen.'});}
};
