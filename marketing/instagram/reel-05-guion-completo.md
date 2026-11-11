# Reel 5 · Tu equipo listo en minutos — Guion Completo

**Duración total:** 30 segundos  
**Formato:** 1080x1920 (9:16), 30fps  
**Voz:** Perro (tranquila, acento colombiano)  
**Música:** Instrumental upbeat (se agrega en Instagram)  
**Tono:** Aspiracional, liberador

---

## TOMA 1: Intro — Adiós Excel (0-3 segundos)

### VISUAL

**Escena inicial (0.0-1.5s):**
- Fondo: `#F8FAFC`
- Centro de pantalla: Captura de Excel caótico (`excel-chaos.png`)
  - Posición: centrada, ocupando 70% del ancho
  - Opacidad inicial: 1.0
  - Se ven: múltiples hojas, celdas con errores rojos, fórmulas complejas

**Animación de rechazo (1.5-2.5s):**
- X roja gigante aparece sobre el Excel
  - Animación: scale from 0 → 1.3 → 1.0 (0.4s, easeOutBack)
  - Color: `#EF4444` (rojo intenso)
  - Grosor: 8px
- Excel + X se desvanecen juntos
  - Fade out: opacity 1.0 → 0 (0.5s)
  - Scale down: 1.0 → 0.8 (0.5s, easeIn)

**Entrada del perro (2.0-3.0s):**
- Perro en pose **"Presentador"** aparece desde la izquierda
  - Posición final: lado izquierdo (x: 270)
  - Animación: slide in + bounce (0.5s, easeOutBack)
  - Pata derecha señalando hacia el centro/derecha

### TEXTO EN PANTALLA

**Texto principal (aparece a los 1.8s):**
```
Tu equipo en minutos
```
- Posición: centro-superior (y: 400)
- Fuente: Inter, 56px, weight 800
- Color: `#0F172A`
- Animación entrada: scale 0.7 → 1.0 + fade (0.3s, easeOutBack)

**Texto secundario (aparece a los 2.2s):**
```
Sin Excel. Sin errores.
```
- Posición: debajo del principal (y: 480)
- Fuente: Inter, 32px, weight 600
- Color: `#64748B`
- Animación entrada: fade + slide up (0.25s, delay 0.15s)

### VOZ

**v1 (entra a los 0.5s):**
> "Olvídate del Excel y las hojas interminables"

- Tono: Empático, liberador
- Duración: ~2.5s

---

## TOMA 2: Paso 1 — Abre Equipo (3-9 segundos)

### VISUAL

**Perro (3.0-9.0s):**
- Pose: **"En el escritorio"** (sentado, mirando al celular)
- Posición: lado izquierdo (x: 270, y: 960)
- Transición desde pose anterior: morph suave (0.3s)

**Celular (3.5-9.0s):**
- Captura: `captura-a-equipo.png` dentro de marco de celular
- Animación entrada:
  - Slide up desde bottom (y: 1400 → 960) (0.5s, easeOutBack)
  - Bounce sutil al llegar
- Posición final: centro-derecha (x: 680, y: 960)
- Tamaño: 300px ancho (escala 0.77)

**Interacción simulada (5.5-6.0s):**
- Indicador de tap aparece sobre la pestaña "Equipo"
  - Círculo gris semi-transparente
  - Scale: 0 → 1.2 → 0.8 (0.3s)
  - Fade out al final
- Tab "Equipo" hace highlight:
  - Background flash: blanco → azul suave → blanco (0.2s)

**Transformación visual (6.5-9.0s):**
- Efecto de "limpieza" en el celular
  - Brillo sutil recorre la pantalla de arriba a abajo (0.5s)
  - Representa "organización vs caos de Excel"

### TEXTO EN PANTALLA

**Texto principal (aparece a los 3.5s):**
```
1. Abre Equipo
```
- Posición: arriba del celular (y: 600)
- Fuente: Inter, 48px, weight 800
- Color: `#0F172A`
- Animación: scale + fade (0.3s, easeOutBack)

