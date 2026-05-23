# App Turnos — Pantallas y Flujos de Usuario

> **Diseño visual:** los wireframes y mockups vivos están en Figma (link pendiente). Este documento describe **flujos y datos**, no layout pixel-perfect.
>
> **Estados transversales obligatorios en toda pantalla:**
> - `loading` — esqueleto o spinner mientras llega data
> - `error` — mensaje + acción de reintentar
> - `empty` — copy + CTA cuando la lista está vacía
> - `offline` — banner persistente + comportamiento degradado (lectura del último caché)

## Track Nómina

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
├── Semana actual con entradas/salidas
├── Botón "Registrar entrada/salida" (GPS auto)
└── Novedades (incapacidad, permiso, etc.)
```

---

## Track Turnos

### Flujo Jefe Turnos

```
Dashboard
├── Ofertas abiertas hoy
├── Plazas sin cubrir: [alerta]
├── Asistencia en tiempo real (quién confirmó ingreso)
└── Órdenes logiq360 pendientes de asignar

Ofertas
├── Crear oferta (vinculada a orden de logiq360 o libre)
│   ├── Fecha, hora, lugar, plazas, tarifa
│   └── Mapa para marcar punto de encuentro
├── Lista de ofertas con estado y cobertura
└── Detalle → lista de postulados → confirmar/rechazar

Asignaciones
├── Tablero kanban: Confirmados | En progreso | Completados | No presentados
├── Filtros: fecha, oferta, trabajador
└── Detalle asignación: GPS ingreso, horas, contrato firmado
    └── Si estado=completado y aún sin calificar:
        modal [Calificar 1-5 ⭐ + comentario opcional]
```

### Flujo Trabajador Turnos (Mobile-first)

```
Home
├── Mis turnos próximos (próximas 48h)
├── Ofertas disponibles cercanas
├── Mi ranking ⭐ (promedio + total de calificaciones)
└── Notificación: [Hay 3 nuevas ofertas]

Nota: las ofertas se publican con retraso según el ranking del trabajador
(rank ≥ 4.5 ⭐ las ve al instante; rangos menores esperan 15/30/60 min).
Los nuevos sin calificación esperan 15 min. Ver `03-API-ENDPOINTS.md §Ranking`.

Explorar Ofertas
├── Lista / Mapa
├── Filtro: fecha, ciudad, tarifa mínima
└── Card oferta: título, fecha, hora, tarifa/día, plazas, distancia estimada

Aplicar a Oferta
├── Ver detalle completo
├── [Postularme] → confirmación
└── Estado: pendiente → confirmado (push notification)

Mi Turno Hoy
├── Dirección + mapa (Pin con distancia en tiempo real)
├── [Marcar Llegada] → GPS capturado + foto opcional
├── Durante turno: cronómetro
└── [Marcar Salida] → GPS + canvas firma digital

Contrato
├── PDF generado automáticamente
├── Leer y [Firmar] (canvas)
└── Descargar PDF firmado

Historial
├── Turnos pasados con pago
└── Acumulado del mes
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

### `FirmaDigital`
- Canvas táctil con soporte multi-touch
- Botón "Limpiar" para rehacer
- Exporta base64 PNG
- Se guarda en `asignaciones_turno.firma_digital` y en el PDF

### `ContratoViewer`
- Renderiza PDF inline (react-pdf)
- Usuario debe hacer scroll hasta el final antes de habilitar [Firmar]

---

## Notificaciones push

Tokens nativos vía Expo Push (FCM en Android, APNs en iOS). Expo Web sigue usando Web Push VAPID. Ver `07-FRONTEND.md §Push`.

| Evento | Destino | Mensaje |
|--------|---------|---------|
| Nueva oferta disponible | trabajadores_turnos | "Nueva oferta: Montaje Cll 72, hoy 8am" |
| Postulación confirmada | trabajador | "Tu turno del 15/06 fue confirmado" |
| Oferta cancelada | asignados | "El turno de mañana fue cancelado" |
| Recordatorio 1h antes | trabajador | "Tu turno empieza en 1 hora. Ver ruta" |
| Trabajador no marcó llegada | jefe_turnos | "Juan Pérez no ha marcado llegada (30 min tarde)" |
| Turno calificado (`calificacion.recibida`) | trabajador | "Tu turno fue calificado con 4/5 ⭐" |
