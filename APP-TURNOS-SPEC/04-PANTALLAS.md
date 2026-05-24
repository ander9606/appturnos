# App Turnos — Pantallas y Flujos de Usuario

> **Diseño visual:** los wireframes y mockups vivos están en Figma (links pendientes por iteración). Este documento describe **flujos, datos y endpoints**, no layout pixel-perfect. El prototipo HTML de referencia con device frame iOS 26 está en `App Turnos.html` (servir como `file://` o desde cualquier estático).
>
> **Estados transversales obligatorios en toda pantalla:**
> - `loading` — esqueleto o spinner mientras llega data
> - `error` — mensaje + acción de reintentar
> - `empty` — copy + CTA cuando la lista está vacía
> - `offline` — banner persistente + comportamiento degradado (lectura del último caché)

---

## Sistema visual — color por track

| Track | Primary | Primary deep | Primary tint | Uso |
|-------|---------|--------------|--------------|-----|
| **Turnos** (TRABAJADOR_TURNOS, JEFE_TURNOS) | `#FF5A3C` (orange-red) | `#C2410C` | `#FFEDD5` | TabBar activa, botones primarios, chip de empresa, banner del turno activo |
| **Nómina** (TRABAJADOR_NOMINA, JEFE_NOMINA) | `#059669` (emerald-600) | `#065F46` | `#D1FAE5` | TabBar activa, marca de "HOY" en grid de registros, botones primarios del track |
| **Compartido** | `text` `#0F172A`, `muted` `#64748B`, `border` `#E2E8F0`, `bg` `#F8FAFC` | — | — | Tipografía, fondos, separadores |

**Regla:** el color se elige por el **track del rol activo**, no por el rol del usuario. Un jefe que entra a una vista del track nómina ve verde; en su tablero de turnos ve naranja. La TabBar cambia el color del borde superior y del icono activo según el tab actual (ver `App Turnos.html` para la implementación de referencia).

**Estados semánticos** (transversales a ambos tracks): `success` `#10B981` · `warning` `#F59E0B` · `destructive` `#EF4444` · `info` `#3B82F6`.

---

## Iteración 1 — Design System + Auth + Onboarding

> Iteración base. Hasta que esto esté listo, ninguna otra iteración debería arrancar.

### Pantallas

#### 1.1 Design System (página Figma)

No es pantalla de app. Es la fuente de verdad de tokens y primitivos:

- **Tokens**: paleta (los dos tracks + estados), tipografía (Inter), spacing, radius (`sm`/`md`/`lg`/`xl`), shadow.
- **Primitivos**: `Button` (variants: primary, secondary, ghost, destructive · sizes: sm/md/lg), `Input`, `Card`, `ListItem`, `Badge`, `Chip`, `Modal`, `BottomSheet`, `Tab bar`, `AppBar`, `EmptyState`, `ErrorState`, `LoadingState`, `OfflineBanner`, `RatingStars`, `SignaturePad`, `MapPin`, `IndicadorProximidad`.
- **Estados de cada primitivo**: default / hover / pressed / disabled / focus.

#### 1.2 Login

| Campo | Detalle |
|-------|---------|
| Rol | Cualquiera |
| Inputs | `email`, `password` |
| Acciones | `[Iniciar sesión]` · `[¿Olvidaste tu contraseña?]` (post-MVP) · `[Crear cuenta]` (lleva a Registro libre) |
| Endpoint | `POST /api/auth/login` |
| Errores | Cuenta bloqueada tras 5 intentos (429), credenciales inválidas (401) |
| Navegación post-éxito | `TRABAJADOR_TURNOS` sin empresas → Bienvenida (1.5). Otros → Home del track correspondiente |

#### 1.3 Activar cuenta (trabajador creado por la empresa)

| Campo | Detalle |
|-------|---------|
| Rol | Trabajador sin login (creado por jefe via `POST /api/trabajadores`) |
| Inputs | `cedula`, `email`, `password` (mín 8 chars) |
| Endpoint | `POST /api/auth/activar-cuenta` |
| Acción post-éxito | Auto-login y navegar a Home del track |

#### 1.4 Registro libre (NUEVO — marketplace TRABAJADOR_TURNOS)

