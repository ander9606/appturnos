'use strict';

const MAX_SIN_ACORTAR = 45; // hasta aquí una dirección cabe en una línea de tarjeta o de PDF: se deja igual
const MAX_CORTO = 60;

/**
 * Lugar para los espacios chicos (tarjetas, líneas del PDF de la cuenta de cobro). Si el turno tiene nombre corto
 * (`lugar_alias`), ese. Si no, la dirección tal cual cuando ya es corta, o sus dos primeras partes cuando es la dirección
 * larga de un buscador ("Corferias, Carrera 37, Quinta Paredes, ..., Colombia" → "Corferias, Carrera 37").
 * Las partes que son solo un número ("24, Carrera 37…") se saltan. El contrato y el mapa usan la dirección completa.
 */
function lugarCorto(lugar, alias = null) {
  const a = typeof alias === 'string' ? alias.trim() : '';
  if (a) return a;
  const completo = typeof lugar === 'string' ? lugar.trim() : '';
  if (!completo) return null;
  if (completo.length <= MAX_SIN_ACORTAR) return completo;
  const partes = completo.split(',').map((p) => p.trim()).filter(Boolean);
  const utiles = partes.filter((p) => !/^\d+$/.test(p));
  const corto = (utiles.length ? utiles : partes).slice(0, 2).join(', ');
  return corto.length > MAX_CORTO ? `${corto.slice(0, MAX_CORTO - 1).trimEnd()}…` : corto;
}

module.exports = { lugarCorto };
