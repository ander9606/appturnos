# API de Integración App-to-App
## Diseño Completo — Sistema de Gestión de Inventario y Alquileres de Carpas

**Versión:** 1.0  
**Fecha:** 2026-05-21  
**Arquitecto:** Análisis basado en código fuente real  

---

## RESUMEN EJECUTIVO

El sistema ya cuenta con infraestructura API parcial implementada:
- **Tabla `api_keys`** con bcrypt + prefix lookup (migración `add_api_keys.sql`)
- **Middleware `verificarApiKey`** con header `X-API-Key`
- **Rutas `GET/POST/DELETE /api/api-keys`** protegidas por rol `admin`
- **Plan gate** `features.api_access = true` requerido

Lo que falta es el conjunto de **endpoints de recursos** consumibles vía API Key o JWT, con el modelo de permisos granular para la app móvil de operarios y otras integraciones externas.

---

## FASE 1 — INVENTARIO DE DATOS

### Entidades del Sistema (31+ tablas)

| Entidad | Tabla | Sensibilidad |
|---------|-------|-------------|
| Tenants | `tenants` | **Restringida** |
| Empleados | `empleados` | Mixta |
| Roles | `roles` | Interna |
| Permisos | `rol_permisos` | Interna |
| Clientes | `clientes` | Mixta |
| Ciudades | `ciudades` | Pública |
| Departamentos | `departamentos` | Pública |
| Elementos | `elementos` | Mixta |
| Series | `series` | Operativa |
| Lotes | `lotes` | Operativa |
| Categorías | `categorias` | Pública |
| Materiales | `materiales` | Pública |
| Unidades | `unidades` | Pública |
| Ubicaciones | `ubicaciones` | Interna |
| Elementos Compuestos | `elementos_compuestos` | Pública |
| Componentes | `compuesto_componentes` | Operativa |
| Cotizaciones | `cotizaciones` | **Restringida** |
| Alquileres | `alquileres` | **Restringida** |
| Pagos | `pagos` | **Privada** |
| Órdenes de Trabajo | `ordenes_trabajo` | Operativa |
| Equipo Orden | `orden_trabajo_equipo` | Operativa |
| Elementos Orden | `orden_trabajo_elementos` | Operativa |
| Fotos Operación | `orden_trabajo_fotos` | Operativa |
| Novedades | `orden_trabajo_novedades` | Operativa |
| Historial Estados | `orden_trabajo_historial_estados` | Operativa |
| Vehículos | `vehiculos` | Operativa |
| Eventos | `eventos` | Operativa |
| Facturas Clientes | `facturas_clientes` | **Privada** |
| Alertas | `alertas_operaciones` | Interna |
| Notificaciones | `notificaciones` | Interna |
| API Keys | `api_keys` | **Privada** |

---

### Clasificación de Campos por Entidad

#### EMPLEADOS (`empleados`)
| Campo | Clasificación | Justificación |
|-------|--------------|---------------|
| `id`, `nombre`, `apellido` | **Público** | Identidad básica de campo |
| `email` | **Restringido** | Solo para auth y admins |
| `telefono` | **Restringido** | Solo supervisores+ |
| `rol_id`, `rol_nombre` | **Operativo** | Necesario para asignación |
| `estado` | **Operativo** | Activo/inactivo para asignación |
| `password_hash` | **NUNCA exponer** | Hash de contraseña |
| `intentos_fallidos`, `bloqueado_hasta` | **NUNCA exponer** | Seguridad interna |
| `valor_turno`, `valor_hora` | **NUNCA exponer** | Información salarial |
| `horas_trabajadas` | **NUNCA exponer** | Dato salarial |
| `refresh_token` | **NUNCA exponer** | Credencial de sesión |
| `foto_perfil_url` | **Público** | Avatar del operario |
| `ultimo_login` | **Restringido** | Solo admins |

#### CLIENTES (`clientes`)
| Campo | Clasificación | Justificación |
|-------|--------------|---------------|
| `nombre`, `razon_social` | **Operativo** | Operario necesita saber para quién trabaja |
| `telefono` | **Operativo** | Contacto en sitio (emergencias) |
| `email` | **Restringido** | Solo coordinadores+ |
| `direccion` | **Operativo** | Dirección del evento/cliente |
| `tipo_documento`, `numero_documento` | **Privado** | Dato fiscal/legal |
| `nit`, `dv` | **NUNCA exponer vía API pública** | Dato DIAN |
| `regimen_tributario` | **NUNCA exponer** | Dato fiscal |
| `tipo_persona` | **Restringido** | Solo facturación |
| `ciudad_id`, `ciudad_nombre` | **Operativo** | Contexto geográfico |
| `notas` | **Restringido** | Puede contener info sensible |

#### ÓRDENES DE TRABAJO (`ordenes_trabajo`)
| Campo | Clasificación | Justificación |
|-------|--------------|---------------|
| `id`, `tipo`, `estado` | **Público** | Core del trabajo del operario |
| `fecha_programada` | **Público** | Cuándo ir |
| `direccion_evento`, `ciudad_evento` | **Público** | Dónde ir |
| `prioridad` | **Público** | Urgencia de la tarea |
| `notas` | **Público** | Instrucciones del coordinador |
| `vehiculo_id` (placa, marca) | **Público** | En qué vehículo |
| `alquiler_id`, `cotizacion_id` | **Restringido** | Referencia interna |
| `costo_mantenimiento` | **NUNCA exponer** | Dato financiero interno |
| `creado_por` | **Restringido** | Solo supervisores+ |
| Nombre evento, nombre cliente | **Público** | Contexto operativo |
| Total cotización, total alquiler | **NUNCA exponer** | Dato financiero |

#### ELEMENTOS (`elementos`)
| Campo | Clasificación | Justificación |
|-------|--------------|---------------|
| `id`, `nombre`, `descripcion` | **Público** | El operario necesita saber qué manejar |
| `categoria`, `material`, `unidad` | **Público** | Contexto del elemento |
| `estado` | **Público** | Para conocer condición |
| `ubicacion` | **Operativo** | Para bodega saber dónde está |
| `cantidad` (total inventario) | **Restringido** | Solo coordinadores+ |
| `stock_minimo` | **NUNCA exponer** | Gestión interna |
| `costo_adquisicion` | **NUNCA exponer** | Información financiera interna |
| `precio_unitario` | **NUNCA exponer** | Información de precios |
| `requiere_series` | **Operativo** | Necesario para verificación |

