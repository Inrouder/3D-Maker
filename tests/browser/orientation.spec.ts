import {test,expect} from '@playwright/test';
import * as THREE from 'three';
import {STLLoader} from 'three/examples/jsm/loaders/STLLoader.js';
test.use({viewport:{width:1440,height:900}});
async function saved(page:any){const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Speichern',exact:true}).click();const stream=await(await pending).createReadStream(),chunks:Buffer[]=[];for await(const chunk of stream)chunks.push(chunk);return JSON.parse(Buffer.concat(chunks).toString());}
async function edit(page:any,group:number,axis:number,value:string){const input=page.locator('.vector-fields').nth(group).locator('input').nth(axis);await input.fill(value);await input.press('Enter');}

test('Z points up, focused dimensions highlight the correct side and ground/export use Z',async({page})=>{
  await page.goto('/');
  const compass=page.getByRole('img',{name:'Weltachsen: X und Y Bodenebene, Z nach oben'});await expect(compass).toBeVisible();await page.locator('.object-row').click();
  const z=await compass.locator('.axis-z text').getAttribute('y'),x=await compass.locator('.axis-x text').getAttribute('x'),y=await compass.locator('.axis-y text').getAttribute('x');
  expect(Number(z)).toBeLessThan(30);expect(Number(x)).toBeLessThan(48);expect(Number(y)).toBeGreaterThan(48);
  for(const axis of [0,1,2]){
    await page.locator('.vector-fields').nth(2).locator('input').nth(axis).focus();
    await expect(page.locator('.axis-focus')).toHaveAttribute('data-axis',['X','Y','Z'][axis]);
    await expect(page.locator('.axis-field-active')).toHaveCount(1);
  }
  await page.screenshot({path:'test-results/z-axis-highlight.png'});
  await edit(page,2,2,'30');await expect(page.locator('.axis-focus')).toHaveCount(0);
  await page.getByRole('button',{name:/Auf Boden setzen/}).click();await expect(page.locator('.vector-fields').first().locator('input').nth(2)).toHaveValue('15');
  const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Auswahl als STL',exact:true}).click();
  const stream=await(await pending).createReadStream(),chunks:Buffer[]=[];for await(const chunk of stream!)chunks.push(chunk);const buffer=Buffer.concat(chunks),g=new STLLoader().parse(buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength));g.computeBoundingBox();
  expect(g.boundingBox!.min.z).toBeCloseTo(0);expect(g.boundingBox!.max.z).toBeCloseTo(30);expect(g.boundingBox!.max.x-g.boundingBox!.min.x).toBeCloseTo(40);g.dispose();
  const project=await saved(page);expect(project.version).toBe(2);expect(project.objects[0].position).toEqual([0,0,15]);
  await page.locator('input[type=file]').first().setInputFiles({name:'new.3dmaker',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))});await page.locator('.object-row').click();
  expect((await saved(page)).objects).toEqual(project.objects);
});

test('lock scales dimensions and unequal scale factors proportionally, independent mode and undo still work',async({page})=>{
  await page.goto('/');await page.locator('.object-row').click();await edit(page,1,0,'35');await edit(page,3,0,'2');
  const lock=page.getByRole('button',{name:'Proportional skalieren',exact:true});await expect(lock).toHaveAttribute('aria-pressed','false');await lock.click();
  await edit(page,2,2,'24');let obj=(await saved(page)).objects[0];expect(obj.dimensions).toEqual([80,80,24]);expect(obj.scale).toEqual([2,1,1]);expect(obj.rotation).toEqual([35,0,0]);
  await edit(page,3,1,'3');obj=(await saved(page)).objects[0];expect(obj.scale).toEqual([6,3,3]);
  await page.keyboard.press('Control+z');await page.locator('.object-row').click();obj=(await saved(page)).objects[0];expect(obj.scale).toEqual([2,1,1]);
  await lock.click();await edit(page,2,0,'100');obj=(await saved(page)).objects[0];expect(obj.dimensions).toEqual([100,80,24]);
});

