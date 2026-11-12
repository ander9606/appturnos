// Script de prueba para verificar la animación
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function testPreview() {
  console.log('🎬 Probando animación del reel-05...\n');

  const browser = await chromium.launch({
    headless: false, // Mostrar el navegador
    slowMo: 100 // Ralentizar para poder ver
  });

  const page = await browser.newPage({
    viewport: {
      width: 1080,
      height: 1920
    }
  });

  // Cargar la página
  const htmlPath = path.join(__dirname, 'timeline.html');
  await page.goto('file://' + htmlPath);

  console.log('✅ Página cargada');
  console.log('📺 El navegador debería estar abierto con la animación');
  console.log('🎮 Usa los controles para reproducir');
  console.log('\n⏸️  Presiona Ctrl+C cuando termines de revisar\n');

  // Esperar unos segundos para ver el frame inicial
  await page.waitForTimeout(2000);

  // Tomar captura del frame inicial
  await page.screenshot({
    path: path.join(__dirname, 'test-frame-0.png'),
    fullPage: false
  });

  console.log('✅ Captura del frame 0 guardada: test-frame-0.png');

  // Probar algunos frames específicos
  const testFrames = [0, 3, 9, 16, 23, 30];

  for (const tiempo of testFrames) {
    await page.evaluate((t) => {
      window.renderFrame(t);
    }, tiempo);

    await page.waitForTimeout(500);

    await page.screenshot({
      path: path.join(__dirname, `test-frame-${tiempo}s.png`),
      fullPage: false
    });

    console.log(`✅ Frame ${tiempo}s capturado`);
  }

  console.log('\n🎉 Prueba completada');
  console.log('📁 Revisa las capturas test-frame-*.png');
  console.log('\n💡 El navegador seguirá abierto. Ciérralo cuando termines.\n');

  // No cerrar el navegador automáticamente para poder interactuar
  // await browser.close();
}

testPreview().catch(error => {
  console.error('❌ Error:', error.message);
  console.error(error.stack);
  process.exit(1);
});
