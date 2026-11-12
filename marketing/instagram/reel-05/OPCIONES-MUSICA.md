# 🎵 Opciones de Música de Fondo - Reel 5

## Requisitos
- **BPM:** 120-130
- **Estilo:** Upbeat, positivo, moderno, corporate/tech
- **Tipo:** Instrumental (sin voces)
- **Duración:** ~30 segundos o más (recortable)

---

## ✅ Mejores Opciones de Artlist

### 1. **Building Tomorrow** by Ikoliks ⭐ RECOMENDADO
- **Duración:** 2:52
- **BPM:** 125
- **ID:** 6002018
- **Preview:** [Escuchar](https://artlist.io/royalty-free-music/song/building-tomorrow/6002018)
- **Por qué:** Título perfecto para un reel sobre crear equipo, mood optimista y profesional

### 2. **Bright Future** by Itay Kashti
- **Duración:** 3:02
- **BPM:** 124
- **ID:** 120976
- **Preview:** [Escuchar](https://artlist.io/royalty-free-music/song/bright-future/120976)
- **Por qué:** Tono aspiracional, energía positiva constante

### 3. **Rise & Innovate** by BoDleasons
- **Duración:** 2:41
- **BPM:** 125
- **ID:** 137678
- **Preview:** [Escuchar](https://artlist.io/royalty-free-music/song/rise-innovate/137678)
- **Por qué:** Perfecto para innovación y cambio positivo (Excel → Zaturno)

### 4. **Tomorrow Starts Now** by Dredstudio
- **Duración:** 2:15
- **BPM:** 126
- **ID:** 6002248
- **Preview:** [Escuchar](https://artlist.io/royalty-free-music/song/tomorrow-starts-now/6002248)
- **Por qué:** Track corto y dinámico, fácil de editar para 30s

### 5. **Adaptive Flow** by Kerei
- **Duración:** 2:12
- **BPM:** 122
- **ID:** 6002136
- **Preview:** [Escuchar](https://artlist.io/royalty-free-music/song/adaptive-flow/6002136)
- **Por qué:** Suave pero energético, no compite con la voz

---

## 🎯 Momentos de Sincronización

Al elegir el track, verificar que tenga:

- **3.0s** - Beat drop suave o cambio (entrada Paso 1 - Celular sube)
- **23.0s** - Build-up (transición a completado)
- **24.0s** - Clímax o momento fuerte (checkmark gigante + confetti)

---

## 📥 Cómo Descargar

Una vez elegido el track:

```javascript
// Desde Claude Code con MCP de Artlist activo
const songId = "6002018"; // ID del track elegido
await mcp__claude_ai_Artlist__download_track({ songId });
```

O manualmente:
1. Abrir el link de preview
2. Descargar el track desde Artlist
3. Guardar como: `reel-05/audio/musica-fondo.mp3`

---

## 🛠️ Integración en build.js

El track se mezclará con las voces usando ffmpeg:

```bash
ffmpeg -i frames/%05d.png \
  -i audio/voz_v1.wav \
  -i audio/voz_v2.wav \
  -i audio/voz_v3.wav \
  -i audio/voz_v4.wav \
  -i audio/voz_v5.wav \
  -i audio/musica-fondo.mp3 \
  -filter_complex "[mezcla de voces + música de fondo]" \
  -c:v libx264 -c:a aac \
  output.mp4
```

La música se mantendrá a volumen bajo (-12dB a -15dB) para no competir con las voces.

---

**Fecha:** 2026-11-11  
**Actualizado:** Después de búsqueda en Artlist