**Texto beneficio (aparece a los 5.0s):**
```
Ya no buscas en 20 hojas
```
- Posición: debajo del principal (y: 670)
- Fuente: Inter, 28px, weight 600
- Color: `#10B981` (verde, representa beneficio)
- Animación: fade + slide from right (0.25s, delay 0.1s)
- Ícono: ✅ antes del texto

### VOZ

**v2 (entra a los 3.5s):**
> "Abre la pestaña Equipo, todo tu equipo en un solo lugar"

- Tono: Aspiracional, tranquilo
- Duración: ~3s
- Énfasis en: "todo tu equipo en **un solo lugar**"

---

## TOMA 3: Paso 2 — Completa datos (9-16 segundos)

### VISUAL

**Perro (9.0-16.0s):**
- Pose: **"Escribiendo"** (con lápiz, mirando hacia abajo/celular)
- Posición: lado izquierdo (x: 270, y: 960)
- Transición: morph desde pose anterior (0.3s)
- Detalle: el lápiz "escribe" con movimiento sutil (0.1s loops)

**Celular (9.0-16.0s):**
- Transición de pantalla:
  - Captura actual (Equipo) slide left + fade (0.3s)
  - Captura nueva (Formulario 1) slide in from right (0.3s)
  - Cross-fade entre ambas (0.2s overlap)
- Captura: `captura-b-formulario1.png`
- Posición: misma (x: 680, y: 960)

**Interacción simulada — Llenado de campos (10.0-15.5s):**

1. **Campo "Nombre" (10.0-11.0s):**
   - Texto "Carlos" aparece letra por letra (0.04s por letra)
   - Al completar: checkmark verde aparece a la derecha
     - Animación: scale 0 → 1.2 → 1.0 (0.3s, bounce)
   - Border del campo: gris → verde suave (0.2s)

2. **Campo "Apellido" (11.2-12.2s):**
   - Texto "Rodríguez" aparece letra por letra
   - Checkmark verde (mismo comportamiento)
   - Border: gris → verde

3. **Chip "Nómina" (12.5-13.0s):**
   - Tap simulado sobre el chip
   - Chip hace toggle: blanco → azul (0.2s)
   - Checkmark aparece

4. **Campo "Cédula" (13.2-14.5s):**
   - Número "1.098.765.432" aparece con formato automático
   - Puntos se agregan automáticamente (muestra validación)
   - Checkmark verde
   - Micro-animación de "validated" (brillo verde recorre el campo)

**Indicador de progreso (14.5-16.0s):**
- Barra de pasos arriba: "Paso 1 de 3"
- Primera barra se llena de azul (animación: width 0% → 100%, 0.4s)

### TEXTO EN PANTALLA

**Texto principal (aparece a los 9.5s):**
```
2. Completa los datos
```
- Posición: arriba (y: 600)
- Animación: scale + fade (0.3s)

**Texto beneficio (aparece a los 11.5s):**
```
✓ Todo se valida automáticamente
```
- Posición: debajo (y: 670)
- Color: `#10B981`
- Animación: fade + slide from right (0.25s)
- El checkmark ✓ pulsa sutilmente (scale 1.0 ↔ 1.1, 1s loop)

### VOZ

**v3 (entra a los 9.5s):**
> "Completa los datos. La app valida todo por ti"

- Tono: Confiable, tranquilo
- Duración: ~3s
- Énfasis en: "**valida todo por ti**"

---

## TOMA 4: Paso 3 — Salario y banco (16-23 segundos)

### VISUAL

**Perro (16.0-23.0s):**
- Pose: **"Revisando números"** (mirando papeles/celular, pose seria/profesional)
- Posición: lado izquierdo (x: 270, y: 960)
- Transición: morph (0.3s)

**Celular (16.0-23.0s):**
- Transición de pantalla:
  - Formulario 1 → Formulario 2 (mismo efecto slide)
- Captura: `captura-c-formulario2.png`
- Indicador de pasos actualizado: "Paso 2 de 3"
- Segunda barra de progreso se llena

**Interacción simulada — Datos de pago (17.0-22.5s):**

1. **Campo "Salario base" (17.0-18.5s):**
   - Número "$1.750.905" aparece con formato de moneda
   - Puntos y símbolo $ se agregan automáticamente
   - Checkmark verde
   - Helper text: "💡 Salario mínimo legal vigente 2026" aparece debajo (fade in)

