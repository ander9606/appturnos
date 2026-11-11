// ============================================================================
// Escenas del Reel 05 - Tu equipo listo en minutos
// Define las 5 tomas del guion completo (30 segundos, 30fps)
// ============================================================================

import { POSES, escritorioConCelular } from './poses.js';

export const escenas = [
  // ══════════════════════════════════════════════════════════════════════
  // TOMA 1: Intro — Adiós Excel (0-3s)
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 1,
    tInicio: 0,
    tFin: 3,
    descripcion: "Intro aspiracional — Excel desaparece",

    poseInicio: POSES.presentador,
    poseFin: POSES.presentador, // Pose estática

    textos: [
      {
        texto: 'Tu equipo en minutos',
        x: 720,
        y: 400,
        tInicio: 1.8,
        tFin: 3.0,
        fontSize: 56,
        fontWeight: 800,
        color: '#0F172A',
        duracionEntrada: 0.3,
        duracionSalida: 0.0
      },
      {
        texto: 'Sin Excel. Sin errores.',
        x: 720,
        y: 480,
        tInicio: 2.2,
        tFin: 3.0,
        fontSize: 32,
        fontWeight: 600,
        color: '#64748B',
        duracionEntrada: 0.25,
        duracionSalida: 0.0
      }
    ],

    // Props especiales: Excel caótico + X roja
    propsEspeciales: [
      {
        tipo: 'imagen',
        src: './capturas/excel-chaos.png',
        x: 540,
        y: 500,
        width: 800,
        height: 533,
        tInicio: 0.0,
        tFin: 2.5,
        animacion: {
          // Fade out + scale down
          opacity: { inicio: 1.0, fin: 0.0, tInicioAnim: 1.5 },
          scale: { inicio: 1.0, fin: 0.8, tInicioAnim: 1.5 }
        }
      },
      {
        tipo: 'xRoja',
        x: 540,
        y: 500,
        tInicio: 1.5,
        tFin: 2.5,
        animacion: {
          // X aparece con bounce
          scale: { inicio: 0, fin: 1.0, easing: 'easeOutBack' },
          opacity: { inicio: 0, fin: 1.0 }
        }
      }
    ],

    // Entrada del perro desde la izquierda
    perroAnimacion: {
      x: { inicio: -200, fin: 270, tInicioAnim: 2.0, duracion: 0.5, easing: 'easeOutBack' },
      y: 960
    },

    easing: 'linear'
  },

  // ══════════════════════════════════════════════════════════════════════
  // TOMA 2: Paso 1 — Abre Equipo (3-9s)
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 2,
    tInicio: 3,
    tFin: 9,
    descripcion: "Paso 1 + beneficio — Ya no buscas en 20 hojas",

    poseInicio: POSES.presentador,
    poseFin: escritorioConCelular, // Transición suave a pose en escritorio

    textos: [
      {
        texto: '1. Abre Equipo',
        x: 300,
        y: 600,
        tInicio: 3.5,
        tFin: 9.0,
        fontSize: 48,
        fontWeight: 800,
        color: '#0F172A',
        duracionEntrada: 0.3,
        duracionSalida: 0.0
      },
      {
        texto: '✓ Ya no buscas en 20 hojas',
        x: 300,
        y: 670,
        tInicio: 5.0,
        tFin: 9.0,
        fontSize: 28,
        fontWeight: 600,
        color: '#10B981',
        duracionEntrada: 0.25,
        duracionSalida: 0.0
      }
    ],

    // Celular con pantalla de Equipo
    propsEspeciales: [
      {
        tipo: 'phone',
        captura: './capturas/captura-a-equipo.png',
        x: 680,
        y: 960,
        tInicio: 3.5,
        tFin: 9.0,
        animacion: {
          // Slide up desde abajo con bounce
          y: { inicio: 1400, fin: 960, easing: 'easeOutBack' }
        }
      },
      {
        tipo: 'tapIndicator',
        x: 680,
        y: 820, // Sobre la pestaña "Equipo"
        tInicio: 5.5,
        duracion: 0.3
      },
      {
        tipo: 'brilloLimpieza',
        x: 680,
        y: 700,
        tInicio: 6.5,
        duracion: 0.5
      }
    ],

    perroAnimacion: {
      x: 270,
      y: 960
    },

    easing: 'easeOutBack'
  },

  // ══════════════════════════════════════════════════════════════════════
  // TOMA 3: Paso 2 — Completa datos (9-16s)
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 3,
    tInicio: 9,
    tFin: 16,
    descripcion: "Paso 2 + beneficio — Todo se valida automáticamente",

    poseInicio: escritorioConCelular,
    poseFin: POSES.escribiendo, // Transición a pose escribiendo

    textos: [
      {
        texto: '2. Completa los datos',
        x: 300,
        y: 600,
        tInicio: 9.5,
        tFin: 16.0,
        fontSize: 48,
        fontWeight: 800,
        color: '#0F172A',
        duracionEntrada: 0.3,
        duracionSalida: 0.0
      },
      {
        texto: '✓ Todo se valida automáticamente',
        x: 300,
        y: 670,
        tInicio: 11.5,
        tFin: 16.0,
        fontSize: 28,
        fontWeight: 600,
        color: '#10B981',
        duracionEntrada: 0.25,
        duracionSalida: 0.0
      }
    ],

    // Celular con formulario paso 1
    propsEspeciales: [
      {
        tipo: 'phone',
        captura: './capturas/captura-b-formulario1.png',
        x: 680,
        y: 960,
        tInicio: 9.0,
        tFin: 16.0,
        animacion: {
          // Transición desde pantalla anterior (slide left)
          tipo: 'slideTransition',
          desde: './capturas/captura-a-equipo.png',
          duracion: 0.3
        }
      },
      // Checkmarks aparecen progresivamente
      {
        tipo: 'checkmark',
        x: 760,
        y: 880, // Campo Nombre
        tInicio: 11.0,
        scale: { inicio: 0, fin: 1.0, easing: 'easeOutBack', duracion: 0.3 }
      },
      {
        tipo: 'checkmark',
        x: 760,
        y: 940, // Campo Apellido
        tInicio: 12.2,
        scale: { inicio: 0, fin: 1.0, easing: 'easeOutBack', duracion: 0.3 }
      },
      {
        tipo: 'checkmark',
        x: 760,
        y: 1000, // Chip Nómina
        tInicio: 13.0,
        scale: { inicio: 0, fin: 1.0, easing: 'easeOutBack', duracion: 0.3 }
      },
      {
        tipo: 'checkmark',
        x: 760,
        y: 1080, // Campo Cédula
        tInicio: 14.5,
        scale: { inicio: 0, fin: 1.0, easing: 'easeOutBack', duracion: 0.3 }
      },
      // Barra de progreso se llena
      {
        tipo: 'progressBar',
        paso: 1,
        totalPasos: 3,
        tInicio: 14.5,
        duracion: 0.4
      }
    ],

    perroAnimacion: {
      x: 270,
      y: 960
    },

    easing: 'easeInOut'
  },

  // ══════════════════════════════════════════════════════════════════════
  // TOMA 4: Paso 3 — Salario y banco (16-23s)
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 4,
    tInicio: 16,
    tFin: 23,
    descripcion: "Paso 3 + beneficio — Listo para la nómina",

    poseInicio: POSES.escribiendo,
    poseFin: POSES.revisandoNumeros, // Transición a revisar números

    textos: [
      {
        texto: '3. Agrega salario y banco',
        x: 300,
        y: 600,
        tInicio: 16.5,
        tFin: 23.0,
        fontSize: 48,
        fontWeight: 800,
        color: '#0F172A',
        duracionEntrada: 0.3,
        duracionSalida: 0.0
      },
      {
        texto: '💰 Listo para la nómina',
        x: 300,
        y: 670,
        tInicio: 19.0,
        tFin: 23.0,
        fontSize: 28,
        fontWeight: 600,
        color: '#6366F1',
        duracionEntrada: 0.25,
        duracionSalida: 0.0
      }
    ],

    // Celular con formulario paso 2
    propsEspeciales: [
      {
        tipo: 'phone',
        captura: './capturas/captura-c-formulario2.png',
        x: 680,
        y: 960,
        tInicio: 16.0,
        tFin: 23.0,
        animacion: {
          tipo: 'slideTransition',
          desde: './capturas/captura-b-formulario1.png',
          duracion: 0.3
        }
      },
      // Checkmarks en campos de pago
      {
        tipo: 'checkmark',
        x: 760,
        y: 880, // Salario
        tInicio: 18.5,
        scale: { inicio: 0, fin: 1.0, easing: 'easeOutBack', duracion: 0.3 }
      },
      {
        tipo: 'checkmark',
        x: 760,
        y: 950, // EPS
        tInicio: 19.5,
        scale: { inicio: 0, fin: 1.0, easing: 'easeOutBack', duracion: 0.3 }
      },
      {
        tipo: 'checkmark',
        x: 760,
        y: 1010, // Banco
        tInicio: 20.5,
        scale: { inicio: 0, fin: 1.0, easing: 'easeOutBack', duracion: 0.3 }
      },
      {
        tipo: 'checkmark',
        x: 760,
        y: 1070, // Cuenta
        tInicio: 21.5,
        scale: { inicio: 0, fin: 1.0, easing: 'easeOutBack', duracion: 0.3 }
      },
      // Efecto de integración con nómina
      {
        tipo: 'lineaConexion',
        desde: { x: 680, y: 1100 },
        hasta: { x: 680, y: 1200 },
        tInicio: 21.5,
        duracion: 0.6,
        color: '#10B981'
      },
      {
        tipo: 'iconoNomina',
        x: 680,
        y: 1220,
        tInicio: 22.0,
        scale: { inicio: 0, fin: 1.0, easing: 'easeOutBack', duracion: 0.3 }
      },
      // Barra de progreso paso 2
      {
        tipo: 'progressBar',
        paso: 2,
        totalPasos: 3,
        tInicio: 21.5,
        duracion: 0.4
      }
    ],

    perroAnimacion: {
      x: 270,
      y: 960
    },

    easing: 'easeInOut'
  },

  // ══════════════════════════════════════════════════════════════════════
  // TOMA 5: Completado + Cierre (23-30s)
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 5,
    tInicio: 23,
    tFin: 30,
    descripcion: "Éxito + avatares múltiples + CTA",

    poseInicio: POSES.revisandoNumeros,
    poseFin: POSES.exito, // Transición a celebración

    textos: [
      {
        texto: '¡Listo en 3 minutos!',
        x: 540,
        y: 500,
        tInicio: 23.5,
        tFin: 28.0,
        fontSize: 64,
        fontWeight: 800,
        color: '#10B981',
        duracionEntrada: 0.5,
        duracionSalida: 0.3
      },
      {
        texto: 'Cada uno con su acceso propio',
        x: 540,
        y: 600,
        tInicio: 25.0,
        tFin: 28.0,
        fontSize: 32,
        fontWeight: 600,
        color: '#64748B',
        duracionEntrada: 0.3,
        duracionSalida: 0.3
      },
      {
        texto: 'Pruébalo gratis',
        x: 540,
        y: 1500,
        tInicio: 28.0,
        tFin: 30.0,
        fontSize: 40,
        fontWeight: 700,
        color: '#6366F1',
        duracionEntrada: 0.3,
        duracionSalida: 0.0
      },
      {
        texto: 'Link en bio ↑',
        x: 540,
        y: 1560,
        tInicio: 28.0,
        tFin: 30.0,
        fontSize: 40,
        fontWeight: 700,
        color: '#6366F1',
        duracionEntrada: 0.3,
        duracionSalida: 0.0
      },
      {
        texto: '@zaturno.app',
        x: 540,
        y: 1650,
        tInicio: 28.5,
        tFin: 30.0,
        fontSize: 24,
        fontWeight: 600,
        color: '#64748B',
        duracionEntrada: 0.2,
        duracionSalida: 0.0
      }
    ],

    // Pantalla de éxito + checkmark gigante + confetti
    propsEspeciales: [
      {
        tipo: 'phone',
        captura: './capturas/captura-d-exito.png',
        x: 540,
        y: 960,
        tInicio: 23.0,
        tFin: 28.0,
        animacion: {
          tipo: 'zoomIn',
          desde: './capturas/captura-c-formulario2.png',
          duracion: 0.4,
          scale: { inicio: 0.8, fin: 1.0, easing: 'easeOutBack' }
        }
      },
      // Checkmark gigante
      {
        tipo: 'checkmarkGigante',
        x: 540,
        y: 800,
        tInicio: 24.0,
        duracionDibujo: 0.8,
        scale: { inicio: 0.5, fin: 1.0, easing: 'easeOutBack' }
      },
      // Confetti
      {
        tipo: 'confetti',
        cantidad: 12,
        tInicio: 24.5,
        duracion: 2.5,
        colores: ['#6366F1', '#10B981', '#F59E0B', '#EF4444']
      },
      // Avatares múltiples
      {
        tipo: 'avatares',
        avatares: [
          { inicial: 'M', color: '#6366F1', tInicio: 26.0 },
          { inicial: 'J', color: '#10B981', tInicio: 26.15 },
          { inicial: 'C', color: '#8B5CF6', tInicio: 26.30, brillo: true }, // Recién creado
          { inicial: '+', color: '#CBD5E1', tInicio: 26.45 }
        ],
        y: 1150
      }
    ],

    // Perro salta a pose de celebración
    perroAnimacion: {
      x: 270,
      y: { inicio: 960, fin: 952, tInicioAnim: 23.0, duracion: 0.2, easing: 'easeOut' }, // Pequeño salto
      transicionPose: {
        tipo: 'jump',
        anticipacion: 0.1,
        duracion: 0.4
      }
    },

    easing: 'easeOutBack'
  }
];

// ══════════════════════════════════════════════════════════════════════
// Metadata del reel
// ══════════════════════════════════════════════════════════════════════
export const metadata = {
  titulo: 'Tu equipo listo en minutos',
  duracion: 30, // segundos
  fps: 30,
  resolucion: { width: 1080, height: 1920 },
  voz: {
    idioma: 'es-CO',
    estilo: 'tranquila',
    frases: 5
  },
  tono: 'aspiracional',
  contraste: {
    antes: 'Excel caótico, lento, errores',
    despues: 'Zaturno, 3 minutos, validación automática'
  }
};
