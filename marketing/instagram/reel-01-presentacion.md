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
| Duración | ~36 s |
| Formato | 1080 × 1920 (9:16), 30 fps, MP4 H.264 |
| Voz | Una sola: Zaturno, la "voz del espacio" (ver sección 6). Todo lo que dice también va en texto grande, para que se entienda sin sonido |
| Música | Instrumental de la biblioteca de Instagram, se agrega al publicar |
| Zona segura | Texto lejos de los bordes: dejar libre aprox. el 15 % superior y el 25 % inferior (interfaz de Instagram) |
| Fondo | `#F8FAFC`; destello `#FF5A3C` en la toma de presentación |
| Llamado a la acción | "30 días gratis" + "Escríbeme NÓMINA" |

## 3. Guion toma por toma (propuesta v2, pendiente de tu OK)

Historia: el perro sufre calculando la nómina, se pregunta cómo hacerlo mejor y le responde Zaturno desde el espacio.

| # | Tiempo | Qué pasa | Pose del perro | Texto en pantalla | Movimiento |
|---|---|---|---|---|---|
| 1 | 0–4 s | Rutina | **Revisando hojas** (pose nueva: hoja de papel en la pata, mirada que alterna papel y Excel) en el escritorio | "Calcular la nómina…" | La mirada va de las hojas a la pantalla del Excel |
| 2 | 4–8 s | Esfuerzo | **Cansado** / cara **Preocupado** | "…toma mucho tiempo." | Las hojas se amontonan, celdas rojas en el Excel, un reloj gira, gotas de sudor |
| 3 | 8–11 s | Pregunta | **Pensando** (hoja 3) | "¿Cómo puedo hacerlo mejor… y más rápido?" | Se detiene, mira a cámara; burbuja de pensamiento con "?" |
| 4 | 11–13 s | Silencio | **Sorpresa mirando arriba** (pose nueva) | — | Cae un rayo de luz sobre el perro; sin música fuerte, pausa de 1 s |
| 5 | 13–18 s | Llega Zaturno | **Idea** (hoja 3) | Frases de la voz (ver tabla de voz): letras grandes y brillantes, otra tipografía que la del perro | El planeta con anillo aparece en el cielo; al terminar, su anillo cae y se vuelve la medalla del collar (única toma donde el collar empieza liso) |
| 6 | 18–23 s | Turnos | **En el escritorio** (hoja 4) + celular con captura A | "1. Publica el turno" | El celular sube desde abajo con la captura |
| 7 | 23–28 s | Marcaje | **Marcaje · celular** (hoja 3) con captura B | "2. Marcan desde el sitio" y debajo, pequeño, "con geocerca" | El pin de ubicación late |
| 8 | 28–33 s | Nómina | **Nómina · dinero** (hoja 3) con captura C | "3. Nómina con recargos de ley, sin fórmulas" | Billetes caen y la captura se acerca al total |
| 9 | 33–36 s | Cierre | **Saluda** (pendiente de agregar a la guía) | "30 días gratis" / "Escríbeme NÓMINA" / @usuario | Flecha hacia el link de la bio; el perro agita la pata |

Sobre los textos: "recargos de ley" es general a propósito. No se menciona ninguna ley, porcentaje ni fecha en este reel. Si más adelante se cita la ley, revisar antes con un contador o abogado laboral.

El tono de la voz es épico y exagerado, sin referencias religiosas: es la voz del espacio, no de una figura divina.

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

**Pendiente en el personaje:** agregar a la guía las poses "Saluda", "Revisando hojas" y "Sorpresa mirando arriba", y dibujar los objetos nuevos (pila de hojas, Excel con celdas rojas, rayo de luz, planeta grande, burbuja de pensamiento).

## 5. Cómo se produce (cuando haya herramientas)

Se hace con código, sin editor de video:

1. **Línea de tiempo en HTML + JavaScript**: cada toma es una lista de datos del perro (`perro(pose)` de `personaje/perro.js`) y el motor interpola entre una pose y la siguiente.
2. **Principios de animación**: anticipación (el perro se agacha un poco antes de saltar), exageración al estilo clásico (estirar y aplastar), rebote al entrar (`ease-out-back`, ~0,25 s) y pausas de 6 a 8 cuadros para que la actuación se lea.
3. **Captura de cuadros**: Playwright abre la página y guarda un PNG por cada 1/30 s (36 s ≈ 1 080 cuadros).
4. **Codificación**: `ffmpeg` junta los cuadros en MP4 (H.264, `yuv420p`, 1080×1920). Ya están instalados `ffmpeg`, Node y Playwright.
5. **Capturas de pantalla**: si son videos, `ffmpeg` los pasa a secuencia de cuadros para sincronizarlos con la línea de tiempo.
6. **Voz**: se genera automáticamente a partir de las frases de la sección 6 y se mezcla en el mismo `ffmpeg`. La música se elige al publicar.

