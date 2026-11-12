// ============================================================================
// Generador de audio para Reel 5: Tu equipo listo en minutos
// ============================================================================

import { generarVozZaturno } from '../audio/generar-voz.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Frases de voz según el guion completo
 */
const frasesVoz = [
  {
    id: 'v1',
    texto: 'Olvídate del Excel y las hojas interminables',
    tiempo: 0.5,
    toma: 1,
    descripcion: 'Intro - Adiós Excel'
  },
  {
    id: 'v2',
    texto: 'Abre la pestaña Equipo, todo tu equipo en un solo lugar',
    tiempo: 3.5,
    toma: 2,
    descripcion: 'Paso 1 - Abre Equipo'
  },
  {
    id: 'v3',
    texto: 'Completa los datos. La app valida todo por ti',
    tiempo: 9.5,
    toma: 3,
    descripcion: 'Paso 2 - Completa datos'
  },
  {
    id: 'v4',
    texto: 'Agrega salario y banco. Queda listo para la nómina',
    tiempo: 16.5,
    toma: 4,
    descripcion: 'Paso 3 - Salario y banco'
  },
  {
    id: 'v5',
    texto: 'Listo en minutos. Cada uno con su acceso propio',
    tiempo: 23.5,
    toma: 5,
    descripcion: 'Completado + Cierre'
  }
];

/**
 * Configuración de voz
 *
 * Voz recomendada: colombiana, tranquila, amigable
 * Tono: Aspiracional pero relajado, no "épico" como Zaturno
 */
const configuracionVoz = {
  // ID de voz a usar (se pasa como argumento o desde .env)
  voiceId: process.env.ELEVENLABS_VOICE_ID_PERRO || process.env.ELEVENLABS_VOICE_ID,

  // Parámetros de calidad
  stability: 0.6,           // Más estable para tono tranquilo
  similarityBoost: 0.8,     // Alta fidelidad a la voz original

  // Directorio de salida
  outputDir: path.join(__dirname, 'audio'),

  // Aplicar efecto de espacio (NO para esta voz, es voz normal)
  aplicarEfecto: false,

  verbose: true
};

async function main() {
  console.log('🎙️  Generador de Audio - Reel 5\n');
  console.log('━'.repeat(60));
  console.log('Duración total: 30 segundos');
  console.log('Voces a generar: 5 frases');
  console.log('Voz: Perro (colombiana tranquila)');
  console.log('━'.repeat(60));
  console.log('');

  // Mostrar lista de frases
  console.log('📝 Frases programadas:\n');
  frasesVoz.forEach(f => {
    console.log(`   ${f.id} (${f.tiempo}s) - Toma ${f.toma}`);
    console.log(`   "${f.texto}"`);
    console.log(`   → ${f.descripcion}`);
    console.log('');
  });

  console.log('━'.repeat(60));
  console.log('');

  try {
    // Generar todas las voces
    const archivosGenerados = await generarVozZaturno(frasesVoz, configuracionVoz);

    console.log('\n━'.repeat(60));
    console.log('✅ Generación completada\n');
    console.log('Archivos generados:');
    archivosGenerados.forEach(a => {
      console.log(`   • ${path.basename(a.archivo)} (${a.tiempo}s)`);
    });
    console.log('');

    // Información sobre la música de fondo
    console.log('━'.repeat(60));
    console.log('🎵 Próximo paso: Música de fondo\n');
    console.log('Opciones:');
    console.log('   1. Buscar en Artlist (upbeat, corporate, 120-130 BPM)');
    console.log('   2. Usar biblioteca de música libre de derechos');
    console.log('   3. Agregar al publicar en Instagram');
    console.log('');
    console.log('💡 La música se sincronizará en el video final con ffmpeg');
    console.log('');

  } catch (error) {
    console.error('\n❌ Error generando audio:', error.message);

    if (error.message.includes('API_KEY')) {
      console.error('\n⚠️  Configura tu API key de ElevenLabs:');
      console.error('   PowerShell: $env:ELEVENLABS_API_KEY="tu-api-key"');
      console.error('   Bash: export ELEVENLABS_API_KEY="tu-api-key"');
      console.error('');
      console.error('   O crea un archivo .env.local con:');
      console.error('   ELEVENLABS_API_KEY=tu-api-key');
      console.error('   ELEVENLABS_VOICE_ID_PERRO=id-voz-colombiana');
      console.error('');
    }

    process.exit(1);
  }
}

// Ejecutar si se llama directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { frasesVoz, configuracionVoz };
