# App Turnos — Integración con logiq360

## Filosofía

La integración es **opcional y loose-coupled**:
- App Turnos funciona 100% sin logiq360
- logiq360 funciona 100% sin App Turnos
- Cuando están conectados, se sincronizan eventos asincrónicamente
- Ningún sistema falla si el otro está caído (reintentos con backoff)

## Configuración

En logiq360 (admin panel):
1. `POST /api/integracion/configuracion` con `webhook_url` de App Turnos
2. Guarda la `api_key` generada
3. Configura esa `api_key` en App Turnos como `LOGIQ360_API_KEY`
4. Configura en App Turnos el `webhook_url` de logiq360 + el `incoming_secret`

## Eventos logiq360 → App Turnos

| Evento | Cuándo | Qué hace App Turnos |
|--------|--------|---------------------|
| `orden.creada` | Se aprueba cotización | Crea `oferta_turno` con `external_ref` |
| `orden.cancelada` | Se cancela orden | Cancela `oferta_turno` y notifica asignados |
| `orden.fecha_cambiada` | Se reprograma | Actualiza fecha/hora de la oferta |
| `orden.completada` | Estado → completado | Cierra oferta, registra horas |
| `empleado.creado` | Nuevo empleado en logiq360 | Crea/sync trabajador con `external_ref` |
| `empleado.desactivado` | Empleado inactivado | Desactiva trabajador |

## Eventos App Turnos → logiq360

| Evento | Cuándo | Qué hace logiq360 |
|--------|--------|-------------------|
| `trabajador.ingreso` | Operario marca llegada GPS | Registra `hora_inicio` en `ordenes_trabajo` |
| `trabajador.egreso` | Operario marca salida | Registra `hora_fin` en `ordenes_trabajo` |
| `contrato.completado` | Contrato firmado y día completo | Actualiza `costo_mano_obra`, `horas_trabajadas` por empleado |
| `novedad.reportada` | Novedad en campo | Inserta en `novedades` de logiq360 |
| `oferta.cubierta` | Oferta 100% asignada | Auditoría en logiq360 |

## Manejo de `external_ref`

El campo `external_ref` es un string libre con formato `"sistema:tipo:id"`.

```
logiq360:orden:47     → orden de trabajo #47 en logiq360
logiq360:empleado:3   → empleado #3 en logiq360
```

**Nunca** es una FK real entre bases de datos. Es solo una referencia legible para cruzar datos en reportes.

## Reintentos y idempotencia

Ambos lados implementan:
- **Cola de eventos salientes** en tabla `integration_events_out`
- **Registro de entrantes** con `UNIQUE KEY` en `event_id` (UUID) para deduplicar
- **Reintentos exponenciales**: 0s → 30s → 2m → 10m → 1h (5 intentos max)
- **Firma HMAC-SHA256** en header `X-Logiq360-Signature` / `X-Turnos-Signature`

## Código de referencia — App Turnos

```javascript
// modules/integracion/services/IntegracionLogiq360Service.js

const INTERVALOS = [0, 30, 120, 600, 3600];

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

## Verificación de firma entrante

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

## Worker de despacho

```javascript
// En server.js
setInterval(() => {
  IntegracionLogiq360Service.procesarCola().catch(e =>
    logger.error('[integracion-worker]', e.message)
  );
}, 30_000); // cada 30 segundos
```
