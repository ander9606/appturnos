# Notificaciones codificadas por rol

Inventario de todos los `tipo` de notificación que dispara `NotificacionesService.notificar()` /
`notificarVarios()`, agrupados por quién los recibe. Generado a partir de un barrido manual del
código — si agregas o quitas una notificación, actualiza esta tabla.

Para regenerar el barrido: `grep -rn "NotificacionesService\.\(notificar\|notificarVarios\)(" backend/modules`.

## Trabajador (`trabajador_turnos` / `trabajador_nomina`)

| Tipo | Título | Cuándo se dispara | Código |
|---|---|---|---|
| `oferta.nueva` | Nueva oferta: {cargo} | Se publica una oferta con un cargo que el trabajador tiene certificado | `ofertas.service.js:152` |
| `oferta.modificada` | Turno modificado | Cambia fecha/hora/lugar de una oferta con gente ya asignada | `ofertas.service.js:185` |
| `oferta.cancelada` | Turno cancelado | Se cancela una oferta con asignados | `ofertas.service.js:208` |
| `postulacion.confirmada` | Turno confirmado / Turno asignado | Gestor confirma su postulación, o lo asigna directo | `asignaciones.service.js:164,442` |
| `postulacion.rechazada` | Postulación no aceptada | Gestor rechaza su postulación pendiente | `asignaciones.service.js:242` |
| `asignacion.cancelada` | Turno cancelado | Gestor cancela una asignación ya confirmada | `asignaciones.service.js:205` |
| `asignacion.no_presentado` | Turno marcado como no presentado | Gestor lo marca como no-show individualmente | `asignaciones.service.js:533` |
| `turno.cerrado_gestor` | Jornada finalizada | Gestor cierra masivamente una oferta en progreso | `asignaciones.service.js:626` |
| `turno.no_presentado_gestor` | Marcado como no presentado | Cierre masivo, ausentes sin marcar ingreso | `asignaciones.service.js:636` |
| `calificacion.recibida` | Recibiste una calificación | Gestor califica el turno completado | `asignaciones.service.js:678` |
| `novedad_turno` | Retraso/Ausencia/Incidente/Novedad | Otro participante del mismo turno reporta una novedad | `novedades.service.js:35` |
| `ausencia.resuelta` | Ausencia aprobada/rechazada | Gestor resuelve su solicitud de ausencia | `ausencias.service.js:66` |
| `nomina.compensatorio_asignado` | Descanso compensatorio asignado | Sistema asigna día compensatorio (festivo/domingo trabajado) | `compensatorios.service.js:100` |
| `nomina.periodo_abierto` | Nuevo período de nómina abierto | Solo `trabajador_nomina` — se abre período | `periodos.service.js:53` |
| `nomina.periodo_liquidado` | ¡Tu nómina fue pagada! | Solo `trabajador_nomina` — se liquida período | `periodos.service.js:126` |
| `nomina.recordatorio_salida` | Llevas 8 horas trabajando | Solo `trabajador_nomina` — jornada activa supera las horas ordinarias (empieza a hacer extra) | `registros.worker.js:52` |
| `reingreso.aprobado` / `reingreso.rechazado` | Reingreso aprobado / no autorizado | Gestor decide sobre solicitud de reingreso | `registros.service.js:455,463` |
| `invitacion_empresa` | Nueva invitación de empresa | Empresa invita por cédula a alguien sin cuenta vinculada aún | `trabajador-empresa.service.js:161` |
| `trabajador_empresa.aprobado` | Solicitud aprobada | Gestor aprueba su solicitud de vinculación | `trabajador-empresa.service.js:214` |
| `asignacion.correccion` | Tu horario fue modificado | Gestor corrige ingreso/egreso real de una asignación de turno | `asignaciones.service.js:590` |
| `nomina.correccion` | Tu horario fue modificado | Gestor corrige hora_entrada/hora_salida de un registro diario | `registros.service.js:298` |
| `contrato.pendiente_firma` | Falta firmar tu contrato | Gestor corrige un turno ya completado y el minicontrato queda por firmar | `asignaciones.service.js:623` |
| `nomina.recordatorio_ingreso` | Tu turno está por empezar | Cron 15 min, `trabajador_nomina` con horario fijo dentro de los 15 min previos a su hora de entrada y sin marcar aún | `recordatorioIngreso.worker.js:41` |
| `nomina.descuento_pendiente` | Tienes un descuento por aceptar | Gestor registra un descuento de nómina | `descuentos.service.js:27` |
| `nomina.ciclo_cambiado` | Cambió el ciclo de nómina | Cambia `empresas.tipo_liquidacion`; también llega a gestores | `periodos.service.js:171` |
| `trabajador_empresa.bienvenida_nomina` | Ya eres parte de la nómina de {empresa} | Acepta una invitación de nómina (conversión turnos → nómina) | `trabajador-empresa.service.js:322` |

## Gestor (`admin_empresa` / `jefe_turnos`, por empresa)

