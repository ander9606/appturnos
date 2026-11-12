// ============================================================================
// Script para generar capturas de las pantallas de la app
// Ejecutar desde: marketing/instagram/reel-01/
// Comando: node capturas/generar-capturas.js
// ============================================================================

import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const capturasDir = __dirname;

const capturas = [
  {
    id: 'A',
    nombre: 'captura-a-turno.html',
    descripcion: 'Publicar turno',
    output: 'captura-a-turno.png',
    width: 390,
    height: 844  // iPhone 14 Pro
  },
  {
    id: 'B',
    nombre: 'captura-b-marcaje.html',
    descripcion: 'Marcaje con geocerca',
    output: 'captura-b-marcaje.png',
    width: 390,
    height: 844
  },
  {
    id: 'C',
    nombre: 'captura-c-nomina.html',
    descripcion: 'Liquidación de nómina',
    output: 'captura-c-nomina.png',
    width: 390,
    height: 844
  }
];

async function generarCapturas() {
  console.log('📸 Generando capturas de la app...\n');

  const browser = await chromium.launch({
    headless: true
  });

  for (const captura of capturas) {
    console.log(`   [${captura.id}] ${captura.descripcion}`);

    const page = await browser.newPage({
      viewport: {
        width: captura.width,
        height: captura.height
      },
      deviceScaleFactor: 2  // Para pantallas retina (más nítido)
    });

    // Cargar página
    const htmlPath = path.join(__dirname, captura.nombre);
    await page.goto('file://' + htmlPath);

    // Esperar a que se renderice completamente
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);  // Dar tiempo a las animaciones CSS

    // Capturar
    const outputPath = path.join(__dirname, captura.output);
    await page.screenshot({
      path: outputPath,
      fullPage: false
    });

    console.log(`      ✓ Guardado: ${captura.output}`);

    await page.close();
  }

  await browser.close();

  console.log('\n✅ Capturas generadas exitosamente');
  console.log('\nArchivos creados:');
  capturas.forEach(c => {
    console.log(`   - ${c.output} (${c.width}x${c.height})`);
  });

  console.log('\n📝 Estas imágenes se pueden usar en el reel con marcoPhone():');
  console.log(`
  import { marcoPhone } from '../motor/phone-frame.js';

  // En las escenas:
  propsExtra: [
    {
      tipo: 'phone',
      captura: './capturas/captura-a-turno.png',
      x: 540,
      y: 960,
      tInicio: 18,
      duracionEntrada: 0.5
    }
  ]
  `);
}

generarCapturas().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
