// ============================================================================
// Funciones de easing para animaciones suaves
// Basado en las ecuaciones de Robert Penner (easing functions)
// ============================================================================

export function linear(t) {
  return t;
}

export function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

export function easeOut(t) {
  return 1 - (1 - t) * (1 - t);
}

export function easeIn(t) {
  return t * t;
}

// Rebote al final - ideal para elementos que "llegan"
export function easeOutBack(t) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

// Rebote al inicio - ideal para "anticipación"
export function easeInBack(t) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return c3 * t * t * t - c1 * t * t;
}

// Rebote entrada y salida
export function easeInOutBack(t) {
  const c1 = 1.70158;
  const c2 = c1 * 1.525;
  return t < 0.5
    ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
    : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;
}

// Elástico - rebote más pronunciado
export function easeOutElastic(t) {
  const c4 = (2 * Math.PI) / 3;
  return t === 0
    ? 0
    : t === 1
    ? 1
    : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
}

// Bounce - rebotes múltiples
export function easeOutBounce(t) {
  const n1 = 7.5625;
  const d1 = 2.75;

  if (t < 1 / d1) {
    return n1 * t * t;
  } else if (t < 2 / d1) {
    return n1 * (t -= 1.5 / d1) * t + 0.75;
  } else if (t < 2.5 / d1) {
    return n1 * (t -= 2.25 / d1) * t + 0.9375;
  } else {
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  }
}

// Obtener función de easing por nombre
export function getEasing(name) {
  const easings = {
    linear,
    easeInOut,
    easeOut,
    easeIn,
    easeOutBack,
    easeInBack,
    easeInOutBack,
    easeOutElastic,
    easeOutBounce
  };
  return easings[name] || linear;
}