| Tipo | Título | Cuándo se dispara | Código |
|---|---|---|---|
| `turno.ingreso` | Trabajador marcó ingreso | Un trabajador marca ingreso a un turno | `asignaciones.service.js:327` |
| `turno.egreso` | Trabajador marcó salida | Un trabajador marca salida de un turno | `asignaciones.service.js:372` |
| `postulacion.nueva` | Nueva postulación | Un trabajador se postula a un puesto | `ofertas.service.js:331` |
| `oferta.personal_incompleto` | Personal incompleto en turno | Cron 24h antes del turno, plazas sin cubrir | `turnos.worker.js:16` |
| `trabajador_empresa.solicitud` | Nueva solicitud de vinculación | Trabajador pide unirse a la empresa | `trabajador-empresa.service.js:87,102` |
| `trabajador_empresa.aceptada` | Invitación aceptada | Trabajador acepta una invitación previa del gestor | `trabajador-empresa.service.js:246` |
| `ausencia.nueva` | Nueva solicitud de ausencia | Trabajador solicita una ausencia | `ausencias.service.js:42` |
| `nomina.horas_extra_iniciadas` | Horas extra en curso | Trabajador lleva horas extra hoy | `registros.worker.js:56` |
| `nomina.compensatorios_hoy` | N trabajador(es) de compensatorio hoy | Cron 15 min, resumen diario (una vez por compensatorio) de quién tiene `fecha_asignada` = hoy | `compensatorios.worker.js` |
| `nomina.entrada` | Entrada registrada | Trabajador marca entrada (registro diario) | `registros.service.js:306` |
| `nomina.salida` | Salida registrada | Trabajador marca salida (registro diario) | `registros.service.js:382` |
| `reingreso.solicitado` | Solicitud de reingreso | Trabajador pide reingresar | `registros.service.js:438` |
| `turno.sospechoso` | Posible marcaje fraudulento | Dos trabajadores marcan ingreso a turnos distintos desde el mismo dispositivo | `asignaciones.service.js:44` |
| `nomina.sospechoso` | Posible marcaje fraudulento | Dos trabajadores marcan registro diario desde el mismo dispositivo | `registros.service.js:93` |
| `nomina.descuento_respondido` | Descuento aceptado / rechazado | Trabajador responde a un descuento pendiente | `descuentos.service.js:69` |
| `trabajador_empresa.archivado_por_conversion` | Trabajador ya no disponible | Uno de sus trabajadores se convirtió a nómina de otra empresa | `trabajador-empresa.service.js:313` |

## Solo `admin_empresa`

| Tipo | Título | Cuándo se dispara | Código |
|---|---|---|---|
| `integracion.activada` | Conectados de nuevo con logiq360 | logiq360 reconecta la integración | `entrantes.handlers.js:244` |
| `integracion.desactivada` | Se desconectó tu integración con logiq360 | logiq360 desconecta la integración | `entrantes.handlers.js:257` |
| `suscripcion.pago_rechazado` | Pago rechazado | Wompi rechaza un intento de pago | `wompi.service.js:81` |

## Solo `super_admin` (cross-tenant, `empresa_id` null — via `notificarSuperAdmins()`)

| Tipo | Título | Cuándo se dispara | Código |
|---|---|---|---|
| `admin.empresa_nueva` | Nueva empresa registrada | Alguien se registra self-service (`registrarEmpresa`) | `auth.service.js` |
| `suscripcion.pago_rechazado` | Pago rechazado | Igual que arriba, copia adicional con `empresa_id` en `data` para navegar a `/empresa/[id]` | `wompi.service.js` |
| `integracion.desactivada` | Se desconectó una integración con logiq360 | Igual que arriba, copia adicional a super_admin | `entrantes.handlers.js` |
| `admin.suscripcion_vencimiento` | Suscripción por vencer / vencida | Cron diario (`suscripcion.worker.js`), empresas con pago directo (no logiq360) a 7/3/0 días de vencer o 3 días ya vencidas | `suscripcion.worker.js` |

## Huecos conocidos (no es que fallen — no existen)

- Nada notifica a `jefe_nomina` ni a `nomina` (rol de solo lectura) específicamente — comparten
  los tipos de nómina solo si también son `admin_empresa`.
- No hay notificación al **crear** un período/oferta desde cero, solo en cambios sobre algo existente.

## Navegación al tocar (`destino()` en `apps/mobile/app/notificaciones.tsx`)

Cada `tipo` debe resolver a una pantalla útil (revisado 2026-09-12, ver `git log` de ese archivo
para el detalle). Antes de esa revisión, estos tipos caían al fallback genérico (bandeja de
notificaciones) o —peor— a una pantalla bloqueada por rol:
- `nomina.sospechoso` / `nomina.horas_extra_iniciadas` (gestor) mandaban a `/nomina-ingreso`,
  bloqueada por `useRoleGuard(['trabajador_nomina'])` — ahora van a `/registro-detalle/[id]`.
- `integracion.activada` / `integracion.desactivada` (copia propia de `admin_empresa`, sin `data`)
  no navegaban a ningún lado — ahora van a `/integracion/config`.
- `nomina.compensatorios_hoy`, `nomina.descuento_pendiente`, `nomina.descuento_respondido`,
  `nomina.ciclo_cambiado` (sin período nuevo) y `nomina.recordatorio_ingreso` no tenían caso en
  `destino()` — ahora resuelven a `/gestor-compensatorios`, `/(tabs)/nomina` (los tres de
  descuento/ciclo) y `/nomina-ingreso` respectivamente.
