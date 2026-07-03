'use strict';

const IntegracionModel = require('../integracion.model');
const AppError = require('../../../utils/AppError');

const ConciliacionService = {
  /** Obtiene empleados tipo turnos de logiq360 via su API pull. */
  async _candidatosLogiq360(cfg) {
    if (!cfg?.logiq360_base_url || !cfg?.api_key) return [];
    const base = String(cfg.logiq360_base_url).replace(/\/$/, '');
    const resp = await fetch(`${base}/api/integracion/public/empleados?solo_turnos=true`, {
      headers: { 'X-API-Key': cfg.api_key },
    });
    if (!resp.ok) {
      throw new AppError(`logiq360 rechazó la consulta de empleados (HTTP ${resp.status})`, 502);
    }
    const json = await resp.json().catch(() => ({}));
    return Array.isArray(json.data) ? json.data : [];
  },

  /**
   * Trabajadores sin vincular + candidatos de logiq360.
   * Es la misma empresa con un tenant en cada app, así que auto-vincula por email
   * (clave fuerte compartida) sin intervención. Los que no matchean por email
   * quedan pendientes con una sugerencia por nombre para revisión manual.
   */
  /**
   * Pura: decide qué trabajadores se auto-vinculan por email (clave fuerte) y
   * cuáles quedan pendientes con sugerencia por nombre. Sin efectos secundarios.
   */
  emparejarPorEmail(pendientes, candidatos) {
    const normEmail = (s) => String(s || '').toLowerCase().trim();
    const norm = (s) => String(s || '')
      .normalize('NFD').replace(/\p{Diacritic}/gu, '')
      .toLowerCase().trim().replace(/\s+/g, ' ');
    const porEmail = new Map(candidatos.filter((c) => c.email).map((c) => [normEmail(c.email), c]));
    const porNombre = new Map(candidatos.map((c) => [norm(`${c.nombre} ${c.apellido}`), c]));

    const links = [];      // {trabajadorId, empleadoId} — match exacto por email
    const restantes = [];  // sin match por email → sugerencia por nombre
    for (const t of pendientes) {
      const match = t.email ? porEmail.get(normEmail(t.email)) : null;
      if (match) { links.push({ trabajadorId: t.id, empleadoId: match.id }); continue; }
      const sugerido = porNombre.get(norm(`${t.nombre} ${t.apellido}`)) || null;
      restantes.push({ ...t, sugerencia: sugerido ? { id: sugerido.id, nombre: `${sugerido.nombre} ${sugerido.apellido}` } : null });
    }
    return { links, restantes };
  },

  async conciliacion(empresaId) {
    const TrabajadoresModel = require('../../trabajadores/trabajadores.model');
    const cfg = await IntegracionModel.obtenerConfig(empresaId);
    const [pendientes, candidatos] = await Promise.all([
      TrabajadoresModel.listarSinVincularLogiq360(empresaId),
      ConciliacionService._candidatosLogiq360(cfg),
    ]);

    const { links, restantes } = ConciliacionService.emparejarPorEmail(pendientes, candidatos);

    let autoVinculados = 0;
    for (const { trabajadorId, empleadoId } of links) {
      const afectados = await TrabajadoresModel.vincularExternalRef(
        empresaId, trabajadorId, `logiq360:empleado:${empleadoId}`
      );
      if (afectados) autoVinculados++;
    }

    return { pendientes: restantes, candidatos, auto_vinculados: autoVinculados };
  },

  /**
   * Auto-vincula por email sin devolver la vista de conciliación. Se llama tras
   * emparejar para dejar el personal ya conciliado cuando ambos lados tienen datos.
   */
  async autovincular(empresaId) {
    const { auto_vinculados } = await ConciliacionService.conciliacion(empresaId);
    return { auto_vinculados };
  },

  /** Vincula un trabajador de Zaturno a un empleado de logiq360. */
  async vincularEmpleado(empresaId, trabajadorId, empleadoId) {
    const TrabajadoresModel = require('../../trabajadores/trabajadores.model');
    const afectados = await TrabajadoresModel.vincularExternalRef(
      empresaId, trabajadorId, `logiq360:empleado:${empleadoId}`
    );
    if (!afectados) throw new AppError('Trabajador no encontrado', 404);
    return { vinculado: true };
  },
};

module.exports = ConciliacionService;
