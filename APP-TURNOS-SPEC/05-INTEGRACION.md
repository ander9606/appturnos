# App Turnos — Integración con logiq360

> **logiq360** = sistema `aprendizaje-inventario-carpas` (backend Node.js + MySQL)  
> Puerto por defecto: **3000** | Base de datos: **`aprendizaje_inventario`**  
> API base: `http://localhost:3000/api`  
> Documento fuente completo: `docs/INTEGRACION-LOGIQ360-APP-TURNOS.md` en el repo de logiq360

---

## Filosofía

```
1. LOOSE COUPLING
   Los sistemas no se llaman directamente entre sí en el flujo crítico.
   Usan eventos asincrónicos. Si uno cae, el otro sigue funcionando.

2. IDEMPOTENCIA
   Recibir el mismo evento dos veces no rompe nada.
   Cada evento lleva un ID único (UUID) para deduplicación.

3. CONTRATO EXPLÍCITO
   El payload de cada evento es un contrato versionado (campo "version": "1.0").
   Cambios en el contrato requieren nueva versión del evento.

4. TOLERANCIA A FALLOS
   Si App Turnos está caída, logiq360 encola el evento.
   Si logiq360 está caído, App Turnos sigue operando.

5. TRAZABILIDAD
   Todo evento se loguea en ambos sistemas con el mismo event_id (UUID).
```

---

## Modelo de dominio logiq360 (resumen)

```
categorias
  └── elementos (requiere_series: bool)
        ├── series (tracking individual — carpas, mástiles, telas…)
        └── lotes  (tracking por cantidad — estacas, reatas, cuerdas…)

elementos_compuestos          ← "Carpa 10x10 Premium #001"
  └── compuesto_componentes   ← qué series + cuántos lotes lleva

clientes
  └── cotizaciones  (pendiente → aprobada → rechazada/vencida)
        └── alquileres  (programado → activo → finalizado/cancelado)
              └── ordenes_trabajo  (montaje / desmontaje / mantenimiento)
```

> **Regla clave**: `orden.creada` se dispara cuando `cotizacion.estado` → `'aprobada'`  
> y se generan las órdenes de trabajo del alquiler.

---

## Configuración

### En logiq360 (admin panel)
```
POST /api/integracion/configuracion
Body: { webhook_url: "https://app-turnos.com/api/v1/webhooks/logiq360", sync_empleados: true }
→ Retorna: { api_key: "at_live_xxx", incoming_secret: "hmac_secret" }
```

### Variables de entorno App Turnos
```env
LOGIQ360_WEBHOOK_URL=https://logiq360.com/api/webhooks/app-turnos
LOGIQ360_API_KEY=ak_live_<generada en logiq360>
LOGIQ360_WEBHOOK_SECRET=<para verificar firma entrante>
PORT=3001
```

### Autenticación entre sistemas
```
logiq360 llama App Turnos → Header: X-API-Key: at_live_xxx
App Turnos llama logiq360 → Header: X-API-Key: ak_live_xxx
Ambos incluyen:
  X-Integration-Source: logiq360 | app-turnos
  X-Event-ID: <uuid>  (para deduplicación)
```

---

## Mapa completo de conexiones

```
logiq360                              App Turnos
────────────────────────────────────────────────────────────────

SALIDAS (logiq360 → App Turnos):

orden.creada          ──────────────►  Crear oferta_turno en 'borrador'
orden.publicada       ──────────────►  Publicar oferta_turno (notificar pool)
orden.cancelada       ──────────────►  Cancelar oferta + contratos pendientes
orden.fecha_cambiada  ──────────────►  Actualizar fecha en oferta_turno
orden.completada      ──────────────►  Cerrar oferta_turno
empleado.creado       ──────────────►  (opcional) Crear trabajador sync
empleado.desactivado  ──────────────►  (opcional) Desactivar trabajador


ENTRADAS (App Turnos → logiq360):

oferta.cubierta       ──────────────►  Actualizar equipo en orden_trabajo
trabajador.ingreso    ──────────────►  Registrar en historial_estados orden
trabajador.egreso     ──────────────►  Actualizar estado equipo
contrato.completado   ──────────────►  Marcar empleado completado en orden
novedad.reportada     ──────────────►  Crear alerta_operacion
costo_labor.calculado ──────────────►  Actualizar costo mano de obra en orden


CONSULTAS SÍNCRONAS (pull cuando se necesita):

App Turnos → logiq360:
  GET /api/v1/public/ordenes/:external_ref       Detalles de la orden
  GET /api/v1/public/ordenes/:ref/productos      Lista de productos a montar

logiq360 → App Turnos:
  GET /api/v1/public/estado/:external_ref        Estado de oferta/contratos
  GET /api/v1/public/en-sitio/:external_ref      Quién está en campo ahora
```

