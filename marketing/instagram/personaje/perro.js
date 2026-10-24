// ============================================================================
// El perro de Zaturno — pieza reutilizable.
// Idea central: perro(pose) recibe un objeto de DATOS y devuelve el dibujo (SVG).
// Animar = cambiar esos datos poco a poco. Aqui no hay nada "pegado" a una pose.
// ============================================================================

// --- Paleta (estilo plano: sin contornos, la profundidad sale de tonos mas oscuros)
const C = {
  INK: '#0F172A', PELO: '#2D2A32', PELO_OSC: '#1C1A21', CANELA: '#C2813F', CANELA_OSC: '#A3672C',
  ROSA: '#F472B6', ROSA_OSC: '#DB2777', VERDE: '#059669', VERDE_OSC: '#047857',
  NARANJA: '#FF5A3C', NARANJA_OSC: '#E83E1F', BLANCO: '#F8FAFC', GRIS: '#64748B', GRIS_CLARO: '#CBD5E1',
  PIZARRA: '#334155', AMARILLO: '#FDE047', AZUL: '#38BDF8',
};
const { INK, PELO, PELO_OSC, CANELA, CANELA_OSC, ROSA, ROSA_OSC, VERDE, VERDE_OSC, NARANJA, NARANJA_OSC } = C;

// --- Geometria basica de curvas -------------------------------------------------
const lerp = (a, b, t) => a + (b - a) * t;
const curva = (p0, c, p2) => `M${p0[0]} ${p0[1]} Q${c[0]} ${c[1]} ${p2[0]} ${p2[1]}`;
// "tramo": solo el pedazo final de una curva (sirve para pintar las medias canela de las patas)
function tramo(p0, c, p2, t) {
  const p = [(1 - t) ** 2 * p0[0] + 2 * t * (1 - t) * c[0] + t * t * p2[0], (1 - t) ** 2 * p0[1] + 2 * t * (1 - t) * c[1] + t * t * p2[1]];
  return curva(p, [lerp(c[0], p2[0], t), lerp(c[1], p2[1], t)], p2);
}
const tubo = (d, color, w = 19) => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round"/>`;
const pata = ([x, y], rx = 18, ry = 14) =>
  `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${CANELA}"/><path d="M${x - 6} ${y + 2} V${y + ry - 3} M${x + 6} ${y + 2} V${y + ry - 3}" stroke="${CANELA_OSC}" stroke-width="3" stroke-linecap="round"/>`;

// --- Ojos ----------------------------------------------------------------------
// opciones: sx (tamano), px/py (hacia donde mira), r (pupila), feliz, guino,
//           lid: 'enojo' | 'triste' | 'sueno', lagrima: true
let _id = 0;
function ojo(cx, cy, lado, o = {}) {
  const sx = o.sx || 1, rx = 15 * sx, ry = 18 * sx, px = o.px ?? 3, py = o.py ?? 2;
  if (o.feliz) return `<path d="M${cx - 13} ${cy + 6} Q${cx} ${cy - 14} ${cx + 13} ${cy + 6}" fill="none" stroke="${C.BLANCO}" stroke-width="7" stroke-linecap="round"/>`;
  if (o.guino) return `<path d="M${cx - 13} ${cy - 2} Q${cx} ${cy + 10} ${cx + 13} ${cy - 2}" fill="none" stroke="${C.BLANCO}" stroke-width="7" stroke-linecap="round"/>`;
  const id = 'c' + (_id++);
  let lid = '';
  if (o.lid) {
    const izq = lado < 0;
    let pts;
    if (o.lid === 'sueno') pts = [[-18, -24], [18, -24], [18, 0], [-18, 0]];
    else {
      const interiorBajo = o.lid === 'enojo' ? izq : !izq;
      pts = interiorBajo ? [[-18, -24], [18, -24], [18, 3], [-18, -9]] : [[-18, -24], [18, -24], [18, -9], [-18, 3]];
    }
    lid = `<polygon points="${pts.map(([a, b]) => `${cx + a},${cy + b}`).join(' ')}" fill="${PELO}" clip-path="url(#${id})"/>`;
    if (o.lid === 'sueno') lid += `<path d="M${cx - 15} ${cy} H${cx + 15}" stroke="${INK}" stroke-width="3" clip-path="url(#${id})"/>`;
  }
  const r = o.r ?? (sx > 1.2 ? 5.5 : 8.5);
  const lagrima = o.lagrima ? `<path d="M${cx + lado * 4} ${cy + 20} Q${cx + lado * 12} ${cy + 36} ${cx + lado * 4} ${cy + 42} Q${cx - lado * 4} ${cy + 36} ${cx + lado * 4} ${cy + 20}Z" fill="${C.AZUL}"/>` : '';
  return `<clipPath id="${id}"><ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"/></clipPath>
    <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${C.BLANCO}"/>
    <circle cx="${cx + px}" cy="${cy + py}" r="${r}" fill="${INK}"/>
    <circle cx="${cx + px + 2.5}" cy="${cy + py - 2.5}" r="2.2" fill="#fff"/>${lid}${lagrima}`;
}

