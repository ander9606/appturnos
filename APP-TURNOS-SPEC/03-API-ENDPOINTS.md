# App Turnos — API Endpoints

Base URL: `https://api.app-turnos.com` (o `http://localhost:3001`)  
Autenticación: `Authorization: Bearer <jwt>` en todos los endpoints excepto `/auth/*`

---

## Auth

| Método | Path | Descripción |
|--------|------|-------------|
| POST | `/api/auth/login` | Login con email+password → `{ access_token, refresh_token }` |
| POST | `/api/auth/refresh` | Renovar access token |
| POST | `/api/auth/logout` | Invalidar refresh token |
| GET | `/api/auth/me` | Perfil del usuario autenticado |

---

## Trabajadores

| Método | Path | Roles | Descripción |
|--------|------|-------|-------------|
| GET | `/api/trabajadores` | admin, jefe_turnos, jefe_nomina | Listar (filtros: tipo, activo) |
| GET | `/api/trabajadores/:id` | admin, jefes | Detalle + historial |
| POST | `/api/trabajadores` | admin | Crear trabajador |
| PUT | `/api/trabajadores/:id` | admin | Actualizar |
| DELETE | `/api/trabajadores/:id` | admin | Soft delete |

---

## Track Nómina — Períodos y Registros

| Método | Path | Roles | Descripción |
|--------|------|-------|-------------|
| GET | `/api/nomina/periodos` | jefe_nomina, nomina | Listar períodos |
| POST | `/api/nomina/periodos` | jefe_nomina | Crear período |
| POST | `/api/nomina/periodos/:id/cerrar` | jefe_nomina | Cerrar y calcular totales |
| POST | `/api/nomina/periodos/:id/liquidar` | jefe_nomina | Marcar como liquidado |
| GET | `/api/nomina/registros` | jefe_nomina, nomina | Listar registros (filtros: periodo_id, trabajador_id, fecha) |
| POST | `/api/nomina/registros` | nomina, jefe_nomina | Registrar entrada/salida |
| PUT | `/api/nomina/registros/:id` | jefe_nomina | Corregir registro |
| GET | `/api/nomina/liquidacion/:periodo_id` | jefe_nomina | Resumen por trabajador con horas calculadas |
| GET | `/api/nomina/liquidacion/:periodo_id/export` | jefe_nomina | Exportar Excel |

---

## Track Turnos — Ofertas y Asignaciones

| Método | Path | Roles | Descripción |
|--------|------|-------|-------------|
| GET | `/api/turnos/ofertas` | todos | Listar ofertas (filtros: fecha, estado, disponibles=true) |
| GET | `/api/turnos/ofertas/:id` | todos | Detalle con asignaciones |
| POST | `/api/turnos/ofertas` | jefe_turnos, admin | Crear oferta |
| PUT | `/api/turnos/ofertas/:id` | jefe_turnos | Actualizar (mientras abierta) |
| DELETE | `/api/turnos/ofertas/:id` | jefe_turnos | Cancelar oferta |
| POST | `/api/turnos/ofertas/:id/aplicar` | trabajador_turnos | Postularse a oferta |
| DELETE | `/api/turnos/ofertas/:id/aplicar` | trabajador_turnos | Retirar postulación |
| POST | `/api/turnos/asignaciones/:id/confirmar` | jefe_turnos | Confirmar trabajador |
| POST | `/api/turnos/asignaciones/:id/ingreso` | trabajador_turnos | Marcar llegada (GPS) |
| POST | `/api/turnos/asignaciones/:id/egreso` | trabajador_turnos | Marcar salida + firma |
| POST | `/api/turnos/asignaciones/:id/calificar` | jefe_turnos, admin | Calificar turno completado (1-5 ⭐, ver §Ranking) |
| GET | `/api/turnos/asignaciones` | jefe_turnos, admin | Ver todas las asignaciones |
| GET | `/api/turnos/mis-turnos` | trabajador_turnos | Mis turnos y postulaciones |

### Ranking y visibilidad escalonada de ofertas

Cuando una asignación está en estado `completado`, el jefe la califica via
`POST /api/turnos/asignaciones/:id/calificar` con
`{ calificacion: 1..5, comentario?: string≤500 }`. Cada asignación se
califica una sola vez (HTTP 409 si se reintenta) y el promedio se almacena
en `trabajadores.ranking`.

El ranking determina la **antigüedad mínima** que una oferta debe tener
para que el `trabajador_turnos` la vea en `GET /ofertas`,
`GET /ofertas/:id` y `POST /ofertas/:id/aplicar`:

| Ranking del trabajador | Espera para ver una oferta nueva |
|---|---|
| ≥ 4.5 ⭐                  | 0 min (al instante) |
| 3.5 – 4.49 ⭐             | 15 min |
| 2.5 – 3.49 ⭐             | 30 min |
| < 2.5 ⭐                  | 60 min |
| Sin calificación (nuevo) | 15 min |

`admin_empresa` y `jefe_turnos` no tienen retraso. El filtro se aplica en
SQL (`TIMESTAMPDIFF(MINUTE, created_at, NOW())`) por lo que paginación,
total y detalle reflejan exactamente lo visible para cada usuario; las
ofertas aún no visibles devuelven 404.

