import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import * as THREE from 'three';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';

assert.equal(process.platform,'win32','Run this smoke test on Windows.');
const temp=await mkdtemp(path.join(tmpdir(),'3dmaker-smoke-'));
const {version}=JSON.parse(await readFile('package.json','utf8'));
const executable=path.resolve('release/win-unpacked/3D-Maker.exe');
const launcher=path.resolve(`release/3D-Maker-Portable-${version}.exe`);
const userData=path.join(temp,'user-data');
const makeProject=name=>JSON.stringify({format:'3dmaker-project',version:1,name,objects:[]});
const first=path.join(temp,'first.3dmaker'), second=path.join(temp,'second.3dmaker'), meshFile=path.join(temp,'mesh.stl');
await writeFile(first,makeProject('Startup project'));await writeFile(second,makeProject('Second instance project'));
const mesh=new THREE.Mesh(new THREE.BoxGeometry(10,12,14));
const stl=new STLExporter().parse(mesh,{binary:true});await writeFile(meshFile,Buffer.from(stl.buffer));mesh.geometry.dispose();
const args=[`--user-data-dir=${userData}`,'--use-angle=swiftshader','--enable-unsafe-swiftshader'];
const options={env:{...process.env,PORTABLE_EXECUTABLE_FILE:launcher},windowsHide:true};
let browser, child, page;
try {
  child=spawn(executable,[...args,'--remote-debugging-port=9222','--remote-debugging-address=127.0.0.1',first],options);
  child.on('error',error=>console.error(error));
  let ready=false;
  for(let i=0;i<120;i++){
    if(child.exitCode!==null)throw new Error(`App exited before renderer startup: ${child.exitCode}`);
    try{const response=await fetch('http://127.0.0.1:9222/json/version');if(response.ok){ready=true;break;}}catch{}
    await new Promise(resolve=>setTimeout(resolve,500));
  }
  assert.ok(ready,'Electron remote-debugging endpoint did not start.');
  browser=await chromium.connectOverCDP('http://127.0.0.1:9222');
  page=browser.contexts()[0].pages()[0];
  assert.ok(page,'Electron window must exist');page.on('dialog',dialog=>{void dialog.accept().catch(()=>{});});
  page.on('pageerror',error=>console.error('RENDERER ERROR',error.message));
  page.on('console',message=>{if(message.type()==='error')console.error('RENDERER CONSOLE',message.text());});
  await page.locator('canvas').waitFor({timeout:60000});
  await page.getByLabel('Projektname').waitFor();
  await page.waitForFunction(()=>document.querySelector('[aria-label="Projektname"]')?.value==='Startup project');
  console.log('PASS startup project');
  await page.getByRole('button',{name:'Einstellungen',exact:true}).click();
  await page.getByRole('button',{name:'Dateitypen registrieren',exact:true}).click();
  await page.getByRole('status').filter({hasText:'registriert'}).waitFor();
  const registry=execFileSync('reg.exe',['query','HKCU\\Software\\Classes\\Inrouder.3DMaker.3dmaker\\shell\\open\\command','/ve'],{encoding:'utf8'});
  assert.ok(registry.includes(`"${launcher}" "%1"`),'Registry must use the persistent portable launcher');
  console.log('PASS registry');
  await page.keyboard.press('Escape');
  const sendFile=file=>new Promise((resolve,reject)=>{
    const other=spawn(executable,[...args,file],options);
    const timer=setTimeout(()=>{other.kill();reject(new Error('Second instance did not exit'));},30000);
    other.once('error',error=>{clearTimeout(timer);reject(error);});other.once('exit',code=>{clearTimeout(timer);code===0?resolve():reject(new Error(`Second instance exit ${code}`));});
  });
  await sendFile(second);
  await page.waitForFunction(()=>document.querySelector('[aria-label="Projektname"]')?.value==='Second instance project');
  console.log('PASS second-instance project');
  await sendFile(meshFile);
  await page.locator('.object-row').waitFor({timeout:60000});
  await page.getByRole('button',{name:'Mesh reparieren',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('.statusbar')?.textContent?.includes('Repariert:'),null,{timeout:60000});
  console.log('PASS import and repair');
  assert.equal(await page.getByRole('img',{name:'Weltachsen: X und Y Bodenebene, Z nach oben'}).count(),1);
  const dimensions=page.locator('.vector-fields').nth(2).locator('input');
  await dimensions.nth(2).focus();
  assert.equal(await page.locator('.axis-focus').getAttribute('data-axis'),'Z');
  await page.getByRole('button',{name:'Proportional skalieren',exact:true}).click();
  await dimensions.nth(2).fill('28');await dimensions.nth(2).press('Enter');
  assert.equal(await dimensions.nth(0).inputValue(),'20');assert.equal(await dimensions.nth(1).inputValue(),'24');assert.equal(await dimensions.nth(2).inputValue(),'28');
  await page.getByRole('button',{name:'Proportional skalieren',exact:true}).click();
  console.log('PASS Z-up compass, focused-axis highlight and proportional dimensions');
  const openMeshFile=path.join(temp,'open-mesh.stl');
  const openMesh=new THREE.Mesh(new THREE.CylinderGeometry(10,10,25,16,1,true));
  const openStl=new STLExporter().parse(openMesh,{binary:true});await writeFile(openMeshFile,Buffer.from(openStl.buffer));openMesh.geometry.dispose();
  await sendFile(openMeshFile);
  await page.waitForFunction(()=>document.querySelectorAll('.object-row').length===2);
  console.log('PASS open mesh import');
  await page.getByRole('button',{name:'Löcher markieren & schließen',exact:true}).click();
  await page.locator('.hole-list button').first().waitFor({timeout:60000});
  assert.equal(await page.locator('.hole-list button').count(),2);
  console.log('PASS hole detection');
  await page.locator('.hole-list button').first().click();
  await page.getByRole('button',{name:'Verschluss übernehmen',exact:true}).click({timeout:60000});
  await page.waitForFunction(()=>document.querySelector('.statusbar')?.textContent?.includes('Markierte Öffnung geschlossen'));
  const shape=new THREE.Shape();shape.absarc(0,0,40,0,Math.PI*2,false);const hole=new THREE.Path();hole.absarc(0,0,20,0,Math.PI*2,true);shape.holes.push(hole);
  const ringGeometry=new THREE.ExtrudeGeometry(shape,{depth:4,bevelEnabled:false,curveSegments:24});ringGeometry.translate(0,0,-2);
  const ringStl=new STLExporter().parse(new THREE.Mesh(ringGeometry),{binary:true});ringGeometry.dispose();
  const ringFile=path.join(temp,'thick-ring.stl');await writeFile(ringFile,Buffer.from(ringStl.buffer));await sendFile(ringFile);
  await page.waitForFunction(()=>document.querySelectorAll('.object-row').length===3);
  await page.getByRole('button',{name:'Armloch / Durchgang schließen',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('.solid-tool [role=status]')?.textContent?.includes('Bereit.'),null,{timeout:60000});
  await page.getByRole('button',{name:'Werkzeug einklappen',exact:true}).click();
  const rect=await page.locator('canvas').boundingBox(),camera=new THREE.PerspectiveCamera(45,rect.width/rect.height,.1,10000);camera.up.set(0,0,1);camera.position.set(150,110,100);camera.lookAt(0,0,0);camera.updateMatrixWorld();
  const screen=Array.from({length:32},(_,i)=>{const angle=i*Math.PI*2/32,p=new THREE.Vector3(Math.cos(angle)*27,Math.sin(angle)*27,2).project(camera);return [rect.x+(p.x+1)*rect.width/2,rect.y+(1-p.y)*rect.height/2];});
  await page.mouse.move(...screen[0]);await page.mouse.down();for(const p of [...screen.slice(1),screen[0]])await page.mouse.move(...p,{steps:2});await page.mouse.up();
  await page.getByRole('button',{name:'Werkzeug ausklappen',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('.solid-tool [role=status]')?.textContent?.includes('Markierung übernommen'),null,{timeout:60000});
  await page.getByRole('button',{name:'Vorschau berechnen',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('.solid-tool [role=status]')?.textContent?.includes('Gültige Vereinigung'),null,{timeout:60000});
  await page.getByRole('button',{name:'Verschluss übernehmen',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('.statusbar')?.textContent?.includes('Markierter Durchgang'));
  console.log('PASS: packaged Windows renderer, file handling, repair, boundary filling and thick passage union with offline WASM worker.');
}catch(error){
  console.error('SMOKE FAILURE',error);
  if(page){
    console.error('STATUS',await page.locator('.statusbar').textContent({timeout:3000}).catch(()=>'<unavailable>'));
    console.error('BODY',await page.locator('body').innerText({timeout:3000}).then(text=>text.slice(-7000)).catch(()=>'<unavailable>'));
  }
  throw error;
}finally{
  await browser?.close().catch(()=>{});
  if(child && child.exitCode===null){try{execFileSync('taskkill',['/pid',String(child.pid),'/T','/F'],{stdio:'ignore'});}catch{}}
  await rm(temp,{recursive:true,force:true}).catch(()=>{});
}
