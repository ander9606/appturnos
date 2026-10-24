# Reel 1 · Presentación de Zaturno

Plan de producción listo para ejecutar. Personaje y poses: `personaje/` (hojas 1 a 4).

## 1. Decisión: un reel, no todo en uno

Un solo reel no debe explicar toda la app: cada reel vende **una promesa**. Plan recomendado:

| Reel | Papel | Promesa |
|---|---|---|
| **1 (este)** | Ancla: presenta al perro y qué es Zaturno | "Turnos, marcaje y nómina en una sola app" |
| 2 | Dolor | "Le pagaste mal a un trabajador y no lo sabes" |
| 3 | Función: marcaje | Geocerca: solo marca quien está en el sitio |
| 4 | Función: turnos | Publicar un turno y recibir postulados |
| 5 | Función: nómina | Recargos de ley sin fórmulas |

El reel 1 nombra las tres funciones en una frase cada una, sin entrar en detalle. El detalle vive en los reels 3 a 5. El calendario de 12 reels se corre una posición: el reel "Le pagaste mal…" pasa a ser el 2.

## 2. Ficha técnica

| Dato | Valor |
|---|---|
| Duración | ~36 s (se puede recortar a ~32 s quitando la toma 8) |
| Formato | 1080 × 1920 (9:16), 30 fps, MP4 H.264 |
| Voz | Ninguna. Todo va en texto grande en pantalla (se ve sin sonido) |
| Música | Instrumental de la biblioteca de Instagram, se agrega al publicar |
| Zona segura | Texto lejos de los bordes: dejar libre aprox. el 15 % superior y el 25 % inferior (interfaz de Instagram) |
| Fondo | `#F8FAFC`; destello `#FF5A3C` en la toma de presentación |
| Llamado a la acción | "30 días gratis" + "Escríbeme NÓMINA" |

## 3. Guion toma por toma

| # | Tiempo | Qué pasa | Pose del perro (guía) | Texto en pantalla | Movimiento |
|---|---|---|---|---|---|
| 1 | 0–3 s | Gancho | **Pensando** (hoja 3) | "¿Cuánto te toma cuadrar la nómina de tu personal?" | El perro entra rebotando desde abajo; aparecen "?" con efecto pop |
| 2 | 3–8 s | Problema | **No sé · hombros** con cara **Preocupado** (hojas 4 y 2) | Una línea cada 1,5 s: "Turnos por WhatsApp." / "Horas en un cuaderno." / "Recargos a mano." | Cada línea entra y vibra; gotas de sudor |
| 3 | 8–11 s | Giro | **Idea** (hoja 3) | "Hay una forma más fácil." | Bombilla con pop; corte rápido |
| 4 | 11–15 s | Presentación | **Saluda** (pendiente de agregar a la guía) | "Zaturno" y debajo "turnos · marcaje · nómina" | Destello naranja, el planeta del logo se forma detrás y la medalla del collar hace zoom |
| 5 | 15–20 s | Turnos | **En el escritorio** (hoja 4) + celular con captura A | "1. Publica el turno" | El celular sube desde abajo con la captura; el perro mira la pantalla |
| 6 | 20–25 s | Marcaje | **Marcaje · celular** (hoja 3) con captura B | "2. Marcan desde el sitio" y debajo, pequeño, "con geocerca" | El pin de ubicación late; el perro sonríe |
| 7 | 25–30 s | Nómina | **Nómina · dinero** (hoja 3) con captura C | "3. Nómina con recargos de ley, sin fórmulas" | Billetes caen y la captura se acerca al total |
| 8 | 30–33 s | Resultado | **Aprobado** (hoja 3) | "Todo en una sola app." | Check verde con pop y brillos |
| 9 | 33–36 s | Cierre | **Saluda** | "30 días gratis" / "Escríbeme NÓMINA" / @usuario | Flecha apuntando al link de la bio; el perro agita la pata |

Sobre los textos: "recargos de ley" es general a propósito. No se menciona ninguna ley, porcentaje ni fecha en este reel. Si más adelante se cita la ley, revisar antes con un contador o abogado laboral.

