# App Turnos — Base de Datos

## Tablas

### `empresas` (tenant raíz)
```sql
CREATE TABLE empresas (
  id INT PRIMARY KEY AUTO_INCREMENT,
  nombre VARCHAR(200) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  nit VARCHAR(20),
  ciudad VARCHAR(100),
  activo TINYINT DEFAULT 1,
  plan ENUM('basico','profesional','empresarial') DEFAULT 'basico',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### `usuarios`
```sql
CREATE TABLE usuarios (
  id INT PRIMARY KEY AUTO_INCREMENT,
  empresa_id INT NOT NULL,
  nombre VARCHAR(100) NOT NULL,
  apellido VARCHAR(100),
  email VARCHAR(200) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  rol ENUM('admin_empresa','jefe_turnos','jefe_nomina','nomina','trabajador_turnos','trabajador_nomina') NOT NULL,
  activo TINYINT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (empresa_id) REFERENCES empresas(id)
);
```

### `trabajadores` (personas físicas — pueden tener rol nomina O turnos O ambos)
```sql
CREATE TABLE trabajadores (
  id INT PRIMARY KEY AUTO_INCREMENT,
  empresa_id INT NOT NULL,
  usuario_id INT NULL,          -- si tiene login en la app
  nombre VARCHAR(100) NOT NULL,
  apellido VARCHAR(100) NOT NULL,
  cedula VARCHAR(20),
  telefono VARCHAR(20),
  email VARCHAR(200),
  tipo ENUM('nomina','turnos','ambos') NOT NULL DEFAULT 'turnos',
  cargo VARCHAR(100),
  tarifa_hora DECIMAL(10,2),    -- para track Turnos
  salario_base DECIMAL(12,2),   -- para track Nómina
  activo TINYINT DEFAULT 1,
  -- Referencia externa si logiq360 lo envió
  external_ref VARCHAR(100),    -- ej: "logiq360:empleado:47"
  -- Ranking (track Turnos): promedio de calificaciones por turno
  ranking DECIMAL(3,2) NULL,             -- 0.00 a 5.00, NULL si aún no tiene
  total_calificaciones INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (empresa_id) REFERENCES empresas(id),
  INDEX idx_trabajadores_empresa (empresa_id, activo),
  INDEX idx_trabajadores_external (external_ref),
  INDEX idx_trabajadores_ranking (empresa_id, ranking)
);
```

### `periodos_nomina` (track Nómina — ciclo quincenal/semanal)
```sql
CREATE TABLE periodos_nomina (
  id INT PRIMARY KEY AUTO_INCREMENT,
  empresa_id INT NOT NULL,
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  tipo ENUM('semanal','quincenal','mensual') NOT NULL DEFAULT 'quincenal',
  estado ENUM('abierto','cerrado','liquidado') DEFAULT 'abierto',
  cerrado_por INT NULL,
  cerrado_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (empresa_id) REFERENCES empresas(id)
);
```

### `registros_diarios` (track Nómina — acumulación diaria)
```sql
CREATE TABLE registros_diarios (
  id INT PRIMARY KEY AUTO_INCREMENT,
  empresa_id INT NOT NULL,
  trabajador_id INT NOT NULL,
  periodo_id INT NOT NULL,
  fecha DATE NOT NULL,
  hora_entrada TIME,
  hora_salida TIME,
  -- Calculados al cierre del día
  horas_ordinarias DECIMAL(5,2) DEFAULT 0,
  horas_extra_diurnas DECIMAL(5,2) DEFAULT 0,   -- +25%
  horas_extra_nocturnas DECIMAL(5,2) DEFAULT 0, -- +75%
  horas_nocturnas DECIMAL(5,2) DEFAULT 0,        -- +35%
  horas_festivo DECIMAL(5,2) DEFAULT 0,          -- +75%
  es_festivo TINYINT DEFAULT 0,
  novedad TEXT NULL,
  aprobado_por INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_registro (empresa_id, trabajador_id, fecha),
  FOREIGN KEY (empresa_id) REFERENCES empresas(id),
  FOREIGN KEY (trabajador_id) REFERENCES trabajadores(id),
  FOREIGN KEY (periodo_id) REFERENCES periodos_nomina(id)
);
```

### `ofertas_turno` (track Turnos — oferta de día de trabajo)
```sql
CREATE TABLE ofertas_turno (
  id INT PRIMARY KEY AUTO_INCREMENT,
  empresa_id INT NOT NULL,
  titulo VARCHAR(200) NOT NULL,
  descripcion TEXT,
  fecha DATE NOT NULL,
  hora_inicio TIME NOT NULL,
  hora_fin_estimada TIME,
  lugar VARCHAR(300),
  latitud DECIMAL(10,8),
  longitud DECIMAL(11,8),
  plazas_disponibles INT NOT NULL DEFAULT 1,
  plazas_cubiertas INT DEFAULT 0,
  tarifa_dia DECIMAL(10,2) NOT NULL,
  estado ENUM('abierta','en_proceso','completada','cancelada') DEFAULT 'abierta',
  -- Referencia a orden de trabajo de logiq360 (si aplica)
  external_ref VARCHAR(100),    -- ej: "logiq360:orden:33"
  creado_por INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (empresa_id) REFERENCES empresas(id),
  INDEX idx_ofertas_fecha (empresa_id, fecha, estado)
);
```

### `asignaciones_turno` (quién aceptó qué oferta)
```sql
CREATE TABLE asignaciones_turno (
  id INT PRIMARY KEY AUTO_INCREMENT,
  empresa_id INT NOT NULL,
  oferta_id INT NOT NULL,
  trabajador_id INT NOT NULL,
  estado ENUM('pendiente','confirmado','en_progreso','completado','no_presentado','cancelado') DEFAULT 'pendiente',
  hora_ingreso_real TIMESTAMP NULL,
  hora_egreso_real TIMESTAMP NULL,
  latitud_ingreso DECIMAL(10,8),
  longitud_ingreso DECIMAL(11,8),
  firma_digital TEXT NULL,         -- base64 del canvas
  contrato_pdf_url VARCHAR(500),
  horas_trabajadas DECIMAL(5,2),
  pago_total DECIMAL(10,2),
  pagado_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_asignacion (oferta_id, trabajador_id),
  FOREIGN KEY (empresa_id) REFERENCES empresas(id),
  FOREIGN KEY (oferta_id) REFERENCES ofertas_turno(id),
  FOREIGN KEY (trabajador_id) REFERENCES trabajadores(id)
);
```

### `calificaciones_turno` (track Turnos — calificación del jefe al terminar el turno)
```sql
CREATE TABLE calificaciones_turno (
  id INT PRIMARY KEY AUTO_INCREMENT,
  empresa_id INT NOT NULL,
  asignacion_id INT NOT NULL,        -- una calificación por asignación (UNIQUE)
  trabajador_id INT NOT NULL,
  calificacion TINYINT NOT NULL,     -- 1 a 5 estrellas
  comentario VARCHAR(500) NULL,
  calificado_por INT NOT NULL,       -- usuario_id del jefe
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_calificacion_asignacion (asignacion_id),
  FOREIGN KEY (empresa_id) REFERENCES empresas(id),
  FOREIGN KEY (asignacion_id) REFERENCES asignaciones_turno(id) ON DELETE CASCADE,
  FOREIGN KEY (trabajador_id) REFERENCES trabajadores(id),
  INDEX idx_calif_trabajador (trabajador_id, created_at)
);
```

Cada vez que se inserta una fila, el backend recomputa
`trabajadores.ranking = AVG(calificacion)` y `total_calificaciones = COUNT(*)`
del trabajador, en la misma transacción. El ranking se usa para escalonar
la visibilidad de ofertas (ver `03-API-ENDPOINTS.md`).

### `contratos_diarios` (documento legal por asignación)
```sql
CREATE TABLE contratos_diarios (
  id INT PRIMARY KEY AUTO_INCREMENT,
  empresa_id INT NOT NULL,
  asignacion_id INT NOT NULL UNIQUE,
  numero_contrato VARCHAR(50),
  fecha DATE NOT NULL,
  descripcion_labor TEXT,
  valor_dia DECIMAL(10,2),
  firmado_trabajador TINYINT DEFAULT 0,
  firmado_at TIMESTAMP NULL,
  firma_b64 TEXT,
  pdf_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (empresa_id) REFERENCES empresas(id),
  FOREIGN KEY (asignacion_id) REFERENCES asignaciones_turno(id)
);
```

### `integration_events_out` / `integration_events_in`
Idénticas en estructura a las de logiq360 (ver migración 57). Permite audit trail en ambas direcciones.

## Cálculo de horas extra (ley laboral colombiana)

```
Jornada ordinaria: 8 horas diarias (máximo 47 semanales, reduciendo a 42 en 2026)
Horario nocturno: 21:00 – 06:00

