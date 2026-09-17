# Puntos de Conexión: logiq360 ↔ App Turnos
## Diseño de Integración Bidireccional

**Versión:** 1.0  
**Fecha:** 2026-05-21  

---

## PRINCIPIOS DE DISEÑO

```
1. LOOSE COUPLING
   Los sistemas no se llaman directamente entre sí en el flujo crítico.
   Usan eventos asincrónicos. Si uno cae, el otro sigue funcionando.

2. IDEMPOTENCIA
   Recibir el mismo evento dos veces no rompe nada.
   Cada evento lleva un ID único para deduplicación.

3. CONTRATO EXPLÍCITO
   El payload de cada evento es un contrato versionado.
   Cambios en el contrato requieren nueva versión del evento.

4. TOLERANCIA A FALLOS
   Si la App Turnos está caída, logiq360 encola el evento.
   Si logiq360 está caído, la App Turnos sigue operando.

5. TRAZABILIDAD
   Todo evento se loguea en ambos sistemas con el mismo event_id.
```

---

## MAPA DE CONEXIONES

```
logiq360                              App Turnos
────────────────────────────────────────────────────────────────

SALIDAS (logiq360 → App Turnos):

orden.creada          ──────────────►  Crear oferta_turno (borrador)
orden.publicada       ──────────────►  Publicar oferta_turno (notificar pool)
orden.cancelada       ──────────────►  Cancelar oferta_turno + contratos
orden.fecha_cambiada  ──────────────►  Actualizar fecha en oferta_turno
orden.completada      ──────────────►  Cerrar oferta_turno
empleado.creado       ──────────────►  (opcional) Crear trabajador
empleado.desactivado  ──────────────►  (opcional) Desactivar trabajador
integracion.activada     ───────────►  Sincroniza integracion_config.activo = 1
integracion.desactivada  ───────────►  Sincroniza integracion_config.activo = 0


ENTRADAS (App Turnos → logiq360):

oferta.cubierta       ──────────────►  Actualizar equipo en orden_trabajo
trabajador.ingreso    ──────────────►  Registrar en historial_estados orden
trabajador.egreso     ──────────────►  Actualizar estado equipo
contrato.completado   ──────────────►  Marcar empleado como completado en orden
novedad.reportada     ──────────────►  Crear alerta_operacion
costo_labor.calculado ──────────────►  Actualizar costo mano de obra en orden


CONSULTAS SÍNCRONAS (pull cuando se necesita):

App Turnos → logiq360:
  GET /api/integracion/public/ping                   Health check (reconciliación diaria)
  GET /api/integracion/public/empleados               Candidatos para conciliación de personal
  GET /api/integracion/public/ordenes/:id             ⚠️ expuesto, no consumido (ver nota)
  GET /api/integracion/public/ordenes/:id/productos   ⚠️ expuesto, no consumido (ver nota)

logiq360 → App Turnos:
  GET /api/integracion/public/ping                   Test de conectividad
  GET /api/integracion/public/estado/:external_ref   Estado actual de la oferta/contratos
  GET /api/integracion/public/en-sitio/:external_ref Quién está en campo ahora
  GET /api/integracion/public/trabajadores           Sincronizar personal de turnos → empleados
```

> ⚠️ **Endpoints huérfanos (verificado 2026-09-17):** `public/ordenes/:id` y
> `public/ordenes/:id/productos` existen y funcionan en logiq360, pero
> **App Turnos nunca los llama** (cero referencias en `appturnos/backend`).
> Probablemente quedaron de un diseño anterior a que `productos_resumen`
> se empezara a enviar embebido dentro del payload de `orden.creada` — ya
> no hace falta una segunda consulta para eso. Decidir si se conectan a un
> caso de uso real (ej. refrescar productos sin esperar un nuevo evento) o
> se retiran.

---

## AUTENTICACIÓN ENTRE SISTEMAS

El mecanismo real **no es simétrico** — cada dirección usa una combinación distinta,
verificada línea por línea contra el código el 2026-09-17:

```
1) logiq360 → App Turnos, EVENTOS (POST /api/integracion/eventos)
   Firma HMAC-SHA256 del body con el secreto S_A (= incoming_secret en App Turnos).
   Header: X-Logiq360-Signature: sha256=<hmac>
   Header: X-Logiq360-Event: <tipo_evento>
   NO envía X-API-Key en esta llamada — la autenticación es solo la firma.
   Verificado por: middleware/verificarFirmaLogiq360.js (App Turnos)

2) App Turnos → logiq360, EVENTOS (POST /api/integracion/eventos)
   Requiere X-API-Key: <key entregada por logiq360 al emparejar> (obligatoria).
   Si logiq360 configuró incoming_secret, además verifica firma:
   Header: X-Turnos-Signature: sha256=<hmac>
   Verificado por: middleware/verificarIntegracionKey.js (logiq360)

3) Consultas pull en ambas direcciones (GET /api/integracion/public/...)
   Header: X-API-Key: <key del que consulta>
   Sin firma HMAC — la API Key es la única credencial.

No existen los headers X-Integration-Source ni X-Event-ID en la implementación
real; el event_id viaja dentro del body JSON, no como header.
```

---

## PARTE 1 — SALIDAS DE logiq360

### Tabla de eventos salientes

```sql
-- En logiq360: registro de eventos enviados a App Turnos (schema real, IntegracionTurnosModel.js)
CREATE TABLE integration_events_out (
  id              INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id       INT NOT NULL,
  event_id        VARCHAR(36) NOT NULL,        -- UUID único del evento
  tipo_evento     VARCHAR(100) NOT NULL,       -- "orden.creada"
  payload         JSON NOT NULL,
  estado          ENUM('pendiente','enviado','descartado') DEFAULT 'pendiente',
  intentos        INT DEFAULT 0,
  ultimo_error    TEXT NULL,
  enviado_at      TIMESTAMP NULL,
  proximo_intento DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP

  -- UNIQUE KEY sobre event_id (dedup) + índice sobre (estado, proximo_intento)
);
```
> No hay columnas `event_type`/`target_system`/`target_url`: el nombre real
> del campo es `tipo_evento`, y el destino (`webhook_url`, `webhook_secret`)
> se resuelve con un JOIN a `integraciones_turnos` al leer la cola
> (`obtenerEventosPendientes`), no se duplica por evento. El estado terminal
> tras agotar reintentos se llama `descartado`, no `fallido` (ese nombre sí
> se usa del lado de App Turnos, en `integracion_config`/`integration_events_out`
> — cada app nombra su propio enum de forma independiente).

