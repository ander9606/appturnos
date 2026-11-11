// ============================================================================
// Componente de marco de celular para mostrar capturas de la app
// ============================================================================

import { easeOutBack } from './easing.js';

/**
 * Genera un marco de celular con una captura de pantalla dentro
 * @param {number} x - Posición X del centro
 * @param {number} y - Posición Y del centro
 * @param {string} imagenPath - Ruta a la imagen de captura
 * @param {object} opciones - Opciones de tamaño y animación
 */
export function marcoPhone(x, y, imagenPath, opciones = {}) {
  const {
    ancho = 300,
    alto = 600,
    entrando = false,  // false, o número 0-1 para animación desde abajo
    rotacion = 0,
    escala = 1
  } = opciones;

  let dy = 0;
  let opacity = 1;
  let currentScale = escala;

  if (entrando !== false) {
    // Sube desde abajo con rebote
    const t = easeOutBack(entrando);
    dy = (1 - t) * 200;
    opacity = t;
    currentScale = escala * (0.5 + t * 0.5);
  }

  const marcoAncho = ancho + 40;
  const marcoAlto = alto + 80;

  return `
    <g transform="translate(${x} ${y + dy}) rotate(${rotacion}) scale(${currentScale})"
       opacity="${opacity}">

      <!-- Sombra del celular -->
      <ellipse cx="0" cy="${marcoAlto / 2 + 20}"
               rx="${marcoAncho / 2}"
               ry="15"
               fill="#000"
               opacity="0.15"/>

      <!-- Cuerpo del celular -->
      <rect x="${-marcoAncho / 2}"
            y="${-marcoAlto / 2}"
            width="${marcoAncho}"
            height="${marcoAlto}"
            rx="30"
            fill="#1E293B"
            stroke="#0F172A"
            stroke-width="2"/>

      <!-- Pantalla -->
      <clipPath id="screen-clip-${imagenPath.replace(/[^a-z0-9]/gi, '')}">
        <rect x="${-ancho / 2}"
              y="${-alto / 2}"
              width="${ancho}"
              height="${alto}"
              rx="20"/>
      </clipPath>

      <rect x="${-ancho / 2}"
            y="${-alto / 2}"
            width="${ancho}"
            height="${alto}"
            rx="20"
            fill="#E2E8F0"/>

      <!-- Imagen de la captura -->
      <image href="${imagenPath}"
             x="${-ancho / 2}"
             y="${-alto / 2}"
             width="${ancho}"
             height="${alto}"
             preserveAspectRatio="xMidYMid slice"
             clip-path="url(#screen-clip-${imagenPath.replace(/[^a-z0-9]/gi, '')})"/>

      <!-- Notch superior (muesca) -->
      <rect x="-60"
            y="${-alto / 2 - 30}"
            width="120"
            height="25"
            rx="12"
            fill="#0F172A"/>

      <!-- Botón lateral -->
      <rect x="${marcoAncho / 2 + 1}"
            y="-80"
            width="4"
            height="40"
            rx="2"
            fill="#0F172A"/>

      <!-- Botones de volumen -->
      <rect x="${-marcoAncho / 2 - 5}"
            y="-100"
            width="4"
            height="30"
            rx="2"
            fill="#0F172A"/>
      <rect x="${-marcoAncho / 2 - 5}"
            y="-60"
            width="4"
            height="30"
            rx="2"
            fill="#0F172A"/>
    </g>
  `;
}

/**
 * Marco de celular en posición de mano (con mano simplificada)
 */
export function marcoPhoneEnMano(x, y, imagenPath, opciones = {}) {
  const {
    ancho = 300,
    alto = 600,
    entrando = false,
    rotacion = -10,  // Ligera inclinación por defecto
    escala = 1,
    colorMano = '#C2813F'  // Canela, igual que las patas del perro
  } = opciones;

  const marco = marcoPhone(x, y - 50, imagenPath, {
    ancho,
    alto,
    entrando,
    rotacion,
    escala
  });

  let opacity = 1;
  if (entrando !== false) {
    opacity = easeOutBack(entrando);
  }

  // Mano simplificada sosteniendo el celular
  const mano = `
    <g opacity="${opacity}">
      <!-- Pulgar -->
      <ellipse cx="${x - ancho / 2 - 30}"
               cy="${y - 100}"
               rx="25"
               ry="35"
               fill="${colorMano}"
               transform="rotate(-20 ${x - ancho / 2 - 30} ${y - 100})"/>

      <!-- Palma -->
      <rect x="${x - ancho / 2 - 40}"
            y="${y + alto / 2 - 100}"
            width="80"
            height="120"
            rx="20"
            fill="${colorMano}"
            opacity="0.9"/>

      <!-- Dedos traseros (simplificados) -->
      <ellipse cx="${x + ancho / 2 + 20}"
               cy="${y - 50}"
               rx="15"
               ry="40"
               fill="${colorMano}"
               opacity="0.85"/>
      <ellipse cx="${x + ancho / 2 + 20}"
               cy="${y + 30}"
               rx="15"
               ry="35"
               fill="${colorMano}"
               opacity="0.85"/>
    </g>
  `;

  return mano + marco;
}

/**
 * Tablet horizontal (para capturas web más grandes)
 */
export function marcoTablet(x, y, imagenPath, opciones = {}) {
  const {
    ancho = 800,
    alto = 500,
    entrando = false,
    rotacion = 0,
    escala = 1
  } = opciones;

  let dy = 0;
  let opacity = 1;
  let currentScale = escala;

  if (entrando !== false) {
    const t = easeOutBack(entrando);
    dy = (1 - t) * 200;
    opacity = t;
    currentScale = escala * (0.5 + t * 0.5);
  }

  const marcoAncho = ancho + 60;
  const marcoAlto = alto + 60;

  return `
    <g transform="translate(${x} ${y + dy}) rotate(${rotacion}) scale(${currentScale})"
       opacity="${opacity}">

      <!-- Sombra -->
      <rect x="${-marcoAncho / 2 - 10}"
            y="${-marcoAlto / 2 + 10}"
            width="${marcoAncho + 20}"
            height="${marcoAlto + 20}"
            rx="25"
            fill="#000"
            opacity="0.1"/>

      <!-- Cuerpo de la tablet -->
      <rect x="${-marcoAncho / 2}"
            y="${-marcoAlto / 2}"
            width="${marcoAncho}"
            height="${marcoAlto}"
            rx="20"
            fill="#1E293B"
            stroke="#0F172A"
            stroke-width="2"/>

      <!-- Pantalla -->
      <clipPath id="tablet-clip-${imagenPath.replace(/[^a-z0-9]/gi, '')}">
        <rect x="${-ancho / 2}"
              y="${-alto / 2}"
              width="${ancho}"
              height="${alto}"
              rx="10"/>
      </clipPath>

      <rect x="${-ancho / 2}"
            y="${-alto / 2}"
            width="${ancho}"
            height="${alto}"
            rx="10"
            fill="#E2E8F0"/>

      <!-- Imagen -->
      <image href="${imagenPath}"
             x="${-ancho / 2}"
             y="${-alto / 2}"
             width="${ancho}"
             height="${alto}"
             preserveAspectRatio="xMidYMid slice"
             clip-path="url(#tablet-clip-${imagenPath.replace(/[^a-z0-9]/gi, '')})"/>

      <!-- Cámara frontal -->
      <circle cx="0"
              cy="${-alto / 2 - 20}"
              r="4"
              fill="#334155"/>
    </g>
  `;
}
