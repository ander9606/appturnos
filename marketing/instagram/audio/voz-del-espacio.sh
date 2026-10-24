#!/usr/bin/env bash
# Convierte una voz normal (grabada o de cualquier herramienta de voz) en la "voz del espacio":
# más grave, con eco y con volumen parejo para redes.
# Uso: ./voz-del-espacio.sh entrada.wav salida.wav
set -euo pipefail
[ $# -eq 2 ] || { echo "Uso: $0 entrada salida" >&2; exit 1; }
command -v ffmpeg >/dev/null || { echo "Falta ffmpeg (https://ffmpeg.org)" >&2; exit 1; }

# Bajar el tono: rubberband lo hace sin cambiar la velocidad, pero no todas las
# instalaciones de ffmpeg lo traen. Plan B: bajar la frecuencia y recuperar la velocidad.
if ffmpeg -hide_banner -filters 2>/dev/null | grep -q ' rubberband '; then
  TONO="rubberband=pitch=0.84"
else
  TONO="asetrate=44100*0.84,aresample=44100,atempo=1.19"
fi

# quitar rumor grave -> tono grave -> realzar graves -> eco en 3 rebotes -> comprimir -> volumen estándar
ffmpeg -hide_banner -loglevel error -y -i "$1" \
  -af "highpass=f=80,${TONO},equalizer=f=200:t=q:w=1:g=3,aecho=0.8:0.85:60|120|260:0.5|0.35|0.25,acompressor=threshold=-18dB:ratio=3,loudnorm=I=-16:TP=-1.5" \
  -ar 44100 "$2"