2. **Campo "EPS" (18.7-19.5s):**
   - Dropdown se abre brevemente (simular selección)
   - "Sura EPS" aparece
   - Checkmark verde

3. **Campo "Banco" (19.7-20.5s):**
   - "Bancolombia" aparece
   - Checkmark verde

4. **Campo "Número de cuenta" (20.7-21.5s):**
   - Número "123456789" aparece
   - Checkmark verde

**Efecto de integración (21.5-23.0s):**
- Todos los campos con checkmark brillan sutilmente
- Efecto de "conexión": línea animada conecta los campos hacia un ícono de nómina
  - Path animation: draw (0.6s)
  - Color: verde → azul
- Ícono de nómina/dinero aparece con bounce
- Mensaje emergente pequeño: "✓ Listo para liquidación"

### TEXTO EN PANTALLA

**Texto principal (aparece a los 16.5s):**
```
3. Agrega salario y banco
```
- Posición: arriba (y: 600)
- Animación: scale + fade (0.3s)

**Texto beneficio (aparece a los 19.0s):**
```
💰 Listo para la nómina
```
- Posición: debajo (y: 670)
- Color: `#6366F1` (azul primario)
- Animación: fade + slide from right (0.25s)
- El ícono 💰 pulsa sutilmente

### VOZ

**v4 (entra a los 16.5s):**
> "Agrega salario y banco. Queda listo para la nómina"

- Tono: Instructivo, con seguridad
- Duración: ~3.5s
- Énfasis en: "**listo para la nómina**"

---

## TOMA 5: Completado + Cierre (23-30 segundos)

### VISUAL

**Perro (23.0-30.0s):**
- Pose: **"Éxito/Celebra"** (brazos arriba, ojos cerrados felices, sonrisa amplia)
- Posición: lado izquierdo (x: 270, y: 960)
- Transición: jump + morph (0.4s, con anticipación)
- Al caer: pequeño bounce (0.2s)

**Celular (23.0-26.0s):**
- Transición final:
  - Formulario 2 hace zoom out + fade (0.4s)
- Captura: `captura-d-exito.png`
- Animación entrada:
  - Scale from 0.8 → 1.05 → 1.0 (0.5s, easeOutBack)
  - Fade in simultáneo

**Checkmark gigante (24.0-25.5s):**
- Checkmark verde gigante en el centro de la pantalla
- Animación:
  - Draw SVG path (0.8s, con aceleración al final)
  - Scale: 0.5 → 1.2 → 1.0 (0.5s, bounce)
- Color: `#10B981` (verde éxito)
- Grosor: 12px
- Glow sutil alrededor

**Confetti (24.5-27.0s):**
- 10-12 partículas de confetti caen desde arriba
- Colores: `#6366F1`, `#10B981`, `#F59E0B`, `#EF4444`
- Animación:
  - Caída con rotación (1.5s, easing gravity)
  - Cada partícula con delay aleatorio (0-0.3s)
  - Fade out al final

**Avatares múltiples (26.0-28.0s):**
- En la parte inferior del celular/pantalla
- 4 avatares circulares aparecen en secuencia:
  1. Avatar "M" (María) - azul
  2. Avatar "J" (Juan) - verde
  3. Avatar "C" (Carlos) - morado (el recién creado, con brillo)
  4. Avatar "+" (agregar más) - gris claro
- Animación de cada uno:
  - Scale 0 → 1.1 → 1.0 (0.3s, bounce)
  - Delay entre ellos: 0.15s
- Posición: horizontal, centrados debajo del celular

**Transición a CTA (28.0-30.0s):**
- Celular y avatares hacen ligero fade out (opacity 1.0 → 0.5)
- Perro se mantiene visible, cambia a pose **"Saluda"**
  - Pata agitándose (animación loop sutil)

### TEXTO EN PANTALLA