// --- Bocas ---------------------------------------------------------------------
const lengua = `<path d="M-9 52 Q-12 90 6 92 Q24 90 15 54 Z" fill="${ROSA}"/><path d="M3 58 V80" stroke="${ROSA_OSC}" stroke-width="3" stroke-linecap="round"/>`;
const abierta = (e) => `<g transform="translate(0 40) scale(${e})"><path d="M-28 0 Q0 52 28 0 Q0 8 -28 0Z" fill="#7F1D1D"/><path d="M-22 3 Q0 8 22 3 L20 10 Q0 15 -20 10Z" fill="#fff"/></g>`;
const bocas = {
  lengua: abierta(.8) + lengua,
  risa: abierta(1) + lengua,
  O: `<ellipse cx="0" cy="50" rx="11" ry="12" fill="#7F1D1D"/>`,
  triste: `<path d="M-20 56 Q0 42 20 56" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`,
  dientes: `<path d="M-24 44 Q0 52 24 44 L24 56 Q0 64 -24 56Z" fill="#fff"/><path d="M-12 47 V59 M0 49 V61 M12 47 V59" stroke="${C.GRIS_CLARO}" stroke-width="3"/>`,
  sonrisa: `<path d="M-18 42 Q0 58 18 42" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`,
  ladeada: `<path d="M-16 50 Q4 52 18 42" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`,
  pensativa: `<path d="M-10 50 Q0 44 10 50" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`,
  bostezo: `<ellipse cx="0" cy="52" rx="15" ry="19" fill="#7F1D1D"/><ellipse cx="0" cy="62" rx="10" ry="6" fill="${ROSA}"/>`,
};

// --- Cabeza (origen = centro de la cabeza) ---------------------------------------
function cabeza(p) {
  const o = p.oreja || 0, dr = p.cejas || 0, oj = p.ojos || {};
  const ojI = { ...oj, ...(p.ojoI || {}) }, ojD = { ...oj, ...(p.ojoD || {}) };
  const cI = p.cejaI ?? -dr, cD = p.cejaD ?? dr, yI = p.cejaIy || 0, yD = p.cejaDy || 0;
  return `
  <g transform="rotate(${-o} -46 -40)"><path d="M-41 -42 Q-79 -36 -74 17 Q-72 45 -54 40 Q-44 22 -46 -7 Z" fill="${PELO_OSC}"/></g>
  <g transform="rotate(${o} 46 -40)"><path d="M41 -42 Q79 -36 74 17 Q72 45 54 40 Q44 22 46 -7 Z" fill="${PELO_OSC}"/></g>
  <rect x="-50" y="-58" width="100" height="114" rx="34" fill="${PELO}"/>
  <ellipse cx="-22" cy="${-20 + yI}" rx="11" ry="6" fill="${CANELA}" transform="rotate(${cI} -22 ${-20 + yI})"/>
  <ellipse cx="22" cy="${-20 + yD}" rx="11" ry="6" fill="${CANELA}" transform="rotate(${cD} 22 ${-20 + yD})"/>
  <rect x="-34" y="10" width="68" height="46" rx="23" fill="${CANELA}"/>
  <rect x="-34" y="44" width="68" height="12" rx="6" fill="${CANELA_OSC}" opacity=".45"/>
  ${ojo(-21, 0, -1, ojI)}${ojo(21, 0, 1, ojD)}
  <rect x="-16" y="12" width="32" height="20" rx="10" fill="${INK}"/><ellipse cx="-6" cy="17" rx="6" ry="2.5" fill="#fff" opacity=".5"/>
  ${bocas[p.boca || 'sonrisa']}`;
}

