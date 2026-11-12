// ============================================================================
// Integración con ElevenLabs para generar voz de Zaturno
// Usando SDK: elevenlabs (npm)
// ============================================================================

import { config } from 'dotenv';
import { ElevenLabsClient } from 'elevenlabs';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createWriteStream } from 'fs';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';

const execPromise = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Cargar variables de entorno desde .env.local
config({ path: path.join(__dirname, '.env.local') });

/**
 * Genera archivos de voz para Zaturno usando ElevenLabs
 * @param {Array} frases - Array de objetos { id, texto, tiempo, velocidad? }
 * @param {object} opciones - Opciones de configuración
 * @returns {Array} Array de { id, archivo, tiempo }
 */
export async function generarVozZaturno(frases, opciones = {}) {
  const {
    voiceId = process.env.ELEVENLABS_VOICE_ID || 'default',
    apiKey = process.env.ELEVENLABS_API_KEY,
    outputDir = path.join(__dirname, 'output'),
    verbose = true,
    stability = 0.5,
    similarityBoost = 0.75,
    aplicarEfecto = true
  } = opciones;

  if (!apiKey) {
    throw new Error('Falta ELEVENLABS_API_KEY en las variables de entorno');
  }

  const client = new ElevenLabsClient({ apiKey });

  // Crear directorio de salida
  await fs.mkdir(outputDir, { recursive: true });

  if (verbose) {
    console.log(`🎙️  Generando ${frases.length} frases de voz con ElevenLabs`);
    console.log(`   Voice ID: ${voiceId}`);
    console.log(`   Salida: ${outputDir}\n`);
  }

  const archivosVoz = [];

  for (let i = 0; i < frases.length; i++) {
    const frase = frases[i];
    const { id, texto, tiempo = 0 } = frase;

    if (verbose) {
      console.log(`   [${i + 1}/${frases.length}] Generando: "${texto}"`);
    }

    try {
      const tempFile = path.join(outputDir, `temp_${id}.mp3`);

      // Generar audio con ElevenLabs
      const audioStream = await client.textToSpeech.convert(voiceId, {
        text: texto,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability,
          similarity_boost: similarityBoost
        }
      });

      // Guardar el stream a archivo
      const writeStream = createWriteStream(tempFile);
      await pipeline(Readable.from(audioStream), writeStream);

      if (verbose) {
        console.log(`      ✓ Audio base generado: ${tempFile}`);
      }

      // Aplicar efecto de "voz del espacio" si está habilitado
      let archivoFinal = tempFile;

      if (aplicarEfecto) {
        const outputFile = path.join(outputDir, `voz_${id}.wav`);
        const scriptPath = path.join(__dirname, 'voz-del-espacio.sh');

        try {
          await fs.access(scriptPath);

          try {
            await execPromise(`bash "${scriptPath}" "${tempFile}" "${outputFile}"`);
            archivoFinal = outputFile;

            if (verbose) {
              console.log(`      ✓ Efecto aplicado: ${outputFile}`);
            }

            await fs.unlink(tempFile);
          } catch (error) {
            console.warn(`   ⚠️  Error al aplicar efecto: ${error.message}`);
            archivoFinal = tempFile;
          }
        } catch {
          console.warn(`   ⚠️  No se encontró voz-del-espacio.sh, usando audio sin efecto`);
          archivoFinal = tempFile;
        }
      }

      archivosVoz.push({
        id,
        archivo: archivoFinal,
        tiempo,
        texto
      });

    } catch (error) {
      console.error(`   ❌ Error generando "${texto}": ${error.message}`);
      throw error;
    }
  }

  if (verbose) {
    console.log(`\n✅ ${archivosVoz.length} archivos de voz generados`);
  }

  return archivosVoz;
}

/**
 * Obtener lista de voces disponibles en ElevenLabs
 */
export async function listarVoces(apiKey = process.env.ELEVENLABS_API_KEY) {
  if (!apiKey) {
    throw new Error('Falta ELEVENLABS_API_KEY - configúrala con: $env:ELEVENLABS_API_KEY="tu-key"');
  }

  const client = new ElevenLabsClient({ apiKey });

  try {
    const voicesResponse = await client.voices.search();

    console.log('\n📋 Voces disponibles en ElevenLabs:\n');

    let count = 0;
    for (const v of voicesResponse.voices) {
      const idiomas = v.labels?.language || '';

      // Filtrar solo voces en español
      if (idiomas.toLowerCase().includes('spanish') || idiomas.toLowerCase().includes('español')) {
        count++;
        console.log(`   ✅ ID: ${v.voice_id}`);
        console.log(`   Nombre: ${v.name}`);
        console.log(`   Género: ${v.labels?.gender || 'N/A'}`);
        console.log(`   Acento: ${v.labels?.accent || 'N/A'}`);
        console.log(`   Descripción: ${v.labels?.description || ''}`);
        console.log('');
      }
    }

    console.log(`\n💡 Total de voces en español: ${count}`);
    console.log('Usa el ID de la voz con: probarVoz("voice_id_aqui")\n');

    return voicesResponse.voices;
  } catch (error) {
    console.error('❌ Error obteniendo voces:', error.message);
    if (error.statusCode === 401) {
      console.error('\n⚠️  Error 401: API key inválida o expirada');
      console.error('   1. Verifica que tu API key sea correcta');
      console.error('   2. Genera una nueva en: https://elevenlabs.io/app/settings/api-keys');
      console.error('   3. Configúrala: $env:ELEVENLABS_API_KEY="tu-nueva-key"\n');
    }
    throw error;
  }
}

/**
 * Probar una voz con un texto de ejemplo
 */
export async function probarVoz(voiceId, texto = 'Yo soy Zaturno. Yo me encargo.') {
  console.log(`\n🎤 Probando voz: ${voiceId}`);
  console.log(`   Texto: "${texto}"\n`);

  const archivos = await generarVozZaturno([
    { id: 'prueba', texto, tiempo: 0 }
  ], {
    voiceId,
    outputDir: path.join(__dirname, 'pruebas'),
    aplicarEfecto: true,
    verbose: true
  });

  console.log(`\n✅ Prueba completada. Escucha: ${archivos[0].archivo}`);

  return archivos[0].archivo;
}
