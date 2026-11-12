# Reel 5 · Tu equipo listo en minutos

Tutorial práctico sobre cómo agregar empleados de nómina en la app.

## 1. Concepto

Un tutorial dinámico y rápido que muestra lo fácil que es agregar trabajadores. El perro guía paso a paso con una voz tranquila (acento colombiano), mientras las pantallas aparecen con animaciones interactivas.

## 2. Ficha técnica

| Dato | Valor |
|---|---|
| Duración | ~30-35 s |
| Formato | 1080 × 1920 (9:16), 30 fps, MP4 H.264 |
| Voz | Perro — voz tranquila, acento colombiano |
| Estilo | Tutorial práctico, dinámico |
| Música | Instrumental upbeat de Instagram |
| Zona segura | Texto lejos del 15% superior y 25% inferior |
| Fondo | `#F8FAFC` |
| Llamado a la acción | "Pruébalo gratis" / "Link en bio" |

## 3. Guion toma por toma

Historia: Tutorial aspiracional que contrasta métodos antiguos (Excel, papel) con Zaturno. Cada paso muestra una acción + el beneficio de hacerlo en la app.

| # | Tiempo | Qué pasa | Pose del perro | Texto en pantalla | Texto secundario (beneficio) | Animación/Movimiento |
|---|---|---|---|---|---|---|
| 1 | 0–3 s | Intro aspiracional | **Presentador** (pose nueva) | "Tu equipo en minutos" | "Sin Excel. Sin errores." | Perro aparece con bounce; Excel tachado se desvanece |
| 2 | 3–9 s | Paso 1 + beneficio | **En el escritorio** con celular | "1. Abre Equipo" | "Ya no buscas en 20 hojas" | Celular sube; pantalla de Excel se transforma en app limpia |
| 3 | 9–16 s | Paso 2 + beneficio | **Escribiendo** (pose nueva) | "2. Completa los datos" | "Todo se valida automáticamente" | Campos se llenan; checkmarks verdes aparecen (validación) |
| 4 | 16–23 s | Paso 3 + beneficio | **Revisando números** | "3. Agrega salario y banco" | "Listo para la nómina" | Transición a paso 2; números brillan al integrarse |
| 5 | 23–30 s | Completado + cierre | **Éxito/Celebra** (pose nueva) | "¡Listo en 3 minutos!" | "Cada uno con su acceso propio" + CTA | Checkmark + confetti; pantalla final con múltiples avatares |

## 4. Frases de voz (perro — voz tranquila colombiana)

| id | Texto | Tono | Entra en |
|---|---|---|---|
| v1 | "Olvídate del Excel y las hojas interminables" | Empático, liberador | 0,5 s |
| v2 | "Abre la pestaña Equipo, todo tu equipo en un solo lugar" | Aspiracional, tranquilo | 3,5 s |
| v3 | "Completa los datos. La app valida todo por ti" | Confiable, tranquilo | 9,5 s |
| v4 | "Agrega salario y banco. Queda listo para la nómina" | Instructivo, con seguridad | 16,5 s |
| v5 | "Listo en minutos. Cada uno con su acceso propio" | Celebrando, aspiracional | 23,5 s |

**Duración total de voz:** ~25 s (deja 5s para pausas visuales y música)

**Nota importante:** Estas frases NO pasan por `voz-del-espacio.sh`. Es la voz del perro, no de Zaturno.

## 5. Capturas/pantallas simuladas necesarias

### A. Pantallas móviles (390x844px — iPhone 14 Pro):

| Captura | Qué debe verse | Elementos clave |
|---|---|---|
| **A** | Pantalla Equipo (lista con 2 trabajadores) | Pestaña "Equipo" activa, FAB "+" pulsando en esquina |
| **B** | Formulario paso 1 — Datos personales | Campos completándose; checkmarks verdes de validación. Indicador "1/3" |
| **C** | Formulario paso 2 — Seguridad social/pago | Salario base, Banco, Cuenta. Checkmarks verdes. Indicador "2/3" |
| **D** | Pantalla de éxito con múltiples avatares | Checkmark gigante, "Carlos Rodríguez agregado", 3-4 avatares abajo |