test('the proportional lock also applies to an individual scale handle',async({page})=>{
  await page.goto('/');await page.locator('.object-row').click();await page.getByRole('button',{name:'Proportional skalieren',exact:true}).click();
  const rect=(await page.locator('canvas').boundingBox())!,camera=new THREE.PerspectiveCamera(45,rect.width/rect.height,.1,10000);camera.up.set(0,0,1);camera.position.set(150,110,100);camera.lookAt(0,0,0);camera.updateMatrixWorld();
  const factor=camera.position.length()*1.9*Math.tan(Math.PI*45/360)/8;
  const project=(v:THREE.Vector3)=>{v.project(camera);return [rect.x+(v.x+1)*rect.width/2,rect.y+(1-v.y)*rect.height/2];};
  const start=project(new THREE.Vector3(factor,0,0)),end=project(new THREE.Vector3(factor*1.7,0,0));
  await page.mouse.move(start[0],start[1]);await page.mouse.down();await page.mouse.move(end[0],end[1],{steps:20});await page.mouse.up();
  const obj=(await saved(page)).objects[0];expect(obj.scale[0]).toBeGreaterThan(1.2);expect(obj.scale[0]).toBeCloseTo(obj.scale[1],5);expect(obj.scale[0]).toBeCloseTo(obj.scale[2],5);
});

test('plane cuts use the selected world X, Y and Z coordinate',async({page})=>{
  const {geometryFor}=await import('../../src/model');
  for(const [axis,label]of ['x','y','z'].entries()){
    await page.goto('/');await page.locator('.object-row').click();
    await edit(page,1,0,'20');await edit(page,1,1,'15');
    await page.locator('.cut-plane-fields select').selectOption(label);
    await page.getByRole('button',{name:/Objekt teilen/}).click();await expect(page.locator('.object-row')).toHaveCount(2);
    const project=await saved(page),ranges=project.objects.map((obj:any)=>{
      const geometry=geometryFor(obj),mesh=new THREE.Mesh(geometry);mesh.position.fromArray(obj.position);mesh.rotation.set(...obj.rotation.map(THREE.MathUtils.degToRad) as [number,number,number]);mesh.scale.fromArray(obj.scale);mesh.updateMatrixWorld();const bounds=new THREE.Box3().setFromObject(mesh);geometry.dispose();return [bounds.min.getComponent(axis),bounds.max.getComponent(axis)];
    });
    expect(ranges.some((r:number[])=>Math.abs(r[1])<1e-4&&r[0]<-1)).toBe(true);
    expect(ranges.some((r:number[])=>Math.abs(r[0])<1e-4&&r[1]>1)).toBe(true);
  }
});

test('a locked group scales its member positions and dimensions by the same factor',async({page})=>{
  const object={id:'a',name:'A',type:'box',position:[-12,0,0],rotation:[0,0,0],scale:[1,1,1],dimensions:[10,10,10],color:'#43b6a8',groupId:'g'};
  await page.goto('/');await page.locator('input[type=file]').first().setInputFiles({name:'group.3dmaker',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'3dmaker-project',version:2,objects:[object,{...object,id:'b',name:'B',position:[12,0,0]}]}))});await page.locator('.object-row').first().click();await expect(page.locator('.object-row.selected')).toHaveCount(2);
  await page.getByRole('button',{name:'Proportional skalieren',exact:true}).click();
  const rect=(await page.locator('canvas').boundingBox())!,camera=new THREE.PerspectiveCamera(45,rect.width/rect.height,.1,10000);camera.up.set(0,0,1);camera.position.set(150,110,100);camera.lookAt(0,0,0);camera.updateMatrixWorld();
  const factor=camera.position.length()*1.9*Math.tan(Math.PI*45/360)/8;
  const point=(x:number)=>{const p=new THREE.Vector3(x,0,0).project(camera);return [rect.x+(p.x+1)*rect.width/2,rect.y+(1-p.y)*rect.height/2];};const start=point(factor),end=point(factor*1.7);
  await page.mouse.move(start[0],start[1]);await page.mouse.down();await page.mouse.move(end[0],end[1],{steps:20});await page.mouse.up();
  const project=await saved(page);for(const [i,obj]of project.objects.entries()){
    expect(obj.scale[0]).toBeGreaterThan(1.2);expect(obj.scale[0]).toBeCloseTo(obj.scale[1],5);expect(obj.scale[0]).toBeCloseTo(obj.scale[2],5);expect(obj.position[0]).toBeCloseTo((i===0?-12:12)*obj.scale[0],4);expect(obj.groupId).toBe('g');
  }
});
