# Por qué los roles de gestión no tienen marcaje ni sueldo en la app

**Fecha:** 2026-07-05
**Audiencia:** Equipo desarrollador

---

## Contexto

Los roles `jefe_turnos`, `jefe_nomina` y `nomina` (creados por el admin vía `crearGestor()`,
`backend/modules/auth/auth.service.js:386-416`) son **puramente de control**. Al crearlos,
el sistema solo inserta una fila en `usuarios` — nunca una fila en `trabajadores`
(`backend/modules/trabajadores/trabajadores.model.js:181-251`). Por eso hoy:

- No tienen `salario_base` ni `tarifa_hora`.
- No pueden marcar entrada/salida (no hay `trabajador_id` al que atar un `registro_diario`).
- No aparecen en ninguna liquidación de nómina.

Se asume que estos roles cobran su sueldo **fuera de la app** (nómina tradicional de la empresa).

## Por qué se evaluó cambiar esto

Es razonable pensar que un jefe también debería poder registrar sus horas y cobrar
por ellas dentro del sistema, ya que en la práctica también reciben salario.

## Por qué se decidió NO hacerlo (por ahora)

El bloqueo no es técnico, es de **control interno**:

- El endpoint de marcar entrada/salida (`MARCAR` en
  `backend/modules/nomina/registros/registros.routes.js:17`) hoy solo permite
  `trabajador_nomina`.
- `jefe_nomina` ya tiene permiso de `CORREGIR` (ajustar/aprobar registros de horas,
  aprobar/rechazar solicitudes de reingreso) sobre el equipo que gestiona.
- Si se le diera también permiso de `MARCAR`, un `jefe_nomina` podría marcar sus
  propias horas extra **y** ser quien corrige/aprueba esos mismos registros — sin
  que otra persona los revise antes de pagarlos. Un `trabajador_nomina` normal no
  tiene ese problema porque sus registros los revisa un jefe distinto.

Es un riesgo real de fraude de nómina (conflicto de interés / falta de
segregación de funciones), no algo que se resuelva con más código sin pensarlo.

## Mitigación posible, si se retoma

Permitir que el jefe marque su propia entrada/salida, pero bloquear que corrija
o apruebe sus propios registros — un chequeo puntual del tipo
`registro.trabajador.usuario_id !== req.usuario.id` en los endpoints de
`CORREGIR`, exigiendo que otro `jefe_nomina` o el `admin_empresa` lo haga en su
lugar.

## Estado

**En pausa.** No se ha implementado ningún cambio de roles ni el flujo de
"convertir gestor en trabajador". No proponer esto de nuevo sin que el equipo lo
pida explícitamente — ya se evaluó y se decidió esperar.
