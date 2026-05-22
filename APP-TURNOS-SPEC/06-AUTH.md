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