### B. Elementos de contraste:

| Elemento | Descripción | Uso |
|---|---|---|
| **Excel-chaos.png** | Captura de Excel con múltiples hojas, celdas rojas (errores), fórmulas visibles | Toma 1 — se desvanece con X roja |
| **X-roja.svg** | X grande roja (símbolo de "no más") | Overlay sobre Excel |

### Cómo generarlas

**HTML simulados** (ya creados) en `reel-05/capturas/`:
1. ✅ `captura-a-equipo.html`
2. ✅ `captura-b-formulario1.html`
3. ✅ `captura-c-formulario2.html`
4. ✅ `captura-d-exito.html`

**Elementos adicionales a crear:**
5. `excel-chaos.html` — Simulación de Excel caótico (múltiples columnas, errores, fórmulas)
6. `x-roja.svg` — Ícono de prohibido/tachado

Ejecutar: `npm run capturas`

## 6. Poses nuevas del perro a crear

| Pose | Descripción | Cuándo se usa |
|---|---|---|
| **Presentador** | Pata derecha señalando hacia adelante, mirada a cámara, boca sonriente | Toma 1 — intro |
| **Escribiendo** | Pata con lápiz, mirando hacia abajo (papel), concentrado | Toma 4 — llenando datos |
| **Éxito/Celebra** | Brazos arriba, ojos cerrados felices, boca amplia sonrisa | Toma 6 — completado |

## 7. Animaciones clave (dinamismo)

### Contraste Excel vs Zaturno (Toma 1 y 2)
- **Excel desapareciendo:** Imagen de hoja Excel tachada con X roja → fade out + scale down (0.5s)
- **Transición a app:** Excel → celular limpio aparece desde abajo con bounce (0.6s, easeOutBack)
- **Texto "Sin Excel":** Aparece con scale pulse + brillo (0.4s)

### Textos
- **Entrada principal:** Scale from 0.7 + fade + slide up (0.3s, easeOutBack)
- **Texto secundario (beneficio):** Fade in + slight slide from right (0.25s, delay 0.1s)
- **Énfasis:** Palabras clave ("minutos", "automáticamente", "propio") con scale pulse (1.05)
- **Salida:** Fade out + slight slide (0.2s)

### Pantallas de celular
- **Entrada:** Slide up from bottom con bounce (0.5s, easeOutBack)
- **Transiciones entre pasos:** Cross-fade + slight slide left (0.4s, easeInOut)
- **Interacción simulada:**
  - Tap en botón: scale down 0.95 → scale up 1.05 → 1.0 (0.2s)
  - Llenar campos: texto aparece letra por letra (0.04s por letra)
  - **Validación automática:** Checkmark verde aparece al lado derecho de cada campo completado (0.3s, scale bounce)
  - Campo completado: border glow verde suave (0.3s fade in)

### Elementos interactivos especiales
- **FAB "+"**: Pulso sutil constante (scale 1.0 ↔ 1.08, 1.5s loop) hasta que se toca
- **Validación en tiempo real:** 
  - Checkmarks verdes aparecen progresivamente (0.2s delay entre cada uno)
  - Micro-animación de "success" (scale 0 → 1.2 → 1.0, 0.3s)
- **Integración con nómina (Toma 4):**
  - Números de salario brillan (glow amarillo → verde, 0.5s)
  - Ícono de link/conexión aparece brevemente (0.3s)
- **Checkmark final gigante**: Draw SVG path (0.8s) + scale bounce
- **Confetti**: 8-12 partículas, caída con rotación (1.5s, easing gravity)
- **Avatares múltiples (cierre):** 3-4 avatares aparecen en secuencia, cada uno con bounce (0.2s delay entre cada uno)

## 8. Componentes técnicos a usar

Del motor de animación (`marketing/instagram/motor/`):

- `timeline.js` — interpolación entre poses
- `easing.js` — easeOutBack, easeInOut
- `text-fx.js` — textos con entrada/salida
- `phone-frame.js` — marco del celular
- `capture.js` — captura de frames

