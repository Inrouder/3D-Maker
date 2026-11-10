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
  await expect(page.locator('.actual-dimensions')).toContainText('62.50 mm × 12.00 mm × 23.00 mm');
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
  expect((await download).suggestedFilename()).toBe('Neuer Name.3dmaker.json');
});

test('group member uses world Y when placed on ground', async ({page})=>{
  await page.goto('/');
  const object={id:'a',name:'A',type:'box',position:[0,50,0],rotation:[0,0,0],scale:[1,1,1],dimensions:[10,10,10],color:'#43b6a8',groupId:'g'};
  const data={format:'3dmaker-project',version:1,objects:[object,{...object,id:'b',name:'B',position:[20,70,0]}]};
  await page.locator('input[type=file]').first().setInputFiles({name:'group.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});
  await page.locator('.object-row').first().click({modifiers:['Shift']});
  await page.getByRole('button',{name:/Auf Boden setzen/}).click();
  await expect(page.locator('.vector-fields').nth(0).locator('input').nth(1)).toHaveValue('5');
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