---

## Eventos logiq360 → App Turnos (con payloads completos)

### `orden.creada`

**Cuándo:** Al aprobar cotización → crear alquiler → crear órdenes de trabajo  
**Código fuente logiq360:** `CotizacionAprobacionService.js`

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

**Qué hace App Turnos:**
1. Verifica idempotencia: `SELECT * FROM ofertas_turno WHERE external_ref = 'logiq360:orden:47'`
2. Crea `oferta_turno` en estado `'borrador'` con `external_ref`
3. Notifica al `jefe_turnos`: "Nueva orden lista para publicar"
4. El `jefe_turnos` completa: `cupos`, `valor_dia`, `hora_inicio`, `hora_fin`
5. El `jefe_turnos` publica la oferta manualmente (o auto si está configurado)

---

### `orden.publicada`

**Cuándo:** La orden pasa a estado activo en logiq360 (inicia la ejecución)

```json
{
  "event_id": "...",
  "event_type": "orden.publicada",
  "version": "1.0",
  "data": {
    "external_ref": "logiq360:orden:47"
  }
}
```

**Qué hace App Turnos:** Publica automáticamente la `oferta_turno` si está en borrador.

---

### `orden.cancelada`

**Cuándo:** Se cancela el alquiler o la orden de trabajo

```json
{
  "event_id": "...",
  "event_type": "orden.cancelada",
  "version": "1.0",
  "data": {
    "external_ref": "logiq360:orden:47",
    "motivo": "Cliente canceló el evento",
    "cancelada_at": "2026-05-21T10:00:00Z"
  }
}
```

**Qué hace App Turnos:**
1. Busca `oferta_turno` donde `external_ref = 'logiq360:orden:47'`
2. Cancela la oferta
3. Cancela contratos en `'pendiente'` o `'en_curso'`
4. Push notification a cada trabajador: "El trabajo fue cancelado"
5. Contratos `'completados'` **NO** se cancelan (ya trabajaron)

---

### `orden.fecha_cambiada`

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
1. Actualiza `fecha` en `oferta_turno` y en `contratos_dia` pendientes
2. Notifica trabajadores que aceptaron: "Fecha cambiada a 26 Mayo"
3. Trabajadores pueden confirmar nueva disponibilidad o retractarse

---

### `orden.completada`

```json
{
  "event_id": "...",
  "event_type": "orden.completada",
  "version": "1.0",
  "data": {
    "external_ref": "logiq360:orden:47"
  }
}
```

**Qué hace App Turnos:** Cierra la `oferta_turno`, registra horas finales.

---

