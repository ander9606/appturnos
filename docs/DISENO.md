# Guía de diseño de Zaturno

> **Fuente de verdad para la interfaz.** Antes de tocar colores, carga, tipografía o componentes UI
> (móvil o web), lee este documento. Si cambias una regla, **actualízalo en el mismo PR**.
> Si el código y este documento no coinciden, es un bug de uno de los dos: corrígelo, no lo ignores.

Última revisión: 2026-10-19 · Alcance: `apps/mobile` (Expo) y `apps/web` (Vite/React).

---

## 1. Principios

1. **Un solo origen por decisión.** Cada color, radio o patrón de carga se define una vez y se *referencia*; nunca se copia.
2. **Naranja = marca.** `#FF5A3C` es lo que hace reconocible a Zaturno. Lo demás es neutro y semántico.
3. **Cargar con intención.** El usuario nunca debe ver una pantalla en blanco ni un spinner genérico (§5).
4. **Accesible por defecto.** Contraste, áreas táctiles ≥ 44 px y etiquetas para lectores de pantalla (§6).
5. **Móvil y web iguales.** Mismos nombres de token, mismos valores, mismo comportamiento.

---

## 2. Colores

### 2.1 Dónde viven (no dupliques)

| Plataforma | Archivo | Cómo se usa |
|---|---|---|
| Móvil, `className` | `apps/mobile/tailwind.config.js` | `bg-primary-500`, `text-muted-foreground`… |
| Móvil, JS (props/estilos) | `apps/mobile/lib/designTokens.ts` → `COLORS` | `color={COLORS.primary}` |
| Web | `apps/web/src/index.css` (`@theme`) | `bg-primary`, `text-success`… |

Los tres deben tener los mismos valores. Al añadir o cambiar un color, tócalos **todos**.

### 2.2 Paleta

| Token | Hex | Uso |
|---|---|---|
| `primary` (500) | `#FF5A3C` | Marca, botón principal, acento del módulo **Turnos** |
| `primary` 50 → 900 | `#FFF1EE` … `#7D1E0D` | Fondos suaves (50/100), hover/pressed (600), texto de marca (700) |
| `success` | `#059669` | Éxito, acento del módulo **Nómina** |
| `info` | `#3B82F6` | Información, acento de **Gestores** |
| `warning` | `#F59E0B` | Alertas, estrellas |
| `warning.dark` | `#D97706` | Íconos/texto grande de alerta sobre fondo claro |
| `danger` | `#EF4444` | Errores, acciones destructivas |
| `danger.dark` | `#DC2626` | Texto de error sobre fondo claro |
| `integracion` | `#6366F1` | Acento del módulo **logiq360** (`app/integracion/*`) |
| `background` / `card` / `muted` | `#F8FAFC` / `#FFFFFF` / `#F1F5F9` | Fondo de pantalla / tarjetas / zonas atenuadas |
| `foreground` | `#0F172A` | Texto principal |
| `muted-foreground` | `#64748B` | Texto secundario |
| `placeholder` *(solo JS)* | `#94A3B8` | Íconos inactivos, placeholders |
| `border` / `borderStrong` *(solo JS)* | `#E2E8F0` / `#CBD5E1` | Bordes / bordes marcados, controles deshabilitados |
| `white` *(solo JS)* | `#FFFFFF` | Contenido sobre fondos de color |

Cada semántico tiene variante `light` (fondo suave de alertas y badges): `success-light`, `warning-light`, `danger-light`, `info-light`, `integracion-light`.

**Tokens solo JS (móvil, `lib/designTokens.ts`)** — para estilos en línea (`style={{ … }}`), íconos y props de colores donde `className` no alcanza:

| Token | Hex | Uso |
|---|---|---|
| `muted` | `#F1F5F9` | Fondos atenuados, chips inactivos (igual que `bg-muted`) |
| `primaryLight`, `primary400`, `primary600` | `#FFF1EE`, `#FF7150`, `#E83E1F` | Escala de la marca (50, 400, 600) |
| `successLight`, `warningLight`, `dangerLight`, `infoLight` | `#D1FAE5`, `#FEF3C7`, `#FEE2E2`, `#DBEAFE` | Fondos suaves de badges y banners (igual que `bg-*-light`) |
| `successText`, `warningText`, `dangerText`, `infoText` | `#166534`, `#92400E`, `#991B1B`, `#1E3A8A` | Texto/íconos **fuertes sobre** esos fondos suaves: 6.3 · 6.4 · 6.8 · 8.5 : 1 (AA) |

En la **web** los mismos valores viven en `index.css` como `--color-success-text`, `--color-warning-text`, `--color-danger-text` y `--color-info-text` (clases `text-warning-text`…), y los colores de horas como `--color-hora-ordinaria`, `--color-hora-extra`, `--color-hora-extra-nocturna`, `--color-hora-nocturna`, `--color-hora-festivo` (= `HOUR_TYPE_COLORS`) y `--color-bonos` (= `ACCENT.violeta`).
| `infoBorder`, `warningSoft` | `#BFDBFE`, `#FCD34D` | Bordes suaves de aviso |
| `slate600`, `slate700` | `#475569`, `#334155` | Texto entre `foreground` y `muted-foreground` (7.6 y 10.4 : 1 sobre blanco) |
| `eventual` | `#7C3AED` | Acento de los **turnos eventuales** (5.7 : 1 sobre blanco) |
| `shadow` | `#000000` | `shadowColor` de todas las sombras |

**`ACCENT`** — acentos *categóricos*: distinguen categorías (rol, tipo de día, nivel de ranking), no significan éxito ni error. `violeta` (compensatorio, rol de nómina, ranking elite), `rosa`, `esmeralda`, `naranja`, `amarillo`, `indigo`. Para estados usa los semánticos de arriba.

