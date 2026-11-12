// ============================================================================
// Script para listar voces disponibles en ElevenLabs
// ============================================================================

import { listarVoces } from './generar-voz.js';

async function main() {
  console.log('🔍 Buscando voces en español en ElevenLabs...\n');

  try {
    await listarVoces();

    console.log('━'.repeat(60));
    console.log('💡 Recomendación para el Reel 5 (voz del perro):');
    console.log('');
    console.log('   Buscar una voz con estas características:');
    console.log('   • Género: Masculino o neutral');
    console.log('   • Acento: Colombiano (o latinoamericano neutro)');
    console.log('   • Edad: Joven/adulto');
    console.log('   • Tono: Amigable, tranquilo, confiable');
    console.log('   • NO épico, NO grave profundo (eso es Zaturno)');
    console.log('');
    console.log('   Una vez elegida, configura:');
    console.log('   $env:ELEVENLABS_VOICE_ID_PERRO="voice_id_aqui"');
    console.log('');
    console.log('━'.repeat(60));

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();