#### SERIES/LOTES
| Campo | Clasificación | Justificación |
|-------|--------------|---------------|
| `id`, `numero_serie` | **Operativo** | Identificación individual |
| `lote_numero` | **Operativo** | Identificación de lote |
| `estado` | **Operativo** | Condición actual |
| `ubicacion` | **Operativo** | Para bodegueros |
| `fecha_ingreso` | **Restringido** | Solo admins |

#### PAGOS (`pagos`)
| Campo | Clasificación | Justificación |
|-------|--------------|---------------|
| TODOS | **NUNCA exponer vía API pública** | Dato financiero sensible |
| `estado` general del alquiler | **Restringido** | Solo coordinadores+ |

#### FACTURAS (`facturas_clientes`)
| Campo | Clasificación | Justificación |
|-------|--------------|---------------|
| TODOS | **NUNCA exponer vía API de operarios** | Dato fiscal/legal |
| `estado` de factura | **Restringido** | Solo para sistemas contables integrados |
| `cufe` | **Restringido** | Solo para sistemas contables |

---

## FASE 2 — ANÁLISIS DE CASO DE USO

### Caso: App Móvil para Operarios

Un operario de campo necesita:

#### ÓRDENES DE TRABAJO — Exponer:
- Número/ID de orden
- Tipo (montaje/desmontaje/mantenimiento)
- Estado actual
- Fecha y hora programada
- Dirección del evento
- Ciudad
- Nombre del evento
- Nombre del cliente (solo nombre, NO documentos)
- Teléfono del cliente (para coordinación en sitio)
- Vehículo asignado (placa + marca)
- Notas/instrucciones del coordinador
- Prioridad

#### ÓRDENES DE TRABAJO — NO exponer:
- Totales económicos (cotización, alquiler)
- Costos de mantenimiento
- IDs internos de cotización/alquiler
- Quién creó la orden

#### CLIENTES — Exponer:
- Nombre / razón social
- Teléfono de contacto
- Ciudad del evento

#### CLIENTES — NO exponer:
- Número de documento (CC/NIT)
- Régimen tributario
- Email
- Historial de compras
- Valores de contratos

#### PERSONAL — Exponer:
- Nombre y apellido del compañero de equipo
- Rol en la orden (responsable/ayudante)
- Foto de perfil (avatar)
- Teléfono (opcional, para comunicación interna)

#### PERSONAL — NUNCA exponer vía API:
- Salario / valor_turno / valor_hora
- Horas trabajadas y su valorización
- Historial de evaluaciones
- Datos de nómina

**Riesgo identificado:** Si un operario puede ver el endpoint `/api/personal` sin restricción, podría ver salarios de sus compañeros. Solución: retornar solo `nombre`, `apellido`, `rol`, `foto_perfil_url` en el contexto de una orden específica.

#### DETALLES DE MONTAJE — Exponer:
- Nombre del producto/elemento compuesto
- Componentes (tipo de carpa, medidas, materiales)
- Cantidades requeridas
- Fotos de referencia del catálogo
- Instrucciones (notas del elemento compuesto)
- Número de serie individual de cada pieza
- Estado de verificación (cargado/instalado/retornado)
- Ubicación dentro del evento (si se define)
- Fotografías operativas (antes/durante/después)

#### INVENTARIO — Exponer (contexto de una orden):
- Elementos asignados a esa orden específica
- Número de serie / lote asignado
- Cantidad
- Estado del elemento en la orden
- Nombre del elemento

#### INVENTARIO — NO exponer:
- Stock total disponible
- Costo de adquisición
- Precio unitario de alquiler
- Historial de movimientos (solo admins)
- Elementos no asignados a esa orden

#### FACTURACIÓN — No exponer en API de operarios:
- Facturas electrónicas DIAN → Sistema contable externo solamente
- Estados DIAN → Solo integración contable autorizada
- Totales → Solo coordinadores y clientes vía portal cliente
- Saldos pendientes → Solo vista de coordinador
- Referencia: Exponer solo `estado_pago` (pendiente/parcial/pagado) al coordinador, nunca montos específicos al operario

---

## FASE 3 — DEFINICIÓN DE ROLES DE API

### ROL: `operario`
**Autenticación:** JWT con credenciales propias (email + password)

**Puede consultar:**
- `GET /v1/mis-ordenes` — Sus órdenes asignadas (hoy + próximas 7 días)
- `GET /v1/ordenes/{id}` — Detalle de una orden específica donde está asignado
- `GET /v1/ordenes/{id}/elementos` — Elementos a manejar en esa orden
- `GET /v1/ordenes/{id}/fotos` — Fotos operativas de esa orden
- `GET /v1/ordenes/{id}/equipo` — Compañeros asignados (sin datos salariales)
- `GET /v1/ordenes/{id}/novedades` — Incidentes reportados en esa orden
- `GET /v1/me` — Su propio perfil

**Puede escribir:**
- `PATCH /v1/ordenes/{id}/estado` — Cambiar estado de la orden
- `PATCH /v1/ordenes/{id}/elementos/{elem_id}/estado` — Marcar elemento como cargado/instalado/etc
- `POST /v1/ordenes/{id}/fotos` — Subir foto de la operación
- `POST /v1/ordenes/{id}/novedades` — Reportar novedad/incidente

**NO puede:**
- Ver órdenes de otros empleados
- Ver datos financieros
- Crear/eliminar órdenes
- Acceder a inventario general

---

### ROL: `supervisor`
**Autenticación:** JWT con credenciales propias

**Puede consultar todo lo del operario, PLUS:**
- `GET /v1/ordenes` — Todas las órdenes del tenant (con filtros)
- `GET /v1/empleados` — Lista de empleados (nombre, rol, estado — sin salarios)
- `GET /v1/empleados/{id}/ordenes` — Órdenes de un empleado
- `GET /v1/eventos/{id}` — Detalle de evento
- `GET /v1/calendario` — Vista calendario de órdenes

**Puede escribir:**
- `POST /v1/ordenes/{id}/equipo` — Asignar/remover empleado
- `PATCH /v1/ordenes/{id}` — Editar notas y vehículo
- `PATCH /v1/ordenes/{id}/fecha` — Cambiar fecha con motivo