**Texto principal (aparece a los 23.5s):**
```
¡Listo en 3 minutos!
```
- Posición: centro-superior (y: 500)
- Fuente: Inter, 64px, weight 800
- Color: `#10B981` (verde éxito)
- Animación: scale 0.5 → 1.2 → 1.0 + fade (0.5s, easeOutBack)
- Pulsa sutilmente con el checkmark

**Texto beneficio final (aparece a los 25.0s):**
```
Cada uno con su acceso propio
```
- Posición: debajo (y: 600)
- Fuente: Inter, 32px, weight 600
- Color: `#64748B`
- Animación: fade + slide up (0.3s)

**CTA (aparece a los 28.0s):**
```
Pruébalo gratis
Link en bio ↑
```
- Posición: centro-inferior (y: 1500)
- Fuente: Inter, 40px, weight 700
- Color: `#6366F1`
- Animación: fade + scale (0.3s)
- Flecha ↑ pulsa sutilmente (translate y: 0 ↔ -8px, 0.8s loop)

**Username (aparece a los 28.5s):**
```
@zaturno.app
```
- Posición: muy abajo (y: 1600)
- Fuente: Inter, 24px, weight 600
- Color: `#64748B`
- Animación: fade in (0.2s)

### VOZ

**v5 (entra a los 23.5s):**
> "Listo en minutos. Cada uno con su acceso propio"

- Tono: Celebrando, aspiracional
- Duración: ~3s
- Énfasis en: "**acceso propio**"

---

## MÚSICA

**Track instrumental:** Upbeat, positivo, moderno
- BPM: 120-130
- Estilo: Corporate/Tech optimista
- Se agrega al publicar en Instagram
- Volumen: bajo (background), no compite con la voz

**Momentos clave sincronizados:**
- Beat drop suave a los 3s (inicio paso 1)
- Build-up a los 23s (completado)
- Clímax a los 24s (checkmark gigante)

---

## TRANSICIONES ENTRE TOMAS

1. **Toma 1 → Toma 2 (3s):**
   - Excel desaparece completamente antes de que el celular entre
   - Overlap: 0.5s
   - Tipo: Cross-fade + scale

2. **Toma 2 → Toma 3 (9s):**
   - Pantalla del celular cambia (slide left)
   - Perro morphea a nueva pose
   - Overlap: 0.3s
   - Tipo: Slide + morph

3. **Toma 3 → Toma 4 (16s):**
   - Similar a anterior
   - Énfasis en continuidad del flujo
   - Overlap: 0.3s

4. **Toma 4 → Toma 5 (23s):**
   - Formulario hace zoom out + fade
   - Pantalla de éxito hace zoom in dramático
   - Perro salta a pose de celebración
   - Overlap: 0.4s
   - Tipo: Zoom + bounce

---

## PALETA DE COLORES

| Color | Código | Uso |
|---|---|---|
| Fondo | `#F8FAFC` | Background general |
| Texto principal | `#0F172A` | Títulos, textos importantes |
| Texto secundario | `#64748B` | Subtítulos, descripciones |
| Éxito/Validación | `#10B981` | Checkmarks, beneficios positivos |
| Primario | `#6366F1` | Elementos de marca, CTA |
| Error/Rechazo | `#EF4444` | X sobre Excel |
| Advertencia | `#F59E0B` | Confetti (color secundario) |

---

## TIPOGRAFÍA