## 9. Estructura de archivos

```
marketing/instagram/reel-05/
├── capturas/
│   ├── captura-a-equipo.html
│   ├── captura-b-formulario1.html
│   ├── captura-c-formulario2.html
│   ├── captura-d-exito.html
│   ├── generar-capturas.js
│   └── (PNGs generados)
├── escenas.js           # Definición de las 7 tomas
├── timeline.html        # Página que ejecuta la animación
├── build.js             # Script de orquestación
└── package.json
```

## 10. Caption para publicación

> Deja atrás el Excel y las hojas interminables. Con Zaturno agregas a tu equipo en minutos: datos validados automáticamente, integración directa con nómina y turnos, cada trabajador con su acceso propio.
> 
> Sin errores. Sin perder tiempo. Tu equipo organizado y listo.
> 
> 30 días gratis. Link en bio o escríbeme "EQUIPO" 👇

**Hashtags:** `#nomina #RRHH #adiosExcel #pymes #colombia #gestionhumana #recursoshumanos`

**Portada:** Perro en pose "Presentador" con texto "Tu equipo en minutos, sin Excel"

**Primer comentario fijado:**
> ¿Cuánto tiempo te toma agregar un empleado en tu sistema actual? En Zaturno es menos de 3 minutos. Pruébalo gratis 👉 [link]

## 11. Checklist de producción

**Preparación**
- [ ] Crear poses nuevas del perro: Presentador, Escribiendo, Éxito/Celebra
- [ ] Crear 4 pantallas HTML simuladas
- [ ] Generar capturas PNG (390x844, @2x)
- [ ] Conseguir voz en español colombiano (ElevenLabs — ya configurado)

**Animación**
- [ ] Definir escenas.js con las 7 tomas
- [ ] Implementar animaciones interactivas (taps, escritura, glow)
- [ ] Implementar transiciones de pantallas
- [ ] Agregar confetti y checkmark animado

**Audio**
- [ ] Generar 7 frases de voz con ElevenLabs (voz colombiana tranquila)
- [ ] Verificar timings de entrada
- [ ] Exportar sin procesamiento de "voz del espacio" (es el perro, no Zaturno)

**Exportación**
- [ ] Capturar frames (1050 frames @ 30fps para 35s)
- [ ] Compilar con ffmpeg + audio
- [ ] Verificar en celular real
- [ ] Elegir música upbeat en biblioteca de Instagram

**Publicación**
- [ ] Subir, agregar caption y hashtags
- [ ] Configurar portada
- [ ] Fijar primer comentario con link
- [ ] Monitorear primeras 48h

## 12. Notas de dirección

- **Tono aspiracional:** No es solo "mira cómo se hace", es "tu equipo merece algo mejor que Excel"
- **Contraste visual claro:** Excel caótico (tomas 1-2) vs app limpia y validada (resto del reel)
- **Ritmo:** Dinámico y fluido. Los pasos fluyen uno tras otro sin pausas largas.
- **Pausas breves:** 0.2-0.3s entre pasos, solo para respirar.
- **Validación como protagonista:** Los checkmarks verdes son la prueba visual de "la app trabaja por ti"
- **Interactividad realista:** Taps, typing progresivo, validaciones instantáneas — todo debe sentirse como app real
- **Energía:** Liberadora y confiable. "Adiós Excel, hola simplicidad."
- **Cierre con comunidad:** Los múltiples avatares finales representan "tu equipo completo, organizado"

## 13. Diferencias con reel-01

| Aspecto | Reel 1 | Reel 5 |
|---|---|---|
| Voz | Zaturno (épica, espacial) | Perro (tranquila, colombiana) |
| Propósito | Presentar la marca | Tutorial práctico |
| Tono | Aspiracional | Instructivo |
| Efectos de voz | voz-del-espacio.sh | Audio directo (sin efectos) |
| Velocidad | Pausado, dramático | Dinámico, fluido |
| Pantallas | 3 capturas rápidas | 4 capturas con detalle |