Piezas por construir: motor de interpolación y línea de tiempo, componente de marco de celular, textos animados, planeta del logo grande y transiciones.

## 6. Voz de Zaturno (automática)

La voz debe generarse sola al crear cada reel. La herramienta de voz **aún no está elegida**; el resto del flujo ya está definido para que la herramienta sea intercambiable.

### Frases (reel 1)

| id | Texto | Tono | Entra en |
|---|---|---|---|
| v1 | "Deja el Excel, criatura." | Grave, calmado, con eco | 13,0 s |
| v2 | "Yo soy Zaturno. Yo me encargo." | Grave, con eco | 15,5 s |

### Flujo

1. Texto de cada frase → **herramienta de voz** (por elegir) → archivo de audio (`.wav` o `.mp3`).
2. `audio/voz-del-espacio.sh entrada.wav salida.wav` convierte cualquier voz en la voz del espacio (más grave, con eco, volumen estándar para redes). Ya probado en `ffmpeg` 6.
3. `ffmpeg` coloca cada frase en su segundo exacto (`adelay`), la junta con los efectos de sonido y la pega al video.
4. La música de Instagram se agrega al publicar, por debajo de la voz.

### Criterios para elegir la herramienta de voz

| Criterio | Por qué |
|---|---|
| Español, idealmente latino o colombiano | El resto del reel es en español colombiano |
| **Licencia comercial explícita** en el plan que se use | La cuenta es de una marca; no depender de plan gratis si prohíbe uso comercial |
| API o línea de comandos | Para que se genere sola, sin abrir una página |
| Voz grave o que acepte ajustar el tono | El efecto del script funciona mejor con una voz grave de partida |
| Control de velocidad y pausas | Para encajar las frases en los segundos del guion |
| Formato de salida `.wav` o `.mp3` | Lo que lee `ffmpeg` |
| Costo por reel razonable | 12 reels al mes, con frases cortas |

Nota: la voz artificial de Instagram solo está en inglés según su ayuda oficial, así que no sirve para esto.

## 7. Publicación

**Caption**
> Cuadrar turnos y nómina no debería quitarte el sueño. Con Zaturno publicas turnos, tus trabajadores marcan desde el sitio y la nómina se calcula con los recargos de ley. 30 días gratis. Escríbeme NÓMINA por mensaje directo o entra al link de la bio.

**Hashtags** (pocos y relevantes): `#nomina #turnos #colombia #pymes #recursoshumanos`

**Portada:** el perro en la pose "Idea" con el texto "Hay una forma más fácil".

**Programación:** Meta Business Suite (gratis). Primer comentario fijado con el link o el llamado a escribir "NÓMINA".

## 8. Lista de verificación

**Antes de producir**
- [ ] Cuenta de Instagram creada (profesional, vinculada a una página de Facebook) y usuario definido
- [ ] Link de la bio listo (registro de la web de Zaturno)
- [ ] Capturas A, B y C grabadas con datos de demostración
- [ ] Poses nuevas agregadas a la guía (Saluda, Revisando hojas, Sorpresa mirando arriba)
- [ ] Herramienta de voz elegida con licencia comercial confirmada

**Producción**
- [ ] Motor de línea de tiempo y marco de celular
- [ ] Tomas 1 a 9 animadas y revisadas sin sonido
- [ ] Textos dentro de la zona segura
- [ ] Exportar MP4 y verificarlo en un celular real

**Publicación y seguimiento**
- [ ] Elegir música, portada y caption
- [ ] Programar y fijar el primer comentario
- [ ] A las 48 h mirar: retención en los primeros 3 s, compartidos, guardados y mensajes directos

## 9. Decisiones pendientes
1. Usuario de Instagram.
2. Herramienta de voz automática (ver criterios en la sección 6).
3. Confirmar la secuencia v2: voz del espacio y medalla que cae.
4. Frases con humor ("Deja el Excel, criatura") o más serias.
5. Móvil o web para las capturas (recomendado: móvil, porque el marcaje es de móvil).
