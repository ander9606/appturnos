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

### 2.3 Color por módulo

| Módulo | Acento | Token |
|---|---|---|
| Turnos | Naranja | `THEME_COLORS.turnos` |
| Nómina | Verde | `THEME_COLORS.nomina` |
| Gestores | Azul | `THEME_COLORS.gestores` |
| Integración (logiq360) | Índigo | `COLORS.integracion` |

En móvil, `const theme = useTheme()` (de `lib/theme.ts`) devuelve la paleta según el rol del usuario: usa `theme.primary` en vez de `COLORS.primary` en pantallas que cambian de color por módulo.

### 2.4 Reglas

- **Prohibido el hex literal** en pantallas y componentes. En `className` usa el token Tailwind; en JS usa `COLORS.*`.
  ```tsx
  <Ionicons name="pin-outline" color={COLORS.mutedForeground} />   // ✅
  <Ionicons name="pin-outline" color="#64748B" />                  // ❌
  ```
- **¿Falta un color?** No lo inventes en la pantalla: agrégalo a los tres archivos de §2.1 y a la tabla de §2.2.
- **Transparencias:** si necesitas un tinte, usa la variante `light` o `className="bg-primary/10"`. (Ver deuda en §8: aún hay hex con alfa tipo `#6366F11A`.)
- **Avatares:** paleta fija `AVATAR_COLORS` (mismo id → mismo color).
- **Gráficos de horas:** `HOUR_TYPE_COLORS` (validada contra daltonismo; no cambiar sin revalidar).

---

## 3. Tipografía

- **Web:** `Inter` (declarada en `index.css`). ⚠️ *Hoy no se carga* (§8): cae a la fuente del sistema.
- **Móvil:** fuente del sistema (`System`).
- Texto de cuerpo: `text-base`; secundario: `text-sm text-muted-foreground`; títulos: `font-semibold`/`font-bold`.
- No fijar tamaños en px sueltos; usar la escala de Tailwind.

## 4. Forma y espaciado

- Radios: `rounded-lg` (12) en controles, `rounded-xl` (16) en botones y tarjetas pequeñas, `rounded-2xl` (20) en tarjetas, `rounded-full` en avatares y badges.
- Tarjeta estándar: `bg-card rounded-2xl border border-border p-4`.
- Separación entre tarjetas de una lista: `gap-3`.
- Botones: usar siempre `Button` (móvil, `components/ui/Button.tsx`); no reconstruirlos con `TouchableOpacity`.

---

## 5. Estados de carga

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

Bloques grises que laten (opacidad 100 % ↔ 45 %, 1.4 s) en el lugar del contenido.

| | Móvil | Web |
|---|---|---|
| Archivo | `apps/mobile/components/ui/Skeleton.tsx` | `apps/web/src/shared/components/Skeleton.tsx` |
| Piezas | `Skeleton`, `SkeletonCard`, `SkeletonList` | `Skeleton`, `SkeletonCard`, `SkeletonList` |

```tsx
{isLoading ? <SkeletonList count={6} /> : isError ? <ErrorState …/> : <Lista …/>}
```

- **`Skeleton`**: bloque suelto (`width`, `height`, `radius`; `'full'` = círculo) para armar formas propias.
- **`SkeletonCard`** / **`SkeletonList`**: tarjeta genérica avatar + 2 líneas + etiqueta. Calca el tamaño de las tarjetas reales; si una lista tiene otra forma, **crea un skeleton propio con `Skeleton`** en vez de forzar la genérica.
- En móvil todos los skeletons comparten un solo pulso (laten juntos) y la animación se apaga sola cuando no hay ninguno montado.
- Dónde ya se usan: móvil → Equipo (lista), Turnos (mis turnos, ofertas, listas del mes); web → Equipo y Turnos.

### 5.3 Reglas de carga

1. Si hay estado de error, el orden es siempre: **cargando → error (con "Reintentar") → vacío → contenido**.
2. Una acción en curso **bloquea el doble toque** (`Button` ya lo hace con `onPress` asíncrono).
3. No pongas texto "Cargando…" suelto: usa `PageLoading` (web) o `Spinner` (móvil), que ya llevan etiqueta de accesibilidad.
4. No uses spinner a pantalla completa cuando ya hay datos en caché y solo refrescas: usa `RefreshControl` (móvil) o deja el contenido visible.

---

