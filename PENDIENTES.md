# Pendientes

Tareas operativas/de negocio fuera del código. No confundir con [PONYTAIL-DEBT.md](PONYTAIL-DEBT.md) (atajos técnicos deliberados).

- [ ] Crear correo de Zaturno con dominio propio (para no usar el correo personal) — averiguar cómo crear uno con el dominio.
- [ ] Actualizar el formulario de Data Safety en Google Play Console de "No" a "Sí" — ya existe el botón de eliminar cuenta con anonimización que lo respalda.
- [ ] Personalizar mensajes de `confirm()` que quedaron genéricos ("¿Estás seguro?") en vez de decir qué se borra:
  - `apps/mobile/app/mi-perfil-laboral.tsx:284` — eliminar experiencia
  - `apps/mobile/app/mi-perfil-laboral.tsx:307` — eliminar diploma
- [ ] Todo lo relacionado con iOS (build, pruebas en dispositivo/TestFlight, cuenta de Apple Developer, publicación en App Store) — hasta ahora solo se ha probado en Android.