| Campo | Detalle |
|-------|---------|
| Rol | Cualquier persona sin cuenta |
| Inputs | `nombre`, `apellido` (opcional), `email`, `password` (mín 8 chars) |
| Endpoint | `POST /api/auth/registro` |
| Resultado | Usuario `TRABAJADOR_TURNOS` con `empresa_id = NULL`. Devuelve tokens. |
| Navegación | → Bienvenida (1.5) |

#### 1.5 Bienvenida post-registro (NUEVO — empty state)

Para el trabajador-turnos recién registrado sin empresas activas.

| Elemento | Contenido |
|----------|-----------|
| Hero | Ilustración + título "¡Bienvenido a App Turnos!" |
| Copy | "Aún no estás vinculado a ninguna empresa. Explora el directorio y solicita unirte a las que te interesen." |
| CTA primario | `[Explorar empresas]` → Directorio (2.1) |
| CTA secundario | `[Ver mi perfil]` → Perfil (4.5) |

---

## Iteración 2 — Multi-empresa del trabajador-turnos (NUEVO)

> Plan v3. Permite al trabajador-turnos pertenecer a varias empresas (modelo marketplace) con doble opt-in (trabajador solicita ↔ empresa aprueba, o empresa invita ↔ trabajador acepta).

### Pantallas

#### 2.1 Directorio de empresas

| Campo | Detalle |
|-------|---------|
| Rol | `TRABAJADOR_TURNOS` |
| Datos por card | `logo_url`, `nombre`, `ciudad`, badge si ya solicité/activo |
| Filtros | Búsqueda por nombre, filtro por ciudad |
| Endpoint | `GET /api/empresas/directorio?busqueda=&ciudad=&page=&limit=` |
| Acción | Tap en card → Detalle empresa (2.2) |
| Empty state | "No hay empresas que coincidan con tu búsqueda" |

#### 2.2 Detalle de empresa

| Campo | Detalle |
|-------|---------|
| Datos | Logo, nombre, ciudad, descripción, fecha de creación |
| Endpoint | `GET /api/empresas/:id` |
| Estado del botón | • Sin relación → `[Solicitar trabajar acá]` · • Solicitud enviada → `[Solicitud enviada]` (disabled) · • Activo → chip verde "Ya trabajas acá" · • Invitación pendiente → `[Aceptar invitación]` |
| Endpoint solicitud | `POST /api/trabajador-empresa/solicitar` body `{ empresa_id }` |
| Endpoint aceptar | `POST /api/trabajador-empresa/:id/aceptar` |

#### 2.3 Mis empresas (3 tabs)

| Tab | Contenido | Endpoint base |
|-----|-----------|---------------|
| **Activas** | Empresas donde puedo postularme | `GET /api/trabajador-empresa/mis-empresas` → `data.activas` |
| **Pendientes** | Solicitudes que envié, esperando aprobación | `data.pendientes` |
| **Invitaciones** | Empresas que me invitaron | `data.invitaciones` |

Tap en card de "Activa" → Detalle empresa (lectura). Tap en card de "Invitación" → 2.4. Tap en card de "Pendiente" → toast "Esperando aprobación de la empresa".

#### 2.4 Detalle de invitación

| Campo | Detalle |
|-------|---------|
| Datos | Empresa (logo, nombre, ciudad), fecha de invitación, copy "{Empresa} te invita a trabajar con ellos" |
| Acción primaria | `[Aceptar]` → `POST /api/trabajador-empresa/:id/aceptar` |
| Acción secundaria | `[Rechazar]` → modal con textarea opcional `motivo` → `POST /api/trabajador-empresa/:id/rechazar` |
| Navegación post-aceptar | Toast "Bienvenido a {Empresa}" + actualizar Mis empresas |

#### 2.5 Notificaciones in-app

Lista vertical de notificaciones del usuario, agrupadas por día. Tap en notificación → pantalla relacionada (por ejemplo, una invitación lleva a 2.4).

| Endpoint | `GET /api/notificaciones?leidas=false` |
| Marcar leída | `PUT /api/notificaciones/:id/leer` (tap individual) o `POST /api/notificaciones/leer-todas` |
| Eventos que llegan acá | Ver tabla "Notificaciones" al final del documento |

---

## Iteración 3 — Flujo de turno (trabajador, happy path)

> El "trabajo de campo" del trabajador-turnos: ver ofertas, postularse, marcar llegada/salida, firmar.

### Pantallas

#### 3.1 Home del trabajador-turnos