**`DOCUMENT_COLORS`** — el look de "papel" de las pantallas de contrato y cuenta de cobro (`canvas`, `paper`, `infoBg`, `infoIcon`, `warningBg`), que comparten valores.

**`THIRD_PARTY`** — colores de marcas ajenas que se usan tal cual (`google`).

**`alpha(color, opacidad)`** — color con transparencia: `alpha(COLORS.danger, 0.1)` es un fondo rojo al 10 %. Solo acepta `#RRGGBB` (los tokens); con otro formato devuelve el color sin cambios.

### 2.3 Color por módulo

| Módulo | Acento | Token |
|---|---|---|
| Turnos | Naranja | `THEME_COLORS.turnos` |
| Nómina | Verde | `THEME_COLORS.nomina` |
| Gestores | Azul | `THEME_COLORS.gestores` |
| Integración (logiq360) | Índigo | `COLORS.integracion` |
| Turnos eventuales | Violeta | `COLORS.eventual` |

En móvil, `const theme = useTheme()` (de `lib/theme.ts`) devuelve la paleta según el rol del usuario: usa `theme.primary` en vez de `COLORS.primary` en pantallas que cambian de color por módulo.

### 2.4 Reglas

- **Prohibido el hex literal** en pantallas y componentes. En `className` usa el token Tailwind; en JS usa `COLORS.*`, `ACCENT.*` o `alpha()`. **En móvil lo impide el lint** (`no-restricted-syntax`): un `'#ABCDEF'` nuevo es un error. Solo se permite en `lib/designTokens.ts` y en las pruebas.
  ```tsx
  <Ionicons name="pin-outline" color={COLORS.mutedForeground} />   // ✅
  <Ionicons name="pin-outline" color="#64748B" />                  // ❌ error de lint
  ```
- **¿Falta un color?** No lo inventes en la pantalla: agrégalo a `lib/designTokens.ts` (y, si se usa en `className`, a `tailwind.config.js` e `index.css`) y a la tabla de §2.2. Si es una categoría y no un estado, va en `ACCENT`.
- **Transparencias:** `alpha(COLORS.x, 0.1)` en JS; en `className`, `bg-primary/10`. **No** armes el alfa pegando texto (`color + '18'`, `` `${color}20` ``): `alpha()` lo hace bien y se puede buscar.
- **Texto sobre fondo suave:** usa el `*Text` de ese semántico (`warningText` sobre `warningLight`…), no el color principal (no pasa AA, §6).
- **Web:** en la app, los colores en línea van como variables CSS (`'var(--color-primary)'`, `'var(--color-info)'`), que también funcionan en atributos SVG y en estilos de Leaflet. La **landing** (`src/pages/landing/`) es la excepción: dibuja una maqueta del teléfono con su propia paleta y degradados de marketing, y usa hex.
- **Avatares:** paleta fija `AVATAR_COLORS` (mismo id → mismo color).
- **Gráficos de horas:** `HOUR_TYPE_COLORS` (validada contra daltonismo; no cambiar sin revalidar).
- Al unificar valores sueltos con su token, algunos tonos se acercaron (los verdes `#22C55E`/`#16A34A` → `success`, los celestes `#0284C7`/`#0EA5E9` → `info`, `#B45309` → `warningText`): si una pantalla pierde legibilidad o identidad, se corrige en el token, no con un hex en la pantalla.

---

## 3. Tipografía

**Inter** en web y móvil, cargada de verdad (no depende de la fuente del dispositivo).

| | Web | Móvil |
|---|---|---|
| Fuente | `@fontsource-variable/inter` (variable, solo se descarga el subconjunto que se usa: latino ≈ 48 kB, cubre tildes y ñ) | `@expo-google-fonts/inter`: 400, 500, 600, 700 y 800 (≈ 1.7 MB en la app) |
| Dónde se carga | `import '@fontsource-variable/inter'` en `src/main.tsx`; token `--font-family-sans` en `index.css` | `useFonts` en `app/_layout.tsx` (la pantalla de arranque se retiene hasta que esté lista) |
| Cómo se usa | Normal: `font-semibold`, `font-bold`… | **Importa `Text` y `TextInput` de `@/components/ui/Text`**, nunca de `react-native` (lo impide el lint) |

**Por qué el `Text` propio en móvil:** en React Native cada peso de una fuente personalizada es una familia distinta (`Inter_600SemiBold`), no un `fontWeight`. `components/ui/Text.tsx` traduce `font-semibold` o `fontWeight: '600'` a la familia correcta (lógica en `lib/tipografia.ts`, con pruebas) y fuerza `fontWeight: 'normal'` para que Android no duplique la negrita. Si un estilo trae su propia `fontFamily`, se respeta.

| Clase | Peso | Familia móvil |
|---|---|---|
| *(sin clase)* / `font-normal` | 400 | `Inter_400Regular` |
| `font-medium` | 500 | `Inter_500Medium` |
| `font-semibold` | 600 | `Inter_600SemiBold` |
| `font-bold` | 700 | `Inter_700Bold` |
| `font-extrabold` | 800 | `Inter_800ExtraBold` |

