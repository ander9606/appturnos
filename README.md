# Zaturno

Sistema de turnos, nómina y geocercas para empresas con personal en campo. Marcaje de entrada/salida con validación de ubicación, liquidación de nómina con recargos legales colombianos, y gestión de equipo — todo multi-tenant.

Antes de Zaturno, cuadrar turnos y calcular nómina con recargos (nocturno, dominical, festivo) a mano generaba errores costosos y reclamos de los trabajadores. Zaturno automatiza el marcaje geolocalizado, el cálculo de horas y la liquidación, con vistas distintas para administradores, jefes de turno/nómina y trabajadores.

Se integra en tiempo real con [logiq360](https://github.com/ander9606/aprendizaje-inventario-carpas) — el sistema de inventario y alquileres de eventos que construí en paralelo — sincronizando el costo de personal de cada operación.

## Qué hace

- **Turnos**: creación y asignación de turnos con ubicación geolocalizada, ofertas a trabajadores.
- **Marcaje**: entrada/salida con geocerca (radio configurable, 100 m por defecto) — el cliente bloquea el botón fuera de rango, el backend revalida lat/lng por seguridad.
- **Nómina**: liquidación con los recargos de la ley laboral colombiana ya ajustados a la reforma laboral (Ley 2466 de 2025: nocturno desde las 19:00, dominical/festivo gradual 80 % → 90 % → 100 %), horas extra sobre la jornada de 42 h, descuentos de salud/pensión y auxilio de transporte, y snapshot de salario al cerrar un período para no alterar liquidaciones ya cerradas.
- **Contratos y pagos**: contratos diarios con firma digital y cuentas de cobro para prestación de servicios.
- **Equipo**: gestión de trabajadores, cargos, ausencias, novedades y contratos, con una matriz de 7 roles (desde super-admin multi-tenant hasta trabajador de solo consulta).
- **Notificaciones push** y **reportes** exportables.
- **Suscripción** por plan con pago en Wompi: Básico $79.000 (hasta 10 trabajadores), Profesional $169.000 (hasta 30), Empresarial $299.000 (80 incluidos + $3.500 por trabajador adicional), en COP/mes; 30 días de prueba. Precios editables por el super admin; el admin de cada empresa ve su uso y amplía su plan desde "Mi plan". Gratis para empresas conectadas a logiq360.
- **Integración con logiq360**: worker que sincroniza eventos entre ambos sistemas vía webhooks, con reintentos exponenciales.

## Stack

**Backend** — Node.js 20 + Express 5, MySQL 8 (SQL parametrizado con `mysql2/promise`, sin ORM), JWT + refresh tokens, Sentry, Twilio, PDFKit/ExcelJS para reportes.

**App móvil** — Expo ~54 + React Native + Expo Router, NativeWind (Tailwind para RN), TanStack Query, React Hook Form + Zod, Zustand.

**Web** — Vite + React 19 + React Router, Tailwind, Zustand.

**Compartido** — `packages/api-client`, un cliente TypeScript usado tanto por la app móvil como por el web.

## Correr el proyecto

```bash
# Backend
cd backend
npm install
cp .env.example .env   # completar credenciales de MySQL y JWT_SECRET
npm run migrate          # aplica migraciones SQL (idempotente)
npm run seed              # datos de demo
npm run dev                # puerto 3001
npm test                   # pruebas (jest)

# App móvil (Expo)
cd apps/mobile
cp .env.example .env    # EXPO_PUBLIC_API_URL apuntando al backend
npx expo start

# Web
cd apps/web
npm run dev
```

## Documentación

Documentación técnica adicional en [`docs/`](./docs) y [`APP-TURNOS-SPEC/`](./APP-TURNOS-SPEC): arquitectura, esquema de base de datos, endpoints, autenticación y el contrato de integración con logiq360.