**Fuente:** Inter (https://fonts.google.com/specimen/Inter)

| Uso | Tamaño | Weight | Line height |
|---|---|---|---|
| Título principal | 56-64px | 800 | 1.1 |
| Pasos numerados | 48px | 800 | 1.2 |
| Beneficios | 28-32px | 600 | 1.3 |
| CTA | 40px | 700 | 1.2 |
| Username | 24px | 600 | 1 |

---

## TIMINGS DETALLADOS (Referencia para animación)

```
00.0s  Intro - Excel visible
00.5s  [VOZ] "Olvídate del Excel..."
01.5s  X roja aparece sobre Excel
01.8s  Texto "Tu equipo en minutos" aparece
02.0s  Perro entra desde izquierda
02.2s  Texto "Sin Excel. Sin errores" aparece
02.5s  Excel + X desaparecen completamente
03.0s  ──────────────────────────────────────
03.0s  TOMA 2 inicia
03.5s  [VOZ] "Abre la pestaña Equipo..."
03.5s  Celular sube desde abajo
03.5s  Texto "1. Abre Equipo" aparece
05.0s  Texto beneficio aparece
05.5s  Tap simulado en pestaña Equipo
06.5s  Efecto de "limpieza" en celular
09.0s  ──────────────────────────────────────
09.0s  TOMA 3 inicia
09.5s  [VOZ] "Completa los datos..."
09.5s  Texto "2. Completa los datos" aparece
10.0s  Campo "Nombre" se llena
11.0s  Checkmark verde aparece
11.2s  Campo "Apellido" se llena
11.5s  Texto beneficio aparece
12.2s  Checkmark verde aparece
12.5s  Chip "Nómina" seleccionado
13.0s  Checkmark verde aparece
13.2s  Campo "Cédula" se llena con formato
14.5s  Checkmark verde + validación
14.5s  Barra de progreso se llena
16.0s  ──────────────────────────────────────
16.0s  TOMA 4 inicia
16.5s  [VOZ] "Agrega salario y banco..."
16.5s  Texto "3. Agrega salario y banco" aparece
17.0s  Campo "Salario" se llena
18.5s  Checkmark + helper text
18.7s  Campo "EPS" se llena
19.0s  Texto beneficio aparece
19.5s  Checkmark verde
19.7s  Campo "Banco" se llena
20.5s  Checkmark verde
20.7s  Campo "Cuenta" se llena
21.5s  Checkmark verde
21.5s  Efecto de integración inicia
22.0s  Línea de conexión se dibuja
22.5s  Ícono nómina aparece
23.0s  ──────────────────────────────────────
23.0s  TOMA 5 inicia
23.5s  [VOZ] "Listo en minutos..."
23.5s  Texto "¡Listo en 3 minutos!" aparece
24.0s  Checkmark gigante se dibuja
24.5s  Confetti empieza a caer
25.0s  Texto "Cada uno con su acceso" aparece
26.0s  Avatares aparecen en secuencia
27.0s  Confetti termina
28.0s  Transición a CTA
28.0s  Texto "Pruébalo gratis" aparece
28.5s  Username aparece
30.0s  ──────────────────────────────────────
30.0s  FIN
```

---

## NOTAS TÉCNICAS

### Validaciones visuales a implementar:
1. Checkmarks aparecen solo DESPUÉS de que el campo se completa
2. Border de campos cambia a verde suavemente (0.2s transition)
3. Cada validación tiene micro-animación de bounce
4. Delay entre validaciones: 0.2-0.3s para ritmo claro

### Sincronización voz-animación:
- La voz guía, las animaciones confirman
- Palabras clave de la voz ("valida", "listo", "acceso propio") coinciden con animaciones visuales
- Pausas naturales en la voz = momentos de animación pura

### Elementos que deben sentirse "reales":
- Typing progresivo (no aparición instantánea)
- Formato automático de números (puntos en cédula/salario)
- Dropdown que abre y cierra
- Tap con feedback visual inmediato
- Transiciones de pantalla como en app real (slide, no cortes)

### Elementos que destacan "automático":
- Checkmarks que aparecen solos
- Formato que se aplica solo
- Validación instantánea
- Conexión con nómina (sin acción del usuario)

---

## DIFERENCIAS VS MÉTODO ANTIGUO (EXCEL)

| Aspecto | Excel | Zaturno |
|---|---|---|
| Tiempo | 20+ minutos | 3 minutos |
| Errores | Fórmulas rotas, typos | Validación automática |
| Organización | 20 hojas, buscar | Todo en un lugar |
| Actualización | Manual, se desactualiza | Tiempo real |
| Acceso | Solo admin ve Excel | Cada uno su acceso |
| Integración | Copiar/pegar | Conexión directa |
| Validación | Manual (después del error) | Instantánea (antes del error) |

Este contraste debe quedar claro visualmente en las tomas 1-2 y reforzarse con los textos de beneficio en cada paso.

---

**Versión:** 1.0  
**Fecha:** 2026-11-10  
**Próxima revisión:** Después de crear poses del perro y generar capturas
