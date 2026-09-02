'use strict';

/**
 * Las rutas de PDF de contratos aceptan ?token= porque las abre un navegador
 * externo (WebBrowser.openBrowserAsync en mobile) que no puede mandar headers
 * propios — un middleware previo promueve ?token= a Authorization. Ese
 * middleware solo sirve si corre ANTES de verificarToken (que exige el header
 * y corta con 401 si falta). En Express, un middleware registrado con
 * router.use() corre para toda request antes que cualquier ruta definida
 * después, sin importar qué haga esa ruta internamente — así que las rutas de
 * PDF deben registrarse antes del router.use(verificarToken) del archivo, no
 * llevar su propio shim "por dentro". Este test falla si alguien vuelve a
 * mover esas rutas después del use() (bug real, encontrado en code review).
 */
const router = require('../modules/contratos/contratos.routes');

function indexOfRoute(method, path) {
  return router.stack.findIndex(
    (layer) => layer.route?.path === path && layer.route.methods[method]
  );
}

function indexOfVerificarTokenUse() {
  return router.stack.findIndex(
    (layer) => !layer.route && layer.handle.name === 'verificarToken'
  );
}

describe('contratos.routes — rutas de PDF con ?token=', () => {
  it('registra /asignacion/:asignacionId/pdf antes del router.use(verificarToken) global', () => {
    const idxPdfAsignacion = indexOfRoute('get', '/asignacion/:asignacionId/pdf');
    const idxUse = indexOfVerificarTokenUse();
    expect(idxPdfAsignacion).toBeGreaterThanOrEqual(0);
    expect(idxUse).toBeGreaterThanOrEqual(0);
    expect(idxPdfAsignacion).toBeLessThan(idxUse);
  });

  it('registra /:id/pdf antes del router.use(verificarToken) global', () => {
    const idxPdfId = indexOfRoute('get', '/:id/pdf');
    const idxUse = indexOfVerificarTokenUse();
    expect(idxPdfId).toBeGreaterThanOrEqual(0);
    expect(idxPdfId).toBeLessThan(idxUse);
  });

  it('cada ruta de PDF trae su propio verificarToken en la cadena (no depende del use() global)', () => {
    for (const path of ['/asignacion/:asignacionId/pdf', '/:id/pdf']) {
      const layer = router.stack.find((l) => l.route?.path === path);
      const nombres = layer.route.stack.map((s) => s.name);
      expect(nombres).toContain('verificarToken');
      expect(nombres.indexOf('promoverTokenDeQuery')).toBeLessThan(nombres.indexOf('verificarToken'));
    }
  });
});
