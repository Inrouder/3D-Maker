const test=require('node:test');
const assert=require('node:assert/strict');
const {newer,releaseInfo,supportedFileArgs,associationEntries}=require('../electron/desktop.cjs');
const release=()=>({tag_name:'v0.1.11',name:'3D-Maker',assets:[{name:'3D-Maker-Portable-0.1.11.exe',size:123,browser_download_url:'https://github.com/Inrouder/3D-Maker/releases/download/v0.1.11/3D-Maker-Portable-0.1.11.exe'}]});
test('updater compares numeric versions including two-digit patches',()=>{
  assert.equal(newer('v0.1.11','0.1.9'),true);assert.equal(newer('0.1.11','0.1.11'),false);assert.equal(newer('0.2.0','0.1.99'),true);assert.equal(newer('v1.0.0-beta','0.1.11'),false);
});
test('updater only advertises a completed stable release with matching Windows EXE',()=>{
  assert.equal(releaseInfo(release(),'0.1.10').status,'available');assert.equal(releaseInfo(release(),'0.1.11').status,'current');
  assert.equal(releaseInfo({...release(),assets:[]},'0.1.10').status,'unavailable');
  assert.equal(releaseInfo({...release(),prerelease:true},'0.1.10').status,'unavailable');
  const unsafe=release();unsafe.assets[0].browser_download_url='https://example.com/app.exe';assert.equal(releaseInfo(unsafe,'0.1.10').status,'unavailable');
});
test('file arguments ignore flags, executables and unsupported files',()=>{
  assert.deepEqual(supportedFileArgs(['/tmp/test.stl','--inspect','/tmp/app.exe','/tmp/a.3dmaker','/tmp/legacy.3dmaker.json']),['/tmp/test.stl','/tmp/a.3dmaker','/tmp/legacy.3dmaker.json']);
});
test('Windows registration quotes the persistent launcher and never takes over generic JSON',()=>{
  const exe='C:\\Users\\A User\\3D-Maker.exe';const entries=associationEntries(exe);
  assert.equal(entries.filter(e=>e.key.endsWith('shell\\open\\command')).length,3);
  assert.ok(entries.filter(e=>e.key.endsWith('shell\\open\\command')).every(e=>e.value===`"${exe}" "%1"`));
  assert.ok(entries.every(e=>e.key.startsWith('HKCU\\')));assert.ok(entries.every(e=>!e.key.includes('.json') && !e.key.includes('UserChoice')));
  assert.throws(()=>associationEntries('C:\\bad"path.exe'));assert.throws(()=>associationEntries('relative.exe'));
});

test('updater prefers the stable filename within the validated version',()=>{
  const value=release();value.assets.push({name:'3D-Maker-Portable.exe',size:123,browser_download_url:'https://github.com/Inrouder/3D-Maker/releases/download/v0.1.11/3D-Maker-Portable.exe'});
  assert.equal(releaseInfo(value,'0.1.10').url,value.assets[1].browser_download_url);
});
