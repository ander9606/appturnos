# App Turnos — Frontend (Expo / React Native)

Decisiones de stack y reglas para el frontend. Este documento es la fuente de verdad sobre cómo se construye la UI; cualquier desviación se justifica aquí antes de mergearse.

---

## Stack

| Capa | Tecnología | Notas |
|------|-----------|-------|
| Runtime | Expo SDK (React Native + TypeScript) | Una sola base para iOS, Android y Web |
| Navegación | Expo Router | File-based, soporta deep links |
| Estilos | NativeWind (Tailwind para RN) | Sin librería de componentes; componentes propios |
| Estado servidor | TanStack Query (React Query) | Cache, retry, paginación, optimistic updates |
| Estado UI local | Zustand (mínimo) | Solo cuando React Query no aplica |
| Formularios | React Hook Form + Zod | Validación tipada compartible con el backend si conviene |
| HTTP | `fetch` envuelto en cliente tipado (`packages/api-client`) | Inyecta JWT, refresh automático, normaliza `{ success, data, message }` |
| Mapas | `react-native-maps` (nativo) + `expo-location` | Web puede usar Leaflet más adelante si hace falta |
| GPS | `expo-location` (`watchPositionAsync`) | Permisos manejados en pantalla de onboarding |
| Firma | `react-native-signature-canvas` | Exporta base64 PNG → `asignaciones_turno.firma_digital` |
| PDF | `expo-print` (generar local) + `react-native-pdf` (visor) | Para el flujo de contrato del trabajador |
| Push | `expo-notifications` | Token nativo; web sigue con VAPID existente |
| Storage seguro | `expo-secure-store` | JWT y refresh token van acá, NO en AsyncStorage |
| i18n | `i18n-js` + `expo-localization` | Solo es-CO activo, ver §Locale |
| Testing | Jest + React Native Testing Library + Detox (E2E selectivo) | E2E solo en flujos críticos del trabajador |

### Por qué no agregamos una librería de componentes

Decidido: solo Tailwind/NativeWind. Construimos primitivos propios (`Button`, `Input`, `Card`, `Modal`, `Sheet`, `Badge`, `ListItem`, `RatingStars`, `SignaturePad`, `MapPin`) en `packages/ui` o `apps/mobile/components/ui`. Razones:

- Bibliotecas tipo React Native Paper / Tamagui añaden peso y opiniones que pelean con NativeWind.
- El branding final aún no existe; tener primitivos propios facilita re-skin sin reescribir.
- El set de componentes que App Turnos necesita es reducido y específico.

---

## Estructura de carpetas (monorepo)

```
appturnos/
├── backend/              # ya existente
├── APP-TURNOS-SPEC/      # specs (este doc)
├── apps/
│   └── mobile/           # Expo app
│       ├── app/          # rutas (expo-router)
│       ├── components/
│       │   ├── ui/       # primitivos (Button, Input, …)
│       │   └── domain/   # IndicadorProximidad, FirmaDigital, ContratoViewer
│       ├── features/     # vertical slices por flujo (turnos, nomina, auth)
│       ├── lib/          # i18n, gps, push, formatters
│       └── tailwind.config.js
└── packages/
    └── api-client/       # cliente HTTP tipado, compartido (futuro: web también)
```

Mantra: feature-first dentro de `apps/mobile/features/`. Cada feature contiene sus pantallas, hooks, schemas Zod y componentes específicos.

---

## Geofence

**Decisión: defensa en profundidad.** Cliente bloquea por UX, backend valida por seguridad.

### Cliente (RN)
- `IndicadorProximidad` usa `expo-location.watchPositionAsync` con `accuracy: BestForNavigation` mientras la pantalla "Mi Turno Hoy" está activa.
- Calcula distancia con Haversine local contra `oferta.latitud / oferta.longitud`.
- Botón "Marcar Llegada" / "Marcar Salida" deshabilitado cuando `distancia > radio_geofence`.
- `radio_geofence` por defecto **100 metros**. Override por oferta si en el futuro se añade `ofertas_turno.radio_geofence`.

### Backend (cambio pendiente)
- `POST /api/asignaciones/:id/ingreso` y `/egreso` reciben lat/lng y deben:
  1. Cargar `oferta.latitud / longitud / radio_geofence` (default 100m si NULL).
  2. Calcular Haversine.
  3. Rechazar con `400 OUT_OF_GEOFENCE` si está fuera.
- Log de intentos fuera de rango (auditoría anti-fraude).

### Razón
Un cliente manipulado (mock GPS, APK reempaquetada) podría enviar lat/lng falsas. La validación en backend es la barrera real; la del cliente es UX (evitar que el usuario honesto pulse el botón fuera del lugar).

---

## Push (notificaciones)

**Decisión: extender backend antes de arrancar el front móvil.**

### Estado actual
`backend/modules/notificaciones/push.*` solo soporta Web Push VAPID (`endpoint`, `keys.p256dh`, `keys.auth`). Eso no sirve para apps nativas.

