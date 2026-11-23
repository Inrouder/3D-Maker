import { test, expect } from '@playwright/test';

test('rotated objects keep editable independent dimensions; tools remain reachable', async ({page}) => {
  const errors: string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('canvas')).toBeVisible();
  await page.locator('.object-row').first().click();
  const fields=page.locator('.vector-fields');
  await fields.nth(1).locator('input').nth(1).fill('45');
  await fields.nth(1).locator('input').nth(1).press('Enter');
  await fields.nth(2).locator('input').nth(0).fill('62.5');
  await fields.nth(2).locator('input').nth(0).press('Enter');
  await expect(fields.nth(2).locator('input').nth(0)).toHaveValue('62.5');
  await expect(fields.nth(1).locator('input').nth(1)).toHaveValue('45');
  await page.getByRole('button',{name:/Schnittmodus aktivieren/}).click();
  await page.getByRole('button',{name:/Schnittmodus beenden/}).click();
  await fields.nth(2).locator('input').nth(2).fill('23');
  await fields.nth(2).locator('input').nth(2).press('Enter');
  await expect(page.locator('.actual-dimensions')).toContainText('62.50 mm × 40.00 mm × 23.00 mm');
  await page.getByRole('button',{name:/Ansicht zurücksetzen/}).scrollIntoViewIfNeeded();
  await expect(page.getByRole('button',{name:/Ansicht zurücksetzen/})).toBeInViewport();
  const overflow=await page.locator('.tools-scroll').evaluate(el=>el.scrollHeight>el.clientHeight);
  expect(overflow).toBe(true);
  await page.screenshot({path:'test-results/editor-960.png'});
  expect(errors).toEqual([]);
});

test('malformed project is rejected and scene stays usable', async ({page})=>{
  await page.goto('/');
  await page.locator('input[type=file]').first().setInputFiles({name:'broken.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'3dmaker-project',version:1,objects:[{}]}))});
  await expect(page.locator('.statusbar')).toContainText('Ungültige Projektdatei');
  await expect(page.locator('.object-row')).toHaveCount(1);
});

test('settings blocks destructive shortcuts; save uses current project name', async ({page})=>{
  await page.goto('/');
  await page.locator('.object-row').first().click();
  await page.getByRole('button',{name:/Einstellungen/}).click();
  await page.keyboard.press('Delete');
  await expect(page.locator('.object-row')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByLabel('Projektname').fill('Neuer Name');
  await page.getByLabel('Projektname').press('Tab');
  const download=page.waitForEvent('download');
  await page.keyboard.press('Control+s');
  expect((await download).suggestedFilename()).toBe('Neuer Name.3dmaker');
});

test('legacy group member uses world Z when placed on ground', async ({page})=>{
  await page.goto('/');
  const object={id:'a',name:'A',type:'box',position:[0,50,0],rotation:[0,0,0],scale:[1,1,1],dimensions:[10,10,10],color:'#43b6a8',groupId:'g'};
  const data={format:'3dmaker-project',version:1,objects:[object,{...object,id:'b',name:'B',position:[20,70,0]}]};
  await page.locator('input[type=file]').first().setInputFiles({name:'group.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});
  await page.locator('.object-row').first().click({modifiers:['Shift']});
  await page.getByRole('button',{name:/Auf Boden setzen/}).click();
  await expect(page.locator('.vector-fields').nth(0).locator('input').nth(2)).toHaveValue('5');
});

test('invalid saved language falls back without crashing',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('3dmaker-language','invalid'));
  await page.goto('/');
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.getByRole('button',{name:'Einstellungen',exact:true})).toBeVisible();
});

test('numeric drafts accept decimals and restore empty values; dimensions clamp consistently',async({page})=>{
  await page.goto('/');
  await page.locator('.object-row').first().click();
  const width=page.locator('.vector-fields').nth(2).locator('input').first();
  await width.fill(''); await width.press('Enter');
  await expect(width).toHaveValue('40');
  await width.fill('-1'); await width.press('Enter');
  await expect(width).toHaveValue('0.1');
  await width.fill('-1'); await width.press('Enter');
  await expect(width).toHaveValue('0.1');
  await width.fill('12.75'); await width.press('Enter');
  await expect(width).toHaveValue('12.75');
});

test('rotate imported mesh, change Z, export only selected object and repair it',async({page})=>{
  const THREE=await import('three');
  const {STLExporter}=await import('three/examples/jsm/exporters/STLExporter.js');
  const {STLLoader}=await import('three/examples/jsm/loaders/STLLoader.js');
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(10,12,14));
  const stl=new STLExporter().parse(mesh,{binary:true});
  await page.goto('/');
  await page.locator('input[type=file]').nth(1).setInputFiles({name:'Teil.stl',mimeType:'model/stl',buffer:Buffer.from(stl.buffer)});
  await expect(page.locator('.object-row')).toHaveCount(2);
  const fields=page.locator('.vector-fields');
  await fields.nth(1).locator('input').first().fill('90');await fields.nth(1).locator('input').first().press('Enter');
  await expect(fields.nth(2).locator('label').nth(2)).toContainText('Z');
  await fields.nth(2).locator('input').nth(2).fill('27');await fields.nth(2).locator('input').nth(2).press('Enter');
  await expect(fields.nth(2).locator('input').nth(2)).toHaveValue('27');
  const downloading=page.waitForEvent('download');
  await page.getByRole('button',{name:'Auswahl als STL',exact:true}).click();
  const download=await downloading;
  const stream=await download.createReadStream();const chunks:Buffer[]=[];for await(const chunk of stream!)chunks.push(chunk);
  const buffer=Buffer.concat(chunks);
  const geometry=new STLLoader().parse(buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength));geometry.computeBoundingBox();
  const size=geometry.boundingBox!.getSize(new THREE.Vector3());expect(size.y).toBeCloseTo(27,3);expect(size.x).toBeCloseTo(10,3);
  expect(geometry.getAttribute('position').count).toBe(36);
  await page.getByRole('button',{name:'Mesh reparieren',exact:true}).click();
  await expect(page.locator('.statusbar')).toContainText('Repariert:');
  await expect(fields.nth(2).locator('input').nth(2)).toHaveValue('27');
  mesh.geometry.dispose();geometry.dispose();
});

