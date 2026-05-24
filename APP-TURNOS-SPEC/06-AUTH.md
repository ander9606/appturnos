# App Turnos — Autenticación y Autorización

## JWT + Refresh Tokens

Mismo patrón que logiq360:
- **Access token**: 15 minutos, claim `{ sub, empresa_id, rol, nombre }`
- **Refresh token**: 7 días, almacenado en tabla `refresh_tokens`
- Rotación de refresh token en cada uso (invalidar el viejo, emitir nuevo)

```javascript
// utils/TokenService.js
class TokenService {
  static generarAccessToken(usuario) {
    return jwt.sign(
      { sub: usuario.id, empresa_id: usuario.empresa_id, rol: usuario.rol, nombre: usuario.nombre },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );
  }

  static generarRefreshToken() {
    return crypto.randomBytes(64).toString('hex');
  }
}
```

## Middleware de autenticación

```javascript
// middleware/authMiddleware.js
async function verificarToken(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next(new AppError('Token requerido', 401));

  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    req.usuario = payload;
    req.empresa_id = payload.empresa_id;
    next();
  } catch (err) {
    next(new AppError('Token inválido o expirado', 401));
  }
}

function verificarRol(roles) {
  return (req, res, next) => {
    if (!roles.includes(req.usuario.rol)) {
      return next(new AppError('Sin permisos para esta acción', 403));
    }
    next();
  };
}
```

## Matriz de permisos por endpoint

| Recurso | admin_empresa | jefe_turnos | jefe_nomina | nomina | trabajador_turnos | trabajador_nomina |
|---------|:---:|:---:|:---:|:---:|:---:|:---:|
| GET trabajadores | ✓ | ✓ | ✓ | ✓ | — | — |
| POST/PUT trabajadores | ✓ | — | — | — | — | — |
| Ofertas (listar) | ✓ | ✓ | — | — | ✓ | — |
| Ofertas (crear/editar) | ✓ | ✓ | — | — | — | — |
| Asignaciones (gestionar) | ✓ | ✓ | — | — | — | — |
| Marcar ingreso/egreso | — | — | — | — | ✓ | — |
| Registros nómina (ver) | ✓ | — | ✓ | ✓ | — | ✓ |
| Registros nómina (crear) | ✓ | — | ✓ | ✓ | — | ✓ |
| Liquidación | ✓ | — | ✓ | — | — | — |
| Reportes | ✓ | ✓ | ✓ | — | — | — |
| Integración config | ✓ | — | — | — | — | — |

## Lockout por intentos fallidos

```javascript
// En controlador de login
const MAX_INTENTOS = 5;
const LOCKOUT_MINUTOS = 15;

// tabla: intentos_login (usuario_id, intentos, bloqueado_hasta)
```

## Trabajador sin cuenta de usuario

Un `trabajador` puede existir sin `usuario_id` (lo creó el admin desde logiq360 sync).
Para que el trabajador use la app móvil debe hacer "Activar cuenta" con su cédula + email.

```
POST /api/auth/activar-cuenta
{
  "cedula": "10201030405",
  "email": "juan@email.com",
  "password": "nueva-clave"
}
```
Crea `usuario` vinculado al `trabajador` con rol `trabajador_turnos` o `trabajador_nomina` según `trabajador.tipo`.

---

## Registro libre (trabajador_turnos marketplace)

`POST /api/auth/registro`

No requiere cédula ni empresa preexistente. Cualquier persona puede crear una cuenta con:
- `nombre` (obligatorio)
- `apellido` (opcional)
- `email` (obligatorio, único)
- `password` (mínimo 8 caracteres)

El usuario se crea con `rol = 'trabajador_turnos'` y `empresa_id = NULL`. Devuelve par de tokens + perfil.

Flujo post-registro:
1. El trabajador ve la pantalla "Aún no estás en ninguna empresa" con CTA "Explorar empresas".
2. Solicita vinculación desde `GET /api/empresas/directorio` → `POST /api/trabajador-empresa/solicitar`.
3. Al aprobarse, comienza a recibir ofertas de esa empresa.

## JWT para trabajador_turnos multi-empresa

El claim `empresa_id` en el JWT es `null` para `trabajador_turnos`:

```json
{
  "sub": 42,
  "empresa_id": null,
  "rol": "trabajador_turnos",
  "nombre": "Carlos"
}
```

