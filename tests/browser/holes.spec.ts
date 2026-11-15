import {test,expect} from '@playwright/test';
import * as THREE from 'three';
import {findHoles} from '../../src/hole-fill';

test.use({viewport:{width:1440,height:900}});
const fixture=()=>{
  const geometry=new THREE.CylinderGeometry(15,15,50,24,1,true);
  const data={positions:Array.from(geometry.getAttribute('position').array),indices:Array.from(geometry.index!.array)};geometry.dispose();
  return {format:'3dmaker-project',version:1,name:'Offene Weste Test',objects:[{id:'open',name:'Offener Körper',type:'custom',position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],dimensions:[30,50,30],color:'#43b6a8',geometryData:data}]};
};
async function load(page:any){
  const data=fixture();await page.goto('/');
  await page.locator('input[type=file]').first().setInputFiles({name:'holes.3dmaker',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});
  await page.locator('.object-row').first().click();await page.getByRole('button',{name:'Löcher markieren & schließen',exact:true}).click();
  await expect(page.locator('.hole-list button')).toHaveCount(2);
  return data;
}
async function save(page:any){
  const downloading=page.waitForEvent('download');await page.getByRole('button',{name:'Speichern',exact:true}).click();
  const download=await downloading,stream=await download.createReadStream(),chunks:Buffer[]=[];
  for await(const chunk of stream)chunks.push(chunk);return JSON.parse(Buffer.concat(chunks).toString());
}
test('preview, bulge, apply only one hole, undo/redo and project persistence',async({page})=>{
  await load(page);await page.locator('.hole-list button').first().click();
  const apply=page.getByRole('button',{name:'Verschluss übernehmen',exact:true});await expect(apply).toBeEnabled();
  await page.getByLabel('Wölbung (mm)').fill('2');await expect(page.getByRole('status')).toContainText('Vorschau:');await expect(apply).toBeEnabled();
  await page.screenshot({path:'test-results/hole-preview.png'});
  await apply.click();await expect(page.locator('.hole-tool')).toHaveCount(0);
  let saved=await save(page);expect(findHoles(saved.objects[0].geometryData).holes).toHaveLength(1);
  await page.keyboard.press('Control+z');saved=await save(page);expect(findHoles(saved.objects[0].geometryData).holes).toHaveLength(2);
  await page.keyboard.press('Control+y');saved=await save(page);expect(findHoles(saved.objects[0].geometryData).holes).toHaveLength(1);
});

test('lasso chooses only the enclosed opening and does not move the object',async({page})=>{
  const data=await load(page);await page.getByRole('button',{name:'Umkreisen',exact:true}).click();
  const rect=(await page.locator('canvas').boundingBox())!;
  const camera=new THREE.PerspectiveCamera(45,rect.width/rect.height,.1,10000);camera.position.set(110,100,150);camera.lookAt(0,0,0);camera.updateMatrixWorld();
  const hole=findHoles(data.objects[0].geometryData).holes[0],points:THREE.Vector3[]=[];
  for(let i=0;i<hole.points.length;i+=3)points.push(new THREE.Vector3(hole.points[i],hole.points[i+1],hole.points[i+2]).project(camera));
  const x=points.map(p=>rect.x+(p.x+1)*rect.width/2),y=points.map(p=>rect.y+(1-p.y)*rect.height/2);
  const left=Math.min(...x)-12,right=Math.max(...x)+12,top=Math.min(...y)-12,bottom=Math.max(...y)+12;
  await page.mouse.move(left,top);await page.mouse.down();
  for(const [px,py] of [[right,top],[right,bottom],[left,bottom],[left,top]])await page.mouse.move(px,py,{steps:10});
  await page.mouse.up();await expect(page.getByRole('status')).toContainText('Vorschau: Öffnung 1');
  await expect(page.getByRole('button',{name:'Verschluss übernehmen',exact:true})).toBeEnabled();
  await page.getByRole('button',{name:'Abbrechen',exact:true}).click();
  const saved=await save(page);expect(saved.objects[0].position).toEqual([0,0,0]);expect(findHoles(saved.objects[0].geometryData).holes).toHaveLength(2);
});

test('closed model reports absence of open boundaries and disables apply',async({page})=>{
  await page.goto('/');await page.locator('.object-row').first().click();await page.getByRole('button',{name:'Löcher markieren & schließen',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('Keine eindeutigen offenen Ränder');await expect(page.getByRole('button',{name:'Verschluss übernehmen',exact:true})).toBeDisabled();
  await page.keyboard.press('Escape');await expect(page.locator('.hole-tool')).toHaveCount(0);
});

test('hole tool collapses on small windows and survives source edits without stale preview',async({page})=>{
  await page.setViewportSize({width:960,height:640});await load(page);
  await page.getByRole('button',{name:'Werkzeug einklappen',exact:true}).click();
  await expect(page.getByRole('button',{name:'Werkzeug ausklappen',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Werkzeug ausklappen',exact:true}).click();
  await page.locator('.hole-list button').first().click();
  const apply=page.getByRole('button',{name:'Verschluss übernehmen',exact:true});await expect(apply).toBeEnabled();
  await page.getByLabel('Wölbung (mm)').fill('-2');await expect(apply).toBeEnabled();
  const field=page.locator('.vector-fields').nth(1).locator('input').first();await field.fill('90');await field.press('Enter');
  await expect(page.locator('.hole-list button')).toHaveCount(2);await expect(apply).toBeDisabled();
  await page.locator('.hole-list button').first().click();await expect(apply).toBeEnabled();
  await page.getByRole('button',{name:'Abbrechen',exact:true}).click();
});
