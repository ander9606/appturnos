'use strict';

/**
 * Promueve ?token= a header Authorization — usado solo por rutas de PDF que
 * un navegador externo (WebBrowser.openBrowserAsync en mobile) abre sin
 * poder mandar headers propios. Debe ejecutarse ANTES que verificarToken
 * (que exige el header y corta con 401 si falta), y la ruta que lo usa debe
 * registrarse antes de cualquier router.use(verificarToken) global del
 * archivo — un middleware registrado con .use() corre para toda request
 * antes que cualquier handler de ruta definido después, sin importar qué
 * haga ese handler internamente.
 */
function promoverTokenDeQuery(req, res, next) {
  if (req.query.token && !req.headers.authorization) {
    req.headers.authorization = `Bearer ${req.query.token}`;
  }
  next();
}

module.exports = promoverTokenDeQuery;
