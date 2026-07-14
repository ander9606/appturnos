# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Coding Philosophy (Ponytail — Lazy Senior Dev Mode)

Before writing any code, work through this hierarchy in order:

1. **Does it need to exist?** — skip if not explicitly required (YAGNI)
2. **Standard library** — use built-in language/runtime features first
3. **Native platform features** — leverage the framework (Express, React Native, Expo)
4. **Existing dependencies** — check already-installed packages before adding new ones
5. **One-liner** — compress to a single expression when possible
6. **Minimum custom code** — only then write the bare minimum that works

**Rules:** no unrequested abstractions, no boilerplate, deletion over addition, boring over clever, fewest files possible. Mark intentional simplifications with a `// ponytail: <reason> — upgrade path: <how>` comment.

**Never lazy about:** input validation at trust boundaries, error handling that prevents data loss, security, accessibility.

**Testing:** non-trivial logic gets one minimal runnable check (assertion or small script — no frameworks). Trivial one-liners need none.

## Database — MySQL ONLY

**Never use PostgreSQL syntax.** The database is MySQL 8+. All migrations must use MySQL syntax:

| Use this (MySQL) | Never this (PostgreSQL) |
|---|---|
| `INT AUTO_INCREMENT` | `SERIAL` / `GENERATED AS IDENTITY` |
| `TINYINT(1)` | `BOOLEAN` (as column type) |
| `ON DUPLICATE KEY UPDATE` | `ON CONFLICT DO UPDATE` |
| `LAST_INSERT_ID()` | `RETURNING id` |
| `SET @var = ...` | PL/pgSQL blocks |
| `UUID()` | `gen_random_uuid()` |
| `JSON_OBJECT(...)` | `jsonb_build_object(...)` |

## Commands

### Web (`apps/web/`)
```bash
cd apps/web
npm run dev          # vite dev server (port 5174)
npm run build        # production build
npm run type-check   # tsc --noEmit
```

### Backend (`backend/`)
```bash
cd backend
npm run dev          # nodemon server.js — hot reload, port 3001
npm start            # production start
npm run migrate      # apply pending SQL migrations (idempotent)
npm run seed         # insert demo data (empresa + usuarios + turnos en todos los estados)
npm run generar-vapid # generate VAPID keys for push notifications
```

### Mobile (`apps/mobile/`)
```bash
cd apps/mobile
npx expo start       # Metro bundler + QR code (Expo Go)
npx expo start --android
npx expo start --ios
npm run lint         # ESLint over .ts/.tsx
npm run type-check   # tsc --noEmit (no build output)
```

### api-client (`packages/api-client/`)
```bash
cd packages/api-client
npm run type-check
```

There are no automated tests yet. Type-check and lint are the only CI gates.

## Environment Setup

**Backend** — copy `backend/.env.example` to `backend/.env`:
- `DB_NAME=app_turnos`, port `3001`, `JWT_SECRET` required.

**Mobile** — copy `apps/mobile/.env.example` to `apps/mobile/.env`:
- `EXPO_PUBLIC_API_URL` — points to the backend. Use the machine IP (not `localhost`) when testing on a physical device with Expo Go.

Run migrations before first start: `cd backend && npm run migrate`.

## Repository Structure

```
appturnos/
├── backend/                    # Node.js / Express API (CommonJS, port 3001)
│   ├── config/                 # database pool, constants (ROLES, RECARGOS, etc.)
│   ├── middleware/             # authMiddleware, validator, errorHandler
│   ├── migrations/             # migrate.js runner + sql/001–010_*.sql files
│   ├── modules/                # feature modules (see below)
│   └── utils/                  # AppError, logger, laboralUtils.js
│
├── packages/api-client/        # Shared TypeScript client (no bundling — imported as TS source)
│   └── src/                    # auth, turnos, nomina, trabajadores, client, types, index
│
└── apps/mobile/                # Expo / React Native (SDK ~53, Expo Router ~4)
    ├── app/                    # File-based routes (Expo Router)
    │   ├── _layout.tsx         # Root stack: QueryClient, AuthGuard, Stack screens
    │   ├── (auth)/             # login, activar — unauthenticated group
    │   ├── (tabs)/             # index, turnos, nomina, equipo — tab group
    │   ├── turno/[id].tsx      # Full-screen detail (push over tabs)
    │   └── trabajador/[id].tsx # Worker detail / edit
    ├── features/               # Domain logic co-located with UI
    │   ├── auth/               # useAuthStore.ts (Zustand), schemas.ts
    │   ├── turnos/             # useTurnos.ts, turnosUtils.ts, components
    │   ├── nomina/             # useNomina.ts, components
    │   └── equipo/             # useEquipo.ts, schemas.ts, components
    └── lib/                    # Cross-cutting utilities
        ├── i18n/               # es-CO.json + i18n.ts (i18n-js)
        ├── geo.ts              # haversineMeters, getGeofenceStatus
        ├── formatters.ts       # Date, currency, time formatters
        └── secureStore.ts      # TokenStore implementation (expo-secure-store)
```

## Backend Architecture

### Module Pattern
Every domain module (`auth`, `turnos`, `nomina`, `trabajadores`, `integracion`, …) follows the same layered structure:
```
module/
  *.routes.js      → express-validator rules + verificarToken/verificarRol + controller call
  *.controller.js  → thin: extract req fields → call service → res.json(...)
  *.service.js     → business logic, throws AppError on violations
  *.model.js       → raw SQL via the shared pool (mysql2/promise)
```

