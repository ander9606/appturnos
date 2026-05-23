'use strict';

/**
 * Genera un par de claves VAPID para Web Push.
 * Uso:  npm run generar-vapid
 *
 * Copia la salida en tu archivo .env. La clave privada es secreta;
 * nunca la subas al repositorio.
 */

const webpush = require('web-push');

const claves = webpush.generateVAPIDKeys();

console.log('\nClaves VAPID generadas. Cópialas en tu archivo .env:\n');
console.log(`VAPID_PUBLIC_KEY=${claves.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${claves.privateKey}`);
console.log('VAPID_SUBJECT=mailto:soporte@app-turnos.com\n');
