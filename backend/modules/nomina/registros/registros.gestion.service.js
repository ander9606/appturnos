'use strict';

const RegistrosModel = require('./registros.model');
const PeriodosModel = require('../periodos/periodos.model');
const TrabajadoresModel = require('../../trabajadores/trabajadores.model');
const EmpresasModel = require('../../empresas/empresas.model');
const CompensatoriosService = require('../compensatorios/compensatorios.service');
const NotificacionesService = require('../../notificaciones/notificaciones.service');
const { calcularHoras } = require('../../../utils/laboralUtils');
const { validarSesiones, calcularHorasSesiones } = require('../../../utils/sesionesUtils');
const AppError = require('../../../utils/AppError');
const logger = require('../../../utils/logger');
const { ROLES } = require('../../../config/constants');
const { clasificarDiaFestivo, resolverTrabajadorPropio, getLunesDeSemana, hoyISO, ahoraHHMMSS } = require('./registros.helpers');

/**
 * Gestión de registros diarios de nómina por el gestor: consultar, crear, corregir y reprocesar.
 * Parte de RegistrosService (ver registros.service.js, que reúne los tres sub-services).
 */
/**
 * Desglose EN VIVO de un registro con turno abierto (hora_entrada sin
 * hora_salida): mismo camino que marcarSalida() pero de solo lectura, usando
 * la hora actual como salida virtual — sin persistir ni disparar
 * notificaciones/compensatorios. Un registro cerrado se devuelve intacto (ya
 * tiene su verdad congelada). `en_vivo: true` le dice a la UI que el
 * desglose es una proyección que sigue cambiando, no el cierre real.
 */
async function conHorasEnVivo(empresaId, registro) {
  if (!registro.hora_entrada || registro.hora_salida) return registro;

  const lunes = getLunesDeSemana(registro.fecha);
  const { ordinarias: ordinariasAcum } =
    await RegistrosModel.sumarOrdinariasEnSemana(empresaId, registro.trabajador_id, lunes, registro.fecha);
  const ordinariasBase = ordinariasAcum +
    (registro.sesiones > 1
      ? Number(registro.horas_ordinarias) + Number(registro.horas_nocturnas)
      : 0);

  const { sumarNocturnasFestivo, reglaDomingoHabitual } = await EmpresasModel.obtenerConfigRecargos(empresaId);
  const { recargoFestivo } =
    await clasificarDiaFestivo(empresaId, registro.trabajador_id, registro.fecha, reglaDomingoHabitual);
  const horasSesion = calcularHoras({
    horaEntrada: registro.hora_entrada,
    horaSalida: ahoraHHMMSS(),
    fecha: registro.fecha,
    horasOrdinariasAcumuladas: ordinariasBase,
    jornadaContinua: Boolean(registro.jornada_continua),
    recargoFestivo,
    sumarNocturnasFestivo,
  });

  const horas = registro.sesiones > 1
    ? {
        horas_ordinarias:      Number(registro.horas_ordinarias)      + horasSesion.horas_ordinarias,
        horas_extra_diurnas:   Number(registro.horas_extra_diurnas)   + horasSesion.horas_extra_diurnas,
        horas_extra_nocturnas: Number(registro.horas_extra_nocturnas) + horasSesion.horas_extra_nocturnas,
        horas_nocturnas:       Number(registro.horas_nocturnas)       + horasSesion.horas_nocturnas,
        horas_festivo:         Number(registro.horas_festivo)         + horasSesion.horas_festivo,
        es_festivo:            horasSesion.es_festivo,
      }
    : horasSesion;

  return { ...registro, ...horas, en_vivo: true };
}

