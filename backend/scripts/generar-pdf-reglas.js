'use strict';

/**
 * Genera backend/documentos/reglas-calculo-pagos.pdf a partir de
 * docs/REGLAS-CALCULO-PAGOS.md. Se descarga desde GET /api/empresas/reglas-pago
 * — solo admin_empresa (empresas.routes.js), enlazado desde Configuración ›
 * Mi plan (web) y Mi empresa (móvil), no desde Términos y condiciones: es un
 * documento para quien administra la empresa, no para todo el equipo.
 *
 * Publica solo las secciones 1 a 9: la 10 (constantes y archivos) y la 11
 * (limitaciones internas) son para el equipo. Quita la nota interna del
 * inicio y los bloques mermaid/latex (las fórmulas ya están en el texto).
 *
 * Uso (herramienta de desarrollo, no corre en producción):
 *   CHROME_PATH=/ruta/a/chrome node backend/scripts/generar-pdf-reglas.js
 * ponytail: usa `npx marked` + Chrome headless en vez de agregar dependencias
 * al backend — upgrade path: mover a un paso de CI si el PDF cambia seguido.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const RAIZ = path.join(__dirname, '..', '..');
const ORIGEN = path.join(RAIZ, 'docs', 'REGLAS-CALCULO-PAGOS.md');
const DESTINO = path.join(__dirname, '..', 'documentos', 'reglas-calculo-pagos.pdf');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const AVISO = `> Este documento explica cómo Zaturno calcula los montos de nómina y de turnos.
> Zaturno no realiza pagos: la empresa paga directamente al trabajador. Los valores
> legales (salario mínimo, recargos, jornada) son los vigentes a la fecha indicada y
> se actualizan cuando cambia la ley. No constituye asesoría legal ni contable.`;

let md = fs.readFileSync(ORIGEN, 'utf8');
md = md.slice(0, md.indexOf('\n## 10.'));                        // solo secciones 1–9
md = md.replace(/\n> Fuente de verdad[^\n]*\n/, `\n${AVISO}\n`);  // nota interna → aviso público
md = md.replace(/```(mermaid|latex)\n[\s\S]*?```\n*/g, '');       // diagramas y fórmulas TeX
md = md.replace(/\nArriba, el circuito de nómina[^\n]*\n/, '\n'); // describía el diagrama quitado
// Detalle de seguridad interno: no publicar cómo se salta la validación de GPS.
md = md.replace(' La app móvil exige enviar GPS; el backend no lo exige.', ' Debe enviar su ubicación GPS.');

const cuerpo = execFileSync('npx', ['-y', 'marked@15', '--gfm'], { input: md, encoding: 'utf8' });

const html = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>Zaturno — Reglas de cálculo de pagos</title>
<style>
  @page { size: A4; margin: 18mm 16mm; }
  body { font: 10.5pt/1.5 -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color: #1e293b; }
  h1 { font-size: 20pt; margin: 0 0 4pt; }
  h2 { font-size: 14pt; margin: 18pt 0 6pt; border-bottom: 1px solid #e2e8f0; padding-bottom: 3pt; break-after: avoid; }
  h3 { font-size: 11.5pt; margin: 12pt 0 4pt; break-after: avoid; }
  table { border-collapse: collapse; width: 100%; margin: 6pt 0 10pt; font-size: 9.5pt; break-inside: avoid; }
  th, td { border: 1px solid #cbd5e1; padding: 4pt 6pt; text-align: left; vertical-align: top; }
  th { background: #f1f5f9; }
  code { font-family: ui-monospace, Menlo, monospace; font-size: 9pt; background: #f1f5f9; padding: 0 3pt; border-radius: 3pt; }
  blockquote { margin: 8pt 0; padding: 6pt 10pt; background: #fff7ed; border-left: 3pt solid #f97316; color: #7c2d12; }
  blockquote p { margin: 0; }
</style></head><body>${cuerpo}</body></html>`;

const tmp = path.join(os.tmpdir(), 'reglas-calculo-pagos.html');
fs.writeFileSync(tmp, html);
fs.mkdirSync(path.dirname(DESTINO), { recursive: true });
execFileSync(CHROME, [
  '--headless', '--no-sandbox', '--disable-gpu', '--no-pdf-header-footer',
  `--print-to-pdf=${DESTINO}`, `file://${tmp}`,
], { stdio: 'ignore' });

console.log(`PDF generado: ${path.relative(RAIZ, DESTINO)} (${fs.statSync(DESTINO).size} bytes)`);