- Fuera de `Text` (títulos de cabecera, etiquetas de pestañas, `Alert` nativo) la fuente se pone con `fontFamily: INTER[600]` (de `lib/tipografia.ts`), no con `fontWeight`.
- Si necesitas otro peso (300, 900), agrégalo en tres sitios: la tabla `INTER` de `lib/tipografia.ts`, el `useFonts` de `app/_layout.tsx` y esta tabla.
- Texto de cuerpo: `text-base`; secundario: `text-sm text-muted-foreground`; títulos: `font-semibold`/`font-bold`. No fijar tamaños en px sueltos; usar la escala de Tailwind.
- **Interlineado ≥ 1.25× el tamaño.** Inter mide 1.21× de alto natural (Roboto 1.17, San Francisco 1.19): un interlineado menor recorta tildes, emojis y números grandes en Android. Los tamaños `text-3xl` en adelante traían 1.2 → 1.0 en Tailwind, así que se redefinieron en `tailwind.config.js` (`fontSize`), y `lib/__tests__/tailwindFontSize.test.ts` falla si algún tamaño baja de 1.25.
- Si escribes un `lineHeight` a mano (estilo inline), que sea ≥ 1.25 × su `fontSize` (14 px → mínimo 18). Si no pones `lineHeight`, se usa el natural y es seguro.
- Una caja de **altura fija** con texto dentro debe medir al menos el interlineado del texto (`text-sm` = 20 px, `text-base` = 24 px); mejor `min-h-*` que `h-*`.
- Un texto que no pase por `Text` (librerías de terceros, texto nativo del sistema) seguirá en la fuente del dispositivo: es esperado.

## 4. Forma y espaciado

- Radios: `rounded-lg` (12) en controles, `rounded-xl` (16) en botones y tarjetas pequeñas, `rounded-2xl` (20) en tarjetas, `rounded-full` en avatares y badges.
- Tarjeta estándar: `bg-card rounded-2xl border border-border p-4`.
- Separación entre tarjetas de una lista: `gap-3`.
- Botones: usar siempre `Button` (móvil, `components/ui/Button.tsx`); no reconstruirlos con `TouchableOpacity`.

---

## 5. Estados de carga, de error y vacíos

Hay **tres** herramientas. Elige según qué estás esperando:

| Situación | Usa | Por qué |
|---|---|---|
| Esperas una **lista o tarjetas** (equipo, turnos, ofertas) | **`SkeletonList`** | Muestra la forma del contenido; evita el salto de layout |
| Una **acción** (guardar, enviar, descargar) | **`Spinner` pequeño dentro del botón** | El usuario ve que *su* acción está en curso |
| **Pantalla o sección completa** sin forma conocida | **`Spinner` grande** (móvil) / **`PageLoading`** (web) | No hay un layout que imitar |

Regla corta: *si hay una lista, skeleton; si es una acción, spinner en el botón; si no, spinner centrado.*

### 5.1 Spinner

Anillo tenue + arco que gira, naranja por defecto. Reemplaza a `ActivityIndicator` (**no usar `ActivityIndicator` directamente**).

| | Móvil | Web |
|---|---|---|
| Archivo | `apps/mobile/components/ui/Spinner.tsx` | `apps/web/src/shared/components/Spinner.tsx` |
| Import | `import { Spinner } from '@/components/ui/Spinner'` | `import { Spinner, PageLoading } from '@/shared/components/Spinner'` |
| Props | `size` (`'small'` 20 px · `'large'` 36 px · número), `color`, `style` | `size` (px), `className` |
| Color | `color` (por defecto `COLORS.primary`; `theme.primary` por módulo) | Hereda `currentColor`: ponle `text-primary`, o déjalo y toma el del botón |

```tsx
// Móvil
<Spinner size="large" color={theme.primary} />
<Spinner color={COLORS.white} />            // dentro de un botón de color

// Web
<PageLoading />                              // sección completa
<button disabled>{guardando ? <Spinner size={14} /> : 'Guardar'}</button>
```

`Button` (móvil) ya muestra el spinner con `loading`; no pongas uno aparte.
Tiempo de giro: 800 ms por vuelta, lineal. Animado con el `Animated` nativo de React Native (`useNativeDriver`), sin dependencias extra.

### 5.2 Skeleton

Bloques grises que laten (opacidad 100 % ↔ 45 %, 1.4 s) en el lugar del contenido. **Elige el que se parezca a lo que va a aparecer**, para que no haya saltos de diseño al cargar:

| Cuando carga… | Móvil | Web |
|---|---|---|
| Una **lista de tarjetas** (equipo, notificaciones, contratos) | `SkeletonList` | `SkeletonList` |
| Una **tabla** (turnos, períodos, eventos) | — (en móvil las tablas son listas) | `SkeletonTable` |
| Una **pantalla de detalle o ficha** (trabajador, turno, contrato, formularios) | `SkeletonDetail` | `SkeletonDetail` |
| Un **panel de métricas** (reportes, dashboard, liquidación) | `SkeletonStats` | `SkeletonStats` |
| Una forma propia | `Skeleton` (bloque suelto) | `Skeleton` |

| | Móvil | Web |
|---|---|---|
| Archivo | `apps/mobile/components/ui/Skeleton.tsx` | `apps/web/src/shared/components/Skeleton.tsx` |

```tsx
{isLoading ? <SkeletonList count={6} /> : isError ? <ErrorState …/> : <Lista …/>}
if (isLoading) return <SkeletonDetail />;                  // pantalla completa (web)
<SkeletonDetail style={{ paddingHorizontal: 16, paddingTop: 12 }} />   // pantalla completa (móvil)
```

