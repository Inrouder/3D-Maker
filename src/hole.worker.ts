import { findHoles, fillHole } from './hole-fill';
self.onmessage=event=>{
  try{
    if(event.data.action==='analyze'){
      const {holes,ambiguous,nonManifoldEdges}=findHoles(event.data.data);self.postMessage({result:{holes,ambiguous,nonManifoldEdges}});
    }else self.postMessage({result:fillHole(event.data.data,event.data.holeId,event.data.bulge)});
  }catch(error){self.postMessage({error:error instanceof Error?error.message:'Löcherbearbeitung fehlgeschlagen.'});}
};
