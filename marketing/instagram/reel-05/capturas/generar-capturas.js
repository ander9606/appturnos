// ============================================================================
// Script para generar capturas de las pantallas simuladas del reel 5
// Ejecutar desde: marketing/instagram/reel-05/
// Comando: npm run capturas
// ============================================================================

import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const capturasDir = __dirname;

const capturas = [
  {
    id: 'Excel',
    nombre: 'excel-chaos.html',
    descripcion: 'Excel caótico (contraste)',
    output: 'excel-chaos.png',
    width: 1200,
    height: 800  // Desktop screenshot
  },
  {
    id: 'A',
    nombre: 'captura-a-equipo.html',
    descripcion: 'Pantalla Equipo con lista y FAB',
    output: 'captura-a-equipo.png',
    width: 390,
    height: 844  // iPhone 14 Pro
  },
  {
    id: 'B',
    nombre: 'captura-b-formulario1.html',
    descripcion: 'Formulario paso 1 — Datos personales',
    output: 'captura-b-formulario1.png',
    width: 390,
    height: 844
  },
  {
    id: 'C',
    nombre: 'captura-c-formulario2.html',
    descripcion: 'Formulario paso 2 — Seguridad social y pago',
    output: 'captura-c-formulario2.png',
    width: 390,
    height: 844
  },
  {
    id: 'D',
    nombre: 'captura-d-exito.html',
    descripcion: 'Pantalla de éxito — Trabajador creado',
    output: 'captura-d-exito.png',
    width: 390,
    height: 844
  }
];

async function generarCapturas() {
  console.log('📸 Generando capturas del reel 5...\n');

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
      captura: './capturas/captura-a-equipo.png',
      x: 540,
      y: 960,
      tInicio: 3,
      duracionEntrada: 0.5
    }
  ]
  `);
}

generarCapturas().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