---

### EVENTO: `orden.creada`

**Cuándo se dispara:** Al aprobar una cotización y generar órdenes de trabajo  
**Código fuente logiq360:** `CotizacionAprobacionService.js` → después de crear las órdenes

```javascript
// logiq360/modules/alquileres/services/CotizacionAprobacionService.js
// Al final de aprobarYCrearAlquiler(), agregar:

// Firma real: IntegracionTurnosService.emitir(tenantId, tipoEvento, payload)
// Solo inserta en integration_events_out — el envío HTTP lo hace el worker (Parte 8).
await IntegracionTurnosService.emitir(
    tenantId,
    'orden.creada',
    IntegracionTurnosService.payloadOrdenCreada(ordenMontaje, cotizacion, alquiler)
);
```

`payloadOrdenCreada()` ya resuelve `hora_inicio`/`hora_fin` (migraciones 56/61/63
agregaron esas columnas a `ordenes_trabajo`) y `latitud`/`longitud` de la ubicación
del evento — los "datos faltantes" de la versión 1.0 de este documento **ya se
implementaron** (ver Parte 6, marcada como resuelta). También resuelve
`cupos_gig`/`cupos_custodio` y sus tarifas: primero mira si la cotización trae un
override propio, si no cae al default configurado en `integraciones_turnos`
(`cupos_gig_default`, `valor_dia_gig_default`, etc.), y si tampoco hay eso, van en
`null` (el `jefe_turnos` los completa a mano en Zaturno).

**Payload completo:**
```json
{
  "event_id": "550e8400-e29b-41d4-a716-446655440000",
  "event_type": "orden.creada",
  "version": "1.0",
  "source": "logiq360",
  "tenant_slug": "empresa-xyz",
  "timestamp": "2026-05-21T10:00:00Z",
  "data": {
    "external_ref": "logiq360:orden:47",
    "tipo": "montaje",
    "titulo": "Montaje - Boda García-Pérez",
    "descripcion": null,
    "fecha": "2026-05-25",
    "hora_inicio": null,
    "hora_fin": null,
    "ubicacion": "Finca El Refugio, Vía Cajicá km 3, Chía",
    "latitud": 4.8567,
    "longitud": -74.0124,
    "cupos_sugeridos": null,
    "valor_dia_sugerido": null,
    "notas_para_operario": "Llegada antes de 6AM. Patio trasero.",
    "productos_resumen": [
      { "nombre": "Carpa 10x10 Premium", "cantidad": 3 },
      { "nombre": "Sistema iluminación", "cantidad": 1 }
    ],
    "alquiler_ref": "logiq360:alquiler:31"
  }
}
```

**Qué hace App Turnos al recibirlo:**
```
1. Verifica que no existe ya un registro con este external_ref (idempotencia)
2. Crea oferta_turno en estado 'borrador' con external_ref = "logiq360:orden:47"
3. El jefe_turnos recibe notificación: "Nueva orden lista para publicar"
4. El jefe_turnos completa: cupos, valor_dia, hora_inicio, hora_fin
5. El jefe_turnos publica la oferta manualmente (o automático si está configurado)
```

---

### EVENTO: `orden.cancelada`

**Cuándo se dispara:** Al cancelar un alquiler o una orden de trabajo  
**Código fuente logiq360:** `eventoController.cambiarEstado()` / `alquilerController.cancelar()`

```json
{
  "event_id": "...",
  "event_type": "orden.cancelada",
  "version": "1.0",
  "source": "logiq360",
  "tenant_slug": "empresa-xyz",
  "timestamp": "2026-05-21T10:00:00Z",
  "data": {
    "external_ref": "logiq360:orden:47",
    "motivo": "Cliente canceló el evento",
    "cancelada_at": "2026-05-21T10:00:00Z"
  }
}
```

**Qué hace App Turnos:**
```
1. Busca oferta_turno donde external_ref = "logiq360:orden:47"
2. Cancela la oferta
3. Cancela todos los contratos_dia en estado 'pendiente' o 'en_curso'
4. Envía push notification a cada trabajador: "El trabajo fue cancelado"
5. Si había contratos 'completados': NO se cancelan (ya trabajaron)
```

---

### EVENTO: `orden.fecha_cambiada`

**Cuándo se dispara:** Al reprogramar una orden de trabajo  
**Código fuente logiq360:** `OrdenTrabajoModel.cambiarFecha()`

```json
{
  "event_id": "...",
  "event_type": "orden.fecha_cambiada",
  "version": "1.0",
  "data": {
    "external_ref": "logiq360:orden:47",
    "fecha_anterior": "2026-05-25",
    "fecha_nueva": "2026-05-26",
    "motivo": "El cliente solicitó reprogramación"
  }
}
```

**Qué hace App Turnos:**
```
1. Actualiza fecha en oferta_turno
2. Actualiza fecha en contratos_dia pendientes
3. Notifica a trabajadores que habían aceptado: "Fecha cambiada a 26 Mayo"
4. Los trabajadores pueden: confirmar disponibilidad nueva fecha | retractarse
```

---

### EVENTO: `empleado.creado` *(opcional, configurable)*

**Cuándo se dispara:** Al crear empleado en logiq360 (solo si integración tiene sync_empleados=true)

```json
{
  "event_id": "...",
  "event_type": "empleado.creado",
  "version": "1.0",
  "data": {
    "external_ref": "logiq360:empleado:12",
    "nombre": "Juan",
    "apellido": "Rodríguez",
    "email": "juan@empresa.com",
    "telefono": "+57 300 111 2222",
    "rol_tipo": "nomina",
    "foto_url": "/uploads/perfiles/juan.jpg"
  }
}
```

> **NOTA:** El email es el campo de sincronización. Si en App Turnos ya existe un  
> trabajador con ese email, se vinculan. Si no existe, se crea.  
> La contraseña NO se sincroniza — el trabajador recibe invitación por email.

---

### EVENTO: `integracion.activada` / `integracion.desactivada`

**Cuándo se dispara:** Un operador de logiq360 conecta o desconecta a este cliente
de Zaturno desde el panel de integraciones (`integraciones_turnos.activo`).