### Trabajo previo necesario (ticket separado, antes del scaffold de Expo)
1. Tabla `push_subscriptions` (o equivalente) debe aceptar:
   - `kind` ∈ {`web`, `expo`} (o `fcm` / `apns` directos si se decide saltar Expo Push).
   - `expo_token` (string) para nativos.
   - Mantener compatibilidad con los campos VAPID existentes.
2. `POST /api/push/subscribe` valida payload según `kind`.
3. Servicio de envío bifurca por `kind`:
   - `web` → `web-push` (ya implementado).
   - `expo` → `expo-server-sdk` (`https://exp.host/--/api/v2/push/send`).
4. Tests del envío para ambos.

### Cliente
- `expo-notifications.getExpoPushTokenAsync()` en onboarding tras pedir permiso.
- Envía el token a `POST /api/push/subscribe` con `kind: "expo"`.

---

## Locale / i18n

**Decisión: solo es-CO en MVP, pero i18n-ready desde el día uno.**

- Todos los strings de UI pasan por `t('key')` (`i18n-js`).
- Archivo único `apps/mobile/lib/i18n/es-CO.json` por ahora.
- Formatters centralizados en `apps/mobile/lib/formatters.ts`:
  - **Fechas**: DD/MM/YYYY (display), ISO 8601 (transporte).
  - **Hora**: HH:mm 24h.
  - **Moneda**: `$1.234.567 COP` (separador de miles `.`, sin decimales para pesos).
  - **Números**: separador miles `.`, decimal `,`.
- `expo-localization` detecta el locale del dispositivo pero por ahora forzamos es-CO. La detección queda escrita para activarla cuando haya un segundo idioma.

---

## Theming y design tokens

- Paleta y tipografía se definen en Figma primero; luego se mapean a `tailwind.config.js` de NativeWind.
- Tokens esperados:
  - **Color**: `primary`, `primary-foreground`, `background`, `card`, `muted`, `border`, `destructive`, `success`, `warning`, además de la escala de grises de Tailwind.
  - **Spacing**: la escala Tailwind por defecto.
  - **Radius**: `sm` (4), `md` (8), `lg` (12), `xl` (16).
  - **Tipografía**: Inter (default Expo) con tamaños `xs`–`3xl`.
- Dark mode: contemplado en tokens desde el principio, activación se evalúa post-MVP.

---

## Cliente HTTP

`packages/api-client/` expone una clase o set de funciones tipadas (`zod` schemas para parsear respuestas). Responsabilidades:

1. Adjuntar `Authorization: Bearer <accessToken>` en cada request.
2. Si 401, intentar `POST /auth/refresh` una vez; si falla, limpiar tokens y emitir evento `auth:logout` consumido por el router.
3. Parsear `{ success, data, message }` y lanzar `ApiError(message, code, status)` cuando `success: false`.
4. Timeout por defecto 15s, retry exponencial solo para errores de red (no 4xx/5xx).
5. Header `X-Empresa-Slug` cuando aplique (multi-tenant).

---

## Seguridad

- JWT y refresh token en `expo-secure-store`, nunca en AsyncStorage.
- Biometría opcional (`expo-local-authentication`) para abrir la app si el dispositivo la soporta — diferido a post-MVP.
- `expo-updates` para parchar la app sin pasar por las stores en bugs críticos.
- Certificate pinning: evaluar para v1.1 si el target lo requiere.

---

## Performance / UX en campo

El trabajador opera en obra: conexión intermitente, sol fuerte, manos sucias.

- React Query con `staleTime` largo (60s) para vistas de turno/oferta; refetch on focus.
- Caché persistente con `@tanstack/query-async-storage-persister` para pintar última vista al abrir sin red.
- Botones grandes (mínimo 48dp), contraste alto, tipografía mínima 16sp en CTAs.
- Toda interacción crítica (marcar llegada/salida, firmar) confirma con feedback háptico (`expo-haptics`).

---

## Verificación / definition of done por pantalla

Una pantalla está "terminada" cuando:

- [ ] Implementa los cuatro estados transversales (loading / error / empty / offline).
- [ ] Strings pasan por `t()`.
- [ ] Tiene un test de React Native Testing Library del happy path.
- [ ] Funciona en iOS, Android y Expo Web (este último solo si la pantalla aplica al backoffice).
- [ ] Probada en dispositivo físico al menos una vez (no solo simulador) si toca GPS, cámara o firma.

---

## Lo que NO está decidido y se aborda más adelante

- Mapa para "Explorar ofertas" (lista primero; mapa puede ser v1.1).
- Modo offline de escritura (ej. marcar llegada sin red y sincronizar después): MVP exige conexión.
- Pago in-app / wallet del trabajador.
- Web responsive del backoffice: arranca como Expo Web; si la complejidad obliga, se valora un Next.js separado más adelante.