**NO puede:**
- Ver datos financieros (totales, pagos)
- Crear/eliminar clientes
- Gestionar inventario

---

### ROL: `coordinador_logistico`
**Autenticación:** JWT con credenciales propias

**Puede consultar todo lo del supervisor, PLUS:**
- `GET /v1/inventario/elementos` — Inventario completo con cantidades
- `GET /v1/inventario/disponibilidad` — Disponibilidad por fechas
- `GET /v1/clientes/{id}` — Detalle cliente (sin datos fiscales)
- `GET /v1/vehiculos` — Flota de vehículos
- `GET /v1/alertas` — Alertas del sistema
- Estado de pago de alquileres (solo `estado_pago`, no montos)

**Puede aprobar:**
- `POST /v1/ordenes` — Crear orden manual
- `PATCH /v1/ordenes/{id}/estado` — Cancelar/completar órdenes
- `PUT /v1/inventario/elementos/{id}/estado` — Cambiar estado de elemento

---

### ROL: `cliente` (Portal externo — futuro)
**Autenticación:** Token separado, acceso limitado a SUS datos

**Puede ver:**
- Sus propios eventos activos
- Estado de sus alquileres (NO montos detallados)
- Estado de órdenes de trabajo de sus eventos (montaje/desmontaje)
- Fotos operativas de SUS eventos
- Sus facturas emitidas (URL de PDF)

**NUNCA puede ver:**
- Otros clientes
- Inventario interno
- Costos operativos
- Información de empleados

---

### ROL: `api` (Integración máquina-a-máquina)
**Autenticación:** API Key (`X-API-Key` header)  
**Gate:** `plan.features.api_access = true`

**Puede consultar (scope básico):**
- `GET /v1/ordenes` con filtros de fecha/estado
- `GET /v1/eventos` con estado
- `GET /v1/empleados` (nombre, cargo — sin datos salariales)
- `GET /v1/inventario/elementos` (nombre, estado, disponibilidad)

**Puede consultar (scope extendido — requiere permisos adicionales en la key):**
- Actualizaciones de estado de órdenes
- Webhooks de eventos

---

## FASE 4 — DISEÑO DE ENDPOINTS

### Base URL: `/api/v1`

> **Nota:** El prefijo `/v1` permite versioning sin romper clientes existentes.  
> Las rutas internas existentes siguen en `/api/` sin versionado.

---

### AUTENTICACIÓN (existente, exponer vía v1)

```
POST   /v1/auth/login                    # Credenciales → JWT tokens
POST   /v1/auth/refresh                  # Renovar access token
POST   /v1/auth/logout                   # Revocar refresh token
GET    /v1/me                            # Perfil del usuario autenticado
```

---

### ÓRDENES DE TRABAJO (core de la app móvil)

```
GET    /v1/ordenes                        # Lista con filtros (rol: supervisor+)
GET    /v1/ordenes/{id}                   # Detalle completo
GET    /v1/mis-ordenes                    # Mis órdenes asignadas (rol: operario)
GET    /v1/ordenes/calendario             # Vista por rango de fechas
GET    /v1/ordenes/{id}/equipo            # Equipo asignado
GET    /v1/ordenes/{id}/elementos         # Elementos a manejar
GET    /v1/ordenes/{id}/fotos             # Fotos agrupadas por etapa
GET    /v1/ordenes/{id}/novedades         # Incidentes reportados
GET    /v1/ordenes/{id}/historial         # Historial de cambios de estado

PATCH  /v1/ordenes/{id}/estado            # Cambiar estado (operario+)
PATCH  /v1/ordenes/{id}/elementos/{eid}/estado  # Estado de elemento en orden
PATCH  /v1/ordenes/{id}/elementos/{eid}/verificar-cargue    # Checklist cargue
PATCH  /v1/ordenes/{id}/elementos/{eid}/verificar-descargue # Checklist descargue
POST   /v1/ordenes/{id}/fotos             # Subir foto (multipart/form-data)
POST   /v1/ordenes/{id}/novedades         # Reportar incidente
```

---

### EVENTOS

```
GET    /v1/eventos                        # Lista de eventos (supervisor+)
GET    /v1/eventos/{id}                   # Detalle del evento
GET    /v1/eventos/{id}/ordenes           # Órdenes de trabajo del evento
GET    /v1/eventos/{id}/fotos             # Galería fotográfica del evento
```

---

### CLIENTES (datos operativos solamente)

```
GET    /v1/clientes                       # Lista (coordinador+)
GET    /v1/clientes/{id}                  # Nombre, teléfono, ciudad — sin datos fiscales
GET    /v1/clientes/{id}/eventos          # Eventos del cliente (coordinador+)
```

---

### EMPLEADOS (sin datos salariales)

```
GET    /v1/empleados                      # Lista de empleados disponibles (supervisor+)
GET    /v1/empleados/{id}                 # Nombre, cargo, foto (sin salario)
GET    /v1/empleados/{id}/ordenes         # Órdenes asignadas al empleado (supervisor+)
```

---

### INVENTARIO (contexto operativo)

```
GET    /v1/inventario/elementos           # Lista con filtros (coordinador+)
GET    /v1/inventario/elementos/{id}      # Detalle (sin precio/costo)
GET    /v1/inventario/elementos/{id}/series       # Series disponibles
GET    /v1/inventario/disponibilidad      # ?desde=&hasta=&elemento_id= (coordinador+)
```

---

### MONTAJE — Detalles del producto a montar

```
GET    /v1/productos/{id}                 # Producto/elemento compuesto
GET    /v1/productos/{id}/componentes     # Lista de componentes con cantidades
GET    /v1/productos/{id}/fotos           # Fotos de referencia del catálogo
```

---

### VEHÍCULOS

```
GET    /v1/vehiculos                      # Flota disponible (supervisor+)
GET    /v1/vehiculos/{id}                 # Detalle del vehículo
```

---

### API KEYS (Gestión — admin only, ya existe)

```
GET    /v1/api-keys                       # Listar keys del tenant
POST   /v1/api-keys                       # Crear nueva key (retorna plain UNA VEZ)
DELETE /v1/api-keys/{id}                  # Revocar key
```

---

## FASE 5 — SEGURIDAD

