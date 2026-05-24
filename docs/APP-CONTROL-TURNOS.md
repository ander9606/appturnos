# App de Control de Turnos
## Integración con el Sistema de Inventario y Alquileres de Carpas

**Versión:** 1.0  
**Fecha:** 2026-05-21  
**Audiencia:** Equipo desarrollador de la app móvil

---

## CONTEXTO

La app conecta dos tipos de relación laboral completamente distintas entre sí:

```
┌───────────────────────────────────────────────────────────┐
│                    APP CONTROL DE TURNOS                   │
├───────────────────────────┬───────────────────────────────┤
│      TRACK NÓMINA         │       TRACK TURNOS            │
│  Empleado fijo en nómina  │   Trabajador por día (gig)    │
├───────────────────────────┼───────────────────────────────┤
│ • Horario fijo o rotativo │ • Oferta laboral diaria       │
│ • Check-in / Check-out    │ • Acepta o rechaza oferta     │
│ • Acumula horas al día    │ • Micro-contrato x día        │
│ • Corte semanal/quincenal │ • Pago por día completado     │
│ • Control hrs extra       │ • Firma digital al cierre     │
│ • Control hrs nocturnas   │ • Sin acumulación de horas    │
└───────────────────────────┴───────────────────────────────┘
```

### 4 Roles del Sistema

| Rol | Track | Responsabilidad |
|-----|-------|----------------|
| `jefe_nomina` | Nómina | Programa horarios, aprueba resúmenes de horas, gestiona equipo fijo |
| `jefe_turnos` | Turnos | Publica ofertas laborales, asigna jefe de zona, cierra micro-contratos |
| `nomina` | Nómina | Recibe dónde estar y cuándo, marca ingreso/egreso |
| `turnos` | Turnos | Recibe y acepta/rechaza ofertas diarias, ejecuta trabajo |

---

## PARTE 1 — FLUJOS POR ROL

### ROL: `nomina` (Empleado de Nómina)

```
Día típico del trabajador de nómina:

07:00 → Abre la app → Ve "Mi turno de hoy"
         ┌─────────────────────────────┐
         │ Turno: MONTAJE - Evento ABC │
         │ Lugar: Hotel Dann Carlton   │
         │ Hora:  07:00 - 17:00        │
         │ Jefe:  Carlos Rodríguez     │
         │ [📍 Abrir Maps]             │
         │ [✅ Marcar Ingreso]          │
         └─────────────────────────────┘

07:05 → Tap "Marcar Ingreso"
         → App captura GPS + timestamp
         → Validación de geofencing (¿está cerca del lugar?)
         → POST /v1/nomina/turnos/:id/ingreso

17:15 → Tap "Marcar Egreso"
         → App captura GPS + timestamp
         → Calcula horas trabajadas del día
         → POST /v1/nomina/turnos/:id/egreso

         Resultado automático:
         ┌─────────────────────────────┐
         │ Horas hoy: 10h 10min        │
         │ Regular:    8h 00min        │
         │ Extra:      2h 10min        │
         │ Nocturnas:  0h 00min        │
         └─────────────────────────────┘
```

**Pantallas necesarias:**
1. `Dashboard` → turno de hoy + próximos 3 días
2. `Mi Turno` → detalle con mapa, instrucciones, contacto jefe
3. `Marcar Ingreso` → botón grande + captura GPS
4. `Marcar Egreso` → botón grande + captura GPS + firma opcional
5. `Mi Historial` → semana actual + semanas anteriores
6. `Mi Resumen` → acumulado del período (horas regular/extra/nocturna)

---

### ROL: `jefe_nomina` (Jefe de Nómina)

```
Vista de gestión:

Panel principal:
┌──────────────────────────────────────────────┐
│  HOY — 23 Mayo 2026                          │
│  ✅ En turno: 8 empleados                    │
│  ⏳ Pendiente ingreso: 3 empleados           │
│  ❌ Ausentes: 1 empleado                     │
│  [Ver mapa en tiempo real]                   │
└──────────────────────────────────────────────┘

Corte semanal (lunes):
┌──────────────────────────────────────────────┐
│  Resumen semana 20-26 Mayo                   │
│  Total empleados: 12                         │
│  Horas regulares: 384h                       │
│  Horas extra diurnas: 28h                    │
│  Horas extra nocturnas: 6h                   │
│  Horas festivo: 0h                           │
│  [Aprobar Resumen] [Exportar CSV]            │
└──────────────────────────────────────────────┘
```

**Acciones clave:**
- Crear/editar turnos programados para su equipo
- Ver quién está en campo en tiempo real (GPS)
- Aprobar o rechazar marcaciones fuera de geofence
- Generar y aprobar resumen semanal/quincenal
- Reportar ausencias
- Asignar turnos a órdenes de trabajo existentes

---

### ROL: `turnos` (Trabajador por Turno / Gig Worker)

```
Flujo de oferta laboral:

1. NOTIFICACIÓN (push):
   "📋 Nueva oferta: Montaje carpa - Sábado 25/05
    💰 $120.000 día | ⏰ 06:00-16:00 | 📍 Chía"

2. DETALLE DE OFERTA:
   ┌─────────────────────────────────────────┐
   │ MONTAJE EVENTO "Boda García"            │
   │ ─────────────────────────────────────── │
   │ 📅 Sábado 25 de mayo de 2026            │
   │ ⏰ 06:00 AM - 04:00 PM (10 horas)       │
   │ 📍 Finca El Refugio, Chía              │
   │ 💰 $120.000 COP                         │
   │ 👷 Jefe zona: Juan Mesa (+57 300...)    │
   │ 👥 Cupos disponibles: 2 de 5            │
   │ ─────────────────────────────────────── │
   │ Descripción:                            │
   │ "Montaje de 3 carpas 10x10 y sistema    │
   │  de iluminación. Experiencia requerida" │
   │ ─────────────────────────────────────── │
   │    [❌ Rechazar]    [✅ Aceptar]         │
   └─────────────────────────────────────────┘

3. AL ACEPTAR → Micro-contrato generado:
   - Datos del trabajo
   - Monto acordado
   - Firma digital del trabajador

4. DÍA DEL TRABAJO:
   → Marcar ingreso (GPS + hora)
   → Ejecutar trabajo
   → Marcar egreso (GPS + hora)
   → Firma de conformidad (del trabajador Y del jefe de zona)
   → Micro-contrato cerrado → estado: completado

5. PAGO:
   → El jefe aprueba el micro-contrato
   → Estado cambia a 'pago_aprobado'
   → El trabajador ve cuándo y cuánto se le pagará
```

