# Sistema de Generación de Reels - Zaturno

Motor completo para generar reels animados de Instagram con el personaje de Zaturno.

## Estructura del Proyecto

```
instagram/
├── motor/              # Motor de animación reutilizable
│   ├── timeline.js     # Sistema de línea de tiempo e interpolación
│   ├── easing.js       # Funciones de easing
│   ├── text-fx.js      # Efectos de texto animado
│   ├── phone-frame.js  # Marcos de dispositivos
│   └── capture.js      # Captura de frames con Playwright
├── audio/
│   ├── voz-del-espacio.sh  # Efecto de voz del espacio (ffmpeg)
│   └── generar-voz.js      # Integración con ElevenLabs
├── personaje/
│   └── perro.js        # Sistema de generación del personaje SVG
└── reel-01/            # Primer reel (presentación)
    ├── escenas.js      # Definición de las 9 escenas
    ├── timeline.html   # Página HTML con la animación
    ├── build.js        # Script de construcción completo
    └── package.json    # Dependencias del proyecto
```

## Inicio Rápido

### 1. Instalar Dependencias

```bash
cd marketing/instagram/reel-01
npm install
```

### 2. Configurar API Key de ElevenLabs

```bash
export ELEVENLABS_API_KEY="tu-api-key-aqui"
export ELEVENLABS_VOICE_ID="id-de-voz-grave-en-espanol"
```

### 3. Verificar que ffmpeg está instalado

```bash
ffmpeg -version
```

Si no está instalado:
- **Windows**: Descargar de https://ffmpeg.org/download.html
- **Mac**: `brew install ffmpeg`
- **Linux**: `sudo apt install ffmpeg`

### 4. Listar voces disponibles (opcional)

```bash
cd marketing/instagram/audio
node -e "import('./generar-voz.js').then(m => m.listarVoces())"
```

### 5. Probar una voz (opcional)

```bash
node -e "import('./generar-voz.js').then(m => m.probarVoz('voice_id_aqui'))"
```

## Generar un Reel

### Opción A: Generar Reel Completo

```bash
cd marketing/instagram/reel-01
node build.js
```

Esto generará:
1. Archivos de voz con ElevenLabs
2. 1080 frames PNG (36 segundos a 30fps)
3. Video final MP4 de 1080x1920

### Opción B: Paso a Paso

```bash
# 1. Capturar solo un frame de prueba
node capture-frame.js 5.0 preview.png  # Frame en t=5.0s

# 2. Preview en navegador
node preview.js  # Abre timeline.html en navegador

# 3. Capturar todos los frames (sin audio)
node capture-frames.js

# 4. Generar solo la voz
node generar-solo-voz.js

# 5. Compilar video final
node compilar-video.js
```

## Crear un Nuevo Reel

1. Copiar la estructura de `reel-01/`:
```bash
cp -r reel-01 reel-02
cd reel-02
```

2. Editar `escenas.js` con las nuevas escenas

3. Actualizar `build.js` con:
   - Nuevas frases de voz
   - Nuevos timings
   - Nuevas capturas de app

4. Ejecutar `node build.js`

## Agregar Nuevas Poses al Personaje

Editar [personaje/perro.js](personaje/perro.js) y agregar nuevas situaciones al final del archivo, similar a las existentes.

Ejemplo:
```javascript
const NUEVA_POSE = {
  boca: 'sonrisa',
  ojos: { px: 0, py: 2 },
  cejas: 0,
  brazoI: [-66, 28, -17, 16],
  brazoD: [66, 28, 17, 16],
  props: P.celular(0, 4)
};
```

Luego regenerar la guía:
```bash
cd personaje
node render2.js guia.html hoja1 hoja2 hoja3 hoja4
```

## Grabar Capturas de la App

Las capturas deben ser en formato 9:16 (vertical), sin notificaciones, con datos de demostración.

### Preparar datos de demostración:
```bash
cd backend
npm run seed
```

### Grabar en móvil:
1. Abrir la app en el celular
2. Activar grabación de pantalla
3. Realizar las acciones necesarias
4. Exportar el video y extraer el frame deseado

### Grabar en web:
1. Abrir navegador en modo responsivo (1080x1920)
2. Usar herramienta de captura de pantalla
3. Guardar en `reel-XX/capturas/`

## Solución de Problemas

### Error: "ffmpeg not found"
Instalar ffmpeg según tu sistema operativo.

### Error: "ELEVENLABS_API_KEY not set"
Configurar la variable de entorno:
```bash
export ELEVENLABS_API_KEY="sk-..."
```

### Error: "window.renderFrame is not a function"
Verificar que `timeline.html` tiene la función `window.renderFrame` definida.

### Frames se ven cortados
Verificar que el viewport en `capture.js` coincide con el tamaño del canvas en HTML (1080x1920).

### Audio no se sincroniza
Revisar los tiempos en `archivosVoz` - están en segundos, el delay de ffmpeg en milisegundos.

## Recursos

- [Documentación del Motor](motor/README.md)
- [Guion del Reel 1](reel-01-presentacion.md)
- [Guía del Personaje](personaje/README.md)
- [ElevenLabs Docs](https://docs.elevenlabs.io/)
- [Playwright Docs](https://playwright.dev/)
- [FFmpeg Docs](https://ffmpeg.org/documentation.html)

## Próximos Pasos

- [ ] Grabar 3 capturas de la app (turnos, marcaje, nómina)
- [ ] Encontrar voz ideal en ElevenLabs (grave, español latino)
- [ ] Definir escenas completas del reel 1 en `escenas.js`
- [ ] Probar generación de primer borrador
- [ ] Iterar ajustando timings y efectos
- [ ] Publicar reel en Instagram con usuario @zaturno.app

## Contacto y Soporte

Para preguntas sobre el sistema, consultar la documentación en cada carpeta o revisar los ejemplos en el código.
