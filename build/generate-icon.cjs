const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const pngToIco = require('png-to-ico');
(async () => {
  const svg = path.join(__dirname, 'icon.svg');
  const png = path.join(__dirname, 'icon.png');
  const ico = path.join(__dirname, 'icon.ico');
  await sharp(svg).resize(512, 512).png().toFile(png);
  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const bitmaps = await Promise.all(sizes.map(size => sharp(svg).resize(size, size).png().toBuffer()));
  fs.writeFileSync(ico, await pngToIco(bitmaps));
  console.log('Created:', png, ico);
})().catch(error => { console.error(error); process.exitCode = 1; });