La lista de empresas activas se resuelve en runtime via el middleware `resolverEmpresasActivas` que hace una query a `trabajador_empresa WHERE usuario_id = ? AND estado = 'activo'`. El resultado se inyecta como `req.empresasActivas` (array de IDs).

## Visibilidad de ofertas multi-empresa

Para `trabajador_turnos`, las ofertas de todas sus empresas activas se mezclan en una sola lista. El delay de visibilidad se aplica **por empresa**: cada oferta se filtra según el ranking del trabajador en la empresa que la publicó, usando un JOIN contra `trabajador_empresa` + `trabajadores`.

```
Ranking ≥ 4.5 → delay 0 min   (ve al instante)
Ranking ≥ 3.5 → delay 15 min
Ranking ≥ 2.5 → delay 30 min
Sin ranking    → delay 15 min  (trabajador nuevo en esa empresa)
Ranking < 2.5  → delay 60 min
```

---

## OAuth — Login con proveedores externos

Permite iniciar sesión / registrarse con un proveedor OAuth. **Google es el único proveedor del MVP**; la arquitectura es modular (`backend/modules/auth/oauth/providers/`), agregar Apple o Facebook implica solo un archivo nuevo + un entry en el registry.

### Endpoint

```
POST /api/auth/oauth/:provider
Body: { token: "<id_token o credential del provider>" }
```

El cliente NO envía email/password — envía el `id_token` que recibió del proveedor (`expo-auth-session` en mobile, `@react-oauth/google` en web). El backend lo verifica contra las claves públicas del provider.

### Decisiones de diseño

| Decisión | Valor |
|----------|-------|
| Proveedores soportados | `google` (MVP). Apple/Facebook se enchufan agregando un provider sin tocar service/controller. |
| ¿Quién puede registrarse vía OAuth? | Solo `TRABAJADOR_TURNOS` (marketplace). Jefes/admins deben venir por invitación de empresa. |
| ¿Quién puede hacer login con OAuth? | **Cualquier rol**, siempre que la cuenta ya exista y se logre vincular. |
| Auto-vinculación por email | Sí, **solo si el provider verificó el email** (`email_verified=true`). Esto previene takeover (alguien que crea cuenta Google con un email ajeno no puede capturar la cuenta de App Turnos asociada). |
| Password de OAuth-only | Random bcrypt hash. Cumple el `NOT NULL` del schema y garantiza que el login por password nunca funcione hasta que el usuario set una password real (feature futura). |

### Flujo del backend (`OAuthService.loginConProvider`)

```
1. Verifica id_token contra el provider → {provider_user_id, email, email_verified, nombre, …}
2. ¿Existe vínculo (provider, provider_user_id) en `usuarios_oauth`?
   └─ Sí → emit tokens del usuario vinculado.   tipo='login'
3. ¿Existe usuario con ese email?
   ├─ Sí + email_verified → crear link, emit tokens.   tipo='vinculacion'
   └─ Sí + NO email_verified → 403 (anti-takeover)
4. Usuario nuevo + email_verified → registro libre como TRABAJADOR_TURNOS,
   crear link, emit tokens.   tipo='registro'
```

### Tabla `usuarios_oauth` (migración 011)

```sql
CREATE TABLE usuarios_oauth (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id          INT NOT NULL,
  provider            VARCHAR(32) NOT NULL,        -- 'google', 'apple', …
  provider_user_id    VARCHAR(255) NOT NULL,       -- sub del id_token
  email               VARCHAR(200) NULL,
  email_verified      TINYINT NOT NULL DEFAULT 0,
  avatar_url          VARCHAR(500) NULL,
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ultima_sesion       TIMESTAMP NULL,
  UNIQUE KEY uk_provider_user (provider, provider_user_id),
  UNIQUE KEY uk_usuario_provider (usuario_id, provider),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);
```

### Endpoints adicionales

| Método | Ruta | Rol | Descripción |
|--------|------|-----|-------------|
| `GET` | `/api/auth/oauth/vinculos` | Autenticado | Lista los providers vinculados a mi cuenta |
| `DELETE` | `/api/auth/oauth/:provider` | Autenticado | Desvincular un provider de mi cuenta |

### Configuración

Variable de entorno: `GOOGLE_CLIENT_ID` (uno o varios separados por coma para soportar iOS + Android + Web).

Sin esta variable, los endpoints OAuth devuelven 500 al recibir requests. El resto del backend funciona normal.
