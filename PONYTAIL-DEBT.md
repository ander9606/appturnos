# Ponytail debt ledger

Generado por `/ponytail-debt` — cada `ponytail:` en el código marca un atajo deliberado.
Este archivo es una foto del momento; vuelve a correr el scan cuando quieras refrescarlo:

```
grep -rnE '(#|//|\{/\*) ?ponytail:' --include="*.js" --include="*.ts" --include="*.tsx" . | grep -v node_modules
```

## apps/mobile

- `app/(tabs)/nomina.tsx:113` — carga todos los compensatorios de la empresa y filtra client-side por periodo+trabajador. ceiling: sin filtro server-side. upgrade: **no-trigger**.
- `app/(tabs)/nomina.tsx:125` — nota de por qué esos `useMemo` van antes del `return` condicional de `loadingPeriodos`. ceiling: no aplica — es un candado de correctness (reglas de hooks), no un atajo pendiente. upgrade: **no-trigger** (por diseño).
- `app/(tabs)/perfil.tsx:26` — import perezoso de módulo nativo, solo se carga cuando corre el handler. ceiling: no se carga al descubrir la ruta. upgrade: **no-trigger**.
- `app/(tabs)/turnos.tsx:80` — rango estático, sin estado de paginación. ceiling: no pagina. upgrade: **no-trigger**.
- `app/mi-empresa.tsx:314` y `:354` — envoltura con TouchableOpacity necesaria. ceiling: no aplica (nota explicativa, no un atajo real). upgrade: **no-trigger**.
- `app/_layout.tsx:30` — expo-router activa keep-awake en dev; falla en emulador Android. ceiling: ruido inofensivo en logs. upgrade: **no-trigger**.
- `app/_layout.tsx:36` — `tracesSampleRate: 0`, solo error monitoring, sin tracing/profiling. ceiling: sin trazas de performance. upgrade: subir el valor si hace falta tracing.
- `features/auth/useAuthStore.ts:23` — no cachea `foto_perfil` en SecureStore (límite práctico ~2048 bytes). ceiling: la foto no está disponible offline, se retrae del server en cada rehydrate. upgrade: mover el cache a AsyncStorage si se necesita offline-first para la foto.
- `features/auth/useBiometricLock.ts:23` — sin biometría/SecureStore en web, la función queda apagada ahí. ceiling: biometría solo en nativo. upgrade: **no-trigger**.
- `features/auth/useBiometricLock.ts:56` — timeout de 15s en `authenticateAsync` para que el botón no quede colgado en "Verificando…". ceiling: valor fijo, no configurable. upgrade: **no-trigger**.
- `features/nomina/compensatorios/CompensatorioBanner.tsx:21` — filtra por fecha futura en vez de por estado, porque el backend colapsa 'asignado'→'tomado' en el mismo request. ceiling: el estado 'asignado' nunca es observable desde el cliente. upgrade: si el backend separa ambos pasos, volver a filtrar por `estado==='asignado'`.
- `features/nomina/trabajador/nominaTrabajadorUtils.ts:29` — tabla de jornada legal fija hasta 2026+. ⚠️ **ceiling ya alcanzado** (hoy es 2026-08-27) — vale la pena confirmar que el valor de 2026 sigue vigente. upgrade: traer la tabla desde config del backend.
- `features/novedades/ReportarNovedadModal.tsx:7` — mismo import perezoso que perfil.tsx. ceiling: no se carga al descubrir la ruta. upgrade: **no-trigger**.
- `features/turnos/useGeofence.ts:60` — usa polling en vez de `watchPositionAsync` para evitar un crash de expo-keep-awake en algunos dispositivos. ceiling: polling es menos eficiente que un watcher nativo. upgrade: **no-trigger**.
- `features/turnos/useGeofence.ts:111` — muestra la última ubicación conocida mientras resuelve el fix fresco. ceiling: no aplica (nota de UX, no un atajo). upgrade: **no-trigger**.
- `features/turnos/useGeofence.ts:129` — no vuelve a pedir permiso al resumir la app, solo re-chequea en silencio. ceiling: no aplica (nota de por qué es seguro, no un atajo). upgrade: **no-trigger**.
- `lib/pushNotifications.ts:10` — `setNotificationHandler` solo cubre notificaciones locales en Expo Go. ceiling: no aplica (nota informativa). upgrade: **no-trigger**.
- `lib/pushNotifications.ts:26` — se salta el registro de push en Expo Go. ceiling: push no funciona en Expo Go. upgrade: usar development build.
- `lib/secureStore.ts:12` — en web cae a `localStorage` porque expo-secure-store solo trae un stub no-op ahí. ceiling: almacenamiento menos seguro que Keychain/Keystore en web. upgrade: dice explícitamente "none needed" — resuelto a propósito, la app no se despliega a web.

## apps/web

- `src/shared/lib/format.ts:42` — `fmtHrs` castea string a number porque MySQL DECIMAL vuelve como string. ceiling: cast vive en el frontend. upgrade: castear en el backend.
- `src/modules/equipo/pages/EquipoPage.tsx:58` — filtro de búsqueda client-side sobre la página ya cargada. ceiling: el backend no expone búsqueda por texto todavía. upgrade: mover a un parámetro `busqueda` en el endpoint si una empresa supera 50 trabajadores activos con frecuencia.
- `src/modules/configuracion/pages/ConfiguracionPage.tsx:510` — `fmtDate` local en vez del compartido, porque maneja tanto `DATE` como datetime ISO. ceiling: el `fmtDate` compartido asume fechas puras y rompería el segundo caso. upgrade: **no-trigger**.
- `src/modules/admin/pages/EmpresaDetailPage.tsx:34` — mismo patrón: `fmtDate` local para un campo `TIMESTAMP`. ceiling: el compartido le agregaría `T00:00:00` y rompería el formato. upgrade: **no-trigger**.
- `src/modules/auth/LoginPage.tsx:19` — lista fija de roles que ven el panel web. ceiling: no cubre roles de gestión nuevos automáticamente. upgrade: si el backend agrega más roles de gestión, sumarlos aquí.