// --- Cuerpo completo ----------------------------------------------------------------
// brazos: [controlX, controlY, manoX, manoY]  (el hombro sale fijo de (+-40, 4))
// piernas: [controlX, controlY, piex, piey]   (la cadera sale fija de (+-18, 54))
const REL_I = [-84, 32, -66, 84], REL_D = [84, 32, 66, 84];
const PIE_I = [-32, 88, -26, 114], PIE_D = [32, 88, 28, 114];

function perro(p = {}) {
  const bI = p.brazoI || REL_I, bD = p.brazoD || REL_D, pI = p.pieI || PIE_I, pD = p.pieD || PIE_D;
  const cu = p.cuerpo || {}, dx = cu.dx || 0, dy = cu.dy || 0, rot = cu.rot || 0;
  const armPath = (lado, b) => curva([lado * 40, 4], [b[0], b[1]], [b[2], b[3]]);
  const legBlock = (lado, l) => {
    const p0 = [lado * 18, 54], c = [l[0], l[1]], p2 = [l[2], l[3]];
    return tubo(curva(p0, c, p2), PELO) + tubo(tramo(p0, c, p2, .62), CANELA) + pata([l[2], l[3] + 10], 21, 13);
  };
  return `
  <g class="sombra"><ellipse cx="0" cy="142" rx="${70 * (p.sombra ?? 1)}" ry="${9 * (p.sombra ?? 1)}" fill="${INK}" opacity="${.1 * (p.sombra ?? 1)}"/></g>
  ${p.propsAtras || ''}
  <g transform="translate(${dx} ${dy}) rotate(${rot} 0 60)">
    <ellipse cx="38" cy="56" rx="13" ry="9" fill="${PELO_OSC}" transform="rotate(-30 38 56)"/>
    ${legBlock(-1, pI)}${legBlock(1, pD)}
    <path d="M-46 -8 Q-54 34 -30 62 Q0 70 30 62 Q54 34 46 -8 Q0 -20 -46 -8Z" fill="${PELO}"/>
    <ellipse cx="0" cy="28" rx="13" ry="18" fill="${CANELA}"/>
    <rect x="-24" y="-34" width="48" height="30" fill="${PELO}"/>
    <path d="M-32 -22 Q0 -2 32 -22" fill="none" stroke="${VERDE_OSC}" stroke-width="13" stroke-linecap="round"/>
    <path d="M-32 -23 Q0 -4 32 -23" fill="none" stroke="${VERDE}" stroke-width="10" stroke-linecap="round"/>
    <g transform="translate(24 -6)"><circle r="14" fill="${NARANJA_OSC}"/><circle r="12" fill="${NARANJA}"/>
      <circle r="5" fill="#fff"/><ellipse rx="10" ry="3" fill="none" stroke="#fff" stroke-width="2" transform="rotate(-20)"/></g>
    ${tubo(armPath(-1, bI), PELO)}${tubo(armPath(1, bD), PELO)}
    ${p.props || ''}
    ${pata([bI[2], bI[3]])}${pata([bD[2], bD[3]])}
    <g transform="translate(0 -78) rotate(${p.incl || 0} 0 50)">${cabeza(p)}</g>
    ${p.propsFrente || ''}
  </g>`;
}

