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
npm test             # jest — backend/__tests__/*.test.js
node utils/laboralUtils.check.js  # plain-assert check (no framework)
```

### Mobile (`apps/mobile/`)
```bash
cd apps/mobile
npx expo start       # Metro bundler + QR code (Expo Go)
npx expo start --android
npx expo start --ios
npm run lint         # ESLint over .ts/.tsx
npm run type-check   # tsc --noEmit (no build output)
npm test             # jest — lib/__tests__, features/**/__tests__
```

### api-client (`packages/api-client/`)
```bash
cd packages/api-client
npm run type-check
```

CI gates (`.github/workflows/`): backend `npm test` + `npm audit`; mobile and api-client `npm run type-check`; web `npm run build`. Run the matching command locally before pushing.

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
│   ├── migrations/             # migrate.js runner + sql/001–099_*.sql files
│   ├── modules/                # feature modules (see below) + *.worker.js background jobs
│   ├── utils/                  # AppError, logger, laboralUtils.js
│   └── __tests__/              # jest suites
│
├── packages/api-client/        # Shared TypeScript client (no bundling — imported as TS source)
│   └── src/                    # auth, turnos, nomina, trabajadores, client, types, index
│
├── apps/web/                   # Vite / React admin & gestor SPA
│   └── src/                    # modules/, pages/, shared/
│
└── apps/mobile/                # Expo / React Native (SDK ~54, Expo Router ~6)
    ├── app/                    # File-based routes (Expo Router)
    │   ├── _layout.tsx         # Root stack: QueryClient, AuthGuard, Stack screens
    │   ├── (auth)/             # login, registro, registro-empresa, activar, recuperar — unauthenticated
    │   ├── (tabs)/             # index, turnos, nomina, equipo, empresas, perfil — tab group
    │   ├── (admin)/            # super_admin panel: empresas, pagos, reportes
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
Every domain module (`auth`, `turnos`, `turnos-eventual`, `nomina`, `trabajadores`, `trabajador-empresa`, `contratos`, `cuentas-cobro`, `novedades`, `ausencias`, `puntos-marcaje`, `reportes`, `empresas`, `admin`, `webhooks`, `integracion`, …) follows the same layered structure:
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
| `HORAS_MES_NOMINA` | 210 | 42 h/week ÷ 6 × 30 — divisor for monthly → hourly rate (also used in the period-close snapshot SQL) |
| `JORNADA_SEMANAL_HORAS` | 42 | Weekly ordinary cap (Ley 2101); beyond it → extra |
| `HORA_INICIO_NOCTURNO_VIGENCIAS` | 19 from 2025-12-25, 21 before | Night start by date (Ley 2466 art. 10) |
| `HORA_FIN_NOCTURNO` | 6 | Night surcharge ends 06:00 |
| `RECARGOS.*` | 1.25 / 1.75 / 0.35 | Extra diurna / extra nocturna / night surcharge only. Ordinary night hours pay ×0.35 for salaried workers (salary already covers the base hour) and ×1.35 for `tarifa_hora` workers (their night hours aren't in `horas_ordinarias`) — `desglosarPagoNomina(..., { salarioFijo })`, returned as `recargo_nocturno` |
| `RECARGO_FESTIVO_VIGENCIAS` | 1.75 → 1.80 (2025-07-01) → 1.90 (2026-07-01) → 2.00 (2027-07-01) | Sunday/holiday multiplier by date (Ley 2466 art. 14) |
| `SMMLV_COP` / `SUBSIDIO_TRANSPORTE_COP` | 1.750.905 / 249.095 | 2026 values — update every January |

Salary and transport allowance are prorated by **commercial 30-day months**: `diasPagoPeriodo(periodo)` returns 15 for any quincena, 30 for any month (28/29/31-day months included) and 7 for a weekly period; `diasComerciales(desde, hasta)` (days360-style) is used for arbitrary report ranges. Never prorate by calendar days.

Date-dependent rules live in `*_VIGENCIAS` tables (newest first) so re-liquidating an old period keeps its original rules. `calcularHoras()` uses the record's `fecha` for the night start; `desglosarPagoNomina(desglose, vh, fecha)` uses the period's `fecha_fin` for the holiday rate and returns it as `recargo_festivo` (the UI labels read it — never hard-code a multiplier in the frontend).

Legal values are mirrored in `packages/api-client/src/laboral.ts`, `apps/web/src/shared/laboral.ts` (identical copy) and `apps/mobile/features/nomina/trabajador/nominaTrabajadorUtils.ts` — update all of them together.

`laboralUtils.js` exports `calcularHoras()` (minute-by-minute breakdown), `esDiaFestivo()` (Colombian public holidays including Ley Emiliani + Easter-relative), `horaInicioNocturno()`, `recargoFestivo()`, `valorHora()`, `calcularPagoNomina()`, `desglosarPagoNomina()`, `calcularDeducciones()`, `calcularSubsidioTransporte()`.

### Subscriptions & Billing
Companies with an active logiq360 integration (`integracion_config.activo = 1` + `api_key`) don't pay. The rest pay per plan via Wompi payment links (`webhooks/wompi.service.js`).

Prices and limits live in the **`planes` table** (migration 100, platform-level — no `empresa_id`), editable by super_admin at web `/admin/planes` and mobile `app/(admin)/planes.tsx` (`GET/PUT /api/admin/planes[/:codigo]`; the mobile preview uses `precioPlanCop` from `@api-client`). Seed values:

| Plan | Active workers | COP/month |
|---|---|---|
| `basico` | up to 10 | 79.000 |
| `profesional` | up to 30 | 169.000 |
| `empresarial` | unlimited | 299.000 incl. 80 + 3.500 per extra worker |

`modules/suscripciones/planes.model.js` exports `PlanesModel` plus the pure helpers `precioPlanCop(planRow, activos)` and `planParaTrabajadores(planes, activos)` — never hard-code a price in a frontend. A price change only affects links generated afterwards. `trabajadores.service.js` enforces `max_trabajadores` (402 → web toast / mobile alert offers "Ampliar plan"). `GET /api/empresas/suscripcion` returns usage (`trabajadores_activos`, `max_trabajadores`) and every plan with `precio_mensual_cop` for the company's current headcount; admin_empresa upgrades from web Configuración → Mi plan or mobile `app/mi-plan.tsx` by calling `POST /api/empresas/suscripcion/pagar { plan, meses }` (422 if the plan can't fit its active workers). `generarLinkPago()` without `plan` renews the company's current plan, upgrading only if its active workers no longer fit — it never downgrades. The Wompi reference is `AT-{empresaId}-{plan}-{meses}`; the webhook writes that plan back to `empresas.plan`. Revenue in the super_admin panel is summed from the real `amount_in_cents` in each `wompi_eventos.payload`. New companies get `TRIAL_DIAS_GRATIS` (30) days free — enough to close one quincena.

### Background Workers
`*.worker.js` files started from `server.js`: `integracion` (logiq360 queue), `suscripcion` (renewal emails at 7/3/0 days), `wompi` (retry failed payment events), `turnos` (close postulaciones stuck on offers expired 2+ days), `registros` (notify once when an active shift enters overtime), `recordatorioIngreso` (remind fixed-schedule workers who haven't clocked in), `compensatorios` (tell managers who is on compensatory rest today).

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
`app/(tabs)/nomina.tsx` renders `NominaTrabajadorView` or `NominaGestorView` based on role. Workers see their own `registros_diarios` aggregated client-side (`calcularResumenHoras()`) for day-to-day/weekly estimates, but `trabajador_nomina` can also call the liquidación endpoint — the service filters the result to their own line only. Use the liquidación fields (`pago_ordinario`, `pago_nocturno`, `pago_extra_diurno`, `pago_extra_nocturno`, `pago_festivo`, `ajuste_minimo`, `total`, `neto`) as the source of truth for period-level totals; the client-side estimate can diverge (different formula, no salario-mínimo floor).

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