| Sección | Contenido |
|---------|-----------|
| Header | "Hola, {nombre}" · Avatar (chip si está en turno activo) |
| Próximo turno | Card grande con título, fecha/hora, dirección, mini-mapa, chip de empresa con `logo_url` |
| Ofertas activas | Carrusel horizontal: 3-5 cards mezcladas de todas mis empresas activas. Chip de empresa visible en cada card. |
| Ranking | Card resumen: ⭐ promedio más alto + "Activo en {N} empresas". CTA "Ver detalle por empresa" |
| Notificaciones | Badge con conteo de no leídas en TabBar |
| Endpoint principal | `GET /api/turnos/ofertas?disponibles=true&limit=5` (multi-empresa, ya filtrado) + `GET /api/turnos/mis-turnos?proximos=true&limit=1` |

#### 3.2 Explorar ofertas

| Campo | Detalle |
|-------|---------|
| Vista | Lista (default) / Mapa (toggle — v1.1 si hace falta) |
| Card oferta | `titulo`, `fecha`, `hora_inicio`, `tarifa_dia` formateado COP, `plazas_disponibles - plazas_cubiertas`, distancia estimada (si hay geo del usuario), **chip de empresa de origen** |
| Filtros | Empresa (multi-select de mis activas), distancia, rango de pago, fecha |
| Endpoint | `GET /api/turnos/ofertas?fecha=&disponibles=true&page=&limit=` |
| Visibilidad | Ofertas pueden no aparecer al instante: delay por ranking POR EMPRESA (ver `06-AUTH.md §Visibilidad`) |
| Empty state | "No hay ofertas nuevas. Te avisaremos cuando publiquen." |

#### 3.3 Detalle de oferta + postulación

| Sección | Contenido |
|---------|-----------|
| Header | Chip empresa + título |
| Datos | Fecha, hora_inicio, hora_fin_estimada, lugar (con mapa), tarifa, descripción, externo_notas (instrucciones del operario), plazas |
| Acción | `[Postularme]` si `estado='abierta'` o `'publicada'` y hay plazas |
| Endpoint detalle | `GET /api/turnos/ofertas/:id` |
| Endpoint postular | `POST /api/turnos/ofertas/:id/aplicar` |
| Endpoint retirar | `DELETE /api/turnos/ofertas/:id/aplicar` |
| Estados | `pendiente` (postulé) → `confirmado` (jefe me eligió, push) → `en_progreso` (marqué llegada) → `completado` (marqué salida + firma) |

#### 3.4 Mi turno hoy (pantalla "live")

| Sección | Contenido |
|---------|-----------|
| Header | Chip empresa + título del turno |
| Mapa | Pin del punto de encuentro + ubicación actual del trabajador (live) |
| `IndicadorProximidad` | Distancia en tiempo real + color (rojo >500m, amarillo 100-500m, verde <`radio_geofence`) |
| Acción primaria | `[Marcar llegada]` (deshabilitado fuera del geofence) → 3.5 |
| Estado en curso | Cronómetro del turno + `[Marcar salida]` → 3.6 |
| Endpoint | `GET /api/turnos/asignaciones/:id` (poll cada N segundos para sync con jefe) |

#### 3.5 Marcar llegada

Modal/sheet desde 3.4.

| Campo | Detalle |
|-------|---------|
| GPS captura | Lat/lng del momento (validado backend) |
| Confirmación | Botón `[Confirmar llegada]` |
| Endpoint | `POST /api/turnos/asignaciones/:id/ingreso` body `{ latitud, longitud }` |
| Resultado | Asignación pasa a `en_progreso`. Vuelve a 3.4 con cronómetro corriendo. |

#### 3.6 Marcar salida + firma digital

| Paso | Pantalla |
|------|----------|
| 1 | Mapa con GPS final + botón `[Continuar]` |
| 2 | `SignaturePad` canvas con `[Limpiar]` y `[Firmar]` |
| 3 | Confirmación visual + `[OK]` → Home |
| Endpoint | `POST /api/turnos/asignaciones/:id/egreso` body `{ firma_b64 }` |
| Side effect backend | Si todos los contratos de la oferta están cerrados → emite `costo_labor.calculado` a logiq360 (transparente al usuario) |

#### 3.7 Confirmación de turno completado