### Multi-Tenancy
Every table includes `empresa_id`. Every model method receives `empresaId` as its first argument and appends `WHERE empresa_id = ?` to all queries — **never trust the client to supply `empresa_id`**, read it from `req.empresa_id` (set by `authMiddleware`).

### Auth Flow
JWT access token (15 min) + refresh token (7 days, stored in DB). `verificarToken` injects `req.usuario` (payload with `id`, `empresa_id`, `rol`). `verificarRol([...roles])` is the authz guard. Locked accounts get a `429` response.

### Error Handling
Throw `new AppError(message, httpStatus)` from services. The root `errorHandler` middleware serializes it as `{ success: false, data: null, message }`.

### Salary Snapshot (migration 010b)
When a payroll period is closed, `cerrarConSnapshot()` in `periodos.model.js` atomically freezes `registros_diarios.valor_hora_snapshot` for all records of that period using a single transaction. `liquidacion.service.js` reads the snapshot first; it falls back to live salary only for open periods (backwards-compatible).

### logiq360 Integration Worker
`integracion.worker.js` polls the `integration_events_out` queue every 30 s. Failed events are retried with exponential backoff `[0s, 30s, 2m, 10m, 1h]` (5 attempts max). After the cap the event is marked `fallido` and logged. See `integracion.service.js` constants `MAX_INTENTOS` and `INTERVALOS`.

### Labor Law Constants (`backend/config/constants.js`)
| Constant | Value | Meaning |
|---|---|---|
| `HORAS_MES_NOMINA` | 240 | 30 days × 8 h — divisor for monthly → hourly rate |
| `JORNADA_ORDINARIA_HORAS` | 8 | Ordinary shift hours/day |
| `HORA_INICIO_NOCTURNO` | 21 | Night surcharge starts 21:00 |
| `HORA_FIN_NOCTURNO` | 6 | Night surcharge ends 06:00 |
| `RECARGOS.*` | 1.25 / 1.75 / 1.35 / 1.75 | Surcharge multipliers per hour type |

`laboralUtils.js` exports `calcularHoras()` (minute-by-minute breakdown), `esDiaFestivo()` (Colombian public holidays including Ley Emiliani + Easter-relative), `valorHora()`, `calcularPagoNomina()`.

## Frontend Architecture

### Path Aliases
In `apps/mobile`:
- `@/*` → `apps/mobile/*` (e.g. `@/lib/geo`, `@/features/auth/useAuthStore`)
- `@api-client` → `packages/api-client/src/index.ts`

### State Management Split
- **Zustand** (`features/auth/useAuthStore.ts`) — only session state (usuario, status). No server data here.
- **TanStack Query v5** — all server data. Default `staleTime: 60_000`. Use `queryKey` arrays for selective invalidation.

### API Client Initialization
`initApiClient()` must be called once before any API call. The auth store does this inside `rehydrate()` (called from `AuthGuard` on mount). The client is storage-agnostic via the `TokenStore` interface; the mobile app injects `secureTokenStore` (expo-secure-store).

Silent JWT refresh is handled inside `client.ts`: a single `isRefreshing` flag + `refreshQueue` array coalesce concurrent 401s into one refresh round-trip.

### Authentication Guard (`app/_layout.tsx`)
`AuthGuard` calls `rehydrate()` once on mount. While `status === 'unknown'`, nothing renders. Once resolved:
- `authenticated` + in `(auth)` → redirect to `/(tabs)`
- `unauthenticated` + outside `(auth)` → redirect to `/(auth)/login`

New full-screen stack screens (e.g. `turno/[id]`, `trabajador/[id]`) must be registered in `app/_layout.tsx` under the root `<Stack>`.

### Styling
NativeWind v4 (Tailwind for React Native). All tokens are defined in `apps/mobile/tailwind.config.js`. Use semantic color names — `text-foreground`, `bg-card`, `border-border`, `text-muted-foreground`, `text-primary`, `text-danger`, `text-success`, `text-warning`, `text-info` — rather than raw hex.

### Forms
React Hook Form v7 + Zod v3 + `@hookform/resolvers`. Define schemas in a co-located `schemas.ts` inside the feature folder.

### Geofencing (turnos)
`lib/geo.ts` — `haversineMeters()` + `getGeofenceStatus()`. The client blocks the "Marcar ingreso" button for UX; the backend re-validates lat/lng on the ingreso endpoint for security. Geofence radius default: 100 m.

### Dual-Role Nómina Screen
`app/(tabs)/nomina.tsx` renders `NominaTrabajadorView` or `NominaGestorView` based on role. Workers see their own `registros_diarios` aggregated client-side (`calcularResumenHoras()`); they do not have access to the liquidation endpoint (returns 403).

### i18n
Single locale `es-CO`. All user-visible strings go through `t('key')` from `lib/i18n`. Strings are in `lib/i18n/es-CO.json`.

## Role Matrix

| Role | Description |
|---|---|
| `super_admin` | Cross-tenant. Has its own mobile panel (`app/(admin)/`), separate from the `(tabs)` layout used by every other role |
| `admin_empresa` | Full access: CRUD workers, close/liquidate periods |
| `jefe_turnos` | Manage shifts and offers |
| `jefe_nomina` | Manage payroll periods |
| `nomina` | View payroll, read-only team |
| `trabajador_turnos` | See own shifts, mark ingreso/egreso |
| `trabajador_nomina` | See own payroll records |

Worker roles (`trabajador_turnos`, `trabajador_nomina`) see a restricted view of the Equipo tab and cannot access liquidation data.
