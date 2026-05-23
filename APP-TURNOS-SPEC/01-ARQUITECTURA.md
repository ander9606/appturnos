# App Turnos — Arquitectura

## Principio fundamental

App Turnos es un sistema **independiente** de logiq360. Funciona sin conexión a logiq360 y opcionalmente se integra vía webhooks bidireccionales. Esta independencia es intencional: permite que App Turnos sea un producto standalone para otros clientes.

## Stack tecnológico recomendado

| Capa | Tecnología | Justificación |
|------|-----------|--------------|
| Backend | Node.js + Express 5.x | Misma base que logiq360, facilita portabilidad de patrones |
| Base de datos | MySQL 8.x | Misma engine, consultas SQL optimizadas |
| Frontend | Expo (React Native) + TypeScript + NativeWind | Mobile-first real (el trabajador en campo es el caso de uso crítico), Expo Web cubre el backoffice si hace falta. Ver `07-FRONTEND.md`. |
| Auth | JWT access (15m) + refresh (7d DB) | Mismo patrón que logiq360 |
| Queue | tabla `jobs` en MySQL (no Redis en v1) | Sin dependencias externas |

## Estructura de directorios

```
app-turnos-backend/
├── config/
│   ├── database.js          # pool mysql2/promise
│   └── constants.js
├── middleware/
│   ├── authMiddleware.js    # verificarToken, verificarRol
│   ├── errorHandler.js
│   └── validator.js
├── modules/
│   ├── auth/                # Login, JWT, roles
│   ├── empresas/            # Multi-tenant (empresa = tenant)
│   ├── trabajadores/        # Empleados fijos + turno-día
│   ├── turnos/              # Ofertas y asignaciones de turno
│   ├── nomina/              # Registro diario, horas extra/nocturnas
│   ├── contratos/           # Contratos diarios (track Turnos)
│   ├── integracion/         # Webhooks logiq360 ↔ App Turnos
│   └── reportes/            # Nómina, liquidaciones
├── jobs/                    # Workers (cola de webhooks)
├── utils/
│   ├── AppError.js
│   ├── logger.js
│   └── laboralUtils.js      # Cálculo horas extra/nocturnas, ley laboral CO
└── server.js
```

## Roles y permisos

| Rol | Track | Puede |
|-----|-------|-------|
| `super_admin` | — | Gestionar empresas, planes |
| `admin_empresa` | — | Configurar empresa, ver todo, generar reportes |
| `jefe_turnos` | Turnos | Crear ofertas, ver asistencia, aprobar contratos |
| `jefe_nomina` | Nómina | Liquidar, cerrar períodos, ver reportes |
| `nomina` | Nómina | Registrar novedades, ver su grupo |
| `trabajador_turnos` | Turnos | Ver/aceptar ofertas, firmar contratos, marcar ingreso/egreso |
| `trabajador_nomina` | Nómina | Ver su registro de horas, reportar novedad |

## Multi-tenancy

Tabla `empresas` como tenant raíz. Todas las tablas llevan `empresa_id`. Middleware `resolverEmpresa` lee header `X-Empresa-Slug` o el JWT claim `empresa_id`.

## Entorno requerido

```env
DB_HOST=
DB_USER=
DB_PASSWORD=
DB_NAME=app_turnos
JWT_SECRET=
PORT=3001

# Integración logiq360 (opcional)
LOGIQ360_WEBHOOK_SECRET=
```