Pantalla post-egreso: agradecimiento, resumen del turno (horas trabajadas, pago estimado), CTA `[Volver al home]`.

---

## Iteración 4 — Resúmenes, historial y perfil (NUEVO)

### Pantallas

#### 4.1 Historial de turnos

| Sección | Contenido |
|---------|-----------|
| Tabs | **Próximos** / **Pasados** |
| Agrupación | Por mes (chip "Mayo 2026" sticky en scroll) |
| Card | Fecha, empresa, oferta_titulo, horas, pago, estado |
| Endpoint | `GET /api/turnos/mis-turnos?fecha_desde=&fecha_hasta=` |

#### 4.2 Resumen semanal

| Sección | Contenido |
|---------|-----------|
| Header | Selector de semana (← →) |
| Métricas | Horas trabajadas, recargos desglosados (diurnas/nocturnas/extras/festivos), pago estimado |
| Gráfico | Barras por día de la semana |
| Endpoint | `GET /api/reportes/trabajador/semanal?desde=&hasta=` (nuevo — agrega) |

#### 4.3 Resumen mensual

Igual a 4.2 pero con totales mensuales y comparación contra mes anterior (delta % en chip verde/rojo).

| Endpoint | `GET /api/reportes/trabajador/mensual?anio=&mes=` |

#### 4.4 Pagos

| Sección | Contenido |
|---------|-----------|
| Tabs | **Pendiente** / **En proceso** / **Pagado** |
| Agrupación | Por empresa |
| Card | Empresa, fecha turno, oferta, monto, estado, fecha pago si aplica |
| Endpoint | `GET /api/turnos/mis-pagos?estado=` (nuevo — agregar) |

#### 4.5 Perfil

| Sección | Acciones |
|---------|----------|
| Datos personales | Ver/editar nombre, email, teléfono |
| Documentos | Lista de contratos firmados → tap → 4.6 |
| Mis empresas | Link a 2.3 |
| Notificaciones | Configuración push |
| Cambiar contraseña | `POST /api/auth/cambiar-password` (nuevo — agregar) |
| Cerrar sesión | `POST /api/auth/logout` |

#### 4.6 Contrato (visor PDF + firma)

| Sección | Contenido |
|---------|-----------|
| Visor | PDF inline con `react-native-pdf`; debe hacer scroll hasta el final para habilitar `[Firmar]` |
| Firma | Modal con `SignaturePad` |
| Endpoint | `GET /api/contratos/:id/pdf` (descarga) · `POST /api/contratos/:id/firmar` body `{ firma_b64 }` |
| Después de firmar | Descarga PDF con firma embebida |

---

## Iteración 5 — Backoffice jefe turnos (empresa sin Logiq360, NUEVO)

> Para empresas que NO usan logiq360 y crean ofertas manualmente. Las que usan logiq360 ya reciben las órdenes via webhooks y solo necesitan publicarlas/asignar.

### Pantallas

#### 5.1 Dashboard jefe turnos

| Sección | Contenido | Endpoint |
|---------|-----------|----------|
| KPIs | Ofertas abiertas hoy, plazas sin cubrir, postulaciones pendientes, solicitudes de vinculación | `GET /api/turnos/ofertas?estado=abierta` + `GET /api/trabajador-empresa/solicitudes` |
| Próximos turnos | Lista corta de hoy + mañana con estado | `GET /api/turnos/asignaciones?fecha=hoy` |
| Acción rápida | `[+ Crear oferta]` → 5.2 · `[Ver solicitudes]` → 5.5 |

#### 5.2 Crear oferta manual (form completo)

| Campo | Validación |
|-------|-----------|
| Título | required, max 200 |
| Descripción | opcional, max 2000 |
| Fecha | required, ISO 8601, ≥ hoy |
| Hora inicio | required, HH:MM |
| Hora fin estimada | opcional, HH:MM |
| Lugar (mapa) | string + lat/lng (drag pin) |
| Plazas | required, int ≥ 1 |
| Tarifa día | required, COP ≥ 0 |
| Recargos aplicables | toggles: diurno extra, nocturno extra, festivo |
| Requisitos | tags libres (uniforme, herramientas, certificación, etc.) |
| Endpoint | `POST /api/turnos/ofertas` |
| Estado inicial | `abierta` (manual) o `borrador` (si jefe marca "guardar como borrador") |

#### 5.3 Mis ofertas (lista)