### `empleado.creado` *(configurable — solo si `sync_empleados = true`)*

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
    "cargo": "Operario Montaje",
    "activo": true
  }
}
```

**Qué hace App Turnos:** Crea o sincroniza `trabajador` con `external_ref = 'logiq360:empleado:12'`.

---

### `empleado.desactivado`

```json
{
  "event_id": "...",
  "event_type": "empleado.desactivado",
  "version": "1.0",
  "data": {
    "external_ref": "logiq360:empleado:12"
  }
}
```

---

## Eventos App Turnos → logiq360

### `trabajador.ingreso`

**Cuándo:** Operario marca llegada GPS

```json
{
  "event_id": "...",
  "event_type": "trabajador.ingreso",
  "version": "1.0",
  "source": "app-turnos",
  "data": {
    "external_ref": "logiq360:orden:47",
    "empleado_ref": "logiq360:empleado:12",
    "hora_ingreso": "2026-05-25T06:02:15Z",
    "latitud": 4.8567,
    "longitud": -74.0124,
    "dentro_zona": true,
    "distancia_metros": 120
  }
}
```

**Qué hace logiq360:** Registra `hora_inicio` en `orden_trabajo_equipo` / historial de estados.

---

### `trabajador.egreso`

```json
{
  "event_id": "...",
  "event_type": "trabajador.egreso",
  "version": "1.0",
  "data": {
    "external_ref": "logiq360:orden:47",
    "empleado_ref": "logiq360:empleado:12",
    "hora_egreso": "2026-05-25T16:05:43Z",
    "latitud": 4.8567,
    "longitud": -74.0124
  }
}
```

---

### `contrato.completado`

**Cuándo:** Contrato firmado por jefe de zona y marcado como completado

```json
{
  "event_id": "...",
  "event_type": "contrato.completado",
  "version": "1.0",
  "data": {
    "external_ref": "logiq360:orden:47",
    "empleado_ref": "logiq360:empleado:12",
    "minutos_trabajados": 603,
    "hora_ingreso": "2026-05-25T06:02:15Z",
    "hora_egreso": "2026-05-25T16:05:43Z"
  }
}
```

**Qué hace logiq360:** Marca empleado como completado en la orden, actualiza `horas_trabajadas`.

---

### `costo_labor.calculado`

**Cuándo:** Cuando todos los contratos de una orden están completados y aprobados

```json
{
  "event_id": "...",
  "event_type": "costo_labor.calculado",
  "version": "1.0",
  "data": {
    "external_ref": "logiq360:orden:47",
    "alquiler_ref": "logiq360:alquiler:31",
    "total_pagado": 480000,
    "total_trabajadores": 4,
    "resumen": [
      { "empleado_ref": "logiq360:empleado:12", "valor": 120000, "horas": "10h 03min" }
    ]
  }
}
```

**Qué hace logiq360:** Actualiza `costo_mano_obra` en la orden de trabajo.

**Implementación (App Turnos):**
- Trigger: al ejecutarse `marcarEgreso()` en `asignaciones.service.js`, se invoca
  `CostoLaborService.verificarYEmitir(empresaId, ofertaId)`
  (`backend/modules/integracion/costo-labor.service.js`).
- Condiciones para emitir:
  1. La oferta tiene `external_ref` (origen logiq360).
  2. La oferta NO está ya en estado `completada` (idempotencia).
  3. Todas las asignaciones no-`pendiente` están en estado terminal
     (`completado`, `cancelado`, `no_presentado`).
  4. Al menos una asignación está en `completado`.
- En App Turnos no existe un paso de "aprobación" separado: el egreso
  con firma digital es la aprobación implícita.
- Tras emitir, la oferta se marca como `completada` para garantizar la idempotencia.
- El campo `resumen[].empleado_nombre` se incluye como extensión para
  debugging; logiq360 puede ignorarlo.

---

### `novedad.reportada`

**Cuándo:** Operario reporta un incidente en campo

```json
{
  "event_id": "...",
  "event_type": "novedad.reportada",
  "version": "1.0",
  "data": {
    "external_ref": "logiq360:orden:47",
    "empleado_ref": "logiq360:empleado:12",
    "tipo_novedad": "dano_elemento",
    "descripcion": "Tubo galvanizado con doblez. No apto para instalación.",
    "imagen_url": "/uploads/novedades/dano-tubo-001.jpg",
    "reportada_at": "2026-05-25T08:15:33Z"
  }
}
```

**Qué hace logiq360:** Inserta en `orden_trabajo_novedades`, genera alerta.

---

### `oferta.cubierta`

**Cuándo:** Todos los cupos de una oferta fueron asignados

```json
{
  "event_id": "...",
  "event_type": "oferta.cubierta",
  "version": "1.0",
  "data": {
    "external_ref": "logiq360:orden:47",
    "cupos_total": 5,
    "trabajadores": [
      { "empleado_ref": "logiq360:empleado:12", "nombre": "Juan Rodríguez" }
    ]
  }
}
```

**Qué hace logiq360:** Auditoría — actualiza equipo asignado en la orden.

---

## Manejo de `external_ref`

String libre con formato `"sistema:tipo:id"`. **Nunca** es una FK real entre BDs.

```
logiq360:orden:47       → ordenes_trabajo.id = 47 en logiq360
logiq360:alquiler:31    → alquileres.id = 31 en logiq360
logiq360:empleado:12    → empleados.id = 12 en logiq360
logiq360:cotizacion:8   → cotizaciones.id = 8 en logiq360
```

---

## Reintentos y idempotencia

Ambos lados implementan:
- **Cola saliente** en tabla `integration_events_out`
- **Deduplicación** con `UNIQUE KEY` en `event_id` (UUID)
- **Reintentos exponenciales**: 0s → 30s → 2m → 10m → 1h (5 intentos máx)
- **Firma HMAC-SHA256** en header `X-Logiq360-Signature` / `X-Turnos-Signature`

---

## Código de referencia — App Turnos

### Emitir evento saliente

```javascript
// modules/integracion/services/IntegracionLogiq360Service.js