**Por qué existe:** La facturación de Zaturno decide si una empresa usa la app
gratis derivándolo en vivo de `integracion_config.activo` + `api_key`. Sin este
evento, si logiq360 desconecta a un cliente de su lado, Zaturno nunca se entera y
el cliente sigue con acceso gratis indefinidamente. Estos dos eventos cierran ese
loop: App Turnos sincroniza su propio `integracion_config.activo` al recibirlos.

**Se acepta aunque la integración esté marcada inactiva del lado de App Turnos**
(a diferencia del resto de eventos, que requieren `integracion_config.activo=1`)
— de lo contrario `integracion.activada` nunca podría reactivar nada.

```json
{
  "event_id": "...",
  "event_type": "integracion.desactivada",
  "version": "1.0",
  "data": {}
}
```

> No lleva datos de negocio — solo anuncia el cambio de estado del toggle.

---

## PARTE 2 — ENTRADAS A logiq360

### Tabla de eventos entrantes

```sql
-- En logiq360: registro de eventos recibidos de App Turnos (schema real)
CREATE TABLE integration_events_in (
  id            INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id     INT NOT NULL,
  event_id      VARCHAR(36) NOT NULL,
  tipo_evento   VARCHAR(100) NOT NULL,
  payload       JSON NOT NULL,
  estado        ENUM('recibido','procesado','error') DEFAULT 'recibido',
  error_detalle TEXT NULL,
  procesado_at  TIMESTAMP NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP

  -- UNIQUE KEY sobre event_id (deduplicación)
);
```
> No hay `event_type`/`source_system`/`procesado BOOLEAN`: el origen es
> implícito (solo App Turnos llama a este endpoint) y el progreso se modela
> con el `estado` de tres valores, no un booleano.

---

### EVENTO: `trabajador.ingreso`

**Cuándo llega:** Cuando un trabajador marca ingreso en la app  
**Endpoint en logiq360:** `POST /api/integracion/eventos` (mismo endpoint recibe todos los tipos de evento; el body trae `tipo_evento` para distinguirlos, ver Parte 9)

```json
{
  "event_id": "...",
  "event_type": "trabajador.ingreso",
  "version": "1.0",
  "source": "app_turnos",
  "timestamp": "2026-05-25T06:02:15Z",
  "data": {
    "external_ref": "logiq360:orden:47",
    "trabajador_external_ref": "logiq360:empleado:12",
    "trabajador_nombre": "Juan Rodríguez",
    "hora_ingreso": "2026-05-25T06:02:15Z",
    "latitud": 4.8567,
    "longitud": -74.0124,
    "dentro_zona": true,
    "distancia_metros": 120,
    "contrato_id": "at:contrato:301"
  }
}
```