### Estrategia Recomendada: JWT + API Keys (dual-mode ya implementado)

#### Para Apps Móviles (operarios, supervisores):
**→ JWT con refresh token**

```
┌─────────────┐     POST /v1/auth/login      ┌──────────────┐
│  App Móvil  │ ─────────────────────────────▶│   Backend    │
│  Operario   │ ◀── access_token (15min) ──── │              │
│             │ ◀── refresh_token (7d) ─────  │              │
└─────────────┘                               └──────────────┘
     │
     │ Authorization: Bearer <access_token>
     ▼
  Todas las requests
     │
     │ (token expirado) → POST /v1/auth/refresh → nuevo access_token
```

**Ventajas sobre API Key para apps:**
- El operario se puede revocar individualmente sin afectar a otros
- El token lleva el `empleado_id` → saber quién hizo cada acción
- Expiración corta → menor riesgo si se intercepta
- Refresh automático transparente para el usuario

#### Para Integraciones Server-to-Server:
**→ API Key (ya implementada)**

```
Header: X-API-Key: ak_live_<64-hex>

Validación:
1. Extraer prefix (16 chars) → buscar en DB
2. bcrypt.compare(plain, hash) → autenticar
3. Cargar tenant + verificar plan.features.api_access
4. Inyectar req.tenant y req.usuario con rol 'api'
```

#### Para Portal de Clientes (futuro):
**→ JWT con scopes limitados**
- Token con claim `scope: 'cliente'`
- Solo acceso a datos propios
- Sin acceso a operaciones internas

### Medidas de Seguridad Adicionales

```javascript
// Rate limiting por API key
const rateLimit = require('express-rate-limit');
const apiKeyLimiter = rateLimit({
    windowMs: 60 * 1000,      // 1 minuto
    max: 100,                  // 100 requests/min por IP
    keyGenerator: (req) => req.headers['x-api-key'] || req.ip,
    message: { success: false, message: 'Rate limit excedido' }
});

// CORS restringido
const corsOptions = {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || [],
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    allowedHeaders: ['Authorization', 'X-API-Key', 'Content-Type', 'X-Tenant-Slug']
};
```

---

## FASE 6 — MULTI-TENANT: ANÁLISIS DE AISLAMIENTO

### Estado Actual del Aislamiento

**Implementado correctamente:**
- Todas las tablas tienen columna `tenant_id`
- El middleware `verificarApiKey` carga `req.tenant.id` desde la key
- El middleware JWT carga `req.usuario.tenant_id`
- Los modelos siempre reciben `tenantId` como primer parámetro
- Los JOINs filtran por `AND x.tenant_id = ?`

**Riesgos Identificados y Mitigaciones:**

#### Riesgo 1: Inyección de tenant_id vía query params
```javascript
// ❌ VULNERABLE - NO HACER
GET /v1/ordenes?tenant_id=2  // atacante intenta ver datos de otro tenant

// ✅ SEGURO - implementación actual
// El tenant_id siempre viene de req.tenant.id (verificado en middleware)
// Nunca de req.query o req.body
const ordenes = await OrdenTrabajoModel.obtenerTodas(req.tenant.id, filtros);
```

#### Riesgo 2: Referencias cruzadas entre tenants
```javascript
// ❌ VULNERABLE
GET /v1/ordenes/9999  // ID de otro tenant

// ✅ SEGURO - siempre WHERE tenant_id = ? AND id = ?
const orden = await OrdenTrabajoModel.obtenerPorId(req.tenant.id, req.params.id);
if (!orden) throw new AppError('No encontrada', 404); // No revelar que existe en otro tenant
```

#### Riesgo 3: Endpoints de catálogo compartido
```javascript
// CUIDADO: ciudades, departamentos, materiales, unidades
// Actualmente tienen tenant_id, pero datos globales se duplican
// Solución: mantener tenant_id estricto o crear tabla global separada
```

#### Riesgo 4: Archivos subidos (uploads)
```javascript
// Las URLs de imágenes NO llevan tenant_id en la ruta:
// /uploads/fotos/imagen.jpg → cualquiera puede acceder con la URL
// Recomendación: firmar URLs con token temporal o usar tenant/uuid en path
// /uploads/{tenant_id}/{orden_id}/foto.jpg
```

### Checklist de Aislamiento para Nuevos Endpoints
- [ ] `WHERE tenant_id = req.tenant.id` en TODAS las queries
- [ ] JOINs incluyen `AND tabla_join.tenant_id = ?`
- [ ] El `tenant_id` nunca viene de parámetros del cliente
- [ ] Respuesta 404 (no 403) cuando el recurso existe pero es de otro tenant
- [ ] URLs de archivos no son adivinables

---

## FASE 7 — DATOS FALTANTES

Información que actualmente NO se almacena pero sería crítica para integraciones:

### CRÍTICO para App Móvil

| Dato Faltante | Tabla Propuesta | Campo | Descripción |
|---------------|----------------|-------|-------------|
| **Coordenadas GPS del evento** | `cotizaciones` o `eventos` | `latitud`, `longitud` | Para abrir en Google Maps desde la app |
| **Hora exacta de inicio** | `ordenes_trabajo` | `hora_inicio`, `hora_fin` | La fecha_programada no tiene hora |
| **Hora real de llegada** | `ordenes_trabajo` o nueva tabla | `hora_llegada_real` | Trazabilidad de puntualidad |
| **Hora real de salida** | `ordenes_trabajo` | `hora_salida_real` | Fin del trabajo de campo |
| **Porcentaje de avance** | `ordenes_trabajo` | `porcentaje_avance` INT | Estado granular (0-100%) |
| **QR/Barcode de serie** | `series` | `qr_code` | Scan para verificar sin tipear |
| **Firma digital del cliente** | Nueva tabla | `firmas_cliente` | Conformidad con el servicio |

### IMPORTANTE para Trazabilidad

| Dato Faltante | Tabla Propuesta | Campo | Descripción |
|---------------|----------------|-------|-------------|
| **Materiales consumidos** | Nueva tabla | `orden_materiales_consumidos` | Qué materiales adicionales se usaron |
| **Condiciones climáticas** | `ordenes_trabajo` | `condicion_climatica` ENUM | Para justificar retrasos |
| **Incidentes con foto vinculada** | `orden_trabajo_novedades` | `imagen_url` (ya existe) | Vincular foto al incidente |
| **Evaluación del operario** | Nueva tabla | `evaluaciones_operarios` | Rating post-trabajo |
| **Checklist de montaje** | Nueva tabla | `checklist_montaje` | Lista de verificación predefinida |
| **Historial de ubicación GPS** | Nueva tabla | `orden_tracking_gps` | Track del vehículo en tiempo real |

