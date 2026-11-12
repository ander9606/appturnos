// Script simple para abrir la animación en el navegador
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function openPreview() {
  console.log('🎬 Abriendo animación del reel-05...\n');

  const browser = await chromium.launch({
    headless: false, // Mostrar el navegador
    args: ['--start-maximized']
  });

  const context = await browser.newContext({
    viewport: null // Usar tamaño de ventana completo
  });

  const page = await context.newPage();

  // Cargar la página
  const htmlPath = path.join(__dirname, 'timeline.html');
  await page.goto('file://' + htmlPath);

  console.log('✅ Animación cargada en el navegador');
  console.log('');
  console.log('📺 INSTRUCCIONES:');
  console.log('   • Presiona ▶ Play para reproducir');
  console.log('   • Usa el slider para navegar');
  console.log('   • La animación dura 30 segundos');
  console.log('');
  console.log('⏸️  El navegador se quedará abierto.');
  console.log('   Ciérralo cuando termines de revisar.\n');

  // Esperar indefinidamente (hasta que el usuario cierre el navegador)
  await page.waitForEvent('close').catch(() => {
    console.log('🔚 Navegador cerrado');
  });

  await browser.close();
}

openPreview().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