---

### ROL: `jefe_turnos` (Jefe de Turnos / Gig Manager)

```
Gestión de ofertas:

1. Crear oferta laboral (vinculada o no a una orden del sistema principal):
   → Selecciona orden de trabajo existente (opcional)
   → Define: fecha, horas, cupos, valor día, jefe de zona
   → Publica a pool de trabajadores

2. Ver estado de cubrimiento:
   ┌──────────────────────────────────────────────┐
   │ Montaje Boda García — Sáb 25 Mayo            │
   │ Cupos: ████████░░ 4/5 cubiertos              │
   │ Aceptaron: Pedro, Juan, Carlos, María        │
   │ Pendiente: 1 cupo                            │
   │ [📤 Reenviar oferta] [➕ Agregar cupo]       │
   └──────────────────────────────────────────────┘

3. Día del trabajo:
   → Ve quiénes marcaron ingreso y a qué hora
   → Puede reportar "no se presentó"
   → Aprueba o rechaza el micro-contrato al finalizar

4. Gestión de pagos:
   → Lista de micro-contratos completados pendientes de pago
   → Aprueba lote de pagos
   → Registra pago ejecutado
```

---

## PARTE 2 — TABLAS NUEVAS REQUERIDAS

### Track Nómina

```sql
-- Turnos programados para empleados de nómina
CREATE TABLE turnos_nomina (
  id              INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id       INT NOT NULL,
  empleado_id     INT NOT NULL,           -- FK → empleados
  orden_id        INT DEFAULT NULL,       -- FK → ordenes_trabajo (opcional, enlaza con sistema carpas)
  fecha           DATE NOT NULL,
  hora_inicio     TIME NOT NULL,
  hora_fin        TIME NOT NULL,
  -- Lugar asignado
  ubicacion       VARCHAR(300),
  latitud         DECIMAL(10, 8),
  longitud        DECIMAL(11, 8),
  radio_geofence  INT DEFAULT 300,        -- Metros permitidos para marcar
  -- Marcaciones
  estado          ENUM('programado','en_curso','completado','ausente','cancelado') DEFAULT 'programado',
  hora_ingreso_real   DATETIME NULL,
  hora_egreso_real    DATETIME NULL,
  ingreso_latitud     DECIMAL(10, 8) NULL,
  ingreso_longitud    DECIMAL(11, 8) NULL,
  egreso_latitud      DECIMAL(10, 8) NULL,
  egreso_longitud     DECIMAL(11, 8) NULL,
  ingreso_dentro_zona BOOLEAN DEFAULT NULL,  -- ¿GPS dentro del geofence?
  egreso_dentro_zona  BOOLEAN DEFAULT NULL,
  ingreso_foto_url    VARCHAR(500) NULL,   -- Selfie al marcar
  egreso_foto_url     VARCHAR(500) NULL,
  notas_ingreso       TEXT NULL,
  notas_egreso        TEXT NULL,
  -- Horas calculadas (en minutos)
  minutos_trabajados  INT DEFAULT 0,
  minutos_extra       INT DEFAULT 0,
  minutos_nocturno    INT DEFAULT 0,      -- 21:00–06:00 Colombia
  minutos_festivo     INT DEFAULT 0,
  -- Aprobación
  marcacion_aprobada  BOOLEAN DEFAULT NULL,   -- NULL=pendiente, TRUE=ok, FALSE=rechazada
  aprobado_por        INT NULL,           -- FK → empleados (jefe_nomina)
  aprobado_at         TIMESTAMP NULL,
  motivo_rechazo      TEXT NULL,
  -- Auditoría
  creado_por          INT NULL,           -- FK → empleados
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (tenant_id)    REFERENCES tenants(id),
  FOREIGN KEY (empleado_id)  REFERENCES empleados(id),
  FOREIGN KEY (orden_id)     REFERENCES ordenes_trabajo(id) ON DELETE SET NULL,
  FOREIGN KEY (aprobado_por) REFERENCES empleados(id) ON DELETE SET NULL,
  INDEX idx_tn_empleado_fecha (tenant_id, empleado_id, fecha),
  INDEX idx_tn_fecha (tenant_id, fecha),
  INDEX idx_tn_orden (orden_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Resumen de horas por período (semanal o quincenal)
CREATE TABLE resumenes_horas (
  id              INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id       INT NOT NULL,
  empleado_id     INT NOT NULL,           -- FK → empleados
  periodo_inicio  DATE NOT NULL,
  periodo_fin     DATE NOT NULL,
  tipo_periodo    ENUM('semanal','quincenal') NOT NULL,
  -- Horas acumuladas (en minutos para precisión)
  minutos_regulares       INT DEFAULT 0,
  minutos_extra_diurna    INT DEFAULT 0,  -- Extras durante el día
  minutos_extra_nocturna  INT DEFAULT 0,  -- Extras durante la noche
  minutos_nocturno        INT DEFAULT 0,  -- Nocturno regular
  minutos_festivo         INT DEFAULT 0,  -- Trabajo en festivo
  minutos_extra_festivo   INT DEFAULT 0,  -- Extra en festivo
  -- Estado del resumen
  estado          ENUM('borrador','revisando','aprobado','pagado') DEFAULT 'borrador',
  aprobado_por    INT NULL,               -- FK → empleados (jefe_nomina)
  aprobado_at     TIMESTAMP NULL,
  notas           TEXT NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uk_resumen_periodo (tenant_id, empleado_id, periodo_inicio, tipo_periodo),
  FOREIGN KEY (tenant_id)   REFERENCES tenants(id),
  FOREIGN KEY (empleado_id) REFERENCES empleados(id),
  FOREIGN KEY (aprobado_por) REFERENCES empleados(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### Track Turnos (Gig)

```sql
-- Ofertas laborales publicadas por jefe_turnos
CREATE TABLE ofertas_turno (
  id              INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id       INT NOT NULL,
  orden_id        INT DEFAULT NULL,       -- FK → ordenes_trabajo (opcional)
  jefe_turno_id   INT NOT NULL,           -- FK → empleados (quien publica)
  -- Datos de la oferta
  titulo          VARCHAR(200) NOT NULL,
  descripcion     TEXT,
  fecha           DATE NOT NULL,
  hora_inicio     TIME NOT NULL,
  hora_fin        TIME NOT NULL,
  -- Lugar
  ubicacion       VARCHAR(300) NOT NULL,
  latitud         DECIMAL(10, 8),
  longitud        DECIMAL(11, 8),
  radio_geofence  INT DEFAULT 500,
  -- Condiciones económicas
  valor_dia       DECIMAL(10, 2) NOT NULL, -- Pago por día completo
  incluye_transportes BOOLEAN DEFAULT FALSE,
  valor_transporte    DECIMAL(10, 2) DEFAULT 0,
  -- Recursos humanos
  cupos_requeridos    INT DEFAULT 1,
  cupos_aceptados     INT DEFAULT 0,       -- Se actualiza al aceptar
  -- Jefe en zona (puede ser diferente al jefe_turnos_id)
  jefe_zona_id    INT NULL,               -- FK → empleados
  -- Estado
  estado          ENUM('borrador','publicada','cerrada','completada','cancelada') DEFAULT 'borrador',
  fecha_limite_aceptacion DATETIME NULL,  -- Límite para aceptar
  -- Visibilidad: ¿a quién se envía?
  pool_destino    ENUM('todos','especificos','rol') DEFAULT 'todos',
  pool_rol        VARCHAR(100) NULL,      -- Si pool_destino='rol', qué rol
  -- Auditoría
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (tenant_id)      REFERENCES tenants(id),
  FOREIGN KEY (orden_id)       REFERENCES ordenes_trabajo(id) ON DELETE SET NULL,
  FOREIGN KEY (jefe_turno_id)  REFERENCES empleados(id),
  FOREIGN KEY (jefe_zona_id)   REFERENCES empleados(id) ON DELETE SET NULL,
  INDEX idx_of_fecha (tenant_id, fecha),
  INDEX idx_of_estado (tenant_id, estado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Invitaciones específicas a una oferta
CREATE TABLE oferta_invitaciones (
  id          INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id   INT NOT NULL,
  oferta_id   INT NOT NULL,       -- FK → ofertas_turno
  empleado_id INT NOT NULL,       -- FK → empleados
  estado      ENUM('pendiente','vista','aceptada','rechazada') DEFAULT 'pendiente',
  vista_at    TIMESTAMP NULL,
  respondida_at TIMESTAMP NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY uk_inv (oferta_id, empleado_id),
  FOREIGN KEY (oferta_id)   REFERENCES ofertas_turno(id) ON DELETE CASCADE,
  FOREIGN KEY (empleado_id) REFERENCES empleados(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Micro-contratos: un contrato por trabajador por oferta aceptada
CREATE TABLE contratos_dia (
  id              INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id       INT NOT NULL,
  oferta_id       INT NOT NULL,           -- FK → ofertas_turno
  empleado_id     INT NOT NULL,           -- FK → empleados (trabajador)
  jefe_zona_id    INT NULL,               -- FK → empleados (jefe en zona)
  -- Condiciones del contrato (heredadas de la oferta al aceptar)
  fecha           DATE NOT NULL,
  hora_inicio     TIME NOT NULL,
  hora_fin        TIME NOT NULL,
  ubicacion       VARCHAR(300),
  valor_acordado  DECIMAL(10, 2) NOT NULL, -- Copia al momento de aceptar
  -- Ejecución
  estado          ENUM(
    'pendiente',        -- Aceptado, esperando el día
    'en_curso',         -- Marcó ingreso
    'completado',       -- Marcó egreso
    'no_se_presento',   -- No marcó ingreso
    'cancelado_trabajador',
    'cancelado_empresa'
  ) DEFAULT 'pendiente',
  -- Marcaciones (GPS + timestamp)
  hora_ingreso_real   DATETIME NULL,
  hora_egreso_real    DATETIME NULL,
  ingreso_latitud     DECIMAL(10, 8) NULL,
  ingreso_longitud    DECIMAL(11, 8) NULL,
  egreso_latitud      DECIMAL(10, 8) NULL,
  egreso_longitud     DECIMAL(11, 8) NULL,
  ingreso_dentro_zona BOOLEAN DEFAULT NULL,
  egreso_dentro_zona  BOOLEAN DEFAULT NULL,
  ingreso_foto_url    VARCHAR(500) NULL,
  egreso_foto_url     VARCHAR(500) NULL,
  -- Valor final calculado
  minutos_trabajados  INT DEFAULT 0,
  valor_final         DECIMAL(10, 2) NULL, -- Puede diferir si salió antes
  -- Firmas digitales
  firma_trabajador    TEXT NULL,          -- base64 o hash
  firma_trabajador_at TIMESTAMP NULL,
  firma_jefe          TEXT NULL,
  firma_jefe_at       TIMESTAMP NULL,
  -- Aprobación y pago
  pago_estado     ENUM('pendiente','aprobado','en_proceso','pagado','rechazado') DEFAULT 'pendiente',
  pago_aprobado_por INT NULL,            -- FK → empleados
  pago_aprobado_at  TIMESTAMP NULL,
  pago_ejecutado_at TIMESTAMP NULL,
  pago_referencia   VARCHAR(200) NULL,   -- Número de transacción
  notas           TEXT NULL,
  -- Auditoría
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uk_cd (oferta_id, empleado_id),
  FOREIGN KEY (tenant_id)      REFERENCES tenants(id),
  FOREIGN KEY (oferta_id)      REFERENCES ofertas_turno(id),
  FOREIGN KEY (empleado_id)    REFERENCES empleados(id),
  FOREIGN KEY (jefe_zona_id)   REFERENCES empleados(id) ON DELETE SET NULL,
  FOREIGN KEY (pago_aprobado_por) REFERENCES empleados(id) ON DELETE SET NULL,
  INDEX idx_cd_empleado (tenant_id, empleado_id, fecha),
  INDEX idx_cd_pago (tenant_id, pago_estado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

## PARTE 3 — ENDPOINTS DE LA API

### Base URL: `/api/v1`
### Autenticación: `Authorization: Bearer <jwt>`

---

### AUTENTICACIÓN (compartida con sistema principal)

```
POST  /v1/auth/login        { email, password }
POST  /v1/auth/refresh      { refresh_token }
POST  /v1/auth/logout
GET   /v1/me
```

---

### TRACK NÓMINA — Empleado (`nomina`)

#### Ver mis turnos

```
GET /v1/nomina/mis-turnos

Query params:
  ?desde=2026-05-19
  ?hasta=2026-05-25
  ?estado=programado|en_curso|completado

Response 200:
{
  "success": true,
  "data": [
    {
      "id": 101,
      "fecha": "2026-05-23",
      "hora_inicio": "07:00",
      "hora_fin": "17:00",
      "estado": "programado",
      "ubicacion": "Hotel Dann Carlton, Cra 15 #80-20, Bogotá",
      "latitud": 4.6684,
      "longitud": -74.0538,
      "radio_geofence": 300,
      "orden": {
        "id": 47,
        "tipo": "montaje",
        "evento_nombre": "Boda García-Pérez"
      },
      "jefe": {
        "nombre": "Carlos",
        "apellido": "Rodríguez",
        "telefono": "+57 300 111 2222"
      },
      "horas_hoy": null,
      "hora_ingreso_real": null,
      "hora_egreso_real": null
    }
  ]
}
```

#### Marcar ingreso

```
POST /v1/nomina/turnos/:id/ingreso

Body:
{
  "latitud": 4.6684,
  "longitud": -74.0538,
  "foto_url": "/uploads/ingresos/selfie-juan-20260523.jpg"  // opcional
}

Response 200:
{
  "success": true,
  "data": {
    "id": 101,
    "estado": "en_curso",
    "hora_ingreso_real": "2026-05-23T07:05:32Z",
    "ingreso_dentro_zona": true,
    "distancia_metros": 45,
    "mensaje": "Ingreso registrado correctamente"
  }
}

Response 422 (fuera de zona):
{
  "success": false,
  "message": "Estás a 850m del lugar asignado. Máximo permitido: 300m",
  "data": {
    "distancia_metros": 850,
    "radio_permitido": 300,
    "ingreso_dentro_zona": false
  }
}
```

#### Marcar egreso

```
POST /v1/nomina/turnos/:id/egreso

Body:
{
  "latitud": 4.6684,
  "longitud": -74.0538,
  "foto_url": null,
  "notas": "Trabajo completado sin novedades"
}

Response 200:
{
  "success": true,
  "data": {
    "id": 101,
    "estado": "completado",
    "hora_ingreso_real": "2026-05-23T07:05:32Z",
    "hora_egreso_real": "2026-05-23T17:18:45Z",
    "resumen_horas": {
      "minutos_trabajados": 613,
      "horas_display": "10h 13min",
      "minutos_regular": 480,      // 8 horas regulares
      "minutos_extra": 133,        // 2h 13min extra
      "minutos_nocturno": 0,
      "valor_extra_estimado": null // visible solo para jefe_nomina
    },
    "marcacion_aprobada": null,    // pendiente de revisión
    "mensaje": "Egreso registrado. Horas: 10h 13min"
  }
}
```

#### Mi resumen del período

```
GET /v1/nomina/mi-resumen

Query params:
  ?tipo=semanal|quincenal
  ?periodo_inicio=2026-05-19  // opcional, default: período actual

Response 200:
{
  "success": true,
  "data": {
    "periodo_inicio": "2026-05-19",
    "periodo_fin": "2026-05-25",
    "tipo_periodo": "semanal",
    "estado": "borrador",
    "turnos": [
      {
        "fecha": "2026-05-19",
        "horas_display": "8h 00min",
        "tipo": "regular",
        "estado": "completado"
      },
      {
        "fecha": "2026-05-20",
        "horas_display": "10h 30min",
        "tipo": "con_extra",
        "estado": "completado"
      }
    ],
    "totales": {
      "dias_trabajados": 4,
      "horas_regulares": "32h 00min",
      "horas_extra_diurna": "4h 43min",
      "horas_extra_nocturna": "0h 00min",
      "horas_nocturno_regular": "0h 00min",
      "horas_festivo": "0h 00min"
    },
    "aprobado_por": null,
    "aprobado_at": null
  }
}
```

#### Mi historial

```
GET /v1/nomina/mi-historial

Query params:
  ?desde=2026-04-01
  ?hasta=2026-05-31

Response 200:
{
  "success": true,
  "data": {
    "resumenes": [
      {
        "periodo": "05 May - 11 May",
        "tipo": "semanal",
        "estado": "aprobado",
        "horas_regulares": "40h 00min",
        "horas_extra": "3h 20min"
      }
    ],
    "estadisticas": {
      "dias_trabajados": 18,
      "puntualidad_porcentaje": 94.4,
      "ausencias": 1
    }
  }
}
```

---

### TRACK NÓMINA — Jefe (`jefe_nomina`)

#### Ver equipo hoy

```
GET /v1/jefe-nomina/hoy

Response 200:
{
  "success": true,
  "data": {
    "fecha": "2026-05-23",
    "resumen": {
      "programados": 10,
      "en_turno": 7,
      "pendiente_ingreso": 2,
      "ausentes": 1,
      "completados": 0
    },
    "empleados": [
      {
        "id": 12,
        "nombre": "Juan Rodríguez",
        "foto": "/uploads/perfiles/juan.jpg",
        "turno_id": 101,
        "estado": "en_curso",
        "hora_ingreso_real": "2026-05-23T07:05:32Z",
        "ubicacion": "Hotel Dann Carlton",
        "dentro_zona": true,
        "horas_acumuladas_hoy": "3h 12min"
      },
      {
        "id": 15,
        "nombre": "Pedro Gómez",
        "foto": null,
        "turno_id": 102,
        "estado": "programado",
        "hora_ingreso_real": null,
        "hora_programada": "07:00",
        "minutos_tardanza": 17
      }
    ]
  }
}
```

#### Crear turno para empleado

```
POST /v1/jefe-nomina/turnos

Body:
{
  "empleado_id": 12,
  "fecha": "2026-05-24",
  "hora_inicio": "07:00",
  "hora_fin": "17:00",
  "ubicacion": "Hotel Dann Carlton, Bogotá",
  "latitud": 4.6684,
  "longitud": -74.0538,
  "radio_geofence": 300,
  "orden_id": 47          // opcional, vincula a orden de trabajo
}

Response 201:
{
  "success": true,
  "data": { "id": 103, "estado": "programado", ... }
}
```

#### Crear múltiples turnos (batch)

```
POST /v1/jefe-nomina/turnos/batch

Body:
{
  "turnos": [
    { "empleado_id": 12, "fecha": "2026-05-24", "hora_inicio": "07:00", "hora_fin": "17:00", "ubicacion": "...", "latitud": 4.6684, "longitud": -74.0538 },
    { "empleado_id": 15, "fecha": "2026-05-24", "hora_inicio": "07:00", "hora_fin": "17:00", "ubicacion": "...", "latitud": 4.6684, "longitud": -74.0538 }
  ],
  "orden_id": 47  // aplica a todos (opcional)
}

Response 201:
{
  "success": true,
  "data": {
    "creados": 2,
    "errores": [],
    "turnos": [{ "id": 103, ... }, { "id": 104, ... }]
  }
}
```

#### Ver resúmenes pendientes de aprobación

```
GET /v1/jefe-nomina/resumenes-pendientes

Response 200:
{
  "success": true,
  "data": [
    {
      "id": 55,
      "empleado": { "id": 12, "nombre": "Juan Rodríguez" },
      "periodo": "2026-05-19 / 2026-05-25",
      "tipo": "semanal",
      "horas_regulares": "40h 00min",
      "horas_extra_diurna": "4h 43min",
      "horas_extra_nocturna": "0h",
      "dias_trabajados": 5,
      "ausencias": 0,
      "estado": "borrador"
    }
  ]
}
```

#### Aprobar resumen de horas

```
POST /v1/jefe-nomina/resumenes/:id/aprobar

Body:
{
  "notas": "Todo correcto. Proceder con pago de horas extra."
}

Response 200:
{
  "success": true,
  "data": {
    "id": 55,
    "estado": "aprobado",
    "aprobado_at": "2026-05-26T09:00:00Z"
  }
}
```

#### Aprobar/rechazar marcación específica

```
PATCH /v1/jefe-nomina/turnos/:id/marcacion

Body:
{
  "aprobada": false,
  "motivo_rechazo": "GPS marcado a 1.2km del lugar asignado. Verificar."
}

Response 200:
{
  "success": true,
  "data": {
    "id": 101,
    "marcacion_aprobada": false,
    "motivo_rechazo": "GPS marcado a 1.2km del lugar asignado. Verificar."
  }
}
```

#### Generar resúmenes del período

```
POST /v1/jefe-nomina/generar-resumenes

Body:
{
  "tipo_periodo": "semanal",
  "periodo_inicio": "2026-05-19",
  "periodo_fin": "2026-05-25",
  "empleados_ids": [12, 15, 18]  // vacío = todos los de mi equipo
}

Response 200:
{
  "success": true,
  "data": {
    "resumenes_generados": 12,
    "ya_existian": 0,
    "errores": []
  }
}
```

---

### TRACK TURNOS — Trabajador (`turnos`)

#### Ver mis ofertas disponibles

```
GET /v1/turnos/mis-ofertas

Query params:
  ?estado=disponible|aceptada|rechazada
  ?desde=2026-05-23

Response 200:
{
  "success": true,
  "data": [
    {
      "id": 201,
      "titulo": "Montaje Boda García",
      "descripcion": "Montaje 3 carpas 10x10 + iluminación",
      "fecha": "2026-05-25",
      "hora_inicio": "06:00",
      "hora_fin": "16:00",
      "horas_estimadas": 10,
      "ubicacion": "Finca El Refugio, Chía",
      "latitud": 4.8567,
      "longitud": -74.0124,
      "valor_dia": 120000,
      "incluye_transporte": false,
      "jefe_zona": {
        "nombre": "Juan",
        "apellido": "Mesa",
        "telefono": "+57 300 999 8888"
      },
      "cupos_disponibles": 2,
      "fecha_limite_aceptacion": "2026-05-24T20:00:00Z",
      "mi_estado": "pendiente"   // pendiente|aceptada|rechazada
    }
  ]
}
```

#### Aceptar oferta

```
POST /v1/turnos/ofertas/:id/aceptar

Response 200:
{
  "success": true,
  "data": {
    "contrato_id": 301,
    "oferta_id": 201,
    "estado": "pendiente",
    "fecha": "2026-05-25",
    "hora_inicio": "06:00",
    "hora_fin": "16:00",
    "ubicacion": "Finca El Refugio, Chía",
    "valor_acordado": 120000,
    "jefe_zona": {
      "nombre": "Juan Mesa",
      "telefono": "+57 300 999 8888"
    },
    "instrucciones": "Llegue 15 min antes. Traer herramientas propias.",
    "firma_trabajador_requerida": true
  },
  "message": "Oferta aceptada. Recuerda estar el 25/05 a las 06:00 AM."
}
```

#### Rechazar oferta

```
POST /v1/turnos/ofertas/:id/rechazar

Body:
{
  "motivo": "No puedo ese día"  // opcional
}

Response 200:
{
  "success": true,
  "message": "Oferta rechazada."
}
```

#### Ver mis contratos del día

```
GET /v1/turnos/mis-contratos

Query params:
  ?fecha=2026-05-25
  ?estado=pendiente|en_curso|completado

Response 200:
{
  "success": true,
  "data": [
    {
      "id": 301,
      "oferta_id": 201,
      "fecha": "2026-05-25",
      "hora_inicio": "06:00",
      "hora_fin": "16:00",
      "estado": "pendiente",
      "ubicacion": "Finca El Refugio, Chía",
      "latitud": 4.8567,
      "longitud": -74.0124,
      "valor_acordado": 120000,
      "pago_estado": "pendiente",
      "jefe_zona": {
        "nombre": "Juan Mesa",
        "telefono": "+57 300 999 8888"
      },
      "hora_ingreso_real": null,
      "hora_egreso_real": null
    }
  ]
}
```

#### Marcar ingreso (contrato día)

```
POST /v1/turnos/contratos/:id/ingreso

Body:
{
  "latitud": 4.8567,
  "longitud": -74.0124,
  "foto_url": "/uploads/ingresos/pedro-20260525.jpg"
}

Response 200:
{
  "success": true,
  "data": {
    "id": 301,
    "estado": "en_curso",
    "hora_ingreso_real": "2026-05-25T06:02:15Z",
    "ingreso_dentro_zona": true,
    "distancia_metros": 120
  }
}
```

#### Marcar egreso (contrato día)

```
POST /v1/turnos/contratos/:id/egreso

Body:
{
  "latitud": 4.8567,
  "longitud": -74.0124,
  "notas": "Todo montado según instrucciones",
  "firma_trabajador": "data:image/png;base64,iVBORw0KGg..."  // firma digital
}

Response 200:
{
  "success": true,
  "data": {
    "id": 301,
    "estado": "completado",
    "hora_ingreso_real": "2026-05-25T06:02:15Z",
    "hora_egreso_real": "2026-05-25T16:05:43Z",
    "minutos_trabajados": 603,
    "horas_display": "10h 03min",
    "valor_final": 120000,
    "pago_estado": "pendiente",
    "firma_trabajador_registrada": true,
    "mensaje": "Trabajo registrado. Pendiente confirmación del jefe de zona."
  }
}
```

#### Firmar contrato (previo al trabajo)

```
POST /v1/turnos/contratos/:id/firmar

Body:
{
  "firma": "data:image/png;base64,iVBORw0KGg..."
}

Response 200:
{
  "success": true,
  "data": {
    "id": 301,
    "firma_trabajador_at": "2026-05-24T22:30:00Z"
  }
}
```

---

### TRACK TURNOS — Jefe de Turnos (`jefe_turnos`)

#### Crear oferta laboral

```
POST /v1/jefe-turnos/ofertas

Body:
{
  "titulo": "Montaje Boda García",
  "descripcion": "Montaje 3 carpas 10x10 con iluminación. Experiencia requerida.",
  "fecha": "2026-05-25",
  "hora_inicio": "06:00",
  "hora_fin": "16:00",
  "ubicacion": "Finca El Refugio, Vía Cajicá km 3, Chía",
  "latitud": 4.8567,
  "longitud": -74.0124,
  "radio_geofence": 500,
  "valor_dia": 120000,
  "incluye_transporte": false,
  "cupos_requeridos": 5,
  "jefe_zona_id": 18,
  "fecha_limite_aceptacion": "2026-05-24T20:00:00",
  "orden_id": 47,           // vincula a la orden de trabajo del sistema principal
  "pool_destino": "todos"   // todos|especificos|rol
}

Response 201:
{
  "success": true,
  "data": {
    "id": 201,
    "titulo": "Montaje Boda García",
    "estado": "borrador",
    "cupos_requeridos": 5,
    "cupos_aceptados": 0
  }
}
```

#### Publicar oferta (enviar notificaciones)

```
POST /v1/jefe-turnos/ofertas/:id/publicar

Body:
{
  "empleados_ids": [12, 15, 18, 20, 22]  // solo si pool_destino='especificos'
}

Response 200:
{
  "success": true,
  "data": {
    "id": 201,
    "estado": "publicada",
    "notificaciones_enviadas": 45,
    "cupos_requeridos": 5
  }
}
```

#### Ver estado de cobertura de mis ofertas

```
GET /v1/jefe-turnos/ofertas

Query params:
  ?fecha=2026-05-25
  ?estado=publicada|completada

Response 200:
{
  "success": true,
  "data": [
    {
      "id": 201,
      "titulo": "Montaje Boda García",
      "fecha": "2026-05-25",
      "estado": "publicada",
      "cupos_requeridos": 5,
      "cupos_aceptados": 4,
      "porcentaje_cobertura": 80,
      "hora_limite": "2026-05-24T20:00:00Z",
      "horas_para_cierre": 14.5,
      "trabajadores": [
        { "nombre": "Pedro Gómez", "estado_contrato": "pendiente" },
        { "nombre": "María López", "estado_contrato": "pendiente" }
      ]
    }
  ]
}
```

#### Ver contratos del día (sus trabajadores en campo)

```
GET /v1/jefe-turnos/contratos-hoy

Response 200:
{
  "success": true,
  "data": {
    "fecha": "2026-05-25",
    "resumen": {
      "total": 8,
      "en_curso": 5,
      "completados": 1,
      "no_presento": 0,
      "pendientes_ingreso": 2
    },
    "contratos": [
      {
        "id": 301,
        "empleado": { "nombre": "Pedro Gómez", "foto": null },
        "oferta": { "titulo": "Montaje Boda García" },
        "estado": "en_curso",
        "hora_ingreso_real": "2026-05-25T06:02:15Z",
        "dentro_zona": true
      }
    ]
  }
}
```

#### Marcar no se presentó

```
POST /v1/jefe-turnos/contratos/:id/no-presento

Response 200:
{
  "success": true,
  "data": { "id": 305, "estado": "no_se_presento" }
}
```

#### Firmar contrato (jefe de zona cierra el día)

```
POST /v1/jefe-turnos/contratos/:id/firmar-jefe

Body:
{
  "firma": "data:image/png;base64,...",
  "notas": "Trabajo ejecutado correctamente",
  "valor_final": 120000  // puede ajustar si el trabajador salió antes
}

Response 200:
{
  "success": true,
  "data": {
    "id": 301,
    "estado": "completado",
    "firma_jefe_at": "2026-05-25T16:10:00Z",
    "valor_final": 120000,
    "pago_estado": "pendiente"
  }
}
```

#### Aprobar pagos en lote

```
POST /v1/jefe-turnos/pagos/aprobar

Body:
{
  "contratos_ids": [301, 302, 303, 304]
}

Response 200:
{
  "success": true,
  "data": {
    "aprobados": 4,
    "total_a_pagar": 480000,
    "contratos": [
      { "id": 301, "empleado": "Pedro Gómez", "valor": 120000 }
    ]
  }
}
```

#### Registrar pago ejecutado

```
POST /v1/jefe-turnos/pagos/registrar

Body:
{
  "contratos_ids": [301, 302, 303, 304],
  "metodo_pago": "transferencia",
  "referencia": "TRX-2026-05-25-001",
  "fecha_pago": "2026-05-26"
}

Response 200:
{
  "success": true,
  "data": {
    "pagos_registrados": 4,
    "total_pagado": 480000
  }
}
```

---

## PARTE 4 — LÓGICA DE HORAS (Ley Colombiana)

```javascript
// Referencia laboral colombiana (Código Sustantivo del Trabajo)

const HORA_NOCTURNA_INICIO = 21; // 9 PM
const HORA_NOCTURNA_FIN = 6;     // 6 AM
const HORAS_JORNADA_MAXIMA = 8;  // Horas regulares por día

function calcularHoras(ingreso, egreso, esNomina = true) {
    const minutosTotal = Math.floor((egreso - ingreso) / 60000);

    // Minutos en jornada diurna vs nocturna
    let minutosRegular = 0;
    let minutosExtraDiurna = 0;
    let minutosExtraNocturna = 0;
    let minutosNocturnoRegular = 0;

    // Iterar minuto a minuto para determinar si es diurno/nocturno
    // (simplificado: en producción usar rangos de intersección)
    const hora = ingreso.getHours();
    const esHoraNocturna = hora >= 21 || hora < 6;

    // Primeras 8 horas: regulares (diurnas o nocturnas)
    const minutosMaxRegular = HORAS_JORNADA_MAXIMA * 60;
    if (minutosTotal <= minutosMaxRegular) {
        if (esHoraNocturna) minutosNocturnoRegular = minutosTotal;
        else minutosRegular = minutosTotal;
    } else {
        // Hasta 8h = regular, resto = extra
        if (esHoraNocturna) minutosNocturnoRegular = minutosMaxRegular;
        else minutosRegular = minutosMaxRegular;

        const minutosExtra = minutosTotal - minutosMaxRegular;
        if (esHoraNocturna) minutosExtraNocturna = minutosExtra;
        else minutosExtraDiurna = minutosExtra;
    }

    return {
        minutos_trabajados: minutosTotal,
        minutos_regular: minutosRegular,
        minutos_extra_diurna: minutosExtraDiurna,
        minutos_extra_nocturna: minutosExtraNocturna,
        minutos_nocturno_regular: minutosNocturnoRegular,
        horas_display: `${Math.floor(minutosTotal / 60)}h ${minutosTotal % 60}min`
    };
}

// Recargos legales (valores orientativos, configurables)
const RECARGOS = {
    extra_diurna: 1.25,      // 25% sobre hora base
    extra_nocturna: 1.75,    // 75% sobre hora base
    nocturno_regular: 1.35,  // 35% sobre hora base
    festivo_regular: 1.75,   // 75% sobre hora base
    festivo_extra: 2.00      // 100% sobre hora base
};
```

---

## PARTE 5 — INTEGRACIÓN CON SISTEMA PRINCIPAL

### Vinculación Oferta/Turno ↔ Orden de Trabajo

```
Sistema Principal (Carpas)          App Control de Turnos
─────────────────────────           ─────────────────────
OrdenTrabajo (montaje #47)    ←──→  OfertaTurno #201
  tipo: montaje                       titulo: "Montaje Boda García"
  fecha_programada: 2026-05-25        fecha: 2026-05-25
  direccion_evento: Finca El Refugio  ubicacion: Finca El Refugio
  equipo asignado: [intern]           cupos: 5 trabajadores gig

TurnoNomina #103 ←──→ OrdenTrabajoEquipo #12
  empleado_id: 12                     empleado_id: 12
  fecha: 2026-05-25                   orden_id: 47
  estado: completado                  rol_en_orden: responsable
```

### Endpoints de consulta cruzada

```
// Desde el sistema principal: ver quién está en campo para la orden
GET /v1/ordenes/:id/personal-activo

Response:
{
  "success": true,
  "data": {
    "nomina": [
      { "nombre": "Juan Rodríguez", "estado_turno": "en_curso", "ingreso": "07:05" }
    ],
    "turnos": [
      { "nombre": "Pedro Gómez", "estado_contrato": "en_curso", "ingreso": "06:02" }
    ],
    "total_en_sitio": 6
  }
}

// Desde la app de turnos: detalles de la orden vinculada
GET /v1/turnos/ofertas/:id/orden-vinculada

Response:
{
  "success": true,
  "data": {
    "orden_id": 47,
    "tipo": "montaje",
    "evento_nombre": "Boda García-Pérez",
    "productos": [
      { "nombre": "Carpa 10x10 Premium", "cantidad": 3 },
      { "nombre": "Sistema iluminación", "cantidad": 1 }
    ],
    "notas_coordinador": "Llegada antes 6AM. Patio trasero de la finca."
  }
}
```

---

## PARTE 6 — NOTIFICACIONES PUSH

### Eventos que disparan notificación

| Evento | Destinatario | Mensaje |
|--------|-------------|---------|
| Oferta publicada | Trabajadores del pool | "Nueva oferta: {titulo} - {fecha} - ${valor}" |
| Oferta aceptada | jefe_turnos | "{nombre} aceptó la oferta {titulo}" |
| Cupos completos | jefe_turnos | "Cupos completos para {titulo}" |
| Cupos a punto de cerrar | jefe_turnos | "Último cupo disponible para {titulo}" |
| Turno programado | nomina | "Turno asignado: {fecha} {hora} en {ubicacion}" |
| 1 hora antes del turno | nomina / turnos | "Recordatorio: Tu turno empieza en 1 hora" |
| Trabajador no marcó ingreso | jefe_nomina / jefe_turnos | "{nombre} no ha marcado ingreso (tardanza: {N}min)" |
| Marcación fuera de zona | jefe_nomina | "{nombre} marcó ingreso a {N}m del lugar" |
| Pago aprobado | turnos | "Tu pago de ${monto} fue aprobado" |
| Resumen de horas listo | nomina | "Tu resumen semanal está listo para revisión" |

### Endpoint de suscripción push

```
POST /v1/notificaciones/suscribir

Body:
{
  "token_dispositivo": "fcm-token-aqui",
  "plataforma": "android|ios"
}
```

---

## PARTE 7 — ERRORES Y CASOS BORDE

### Marcación fuera de zona (geofencing)

```javascript
// El backend siempre registra la marcación aunque esté fuera de zona
// La bandera ingreso_dentro_zona = false alerta al jefe_nomina
// El jefe puede aprobar o rechazar la marcación manualmente

// Reglas de negocio:
// - radio_geofence del turno define el radio permitido (default: 300m)
// - Si fuera_zona: se registra pero queda pendiente de aprobación
// - Si dentro_zona: se aprueba automáticamente

function validarGeofence(turno, latitud, longitud) {
    const distancia = calcularDistancia(
        turno.latitud, turno.longitud,
        latitud, longitud
    ); // metros
    return {
        dentro_zona: distancia <= turno.radio_geofence,
        distancia_metros: Math.round(distancia)
    };
}
```

### Marcación duplicada (ingreso cuando ya está en curso)

```
POST /v1/nomina/turnos/101/ingreso  (segunda vez)

Response 409:
{
  "success": false,
  "message": "Ya tienes un ingreso registrado para este turno",
  "data": {
    "hora_ingreso_existente": "2026-05-23T07:05:32Z"
  }
}
```

### Oferta ya sin cupos

```
POST /v1/turnos/ofertas/201/aceptar  (cupos llenos)

Response 409:
{
  "success": false,
  "message": "Esta oferta ya no tiene cupos disponibles",
  "data": {
    "cupos_requeridos": 5,
    "cupos_aceptados": 5
  }
}
```

### Oferta expirada

```
POST /v1/turnos/ofertas/201/aceptar  (después de fecha_limite)

Response 422:
{
  "success": false,
  "message": "El plazo para aceptar esta oferta venció el 24 May a las 8:00 PM"
}
```

---

## PARTE 8 — TABLA RESUMEN DE ENDPOINTS

```
AUTENTICACIÓN
─────────────
POST  /v1/auth/login
POST  /v1/auth/refresh
POST  /v1/auth/logout
GET   /v1/me

TRACK NÓMINA — ROL nomina
──────────────────────────
GET   /v1/nomina/mis-turnos                         Ver mis turnos
GET   /v1/nomina/mi-resumen                         Resumen período actual
GET   /v1/nomina/mi-historial                       Historial de períodos
GET   /v1/nomina/turnos/:id                         Detalle de un turno
POST  /v1/nomina/turnos/:id/ingreso                 Marcar ingreso
POST  /v1/nomina/turnos/:id/egreso                  Marcar egreso

TRACK NÓMINA — ROL jefe_nomina
──────────────────────────────
GET   /v1/jefe-nomina/hoy                           Panel del día
GET   /v1/jefe-nomina/mi-equipo                     Lista de empleados
GET   /v1/jefe-nomina/turnos                        Ver todos los turnos del equipo
POST  /v1/jefe-nomina/turnos                        Crear turno
POST  /v1/jefe-nomina/turnos/batch                  Crear múltiples turnos
GET   /v1/jefe-nomina/turnos/:id                    Detalle de turno
PATCH /v1/jefe-nomina/turnos/:id                    Editar turno
DELETE /v1/jefe-nomina/turnos/:id                   Cancelar turno
PATCH /v1/jefe-nomina/turnos/:id/marcacion          Aprobar/rechazar marcación
GET   /v1/jefe-nomina/resumenes-pendientes          Resúmenes por aprobar
POST  /v1/jefe-nomina/generar-resumenes             Generar corte de período
GET   /v1/jefe-nomina/resumenes/:id                 Ver resumen detallado
POST  /v1/jefe-nomina/resumenes/:id/aprobar         Aprobar resumen
POST  /v1/jefe-nomina/resumenes/:id/observar        Devolver con observación
GET   /v1/jefe-nomina/mapa                          GPS en tiempo real del equipo

TRACK TURNOS — ROL turnos
──────────────────────────
GET   /v1/turnos/mis-ofertas                        Ofertas disponibles/historial
POST  /v1/turnos/ofertas/:id/aceptar                Aceptar oferta
POST  /v1/turnos/ofertas/:id/rechazar               Rechazar oferta
GET   /v1/turnos/mis-contratos                      Mis micro-contratos
GET   /v1/turnos/contratos/:id                      Detalle de contrato
POST  /v1/turnos/contratos/:id/firmar               Firma digital previa
POST  /v1/turnos/contratos/:id/ingreso              Marcar ingreso
POST  /v1/turnos/contratos/:id/egreso               Marcar egreso + firma final
GET   /v1/turnos/mis-pagos                          Historial de pagos recibidos

TRACK TURNOS — ROL jefe_turnos
──────────────────────────────
GET   /v1/jefe-turnos/ofertas                       Mis ofertas publicadas
POST  /v1/jefe-turnos/ofertas                       Crear oferta
GET   /v1/jefe-turnos/ofertas/:id                   Detalle + estado cobertura
PATCH /v1/jefe-turnos/ofertas/:id                   Editar oferta (solo borrador)
POST  /v1/jefe-turnos/ofertas/:id/publicar          Publicar + notificar
POST  /v1/jefe-turnos/ofertas/:id/cerrar            Cerrar aceptaciones
POST  /v1/jefe-turnos/ofertas/:id/cancelar          Cancelar oferta
GET   /v1/jefe-turnos/contratos-hoy                 Panel del día en campo
GET   /v1/jefe-turnos/contratos/:id                 Detalle del contrato
POST  /v1/jefe-turnos/contratos/:id/no-presento     Marcar ausencia
POST  /v1/jefe-turnos/contratos/:id/firmar-jefe     Firma de cierre
GET   /v1/jefe-turnos/pagos-pendientes              Contratos listos para pagar
POST  /v1/jefe-turnos/pagos/aprobar                 Aprobar lote de pagos
POST  /v1/jefe-turnos/pagos/registrar               Registrar pago ejecutado

CONSULTAS CRUZADAS (sistema principal ↔ app)
─────────────────────────────────────────────
GET   /v1/ordenes/:id/personal-activo               Quién está en campo por orden
GET   /v1/turnos/ofertas/:id/orden-vinculada        Detalles de orden desde la oferta

NOTIFICACIONES
──────────────
POST  /v1/notificaciones/suscribir                  Registrar token push
DELETE /v1/notificaciones/suscribir                 Desuscribir dispositivo
```

---

## PARTE 9 — SEGURIDAD Y PERMISOS POR ENDPOINT

```
                           nomina  jefe_nomina  turnos  jefe_turnos
────────────────────────────────────────────────────────────────────
mis-turnos / mis-ofertas     ✅        ✅          ✅        ✅
marcar ingreso/egreso        ✅        ❌          ✅        ❌
ver panel equipo hoy         ❌        ✅          ❌        ✅
crear turnos / ofertas       ❌        ✅          ❌        ✅
aprobar marcaciones          ❌        ✅          ❌        ❌
generar resumenes            ❌        ✅          ❌        ❌
aprobar resumenes horas      ❌        ✅          ❌        ❌
aceptar/rechazar oferta      ❌        ❌          ✅        ❌
ver contratos propios        ❌        ❌          ✅        ✅*
firmar como jefe de zona     ❌        ❌          ❌        ✅
aprobar pagos gig            ❌        ❌          ❌        ✅
mapa en tiempo real          ❌        ✅          ❌        ✅
ver historial de pagos       ✅        ❌          ✅        ❌

✅* = jefe_turnos ve contratos de sus propias ofertas
```

---

## PARTE 10 — DATOS NUNCA EXPONER (COMPARTIDO CON SISTEMA PRINCIPAL)

```
NUNCA en ningún endpoint de la app:
├── password_hash de empleados
├── refresh_token / api_keys.hash
├── valor_turno / valor_hora (nómina interna del sistema de carpas)
├── costo_mantenimiento de órdenes
├── totales financieros de cotizaciones/alquileres
├── datos fiscales de clientes (NIT, regimen, DIAN)
└── datos de otros tenants

VISIBLE SOLO PARA EL PROPIO TRABAJADOR:
└── valor_acordado de su contrato_dia
    (el trabajador de turnos sí puede ver su valor_dia porque lo aceptó)

VISIBLE SOLO PARA JEFE:
├── Todos los valor_acordado de su equipo de turnos
└── Datos de GPS en tiempo real de su equipo de nómina
```

---

*Documento complementario a `API-INTEGRACION-APP-TO-APP.md`*  
*Sistema: Inventario y Alquileres de Carpas — Integración App Control de Turnos*
