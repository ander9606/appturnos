// ============================================================================
// Buscador de música de fondo para Reel 5
// Usa el catálogo de Artlist para encontrar tracks apropiados
// ============================================================================

/**
 * NOTA: Este script está diseñado para ejecutarse manualmente
 * a través del CLI de Claude Code con acceso al MCP de Artlist.
 *
 * No es un script Node.js estándar, sino una guía de búsqueda.
 */

console.log('🎵 Buscador de Música - Reel 5\n');
console.log('━'.repeat(60));
console.log('Requisitos según el guion:');
console.log('  • BPM: 120-130');
console.log('  • Estilo: Upbeat, positivo, moderno');
console.log('  • Género: Corporate/Tech optimista');
console.log('  • Voces: INSTRUMENTAL (sin letra)');
console.log('  • Duración: ~30 segundos (o más largo para recortar)');
console.log('  • Uso: Background, no compite con la voz del perro');
console.log('━'.repeat(60));
console.log('');

console.log('📋 Términos de búsqueda recomendados:\n');

const busquedasSugeridas = [
  {
    query: 'upbeat corporate tech',
    bpmMin: 120,
    bpmMax: 130,
    vocals: 'INSTRUMENTAL',
    descripcion: 'Búsqueda principal - corporate tech optimista'
  },
  {
    query: 'modern positive energy',
    bpmMin: 120,
    bpmMax: 130,
    vocals: 'INSTRUMENTAL',
    descripcion: 'Alternativa - energía positiva moderna'
  },
  {
    query: 'success achievement',
    bpmMin: 120,
    bpmMax: 130,
    vocals: 'INSTRUMENTAL',
    descripcion: 'Alternativa - logro y éxito'
  },
  {
    query: 'inspiring motivational',
    bpmMin: 115,
    bpmMax: 135,
    vocals: 'INSTRUMENTAL',
    descripcion: 'Alternativa - inspirador y motivacional'
  }
];

busquedasSugeridas.forEach((b, i) => {
  console.log(`${i + 1}. ${b.query}`);
  console.log(`   BPM: ${b.bpmMin}-${b.bpmMax} | Vocals: ${b.vocals}`);
  console.log(`   → ${b.descripcion}`);
  console.log('');
});

console.log('━'.repeat(60));
console.log('🎯 Momentos clave para sincronizar:\n');
console.log('  • 3.0s  - Beat drop suave (inicio Paso 1)');
console.log('  • 23.0s - Build-up (completado)');
console.log('  • 24.0s - Clímax (checkmark gigante)');
console.log('');

console.log('━'.repeat(60));
console.log('💡 Cómo usar:\n');
console.log('1. Ejecuta estas búsquedas en Artlist desde Claude Code');
console.log('2. Escucha los previews y elige el track que mejor se ajuste');
console.log('3. Descarga el track con download_track(songId)');
console.log('4. Guárdalo en: reel-05/audio/musica-fondo.mp3');
console.log('5. En build.js, se mezclará con las voces usando ffmpeg');
console.log('');

console.log('━'.repeat(60));
console.log('');

export { busquedasSugeridas };
