# Motor de Animación para Reels de Zaturno

Sistema modular para generar reels animados con el personaje de Zaturno.

## Componentes

### `timeline.js`
Motor principal de línea de tiempo. Interpola entre poses del perro y gestiona escenas.

```javascript
import { Timeline } from './timeline.js';

const timeline = new Timeline(30); // 30 fps

timeline.addScene({
  tInicio: 0,
  tFin: 4,
  poseInicio: { boca: 'sonrisa', brazoI: [-66, 28, -17, 16] },
  poseFin: { boca: 'pensativa', brazoI: [-80, 30, -20, 20] },
  easing: 'easeOutBack'
});

// Obtener estado en un tiempo específico
const frame = timeline.getFrameAt(2.5); // t=2.5s
```

### `easing.js`
Funciones de easing para animaciones suaves.

Disponibles:
- `linear` - Sin aceleración
- `easeOut` - Desaceleración al final
- `easeIn` - Aceleración al inicio
- `easeInOut` - Aceleración y desaceleración
- `easeOutBack` - Rebote al final (recomendado para elementos que "llegan")
- `easeOutElastic` - Rebote elástico
- `easeOutBounce` - Rebotes múltiples

### `text-fx.js`
Efectos de texto animado.

```javascript
import { textoAnimado } from './text-fx.js';

// Texto con animación de entrada
const svg = textoAnimado('Calcular la nómina…', 540, 400, {
  fontSize: 48,
  fontWeight: 800,
  entrando: 0.5,  // 0-1, progreso de entrada
  estiloZaturno: false
});

// Texto estilo Zaturno (con brillo)
const svgZaturno = textoAnimado('Yo soy Zaturno', 540, 400, {
  fontSize: 60,
  estiloZaturno: true,
  entrando: 0.8
});
```

### `phone-frame.js`
Componentes de marcos de dispositivos.

```javascript
import { marcoPhone, marcoTablet } from './phone-frame.js';

// Marco de celular con captura de app
const marco = marcoPhone(540, 960, './capturas/turno.png', {
  ancho: 300,
  alto: 600,
  entrando: 0.7,  // Animación desde abajo
  rotacion: 10
});
```

### `capture.js`
Sistema de captura de frames con Playwright.

```javascript
import { captureTimeline, framesToVideo } from './capture.js';

// Capturar frames
await captureTimeline(
  './timeline.html',  // Página HTML con la animación
  './frames',         // Directorio de salida
  36,                 // Duración en segundos
  30                  // FPS
);

// Convertir a video
await framesToVideo(
  './frames',
  './reel-final.mp4',
  30,
  {
    crf: 18,
    audioFiles: [
      { archivo: './voz_1.wav', tiempo: 13.0 },
      { archivo: './voz_2.wav', tiempo: 15.5 }
    ]
  }
);
```

## Flujo de Trabajo

1. **Definir escenas** en `escenas.js`
2. **Crear página HTML** que use el timeline
3. **Capturar frames** con Playwright
4. **Generar voz** con ElevenLabs
5. **Compilar video** con ffmpeg

## Requisitos

- Node.js >= 18
- ffmpeg instalado en el sistema
- Playwright (se instala automáticamente con npm)

## Ver También

- [../audio/generar-voz.js](../audio/generar-voz.js) - Integración con ElevenLabs
- [../reel-01/](../reel-01/) - Ejemplo completo del primer reel
- [../personaje/perro.js](../personaje/perro.js) - Sistema de generación del personaje