- **`Skeleton`**: bloque suelto (móvil: `width`, `height`, `radius`, `'full'` = círculo; web: clases de Tailwind) para armar formas propias.
- **`SkeletonCard`** / **`SkeletonList`**: tarjeta genérica avatar + 2 líneas + etiqueta. Si una lista tiene otra forma, crea un skeleton propio con `Skeleton` en vez de forzar la genérica.
- **Pantallas completas en móvil**: el skeleton va dentro del mismo contenedor (`SafeAreaView`) **sin** `items-center justify-center` (eso es para spinners centrados); se le pasa `style={{ paddingHorizontal: 16, paddingTop: 12 }}`. Dentro de una lista que ya tiene su padding, `<SkeletonList count={3} />` sin estilo.
- **Se queda el `Spinner`** (no skeleton) en: botones y acciones en curso, cargas pequeñas en línea (un selector, la ubicación, un historial dentro de una tarjeta) y cuando no se conoce la forma del resultado.
- En móvil todos los skeletons comparten un solo pulso (laten juntos) y la animación se apaga sola cuando no hay ninguno montado.
- Todos llevan etiqueta "Cargando" para lectores de pantalla y ocultan sus bloques.

### 5.3 Reglas de carga

1. Si hay estado de error, el orden es siempre: **cargando → error (con "Reintentar") → vacío → contenido**.
2. Una acción en curso **bloquea el doble toque** (`Button` ya lo hace con `onPress` asíncrono).
3. No pongas texto "Cargando…" suelto: usa `PageLoading` (web) o `Spinner` (móvil), que ya llevan etiqueta de accesibilidad.
4. No uses spinner a pantalla completa cuando ya hay datos en caché y solo refrescas: usa `RefreshControl` (móvil) o deja el contenido visible.

### 5.4 Estados de error

El **planeta del logo con el anillo fuera de lugar** es la cara de los errores de Zaturno (el nombre suena a Saturno: perder la conexión = perder el anillo; el texto no hace el chiste, la ilustración sí). Hay tres casos, elegidos automáticamente según el error:

| Tipo | Cuándo | Ilustración | Texto |
|---|---|---|---|
| `offline` | Sin red: `fetch` lanza `TypeError("Network request failed")` (móvil) / axios sin `response` o `navigator.onLine === false` (web) | **Anillo caído** en el suelo | "Sin conexión — No tienes conexión a internet…" |
| `server` | El backend respondió 5xx | **Anillo torcido y roto**, con chispas | "Algo se torció — Tuvimos un problema de nuestro lado…" |
| `generic` | 4xx u otro | Anillo torcido | "No pudimos cargar esto" + **mensaje real del backend** |

| | Móvil | Web |
|---|---|---|
| Componente | `components/ui/ErrorState.tsx` | `shared/components/ErrorState.tsx` |
| Dibujo | `components/ui/PlanetIllustration.tsx` (react-native-svg) | `shared/components/PlanetIllustration.tsx` |
| Clasificación | `errorKind()` en `lib/apiErrorMessage.ts` (con prueba en `lib/__tests__/apiErrorMessage.test.ts`) | `errorKind()` dentro del componente |
| Textos | `errors.*` en `lib/i18n/es-CO.json` | `COPY` en el componente |

```tsx
// Móvil
{isLoading ? <SkeletonList /> : isError ? <ErrorState error={error} onRetry={refetch} fallback="Error al cargar turnos" /> : <Lista />}
<ErrorState compact … />   // dentro de una tarjeta o sección, sin ocupar toda la pantalla

// Web
{isError ? <ErrorState error={error} onRetry={refetch} /> : …}
```

- **Prohibido** armar bloques de error a mano (ícono `warning-outline` + "Error al cargar" + "Reintentar"): usa `ErrorState`, que ya trae reintento con spinner, `role="alert"` y la ilustración oculta a lectores de pantalla.
- Pasa siempre `error` (no solo `isError`): sin él no se puede distinguir "sin internet" de "falló el servidor".
- Los dos `PlanetIllustration` (móvil y web) dibujan lo mismo con las mismas coordenadas: si cambias uno, cambia el otro.
- Aviso global (móvil, `StatusBanner`): barra **oscura** "Sin conexión · solo verás lo que ya abriste" (17:1; el caché vive en memoria, no se guarda en el teléfono) o **rojo oscuro** "No pudimos cargar todo" (4.8:1). Nunca blanco sobre ámbar (2.15:1).
- `ErrorBoundary` (error inesperado de código) usa el anillo torcido con el título "Algo se torció".

### 5.5 Avisos, confirmaciones y toasts (móvil)

**Prohibido `Alert.alert` nativo** (se ve distinto en iOS y Android y no lleva la marca). Hay tres herramientas propias, montadas una sola vez en `app/_layout.tsx`:

| Necesitas… | Usa | Archivo | Ejemplo |
|---|---|---|---|
| Avisar algo que el usuario **debe leer** (error de una acción, dato faltante) | `showAlert(título, mensaje, tipo)` | `lib/alertDialog.ts` | `showAlert('Campo requerido', 'El email es obligatorio.', 'warning')` |
| **Preguntar** (cancelar / confirmar) | `confirm({…})` → `Promise<boolean>` | `lib/confirmDialog.ts` | `if (await confirm({ title, destructive: true })) …` |
| Feedback **breve y no bloqueante** | `showToast(mensaje, tipo)` | `lib/toast.ts` | `showToast('Turno confirmado')` |
| Elegir entre **3 o más opciones** (menú desde abajo) | `actionSheet({…})` → `key` o `null` | `lib/actionSheet.ts` | `await actionSheet({ title: 'Foto', items: [{ key: 'camara', label: 'Tomar foto', icon: 'camera-outline' }] })` |
| Elegir/quitar una **foto** (cámara, galería) | `elegirFotoConMenu({ title, quitarLabel? })` | `lib/pickImage.ts` | `const b64 = await elegirFotoConMenu({ title: 'Logo', quitarLabel: 'Quitar logo' })` |
| Feedback con **acción** y cuenta atrás ("Deshacer") | `actionToast()` | `lib/actionToast.ts` | — |

