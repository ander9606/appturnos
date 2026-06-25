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
   * Trabajadores sin vincular + candidatos de logiq360 + sugerencias de match
   * por nombre normalizado.
   * ponytail: match por nombre — upgrade path: por cédula/email si logiq360 los expone
   */
  async conciliacion(empresaId) {
    const TrabajadoresModel = require('../../trabajadores/trabajadores.model');
    const cfg = await IntegracionModel.obtenerConfig(empresaId);
    const [pendientes, candidatos] = await Promise.all([
      TrabajadoresModel.listarSinVincularLogiq360(empresaId),
      ConciliacionService._candidatosLogiq360(cfg),
    ]);

    const norm = (s) => String(s || '')
      .normalize('NFD').replace(/\p{Diacritic}/gu, '')
      .toLowerCase().trim().replace(/\s+/g, ' ');
    const porNombre = new Map(candidatos.map((c) => [norm(`${c.nombre} ${c.apellido}`), c]));

    const pendientesConSugerencia = pendientes.map((t) => {
      const sugerido = porNombre.get(norm(`${t.nombre} ${t.apellido}`)) || null;
      return { ...t, sugerencia: sugerido ? { id: sugerido.id, nombre: `${sugerido.nombre} ${sugerido.apellido}` } : null };
    });

    return { pendientes: pendientesConSugerencia, candidatos };
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