## 4. Material que hay que conseguir

**Tres grabaciones de la app real** (las graba el dueño, con datos de demostración, nunca datos reales de personas):

| Captura | Qué debe verse | Dónde | Duración |
|---|---|---|---|
| **A** | Crear y publicar un turno (u oferta de turno) | Móvil o web | 5–6 s |
| **B** | Pantalla de marcaje: botón "Marcar ingreso" habilitado dentro del radio de la geocerca | Móvil | 5–6 s |
| **C** | Liquidación de nómina con el total por trabajador | Web o móvil | 5–6 s |

Cómo grabarlas:
1. Cargar datos de demostración con `cd backend && npm run seed` (empresa, usuarios y turnos de prueba).
2. Grabar en vertical (el reel es 9:16). Si la grabación sale en horizontal, la recorto y la encajo en el marco del celular.
3. Taps visibles, sin notificaciones, sin nombres reales, batería y hora neutras.

**Pendiente en el personaje:** agregar la pose "Saluda" a la guía (es la pose de saludo ya usada en las pruebas, solo falta documentarla).

## 5. Cómo se produce (cuando haya herramientas)

Se hace con código, sin editor de video:

1. **Línea de tiempo en HTML + JavaScript**: cada toma es una lista de datos del perro (`perro(pose)` de `personaje/perro.js`) y el motor interpola entre una pose y la siguiente.
2. **Principios de animación**: anticipación (el perro se agacha un poco antes de saltar), exageración al estilo clásico (estirar y aplastar), rebote al entrar (`ease-out-back`, ~0,25 s) y pausas de 6 a 8 cuadros para que la actuación se lea.
3. **Captura de cuadros**: Playwright abre la página y guarda un PNG por cada 1/30 s (36 s ≈ 1 080 cuadros).
4. **Codificación**: `ffmpeg` junta los cuadros en MP4 (H.264, `yuv420p`, 1080×1920). Ya están instalados `ffmpeg`, Node y Playwright.
5. **Capturas de pantalla**: si son videos, `ffmpeg` los pasa a secuencia de cuadros para sincronizarlos con la línea de tiempo.
6. **Audio**: no se genera. Se elige la música al publicar.

Piezas por construir: motor de interpolación y línea de tiempo, componente de marco de celular, textos animados, planeta del logo grande y transiciones.

## 6. Publicación

**Caption**
> Cuadrar turnos y nómina no debería quitarte el sueño. Con Zaturno publicas turnos, tus trabajadores marcan desde el sitio y la nómina se calcula con los recargos de ley. 30 días gratis. Escríbeme NÓMINA por mensaje directo o entra al link de la bio.

**Hashtags** (pocos y relevantes): `#nomina #turnos #colombia #pymes #recursoshumanos`

**Portada:** el perro en la pose "Idea" con el texto "Hay una forma más fácil".

**Programación:** Meta Business Suite (gratis). Primer comentario fijado con el link o el llamado a escribir "NÓMINA".

## 7. Lista de verificación

**Antes de producir**
- [ ] Cuenta de Instagram creada (profesional, vinculada a una página de Facebook) y usuario definido
- [ ] Link de la bio listo (registro de la web de Zaturno)
- [ ] Capturas A, B y C grabadas con datos de demostración
- [ ] Pose "Saluda" agregada a la guía

**Producción**
- [ ] Motor de línea de tiempo y marco de celular
- [ ] Tomas 1 a 9 animadas y revisadas sin sonido
- [ ] Textos dentro de la zona segura
- [ ] Exportar MP4 y verificarlo en un celular real

**Publicación y seguimiento**
- [ ] Elegir música, portada y caption
- [ ] Programar y fijar el primer comentario
- [ ] A las 48 h mirar: retención en los primeros 3 s, compartidos, guardados y mensajes directos

## 8. Decisiones pendientes
1. Usuario de Instagram.
2. Si el reel 1 se queda en ~36 s o se recorta a ~32 s.
3. Móvil o web para las capturas (recomendado: móvil, porque el marcaje es de móvil).