test('split halves can be exported independently',async({page})=>{
  await page.goto('/');await page.locator('.object-row').first().click();
  await page.getByRole('button',{name:/Objekt teilen/}).click();
  await expect(page.locator('.object-row')).toHaveCount(2);
  for(let i=0;i<2;i++) {
    await page.locator('.object-row').nth(i).click();
    const download=page.waitForEvent('download');await page.getByRole('button',{name:'Auswahl als STL',exact:true}).click();
    expect((await download).suggestedFilename()).toContain(i===0?'Teil A':'Teil B');
    await expect(page.locator('.statusbar')).toContainText('1 Objekt(e)');
  }
});

test('large binary STL imports in background and remains editable',async({page})=>{
  test.setTimeout(90000);
  const THREE=await import('three');const {STLExporter}=await import('three/examples/jsm/exporters/STLExporter.js');
  const mesh=new THREE.Mesh(new THREE.SphereGeometry(20,512,256));
  const stl=new STLExporter().parse(mesh,{binary:true});
  const started=Date.now();
  await page.goto('/');
  await page.locator('input[type=file]').nth(1).setInputFiles({name:'Large.stl',mimeType:'model/stl',buffer:Buffer.from(stl.buffer)});
  await page.getByRole('button',{name:'Einstellungen',exact:true}).click();
  await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Escape');
  await expect(page.locator('.object-row')).toHaveCount(2,{timeout:60000});
  const z=page.locator('.vector-fields').nth(2).locator('input').nth(2);
  await z.fill('50');await z.press('Enter');await expect(z).toHaveValue('50');
  console.log(`Large STL: ${stl.byteLength} bytes, ${mesh.geometry.index!.count/3} triangles, import and edit ${Date.now()-started} ms`);
  mesh.geometry.dispose();
});

test('object copy/cut/paste snapshots, repeated paste and undo/redo',async({page})=>{
  await page.goto('/');await page.locator('.object-row').first().click();
  await page.keyboard.press('Control+c');
  await page.keyboard.press('Control+v');
  await expect(page.locator('.object-row')).toHaveCount(2);
  await expect(page.locator('.vector-fields').first().locator('input').first()).toHaveValue('10');
  await page.keyboard.press('Control+v');
  await expect(page.locator('.object-row')).toHaveCount(3);
  await expect(page.locator('.vector-fields').first().locator('input').first()).toHaveValue('20');
  await page.keyboard.press('Control+x');await expect(page.locator('.object-row')).toHaveCount(2);
  await page.keyboard.press('Control+v');await expect(page.locator('.object-row')).toHaveCount(3);
  await expect(page.locator('.vector-fields').first().locator('input').first()).toHaveValue('20');
  await page.keyboard.press('Control+z');await expect(page.locator('.object-row')).toHaveCount(2);
  await page.keyboard.press('Control+y');await expect(page.locator('.object-row')).toHaveCount(3);
});