Recargos:
  Horas extra diurnas     = valor_hora × 1.25
  Horas extra nocturnas   = valor_hora × 1.75
  Horas nocturnas         = valor_hora × 1.35
  Dominical/festivo diurno = valor_hora × 1.75
  Dominical/festivo nocturno = valor_hora × 2.10

Festivos Colombia 2025:
  Enero 1, Enero 6, Marzo 24, Abril 17, Abril 18, Mayo 1,
  Junio 2, Junio 23, Junio 30, Julio 20, Agosto 7, Agosto 18,
  Octubre 13, Noviembre 3, Noviembre 17, Diciembre 8, Diciembre 25
```

Ver `utils/laboralUtils.js` para la implementación.

---

## Migración 010 — Multi-empresa del trabajador_turnos

### Nueva tabla `trabajador_empresa`

Vínculo N:N entre `usuarios` (rol `trabajador_turnos`) y `empresas`. Implementa el doble opt-in.

```sql
CREATE TABLE trabajador_empresa (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id          INT NOT NULL,           -- FK usuarios.id (trabajador_turnos)
  empresa_id          INT NOT NULL,           -- FK empresas.id
  trabajador_id       INT NULL,               -- FK trabajadores.id (se asigna al aprobar)
  estado              ENUM(
                        'solicitado_por_trabajador',
                        'solicitado_por_empresa',
                        'activo',
                        'rechazado',
                        'archivado'
                      ) NOT NULL,
  iniciado_por        ENUM('trabajador', 'empresa') NOT NULL,
  fecha_solicitud     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_resuelto      DATETIME NULL,
  motivo_rechazo      VARCHAR(255) NULL,
  UNIQUE KEY uk_usuario_empresa (usuario_id, empresa_id),
  KEY idx_empresa_estado (empresa_id, estado),
  KEY idx_usuario_estado  (usuario_id, estado)
);
```

**Estados del ciclo de vida:**

| Estado | Iniciado por | Descripción |
|--------|-------------|-------------|
| `solicitado_por_trabajador` | Trabajador | El trabajador pidió sumarse; la empresa aprueba o rechaza |
| `solicitado_por_empresa` | Empresa | La empresa invitó (por cédula); el trabajador acepta o rechaza |
| `activo` | Ambos | Vínculo activo — el trabajador recibe ofertas y puede postularse |
| `rechazado` | Ambos | Terminal — no vuelve a notificar |
| `archivado` | Ambos | Cierre después de `activo` (renuncia o desvinculación) |

Al pasar a `activo`, si no existe una fila en `trabajadores` con esa cédula+empresa, se crea automáticamente y se asigna a `trabajador_id`.

### Cambios en tabla `usuarios`

- `empresa_id` pasa de `NOT NULL` a `NULL` **solo para `rol = 'trabajador_turnos'`**.
- Para todos los demás roles sigue siendo `NOT NULL` por validación de aplicación.

### Cambios en tabla `empresas`

Nuevas columnas para el directorio público:

```sql
acepta_postulaciones TINYINT NOT NULL DEFAULT 1,
logo_url             VARCHAR(500) NULL,
descripcion          TEXT NULL
```

### Backfill

Por cada usuario `trabajador_turnos` existente con `empresa_id` asignado:
1. Se inserta una fila en `trabajador_empresa` con estado `activo` y `trabajador_id` vinculado si corresponde.
2. Se pone `usuarios.empresa_id = NULL`.

---

## Migración 012 — Catálogo de cargos y cargos por trabajador

Soporta distintos perfiles operativos de trabajador (auxiliar, jefe de montaje, conductor, …) con tarifas diferenciadas a futuro. Una persona puede tener varios cargos a la vez, y cada cargo es **reconocido por una empresa específica**: ser jefe de montaje en empresa A no te hace jefe en empresa B.

### Nueva tabla `cargos` (catálogo híbrido)

```sql
CREATE TABLE cargos (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id  INT NULL,                -- NULL = sistema, !NULL = custom de esa empresa
  codigo      VARCHAR(50) NOT NULL,    -- 'auxiliar', 'jefe_montaje', 'conductor'
  nombre      VARCHAR(100) NOT NULL,
  descripcion VARCHAR(255) NULL,
  activo      TINYINT NOT NULL DEFAULT 1,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_empresa_codigo (empresa_id, codigo),
  FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
);
```

**Seed inicial del sistema:**

| codigo | nombre | descripcion |
|--------|--------|-------------|
| `auxiliar` | Auxiliar | Personal de apoyo general en montajes y operaciones |
| `jefe_montaje` | Jefe de montaje | Coordina y supervisa el equipo de montaje en sitio |
| `conductor` | Conductor | Operador de vehículos para transporte de personal o equipos |

**Nota sobre UNIQUE**: MySQL trata `NULL` como distinto en `UNIQUE`, por lo que la unicidad de cargos del sistema (`empresa_id IS NULL`, `codigo`) se garantiza por control de migraciones, no por la DB. Los endpoints no permiten crear cargos del sistema; solo migraciones revisadas.

### Nueva tabla `trabajador_cargos`

```sql
CREATE TABLE trabajador_cargos (
  id                    INT AUTO_INCREMENT PRIMARY KEY,
  trabajador_empresa_id INT NOT NULL,    -- FK al vínculo, no al usuario
  cargo_id              INT NOT NULL,
  asignado_por          INT NOT NULL,    -- usuario_id del jefe/admin que asignó
  asignado_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_te_cargo (trabajador_empresa_id, cargo_id),
  FOREIGN KEY (trabajador_empresa_id) REFERENCES trabajador_empresa(id) ON DELETE CASCADE,
  FOREIGN KEY (cargo_id)              REFERENCES cargos(id),
  FOREIGN KEY (asignado_por)          REFERENCES usuarios(id)
);
```

Cuelga de `trabajador_empresa.id`, no de `usuarios.id`. Eso garantiza que un mismo trabajador puede tener cargos distintos en empresas distintas, y que al desvincularse de una empresa se borran sus cargos en esa empresa (cascade) sin afectar los demás.

### Reglas de negocio

| Acción | Quién | Detalle |
|--------|-------|---------|
| Ver catálogo | Cualquier usuario autenticado | Devuelve cargos del sistema + custom de su empresa, todos `activo=1`. |
| Crear cargo custom | `jefe_turnos` / `admin_empresa` | Código se autogenera del nombre si no se provee; choca con cargos del sistema. |
| Editar cargo custom | `jefe_turnos` / `admin_empresa` | Solo cargos de su propia empresa. Cargos del sistema son inmutables. |
| Eliminar cargo custom | `jefe_turnos` / `admin_empresa` | Hard delete si nadie lo usa; soft delete (`activo=0`) si está asignado. |
| Asignar cargo a trabajador | `jefe_turnos` / `admin_empresa` | El vínculo debe estar `activo`. El cargo debe ser del sistema o de su empresa. |
| Auto-declaración por el trabajador | **No permitida** | Solo la empresa certifica los cargos. |

### Implicación para ofertas y postulaciones (PR-B, próxima migración 013)

En la siguiente migración, `ofertas_turno` deja de tener `tarifa_dia` y `plazas_*` directos; esos campos pasan a una tabla `oferta_puestos` con un puesto por cargo (cargo + tarifa + plazas). Un trabajador solo puede postular a un puesto cuyo `cargo_id` esté en sus `trabajador_cargos` para esa empresa.