### VALIOSO para Facturación Integrada

| Dato Faltante | Tabla/Campo | Descripción |
|---------------|-------------|-------------|
| **Webhook URL** | `api_keys` o nueva tabla | Para notificar cambios a sistema externo |
| **Scopes de la API Key** | `api_keys.scopes` | Qué puede hacer cada key |
| **ID externo del cliente** | `clientes.external_id` | Para sincronizar con ERP externo |
| **ID externo del alquiler** | `alquileres.external_id` | Para sincronizar con sistema contable |

---

## FASE 8 — PROPUESTA FINAL

### 1. Lista Definitiva de Datos a Exponer

#### EXPONER VÍA API (por contexto)

**Contexto OPERARIO (app móvil):**
```
Orden: id, tipo, estado, fecha_programada, hora_inicio*, hora_fin*,
       direccion_evento, ciudad_evento, prioridad, notas,
       evento_nombre, cliente_nombre, cliente_telefono,
       vehiculo_placa, vehiculo_marca

Elementos de la orden: id, elemento_nombre, numero_serie, lote_numero,
                       cantidad, estado, verificado_salida, verificado_retorno, notas

Equipo: empleado nombre+apellido, rol_en_orden, foto_perfil_url, telefono*

Fotos: imagen_url, etapa, notas, created_at

Novedades: tipo_novedad, descripcion, imagen_url, reportada_por_nombre, created_at
```

**Contexto SUPERVISOR:**
```
Todo lo del operario +
Lista de todos los empleados (sin salarios): nombre, apellido, rol, estado, foto
Lista de todas las órdenes con paginación y filtros
Detalle de eventos (nombre, fechas, estado, cliente_nombre, cliente_telefono)
Calendario de órdenes con equipo asignado
```

**Contexto COORDINADOR:**
```
Todo lo del supervisor +
Inventario: nombre, descripcion, estado, cantidad_disponible (calculada),
            categoria, material, unidad, requiere_series
Disponibilidad de elementos por rango de fechas
Vehículos: placa, marca, modelo, capacidad, estado
Clientes: nombre, telefono, email, ciudad (SIN datos fiscales)
Estado de pago de alquileres: solo 'pendiente'|'parcial'|'pagado' (sin monto)
```

**Contexto INTEGRACIÓN CONTABLE (API Key especializada):**
```
Facturas: numero_completo, estado, fecha_emision, total, cufe, pdf_url
Pagos: monto, metodo_pago, fecha_pago, estado (requiere scope billing)
Alquileres: fecha_salida, fecha_retorno_real, total, estado_pago
```

---

### 2. Lista Definitiva de Datos a Proteger

```
NUNCA exponer:
├── password_hash (empleados)
├── refresh_token (empleados)
├── hash (api_keys)
├── intentos_fallidos, bloqueado_hasta (empleados)
├── valor_turno, valor_hora (empleados) — información salarial
├── horas_trabajadas y su valorización
├── costo_adquisicion, precio_unitario (elementos)
├── stock_minimo (elementos)
├── costo_mantenimiento (ordenes_trabajo)
├── número_documento, tipo_documento (clientes) — sin permiso billing
├── nit, dv, regimen_tributario (clientes) — solo integración DIAN
├── municipio_dian_id, direccion_fiscal (clientes)
├── totales de cotizaciones (para operarios)
├── totales de alquileres (para operarios y supervisores)
├── pagos detallados (montos específicos) — solo coordinador financiero
├── configuracion_alquileres (precios, tarifas internas)
├── tenant datos de otros tenants (aislamiento absoluto)
└── api_keys.hash y api_keys de otros tenants
```

---

### 3. Diseño de Endpoints Completo

```
BASE: /api/v1
AUTH: Bearer <jwt> | X-API-Key: <key>

AUTENTICACIÓN
─────────────
POST   /v1/auth/login
POST   /v1/auth/refresh
POST   /v1/auth/logout

PERFIL
──────
GET    /v1/me

ÓRDENES DE TRABAJO
──────────────────
GET    /v1/mis-ordenes                                [operario] propia asignación
GET    /v1/ordenes                                    [supervisor+] todas
GET    /v1/ordenes/calendario                         [supervisor+] vista calendar
GET    /v1/ordenes/:id                                [operario si asignado, sup+]
GET    /v1/ordenes/:id/equipo                         [operario si asignado, sup+]
GET    /v1/ordenes/:id/elementos                      [operario si asignado, sup+]
GET    /v1/ordenes/:id/fotos                          [operario si asignado, sup+]
GET    /v1/ordenes/:id/novedades                      [operario si asignado, sup+]
GET    /v1/ordenes/:id/historial                      [supervisor+]
POST   /v1/ordenes                                    [coordinador+]
PATCH  /v1/ordenes/:id                                [supervisor+]
PATCH  /v1/ordenes/:id/estado                         [operario (limitado), sup+]
PATCH  /v1/ordenes/:id/fecha                          [supervisor+]
POST   /v1/ordenes/:id/equipo                         [supervisor+]
DELETE /v1/ordenes/:id/equipo/:empleado_id            [supervisor+]
PATCH  /v1/ordenes/:id/elementos/:eid/estado          [operario si asignado]
PATCH  /v1/ordenes/:id/elementos/:eid/verificar-cargue   [operario]
PATCH  /v1/ordenes/:id/elementos/:eid/verificar-descargue [operario]
POST   /v1/ordenes/:id/fotos                          [operario si asignado]
DELETE /v1/ordenes/:id/fotos/:foto_id                 [supervisor+]
POST   /v1/ordenes/:id/novedades                      [operario si asignado]
PATCH  /v1/ordenes/:id/novedades/:nov_id/resolver     [supervisor+]

EVENTOS
───────
GET    /v1/eventos                                    [supervisor+, api]
GET    /v1/eventos/:id                                [supervisor+, api]
GET    /v1/eventos/:id/ordenes                        [supervisor+]
GET    /v1/eventos/:id/fotos                          [supervisor+, cliente*]

CLIENTES
────────
GET    /v1/clientes                                   [coordinador+, api]
GET    /v1/clientes/:id                               [coordinador+]

EMPLEADOS
─────────
GET    /v1/empleados                                  [supervisor+]
GET    /v1/empleados/:id                              [supervisor+]
GET    /v1/empleados/:id/ordenes                      [supervisor+]

INVENTARIO
──────────
GET    /v1/inventario/elementos                       [coordinador+, api]
GET    /v1/inventario/elementos/:id                   [coordinador+]
GET    /v1/inventario/elementos/:id/series            [coordinador+]
GET    /v1/inventario/disponibilidad                  [coordinador+]

PRODUCTOS (elementos compuestos — detalles de montaje)
──────────────────────────────────────────────────────
GET    /v1/productos                                  [operario+, api]
GET    /v1/productos/:id                              [operario+]
GET    /v1/productos/:id/componentes                  [operario+]
GET    /v1/productos/:id/fotos                        [operario+]

VEHÍCULOS
─────────
GET    /v1/vehiculos                                  [supervisor+]

API KEYS (gestión)
──────────────────
GET    /v1/api-keys                                   [admin]
POST   /v1/api-keys                                   [admin]
DELETE /v1/api-keys/:id                               [admin]
```