**Tipos** (`FeedbackVariant`, definidos en `components/ui/feedback.ts`; el ícono va en un círculo de color suave):

| Tipo | Cuándo | Ícono / color |
|---|---|---|
| `error` *(por defecto)* | Falló algo: "Error", "No se pudo…" | `alert-circle` · rojo |
| `warning` | Falta o está mal un dato: "Campo requerido", "Fecha inválida", "Permiso requerido" | `warning` · ámbar oscuro |
| `info` | Información que no es culpa de nadie: "Muy pronto" | `information-circle` · azul |
| `success` | Salió bien: "Solicitud enviada" | `checkmark-circle` · verde |

- `confirm({ destructive: true })` pinta el botón de rojo y usa el ícono de papelera: **para acciones irreversibles** (eliminar, rechazar, dejar de sumar recargos).
- `confirm({ variant: 'warning' })` cambia la papelera por el ícono del tipo (ámbar para advertencias con consecuencia, p. ej. cancelar un turno con penalización); `destructive` sigue pintando solo el botón de rojo.
- `confirm` para elegir entre dos caminos también vale: `confirmLabel`/`cancelLabel` permiten textos como "Ver detalle" / "Volver a lista".
- Un error de una **acción del usuario** va en `showAlert`; el feedback de que algo **salió bien** va en `showToast`. No pongas un diálogo para un éxito.
- Todos llevan `accessibilityRole` (`alert`/`header`) y los diálogos `accessibilityViewIsModal`. Texto, ícono y tipo siempre juntos: nunca solo color.
- `actionSheet`: cada opción lleva ícono en círculo (naranja suave; `destructive: true` → rojo) y el botón "Cancelar" va siempre abajo. Resuelve `null` si se cancela o se toca fuera. `message` sirve para avisos con acciones ("Revisa tu turno" + "Ir a Mi plan").
- `elegirFotoConMenu` resuelve `string` (base64) si eligió imagen, `null` si eligió quitarla y `undefined` si canceló o no dio permiso: `if (r !== undefined) subir(r)` cubre los tres casos. Reutilízalo en vez de repetir el flujo de `expo-image-picker`.
- Los diálogos comparten el marco `components/ui/DialogCard.tsx` (fondo oscuro + tarjeta con entrada de resorte).

**Sin excepciones:** ya no queda ningún `Alert.alert` nativo en la app. Se comprobó en iPhone que el diálogo del layout raíz aparece sobre un `Modal` abierto, así que `showAlert`, `confirm` y `actionSheet` se usan también dentro de modales. Los avisos de 3+ botones usan `actionSheet`.

### 5.6 Estados vacíos

El mismo planeta del logo, pero con el **anillo en su órbita** (en los errores aparece caído o torcido). Hay tres tipos:

| `variant` | Cuándo | Ilustración | Ejemplo |
|---|---|---|---|
| `empty` *(por defecto)* | Nada todavía: aún no hay datos | Planeta sereno en órbita | "Sin trabajadores", "Sin notificaciones" |
| `search` | Una búsqueda o filtro no devolvió nada | Planeta con **lupa** | "Sin resultados", "Sin resultados para este filtro" |
| `done` | No queda nada por hacer: todo al día | Planeta con **visto verde** | "Sin solicitudes pendientes", "Ya firmaste todos tus contratos" |

| | Móvil | Web |
|---|---|---|
| Componente | `components/ui/EmptyState.tsx` | `shared/components/EmptyState.tsx` |
| Dibujo | `PlanetIllustration` (`orbit`, `search`, `done`) | `PlanetIllustration` (igual) |
| Props | `title`, `message?`, `variant?`, `action?: { label, onPress }`, `compact?` | `title`, `message?`, `variant?`, `action?: { label, onClick }` |

```tsx
// Móvil: como ListEmptyComponent, o en lugar de la lista
<FlatList ListEmptyComponent={<EmptyState title="Sin trabajadores" message="Agrega al primero con el botón +." />} … />
<EmptyState variant={term ? 'search' : 'empty'} title={term ? 'Sin resultados' : 'Sin trabajadores'} />
<EmptyState compact title="Sin cargos" />      // selectores, modales y tarjetas pequeñas

// Web
<EmptyState title="No hay ofertas" action={{ label: '+ Crear la primera', onClick: abrirCrear }} />
```

- **Elige el tipo por lo que le pasó al usuario**, no por la pantalla: la misma lista es `search` cuando hay texto de búsqueda y `empty` cuando no.
- **`title` corto y en afirmativo** ("Sin turnos este día"); **`message`** dice qué hará aparecer datos ("Cuando completes turnos, aparecerán aquí…") o qué hacer. Si no aporta nada nuevo, omítelo.
- **`action`** solo si el usuario puede resolverlo desde ahí (y tiene permiso); un vacío sin salida lleva solo texto.
- `compact` para listas pequeñas (selectores en `Modal`, tarjetas): ilustración de 110 px en vez de 170.
- El vacío va **después** de cargando y de error: `cargando → error → vacío → contenido` (§5.3).
- Los dos `PlanetIllustration` dibujan lo mismo con las mismas coordenadas: si cambias uno, cambia el otro.

### 5.7 Movimiento

La marca se mueve poco y con intención. Referencia: el hero de la bienvenida (`app/(auth)/index.tsx`): el planeta **entra** (escalado de 0.85 a 1 y aparición, 0.7 s), **flota** (±4 px, 2.2 s por sentido) y sus **órbitas se mecen** (±2.5°, 5 s por sentido).

