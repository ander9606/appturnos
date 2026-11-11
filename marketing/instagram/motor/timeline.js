// ============================================================================
// Motor de línea de tiempo - interpola entre poses y gestiona animaciones
// ============================================================================

import { getEasing } from './easing.js';

export class Timeline {
  constructor(fps = 30) {
    this.escenas = [];
    this.fps = fps;
    this.duracion = 0;
  }

  // Agregar una escena a la línea de tiempo
  addScene(escena) {
    this.escenas.push(escena);
    this.duracion = Math.max(this.duracion, escena.tFin);
  }

  // Encontrar la escena activa en un tiempo t
  encontrarEscena(t) {
    return this.escenas.find(esc => t >= esc.tInicio && t <= esc.tFin);
  }

  // Obtener todas las escenas que se superponen con el tiempo t
  getEscenasActivas(t) {
    return this.escenas.filter(esc => t >= esc.tInicio && t <= esc.tFin);
  }

  // Calcular el progreso (0-1) dentro de una escena
  getProgreso(escena, t) {
    const duracion = escena.tFin - escena.tInicio;
    if (duracion === 0) return 1;
    return Math.max(0, Math.min(1, (t - escena.tInicio) / duracion));
  }

  // Interpolar entre dos valores numéricos
  lerp(a, b, t) {
    return a + (b - a) * t;
  }

  // Interpolar recursivamente entre dos objetos/arrays
  interpolarValor(v1, v2, t) {
    // Si uno de los dos es undefined o null, retornar el otro
    if (v1 === undefined || v1 === null) return v2;
    if (v2 === undefined || v2 === null) return v1;

    // Números
    if (typeof v1 === 'number' && typeof v2 === 'number') {
      return this.lerp(v1, v2, t);
    }

    // Arrays
    if (Array.isArray(v1) && Array.isArray(v2)) {
      const maxLen = Math.max(v1.length, v2.length);
      const resultado = [];
      for (let i = 0; i < maxLen; i++) {
        const val1 = i < v1.length ? v1[i] : v2[i];
        const val2 = i < v2.length ? v2[i] : v1[i];
        resultado.push(this.interpolarValor(val1, val2, t));
      }
      return resultado;
    }

    // Objetos
    if (typeof v1 === 'object' && typeof v2 === 'object' && !Array.isArray(v1) && !Array.isArray(v2)) {
      const resultado = {};
      const keys = new Set([...Object.keys(v1), ...Object.keys(v2)]);
      for (const key of keys) {
        resultado[key] = this.interpolarValor(v1[key], v2[key], t);
      }
      return resultado;
    }

    // Otros tipos (strings, booleans, etc.) - usar valor de destino si t > 0.5
    return t < 0.5 ? v1 : v2;
  }

  // Interpolar entre dos poses del perro
  interpolarPose(poseInicio, poseFin, t) {
    if (!poseInicio && !poseFin) return {};
    if (!poseInicio) return poseFin;
    if (!poseFin) return poseInicio;

    return this.interpolarValor(poseInicio, poseFin, t);
  }

  // Obtener el estado completo en un tiempo t
  getFrameAt(t) {
    const escenasActivas = this.getEscenasActivas(t);

    if (escenasActivas.length === 0) {
      return {
        tiempo: t,
        pose: {},
        textos: [],
        propsExtra: []
      };
    }

    // Por simplicidad, tomar la última escena activa como principal
    const escenaPrincipal = escenasActivas[escenasActivas.length - 1];
    const progreso = this.getProgreso(escenaPrincipal, t);

    // Aplicar easing
    const easingFn = getEasing(escenaPrincipal.easing || 'linear');
    const progresoEased = easingFn(progreso);

    // Interpolar pose
    const pose = this.interpolarPose(
      escenaPrincipal.poseInicio,
      escenaPrincipal.poseFin,
      progresoEased
    );

    // Procesar textos con animaciones
    const textos = [];
    if (escenaPrincipal.textos) {
      for (const texto of escenaPrincipal.textos) {
        const tInicio = texto.tInicio ?? escenaPrincipal.tInicio;
        const tFin = texto.tFin ?? escenaPrincipal.tFin;
        const duracionEntrada = texto.duracionEntrada ?? 0.3;
        const duracionSalida = texto.duracionSalida ?? 0.3;

        let estado = {};

        // Animación de entrada
        if (t >= tInicio && t < tInicio + duracionEntrada) {
          const progresoEntrada = (t - tInicio) / duracionEntrada;
          estado.entrando = progresoEntrada;
        }
        // Visible
        else if (t >= tInicio + duracionEntrada && t < tFin - duracionSalida) {
          estado.entrando = false;
          estado.saliendo = false;
        }
        // Animación de salida
        else if (t >= tFin - duracionSalida && t <= tFin) {
          const progresoSalida = (t - (tFin - duracionSalida)) / duracionSalida;
          estado.saliendo = progresoSalida;
        }
        // Fuera de rango
        else {
          continue; // No mostrar
        }

        textos.push({ ...texto, ...estado });
      }
    }

    // Procesar props extra con animaciones de aparición
    const propsExtra = [];
    if (escenaPrincipal.propsExtra) {
      for (const prop of escenaPrincipal.propsExtra) {
        const tInicio = prop.tInicio ?? escenaPrincipal.tInicio;
        const duracionEntrada = prop.duracionEntrada ?? 0.4;

        if (t < tInicio) continue; // Aún no aparece

        let estado = {};
        if (t >= tInicio && t < tInicio + duracionEntrada) {
          const progresoEntrada = (t - tInicio) / duracionEntrada;
          estado.entrando = progresoEntrada;
        } else {
          estado.entrando = false;
        }

        propsExtra.push({ ...prop, ...estado });
      }
    }

    return {
      tiempo: t,
      escena: escenaPrincipal,
      pose,
      textos,
      propsExtra
    };
  }
}
