// Uso: [ESCALA=1] node render2.js archivo.html id1 id2 ...   -> guarda cada <svg id> como PNG (escala 1.5 por defecto)
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const [, , entrada, ...ids] = process.argv;
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1240, height: 1000 }, deviceScaleFactor: Number(process.env.ESCALA) || 1.5 });
  p.on('pageerror', e => console.log('ERROR de pagina:', e.message));
  p.on('console', m => m.type() === 'error' && console.log('consola:', m.text()));
  await p.goto('file://' + path.resolve(entrada));
  for (const id of ids) await p.locator('#' + id).screenshot({ path: path.join(path.dirname(path.resolve(entrada)), id + '.png') });
  await b.close();
})();
