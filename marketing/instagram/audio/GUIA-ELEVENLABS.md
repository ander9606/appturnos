# Guía: Obtener API Key de ElevenLabs (2026)

## Método 1: URL Directa (Recomendado)

1. Inicia sesión en https://elevenlabs.io/
2. Una vez dentro, ve directamente a: **https://elevenlabs.io/app/settings/api-keys**
3. Si te redirige o muestra error 404, prueba: **https://elevenlabs.io/app/speech-synthesis**

## Método 2: Navegación Visual

### Paso 1: Identifica tu interfaz

ElevenLabs tiene 2 interfaces principales:

**Interfaz A (Más común):**
```
┌─────────────────────────────────────────────┐
│  [Logo] ElevenLabs          [🔔] [👤 User] │  ← Barra superior
├──────────┬──────────────────────────────────┤
│          │                                  │
│ Home     │  Tu contenido principal          │
│ Voice    │                                  │
│ Projects │                                  │
│ Settings │  ← BUSCA ESTO                    │
│ API      │  ← O ESTO                        │
│          │                                  │
└──────────┴──────────────────────────────────┘
```

**Interfaz B (Nueva):**
```
┌─────────────────────────────────────────────┐
│  [Logo] ElevenLabs    [⚙️] [🔔] [👤 User] │  ← Click en ⚙️ Settings
└─────────────────────────────────────────────┘
```

### Paso 2: Llegar a API Keys

**Desde barra lateral izquierda:**
- Click en **"Settings"** → Busca pestaña **"API Keys"**
- O click directo en **"API"** si existe

**Desde menú de usuario (👤):**
- Click en tu avatar (esquina superior derecha)
- Menú → **"Profile Settings"** o **"API Keys"**
- Si hay sub-menú → **"API Keys"**

**Desde configuración (⚙️):**
- Click en el ícono de engranaje
- Busca sección **"Developer"** o **"API Keys"**

### Paso 3: Crear la Key

1. Verás un botón: **"+ Create API Key"** o **"Generate API Key"**
2. Click ahí
3. (Opcional) Dale un nombre: `Zaturno Reels 2026`
4. Click **"Create"** o **"Generate"**
5. **COPIA LA KEY INMEDIATAMENTE** (solo la verás una vez)

La key tiene este formato:
```
sk_1234567890abcdefghijklmnopqrstuvwxyz1234567890abcd
```

## Método 3: Usar la API de ElevenLabs Directamente

Si la interfaz no funciona, puedes obtener una key usando la API de login:

**⚠️ Esto requiere tus credenciales de login**

Contacta a soporte de ElevenLabs:
- Email: support@elevenlabs.io
- O usa el chat en vivo en la esquina inferior derecha de elevenlabs.io

## Verificar que Funciona

Una vez que tengas la key:

```bash
# En PowerShell
$env:ELEVENLABS_API_KEY="sk_tu_key_aqui"

# Probar
cd marketing/instagram/audio
node -e "import('./generar-voz.js').then(m => m.listarVoces())"
```

Si funciona, verás una lista de voces. Si no, verás un error.

## Alternativas si No Funciona

### Plan B: Usar Otra Herramienta de Voz

Si no logras obtener la API key de ElevenLabs, puedes usar:

1. **Google Cloud Text-to-Speech** (tiene español latino)
   - Más complejo de configurar pero gratuito para uso bajo
   - https://cloud.google.com/text-to-speech

2. **Azure Speech** (Microsoft)
   - También tiene español latino con voces neurales
   - https://azure.microsoft.com/en-us/services/cognitive-services/text-to-speech/

3. **Grabar manualmente** (temporal)
   - Grabar las 2 frases con tu voz
   - Procesarlas con voz-del-espacio.sh
   - Usarlas mientras configuras ElevenLabs

### Plan C: Generar el Reel Sin Voz (Primero)

1. Genera el reel completo con animaciones y texto
2. Agregar la voz después como paso separado
3. Al menos podrás probar todo el pipeline visual

## Contacto con Soporte

Si definitivamente no encuentras la sección:

**Email:** support@elevenlabs.io

**Mensaje sugerido:**
```
Subject: Cannot find API Keys section

Hi,

I'm trying to obtain an API key for my account (anderson960616@gmail.com) 
but I cannot find the API Keys section in the dashboard.

Could you help me locate it or generate one for me?

Thanks!
```

---

¿En qué parte te quedas trabado? Descríbeme lo que ves en tu pantalla actual de ElevenLabs.
