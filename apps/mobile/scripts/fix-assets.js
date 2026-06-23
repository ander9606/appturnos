// Regenera los assets PNG con CRC válido usando solo Node.js built-ins
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++)
      crc = crc & 1 ? (crc >>> 1) ^ 0xEDB88320 : crc >>> 1;
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}

function makePNG(w, h, r, g, b, a = 255) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = a < 255 ? 6 : 2;

  const ch = a < 255 ? 4 : 3;
  const row = Buffer.alloc(1 + w * ch);
  for (let x = 0; x < w; x++) {
    row[1 + x*ch] = r; row[2 + x*ch] = g; row[3 + x*ch] = b;
    if (ch === 4) row[4 + x*ch] = a;
  }
  const raw = Buffer.concat(Array.from({length: h}, () => row));
  const idat = zlib.deflateSync(raw);

  return Buffer.concat([
    Buffer.from([137,80,78,71,13,10,26,10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

const assetsDir = path.join(__dirname, '../assets');
const brand = [255, 90, 60]; // #FF5A3C

const files = [
  { name: 'icon.png',             w: 1024, h: 1024, rgba: [...brand, 255] },
  { name: 'adaptive-icon.png',    w: 1024, h: 1024, rgba: [...brand, 255] },
  { name: 'splash.png',           w: 1242, h: 2688, rgba: [...brand, 255] },
  { name: 'notification-icon.png', w: 96,  h: 96,   rgba: [255,255,255,255] },
  { name: 'favicon.png',           w: 64,  h: 64,   rgba: [...brand, 255] },
];

for (const f of files) {
  const buf = makePNG(f.w, f.h, ...f.rgba);
  fs.writeFileSync(path.join(assetsDir, f.name), buf);
  console.log(`✓ ${f.name} (${f.w}x${f.h})`);
}
console.log('Assets regenerados correctamente.');
