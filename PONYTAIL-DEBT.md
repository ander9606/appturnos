# Ponytail debt ledger

Generado por `/ponytail-debt` — cada `ponytail:` en el código marca un atajo deliberado.
Este archivo es una foto del momento; vuelve a correr el scan cuando quieras refrescarlo:

```
grep -rnE '(#|//) ?ponytail:' --include="*.js" --include="*.ts" --include="*.tsx" . | grep -v node_modules
```

## apps/mobile

- `app/(tabs)/nomina.tsx:80` — carga todos los compensatorios de la empresa y filtra client-side por periodo+trabajador. ceiling: sin filtro server-side. upgrade: **no-trigger**.
- `app/(tabs)/perfil.tsx:26` — import perezoso de módulo nativo, solo se carga cuando corre el handler. ceiling: no se carga al descubrir la ruta. upgrade: **no-trigger**.
- `app/(tabs)/turnos.tsx:51` — rango estático, sin estado de paginación. ceiling: no pagina. upgrade: **no-trigger**.
- `app/mi-empresa.tsx:304` — envoltura con TouchableOpacity necesaria. ceiling: no aplica (nota explicativa, no un atajo real). upgrade: **no-trigger**.
- `app/_layout.tsx:27` — expo-router activa keep-awake en dev; falla en emulador Android. ceiling: ruido inofensivo en logs. upgrade: **no-trigger**.
- `app/_layout.tsx:33` — `tracesSampleRate: 0`, solo error monitoring, sin tracing/profiling. ceiling: sin trazas de performance. upgrade: subir el valor si hace falta tracing.
- `features/auth/useAuthStore.ts:22` — no cachea `foto_perfil` en SecureStore (límite práctico ~2048 bytes). ceiling: la foto no está disponible offline, se retrae del server en cada rehydrate. upgrade: mover el cache a AsyncStorage si se necesita offline-first para la foto.
- `features/auth/useBiometricLock.ts:18` — sin biometría/SecureStore en web, la función queda apagada ahí. ceiling: biometría solo en nativo. upgrade: **no-trigger**.
- `features/nomina/compensatorios/CompensatorioBanner.tsx:21` — filtra por fecha futura en vez de por estado, porque el backend colapsa 'asignado'→'tomado' en el mismo request. ceiling: el estado 'asignado' nunca es observable desde el cliente. upgrade: si el backend separa ambos pasos, volver a filtrar por `estado==='asignado'`.
- `features/nomina/trabajador/nominaTrabajadorUtils.ts:29` — tabla de jornada legal fija hasta 2026+. ceiling: no se espera ley nueva pronto. upgrade: traer la tabla desde config del backend.
- `features/novedades/ReportarNovedadModal.tsx:7` — mismo import perezoso que perfil.tsx. ceiling: no se carga al descubrir la ruta. upgrade: **no-trigger**.
- `features/turnos/useGeofence.ts:60` — usa polling en vez de `watchPositionAsync` para evitar un crash de expo-keep-awake en algunos dispositivos. ceiling: polling es menos eficiente que un watcher nativo. upgrade: **no-trigger**.
- `features/turnos/useGeofence.ts:121` — no vuelve a pedir permiso al resumir la app, solo re-chequea en silencio. ceiling: no aplica (nota de por qué es seguro, no un atajo). upgrade: **no-trigger**.
- ~~`lib/pushNotifications.ts:6` — cache del token a nivel de módulo (en memoria). ceiling: se pierde si el proceso muere entre registro y logout. upgrade: mover a SecureStore.~~ **Resuelto** — ahora persiste en SecureStore (`webSafeSecureStore`), sobrevive a que la app se mate entre login y logout.
- `lib/pushNotifications.ts:8` — `setNotificationHandler` solo cubre notificaciones locales en Expo Go. ceiling: no aplica (nota informativa). upgrade: **no-trigger**.
- `lib/pushNotifications.ts:24` — se salta el registro de push en Expo Go. ceiling: push no funciona en Expo Go. upgrade: usar development build.
- `lib/secureStore.ts:12` — en web cae a `localStorage` porque expo-secure-store solo trae un stub no-op ahí. ceiling: almacenamiento menos seguro que Keychain/Keystore en web. upgrade: **no-trigger**.

## apps/web

- `src/modules/equipo/pages/EquipoPage.tsx:44` — filtro de búsqueda client-side sobre la página ya cargada. ceiling: el backend no expone búsqueda por texto todavía. upgrade: mover a un parámetro `busqueda` en el endpoint si una empresa supera 50 trabajadores activos con frecuencia.

## backend

- `instrument.js:14` — mismo `tracesSampleRate: 0` que en mobile, solo error monitoring. ceiling: sin tracing/profiling en Sentry. upgrade: subir el valor si hace falta.
- ~~`modules/integracion/entrantes.handlers.js:90` — reutiliza el cargo 'auxiliar' en vez de uno dedicado. ceiling: mezcla el rol con auxiliares reales. upgrade: crear un cargo 'custodio' dedicado.~~ **Resuelto** — migración 052 agrega el cargo de sistema 'custodio'; el handler ahora resuelve cargos de sistema por código genéricamente.
- `utils/mailer.js:4` — singleton perezoso del cliente de mail. ceiling: no inyectable, difícil de mockear en tests. upgrade: extraer a un contenedor DI si el testing lo necesita.

---

**21 markers, 11 with no trigger. 2 resueltos** (pushNotifications.ts:6, entrantes.handlers.js:90).

Los sin trigger no son necesariamente urgentes — varios son solo notas explicativas mal etiquetadas
como `ponytail:` (mi-empresa.tsx:304, useGeofence.ts:121, pushNotifications.ts:8, _layout.tsx:27), no
atajos reales. Lo que sigue en el radar: **EquipoPage.tsx** (el límite de 50 trabajadores ya tiene un
número concreto para decidir cuándo mover el filtro al backend).
