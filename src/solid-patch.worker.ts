import Module from 'manifold-3d';
import type {Manifold,ManifoldToplevel} from 'manifold-3d';
import wasmUrl from 'manifold-3d/manifold.wasm?url&inline';
import {prepareVolume,makePatch,toSolid,unitePatch} from './solid-patch';
import type {MeshData} from './solid-patch';
let lib:ManifoldToplevel,base:Manifold|undefined,result:MeshData|undefined;
let repair:{removedFaces:number;repairCaps:number;stitchedEdges:number}|undefined;
self.onmessage=async event=>{
  const {action,id}=event.data;
  try{
    if(action==='init'){
      self.postMessage({kind:'progress',message:'Volumen-Geometrie wird vorbereitet …'});
      lib=await Module({locateFile:()=>wasmUrl});lib.setup();
      const prepared=prepareVolume(event.data.data,event.data.allowRepair);repair={removedFaces:prepared.removedFaces,repairCaps:prepared.repairCaps,stitchedEdges:prepared.stitchedEdges};
      base?.delete();base=toSolid(lib,prepared.geometryData);
      if(base.status()!=='NoError' || base.isEmpty())throw new Error('Das Modell lässt sich nicht als geschlossenes Volumen verarbeiten.');
      self.postMessage({kind:'ready',...repair,genus:base.genus(),volume:base.volume()});
    }else if(action==='preview'){
      if(!base)throw new Error('Modell ist noch nicht vorbereitet.');result=undefined;
      const patch=makePatch(event.data.points,event.data.viewpoint,event.data.depth,event.data.bulge,.15,event.data.margin);
      self.postMessage({kind:'progress',message:'Verschluss wird mit dem Modell vereinigt …'});
      const united=unitePatch(lib,base,patch.geometryData);result=united.geometryData;
      const ids=patch.geometryData.indices!,positions=patch.geometryData.positions,patchPositions=ids.flatMap(index=>positions.slice(index*3,index*3+3));
      self.postMessage({kind:'preview',id,patchPositions,volumeAdded:united.volumeAdded,genusBefore:united.genusBefore,genusAfter:united.genusAfter,...repair});
    }else if(action==='apply'){
      if(!result)throw new Error('Bitte zuerst eine gültige Vorschau berechnen.');
      const dimensions=[0,1,2].map(axis=>{
        let min=Infinity,max=-Infinity;for(let i=axis;i<result!.positions.length;i+=3){min=Math.min(min,result!.positions[i]);max=Math.max(max,result!.positions[i]);}return max-min;
      });
      self.postMessage({kind:'apply',id,geometryData:result,dimensions});
    }
  }catch(error){self.postMessage({kind:'error',action,id,message:error instanceof Error?error.message:'Verschließen fehlgeschlagen.'});}
};