---

## Contratos Diarios

| Método | Path | Roles | Descripción |
|--------|------|-------|-------------|
| GET | `/api/contratos/:id` | jefe_turnos, trabajador | Ver contrato |
| POST | `/api/contratos/:id/firmar` | trabajador_turnos | Firma digital (body: `{ firma_b64 }`) |
| GET | `/api/contratos/:id/pdf` | admin, jefe_turnos, trabajador | Descargar PDF |

---

## Integración (webhook receiver)

| Método | Path | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/api/integracion/eventos` | X-API-Key de logiq360 | Recibir eventos de logiq360 |
| GET | `/api/integracion/estado` | X-API-Key de logiq360 | Health check de integración |

---

## Reportes

| Método | Path | Descripción |
|--------|------|-------------|
| GET | `/api/reportes/asistencia` | Reporte asistencia por período |
| GET | `/api/reportes/costos` | Costo mano de obra por período |
| GET | `/api/reportes/trabajador/:id` | Historial individual |

---

## Formatos de respuesta

```json
// Success
{ "success": true, "data": {...}, "message": "Operación exitosa" }

// Paginado
{ "success": true, "data": [...], "pagination": { "page": 1, "limit": 20, "total": 100 } }

// Error
{ "success": false, "message": "Descripción del error", "status": "fail" }
```

---

## Webhook payload de logiq360 → App Turnos

```json
POST /api/integracion/eventos
Headers:
  X-API-Key: lt_<key>
  X-Logiq360-Signature: sha256=<hmac>
  X-Logiq360-Event: orden.creada

Body:
{
  "event_id": "uuid-v4",
  "tipo_evento": "orden.creada",
  "tenant_id": 5,
  "timestamp": "2025-05-21T10:30:00Z",
  "data": {
    "external_ref": "logiq360:orden:47",
    "tipo": "montaje",
    "fecha_programada": "2025-06-15",
    "hora_inicio": "08:00:00",
    "direccion": "Cll 72 #10-35",
    "ciudad": "Bogotá",
    "prioridad": "normal",
    "equipo": [
      { "empleado_id": 3, "nombre": "Juan Pérez", "rol": "operario" }
    ]
  }
}
```

## Módulo Empresas (directorio público)

| Método | Ruta | Rol | Descripción |
|--------|------|-----|-------------|
| `GET` | `/api/empresas/directorio` | `trabajador_turnos` | Lista empresas con `acepta_postulaciones=true`. Query params: `busqueda`, `ciudad`, `page`, `limit`. |
| `GET` | `/api/empresas/:id` | `trabajador_turnos` | Detalle público de una empresa. |

## Módulo Trabajador-Empresa (doble opt-in)

| Método | Ruta | Rol | Descripción |
|--------|------|-----|-------------|
| `GET` | `/api/trabajador-empresa/mis-empresas` | `trabajador_turnos` | Lista los vínculos del trabajador agrupados: `activas`, `pendientes`, `invitaciones`, `archivadas`. |
| `GET` | `/api/trabajador-empresa/solicitudes` | `jefe_turnos`, `admin_empresa` | Lista solicitudes pendientes de la empresa. Query param `estado` opcional. |
| `POST` | `/api/trabajador-empresa/solicitar` | `trabajador_turnos` | Body `{ empresa_id }`. Crea vínculo en estado `solicitado_por_trabajador`. |
| `POST` | `/api/trabajador-empresa/invitar` | `jefe_turnos`, `admin_empresa` | Body `{ cedula }`. Crea invitación en estado `solicitado_por_empresa`. |
| `POST` | `/api/trabajador-empresa/:id/aprobar` | `jefe_turnos`, `admin_empresa` | Aprueba solicitud del trabajador → pasa a `activo`. |
| `POST` | `/api/trabajador-empresa/:id/aceptar` | `trabajador_turnos` | Acepta invitación de la empresa → pasa a `activo`. |
| `POST` | `/api/trabajador-empresa/:id/rechazar` | Ambos | Body opcional `{ motivo }`. |
| `POST` | `/api/trabajador-empresa/:id/archivar` | Ambos | Solo desde estado `activo`. |

## Auth — Registro libre

| Método | Ruta | Rol | Descripción |
|--------|------|-----|-------------|
| `POST` | `/api/auth/registro` | Público | Registro libre para `trabajador_turnos`. Body: `{ nombre, apellido?, email, password }`. Devuelve tokens + perfil. |

---

## Webhook payload de App Turnos → logiq360

```json
POST <logiq360-webhook-url>
Headers:
  X-API-Key: <app-turnos-key>
  X-Turnos-Signature: sha256=<hmac>

Body:
{
  "event_id": "uuid-v4",
  "tipo_evento": "trabajador.ingreso",
  "timestamp": "2025-06-15T08:05:00Z",
  "data": {
    "external_ref": "logiq360:orden:47",
    "trabajador_ref": "logiq360:empleado:3",
    "latitud": 4.683528,
    "longitud": -74.071624
  }
}
```
