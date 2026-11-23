import {test,expect} from '@playwright/test';
import * as THREE from 'three';
import Module from 'manifold-3d';
import {prepareVolume,toSolid} from '../../src/solid-patch';

test.use({viewport:{width:1440,height:900}});
const libPromise=Module().then(lib=>{lib.setup();return lib;});
function ringProject(collapsed=false){
  const shape=new THREE.Shape();shape.absarc(0,0,12,0,Math.PI*2,false);const hole=new THREE.Path();hole.absarc(0,0,6,0,Math.PI*2,true);shape.holes.push(hole);
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:2,bevelEnabled:false,curveSegments:24});geometry.translate(0,0,-1);
  const data={positions:Array.from(geometry.getAttribute('position').array),indices:geometry.index?Array.from(geometry.index.array):null};geometry.dispose();
  if(collapsed){const start=data.positions.length/3;data.positions.push(0,0,0,0.0000001,0,0,1,0,0);if(data.indices)data.indices.push(start,start+1,start+2);}
  return {format:'3dmaker-project',version:1,name:'Durchgang',objects:[{id:'ring',name:'Dicker Ring',type:'custom',position:[0,0,0],rotation:[0,0,0],scale:[3,3,3],dimensions:[24,24,2],color:'#43b6a8',geometryData:data}]};
}
async function save(page:any){
  const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Speichern',exact:true}).click();const stream=await(await pending).createReadStream(),chunks:Buffer[]=[];for await(const chunk of stream)chunks.push(chunk);return JSON.parse(Buffer.concat(chunks).toString());
}
async function draw(page:any){
  await page.getByRole('button',{name:'Werkzeug einklappen',exact:true}).click();
  const rect=await page.locator('canvas').boundingBox(),camera=new THREE.PerspectiveCamera(45,rect.width/rect.height,.1,10000);camera.up.set(0,0,1);camera.position.set(150,110,100);camera.lookAt(0,0,0);camera.updateMatrixWorld();
  const points=Array.from({length:32},(_,i)=>{const a=i*Math.PI*2/32,p=new THREE.Vector3(3,Math.cos(a)*8*3,Math.sin(a)*8*3).project(camera);return [rect.x+(p.x+1)*rect.width/2,rect.y+(1-p.y)*rect.height/2];});
  await page.mouse.move(points[0][0],points[0][1]);await page.mouse.down();for(const p of [...points.slice(1),points[0]])await page.mouse.move(p[0],p[1],{steps:3});await page.mouse.up();
  await page.getByRole('button',{name:'Werkzeug ausklappen',exact:true}).click();await expect(page.getByRole('status')).toContainText('Markierung übernommen');
}
test('mark a thick-walled through-hole, union the preview and undo/redo persisted solid geometry',async({page})=>{
  test.setTimeout(90000);
  await page.goto('/');await page.locator('input[type=file]').first().setInputFiles({name:'ring.3dmaker',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(ringProject(true)))});await expect(page.getByLabel('Projektname')).toHaveValue('Durchgang');await page.locator('.object-row').click();
  await page.getByRole('button',{name:'Armloch / Durchgang schließen',exact:true}).click();await expect(page.getByRole('status')).toContainText('Bereit.',{timeout:60000});
  await expect(page.getByRole('status')).toContainText('1 Flächen');
  await draw(page);await page.getByRole('button',{name:'Vorschau berechnen',exact:true}).click();await expect(page.getByRole('status')).toContainText('Gültige Vereinigung',{timeout:60000});
  await page.screenshot({path:'test-results/solid-patch-preview.png'});
  await page.getByRole('button',{name:'Verschluss übernehmen',exact:true}).click();await expect(page.locator('.solid-tool')).toHaveCount(0);
  const lib=await libPromise;let data=await save(page);let solid=toSolid(lib,data.objects[0].geometryData);expect(solid.status()).toBe('NoError');expect(solid.genus()).toBe(0);solid.delete();
  await page.keyboard.press('Control+z');data=await save(page);solid=toSolid(lib,prepareVolume(data.objects[0].geometryData).geometryData);expect(solid.genus()).toBe(1);solid.delete();
  await page.keyboard.press('Control+y');data=await save(page);solid=toSolid(lib,data.objects[0].geometryData);expect(solid.genus()).toBe(0);solid.delete();
});
test('the boundary tool offers the through-hole mode and cancel leaves the model untouched',async({page})=>{
  await page.goto('/');await page.locator('.object-row').click();await page.getByRole('button',{name:'Löcher markieren & schließen',exact:true}).click();
  await page.getByRole('button',{name:'Armloch / Durchgang verschließen',exact:true}).click();await expect(page.locator('.hole-list')).toHaveCount(0);await expect(page.getByRole('status')).toContainText('Bereit.',{timeout:60000});
  await expect(page.getByRole('button',{name:'Verschluss übernehmen',exact:true})).toBeDisabled();await page.keyboard.press('Escape');await expect(page.locator('.solid-tool')).toHaveCount(0);
  const saved=await save(page);expect(saved.objects[0].type).toBe('box');
});
test('failed preparation remains visible and marking cannot hide it; retry can recover',async({page})=>{
  // Inject a worker failure once, then let the retry run the real offline worker.
  await page.addInitScript(()=>{
    const NativeWorker=window.Worker;let failed=false;
    window.Worker=class extends NativeWorker{
      postMessage(message:any,options?:any){
        if(message.action==='init'&&!failed){failed=true;setTimeout(()=>this.dispatchEvent(new MessageEvent('message',{data:{kind:'error',action:'init',message:'Test: Modellvorbereitung gescheitert.'}})),0);return;}
        super.postMessage(message,options);
      }
    } as typeof Worker;
  });
  await page.goto('/');await page.locator('input[type=file]').first().setInputFiles({name:'ring.3dmaker',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(ringProject()))});await expect(page.getByLabel('Projektname')).toHaveValue('Durchgang');await page.locator('.object-row').click();
  await page.getByRole('button',{name:'Armloch / Durchgang schließen',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('Modellvorbereitung gescheitert');
  const rect=(await page.locator('canvas').boundingBox())!;
  await page.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2);await page.mouse.down();for(let i=0;i<32;i++)await page.mouse.move(rect.x+rect.width/2+50*Math.cos(i/32*Math.PI*2),rect.y+rect.height/2+50*Math.sin(i/32*Math.PI*2));await page.mouse.up();
  await expect(page.getByRole('status')).toContainText('Modellvorbereitung gescheitert');await expect(page.getByRole('button',{name:'Vorschau berechnen',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Modell erneut vorbereiten',exact:true}).click();await expect(page.getByRole('status')).toContainText('Bereit.',{timeout:60000});await expect(page.getByRole('alert')).toHaveCount(0);
  await draw(page);await expect(page.getByRole('button',{name:'Vorschau berechnen',exact:true})).toBeEnabled();
});