test('group clipboard remains independent; field shortcuts do not cut objects',async({page})=>{
  await page.goto('/');
  const object={id:'a',name:'A',type:'box',position:[0,5,0],rotation:[0,0,0],scale:[1,1,1],dimensions:[10,10,10],color:'#43b6a8',groupId:'g'};
  const data={format:'3dmaker-project',version:1,objects:[object,{...object,id:'b',name:'B',position:[20,5,0]}]};
  await page.locator('input[type=file]').first().setInputFiles({name:'group.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});
  await page.locator('.object-row').first().click();await page.keyboard.press('Control+c');await page.keyboard.press('Control+v');
  await expect(page.locator('.object-row.selected')).toHaveCount(2);
  await expect(page.locator('.object-row')).toHaveCount(4);
  await page.locator('.object-row').first().click();await expect(page.locator('.object-row.selected')).toHaveCount(2);
  await page.getByLabel('Projektname').focus();await page.keyboard.press('Control+a');await page.keyboard.press('Control+x');
  await expect(page.locator('.object-row')).toHaveCount(4);
  await page.locator('.object-row').first().click();await page.getByRole('button',{name:'Einstellungen',exact:true}).click();
  await page.keyboard.press('Control+x');await page.keyboard.press('Control+v');await expect(page.locator('.object-row')).toHaveCount(4);
});

test('native clipboard events support Electron menu actions',async({page})=>{
  await page.goto('/');await page.locator('.object-row').first().click();
  await page.evaluate(()=>document.body.dispatchEvent(new Event('copy',{bubbles:true,cancelable:true})));
  await page.evaluate(()=>document.body.dispatchEvent(new Event('paste',{bubbles:true,cancelable:true})));
  await expect(page.locator('.object-row')).toHaveCount(2);
  await page.evaluate(()=>document.body.dispatchEvent(new Event('cut',{bubbles:true,cancelable:true})));
  await expect(page.locator('.object-row')).toHaveCount(1);
  await page.evaluate(()=>document.body.dispatchEvent(new Event('paste',{bubbles:true,cancelable:true})));
  await expect(page.locator('.object-row')).toHaveCount(2);
});

test('desktop settings register types, open defaults and download updates with errors visible',async({page})=>{
  await page.addInitScript(()=>{
    (window as any).desktopCalls=[];
    (window as any).threeDMakerFiles={isWindows:true,take:async()=>null,onPending:()=>()=>{},pick:async()=>{},register:async()=>{(window as any).desktopCalls.push('register');return {message:'Dateitypen registriert',executable:'C:\\Maker.exe'};},defaults:async()=>{(window as any).desktopCalls.push('defaults');}};
    (window as any).threeDMakerUpdates={check:async()=>({status:'available',latestVersion:'v9.0.0',notes:'Neu'}),openRelease:async()=>{throw new Error('Download nicht erreichbar');}};
  });
  await page.goto('/');await page.getByRole('button',{name:'Einstellungen',exact:true}).click();
  await page.getByRole('button',{name:'Dateitypen registrieren',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('Dateitypen registriert');
  await page.getByRole('button',{name:'Windows-Standardprogramme öffnen',exact:true}).click();
  expect(await page.evaluate(()=>(window as any).desktopCalls)).toEqual(['register','defaults']);
  await page.getByRole('button',{name:'Update herunterladen',exact:true}).click();
  await expect(page.getByRole('dialog')).toContainText('Download nicht erreichbar');
});

test('desktop startup and subsequent open requests load actual project files once',async({page})=>{
  await page.addInitScript(()=>{
    const project={format:'3dmaker-project',version:1,name:'Windows-Projekt',objects:[]};
    (window as any).fileQueue=[{name:'Windows.3dmaker',data:Array.from(new TextEncoder().encode(JSON.stringify(project)))}];
    (window as any).threeDMakerFiles={isWindows:true,take:async()=>{await new Promise(resolve=>setTimeout(resolve,20));return (window as any).fileQueue.shift()??null;},onPending:(callback:()=>void)=>{(window as any).notifyFiles=callback;return ()=>{};}};
  });
  await page.goto('/');await expect(page.getByLabel('Projektname')).toHaveValue('Windows-Projekt');
  await expect(page.locator('.object-row')).toHaveCount(0);
  page.on('dialog',dialog=>dialog.accept());
  await page.evaluate(()=>{
    (window as any).fileQueue.push({name:'Zweites.3dmaker',data:Array.from(new TextEncoder().encode(JSON.stringify({format:'3dmaker-project',version:1,name:'Zweites Projekt',objects:[]})))});
    (window as any).notifyFiles();
  });
  await expect(page.getByLabel('Projektname')).toHaveValue('Zweites Projekt');
});
