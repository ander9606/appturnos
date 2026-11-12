/**
 * Sugerencia de nombre corto para una dirección larga de buscador o GPS: su primera parte que no sea solo un número
 * ("Corferias, Carrera 37, Quinta Paredes, ..." → "Corferias"). null si no hay nada que acortar (la dirección es una
 * sola parte) o la parte no cabe en los 80 caracteres del campo. Espejo de la lógica del móvil.
 */
export function sugerirAlias(lugar: string): string | null {
  const partes = lugar.split(',').map(p => p.trim()).filter(Boolean);
  const primera = partes.find(p => !/^\d+$/.test(p));
  if (!primera || partes.length < 2 || primera.length > 80) return null;
  return primera;
}
