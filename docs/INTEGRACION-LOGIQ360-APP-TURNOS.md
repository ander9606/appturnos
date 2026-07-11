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
  GET /api/v1/public/ordenes/:external_ref   Detalles de la orden para mostrar al operario
  GET /api/v1/public/ordenes/:ref/productos  Lista de productos a montar

logiq360 → App Turnos:
  GET /api/v1/public/estado/:external_ref    Estado actual de la oferta/contratos
  GET /api/v1/public/en-sitio/:external_ref  Quién está en campo ahora
```

---

## AUTENTICACIÓN ENTRE SISTEMAS

```
Cada sistema actúa como cliente del otro.
Usan API Keys dedicadas para integración (no las mismas que los usuarios finales).

logiq360 tiene:
  api_key_para_llamar_app_turnos: "at_live_xxxxx"  → guardada en integraciones_turnos

App Turnos tiene:
  api_key_para_llamar_logiq360: "ak_live_xxxxx"     → guardada en su config de integración

Las requests llevan siempre:
  Header: X-API-Key: <key>
  Header: X-Integration-Source: logiq360  (o app-turnos)
  Header: X-Event-ID: <uuid>              (para deduplicación)
```

---

## PARTE 1 — SALIDAS DE logiq360

### Tabla de eventos salientes

```sql
-- En logiq360: registro de eventos enviados a sistemas externos
CREATE TABLE integration_events_out (
  id            INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id     INT NOT NULL,
  event_id      VARCHAR(36) NOT NULL,          -- UUID único del evento
  event_type    VARCHAR(100) NOT NULL,         -- "orden.creada"
  target_system VARCHAR(50) NOT NULL,          -- "app_turnos"
  target_url    VARCHAR(500) NOT NULL,
  payload       JSON NOT NULL,
  estado        ENUM('pendiente','enviado','fallido','ignorado') DEFAULT 'pendiente',
  intentos      INT DEFAULT 0,
  ultimo_error  TEXT NULL,
  enviado_at    TIMESTAMP NULL,
  proximo_intento TIMESTAMP NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY uk_event_id (event_id),
  INDEX idx_iev_estado (estado, proximo_intento),
  INDEX idx_iev_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

### EVENTO: `orden.creada`

**Cuándo se dispara:** Al aprobar una cotización y generar órdenes de trabajo  
**Código fuente logiq360:** `CotizacionAprobacionService.js` → después de crear las órdenes

```javascript
// logiq360/modules/alquileres/services/CotizacionAprobacionService.js
// Al final de aprobarYCrearAlquiler(), agregar:

await IntegracionTurnosService.emitirEvento(tenantId, {
    event_type: 'orden.creada',
    payload: {
        event_id: crypto.randomUUID(),
        version: '1.0',
        tenant_slug: tenant.slug,
        orden: {
            external_ref: `logiq360:orden:${ordenMontaje.id}`,
            tipo: 'montaje',                     // montaje | desmontaje
            titulo: cotizacion.evento_nombre,
            descripcion: null,                   // el jefe de turnos puede editar
            fecha: ordenMontaje.fecha_programada,
            hora_inicio: null,                   // DATO FALTANTE — agregar a ordenes_trabajo
            hora_fin: null,                      // DATO FALTANTE
            ubicacion: cotizacion.evento_direccion,
            latitud: cotizacion.latitud,         // DATO FALTANTE — agregar a cotizaciones
            longitud: cotizacion.longitud,       // DATO FALTANTE
            cupos_sugeridos: null,               // logiq360 no sabe cuántos operarios
            valor_dia_sugerido: null,            // logiq360 no define el pago gig
            notas_para_operario: ordenMontaje.notas,
            productos_resumen: [                 // referencia para el operario
                { nombre: 'Carpa 10x10 Premium', cantidad: 3 },
                { nombre: 'Sistema iluminación', cantidad: 1 }
            ]
        },
        alquiler_ref: `logiq360:alquiler:${alquiler.id}`
    }
});
```

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
-- En logiq360: registro de eventos recibidos de sistemas externos
CREATE TABLE integration_events_in (
  id            INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id     INT NOT NULL,
  event_id      VARCHAR(36) NOT NULL,
  event_type    VARCHAR(100) NOT NULL,
  source_system VARCHAR(50) NOT NULL,          -- "app_turnos"
  payload       JSON NOT NULL,
  procesado     BOOLEAN DEFAULT FALSE,
  error         TEXT NULL,
  procesado_at  TIMESTAMP NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY uk_event_in_id (event_id),        -- deduplicación
  INDEX idx_iei_procesado (procesado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

### EVENTO: `trabajador.ingreso`

**Cuándo llega:** Cuando un trabajador marca ingreso en la app  
**Endpoint en logiq360:** `POST /api/v1/integrations/app-turnos/events`

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

### EVENTO: `novedad.reportada`

**Cuando un operario reporta un incidente desde la app de turnos**

```json
{
  "event_id": "...",
  "event_type": "novedad.reportada",
  "version": "1.0",
  "data": {
    "external_ref": "logiq360:orden:47",
    "trabajador_nombre": "Pedro Gómez",
    "tipo_novedad": "dano_elemento",
    "descripcion": "Tubo galvanizado doblado, no apto para instalación",
    "imagen_url": "https://app-turnos.com/uploads/novedades/foto.jpg",
    "severidad": "alta",
    "timestamp": "2026-05-25T08:15:33Z"
  }
}
```

**Qué hace logiq360:**
```javascript
// Crea una alerta_operacion en el sistema de carpas
await AlertaModel.crear(tenantId, {
    orden_id: ordenId,
    tipo: 'incidencia',
    severidad: data.severidad,
    titulo: `Novedad de ${data.trabajador_nombre}`,
    mensaje: data.descripcion,
    fuente: 'app_turnos'
});
```

---

### EVENTO: `oferta.cubierta`

**Cuando todos los cupos de la oferta fueron aceptados**

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
      { "nombre": "Pedro Gómez",  "external_ref": "logiq360:empleado:15" },
      { "nombre": "María López",  "external_ref": null },
      { "nombre": "Carlos Ruiz",  "external_ref": null }
    ]
  }
}
```

**Qué hace logiq360:**
```javascript
// Notifica al coordinador que la orden tiene equipo completo
await NotificacionModel.crear(tenantId, {
    tipo: 'orden_equipo_completo',
    titulo: 'Equipo completo para orden #47',
    mensaje: '5 trabajadores confirmados para Montaje - Boda García'
});
```

---

## PARTE 3 — CONSULTAS SÍNCRONAS

Usadas cuando se necesita información inmediata (no por evento).

### App Turnos → logiq360

```
GET /api/v1/public/ordenes/{external_ref}
Header: X-API-Key: ak_live_xxxxx
Header: X-Integration-Source: app_turnos

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
GET /api/v1/public/ordenes/{external_ref}/productos
→ Lista de elementos compuestos con componentes y fotos de referencia
   (para que el operario sepa qué armar y cómo)