- **Sutil y lento.** Amplitudes de pocos píxeles o grados y duraciones de segundos; nada que compita con el contenido ni con la acción principal. Las animaciones de entrada duran menos de 1 s.
- **Solo `transform` y `opacity`**, con `useNativeDriver: true`: corren en el hilo nativo y no bloquean la interfaz. Se usa el `Animated` de React Native (sin dependencias extra).
- **Suavizado `Easing.inOut(Easing.sin)`** para vaivenes (sin saltos en los extremos) y `Easing.out(Easing.cubic)` para entradas.
- **Respeta "reducir movimiento"** (`AccessibilityInfo.isReduceMotionEnabled` + el evento `reduceMotionChanged`): con él activado no hay bucles ni entradas, y el contenido aparece ya visible. Si el sistema no responde en 400 ms se asume "sin reducir", para no dejar nada invisible.
- **Los bucles se detienen al desmontar** (`loop.stop()` en el cleanup del efecto).
- **Nunca solo con movimiento:** lo que se anima es decorativo; la información y las acciones no dependen de la animación.

---

### 5.8 Reportes y paneles de métricas

Referencia móvil: `app/reportes.tsx` y `features/reportes/` (`marca.tsx`). Referencia web: `modules/reportes/` (`ReportesPage.tsx`, `components/`): mismo lenguaje y mismos datos, con pestañas **Turnos | Nómina** en vez de deslizar, cuadrícula de 2–3 columnas en escritorio y el encabezado como tarjeta redondeada (no a sangre). Los colores van como variables CSS (`var(--color-hora-extra)`), no como hex.

- **Encabezado de marca** (`HeroMarca`): degradado `primary` → `primary-600`, órbitas finas y el planeta del logo tenue a la derecha; la cabecera de navegación va en `primary` con texto blanco (`headerShadowVisible: false`) para que se funda con él. Es decorativo y estático (sin animación). En él van el título del período y el selector (chips: el activo en blanco con `text-primary-700`, los demás `alpha(white, 0.2)` con texto blanco en negrita).
- **Páginas que se deslizan** (`ReportePager`): Turnos y Nómina son dos páginas con scroll vertical propio; se cambia de una a otra deslizando de lado o tocando las pestañas (ícono + nombre, subrayado en el color del módulo). El encabezado y el período quedan fijos arriba. Quien solo ve una sección (jefe de turnos) ve una sola página, sin pestañas. Es un `ScrollView` horizontal con `pagingEnabled`, sin dependencias.
- **Acento por módulo** (§2.3): la sección **Turnos** usa naranja (`THEME_COLORS.turnos`) y **Nómina** verde (`THEME_COLORS.nomina`): ícono, línea bajo el título y órbita de la tarjeta de costo. Turnos y nómina **no se mezclan**: cada una tiene su costo, desglose, personas y avisos.
- **Cifra protagonista**: el costo va en `text-4xl font-extrabold`; la variación contra el período anterior es un chip (sube = ámbar, baja = verde, igual = azul) con ícono y texto.
- **Anillo de progreso** (`AnilloProgreso`) para porcentajes con meta (cobertura de plazas): verde desde 90 %, ámbar desde 75 %, rojo por debajo; el valor va siempre escrito al centro.
- **Desglose de costos**: nómina reutiliza `HOUR_TYPE_COLORS` (los mismos del gráfico de horas de Nómina); turnos usa la marca.
- **Calificaciones** (0 a 5): estrella `warning` + promedio (`4,1`), con la variación contra el período anterior (aquí **subir es bueno**: verde; bajar es aviso ámbar, al revés que el costo), distribución por estrellas con barras y lo que falta calificar. En las filas de personas, la estrella con su promedio en pequeño.
- **Avisos** ("Para mirar"): ver §6, fondo `*Light` + texto `*Text` + ícono. **Vacíos**: `EmptyState compact` por sección, no ceros.

---

### 5.9 Correos y PDFs

- **Correos:** todos pasan por `backend/utils/plantillaCorreo.js` (`plantillaCorreo`, `bloqueCodigo`, `tablaDatos`): cabecera naranja `#FF5A3C`, tarjeta blanca, botón naranja. Los correos no pueden usar tokens (van en HTML con estilos en línea), así que los hex viven solo ahí. Todo dato de usuario se escapa con `esc()`.
- **PDFs de pdfkit** (contrato, cuenta de cobro, comprobante): `piePdfMarca(doc)` de `backend/utils/marcaPdf.js` antes de `doc.end()` — logo gris (`backend/assets/logo-gris.png`) + "Generado por Zaturno" en gris, centrado al pie de la última página. Sin franjas ni color: el documento es del trabajador y la empresa, no publicidad.
- **PDF de reglas de pago:** `scripts/generar-pdf-reglas.js` usa la familia de marca (`#FF5A3C`, `#FFF1EE`, `#C32D14`); regenerar el PDF al cambiarlo.
- Deuda: los correos usan wordmark de texto; para el logo real necesitan una URL pública (`EMAIL_LOGO_URL`).

### 5.10 Encabezado de las pestañas (móvil)

