'use strict';

const crypto = require('crypto');

const ALGORITMO = 'aes-256-gcm';

/**
 * Cifra/descifra la firma del representante legal (empresas.firma_representante_b64)
 * en reposo: si alguien lee la base de datos directo (backup filtrado, inyección SQL,
 * credencial de DB comprometida), se lleva bytes inservibles en vez de la firma.
 * No protege si además comprometen el propio servidor API — la clave vive en su entorno.
 */
function obtenerClave() {
  const claveHex = process.env.FIRMA_ENCRYPTION_KEY;
  if (!claveHex) {
    throw new Error('Falta FIRMA_ENCRYPTION_KEY en el entorno — ver .env.example');
  }
  const clave = Buffer.from(claveHex, 'hex');
  if (clave.length !== 32) {
    throw new Error('FIRMA_ENCRYPTION_KEY debe ser 32 bytes en hex (64 caracteres) — generar con: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  }
  return clave;
}

/** Formato de salida: "iv:tag:cifrado", todo en hex — cabe en la misma columna MEDIUMTEXT que antes guardaba el texto plano. */
function cifrar(texto) {
  if (texto == null || texto === '') return null;
  const iv = crypto.randomBytes(12); // GCM: tamaño recomendado
  const cipher = crypto.createCipheriv(ALGORITMO, obtenerClave(), iv);
  const cifrado = Buffer.concat([cipher.update(String(texto), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${cifrado.toString('hex')}`;
}

const FORMATO_CIFRADO = /^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/i;

/**
 * Descifra lo que devolvió cifrar(). Si el valor no tiene el formato "iv:tag:cifrado"
 * (una fila guardada antes de este cambio, en texto plano) se devuelve tal cual —
 * nunca revienta una lectura por eso, ni pisa el dato. Un ':' no es un carácter hex
 * válido, así que un SVG o data URI reales nunca calzan con el patrón por accidente.
 */
function descifrar(valor) {
  if (valor == null || valor === '') return valor;
  if (!FORMATO_CIFRADO.test(valor)) return valor;
  try {
    const [ivHex, tagHex, cifradoHex] = valor.split(':');
    const decipher = crypto.createDecipheriv(ALGORITMO, obtenerClave(), Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    const plano = Buffer.concat([decipher.update(Buffer.from(cifradoHex, 'hex')), decipher.final()]);
    return plano.toString('utf8');
  } catch {
    return valor; // clave rotada o dato corrupto — se devuelve tal cual en vez de perder el dato
  }
}

module.exports = { cifrar, descifrar };