---

### 4. Modelo de Permisos

```
                     operario  supervisor  coordinador  admin   api
─────────────────────────────────────────────────────────────────────
mis-ordenes             ✅         ✅           ✅        ✅     ✅*
ordenes (todas)         ❌         ✅           ✅        ✅     ✅
ordenes/:id             ✅*        ✅           ✅        ✅     ✅
ordenes/:id/estado      ✅*        ✅           ✅        ✅     ✅
ordenes/:id/fotos POST  ✅*        ✅           ✅        ✅     ❌
ordenes/:id/novedades   ✅*        ✅           ✅        ✅     ❌
empleados (lista)       ❌         ✅           ✅        ✅     ✅
empleados (salarios)    ❌         ❌           ❌        ✅     ❌
inventario elementos    ❌         ❌           ✅        ✅     ✅
inventario precios      ❌         ❌           ❌        ✅     ❌
clientes (lista)        ❌         ❌           ✅        ✅     ✅
clientes (fiscal)       ❌         ❌           ❌        ✅     ✅*
pagos/facturas          ❌         ❌           ❌        ✅     ✅*
api-keys gestión        ❌         ❌           ❌        ✅     ❌

✅* = condicional (solo sus propios datos, o requiere scope especial en la key)
✅* para api = requiere scope específico en la API key
```

---

### 5. Estrategia de Autenticación

#### Para App Móvil de Operarios
```
RECOMENDADO: JWT estándar (ya implementado en el sistema)

Flujo:
1. POST /v1/auth/login { email, password }
   → { access_token (15min), refresh_token (7d), empleado: {...} }

2. Cada request: Authorization: Bearer <access_token>

3. Al expirar: POST /v1/auth/refresh { refresh_token }
   → nuevo access_token (transparente para el usuario)

4. El JWT incluye: { empleado_id, tenant_id, rol_nombre, tenant_slug }
   → El backend verifica tenant_id del token == tenant de los datos
```

#### Para Integraciones Servidor-a-Servidor
```
IMPLEMENTADO: API Key
Header: X-API-Key: ak_live_<64-hex-chars>

Flujo de validación (ya implementado en verificarApiKey.js):
1. Extraer prefix (16 chars)
2. Buscar en DB por prefix (índice idx_api_keys_prefix)
3. bcrypt.compare(plain, hash) → si match, autenticado
4. Verificar tenant activo + plan.features.api_access
5. Inyectar req.tenant y req.usuario (rol='api')
6. Actualizar last_used_at (fire-and-forget)
```

#### Mejora Propuesta: Scopes en API Keys
```sql
ALTER TABLE api_keys 
ADD COLUMN scopes JSON DEFAULT ('["ordenes:read","eventos:read","empleados:read"]')
COMMENT 'Permisos granulares de la key';
```

```javascript
// Middleware de scope check
const verificarScope = (scope) => (req, res, next) => {
    if (!req.apiAuth) return next(); // JWT user, usar roles normales
    const scopes = req.apiKeyScopes || [];
    if (!scopes.includes(scope)) {
        return next(new AppError(`Scope '${scope}' requerido para este endpoint`, 403));
    }
    next();
};

// Uso en rutas:
router.get('/facturas', verificarApiKey, verificarScope('billing:read'), controller.listar);
```

---

### 6. Riesgos Encontrados

| Riesgo | Severidad | Descripción | Mitigación |
|--------|-----------|-------------|------------|
| **Exposición de salarios** | CRÍTICA | Si `/empleados` retorna valor_turno/valor_hora | Nunca incluir en serialización API |
| **Fugas entre tenants** | CRÍTICA | Queries sin filtro tenant_id | Revisar todos los nuevos endpoints |
| **URLs de archivos predecibles** | ALTA | `/uploads/fotos/foto.jpg` sin auth | Firmar URLs con JWT temporal |
| **Datos fiscales de clientes** | ALTA | NIT, régimen tributario accesible | Solo en scope `billing:read` |
| **Totales financieros** | ALTA | Totales de alquileres visibles por operario | Serialización separada por rol |
| **API Key sin scopes** | MEDIA | Una key tiene acceso total | Implementar scopes granulares |
| **Sin rate limiting en /auth** | MEDIA | Brute force en login | Rate limit de 10 req/min por IP |
| **Refresh tokens sin rotación** | MEDIA | Token de 7d puede ser robado | Implementar refresh token rotation |
| **Sin audit log de API** | BAJA | No saber qué consultó cada key | Loguear todas las requests con api_key_id |

---

### 7. Recomendaciones de Arquitectura

#### A. Middleware Chain para v1

```javascript
// server.js o api-router.js
const v1Router = express.Router();

// Resolver tenant por slug en header o subdomain
v1Router.use(resolverTenantFlexible);  // acepta slug header o subdomain

// Auth dual: JWT O API Key
v1Router.use(autenticarFlexible);     // si X-API-Key presente usa verificarApiKey,
                                       // si Authorization Bearer usa verificarToken

v1Router.use('/ordenes', ordenesV1Router);
v1Router.use('/empleados', empleadosV1Router);
// ...

app.use('/api/v1', v1Router);
```

