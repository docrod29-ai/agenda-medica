#!/usr/bin/env bash
# Versiones de entrega del máster (remotion/out/ausculta-demo.mp4):
#   · salida/ausculta-demo-720p.mp4   ≤ 28 MiB, dos pasadas, para compartir por chat/WhatsApp
#   · salida/ausculta-demo-1080p-parte1.mp4 y -parte2.mp4  el máster partido en dos, sin recodificar
# Uso: scripts/demo-video/comprimir.sh [máster.mp4]
set -euo pipefail
AQUI="$(cd "$(dirname "$0")" && pwd)"
FF="${FFMPEG:-$(python3 -c 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())')}"
IN="${1:-$AQUI/remotion/out/ausculta-demo.mp4}"
OUT="$AQUI/salida"
mkdir -p "$OUT"

DUR=$("$FF" -i "$IN" 2>&1 | sed -n 's/.*Duration: \([0-9:.]*\).*/\1/p' | awk -F: '{print ($1*3600)+($2*60)+$3}')
OBJETIVO_MIB=27
AUDIO_K=80
# bits totales / duración − audio − margen del contenedor
VIDEO_K=$(python3 -c "print(int(($OBJETIVO_MIB*8*1024*1024)/$DUR/1000 - $AUDIO_K - 12))")
echo "duración ${DUR}s · video ${VIDEO_K}k · audio ${AUDIO_K}k"

cd "$OUT"
"$FF" -y -loglevel error -i "$IN" -vf scale=1280:720 -c:v libx264 -preset slow -b:v "${VIDEO_K}k" -pass 1 -an -f mp4 /dev/null
"$FF" -y -loglevel error -i "$IN" -vf scale=1280:720 -c:v libx264 -preset slow -b:v "${VIDEO_K}k" -pass 2 -pix_fmt yuv420p -c:a aac -b:a "${AUDIO_K}k" -movflags +faststart ausculta-demo-720p.mp4
rm -f ffmpeg2pass-0.log ffmpeg2pass-0.log.mbtree

MITAD=$(python3 -c "print(int($DUR/2))")
"$FF" -y -loglevel error -i "$IN" -t "$MITAD" -c copy -movflags +faststart ausculta-demo-1080p-parte1.mp4
"$FF" -y -loglevel error -ss "$MITAD" -i "$IN" -c copy -movflags +faststart ausculta-demo-1080p-parte2.mp4
ls -la "$OUT"