| Sección | Contenido |
|---------|-----------|
| Filtros | Estado (todos / abiertas / en_proceso / completadas / canceladas), fecha, búsqueda |
| Card | Título, fecha, plazas cubiertas/totales, estado (chip), tarifa |
| Acciones bulk | Cancelar varias, marcar como completadas (no implementado en backend aún) |
| Endpoint | `GET /api/turnos/ofertas` |

#### 5.4 Detalle oferta + postulaciones

| Sección | Contenido |
|---------|-----------|
| Header | Título, fecha, estado, plazas cubiertas/totales |
| Datos | Todos los campos del form 5.2 (read-only o editable si `estado='abierta'`) |
| Lista postulaciones | Por cada postulado: nombre, **ranking EN ESTA EMPRESA** (con disclaimer "Promedio en {nombre empresa}"), botones `[Aceptar]` / `[Rechazar]` |
| Endpoint detalle | `GET /api/turnos/ofertas/:id` |
| Endpoint postulaciones | Incluido en el `detalle.asignaciones[]` |
| Endpoint confirmar | `POST /api/turnos/asignaciones/:id/confirmar` |
| Endpoint cancelar oferta | `DELETE /api/turnos/ofertas/:id` |

#### 5.5 Solicitudes entrantes (multi-empresa)

| Sección | Contenido |
|---------|-----------|
| Lista | Trabajadores que solicitaron sumarse a esta empresa |
| Card | Nombre, email, fecha solicitud, botones `[Aprobar]` / `[Rechazar]` |
| Endpoint listar | `GET /api/trabajador-empresa/solicitudes` |
| Endpoint aprobar | `POST /api/trabajador-empresa/:id/aprobar` |
| Endpoint rechazar | `POST /api/trabajador-empresa/:id/rechazar` body `{ motivo }` |

#### 5.6 Invitar trabajador por cédula

| Sección | Contenido |
|---------|-----------|
| Input | `cedula` (Colombia, 7-10 dígitos) |
| Endpoint | `POST /api/trabajador-empresa/invitar` body `{ cedula }` |
| Casos | 1) Trabajador con cuenta → invitación creada · 2) Sin cuenta → ficha creada + pendiente activación, copy "Cuando active su cuenta quedará vinculado" |

#### 5.7 Calificar trabajador post-turno

Modal abierto desde 5.4 cuando la asignación está en `completado` y sin calificar.

| Campo | Detalle |
|-------|---------|
| RatingStars | 1-5 estrellas, tap para seleccionar |
| Comentario | textarea opcional |
| Endpoint | `POST /api/turnos/asignaciones/:id/calificar` body `{ calificacion, comentario }` |
| Side effect | Actualiza `ranking` y `total_calificaciones` del trabajador en ESA empresa |

---

## Iteración 6 — Track Nómina (futura, fuera de alcance MVP turnos)

> Las pantallas del track nómina (jefe nómina, trabajador nómina, jefe turnos lado nómina) ya existen en el backend y se documentan en su sección dedicada. Color: emerald (`#059669`). No se construyen hasta cerrar el track turnos.

### Pantallas (resumen — detalle en sección "Track Nómina" más abajo)

- Dashboard jefe nómina
- Períodos (crear, listar, cerrar)
- Registros diarios (grid semana × trabajador)
- Liquidación + exportar Excel/PDF
- Mi registro (trabajador nómina — marcar entrada/salida)

---

## Track Nómina (referencia para iteración 6)

### Flujo Jefe Nómina

```
Dashboard
├── Período activo (fechas, días restantes)
├── Trabajadores sin registro hoy: [alerta]
└── Acciones rápidas: [Cerrar período] [Generar reporte]

Períodos
├── Lista de períodos con estado (abierto/cerrado/liquidado)
├── Crear período (fecha inicio, fecha fin, tipo: semanal/quincenal)
└── Detalle período → tabla de registros de todos los trabajadores

Registros diarios
├── Grid semana × trabajador (visual tipo spreadsheet)
├── Celdas: entrada | salida | horas | novedades
└── Corrección inline + aprobación

Liquidación
├── Tabla: trabajador | horas ord | h.extra diurna | h.extra noct | h.noct | h.festivo | total $
└── Exportar Excel / PDF
```

### Flujo Trabajador Nómina

