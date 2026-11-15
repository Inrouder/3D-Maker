const path = require('node:path');
const REPO = 'Inrouder/3D-Maker';
const FILE_TYPES = { '.3dmaker': 'Projekt', '.stl': 'STL-Modell', '.obj': 'OBJ-Modell' };
function versionParts(value) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(String(value));
  return match ? match.slice(1).map(Number) : null;
}
function newer(next, current) {
  const a=versionParts(next),b=versionParts(current);
  if(!a || !b)return false;
  for(let i=0;i<3;i++)if(a[i]!==b[i])return a[i]>b[i];
  return false;
}
function releaseInfo(release, currentVersion) {
  if(release.draft || release.prerelease || !versionParts(release.tag_name)) return {status:'unavailable',message:'Kein gültiges stabiles Release verfügbar.'};
  const version=release.tag_name.replace(/^v/,'');
  const asset=release.assets?.find(a=>a.name===`3D-Maker-Portable-${version}.exe`);
  const expected=`https://github.com/${REPO}/releases/download/${release.tag_name}/3D-Maker-Portable-${version}.exe`;
  if(!asset || asset.browser_download_url!==expected || !asset.size) return {status:'unavailable',message:'Das Release enthält noch keine vollständige portable Windows-EXE.'};
  return {status:newer(version,currentVersion)?'available':'current',currentVersion,latestVersion:release.tag_name,title:release.name||release.tag_name,notes:String(release.body||'').slice(0,2500),url:expected,publishedAt:release.published_at||null};
}
function supportedFileArgs(args) {
  return args.filter(arg=>typeof arg==='string' && path.isAbsolute(arg) && ['.3dmaker','.json','.stl','.obj'].includes(path.extname(arg).toLowerCase()));
}
function associationEntries(executable) {
  if(!path.win32.isAbsolute(executable) || /["\r\n]/.test(executable) || path.win32.extname(executable).toLowerCase()!=='.exe') throw new Error('Ungültiger EXE-Pfad.');
  const entries=[];
  const add=(key,name,value)=>entries.push({key,name,value});
  const base='HKCU\\Software\\Classes';
  for(const [ext,description] of Object.entries(FILE_TYPES)) {
    const progId=`Inrouder.3DMaker${ext}`;
    add(`${base}\\${progId}`,null,`3D-Maker ${description}`);
    add(`${base}\\${progId}\\DefaultIcon`,null,`"${executable}",0`);
    add(`${base}\\${progId}\\shell\\open\\command`,null,`"${executable}" "%1"`);
    add(`${base}\\${ext}\\OpenWithProgids`,progId,'');
    add('HKCU\\Software\\3D-Maker\\Capabilities\\FileAssociations',ext,progId);
  }
  add('HKCU\\Software\\3D-Maker\\Capabilities','ApplicationName','3D-Maker');
  add('HKCU\\Software\\3D-Maker\\Capabilities','ApplicationDescription','Lokaler 3D-Modellierer für Projekte, STL und OBJ');
  add('HKCU\\Software\\RegisteredApplications','3D-Maker','Software\\3D-Maker\\Capabilities');
  return entries;
}
module.exports={REPO,FILE_TYPES,newer,releaseInfo,supportedFileArgs,associationEntries};