```

---

### logiq360 → App Turnos

```
GET /api/v1/public/estado/{external_ref}
Header: X-API-Key: at_live_xxxxx

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
GET /api/v1/public/en-sitio/{external_ref}
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
-- Configura la conexión de logiq360 con una instancia de App Turnos
CREATE TABLE integraciones_turnos (
  id              INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id       INT NOT NULL,
  nombre          VARCHAR(100) DEFAULT 'App Turnos',
  app_url         VARCHAR(500) NOT NULL,         -- "https://app-turnos.tudominio.com"
  api_key_entrante VARCHAR(200) NOT NULL,         -- key que App Turnos usa para llamarnos
  api_key_saliente VARCHAR(200) NOT NULL,         -- key que usamos para llamar a App Turnos
  activo          BOOLEAN DEFAULT TRUE,

  -- ¿Qué se sincroniza automáticamente?
  sync_orden_creada     BOOLEAN DEFAULT TRUE,
  sync_orden_cancelada  BOOLEAN DEFAULT TRUE,
  sync_orden_fecha      BOOLEAN DEFAULT TRUE,
  sync_empleados        BOOLEAN DEFAULT FALSE,   -- opt-in porque es más invasivo

  -- ¿Se crea la oferta automáticamente o solo como borrador?
  publicar_automatico   BOOLEAN DEFAULT FALSE,   -- false = jefe revisa antes de publicar
  valor_dia_default     DECIMAL(10,2) NULL,      -- si publicar_automatico = true
  cupos_default         INT DEFAULT 1,

  -- Auditoría
  ultimo_evento_enviado_at   TIMESTAMP NULL,
  ultimo_evento_recibido_at  TIMESTAMP NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY uk_it_tenant (tenant_id),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

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

## PARTE 6 — CAMPOS FALTANTES EN logiq360

Para que la integración funcione correctamente, estos campos deben agregarse:

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
        const evento = rows[0];

        try {
            await fetch(evento.target_url + '/api/v1/integrations/events', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': evento.api_key_saliente,
                    'X-Event-ID': evento.event_id,
                    'X-Integration-Source': 'logiq360'
                },
                body: evento.payload,
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
                    ['fallido', intento, eventId]
                );
                logger.error(`Evento ${eventId} falló tras ${MAX_INTENTOS} intentos`);
            }
        }
    }
}
```

---

## PARTE 9 — DEDUPLICACIÓN EN LA RECEPCIÓN

```javascript
// logiq360/modules/integraciones/controllers/eventosTurnosController.js

exports.recibirEvento = async (req, res, next) => {
    try {
        const { event_id, event_type, data } = req.body;

        // 1. Verificar que la API key corresponde a una integración activa
        const integracion = req.integracion; // inyectado por middleware

        // 2. Deduplicación: si ya procesamos este event_id, responder 200 sin reprocesar
        const [existente] = await pool.query(
            'SELECT id FROM integration_events_in WHERE event_id = ?', [event_id]
        );
        if (existente.length > 0) {
            return res.json({ success: true, message: 'Evento ya procesado' });
        }

        // 3. Registrar recepción
        await pool.query(`
            INSERT INTO integration_events_in
            (tenant_id, event_id, event_type, source_system, payload)
            VALUES (?, ?, ?, 'app_turnos', ?)
        `, [integracion.tenant_id, event_id, event_type, JSON.stringify(req.body)]);

        // 4. Responder inmediatamente (no bloquear esperando procesamiento)
        res.json({ success: true, message: 'Evento recibido' });

        // 5. Procesar asincrónicamente
        setImmediate(() => procesarEvento(integracion.tenant_id, event_id, event_type, data));

    } catch (error) {
        next(error);
    }
};
```

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
App Turnos → logiq360   Webhook      oferta.cubierta                         ⬜

App Turnos → logiq360   REST (GET)   /public/ordenes/{ref}                   ✅
App Turnos → logiq360   REST (GET)   /public/ordenes/{ref}/productos         ✅
logiq360   → App Turnos REST (GET)   /public/estado/{ref}                    ⬜
logiq360   → App Turnos REST (GET)   /public/en-sitio/{ref}                  ⬜

✅ = MVP mínimo para que la integración tenga valor
⬜ = Mejora futura o funcionalidad opcional
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
