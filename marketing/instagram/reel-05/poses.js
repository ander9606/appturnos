// ============================================================================
// Poses específicas para Reel 05 - Tu equipo listo en minutos
// ============================================================================

// Importar objetos props desde perro.js
import { P } from '../personaje/perro.js';

export const POSES = {
  // ── Pose 1: Presentador (pata señalando hacia adelante) ─────────────────
  presentador: {
    boca: 'sonrisa',
    ojos: { px: 2, py: 0 }, // Mirando al frente/ligeramente a cámara
    brazoI: [-60, 32, -24, 54], // Brazo izquierdo relajado abajo
    brazoD: [98, -16, 112, -8], // Brazo derecho extendido señalando →
    props: P.interrogacion(120, -20, 0, 0.8) // Pequeño énfasis
  },

  // ── Pose 2: En el escritorio (pose que ya existe, reutilizada) ──────────
  escritorio: {
    boca: 'sonrisa',
    ojos: { px: 8, py: 4 }, // Mirando al celular (derecha-abajo)
    brazoI: [-66, 28, -17, 16],
    brazoD: [66, 28, 17, 16],
    propsAtras: P.escritorio(110, 100) // Mesa de escritorio
  },

  // ── Pose 3: Escribiendo (con lápiz, concentrado) ────────────────────────
  escribiendo: {
    boca: 'pensativa', // Concentrado
    ojos: { px: 0, py: 6 }, // Mirando hacia abajo (al papel/celular)
    cejas: -8, // Cejas ligeramente fruncidas (concentración)
    brazoI: [-52, 44, -12, 36], // Brazo izquierdo sosteniendo algo
    brazoD: [74, 26, 28, 18], // Brazo derecho con lápiz
    props: `
      <g transform="translate(28 18)">
        <!-- Lápiz en la pata derecha -->
        <rect x="-2" y="-28" width="4" height="36" fill="#F59E0B" rx="2"/>
        <polygon points="0,-30 -3,-34 3,-34" fill="#0F172A"/>
        <rect x="-2" y="6" width="4" height="6" fill="#CBD5E1"/>
      </g>
      <!-- Papel/notas debajo -->
      <g transform="translate(-12 40)">
        <rect x="-18" y="-12" width="36" height="24" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="2" rx="3"/>
        <path d="M-12 -6 h24 M-12 0 h24 M-12 6 h16" stroke="#CBD5E1" stroke-width="2" stroke-linecap="round"/>
      </g>
    `
  },

  // ── Pose 4: Revisando números (mirando con atención) ────────────────────
  revisandoNumeros: {
    boca: 'ladeada', // Expresión de "interesante"
    ojos: { px: 6, py: 2 }, // Mirando al celular con atención
    cejas: 4, // Cejas levemente levantadas
    brazoI: [-58, 36, -22, 44], // Brazo izquierdo apoyado
    brazoD: [68, 34, 22, 48], // Brazo derecho apuntando/señalando
    props: P.calculadora(24, 52) // Pequeña calculadora visible
  },

  // ── Pose 5: Éxito/Celebra (brazos arriba en V) ──────────────────────────
  exito: {
    boca: 'risa', // Sonrisa amplia
    ojos: { feliz: true }, // Ojos cerrados felices (forma de arco)
    cejas: 12, // Cejas bien arriba (emoción)
    brazoI: [-96, -22, -64, -94], // Brazo izquierdo arriba en V
    brazoD: [96, -22, 64, -94], // Brazo derecho arriba en V
    cuerpo: { dy: -8 }, // Cuerpo ligeramente elevado (salto de alegría)
    props: [
      P.brillo(-80, -120, 1.2), // Brillos alrededor
      P.brillo(80, -120, 1.2),
      P.brillo(-40, -140, 0.8),
      P.brillo(40, -140, 0.8)
    ].join('')
  },

  // ── Pose 6: Saluda (agitando la pata) ───────────────────────────────────
  saluda: {
    boca: 'sonrisa',
    ojos: { px: 0, py: -2 }, // Mirando al frente/ligeramente arriba
    brazoI: [-66, 28, -17, 16], // Brazo izquierdo relajado
    brazoD: [82, -8, 48, -52], // Brazo derecho arriba agitando
    // Nota: la animación del agite se hará en escenas.js con interpolación
  }
};

// ── Variaciones de poses para interpolación ─────────────────────────────

// Escritorio con celular visible (para toma 2)
export const escritorioConCelular = {
  ...POSES.escritorio,
  propsFrente: P.celular(80, 30, -8) // Celular en la mesa
};

// Escribiendo con efecto de "typing" (para animación)
export const escribiendoActivo = {
  ...POSES.escribiendo,
  brazoD: [76, 24, 30, 16], // Ligero movimiento del brazo con lápiz
};

// Saluda variante (pata en posición alta del agite)
export const saludaAlto = {
  ...POSES.saluda,
  brazoD: [86, -12, 52, -60], // Pata en posición alta del agite
};

// Saluda variante (pata en posición baja del agite)
export const saludaBajo = {
  ...POSES.saluda,
  brazoD: [78, -4, 44, -44], // Pata en posición baja del agite
};
