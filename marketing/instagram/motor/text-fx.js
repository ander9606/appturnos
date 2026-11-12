// ============================================================================
// Efectos de texto animado para los reels
// ============================================================================

import { easeOutBack } from './easing.js';

// Importar paleta de colores del personaje
const C = {
  INK: '#0F172A',
  NARANJA: '#FF5A3C',
  AMARILLO: '#FDE047',
  BLANCO: '#F8FAFC'
};

/**
 * Genera un texto animado con efectos de entrada/salida
 * @param {string} texto - El texto a mostrar
 * @param {number} x - Posición X (centro)
 * @param {number} y - Posición Y (baseline)
 * @param {object} opciones - Opciones de estilo y animación
 */
export function textoAnimado(texto, x, y, opciones = {}) {
  const {
    fontSize = 48,
    fontWeight = 800,
    color = C.INK,
    entrando = false,    // false, o número 0-1 para progreso de entrada
    saliendo = false,    // false, o número 0-1 para progreso de salida
    estiloZaturno = false,  // Estilo especial para la voz del espacio
    maxWidth = null,     // Ancho máximo antes de dividir en líneas
    align = 'middle'     // 'start', 'middle', 'end'
  } = opciones;

  let opacity = 1;
  let scale = 1;
  let blur = 0;

  // Animación de entrada
  if (entrando !== false) {
    const t = easeOutBack(entrando);
    scale = 0.3 + t * 0.7;
    opacity = t;
  }

  // Animación de salida
  if (saliendo !== false) {
    opacity = 1 - saliendo;
    scale = 1 - saliendo * 0.3;
  }

  // Estilo especial para Zaturno (voz del espacio)
  let extras = '';
  if (estiloZaturno) {
    // Brillo dorado alrededor
    const brillo = entrando !== false ? easeOutBack(entrando) : 1;
    extras = `
      <text x="${x}" y="${y}"
            font-size="${fontSize}"
            font-weight="${fontWeight}"
            fill="${C.AMARILLO}"
            text-anchor="${align}"
            font-family="Inter,Arial,sans-serif"
            opacity="${brillo * 0.6}"
            filter="url(#glow)">
        ${escapeHtml(texto)}
      </text>`;
  }

  // Dividir en líneas si hay maxWidth
  const lineas = maxWidth ? dividirEnLineas(texto, maxWidth, fontSize) : [texto];
  const lineHeight = fontSize * 1.2;
  const offsetY = -((lineas.length - 1) * lineHeight) / 2;

  const textoSVG = lineas.map((linea, i) => `
    <text x="${x}"
          y="${y + offsetY + i * lineHeight}"
          font-size="${fontSize}"
          font-weight="${fontWeight}"
          fill="${color}"
          text-anchor="${align}"
          font-family="Inter,Arial,sans-serif">
      ${escapeHtml(linea)}
    </text>
  `).join('');

  return `
    <defs>
      <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
        <feMerge>
          <feMergeNode in="coloredBlur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>
    <g transform="translate(0 0) scale(${scale})"
       transform-origin="${x} ${y}"
       opacity="${opacity}">
      ${extras}
      ${textoSVG}
    </g>
  `;
}

/**
 * Texto con efecto de escritura progresiva
 */
export function textoEscritura(texto, x, y, progreso, opciones = {}) {
  const {
    fontSize = 48,
    fontWeight = 800,
    color = C.INK,
    align = 'middle'
  } = opciones;

  const caracteresVisibles = Math.floor(texto.length * progreso);
  const textoVisible = texto.substring(0, caracteresVisibles);

  return `
    <text x="${x}" y="${y}"
          font-size="${fontSize}"
          font-weight="${fontWeight}"
          fill="${color}"
          text-anchor="${align}"
          font-family="Inter,Arial,sans-serif">
      ${escapeHtml(textoVisible)}
    </text>
  `;
}

/**
 * Texto multilínea centrado
 */
export function textoMultilinea(lineas, x, y, opciones = {}) {
  const {
    fontSize = 48,
    fontWeight = 800,
    color = C.INK,
    lineHeight = fontSize * 1.3,
    align = 'middle',
    entrando = false,
    saliendo = false
  } = opciones;

  let opacity = 1;
  let scale = 1;

  if (entrando !== false) {
    const t = easeOutBack(entrando);
    scale = 0.3 + t * 0.7;
    opacity = t;
  }

  if (saliendo !== false) {
    opacity = 1 - saliendo;
  }

  const offsetY = -((lineas.length - 1) * lineHeight) / 2;

  const textoSVG = lineas.map((linea, i) => `
    <text x="${x}"
          y="${y + offsetY + i * lineHeight}"
          font-size="${fontSize}"
          font-weight="${fontWeight}"
          fill="${color}"
          text-anchor="${align}"
          font-family="Inter,Arial,sans-serif">
      ${escapeHtml(linea)}
    </text>
  `).join('');

  return `
    <g transform="translate(0 0) scale(${scale})"
       transform-origin="${x} ${y}"
       opacity="${opacity}">
      ${textoSVG}
    </g>
  `;
}

/**
 * Dividir texto en líneas según ancho máximo (estimado)
 */
function dividirEnLineas(texto, maxWidth, fontSize) {
  // Estimación aproximada: cada carácter ocupa ~0.6 del fontSize
  const charsPorLinea = Math.floor(maxWidth / (fontSize * 0.6));

  const palabras = texto.split(' ');
  const lineas = [];
  let lineaActual = '';

  for (const palabra of palabras) {
    const prueba = lineaActual ? `${lineaActual} ${palabra}` : palabra;
    if (prueba.length <= charsPorLinea) {
      lineaActual = prueba;
    } else {
      if (lineaActual) lineas.push(lineaActual);
      lineaActual = palabra;
    }
  }
  if (lineaActual) lineas.push(lineaActual);

  return lineas;
}

/**
 * Escapar HTML en texto
 */
function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