// --- Vista de perfil (mira a la derecha) y de espalda ------------------------------
function perfil() {
  return `
  <ellipse cx="0" cy="142" rx="64" ry="9" fill="${INK}" opacity=".1"/>
  <ellipse cx="-34" cy="54" rx="14" ry="9" fill="${PELO_OSC}" transform="rotate(25 -34 54)"/>
  ${tubo(curva([-8, 54], [-28, 88], [-24, 114]), PELO)}${tubo(tramo([-8, 54], [-28, 88], [-24, 114], .62), CANELA)}
  <ellipse cx="-16" cy="124" rx="24" ry="12" fill="${CANELA}"/><path d="M-4 126 V132 M4 126 V132" stroke="${CANELA_OSC}" stroke-width="3" stroke-linecap="round"/>
  ${tubo(curva([8, 54], [28, 88], [26, 114]), PELO)}${tubo(tramo([8, 54], [28, 88], [26, 114], .62), CANELA)}
  <ellipse cx="38" cy="124" rx="24" ry="12" fill="${CANELA}"/><path d="M50 126 V132 M58 126 V132" stroke="${CANELA_OSC}" stroke-width="3" stroke-linecap="round"/>
  <path d="M-34 -8 Q-42 34 -22 62 Q2 70 26 62 Q42 34 36 -8 Q0 -18 -34 -8Z" fill="${PELO}"/>
  <ellipse cx="26" cy="26" rx="8" ry="18" fill="${CANELA}"/>
  <rect x="-20" y="-34" width="42" height="30" fill="${PELO}"/>
  <path d="M-26 -22 Q4 -4 30 -22" fill="none" stroke="${VERDE_OSC}" stroke-width="13" stroke-linecap="round"/>
  <path d="M-26 -23 Q4 -6 30 -23" fill="none" stroke="${VERDE}" stroke-width="10" stroke-linecap="round"/>
  <g transform="translate(30 -4)"><circle r="14" fill="${NARANJA_OSC}"/><circle r="12" fill="${NARANJA}"/><circle r="5" fill="#fff"/><ellipse rx="10" ry="3" fill="none" stroke="#fff" stroke-width="2" transform="rotate(-20)"/></g>
  ${tubo(curva([4, 4], [26, 40], [20, 88]), PELO)}${pata([20, 88], 16, 13)}
  <g transform="translate(0 -78)">
    <rect x="-44" y="-58" width="78" height="112" rx="32" fill="${PELO}"/>
    <rect x="8" y="6" width="60" height="46" rx="21" fill="${CANELA}"/>
    <rect x="12" y="2" width="54" height="18" rx="9" fill="${PELO}"/>
    <ellipse cx="68" cy="14" rx="11" ry="10" fill="${INK}"/><ellipse cx="65" cy="10" rx="4" ry="2" fill="#fff" opacity=".5"/>
    <ellipse cx="8" cy="-22" rx="11" ry="6" fill="${CANELA}"/>
    <ellipse cx="8" cy="-2" rx="14" ry="17" fill="${C.BLANCO}"/><circle cx="14" cy="1" r="8.5" fill="${INK}"/><circle cx="16.5" cy="-1.5" r="2.2" fill="#fff"/>
    <path d="M42 48 Q46 82 60 80 Q70 74 62 48Z" fill="${ROSA}"/><path d="M14 46 Q40 54 62 44" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>
    <path d="M-26 -46 Q-62 -30 -56 22 Q-52 42 -36 38 Q-26 16 -26 -10Z" fill="${PELO_OSC}"/>
  </g>`;
}

function espalda() {
  return `
  <ellipse cx="0" cy="142" rx="70" ry="9" fill="${INK}" opacity=".1"/>
  ${tubo(curva([-18, 54], [-32, 88], [-26, 114]), PELO)}${tubo(tramo([-18, 54], [-32, 88], [-26, 114], .62), CANELA)}<ellipse cx="-26" cy="124" rx="21" ry="13" fill="${CANELA}"/>
  ${tubo(curva([18, 54], [32, 88], [28, 114]), PELO)}${tubo(tramo([18, 54], [32, 88], [28, 114], .62), CANELA)}<ellipse cx="30" cy="124" rx="21" ry="13" fill="${CANELA}"/>
  <path d="M-46 -8 Q-54 34 -30 62 Q0 70 30 62 Q54 34 46 -8 Q0 -20 -46 -8Z" fill="${PELO}"/>
  <path d="M0 -6 V56" stroke="${PELO_OSC}" stroke-width="4" stroke-linecap="round"/>
  <ellipse cx="0" cy="60" rx="13" ry="10" fill="${PELO_OSC}"/>
  <rect x="-24" y="-34" width="48" height="30" fill="${PELO}"/>
  <path d="M-32 -24 Q0 -12 32 -24" fill="none" stroke="${VERDE_OSC}" stroke-width="13" stroke-linecap="round"/>
  <path d="M-32 -25 Q0 -14 32 -25" fill="none" stroke="${VERDE}" stroke-width="10" stroke-linecap="round"/>
  ${tubo(curva([-40, 4], REL_I.slice(0, 2), REL_I.slice(2)), PELO)}${tubo(curva([40, 4], REL_D.slice(0, 2), REL_D.slice(2)), PELO)}
  ${pata(REL_I.slice(2))}${pata(REL_D.slice(2))}
  <g transform="translate(0 -78)">
    <rect x="-50" y="-58" width="100" height="114" rx="34" fill="${PELO}"/>
    <path d="M0 -56 V -20" stroke="${PELO_OSC}" stroke-width="4" stroke-linecap="round"/>
    <path d="M-41 -42 Q-79 -36 -74 17 Q-72 45 -54 40 Q-44 22 -46 -7 Z" fill="${PELO_OSC}"/>
    <path d="M41 -42 Q79 -36 74 17 Q72 45 54 40 Q44 22 46 -7 Z" fill="${PELO_OSC}"/>
  </g>`;
}