#### B. Serialización por Rol (Data Transfer Objects)

```javascript
// utils/serializers/ordenSerializer.js
const serializarOrden = (orden, rolNombre) => {
    const base = {
        id: orden.id,
        tipo: orden.tipo,
        estado: orden.estado,
        fecha_programada: orden.fecha_programada,
        direccion_evento: orden.direccion_evento,
        ciudad_evento: orden.ciudad_evento,
        prioridad: orden.prioridad,
        notas: orden.notas,
        evento_nombre: orden.evento_nombre,
        cliente_nombre: orden.cliente_nombre,
        vehiculo: orden.vehiculo_placa ? {
            placa: orden.vehiculo_placa,
            marca: orden.vehiculo_marca
        } : null
    };

    if (['supervisor', 'coordinador', 'admin'].includes(rolNombre)) {
        base.cliente_telefono = orden.cliente_telefono;
        base.total_elementos = orden.total_elementos;
        base.total_equipo = orden.total_equipo;
        base.alquiler_id = orden.alquiler_id;
    }

    // NUNCA en ningún rol externo:
    // base.costo_mantenimiento = ... ❌
    // base.cotizacion_total = ...    ❌

    return base;
};
```

#### C. Tenant Resolution Flexible

```javascript
// middleware/resolverTenantFlexible.js
// Permite: X-Tenant-Slug header, subdomain, o viene del JWT/ApiKey
const resolverTenantFlexible = async (req, res, next) => {
    // Si viene de API Key, el tenant ya está en req.tenant (de verificarApiKey)
    if (req.tenant) return next();
    
    // Si viene de subdomain: empresa.tuapp.com
    const slug = req.subdomains[0] || req.headers['x-tenant-slug'];
    if (slug) {
        const tenant = await TenantModel.obtenerPorSlug(slug);
        if (!tenant || tenant.estado !== 'activo') {
            return next(new AppError('Tenant no encontrado', 404));
        }
        req.tenant = tenant;
    }
    next();
};
```

---

### 8. APIs Futuras Recomendadas

| API | Prioridad | Descripción |
|-----|-----------|-------------|
| **Webhooks** | ALTA | Notificar cambios de estado a sistemas externos |
| **GPS Tracking** | ALTA | `POST /v1/ordenes/:id/ubicacion` desde app |
| **Firma Digital** | MEDIA | `POST /v1/ordenes/:id/firma-cliente` |
| **Portal Cliente** | MEDIA | JWT separado con scope:cliente |
| **Checklist Dinámico** | MEDIA | Plantillas de verificación por tipo de montaje |
| **Historial GPS** | BAJA | Replay de recorrido del vehículo |
| **Integración WhatsApp** | BAJA | Notificar al cliente por WhatsApp |
| **Catálogo Público** | BAJA | `GET /public/catalogo` sin auth para web marketing |
| **Exportación** | BAJA | `GET /v1/reportes/operaciones` en CSV/Excel |

---

### 9. Roadmap de Implementación

#### Fase A — Fundamentos (1-2 semanas)
```
[✅ Ya implementado]
├── Tabla api_keys con bcrypt
├── Middleware verificarApiKey
├── Rutas de gestión de API keys (admin)
└── Multi-tenant con tenant_id en todas las tablas

[Por implementar]
├── Prefijo /api/v1 con router separado
├── Middleware autenticarFlexible (JWT | API Key)
├── Serializers por rol (no exponer campos sensibles)
└── Rate limiting en /v1/auth/login
```

#### Fase B — Endpoints Operativos (2-3 semanas)
```
├── GET /v1/mis-ordenes (operario)
├── GET /v1/ordenes/:id (con serialización por rol)
├── GET /v1/ordenes/:id/elementos
├── GET /v1/ordenes/:id/equipo
├── PATCH /v1/ordenes/:id/estado (con validación de rol)
├── PATCH /v1/ordenes/:id/elementos/:id/estado
├── PATCH /v1/ordenes/:id/elementos/:id/verificar-cargue
├── POST /v1/ordenes/:id/fotos (multipart)
└── POST /v1/ordenes/:id/novedades
```

#### Fase C — Endpoints de Consulta (1-2 semanas)
```
├── GET /v1/ordenes (lista con filtros, supervisor+)
├── GET /v1/ordenes/calendario
├── GET /v1/eventos
├── GET /v1/empleados
├── GET /v1/inventario/elementos (sin precios)
├── GET /v1/vehiculos
└── GET /v1/productos/:id/componentes
```

#### Fase D — Scopes y Seguridad Avanzada (1 semana)
```
├── ALTER TABLE api_keys ADD COLUMN scopes JSON
├── Middleware verificarScope(scope)
├── Audit log de requests API (tabla api_request_logs)
├── URLs de archivos firmadas con token temporal
└── Refresh token rotation
```

#### Fase E — Datos Faltantes Críticos (2-3 semanas)
```
├── ALTER TABLE cotizaciones ADD COLUMN latitud, longitud
├── ALTER TABLE ordenes_trabajo ADD COLUMN hora_inicio, hora_fin
├── ALTER TABLE ordenes_trabajo ADD COLUMN hora_llegada_real, hora_salida_real
├── Nueva tabla: checklist_montaje_plantillas
├── Nueva tabla: checklist_montaje_respuestas
└── Nueva tabla: firmas_cliente
```

#### Fase F — Integraciones Avanzadas (futuro)
```
├── Sistema de Webhooks (tabla webhook_subscriptions)
├── GPS tracking real-time (tabla orden_tracking_gps)
├── Portal cliente (scope:cliente en JWT)
└── Integración sistema contable externo (scope:billing)
```

---

### 10. Ejemplos JSON de Respuesta

#### `GET /v1/mis-ordenes` (operario)
```json
{
  "success": true,
  "data": [
    {
      "id": 47,
      "tipo": "montaje",
      "estado": "en_preparacion",
      "fecha_programada": "2026-05-23T07:00:00.000Z",
      "direccion_evento": "Cra 15 #80-20, Hotel Dann Carlton",
      "ciudad_evento": "Bogotá",
      "prioridad": "alta",
      "notas": "Llegada antes de las 6AM. Coordinador: Carlos (+57 300 000 0000)",
      "evento_nombre": "Boda García-Pérez",
      "cliente_nombre": "Familia García",
      "vehiculo": {
        "placa": "ABC123",
        "marca": "Chevrolet NPR"
      },
      "total_elementos": 12,
      "mi_rol": "responsable"
    }
  ],
  "total": 1,
  "pagination": { "page": 1, "limit": 20, "totalPages": 1 }
}
```