## backend

- `instrument.js:14` — mismo `tracesSampleRate: 0` que en mobile, solo error monitoring. ceiling: sin tracing/profiling en Sentry. upgrade: subir el valor si hace falta.
- `utils/mailer.js:4` — singleton perezoso del cliente de mail. ceiling: no inyectable, difícil de mockear en tests. upgrade: extraer a un contenedor DI si el testing lo necesita.
- `scripts/backup-db.sh:6` — backup sin alertas si falla. ceiling: fallos silenciosos. upgrade: si el cron falla más de una vez, mandar el stderr a un webhook (Slack/email).
- `modules/notificaciones/push/push.service.js:250` — `setTimeout` in-process para el chequeo de recibos push. ceiling: alcanza para el volumen actual, no escala. upgrade: mover a un job programado si el envío crece mucho.

## docker-compose.yml

- `:39` — `--performance-schema=OFF` + buffer pool explícito en 128M. ceiling: ahorro de ~200MB RAM pensado para un droplet de 1GB. upgrade: **no-trigger**.

---

**29 markers activos, 17 con no-trigger.** (8 resueltos hoy, ver abajo)

### Resueltos (Lote 4 — 2026-08-27)

- ~~`apps/mobile/features/nomina/trabajador/NominaTrabajadorView.tsx:56` — `useRegistrosHistorial()` sin `enabled` y topado a 500 filas sin paginar por fecha.~~ **Resuelto** — el hook ahora acepta `enabled`/`fechaDesde`/`fechaHasta`; la vista de mes solo pide datos cuando está activa (`activeTab === 'nomina' && viewMode === 'mes'`) y acotados al mes visible.

### Resueltos (Lote 3 — 2026-08-27)

- ~~`backend/modules/nomina/periodos/*.js` + `apps/web/src/pages/CalendarioPage.tsx:68` + `apps/mobile/app/(tabs)/nomina.tsx` — el modo Nómina del calendario (web y mobile) truncaba en silencio, sin rango de fechas en `GET /nomina/periodos`.~~ **Resuelto** — el endpoint acepta `fecha_desde`/`fecha_hasta` (mismo `rangoFechasMax` que ya tenía `ofertas`, con condición de solapamiento `fecha_fin >= desde AND fecha_inicio <= hasta`); web y mobile pasan el rango del mes visible en una consulta aparte de la lista general.

### Resueltos (Lote 2 — 2026-08-27)

- ~~`apps/mobile/lib/calendar.ts:3` — `MESES`/header de mes/wraparound duplicados 3-8 veces entre `turnos.tsx`, `nomina.tsx` y `NominaTrabajadorView.tsx`.~~ **Resuelto** — `MESES_LARGOS` y `shiftMonth(cursor, delta)` ahora viven en `lib/calendar.ts` y los 3 archivos los importan en vez de retipearlos.

### Resueltos (Lote 1 — 2026-08-27)

- ~~`apps/web/src/pages/CalendarioPage.tsx:41` — cursor inicial / botón "Hoy" con `new Date()` local.~~ **Resuelto** — ahora usa `bogotaToday()`, igual que las 3 pantallas de mobile.
- ~~`apps/mobile/app/(tabs)/nomina.tsx:96` (parte de tipoActual) — `periodoDeDia` no filtraba por tipo de período.~~ **Resuelto** — ahora busca sobre `periodosSelector` (ya filtrado por `tipoActual`), igual que el selector de chips. El truncamiento por falta de rango de fechas sigue pendiente (Lote 3).
- ~~`apps/mobile/features/nomina/trabajador/NominaTrabajadorView.tsx:280` — hex crudo en las bandas Libre/Ausencia.~~ **Resuelto** — ahora usa `bg-success-light`/`bg-warning-light`/`text-foreground`.
- ~~`apps/web/src/shared/components/MonthCalendar.tsx:12` — celda `<button>` sin `type="button"`.~~ **Resuelto** — `type={onDayClick ? 'button' : undefined}` agregado.

### Resueltos (scans anteriores)

- ~~`lib/pushNotifications.ts:6` — cache del token a nivel de módulo (en memoria).~~ **Resuelto** — ahora persiste en SecureStore (`webSafeSecureStore`), sobrevive a que la app se mate entre login y logout.
- ~~`backend/modules/integracion/entrantes.handlers.js:90` — reutilizaba el cargo 'auxiliar' en vez de uno dedicado.~~ **Resuelto** — migración 052 agrega el cargo de sistema 'custodio'; el handler resuelve cargos de sistema por código genéricamente.

### En el radar

- **`nominaTrabajadorUtils.ts:29`** — el ceiling dice "hasta 2026+" y ya estamos en agosto 2026. Vale la pena confirmar que el valor no necesita un ajuste este año antes de que se vuelva un bug silencioso.
- **`EquipoPage.tsx:58`** — ya tiene un número concreto (50 trabajadores) para decidir cuándo mover el filtro al backend.

Los sin trigger no son necesariamente urgentes — varios son solo notas explicativas mal etiquetadas
como `ponytail:` (mi-empresa.tsx, useGeofence.ts:111/129, pushNotifications.ts:10, _layout.tsx:30,
nomina.tsx:125), no atajos reales.