```
Mi registro
├── Semana actual con entradas/salidas (DiaRow con verde en HOY)
├── Botón "Registrar entrada/salida" (GPS auto)
└── Novedades (incapacidad, permiso, etc.)
```

---

## Componentes clave

### `IndicadorProximidad`
Muestra en tiempo real la distancia entre el trabajador y el punto de encuentro.
- GPS continuo con `expo-location` (`watchPositionAsync`)
- Haversine para distancia
- Color: rojo >500m, amarillo 100-500m, verde <`radio_geofence`
- Activa botón "Marcar Llegada" solo cuando distancia < `radio_geofence` (default 100m)
- **Defensa en profundidad**: el botón se bloquea en cliente y el backend revalida lat/lng al recibir `/ingreso` y `/egreso`. Ver `07-FRONTEND.md §Geofence`.

### `FirmaDigital` (SignaturePad)
- Canvas táctil con soporte multi-touch
- Botón "Limpiar" para rehacer
- Exporta base64 PNG
- Se guarda en `asignaciones_turno.firma_digital` y en el PDF de contrato

### `ContratoViewer`
- Renderiza PDF inline (`react-native-pdf`)
- Usuario debe hacer scroll hasta el final antes de habilitar [Firmar]

### `RatingStars` (NUEVO)
- 1-5 estrellas tap-to-select
- Modo lectura (display ranking) + modo edición (calificar)
- Half-stars para display de promedios (4.3 → 4 llenas + media)

### `EmpresaCard` (NUEVO)
- Usado en directorio (2.1), mis empresas (2.3), chip en cards de oferta
- Variants: full (con descripción), compact (logo + nombre), chip (solo logo + nombre)

### `OfertaCard` (NUEVO)
- Usado en home (3.1), explorar (3.2), historial (4.1)
- Incluye chip de empresa de origen siempre visible (porque el trabajador-turnos puede ver ofertas de varias empresas en una misma lista)

---

## Notificaciones

### Push (Expo Push tokens — ver `07-FRONTEND.md §Push`)

| Evento | Destino | Mensaje | Pantalla destino |
|--------|---------|---------|------------------|
| Nueva oferta disponible | trabajadores_turnos activos en la empresa | "Nueva oferta: {titulo}, {fecha} {hora}" | 3.3 |
| Postulación confirmada | trabajador postulado | "Tu turno del {fecha} fue confirmado" | 3.3 |
| Oferta cancelada | asignados | "El turno de {fecha} fue cancelado" | 3.1 |
| Recordatorio 1h antes | trabajador asignado | "Tu turno empieza en 1 hora. Ver ruta" | 3.4 |
| Trabajador no marcó llegada | jefe_turnos | "{trabajador} no ha marcado llegada (30 min tarde)" | 5.4 |
| Turno calificado (`calificacion.recibida`) | trabajador | "Tu turno fue calificado con {N}/5 ⭐" | 3.7 |
| **Solicitud aprobada** (NUEVO) | trabajador | "{Empresa} aprobó tu solicitud. Ya puedes recibir ofertas." | 2.3 |
| **Nueva invitación** (NUEVO) | trabajador | "{Empresa} te invita a trabajar con ellos" | 2.4 |
| **Solicitud rechazada** (NUEVO) | trabajador | "{Empresa} no aceptó tu solicitud. {motivo si aplica}" | 2.3 (tab archivadas) |
| **Nueva solicitud de vinculación** (NUEVO) | jefe_turnos | "{Trabajador} quiere unirse a tu empresa" | 5.5 |

### In-app (lista en 2.5)

Las notificaciones push se persisten en `notificaciones_usuario`. La pantalla 2.5 las muestra como lista cronológica con tap → pantalla destino.

| Endpoint listar | `GET /api/notificaciones?leidas=false&limit=50` |
| Marcar leída | `PUT /api/notificaciones/:id/leer` |
| Marcar todas | `POST /api/notificaciones/leer-todas` |

---

## Checklist de definition of done por pantalla

(Ver `07-FRONTEND.md §Verificación`)

- [ ] Implementa los 4 estados transversales (loading / error / empty / offline)
- [ ] Strings pasan por `t()` (es-CO)
- [ ] Test happy path con React Native Testing Library
- [ ] Probada en iOS + Android (dispositivo físico si toca GPS/cámara/firma)
- [ ] Documentada en el archivo Figma de su iteración con el link añadido a este doc
