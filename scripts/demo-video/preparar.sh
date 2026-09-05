#!/usr/bin/env bash
# Deja listo lo que Remotion lee de `remotion/public/`:
#   · guion.json          (del guion)
#   · marcas/*.json       (de la grabación)
#   · clips/*.mp4         (los .webm de Playwright, recodificados a H.264 con fotogramas constantes)
#   · musica/cama.wav     (si no existe)
set -euo pipefail
AQUI="$(cd "$(dirname "$0")" && pwd)"
PUB="$AQUI/remotion/public"
FF="${FFMPEG:-$(python3 -c 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())')}"

node "$AQUI/exportar-guion.mjs" > "$PUB/guion.json"
mkdir -p "$PUB/marcas" "$PUB/clips" "$PUB/musica"
cp "$AQUI"/marcas/*.json "$PUB/marcas/" 2>/dev/null || true
rm -f "$PUB/marcas/tokens.json"

for webm in "$PUB"/clips/*.webm; do
  case "$(basename "$webm")" in page@*) continue;; esac
  [ -e "$webm" ] || continue
  mp4="${webm%.webm}.mp4"
  if [ ! -e "$mp4" ] || [ "$webm" -nt "$mp4" ]; then
    echo "→ $(basename "$webm") → mp4"
    "$FF" -y -loglevel error -i "$webm" -an -c:v libx264 -preset medium -crf 17 -pix_fmt yuv420p -r 30 -movflags +faststart "$mp4"
  fi
done

[ -d "$PUB/fonts" ] && [ -e "$AQUI/remotion/src/fuentes.generado.ts" ] || CURL_CA_BUNDLE="${CURL_CA_BUNDLE:-}" "$AQUI/preparar-fuentes.sh"
if [ ! -e "$PUB/musica/cama.mp3" ]; then
  python3 "$AQUI/musica.py"
  "$FF" -y -loglevel error -i "$PUB/musica/cama.wav" -codec:a libmp3lame -b:a 160k "$PUB/musica/cama.mp3" && rm -f "$PUB/musica/cama.wav"
fi
echo "Listo: $PUB"