## 6. Accesibilidad

Contraste medido (WCAG: 4.5:1 texto normal, 3:1 texto grande ≥ 18 px o ≥ 14 px en negrita, y elementos gráficos):

| Combinación | Ratio | Veredicto |
|---|---|---|
| Blanco sobre `primary` `#FF5A3C` | **3.10** | ⚠️ Solo texto grande/negrita (botones `font-semibold` ok) |
| Blanco sobre `primary-600` `#E83E1F` | 4.09 | Casi AA |
| Blanco sobre `primary-700` `#C32D14` | 5.67 | ✅ AA |
| `primary-700` sobre blanco | 5.67 | ✅ Para texto pequeño de marca usa 700 |
| Blanco sobre `success` / `info` / `danger` | 3.77 / 3.68 / 3.76 | ⚠️ Solo texto grande/negrita |
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

---

## 7. Checklist antes de abrir un PR de UI

- [ ] Sin hex literales nuevos (busca `#[0-9A-Fa-f]{6}` en lo que tocaste).
- [ ] Si agregaste un color: está en `tailwind.config.js`, `designTokens.ts`, `index.css` **y** en §2.2.
- [ ] Sin `ActivityIndicator`, `Loader2` ni texto "Cargando…" nuevos.
- [ ] Listas: skeleton al cargar, `ErrorState` con reintento, `EmptyState` si no hay datos.
- [ ] Texto pequeño cumple contraste (§6).
- [ ] Strings visibles por `t('clave')` en móvil.
- [ ] Móvil: `npm run type-check` y `npm run lint`. Web: `npm run build`.
- [ ] Si cambiaste una regla de este documento, está actualizada aquí.

---

## 8. Deuda conocida (próximos pasos, por orden de impacto)

1. **Hex sueltos restantes (~124 en móvil):** sobre todo `#000` (sombras), tintes claros (`#F1F5F9`, `#FEF3C7`, `#EFF6FF`), violetas (`#8B5CF6`, `#7C3AED`), `#475569`, y hex con alfa (`#6366F11A`). Decidir cuáles pasan a token y cuáles son de un solo uso.
2. **Inter no se carga.** Web: añadir `@fontsource-variable/inter`. Móvil: `expo-font` + `useFonts`. Hasta entonces la tipografía varía por dispositivo.
3. **Skeleton en más pantallas.** Faltan Nómina, Notificaciones, Historial de ganancias, Dashboard de asistencia y las páginas web de Nómina, Configuración y Admin (hoy usan `PageLoading`/`Spinner`).
4. **Skeletons con forma propia.** Detalle de turno, perfil de trabajador y tarjetas de nómina usan spinner porque su forma no es la tarjeta genérica.
5. **Contraste de marca.** Evaluar oscurecer ligeramente `primary` o usar `primary-600` en botones (4.09 → casi AA) sin perder identidad.
6. **Modo oscuro.** `userInterfaceStyle: "light"` fijo. Con los tokens ya centralizados, es viable como etapa propia.
7. **Íconos.** Web usa `lucide-react`, móvil usa `Ionicons`. Unificar estilo (grosor, tamaño) o elegir un solo set.
8. **Identidad propia.** Definir 3-4 rasgos distintivos (forma recurrente, sombra, ilustración para estados vacíos) y documentarlos en esta guía.
9. **Spinner a nivel de marca.** Evaluar una animación con la forma del logo (Lottie) para el splash y la carga inicial.
10. **Test pendiente no relacionado:** `features/turnos/__tests__/turnosUtils.test.ts › getWeekDays › marca correctamente el día de hoy` falla (depende de la fecha). Pre-existente.

---

## 9. Referencias

- **Apps de turnos/nómina:** Deputy, When I Work, Homebase, Rippling, Gusto.
- **Sistemas de diseño:** Shopify Polaris (patrones de carga), Material 3 (estados y progreso), Linear, Stripe, Vercel Geist.
- **Skeletons:** Airbnb, Uber (móvil); guías de Nielsen Norman Group sobre indicadores de progreso.
- **Animación de marca:** LottieFiles + `lottie-react-native`.
- **Accesibilidad y color:** WCAG 2.1 (criterio 1.4.3), WebAIM Contrast Checker, Coolors, Realtime Colors.
- **Inspiración visual:** Mobbin, Dribbble ("shift scheduling app", "workforce management", "payroll app").