#### `GET /v1/ordenes/47` (supervisor)
```json
{
  "success": true,
  "data": {
    "id": 47,
    "tipo": "montaje",
    "estado": "en_preparacion",
    "fecha_programada": "2026-05-23T07:00:00.000Z",
    "direccion_evento": "Cra 15 #80-20, Hotel Dann Carlton",
    "ciudad_evento": "Bogotá",
    "prioridad": "alta",
    "notas": "Llegada antes de las 6AM",
    "evento_nombre": "Boda García-Pérez",
    "cliente_nombre": "Familia García",
    "cliente_telefono": "+57 310 555 0000",
    "vehiculo": {
      "placa": "ABC123",
      "marca": "Chevrolet",
      "modelo": "NPR 2022"
    },
    "equipo": [
      {
        "id": 12,
        "nombre": "Juan",
        "apellido": "Rodríguez",
        "rol_en_orden": "responsable",
        "foto_perfil_url": "/uploads/perfiles/juan-rodriguez.jpg"
      },
      {
        "id": 15,
        "nombre": "Pedro",
        "apellido": "Gómez",
        "rol_en_orden": "ayudante",
        "foto_perfil_url": null
      }
    ],
    "elementos": [
      {
        "id": 201,
        "elemento_nombre": "Carpa 10x10 Premium",
        "numero_serie": "C10X10-003",
        "cantidad": 1,
        "estado": "pendiente",
        "verificado_salida": false,
        "verificado_retorno": false
      },
      {
        "id": 202,
        "elemento_nombre": "Tubo galvanizado 3m",
        "lote_numero": "LOTE-2024-045",
        "cantidad": 24,
        "estado": "pendiente",
        "verificado_salida": false
      }
    ],
    "created_at": "2026-05-20T14:32:00.000Z"
  }
}
```

#### `POST /v1/ordenes/47/novedades` (operario)
```json
// Request:
{
  "tipo_novedad": "dano_elemento",
  "descripcion": "Tubo galvanizado con doblez en extremo. No apto para instalación.",
  "elemento_orden_id": 202,
  "cantidad_afectada": 2,
  "imagen_url": "/uploads/novedades/2026/05/dano-tubo-001.jpg"
}

// Response:
{
  "success": true,
  "data": {
    "id": 88,
    "orden_id": 47,
    "tipo_novedad": "dano_elemento",
    "descripcion": "Tubo galvanizado con doblez en extremo. No apto para instalación.",
    "cantidad_afectada": 2,
    "imagen_url": "/uploads/novedades/2026/05/dano-tubo-001.jpg",
    "reportada_por": 12,
    "reportada_por_nombre": "Juan Rodríguez",
    "estado": "abierta",
    "alerta_generada": true,
    "created_at": "2026-05-23T08:15:33.000Z"
  },
  "message": "Novedad registrada. Se generó alerta para el coordinador."
}
```

#### `GET /v1/inventario/elementos` (coordinador, sin precios)
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "nombre": "Carpa 10x10 Premium",
      "descripcion": "Carpa de tela náutica resistente al agua",
      "categoria": "Carpas Grandes",
      "material": "Tela Náutica",
      "unidad": "Unidad",
      "estado": "bueno",
      "requiere_series": true,
      "total_series": 5,
      "series_disponibles": 3,
      "series_alquiladas": 1,
      "series_mantenimiento": 1
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 48, "totalPages": 3 }
}
```
> **Nota:** `costo_adquisicion` y `precio_unitario` son excluidos siempre del serializer de API.

#### `GET /v1/eventos` (supervisor, via API Key)
```json
{
  "success": true,
  "data": [
    {
      "id": 23,
      "nombre": "Boda García-Pérez",
      "tipo_nombre": "Boda",
      "tipo_color": "#E91E8C",
      "fecha_inicio": "2026-05-23",
      "fecha_fin": "2026-05-24",
      "estado": "activo",
      "ciudad_nombre": "Bogotá",
      "cliente_nombre": "Familia García",
      "total_ordenes": 2,
      "ordenes_completadas": 0,
      "hero_foto_url": null
    }
  ],
  "total": 1
}
```

#### `POST /v1/api-keys` (admin)
```json
// Request:
{
  "nombre": "App Móvil Operarios v2"
}

// Response (la key plain SOLO se retorna aquí, una vez):
{
  "success": true,
  "data": {
    "id": 5,
    "nombre": "App Móvil Operarios v2",
    "prefix": "ak_live_3f8a2b1c",
    "plain_key": "ak_live_3f8a2b1cd4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0",
    "created_at": "2026-05-21T10:00:00.000Z"
  },
  "message": "Guarda esta key de forma segura. No se mostrará de nuevo."
}
```

---

## RESUMEN DE DECISIONES CLAVE

| Decisión | Elección | Justificación |
|----------|----------|---------------|
| Auth para app móvil | JWT (no API Key) | El token lleva el empleado_id → trazabilidad, revocación individual |
| Auth para integración | API Key (ya implementada) | Sin estado, simple, seguro para servidores |
| Versioning | `/api/v1` | Sin romper rutas internas existentes |
| Datos salariales | Nunca exponer | Riesgo legal y de privacidad de empleados |
| Datos fiscales | Solo scope billing | Regulación protección de datos |
| Totales financieros | Ocultar de operarios | Información comercial sensible |
| Aislamiento tenant | WHERE tenant_id siempre | Implementado, verificar en todos los nuevos endpoints |
| Serialización | DTO por rol | Evitar filtros ad-hoc y olvidar campos sensibles |
| GPS coordinates | Dato faltante crítico | Agregar a cotizaciones/eventos en próxima migración |
| Scopes en API Keys | Próxima iteración | Actualmente la key tiene acceso total al tenant |

---

*Documento generado a partir de análisis exhaustivo del código fuente, migraciones SQL y modelos de negocio del sistema.*