Cada perfil tiene su color (`THEME_COLORS` vía `useTheme()`): trabajador de turnos **naranja**, trabajador de nómina **verde**, gestores **azul**. Todas las pestañas (Inicio, Turnos, Nómina, Equipo, Empresas, Perfil) abren con una franja de ese color, esquinas inferiores redondeadas y texto blanco.
- `PantallaPestana` (`components/ui/EncabezadoPestana.tsx`) es la raíz de la pestaña: pinta de ese color la zona de la barra de estado (iconos claros) y deja el fondo normal debajo.
- `EncabezadoPestana` es la franja: `titulo`, `subtitulo`, `derecha` (acción, icono blanco) y `children` (tarjetas o pestañas internas, sobre fondo `white/18`; las pestañas internas usan subrayado blanco).
- No usar `bg-card`/texto oscuro para el título de una pestaña, ni hex: el color sale siempre del perfil.
- Las pantallas de detalle (`turno/[id]`, `trabajador/[id]`…) conservan su encabezado blanco con flecha atrás.

### 5.11 Calendarios (móvil)

Los tres usan el color del perfil (`useTheme()`), nunca un color fijo:
- `MonthCalendar` (`components/ui/MonthCalendar.tsx`): tarjeta `rounded-3xl`; cabecera de días tintada (`alpha(primary, .1)`), sábado y domingo en el color del perfil; el día de hoy con círculo sólido y celda tintada.
- `NavegadorMes` (`components/ui/NavegadorMes.tsx`): ‹ Mes Año › con botones tintados y un botón "Hoy" (solo si no se ve el mes actual). Es el único selector de mes: no copiar los chevrons a mano.
- Deslizar el calendario a derecha o izquierda cambia de mes (`onMesAnterior`/`onMesSiguiente` de `MonthCalendar`, con `PanResponder`: solo toma gestos claramente horizontales).
- En Turnos, tocar un día lo **marca** (`selectedDate`) y muestra debajo `ResumenDiaMes` con los turnos de ese día y "Ver en lista"; ya no salta de vista.
- Mientras carga el mes: `SkeletonCalendario`, no una lista.
- **Festivos:** `MonthCalendar` marca los festivos de Colombia (número en el color del perfil + bandera) y `ResumenDiaMes` los nombra. Salen de `festivosColombia()` / `nombreFestivo()` de `@api-client`, espejo de `festivosDeAnio()` del backend (la prueba `festivos.test.ts` exige que coincidan). Los domingos no se marcan: ya llevan el color en la cabecera.
- **Períodos de nómina:** el gestor ve cada período como franja bajo los días (verde abierto, ámbar cerrado por pagar, primario pagado), con el período que está mirando a todo color y los demás atenuados, el día de cierre rotulado y una leyenda. El trabajador de nómina ve una franja fina del color del perfil en los días de su período actual y "Cierre" en el último.
- `WeekStrip` (`features/turnos/WeekStrip.tsx`): día seleccionado sólido, hoy con aro suave, rayita en los días con turnos.
- Pendiente: los selectores de fecha nativos (`DateTimePicker`) los dibuja el sistema; en iOS se puede darles `accentColor`, en Android dependen del tema nativo del build (no cambia por OTA).

## 6. Accesibilidad

Contraste medido (WCAG: 4.5:1 texto normal, 3:1 texto grande ≥ 18 px o ≥ 14 px en negrita, y elementos gráficos):

| Combinación | Ratio | Veredicto |
|---|---|---|
| Blanco sobre `primary` `#FF5A3C` | **3.10** | ⚠️ Solo texto grande/negrita (botones `font-semibold` ok) |
| Blanco sobre `primary-600` `#E83E1F` | 4.09 | Casi AA |
| Blanco sobre `primary-700` `#C32D14` | 5.67 | ✅ AA |
| `primary-700` sobre blanco | 5.67 | ✅ Para texto pequeño de marca usa 700 |
| Blanco sobre `success` / `info` / `danger` | 3.77 / 3.68 / 3.76 | ⚠️ Solo texto grande/negrita |
| Blanco sobre `success700` `#047857` / `info600` `#2563EB` | 5.48 / 5.17 | ✅ AA — son el color del perfil de nómina y de gestores (`THEME_COLORS`) |
| Blanco sobre `warning` `#F59E0B` | **2.15** | ❌ No poner texto blanco sobre ámbar; usa texto oscuro |
| `warning.dark` sobre blanco | 3.19 | ⚠️ Íconos y texto grande |
| `danger.dark` sobre blanco | 4.83 | ✅ AA |
| `muted-foreground` sobre `background` | 4.55 | ✅ AA |
| `placeholder` `#94A3B8` sobre blanco | **2.56** | ❌ Solo íconos decorativos, nunca texto que se deba leer |
| `foreground` sobre `background` | 17.06 | ✅ |

Reglas:
- Texto pequeño sobre color de marca → `primary-700`. Texto blanco sobre `primary-500` solo en botones en negrita.
- Áreas táctiles ≥ 44 × 44 px (el botón `md` ya cumple: 48 px).
- Todo spinner/skeleton lleva `accessibilityRole="progressbar"` (móvil) o `role="status"` (web) con etiqueta "Cargando". Ya incluido en los componentes.
- El foco por teclado en web es global (`:focus-visible` en `index.css`): no lo anules.
- La información nunca va *solo* en color (añade ícono o texto).
- Semáforos de avisos (p. ej. "Para mirar" en reportes, `features/reportes/ResumenPeriodo.tsx`): fondo `*Light` + texto `*Text` + ícono propio por nivel (alerta/aviso/info/ok). Una variación de costo que **sube** es aviso (ámbar), no "positivo".

---

## 7. Checklist antes de abrir un PR de UI