// --- Objetos (props) -------------------------------------------------------------------
const T = (x, y, s, fill, txt, r = 0, w = 800) =>
  `<text x="${x}" y="${y}" font-size="${s}" font-weight="${w}" fill="${fill}" text-anchor="middle" transform="rotate(${r} ${x} ${y})" font-family="Inter,Arial,sans-serif">${txt}</text>`;
const P = {
  interrogacion: (x, y, r = 0, s = 1) => T(x, y, 54 * s, NARANJA, '?', r),
  exclamacion: (x, y, r = 0, s = 1) => T(x, y, 54 * s, NARANJA, '!', r),
  gota: (x, y, s = 1) => `<path transform="translate(${x} ${y}) scale(${s})" d="M0 -12 Q10 4 0 12 Q-10 4 0 -12Z" fill="${C.AZUL}"/>`,
  brillo: (x, y, s = 1, c = C.AMARILLO) => `<path transform="translate(${x} ${y}) scale(${s})" d="M0 -10 Q1.5 -1.5 10 0 Q1.5 1.5 0 10 Q-1.5 1.5 -10 0 Q-1.5 -1.5 0 -10Z" fill="${c}"/>`,
  bombilla: (x, y) => `<g transform="translate(${x} ${y})">
      ${[-70, -35, 0, 35, 70].map(a => `<path d="M0 -38 V-50" stroke="${C.AMARILLO}" stroke-width="4" stroke-linecap="round" transform="rotate(${a})"/>`).join('')}
      <circle r="24" fill="${C.AMARILLO}"/><path d="M-8 -6 Q0 6 8 -6" fill="none" stroke="#CA8A04" stroke-width="3" stroke-linecap="round"/>
      <rect x="-10" y="22" width="20" height="12" rx="3" fill="${C.GRIS}"/></g>`,
  celular: (x, y, r = 0) => `<g transform="translate(${x} ${y}) rotate(${r})"><rect x="-17" y="-28" width="34" height="56" rx="7" fill="${C.PIZARRA}"/>
      <rect x="-13" y="-23" width="26" height="46" rx="3" fill="#E2E8F0"/>
      <path d="M0 -10 a7 7 0 1 1 0.01 0 L0 4 Z" fill="${NARANJA}"/><circle cx="0" cy="-12" r="2.5" fill="#fff"/><ellipse cx="0" cy="12" rx="8" ry="2.5" fill="${C.GRIS_CLARO}"/></g>`,
  pin: (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})"><ellipse cy="26" rx="22" ry="7" fill="none" stroke="${NARANJA}" stroke-width="3" opacity=".5"/>
      <path d="M0 22 Q-18 -2 -18 -12 a18 18 0 1 1 36 0 Q18 -2 0 22Z" fill="${NARANJA}"/><circle cy="-12" r="7" fill="#fff"/></g>`,
  calculadora: (x, y) => `<g transform="translate(${x} ${y})"><rect x="-24" y="-30" width="48" height="62" rx="7" fill="${C.PIZARRA}"/>
      <rect x="-18" y="-24" width="36" height="14" rx="3" fill="#BBF7D0"/>
      ${[0, 1, 2].map(i => [0, 1, 2].map(j => `<circle cx="${-12 + j * 12}" cy="${-1 + i * 11}" r="3.6" fill="${C.GRIS_CLARO}"/>`).join('')).join('')}
      <circle cx="-12" cy="25" r="3.6" fill="${C.GRIS_CLARO}"/><circle cx="0" cy="25" r="3.6" fill="${C.GRIS_CLARO}"/><circle cx="12" cy="25" r="3.6" fill="${NARANJA}"/></g>`,
  billete: (x, y, r = 0) => `<g transform="translate(${x} ${y}) rotate(${r})"><rect x="-26" y="-14" width="52" height="28" rx="4" fill="#34D399"/><rect x="-22" y="-10" width="44" height="20" rx="2" fill="none" stroke="${VERDE}" stroke-width="2"/>
      <circle r="7" fill="${VERDE}"/>${T(0, 5, 12, '#fff', '$')}</g>`,
  billetes: (x, y, r = 0) => `<g transform="translate(${x} ${y}) rotate(${r})">${P.billete(-6, 0, -18)}${P.billete(0, -4, 0)}${P.billete(6, 0, 18)}</g>`,
  reloj: (x, y) => `<g transform="translate(${x} ${y})"><circle cx="-18" cy="-30" r="8" fill="${NARANJA}"/><circle cx="18" cy="-30" r="8" fill="${NARANJA}"/>
      <circle r="31" fill="${NARANJA_OSC}"/><circle r="26" fill="${C.BLANCO}"/>
      ${[0, 90, 180, 270].map(a => `<path d="M0 -21 V-17" stroke="${INK}" stroke-width="3" stroke-linecap="round" transform="rotate(${a})"/>`).join('')}
      <path d="M0 0 V-16" stroke="${INK}" stroke-width="4" stroke-linecap="round"/><path d="M0 0 L12 7" stroke="${INK}" stroke-width="4" stroke-linecap="round"/><circle r="3" fill="${INK}"/></g>`,
  luna: (x, y, s = 1) => `<path transform="translate(${x} ${y}) scale(${s})" d="M10 -26 A28 28 0 1 0 26 14 A21 21 0 1 1 10 -26Z" fill="${C.AMARILLO}"/>`,
  zzz: (x, y) => `${T(x, y, 40, C.GRIS, 'Z', -10)}${T(x + 26, y - 34, 30, C.GRIS, 'Z', -10)}${T(x + 46, y - 62, 22, C.GRIS, 'Z', -10)}`,
  check: (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})"><circle r="26" fill="${VERDE}"/><path d="M-12 1 L-3 11 L13 -9" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></g>`,
  lineasVel: (x, y) => `<g stroke="${C.GRIS_CLARO}" stroke-width="5" stroke-linecap="round"><path d="M${x} ${y} h-46"/><path d="M${x + 10} ${y + 26} h-60"/><path d="M${x} ${y + 52} h-44"/><path d="M${x + 12} ${y + 78} h-52"/></g>`,
  polvo: (x, y) => `<g fill="${C.GRIS_CLARO}"><circle cx="${x}" cy="${y}" r="9"/><circle cx="${x - 14}" cy="${y + 6}" r="6"/><circle cx="${x - 26}" cy="${y - 2}" r="4"/></g>`,
  lupa: (cx, cy, mx, my) => `<g><path d="M${cx + 14} ${cy + 22} L${mx} ${my}" stroke="${C.PIZARRA}" stroke-width="9" stroke-linecap="round"/>
      <circle cx="${cx}" cy="${cy}" r="28" fill="#BAE6FD" opacity=".35"/><circle cx="${cx}" cy="${cy}" r="28" fill="none" stroke="${C.PIZARRA}" stroke-width="7"/>
      <path d="M${cx - 16} ${cy - 8} Q${cx - 12} ${cy - 18} ${cx - 2} ${cy - 20}" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/></g>`,
  laptopTrasera: (x, y) => `<g transform="translate(${x} ${y})"><rect x="-52" y="-34" width="104" height="66" rx="7" fill="${C.GRIS_CLARO}"/><rect x="-58" y="30" width="116" height="9" rx="4" fill="${C.GRIS}"/></g>`,
  escritorio: (y, h = 110) => `<rect x="-140" y="${y}" width="280" height="${h}" fill="${C.GRIS_CLARO}"/><rect x="-140" y="${y}" width="280" height="10" fill="${C.GRIS}"/>`,
  taza: (x, y) => `<g transform="translate(${x} ${y})"><rect x="-13" y="-22" width="26" height="24" rx="5" fill="${NARANJA}"/><path d="M13 -16 q12 2 0 14" fill="none" stroke="${NARANJA}" stroke-width="5"/>
      <path d="M-5 -28 q-5 -8 0 -14 M5 -28 q-5 -8 0 -14" fill="none" stroke="${C.GRIS_CLARO}" stroke-width="3" stroke-linecap="round"/></g>`,
  ja: (x, y, r = 0) => T(x, y, 30, NARANJA, 'JA JA', r),
  tableta: (x, y, r = 0) => `<g transform="translate(${x} ${y}) rotate(${r})"><rect x="-22" y="-29" width="44" height="58" rx="7" fill="${C.PIZARRA}"/><rect x="-17" y="-23" width="34" height="46" rx="3" fill="#fff"/>
      <rect x="-13" y="-18" width="26" height="6" fill="${NARANJA}"/><rect x="-13" y="-7" width="18" height="4" fill="${C.GRIS_CLARO}"/><rect x="-13" y="1" width="22" height="4" fill="${C.GRIS_CLARO}"/></g>`,
};