**Qué hace logiq360:**
```javascript
// IntegracionTurnosEventHandler.js
async procesarTrabajadorIngreso(tenantId, data) {
    const ordenId = extraerIdDeRef(data.external_ref);     // 47
    const empleadoId = extraerIdDeRef(data.trabajador_external_ref); // 12

    // 1. Registrar en historial de la orden
    await OrdenTrabajoHistorialModel.registrarCambioEstado(
        tenantId, ordenId,
        null, 'en_sitio',
        null,
        `Ingreso de ${data.trabajador_nombre} a las ${formatHora(data.hora_ingreso)}`
    );

    // 2. Crear notificación para jefe_nomina/coordinador
    await NotificacionModel.crear(tenantId, {
        tipo: 'trabajador_ingreso',
        titulo: `${data.trabajador_nombre} marcó ingreso`,
        mensaje: `En sitio para orden #${ordenId} — ${formatHora(data.hora_ingreso)}`,
        referencia_id: ordenId,
        referencia_tipo: 'orden_trabajo'
    });

    // 3. Si todos los asignados ya marcaron ingreso → cambiar estado a 'en_proceso'
    await verificarYActualizarEstadoOrden(tenantId, ordenId);
}
```

---

### EVENTO: `contrato.completado`

**El más importante** — cuando un trabajador termina su día y el jefe firma

```json
{
  "event_id": "...",
  "event_type": "contrato.completado",
  "version": "1.0",
  "source": "app_turnos",
  "data": {
    "external_ref": "logiq360:orden:47",
    "trabajador_external_ref": "logiq360:empleado:12",
    "trabajador_nombre": "Juan Rodríguez",
    "fecha": "2026-05-25",
    "hora_ingreso": "2026-05-25T06:02:15Z",
    "hora_egreso": "2026-05-25T16:05:43Z",
    "minutos_trabajados": 603,
    "valor_pagado": 120000,
    "dentro_zona_ingreso": true,
    "dentro_zona_egreso": true,
    "firma_trabajador": true,
    "firma_jefe": true,
    "contrato_id": "at:contrato:301"
  }
}
```

**Qué hace logiq360:**
```javascript
async procesarContratoCompletado(tenantId, data) {
    const ordenId = extraerIdDeRef(data.external_ref);

    // 1. Si el empleado es de nómina interna, actualizar su turno_nomina
    const empleadoId = extraerIdDeRef(data.trabajador_external_ref);
    if (empleadoId) {
        // El turno de nómina ya fue registrado en su propio sistema,
        // pero actualizamos la referencia cruzada
        await pool.query(`
            UPDATE orden_trabajo_equipo
            SET horas_trabajadas = ?,
                completado_at = ?
            WHERE tenant_id = ? AND orden_id = ? AND empleado_id = ?
        `, [
            Math.round(data.minutos_trabajados / 60 * 100) / 100,
            data.hora_egreso,
            tenantId, ordenId, empleadoId
        ]);
    }

    // 2. Acumular costo de mano de obra en la orden
    await pool.query(`
        UPDATE ordenes_trabajo
        SET costo_mano_obra = COALESCE(costo_mano_obra, 0) + ?
        WHERE tenant_id = ? AND id = ?
    `, [data.valor_pagado, tenantId, ordenId]);

    // 3. Verificar si TODOS completaron → cambiar estado de la orden
    await verificarCompletitudOrden(tenantId, ordenId);
}
```

---

### EVENTO: `novedad.reportada` *(implementado — v1.4)*

**Cuando un trabajador reporta una novedad desde la app de turnos**
(`POST /api/novedades/asignaciones/:asignacionId` en App Turnos).

> **Nota:** el payload real usa los tipos de App Turnos (`retraso | ausencia
> | incidente | otro`), no los de logiq360 (`dano_elemento`, etc. — esos
> son para las novedades internas de operarios de logiq360, tabla
> `orden_trabajo_novedades`, un concepto distinto). No incluye `imagen_url`
> — la foto se queda en App Turnos como base64; solo viaja `tiene_foto`
> como bandera informativa. Coordenadas GPS opcionales: van si el
> trabajador compartió ubicación al reportar (best-effort, nunca bloquea
> el envío).

```json
{
  "event_id": "...",
  "event_type": "novedad.reportada",
  "version": "1.0",
  "data": {
    "external_ref": "logiq360:orden:47",
    "trabajador_nombre": "Pedro Gómez",
    "tipo_novedad": "incidente",
    "descripcion": "Tubo galvanizado doblado, no apto para instalación",
    "hora_evento": "2026-05-25T08:15:33-05:00",
    "latitud": 4.8567,
    "longitud": -74.0124,
    "tiene_foto": true
  }
}
```

**Qué hace logiq360:** inserta en su tabla `novedades` (migración 80),
distinta de `orden_trabajo_novedades`:
```javascript
// EventHandlerService.js
await pool.query(
    `INSERT INTO novedades
        (tenant_id, id_orden, tipo, descripcion, prioridad, trabajador_nombre, latitud, longitud, creado_por_integracion)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [tenantId, ordenId, data.tipo_novedad || 'otro', data.descripcion || '',
     data.prioridad || 'media', data.trabajador_nombre || null,
     data.latitud ?? null, data.longitud ?? null]
);
```

---

### EVENTO: `oferta.cubierta` *(implementado — v1.5)*

**Cuando todos los puestos de la oferta llegan a plazas_cubiertas >= plazas.**
Se emite una sola vez por oferta (idempotente vía `ofertas_turno.cobertura_notificada`,
migración 057), disparado justo después de cada confirmación/asignación directa
que podría haber completado el cupo (`CoberturaService.verificarYEmitir`).

> `trabajadores[].rol` viaja como el `cargo_codigo` del puesto en Zaturno (valor
> libre por tenant). logiq360 lo mapea a su ENUM fijo
> (`responsable|operario|conductor|auxiliar`); cualquier valor que no reconozca
> cae en `'operario'`.

```json
{
  "event_id": "...",
  "event_type": "oferta.cubierta",
  "version": "1.0",
  "data": {
    "external_ref": "logiq360:orden:47",
    "cupos_requeridos": 5,
    "cupos_cubiertos": 5,
    "trabajadores": [
      { "nombre": "Pedro Gómez",  "external_ref": "logiq360:empleado:15", "rol": "auxiliar" },
      { "nombre": "María López",  "external_ref": null, "rol": "auxiliar" },
      { "nombre": "Carlos Ruiz",  "external_ref": null, "rol": "auxiliar" }
    ]
  }
}
```

**Qué hace logiq360:** asigna cada trabajador conciliado (con `external_ref`
resoluble) al equipo de la orden — los que aún no tienen empleado vinculado en
logiq360 (`external_ref: null`) se omiten, igual que en `asignacion.confirmada`:
```javascript
// EventHandlerService.js
for (const t of payload.trabajadores) {
    const empleadoId = extraerIdRef(t.external_ref, 'empleado');
    if (!empleadoId) continue;
    const rol = ROLES_VALIDOS.has(t.rol) ? t.rol : 'operario';
    await pool.query(
        `INSERT INTO orden_trabajo_equipo
            (tenant_id, orden_id, empleado_id, rol_en_orden, estado_asignacion)
         VALUES (?, ?, ?, ?, 'aceptada')
         ON DUPLICATE KEY UPDATE estado_asignacion = 'aceptada'`,
        [tenantId, ordenId, empleadoId, rol]
    );
}
```

---

## PARTE 3 — CONSULTAS SÍNCRONAS

Usadas cuando se necesita información inmediata (no por evento).

### App Turnos → logiq360

> ⚠️ Ambos endpoints de esta subsección existen y responden en logiq360, pero
> **App Turnos no los consume actualmente** (ver nota en "MAPA DE CONEXIONES").
> Se documentan tal como están implementados por si se decide conectarlos.

```
GET /api/integracion/public/ordenes/{id}
Header: X-API-Key: <key de App Turnos>

Response:
{
  "success": true,
  "data": {
    "external_ref": "logiq360:orden:47",
    "tipo": "montaje",
    "evento_nombre": "Boda García-Pérez",
    "fecha": "2026-05-25",
    "ubicacion": "Finca El Refugio, Chía",
    "estado": "en_preparacion",
    "notas": "Llegada antes de 6AM. Patio trasero.",
    "productos": [
      { "nombre": "Carpa 10x10 Premium", "cantidad": 3, "instrucciones": null },
      { "nombre": "Sistema iluminación", "cantidad": 1, "instrucciones": null }
    ]
    // NO incluye: totales económicos, datos fiscales del cliente
  }
}
```

```
GET /api/integracion/public/ordenes/{id}/productos
→ Lista de elementos compuestos con componentes y fotos de referencia
   (para que el operario sepa qué armar y cómo)
```

```
GET /api/integracion/public/ping
Header: X-API-Key: <key de App Turnos>

Response 200: { "success": true, "data": { "activo": true } }
Response 401/402: la api_key ya no autentica (activo=0 del lado de logiq360,
                    o el plan dejó de incluir la integración)
```

**Reconciliación periódica (v1.3):** App Turnos llama este ping una vez al día
(worker `integracion.worker.js`, ver `services/reconciliacion.service.js`) para
cada empresa emparejada, y compara la respuesta contra su propio
`integracion_config.activo`. Si difieren, se autocorrige reprocesando
`integracion.activada`/`integracion.desactivada` como si el evento acabara de
llegar — la misma lógica de actualizar + notificar, sin duplicarla. Esto cierra
la ventana en la que ese webhook se pierde tras agotar sus 5 reintentos: los
webhooks siguen siendo la vía rápida, pero el ping es la garantía de fondo de
que ambos lados no queden desincronizados indefinidamente.
Solo un 200 o un 401/402 mueven el estado local; cualquier otro error (5xx,
timeout, red caída) se ignora ese ciclo para no marcar como "desconectado" a un
cliente por una caída transitoria de logiq360.

---

### logiq360 → App Turnos

```
GET /api/integracion/public/estado/{external_ref}
Header: X-API-Key: <key de logiq360, entregada por App Turnos al emparejar>

Response (v1.1+):
{
  "success": true,
  "data": {
    "external_ref": "logiq360:orden:47",
    "oferta_id": 201,
    "estado": "abierta",
    "cupos_requeridos": 13,        // suma de puestos[].plazas
    "cupos_cubiertos": 4,          // suma de puestos[].plazas_cubiertas
    "puestos": [                   // ← agregado en v1.1
      {
        "cargo": "auxiliar",
        "plazas": 10,
        "plazas_cubiertas": 3,
        "tarifa_dia": 80000
      },
      {
        "cargo": "jefe_montaje",
        "plazas": 2,
        "plazas_cubiertas": 1,
        "tarifa_dia": 150000
      },
      {
        "cargo": "conductor",
        "plazas": 1,
        "plazas_cubiertas": 0,
        "tarifa_dia": 120000
      }
    ],
    "contratos": [
      {
        "trabajador_ref": "logiq360:empleado:15",
        "trabajador_nombre": "Pedro Gómez",
        "estado": "confirmado",
        "hora_ingreso": null,
        "hora_egreso": null
      }
    ]
  }
}
```

> **Cambio v1.1 (no breaking)**: se agregó el array `puestos[]` y los campos `cupos_*` ahora son sumas sobre puestos. Las ofertas creadas antes del refactor se materializan como 1 puesto único de cargo `auxiliar` con los valores originales. Si logiq360 ignora `puestos[]`, el comportamiento previo se conserva (`cupos_requeridos` / `cupos_cubiertos` siguen reflejando el total).

```
GET /api/integracion/public/en-sitio/{external_ref}
→ Quién está marcado como 'en_curso' en este momento

Response:
{
  "success": true,
  "data": {
    "external_ref": "logiq360:orden:47",
    "en_sitio": [
      {
        "nombre": "Pedro Gómez",
        "external_ref": "logiq360:empleado:15",
        "hora_ingreso": "2026-05-25T06:02:15Z",
        "dentro_zona": true
      }
    ],
    "total_en_sitio": 3,
    "total_esperados": 5
  }
}
```

---

## PARTE 4 — TABLA DE INTEGRACIÓN EN logiq360

```sql
-- Configura la conexión de logiq360 con una instancia de App Turnos (schema real)
CREATE TABLE integraciones_turnos (
  id                          INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id                   INT NOT NULL UNIQUE,
  nombre                      VARCHAR(100) DEFAULT 'Zaturno',
  webhook_url                 VARCHAR(500) NOT NULL,   -- URL COMPLETA de App Turnos (incluye /api/integracion/eventos)
  webhook_secret              VARCHAR(255) NOT NULL,   -- S_A: con este firma logiq360 lo que envía
  api_key_hash                VARCHAR(255) NOT NULL,   -- bcrypt de la key que App Turnos usa para llamarnos
  api_key_prefix              VARCHAR(20)  NOT NULL,   -- primeros chars, para lookup rápido sin decriptar
  activo                      TINYINT DEFAULT 1,
  eventos_suscritos           JSON,                    -- tipos de evento habilitados a emitir
  metadata                    JSON,                    -- app_turnos_base_url, app_turnos_api_key,
                                                         -- incoming_secret (S_B), y `pairing` temporal
  cupos_gig_default           INT NULL,
  valor_dia_gig_default       DECIMAL(10,2) NULL,
  cupos_custodio_default      INT NULL,
  valor_dia_custodio_default  DECIMAL(10,2) NULL,
  created_at                  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at                  TIMESTAMP NULL,

  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);
```
> No existen `app_url`/`api_key_entrante`/`api_key_saliente`/`sync_orden_*`/
> `publicar_automatico`/`valor_dia_default`/`cupos_default` como columnas —
> el gating de qué se sincroniza vive en `eventos_suscritos` (JSON) y en el
> feature del plan (`plan_features.integracion_turnos`), y los defaults de
> cupos/tarifa por cargo son 4 columnas dedicadas (gig y custodio), no un par
> genérico. "Publicar automático" no es un flag de esta tabla: la oferta
> siempre nace en `'borrador'` en App Turnos salvo que llegue también el
> evento `orden.publicada`.

---

## PARTE 5 — CAMPO `external_ref` EN App Turnos

```sql
-- En App Turnos, las tablas que se vinculan llevan external_ref
ALTER TABLE ofertas_turno
  ADD COLUMN external_ref VARCHAR(200) NULL COMMENT 'ej: logiq360:orden:47',
  ADD INDEX idx_ot_ext_ref (external_ref);

ALTER TABLE trabajadores           -- tabla propia de App Turnos
  ADD COLUMN external_ref VARCHAR(200) NULL COMMENT 'ej: logiq360:empleado:12',
  ADD UNIQUE INDEX uk_trab_ext_ref (external_ref);
```

**Formato del external_ref:**
```
{sistema}:{entidad}:{id}

logiq360:orden:47          → ordenes_trabajo.id = 47
logiq360:empleado:12       → empleados.id = 12
logiq360:alquiler:31       → alquileres.id = 31

Futuro:
sap:workorder:WO-2026-001  → integración con SAP
odoo:hr.leave:999          → integración con Odoo
```

---

## PARTE 6 — CAMPOS FALTANTES EN logiq360 ✅ RESUELTO (verificado 2026-09-17)

Los 4 cambios de esta sección **ya están implementados** (migraciones `56_add_ordenes_trabajo_horas.sql`,
`61_fix_missing_columns.sql`, `63_consolidated_54_62.sql`, y las columnas GPS confirmadas
en `IntegracionTurnosService.js`). Se conserva el listado original como referencia histórica:

```sql
-- 1. Coordenadas GPS en cotizaciones (para pasar a App Turnos)
ALTER TABLE cotizaciones
  ADD COLUMN evento_latitud  DECIMAL(10, 8) NULL AFTER evento_ciudad,
  ADD COLUMN evento_longitud DECIMAL(11, 8) NULL AFTER evento_latitud;

-- 2. Hora de inicio/fin en órdenes de trabajo (no solo fecha)
ALTER TABLE ordenes_trabajo
  ADD COLUMN hora_inicio TIME NULL AFTER fecha_programada,
  ADD COLUMN hora_fin    TIME NULL AFTER hora_inicio;

-- 3. Costo de mano de obra acumulado (recibido de App Turnos)
ALTER TABLE ordenes_trabajo
  ADD COLUMN costo_mano_obra DECIMAL(10, 2) DEFAULT 0
  COMMENT 'Acumulado desde App Turnos vía evento contrato.completado';

-- 4. Horas trabajadas por empleado en la orden
ALTER TABLE orden_trabajo_equipo
  ADD COLUMN horas_trabajadas DECIMAL(5, 2) NULL,
  ADD COLUMN completado_at    TIMESTAMP NULL;
```

---

## PARTE 7 — FLUJO COMPLETO DE PUNTA A PUNTA

```
LOGIQ360                                    APP TURNOS
────────────────────────────────────────────────────────────────────────

1. Cotización aprobada
   → CotizacionAprobacionService
   → Crea ordenes_trabajo #47 (montaje)
   → Emite evento "orden.creada" ─────────► Recibe evento
                                             Crea oferta_turno #201
                                             estado: 'borrador'
                                             external_ref: "logiq360:orden:47"

                                             Notifica a jefe_turnos:
                                             "Nueva orden lista"

2.                                           Jefe_turnos edita oferta:
                                             - cupos: 5
                                             - valor_dia: 120.000
                                             - hora_inicio: 06:00
                                             - hora_fin: 16:00
                                             Publica → notifica pool

3.                                           Trabajadores aceptan (4/5)

   Consulta estado ◄───────────────────────  GET /public/estado/logiq360:orden:47
   "cobertura 80%"
   Notifica coordinador:
   "Faltan 1 operario para orden #47"

                                             5to acepta → oferta cubierta
   ◄───────────────── "oferta.cubierta" ─── Emite evento
   Notifica coordinador:
   "Equipo completo para orden #47"

4. DÍA DEL TRABAJO (25 Mayo):

                                             06:02 Pedro marca ingreso
   ◄─────────── "trabajador.ingreso" ─────  Emite evento
   Registra en historial orden #47
   Notifica coordinador interno

                                             06:15 Juan marca ingreso
   ◄─────────── "trabajador.ingreso" ─────  Emite evento

                                             08:15 Pedro reporta novedad:
                                             "Tubo doblado"
   ◄─────────── "novedad.reportada" ──────  Emite evento
   Crea alerta_operacion en logiq360
   Notifica coordinador

                                             16:05 Pedro marca egreso
                                             Jefe firma contrato
   ◄──────────── "contrato.completado" ───  Emite evento
   Actualiza costo_mano_obra orden #47
   += 120.000

5. CUANDO TODOS COMPLETAN:

   Lógica interna logiq360:
   Si todos los equipo_orden completaron
   → orden_trabajo.estado = 'completado'
   → Emite "orden.completada" ────────────► Cierra oferta_turno
                                             estado: 'completada'
```

---

## PARTE 8 — REINTENTOS Y TOLERANCIA A FALLOS

```javascript
// logiq360/services/IntegracionTurnosService.js

class IntegracionTurnosService {

    static async emitirEvento(tenantId, eventData) {
        const integracion = await obtenerIntegracion(tenantId);
        if (!integracion?.activo) return; // sin integración, no hacer nada

        const event_id = crypto.randomUUID();

        // 1. Guardar en cola antes de enviar (garantiza no perder eventos)
        await pool.query(`
            INSERT INTO integration_events_out
            (tenant_id, event_id, event_type, target_system, target_url, payload, estado)
            VALUES (?, ?, ?, 'app_turnos', ?, ?, 'pendiente')
        `, [tenantId, event_id, eventData.event_type, integracion.app_url,
            JSON.stringify({ ...eventData, event_id })]);

        // 2. Intentar envío inmediato (fire-and-forget)
        this.enviarConReintentos(tenantId, event_id).catch(() => {});
    }

    static async enviarConReintentos(tenantId, eventId, intento = 1) {
        const MAX_INTENTOS = 5;
        const BACKOFF = [0, 30, 120, 600, 3600]; // segundos: inmediato, 30s, 2m, 10m, 1h

        const [rows] = await pool.query(
            'SELECT * FROM integration_events_out WHERE event_id = ?', [eventId]
        );
        const evento = rows[0]; // trae webhook_url y webhook_secret por el JOIN de obtenerEventosPendientes

        try {
            // webhook_url YA es la URL completa registrada al emparejar
            // (incluye /api/integracion/eventos) — no se le concatena ningún path.
            const body = JSON.stringify({
                event_id: evento.event_id,
                tipo_evento: evento.tipo_evento,
                tenant_id: evento.tenant_id,
                timestamp: new Date().toISOString(),
                data: JSON.parse(evento.payload),
            });
            const firma = 'sha256=' + crypto.createHmac('sha256', evento.webhook_secret).update(body).digest('hex');

            await fetch(evento.webhook_url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Logiq360-Signature': firma,   // NO se envía X-API-Key en esta llamada
                    'X-Logiq360-Event': evento.tipo_evento
                },
                body,
                signal: AbortSignal.timeout(10000) // 10s timeout
            });

            await pool.query(
                'UPDATE integration_events_out SET estado=?, enviado_at=NOW(), intentos=? WHERE event_id=?',
                ['enviado', intento, eventId]
            );

        } catch (error) {
            if (intento < MAX_INTENTOS) {
                const proximo = new Date(Date.now() + BACKOFF[intento] * 1000);
                await pool.query(`
                    UPDATE integration_events_out
                    SET estado='pendiente', intentos=?, ultimo_error=?, proximo_intento=?
                    WHERE event_id=?
                `, [intento, error.message, proximo, eventId]);
                // El worker periódico recogerá eventos pendientes
            } else {
                await pool.query(
                    'UPDATE integration_events_out SET estado=?, intentos=? WHERE event_id=?',
                    ['descartado', intento, eventId]   // 'descartado', no 'fallido' — reintentable vía
                );                                       // POST /historial/reintentar-descartados
                logger.error(`Evento ${eventId} falló tras ${MAX_INTENTOS} intentos`);
            }
        }
    }
}
```

---

## PARTE 9 — DEDUPLICACIÓN EN LA RECEPCIÓN

```javascript
// backend/modules/integracion/controllers/webhookController.js (ruta real)

exports.recibirEvento = async (req, res, next) => {
    try {
        const { event_id, tipo_evento, data } = req.body;

        // 1. Verificar que la API key corresponde a una integración activa
        //    (verificarIntegracionKey ya corrió antes e inyectó req.integracion)
        const integracion = req.integracion;

        // 2. Registrar: INSERT con UNIQUE KEY sobre event_id — si ya existe,
        //    MySQL lanza ER_DUP_ENTRY y se responde 200 idempotente sin reprocesar
        //    (no hay un SELECT previo de "ya existe": el propio INSERT hace de gate)
        let duplicado = false;
        try {
            await pool.query(
                `INSERT INTO integration_events_in (tenant_id, event_id, tipo_evento, payload)
                 VALUES (?, ?, ?, ?)`,
                [integracion.tenant_id, event_id, tipo_evento, JSON.stringify(data)]
            );
        } catch (err) {
            if (err.code === 'ER_DUP_ENTRY') duplicado = true; else throw err;
        }

        // 3. Procesar (EventHandlerService) — si falla, se marca estado='error'
        //    en integration_events_in pero igual se responde 200 (ver nota abajo)
        if (!duplicado) {
            await EventHandlerService.procesar(integracion.tenant_id, tipo_evento, data)
                .catch(err => logger.error('[webhook logiq360]', err));
        }

        res.json({ success: true, duplicado });
    } catch (error) {
        next(error);
    }
};
```
> **Nota de diseño real:** un fallo del *handler* (lógica de negocio) se
> registra como `estado='error'` pero responde 200 — así App Turnos no
> reintenta un error lógico que reintentar no arregla. Solo un fallo de
> red/HTTP (que ni siquiera llega a esta función) dispara el reintento del
> lado de App Turnos.

---

## PARTE 10 — RESUMEN DE PUNTOS DE CONEXIÓN

```
DIRECCIÓN               MECANISMO    EVENTO / ENDPOINT                    CRÍTICO
────────────────────────────────────────────────────────────────────────────────
logiq360 → App Turnos   Webhook      orden.creada                            ✅
logiq360 → App Turnos   Webhook      orden.cancelada                         ✅
logiq360 → App Turnos   Webhook      orden.fecha_cambiada                    ✅
logiq360 → App Turnos   Webhook      orden.completada                        ⬜
logiq360 → App Turnos   Webhook      empleado.creado                         ⬜ (opt-in)
logiq360 → App Turnos   Webhook      empleado.desactivado                    ⬜ (opt-in)
logiq360 → App Turnos   Webhook      integracion.activada                    ✅
logiq360 → App Turnos   Webhook      integracion.desactivada                 ✅

App Turnos → logiq360   Webhook      trabajador.ingreso                      ✅
App Turnos → logiq360   Webhook      trabajador.egreso                       ✅
App Turnos → logiq360   Webhook      contrato.completado                     ✅
App Turnos → logiq360   Webhook      novedad.reportada                       ✅
App Turnos → logiq360   Webhook      oferta.cubierta                         ✅

App Turnos → logiq360   REST (GET)   /public/ping                            ✅
App Turnos → logiq360   REST (GET)   /public/empleados                       ✅
App Turnos → logiq360   REST (GET)   /public/ordenes/{id}                    ⬜ (huérfano, ver nota)
App Turnos → logiq360   REST (GET)   /public/ordenes/{id}/productos          ⬜ (huérfano, ver nota)
logiq360   → App Turnos REST (GET)   /public/ping                            ✅
logiq360   → App Turnos REST (GET)   /public/estado/{ref}                    ✅
logiq360   → App Turnos REST (GET)   /public/en-sitio/{ref}                  ✅
logiq360   → App Turnos REST (GET)   /public/trabajadores                    ✅

✅ = implementado y en uso real (verificado en código, 2026-09-17)
⬜ = expuesto pero sin consumidor confirmado, o mejora futura
```

---

## PARTE 11 — CAMPOS NUNCA CRUZAN LA INTEGRACIÓN

```
logiq360 NUNCA envía a App Turnos:
├── Totales económicos de cotizaciones/alquileres
├── Precios unitarios del inventario
├── Costo de adquisición de elementos
├── Datos fiscales de clientes (NIT, régimen DIAN)
├── Información de pagos de alquileres
├── Datos de facturación electrónica
├── Salarios internos (valor_turno, valor_hora de empleados logiq360)
└── Credenciales (passwords, JWT, API keys de otros tenants)

App Turnos NUNCA envía a logiq360:
├── Salarios individuales de trabajadores gig (valor_acordado)
│   — solo el TOTAL acumulado como costo_mano_obra
├── Datos bancarios de trabajadores
├── Firmas digitales (se quedan en App Turnos)
└── Datos de otros clientes de App Turnos
```

---

## CHANGELOG

### 2026-09-17 — Auditoría de fidelidad doc↔código

Este documento (v1.0-1.5) describía una implementación imaginaria que nunca
coincidió del todo con el código: paths `/api/v1/...` en vez de los reales
`/api/integracion/...`, columnas de tabla inventadas, headers de auth que
nunca se implementaron (`X-Integration-Source`, `X-Event-ID`), y una sección
de "campos faltantes" (Parte 6) que ya se había resuelto en las migraciones
`56`/`61`/`63` sin actualizar el doc. Se corrigió línea por línea contra:
`appturnos/backend/modules/integracion/*` y
`aprendizaje-inventario-carpas/backend/modules/integracion/*`. También se
identificaron dos endpoints huérfanos en logiq360 (`public/ordenes/:id` y
`public/ordenes/:id/productos`): existen y funcionan, pero App Turnos no los
llama — quedan documentados como tal hasta que el equipo decida conectarlos
o retirarlos. Ver también los specs de App Turnos actualizados en el mismo
barrido: `APP-TURNOS-SPEC/05-INTEGRACION.md` y `03-API-ENDPOINTS.md`.

### v1.5 — oferta.cubierta implementado

Cerraba la lista de eventos pendientes de la spec original. Zaturno ya
llevaba la cuenta de `plazas_cubiertas` por puesto (usada para bloquear
postulaciones cuando un puesto se llena), pero nunca la usaba para avisar a
logiq360 — el handler `oferta.cubierta` en logiq360 ya existía y funcionaba
(tabla `orden_trabajo_equipo` con su UNIQUE KEY, a diferencia del caso de
`novedad.reportada`), simplemente nadie lo disparaba nunca.

- `CoberturaService.verificarYEmitir(empresaId, ofertaId)` (nuevo, en
  `modules/integracion/`) revisa si TODOS los puestos de la oferta están
  llenos; si la oferta viene de logiq360 (`external_ref`) y no se había
  notificado antes, emite el evento con el desglose de cupos y la lista de
  trabajadores confirmados/en progreso/completados.
- Se llama tras `AsignacionesService.confirmar()` y `.asignarDirecto()` —
  los dos únicos caminos que incrementan `plazas_cubiertas`.
- Idempotencia vía `ofertas_turno.cobertura_notificada` (migración 057),
  mismo patrón que `alerta_personal_enviada`.
- `trabajadores[].rol` ahora viaja en el payload (antes solo estaba en el
  doc de diseño, nunca implementado) — necesario porque logiq360 lo usa
  para poblar `rol_en_orden`.

### v1.4 — novedad.reportada implementado + GPS

`novedad.reportada` estaba documentado y hasta tenía un handler escrito del
lado de logiq360 (`EventHandlerService.js`), pero **nunca se emitía** desde
App Turnos y la tabla `novedades` de logiq360 **nunca se creó** — cualquier
intento real habría fallado en silencio. Se cierra el ciclo completo:

- App Turnos emite el evento al crear una novedad (`NovedadesService.crear`),
  best-effort y solo si la oferta tiene `external_ref`.
- Se agrega captura de GPS opcional al reportar (permiso denegado o sin señal
  → se envía igual sin coordenadas, nunca bloquea el reporte).
- El payload usa los tipos reales de App Turnos (`tipo_novedad`: retraso |
  ausencia | incidente | otro), no los especulativos de la v1.0
  (`dano_elemento`, `severidad`) que nunca existieron en su schema.
- No se envía `imagen_url` — la foto es base64 interno de App Turnos; solo
  viaja `tiene_foto` como bandera.
- logiq360: migración 80 crea la tabla `novedades` (distinta de
  `orden_trabajo_novedades`, que es para novedades internas de operarios) y
  el handler se corrige para leer `tipo_novedad` (antes leía `tipo`, que
  nunca llegaba) y guardar `trabajador_nombre`/`latitud`/`longitud`.

### v1.3 — Reconciliación periódica de la conexión

Los webhooks `integracion.activada`/`integracion.desactivada` (v1.2) se pueden
perder para siempre si App Turnos está caído más de ~1 hora (agotan sus 5
reintentos y quedan `descartado`). Se agrega `GET /api/v1/public/ping` en
logiq360 — App Turnos lo consulta una vez al día por cada empresa emparejada y
se autocorrige si su `integracion_config.activo` no coincide con lo que ping
reporta. Ver detalle en PARTE 3. Requiere que logiq360 tenga el endpoint
desplegado; no requiere ningún cambio adicional de logiq360 más allá de eso.

### v1.2 — Sincronización de facturación (integracion.activada / integracion.desactivada)

Zaturno pasó de un flag manual de "empresa logiq360" a derivar la gratuidad en vivo
de `integracion_config.activo` + `api_key`. Precio único para empresas no conectadas:
$129.000 COP/mes (ya no hay planes básico/profesional/empresarial escalonados en
precio — el plan sigue existiendo solo para límites de features).

Se agregan dos eventos nuevos, salientes desde logiq360, para que ambos lados queden
sincronizados cuando un operador conecta/desconecta un cliente desde el panel de
integraciones: `integracion.activada`, `integracion.desactivada`. Ver detalle arriba.

**Para logiq360, este cambio agrega dos eventos opcionales de emitir, pero se
recomienda enviarlos siempre que cambie el toggle** — sin ellos, la desconexión de
un cliente no tiene forma de reflejarse del lado de Zaturno.

### v1.1 — Puestos por oferta (cargo + tarifa + plazas)

Una oferta de turno ahora se compone de **N puestos**, cada uno con su cargo, plazas y tarifa propios. Ej: un mismo montaje puede ofrecer 10 plazas @auxiliar $80k + 2 @jefe_montaje $150k + 1 @conductor $120k.

**Para logiq360, este cambio NO rompe el contrato existente.** Solo agrega campos.

#### Lo que cambia

| Endpoint / evento | Cambio | Acción de logiq360 |
|---|---|---|
| `GET /public/estado/{ref}` | Devuelve nuevo array `puestos[]` con desglose por cargo. Los campos `cupos_requeridos` y `cupos_cubiertos` siguen presentes y ahora son sumas sobre puestos. | Opcional: leer `puestos[]` si quieres mostrar el desglose. Si no, todo sigue igual. |
| `GET /public/en-sitio/{ref}` | Sin cambios. | Ninguna. |
| Webhooks salientes hacia logiq360 (`costo_labor.calculado`, `trabajador.ingreso/egreso`, `contrato.completado`) | Sin cambios en payload. `pago_total` por trabajador ahora se calcula desde la tarifa del puesto (no de la oferta), pero el valor sigue siendo el correcto. | Ninguna. |
| Webhooks entrantes (`orden.creada`, `orden.cancelada`, etc.) | Sin cambios. Sigue aceptando `cupos_sugeridos` + `valor_dia_sugerido`. App Turnos los materializa internamente como un único puesto "auxiliar" en borrador; el jefe puede dividirlo por cargo antes de publicar. | Ninguna. |

#### Migración de datos en App Turnos (transparente)

Todas las ofertas creadas antes de v1.1 se migraron automáticamente a "1 puesto de cargo `auxiliar`" con sus plazas y tarifa originales. Las asignaciones quedaron vinculadas al único puesto. Los pulls a `/public/estado/{ref}` de órdenes antiguas siguen devolviendo los mismos `cupos_*`, ahora también con `puestos[]` de un solo elemento.

#### Extensión opcional (futura, no implementada)

Si logiq360 quiere mandar el desglose por cargo desde el inicio (en vez de que el jefe lo divida manualmente), podemos extender el payload de `orden.creada` con:

```json
"puestos_sugeridos": [
  { "cargo": "auxiliar",     "cantidad": 10, "valor_dia_sugerido": 80000 },
  { "cargo": "jefe_montaje", "cantidad": 2,  "valor_dia_sugerido": 150000 },
  { "cargo": "conductor",    "cantidad": 1,  "valor_dia_sugerido": 120000 }
]
```

Esto requiere coordinación bilateral: avisar y enviar PR.

---

*Complementario a: `API-INTEGRACION-APP-TO-APP.md` y `APP-CONTROL-TURNOS.md`*