- [ ] Sin hex literales nuevos (móvil: lo comprueba el lint; web: busca `#[0-9A-Fa-f]{6}` en lo que tocaste).
- [ ] Si agregaste un color: está en `tailwind.config.js`, `designTokens.ts`, `index.css` **y** en §2.2.
- [ ] Sin `ActivityIndicator`, `Loader2`, texto "Cargando…", bloques de error armados a mano ni `Alert.alert` nuevos (§5.5).
- [ ] Listas: skeleton al cargar, `ErrorState` (pasando `error`) con reintento, `EmptyState` (tipo según el caso) si no hay datos.
- [ ] Texto pequeño cumple contraste (§6).
- [ ] Strings visibles por `t('clave')` en móvil; `Text`/`TextInput` de `@/components/ui/Text` (§3).
- [ ] Móvil: `npm run type-check` y `npm run lint`. Web: `npm run build`.
- [ ] Si cambiaste una regla de este documento, está actualizada aquí.

---

## 8. Deuda conocida (próximos pasos, por orden de impacto)

1. **Probar Inter en dispositivo (iOS y Android).** Se verificó que la app empaqueta las cinco fuentes, que el código compila y que ningún interlineado baja de 1.25×, pero no se vio en pantalla: revisar que no haya texto cortado (sobre todo números grandes y emojis en Android), que la negrita de Android no salga doble y que el arranque no parpadee.
2. **Hex en la web.** Resuelto: `apps/web/.eslintrc.cjs` prohíbe hex literales (excepto la landing) y corre en el CI de la web (`npm run lint`).
3. **Skeletons restantes.** Quedan con `PageLoading` el calendario de web (`CalendarioPage`) y con `Spinner` las cargas pequeñas en línea (selectores, ubicación, historiales dentro de tarjetas), cuyo resultado no tiene una forma fija. (El calendario mensual ya tiene el suyo: `SkeletonCalendario`.)
4. **Contraste del naranja.** Verde y azul del perfil ya pasan AA con texto blanco (`success700` 5,48:1, `info600` 5,17:1). El naranja de marca (`primary` #FF5A3C) queda en 3,10:1 con blanco: solo es válido para texto grande en negrita (títulos, botones); no usarlo con texto pequeño blanco. Alternativa evaluada: `primary600` (4,09:1) o texto oscuro (5,76:1).
5. **Modo oscuro.** `userInterfaceStyle: "light"` fijo. Con los tokens ya centralizados, es viable como etapa propia.
6. **Íconos.** Web usa `lucide-react`, móvil usa `Ionicons`. Unificar estilo (grosor, tamaño) o elegir un solo set.
7. **Identidad propia.** Definir 3-4 rasgos distintivos (forma recurrente, sombra, ilustración para estados vacíos) y documentarlos en esta guía.
8. **Spinner a nivel de marca.** Hecho con `PlanetaCargando` (planeta con el anillo balanceándose, `Animated` + SVG) en la pantalla de arranque mientras se restaura la sesión. Pendiente para el próximo build nativo: pasarlo a Lottie (`lottie-react-native`) y usarlo también en el splash nativo.
9. **`ErrorState` en el resto de pantallas.** Resuelto: móvil lo usa en todas las listas y pantallas de carga; en `empresa/[id]`, `contrato/[id]` y `cuenta-cobro/[id]` el 404 muestra `EmptyState` "no encontrado" y cualquier otro error muestra `ErrorState` con reintento (`isNotFound`). Web: el componente ya es de marca.
10. **Ilustración sin probar en dispositivo.** El dibujo móvil usa `react-native-svg` con las mismas coordenadas que la web (verificada en Chromium); falta revisarlo en Expo Go.
11. **Más ilustraciones de marca.** Hecho en la web: el 404 y los vacíos de página completa usan el planeta. Falta móvil (sin turnos, sin equipo) donde aún haya texto suelto.
12. **Probar `actionSheet` sobre un `Modal` en Android.** En iPhone se verificó que los diálogos aparecen sobre un `Modal`; falta repetirlo en Android.
13. **`ActionToast`** conserva su look anterior: darle el mismo ícono y animación que `Toast`.
14. **Test pendiente no relacionado:** `features/turnos/__tests__/turnosUtils.test.ts › getWeekDays › marca correctamente el día de hoy` falla (depende de la fecha). Pre-existente.

16. **Sin datos guardados en el teléfono.** El caché de TanStack Query vive solo en memoria: al reabrir la app sin internet no hay turnos que mostrar (sale `ErrorState` sin conexión). Persistirlo requiere `@react-native-async-storage/async-storage` (módulo nativo: build nuevo, no OTA) y decidir qué datos se guardan sin cifrar (propuesta: solo turnos, borrado al cerrar sesión, caducidad de 24 h).
---
15. **`EmptyState` en el resto de pantallas.** Móvil: ya está en todas las listas con `ListEmptyComponent`; quedan textos "Sin…/No hay…" sueltos dentro de tarjetas y secciones (p. ej. "Sin calificaciones aún", "Sin punto asignado", "Sin datos bancarios registrados"). Web: los vacíos de página completa ya usan `EmptyState`; quedan textos grises dentro de celdas de tabla y tarjetas pequeñas ("Sin cargos", "Sin gestores"…), donde una ilustración de 170 px no cabe.

## 9. Referencias

- **Apps de turnos/nómina:** Deputy, When I Work, Homebase, Rippling, Gusto.
- **Sistemas de diseño:** Shopify Polaris (patrones de carga), Material 3 (estados y progreso), Linear, Stripe, Vercel Geist.
- **Skeletons:** Airbnb, Uber (móvil); guías de Nielsen Norman Group sobre indicadores de progreso.
- **Animación de marca:** LottieFiles + `lottie-react-native`.
- **Accesibilidad y color:** WCAG 2.1 (criterio 1.4.3), WebAIM Contrast Checker, Coolors, Realtime Colors.
- **Inspiración visual:** Mobbin, Dribbble ("shift scheduling app", "workforce management", "payroll app").