const INTERVALOS = [0, 30, 120, 600, 3600]; // segundos

class IntegracionLogiq360Service {

  static async emitir(empresaId, tipoEvento, payload) {
    const config = await IntegracionModel.obtenerPorEmpresa(empresaId);
    if (!config?.activo) return;

    const eventId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO integration_events_out (empresa_id, event_id, tipo_evento, payload)
       VALUES (?, ?, ?, ?)`,
      [empresaId, eventId, tipoEvento, JSON.stringify(payload)]
    );
  }

  static async procesarCola() {
    const [eventos] = await pool.query(
      `SELECT e.*, ic.webhook_url, ic.webhook_secret
       FROM integration_events_out e
       INNER JOIN integracion_config ic ON e.empresa_id = ic.empresa_id AND ic.activo = 1
       WHERE e.estado = 'pendiente' AND e.proximo_intento <= NOW()
       LIMIT 50`
    );
    for (const evento of eventos) {
      await this._enviar(evento);
    }
  }
}
```

### Verificar firma entrante

```javascript
// middleware/verificarFirmaLogiq360.js
function verificarFirmaLogiq360(req, res, next) {
  const secret = process.env.LOGIQ360_WEBHOOK_SECRET;
  if (!secret) return next(); // sin configurar = sin verificación

  const body = req.rawBody;
  const sig = req.headers['x-logiq360-signature'] || '';
  const esperada = 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');

  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(esperada))) {
    return next(new AppError('Firma inválida', 401));
  }
  next();
}
```

### Worker de despacho

```javascript
// server.js
setInterval(() => {
  IntegracionLogiq360Service.procesarCola().catch(e =>
    logger.error('[integracion-worker]', e.message)
  );
}, 30_000); // cada 30 segundos
```

---

## Flujo completo: cotización → oferta → turno → retorno

```
[logiq360]                                    [App Turnos]
──────────────────────────────────────────────────────────────
1. Admin aprueba cotización
   cotizacion.estado = 'aprobada'
   → INSERT alquileres (estado='programado')
   → INSERT ordenes_trabajo (montaje + desmontaje)
   → emit orden.creada ───────────────────────► crea oferta_turno (borrador)
                                                external_ref='logiq360:orden:47'
                                                notifica jefe_turnos

2. jefe_turnos completa cupos, valor, horas
   → publica oferta
   → trabajadores reciben push notification
   trabajadores aceptan la oferta

3. Día del trabajo
   trabajador marca ingreso GPS ────────────► emit trabajador.ingreso
                                   ◄────────── logiq360 registra hora_inicio
   
   trabajador reporta novedad ─────────────► emit novedad.reportada
                                   ◄────────── logiq360 crea alerta
   
   trabajador marca egreso ─────────────────► emit trabajador.egreso
   jefe zona firma contrato                   ◄────────── logiq360 registra hora_fin
   → contrato completado ───────────────────► emit contrato.completado
                                   ◄────────── logiq360 actualiza horas

4. Todos los contratos completados
   → emit costo_labor.calculado ────────────► logiq360 actualiza costo mano de obra

5. Retorno de equipo en logiq360
   alquiler.estado = 'finalizado'
   → emit orden.completada ─────────────────► App Turnos cierra oferta_turno
```

---

## API de logiq360 que App Turnos puede consumir (pull)

| Método | Endpoint logiq360 | Rol | Para qué |
|--------|-------------------|-----|----------|
| `GET` | `/api/v1/public/ordenes/:external_ref` | `api` | Detalles de la orden para mostrar al operario |
| `GET` | `/api/v1/public/ordenes/:ref/productos` | `api` | Lista de productos a montar |
| `GET` | `/api/v1/mis-ordenes` | JWT empleado | Sus órdenes asignadas |

> Autenticación: header `X-API-Key: ak_live_xxx`

---

## Tablas de integración en App Turnos

```sql
CREATE TABLE integracion_config (
  id               INT PRIMARY KEY AUTO_INCREMENT,
  empresa_id       INT NOT NULL UNIQUE,
  webhook_url      VARCHAR(500) NOT NULL,     -- URL de logiq360 para recibir eventos
  webhook_secret   VARCHAR(255) NOT NULL,     -- Secret para firmar eventos salientes
  api_key          VARCHAR(255),             -- API Key para llamar logiq360
  incoming_secret  VARCHAR(255),             -- Secret para verificar eventos entrantes
  sync_empleados   BOOLEAN DEFAULT FALSE,
  activo           TINYINT DEFAULT 1,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (empresa_id) REFERENCES empresas(id)
);

CREATE TABLE integration_events_out (
  id              INT PRIMARY KEY AUTO_INCREMENT,
  empresa_id      INT NOT NULL,
  event_id        VARCHAR(36) NOT NULL UNIQUE,
  tipo_evento     VARCHAR(100) NOT NULL,
  payload         JSON NOT NULL,
  estado          ENUM('pendiente','enviado','fallido') DEFAULT 'pendiente',
  intentos        INT DEFAULT 0,
  proximo_intento DATETIME DEFAULT CURRENT_TIMESTAMP,
  ultimo_error    TEXT,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (empresa_id) REFERENCES empresas(id),
  INDEX idx_events_out_pendientes (estado, proximo_intento)
);

CREATE TABLE integration_events_in (
  id          INT PRIMARY KEY AUTO_INCREMENT,
  event_id    VARCHAR(36) NOT NULL UNIQUE,   -- UUID recibido (para deduplicar)
  tipo_evento VARCHAR(100) NOT NULL,
  payload     JSON,
  procesado   TINYINT DEFAULT 0,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## Endpoints que App Turnos debe exponer para recibir eventos

```
POST /api/v1/webhooks/logiq360          Recibir eventos de logiq360
GET  /api/v1/public/estado/:ext_ref     Estado de oferta/contratos (pull logiq360)
GET  /api/v1/public/en-sitio/:ext_ref   Quién está en campo ahora (pull logiq360)
```

---

## ⚠️ Datos faltantes en logiq360 (afectan la integración)

Estos campos NO existen aún en logiq360 pero son necesarios para el payload completo:

| Campo | Tabla | Impacto |
|-------|-------|---------|
| `hora_inicio`, `hora_fin` | `ordenes_trabajo` | Sin hora, la oferta queda incompleta |
| `latitud`, `longitud` | `cotizaciones` o `eventos` | Sin GPS, no hay geofencing |
| `porcentaje_avance` | `ordenes_trabajo` | Sin avance granular |

Workaround actual: el `jefe_turnos` completa estos datos manualmente al recibir el evento `orden.creada`.

---

## Notas de versión

| Fecha | Cambio |
|-------|--------|
| 2025-05 | Diseño inicial de integración logiq360 ↔ App Turnos |
| 2026-05-21 | Análisis completo basado en código fuente real (ver `API-INTEGRACION-APP-TO-APP.md` y `INTEGRACION-LOGIQ360-APP-TURNOS.md` en repo logiq360) |
| 2026-05-23 | **Actualización**: payloads completos de todos los eventos, mapa de conexiones, flujo end-to-end, datos faltantes documentados, `orden.publicada` y `costo_labor.calculado` agregados |