/** 'YYYY-MM-DD' del día siguiente a `fecha`. */
function diaSiguiente(fecha) {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

const RegistrosGestionService = {
  async obtener(empresaId, registroId) {
    const registro = await RegistrosModel.obtenerPorId(empresaId, registroId);
    if (!registro) throw new AppError('Registro no encontrado', 404);
    return conHorasEnVivo(empresaId, registro);
  },

  async listar(empresaId, usuario, { periodo_id, trabajador_id, fecha, fecha_desde, fecha_hasta, sospechoso, page, limit }) {
    let trabajadorId = trabajador_id;
    if (usuario.rol === ROLES.TRABAJADOR_NOMINA) {
      trabajadorId = await resolverTrabajadorPropio(empresaId, usuario.sub);
    }
    const offset = (page - 1) * limit;
    const { data, total } = await RegistrosModel.listar(empresaId, {
      periodoId: periodo_id,
      trabajadorId,
      fecha,
      fechaDesde: fecha_desde,
      fechaHasta: fecha_hasta,
      sospechoso,
      limit,
      offset,
    });
    const dataEnVivo = await Promise.all(data.map((r) => conHorasEnVivo(empresaId, r)));
    return { data: dataEnVivo, pagination: { page, limit, total } };
  },

  /** Descarta un flag de sospechoso tras revisión del gestor. */
  async descartarSospechoso(empresaId, id) {
    const affected = await RegistrosModel.descartarSospechoso(empresaId, id);
    if (!affected) throw new AppError('Registro no encontrado', 404);
  },

  async crear(empresaId, usuario, datos) {
    let trabajadorId = datos.trabajador_id;
    if (usuario.rol === ROLES.TRABAJADOR_NOMINA) {
      trabajadorId = await resolverTrabajadorPropio(empresaId, usuario.sub);
    }
    if (!trabajadorId) {
      throw new AppError('trabajador_id es obligatorio', 422);
    }
    // El trabajador_id viene del cliente: debe ser de esta empresa (si no, el registro
    // quedaría en nuestra liquidación con datos —cédula, banco, sueldo— de otra empresa).
    if (!(await TrabajadoresModel.obtenerPorId(empresaId, trabajadorId))) {
      throw new AppError('Trabajador no encontrado', 404);
    }

    const periodo = await PeriodosModel.obtenerPorId(empresaId, datos.periodo_id);
    if (!periodo) throw new AppError('Período no encontrado', 404);
    if (periodo.estado !== 'abierto') {
      throw new AppError('No se puede registrar en un período que no está abierto', 409);
    }
    if (datos.fecha < periodo.fecha_inicio || datos.fecha > periodo.fecha_fin) {
      throw new AppError('La fecha está fuera del rango del período', 422);
    }
    if (datos.fecha > hoyISO()) {
      throw new AppError('No puedes registrar un día que aún no ha ocurrido', 422);
    }
    // Creación manual: no hay campo para "día siguiente", así que a diferencia de
    // marcarSalida() (clock-out real que sí puede cruzar medianoche) aquí salida <= entrada
    // siempre es un dato imposible, no un turno nocturno.
    if (datos.hora_entrada && datos.hora_salida && datos.hora_salida <= datos.hora_entrada) {
      throw new AppError('La hora de salida debe ser posterior a la de entrada', 422);
    }

    // Mismo criterio que marcarSalida(): el tope de ordinarias es semanal, no por día.
    const lunesCrear = getLunesDeSemana(datos.fecha);
    const { ordinarias: ordinariasAcumCrear } =
      await RegistrosModel.sumarOrdinariasEnSemana(empresaId, trabajadorId, lunesCrear, datos.fecha);

    const jornadaContinua = Boolean(datos.jornada_continua);
    const { sumarNocturnasFestivo, reglaDomingoHabitual } = await EmpresasModel.obtenerConfigRecargos(empresaId);
    const { clasificacion, recargoFestivo, numeroDiaFestivo } =
      await clasificarDiaFestivo(empresaId, trabajadorId, datos.fecha, reglaDomingoHabitual);
    const horas = calcularHoras({
      horaEntrada: datos.hora_entrada,
      horaSalida: datos.hora_salida,
      fecha: datos.fecha,
      horasOrdinariasAcumuladas: ordinariasAcumCrear,
      jornadaContinua,
      recargoFestivo,
      sumarNocturnasFestivo,
    });

    const id = await RegistrosModel.crear(empresaId, {
      trabajador_id: trabajadorId,
      periodo_id: datos.periodo_id,
      fecha: datos.fecha,
      hora_entrada: datos.hora_entrada || null,
      hora_salida: datos.hora_salida || null,
      horas_ordinarias: horas.horas_ordinarias,
      horas_extra_diurnas: horas.horas_extra_diurnas,
      horas_extra_nocturnas: horas.horas_extra_nocturnas,
      horas_nocturnas: horas.horas_nocturnas,
      horas_festivo: horas.horas_festivo,
      es_festivo: horas.es_festivo,
      novedad: datos.novedad || null,
      tipo_dia: datos.tipo_dia || 'ordinario',
      jornada_continua: jornadaContinua,
      horas_acumuladas_semana: ordinariasAcumCrear,
    });

    // Compensatorio si es festivo o domingo (Art. 179 CST) — misma regla que marcarSalida.
    // La unique constraint en origen_registro_id previene duplicados.
    await CompensatoriosService.crearSiCorresponde(empresaId, {
      trabajadorId,
      periodoId: datos.periodo_id,
      fecha: datos.fecha,
      esFestivo: Boolean(horas.es_festivo),
      registroId: id,
      clasificacion,
      numeroDiaFestivo,
      sumarNocturnasFestivo,
      tipoDia: datos.tipo_dia || 'ordinario',
    });

    return RegistrosModel.obtenerPorId(empresaId, id);
  },

  /**
   * Al cerrar un período: cada día del rango sin NINGÚN registro, para un
   * trabajador que marca jornada (tipo nomina/ambos), se rellena como
   * 'descanso' — sin horario, sin novedad. Así ningún día queda sin
   * clasificar, y un domingo/festivo vacío no se confunde después con un día
   * "pendiente de revisar" ni dispara nada por accidente (crearSiCorresponde
   * ya no genera compensatorio para tipo_dia != 'ordinario').
   *
   * No afecta el pago: el salario fijo se paga completo por días del
   * período (no por registros), y tarifa_hora no suma horas de un día sin
   * marcar — 'descanso' tampoco está en la lista que descuenta el auxilio
   * de transporte (ver dias_sin_subsidio en liquidacion.model.js).
   *
   * Best-effort: un fallo rellenando un día no debe impedir cerrar el
   * período — el resto del cierre (snapshot, cuentas de cobro) ya se guardó
   * o se guarda aparte.
   */
  async rellenarDiasVaciosComoDescanso(empresaId, periodo) {
    const trabajadorIds = await TrabajadoresModel.listarActivosNomina(empresaId);
    if (trabajadorIds.length === 0) return { creados: 0 };

    const existentes = await RegistrosModel.listarFechasConRegistro(empresaId, periodo.id);
    const cubiertos = new Set(existentes.map((r) => `${r.trabajador_id}|${r.fecha}`));

    // Nunca un día que todavía no ha ocurrido (cerrar un período antes de su fecha_fin).
    const hasta = periodo.fecha_fin < hoyISO() ? periodo.fecha_fin : hoyISO();

    let creados = 0;
    for (const trabajadorId of trabajadorIds) {
      for (let fecha = periodo.fecha_inicio; fecha <= hasta; fecha = diaSiguiente(fecha)) {
        if (cubiertos.has(`${trabajadorId}|${fecha}`)) continue;
        try {
          await RegistrosModel.crear(empresaId, {
            trabajador_id: trabajadorId, periodo_id: periodo.id, fecha,
            hora_entrada: null, hora_salida: null,
            horas_ordinarias: 0, horas_extra_diurnas: 0, horas_extra_nocturnas: 0,
            horas_nocturnas: 0, horas_festivo: 0, es_festivo: 0,
            novedad: null, tipo_dia: 'descanso', jornada_continua: false, horas_acumuladas_semana: 0,
          });
          creados++;
        } catch (err) {
          logger.error(`[registros] no se pudo rellenar descanso (trabajador ${trabajadorId}, ${fecha}):`, err.message);
        }
      }
    }
    return { creados };
  },

  /** Corrección de un registro. Recalcula las horas y registra el aprobador. */
  async corregir(empresaId, usuario, id, datos, { notificar = true } = {}) {
    const registro = await RegistrosModel.obtenerPorId(empresaId, id);
    if (!registro) throw new AppError('Registro no encontrado', 404);

    // Un día con reingreso (varias sesiones) se corrige por sesiones: hay que mandar la lista
    // completa, porque los horas_* del registro son la suma de todas (ver sesionesUtils.js).
    const porSesiones = registro.sesiones > 1;
    if (porSesiones && !Array.isArray(datos.sesiones)) {
      throw new AppError('Este día tiene reingreso: corrígelo enviando todas sus sesiones.', 422);
    }
    if (porSesiones && (datos.hora_entrada !== undefined || datos.hora_salida !== undefined)) {
      throw new AppError('Este día tiene reingreso: usa "sesiones" en vez de hora_entrada/hora_salida.', 422);
    }
    if (!porSesiones && datos.sesiones !== undefined) {
      throw new AppError('Solo un día con reingreso se corrige por sesiones.', 422);
    }

    const periodo = await PeriodosModel.obtenerPorId(empresaId, registro.periodo_id);
    if (periodo.estado !== 'abierto') {
      throw new AppError('No se puede corregir un registro de un período cerrado', 409);
    }

    let horaEntrada = datos.hora_entrada !== undefined ? datos.hora_entrada : registro.hora_entrada;
    let horaSalida = datos.hora_salida !== undefined ? datos.hora_salida : registro.hora_salida;
    // Solo en la corrección por sesiones: qué cambia en sesiones_detalle y en la primera entrada.
    let camposSesiones = {};
    let sesiones = null;

    if (porSesiones) {
      sesiones = validarSesiones(datos.sesiones, { cantidad: registro.sesiones, ultimaAbierta: !registro.hora_salida });
      const ultima = sesiones[sesiones.length - 1];
      horaEntrada = ultima.hora_entrada;
      horaSalida = ultima.hora_salida;
      camposSesiones = {
        sesiones_detalle: sesiones.slice(0, -1),
        hora_entrada_inicial: sesiones[0].hora_entrada,
      };
    } else if (horaEntrada && horaSalida && horaEntrada === horaSalida) {
      // No se bloquea salida < entrada aquí: un registro creado por marcarEntrada/marcarSalida
      // puede cruzar medianoche legítimamente. Solo la igualdad exacta es inequívocamente inválida.
      throw new AppError('La hora de salida no puede ser igual a la de entrada', 422);
    }

    // Mismo criterio que marcarSalida(): el tope de ordinarias es semanal, no por día.
    const lunesCorregir = getLunesDeSemana(registro.fecha);
    const { ordinarias: ordinariasAcumCorregir } =
      await RegistrosModel.sumarOrdinariasEnSemana(empresaId, registro.trabajador_id, lunesCorregir, registro.fecha);

    // Si no viene en la corrección, se preserva el flag ya persistido — de lo
    // contrario cada corregir() reintroduciría el descuento de almuerzo en un
    // día que el trabajador ya había marcado como jornada continua.
    const jornadaContinua = datos.jornada_continua !== undefined
      ? Boolean(datos.jornada_continua)
      : Boolean(registro.jornada_continua);

    const { sumarNocturnasFestivo, reglaDomingoHabitual } = await EmpresasModel.obtenerConfigRecargos(empresaId);
    const { clasificacion, recargoFestivo, numeroDiaFestivo } =
      await clasificarDiaFestivo(empresaId, registro.trabajador_id, registro.fecha, reglaDomingoHabitual);
    const horas = porSesiones
      ? calcularHorasSesiones({
          sesiones, fecha: registro.fecha, ordinariasAcum: ordinariasAcumCorregir,
          jornadaContinua, recargoFestivo, sumarNocturnasFestivo,
        })
      : calcularHoras({
          horaEntrada, horaSalida, fecha: registro.fecha, horasOrdinariasAcumuladas: ordinariasAcumCorregir,
          jornadaContinua, recargoFestivo, sumarNocturnasFestivo,
        });

    const tipoDiaEfectivo = datos.tipo_dia !== undefined ? datos.tipo_dia : registro.tipo_dia;

    await RegistrosModel.actualizar(empresaId, id, {
      ...camposSesiones,
      hora_entrada: horaEntrada || null,
      hora_salida: horaSalida || null,
      horas_ordinarias: horas.horas_ordinarias,
      horas_extra_diurnas: horas.horas_extra_diurnas,
      horas_extra_nocturnas: horas.horas_extra_nocturnas,
      horas_nocturnas: horas.horas_nocturnas,
      horas_festivo: horas.horas_festivo,
      es_festivo: horas.es_festivo,
      novedad: datos.novedad !== undefined ? datos.novedad : registro.novedad,
      tipo_dia: tipoDiaEfectivo,
      aprobado_por: usuario.sub,
      jornada_continua: jornadaContinua,
      horas_acumuladas_semana: ordinariasAcumCorregir,
    });

    // Compensatorio si es festivo o domingo Y se trabajó (Art. 179 CST) — misma
    // regla que crear()/marcarSalida(). Cubre el caso de completar acá (corrección
    // manual) una salida que el trabajador olvidó marcar: crearSiCorresponde() es
    // idempotente (INSERT IGNORE sobre origen_registro_id), así que no duplica el
    // compensatorio si ya existía.
    await CompensatoriosService.crearSiCorresponde(empresaId, {
      trabajadorId: registro.trabajador_id,
      periodoId: registro.periodo_id,
      fecha: registro.fecha,
      esFestivo: Boolean(horas.es_festivo),
      registroId: id,
      clasificacion,
      numeroDiaFestivo,
      sumarNocturnasFestivo,
      tipoDia: tipoDiaEfectivo,
    });

    if (notificar) {
      const trabajadorUsuarioId = await TrabajadoresModel.obtenerUsuarioId(registro.trabajador_id);
      if (trabajadorUsuarioId) {
        await NotificacionesService.notificar({
          empresaId,
          usuarioId: trabajadorUsuarioId,
          tipo: 'nomina.correccion',
          titulo: 'Tu horario fue modificado',
          mensaje: `Tu horario del ${registro.fecha} fue modificado por ${usuario.nombre || 'tu gestor'}.`,
          data: { registro_id: id },
        }).catch(() => {});
      }
    }

    return RegistrosModel.obtenerPorId(empresaId, id);
  },

  /**
   * Reprocesa todos los registros del período abierto con la configuración de
   * recargos ACTUAL de la empresa. Reutiliza corregir() día por día (no un
   * cálculo paralelo) para que la reclasificación sea idéntica, byte a byte, a
   * una corrección manual — incluida la creación idempotente de compensatorios.
   *
   * Pensado para cuando la empresa prende "Con recargos" (o cambia la regla de
   * domingo habitual) y quiere que los días YA registrados en el período
   * abierto también queden clasificados con la regla nueva — por defecto
   * corregir() no los toca (ver docs/REGLAS-CALCULO-PAGOS.md § Empresa que no
   * suma recargos). Períodos cerrados nunca se tocan (fuera del alcance:
   * obtenerAbiertoPorFecha solo encuentra el abierto).
   *
   * Un registro sin salida (jornada en curso, sesiones = 1) se salta: no hay
   * nada cerrado que reclasificar todavía. Un día con reingreso sí se procesa
   * aunque su última sesión siga abierta (la sesión cerrada anterior sí tiene
   * horas que reclasificar); se reconstruye `sesiones` igual que lo hace la
   * web/mobile al editar (sesiones_detalle + la vigente).
   *
   * Un solo aviso por trabajador al final, no uno por día tocado.
   */
  async reprocesarPeriodoAbierto(empresaId, usuario) {
    const periodo = await PeriodosModel.obtenerAbiertoPorFecha(empresaId, hoyISO());
    if (!periodo) throw new AppError('No hay un período abierto para reprocesar', 404);

    const { data: registros } = await RegistrosModel.listar(empresaId, {
      periodoId: periodo.id, limit: 5000, offset: 0,
    });
    // El acumulador semanal de corregir() depende de los días ya corregidos
    // antes en la misma semana: hay que procesar en orden cronológico por
    // trabajador, no en el orden de listar() (fecha DESC).
    registros.sort((a, b) => a.trabajador_id - b.trabajador_id || a.fecha.localeCompare(b.fecha));

    let actualizados = 0;
    const trabajadoresAfectados = new Set();
    for (const r of registros) {
      if (!r.hora_entrada) continue;                 // tipo_dia sin horario (descanso, vacación, ...)
      if (r.sesiones === 1 && !r.hora_salida) continue; // jornada en curso: nada cerrado que reclasificar aún

      const datos = r.sesiones > 1
        ? { sesiones: [...(r.sesiones_detalle ?? []), { hora_entrada: r.hora_entrada, hora_salida: r.hora_salida }] }
        : {};
      await RegistrosGestionService.corregir(empresaId, usuario, r.id, datos, { notificar: false });
      actualizados++;
      trabajadoresAfectados.add(r.trabajador_id);
    }

    for (const trabajadorId of trabajadoresAfectados) {
      const usuarioId = await TrabajadoresModel.obtenerUsuarioId(trabajadorId);
      if (usuarioId) {
        await NotificacionesService.notificar({
          empresaId,
          usuarioId,
          tipo: 'nomina.correccion',
          titulo: 'Tu horario fue recalculado',
          mensaje: 'La empresa actualizó cómo se calculan los recargos; tus horas de este período se recalcularon.',
        }).catch(() => {});
      }
    }

    return { periodo_id: periodo.id, registros_actualizados: actualizados };
  },

  // ── Marcaje en tiempo real ───────────────────────────────────────────────
};

module.exports = RegistrosGestionService;
