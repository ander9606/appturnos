'use strict';

/**
 * Plantilla de marca para todos los correos de Zaturno: banda naranja con el nombre, tarjeta blanca y pie.
 * HTML de correo = tablas y estilos en línea (los clientes de correo ignoran CSS externo).
 * Colores = tokens de marca (docs/DISENO.md §2.2). Todo valor que venga de un usuario debe pasar por esc().
 * ponytail: nombre en texto en vez del logo — los correos necesitan una imagen con URL pública;
 * upgrade path: subir logo-mark.png al sitio y usar <img src=EMAIL_LOGO_URL> en el encabezado.
 */
const C = {
  primary: '#FF5A3C', primary700: '#C32D14', foreground: '#0F172A',
  muted: '#64748B', border: '#E2E8F0', background: '#F8FAFC', card: '#FFFFFF', primaryLight: '#FFF1EE',
};
const FUENTE = "Inter,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

const ENTIDADES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
/** Escapa texto de usuario para meterlo en HTML. */
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ENTIDADES[c]);

/** Código de un solo uso, grande y espaciado. */
const bloqueCodigo = (codigo) =>
  `<p style="margin:20px 0;padding:16px;background:${C.primaryLight};border-radius:12px;text-align:center;` +
  `font-size:34px;font-weight:800;letter-spacing:8px;color:${C.primary700}">${esc(codigo)}</p>`;

/** Tabla etiqueta → valor (credenciales, resumen de pago…). */
const tablaDatos = (filas) =>
  `<table role="presentation" style="margin:16px 0;font-size:14px;border-collapse:collapse">` +
  filas.map(([k, v]) => `<tr><td style="color:${C.muted};padding:4px 16px 4px 0">${esc(k)}</td><td style="font-weight:700;color:${C.foreground}">${esc(v)}</td></tr>`).join('') +
  `</table>`;

/**
 * @param {object} p
 * @param {string} p.titulo   Título del correo (texto plano).
 * @param {string} p.cuerpo   HTML ya armado por quien llama (con esc() en cada dato de usuario).
 * @param {{texto: string, url: string}} [p.boton]  Botón principal.
 * @param {{texto: string, url: string}} [p.botonSecundario]  Segunda opción, con borde (p. ej. pagar el año).
 * @param {string} [p.nota]   Texto pequeño bajo el contenido (texto plano).
 */
function plantillaCorreo({ titulo, cuerpo, boton, botonSecundario, nota }) {
  const botonHtml = boton
    ? `<p style="margin:24px 0"><a href="${esc(boton.url)}" style="display:inline-block;padding:14px 28px;background:${C.primary};color:#FFFFFF;` +
      `border-radius:12px;text-decoration:none;font-weight:700;font-size:16px">${esc(boton.texto)}</a></p>`
    : '';
  const secundarioHtml = botonSecundario
    ? `<p style="margin:-12px 0 24px"><a href="${esc(botonSecundario.url)}" style="display:inline-block;padding:12px 26px;border:2px solid ${C.primary};` +
      `color:${C.primary700};border-radius:12px;text-decoration:none;font-weight:700;font-size:15px">${esc(botonSecundario.texto)}</a></p>`
    : '';
  const notaHtml = nota ? `<p style="margin:16px 0 0;color:${C.muted};font-size:13px;line-height:1.5">${esc(nota)}</p>` : '';
  return `<!doctype html>
<html lang="es"><body style="margin:0;padding:0;background:${C.background};font-family:${FUENTE};color:${C.foreground}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.background};padding:24px 12px"><tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
    <tr><td style="background:${C.primary};border-radius:20px 20px 0 0;padding:24px 28px">
      <div style="font-size:24px;font-weight:800;color:#FFFFFF;letter-spacing:-0.5px">Zaturno</div>
      <div style="font-size:13px;font-weight:600;color:#FFFFFF;margin-top:2px">Turnos y nómina para tu empresa</div>
    </td></tr>
    <tr><td style="background:${C.card};border:1px solid ${C.border};border-top:0;border-radius:0 0 20px 20px;padding:28px;font-size:15px;line-height:1.6">
      <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3">${esc(titulo)}</h1>
      ${cuerpo}${botonHtml}${secundarioHtml}${notaHtml}
    </td></tr>
    <tr><td style="padding:16px 8px;text-align:center;color:${C.muted};font-size:12px">Zaturno · Gestión de turnos y nómina</td></tr>
  </table>
</td></tr></table>
</body></html>`;
}

module.exports = { plantillaCorreo, esc, bloqueCodigo, tablaDatos };
