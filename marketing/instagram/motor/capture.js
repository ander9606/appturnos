// ============================================================================
// Sistema de captura de frames con Playwright
// Basado en render2.js pero optimizado para secuencias de video
// ============================================================================

import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs/promises';

/**
 * Captura una secuencia de frames de una página HTML animada
 * @param {string} htmlPath - Ruta al archivo HTML
 * @param {string} outputDir - Directorio donde guardar los frames
 * @param {number} duracion - Duración total en segundos
 * @param {number} fps - Frames por segundo
 * @param {object} opciones - Opciones adicionales
 */
export async function captureTimeline(htmlPath, outputDir, duracion, fps = 30, opciones = {}) {
  const {
    width = 1080,
    height = 1920,
    verbose = true,
    onProgress = null
  } = opciones;

  // Crear directorio de salida si no existe
  await fs.mkdir(outputDir, { recursive: true });

  // Calcular total de frames
  const totalFrames = Math.ceil(duracion * fps);

  if (verbose) {
    console.log(`📹 Capturando ${totalFrames} frames (${duracion}s a ${fps}fps)`);
    console.log(`   Resolución: ${width}x${height}`);
    console.log(`   Archivo: ${htmlPath}`);
    console.log(`   Salida: ${outputDir}\n`);
  }

  // Lanzar navegador
  const browser = await chromium.launch({
    headless: true
  });

  const page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: 1
  });

  // Manejadores de errores
  page.on('pageerror', e => {
    console.error('❌ Error de página:', e.message);
  });

  page.on('console', m => {
    if (m.type() === 'error') {
      console.error('❌ Error de consola:', m.text());
    }
  });

  // Cargar página
  const fileUrl = 'file://' + path.resolve(htmlPath);
  await page.goto(fileUrl);

  // Esperar a que la página esté lista
  await page.waitForLoadState('networkidle');

  // Verificar que existe la función renderFrame
  const hasRenderFrame = await page.evaluate(() => {
    return typeof window.renderFrame === 'function';
  });

  if (!hasRenderFrame) {
    throw new Error('La página HTML no tiene la función window.renderFrame()');
  }

  // Capturar frames
  const startTime = Date.now();

  for (let frame = 0; frame < totalFrames; frame++) {
    const t = frame / fps;

    // Renderizar el frame en el tiempo t
    await page.evaluate((tiempo) => {
      window.renderFrame(tiempo);
    }, t);

    // Pequeña pausa para asegurar que el render se complete
    await page.waitForTimeout(10);

    // Capturar screenshot
    const framePath = path.join(outputDir, `frame_${String(frame).padStart(5, '0')}.png`);
    await page.screenshot({
      path: framePath,
      fullPage: false,
      animations: 'disabled'
    });

    // Progreso
    if (verbose && (frame % 30 === 0 || frame === totalFrames - 1)) {
      const progreso = ((frame + 1) / totalFrames * 100).toFixed(1);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const fps_actual = ((frame + 1) / (elapsed || 1)).toFixed(1);
      console.log(`   Frame ${frame + 1}/${totalFrames} (${progreso}%) - ${elapsed}s elapsed - ${fps_actual} fps`);
    }

    if (onProgress) {
      onProgress(frame + 1, totalFrames);
    }
  }

  await browser.close();

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);

  if (verbose) {
    console.log(`\n✅ Captura completada en ${totalTime}s`);
    console.log(`   FPS promedio: ${(totalFrames / totalTime).toFixed(1)}`);
  }

  return {
    totalFrames,
    duracion: totalTime,
    outputDir,
    fps_promedio: totalFrames / totalTime
  };
}

/**
 * Captura un solo frame de una página
 * @param {string} htmlPath - Ruta al archivo HTML
 * @param {number} tiempo - Tiempo en segundos
 * @param {string} outputPath - Ruta del archivo de salida
 */
export async function captureSingleFrame(htmlPath, tiempo, outputPath, opciones = {}) {
  const {
    width = 1080,
    height = 1920
  } = opciones;

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: 1
  });

  const fileUrl = 'file://' + path.resolve(htmlPath);
  await page.goto(fileUrl);
  await page.waitForLoadState('networkidle');

  await page.evaluate((t) => {
    window.renderFrame(t);
  }, tiempo);

  await page.waitForTimeout(50);

  await page.screenshot({
    path: outputPath,
    fullPage: false,
    animations: 'disabled'
  });

  await browser.close();

  console.log(`✅ Frame capturado: ${outputPath}`);
}

/**
 * Genera un video a partir de frames usando ffmpeg
 * @param {string} framesDir - Directorio con los frames
 * @param {string} outputPath - Ruta del video de salida
 * @param {number} fps - Frames por segundo
 * @param {object} opciones - Opciones de ffmpeg
 */
export async function framesToVideo(framesDir, outputPath, fps = 30, opciones = {}) {
  const {
    crf = 18,           // Calidad (18 = muy alta, 23 = default, 28 = menor)
    preset = 'slow',    // slow = mejor compresión
    audioFiles = [],    // Archivos de audio con sus tiempos
    verbose = true
  } = opciones;

  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execPromise = promisify(exec);

  if (verbose) {
    console.log(`\n🎞️  Generando video con ffmpeg...`);
    console.log(`   Frames: ${framesDir}/frame_%05d.png`);
    console.log(`   Salida: ${outputPath}`);
    console.log(`   FPS: ${fps}, CRF: ${crf}, Preset: ${preset}`);
  }

  // Construir comando ffmpeg
  let comando = `ffmpeg -framerate ${fps} -i "${framesDir}/frame_%05d.png"`;

  // Agregar archivos de audio si existen
  if (audioFiles.length > 0) {
    // Inputs de audio
    audioFiles.forEach(({ archivo }) => {
      comando += ` -i "${archivo}"`;
    });

    // Filtro de audio para mezclar con delays
    const audioFilter = audioFiles
      .map((a, i) => `[${i + 1}]adelay=${a.tiempo * 1000}|${a.tiempo * 1000}[a${i}]`)
      .join(';');

    const audioMix = audioFiles.map((_, i) => `[a${i}]`).join('') +
                     `amix=inputs=${audioFiles.length}:duration=first`;

    comando += ` -filter_complex "${audioFilter};${audioMix}"`;
  }

  // Opciones de video
  comando += ` -c:v libx264 -preset ${preset} -crf ${crf}`;
  comando += ` -pix_fmt yuv420p`;

  // Opciones de audio
  if (audioFiles.length > 0) {
    comando += ` -c:a aac -b:a 192k`;
  }

  // Otras opciones
  comando += ` -movflags +faststart`; // Optimización para streaming
  comando += ` -s 1080x1920`;         // Resolución fija
  comando += ` -y "${outputPath}"`;   // Sobrescribir si existe

  if (verbose) {
    console.log(`\n   Ejecutando: ${comando.substring(0, 100)}...`);
  }

  const { stdout, stderr } = await execPromise(comando);

  if (verbose && stderr) {
    // ffmpeg escribe su progreso en stderr, es normal
    const lineas = stderr.split('\n');
    const ultimaLinea = lineas[lineas.length - 2] || lineas[lineas.length - 1];
    if (ultimaLinea) {
      console.log(`   ${ultimaLinea.trim()}`);
    }
  }

  if (verbose) {
    console.log(`\n✅ Video generado: ${outputPath}`);
  }

  return outputPath;
}
