#!/usr/bin/env bash
# Descarga en local las fuentes del video (IBM Plex Sans/Mono y Fraunces, OFL) y
# genera `remotion/src/fuentes.generado.ts` con sus caras. Sin red en el render.
set -euo pipefail
AQUI="$(cd "$(dirname "$0")" && pwd)"
DEST="$AQUI/remotion/public/fonts"
mkdir -p "$DEST"
UA="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
CA="${CURL_CA_BUNDLE:-}"
[ -n "$CA" ] && CAOPT=(--cacert "$CA") || CAOPT=()
curl -sS "${CAOPT[@]}" -A "$UA" "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;1,9..144,400;1,9..144,500&display=swap" -o "$DEST/fuentes.css"
grep -o "https://fonts.gstatic.com[^)]*" "$DEST/fuentes.css" | sort -u > "$DEST/urls.txt"
i=0; while read -r u; do i=$((i+1)); curl -sS "${CAOPT[@]}" -o "$DEST/f$i.woff2" "$u"; done < "$DEST/urls.txt"
python3 - "$DEST" "$AQUI/remotion/src/fuentes.generado.ts" <<'PY'
import re, json, sys
dest, salida = sys.argv[1], sys.argv[2]
css = open(f'{dest}/fuentes.css').read()
urls = [l.strip() for l in open(f'{dest}/urls.txt') if l.strip()]
idx = {u: f'f{i+1}.woff2' for i, u in enumerate(urls)}
caras = []
for bloque in re.findall(r'@font-face\s*{([^}]*)}', css):
    g = lambda k: re.search(k + r':\s*([^;]+);', bloque).group(1).strip()
    url = re.search(r'url\(([^)]+)\)', bloque).group(1)
    caras.append({'family': g('font-family').strip("'\""), 'style': g('font-style'), 'weight': g('font-weight'), 'file': idx[url], 'unicodeRange': g('unicode-range')})
open(salida, 'w').write('// Generado por preparar-fuentes.sh (public/fonts). No editar a mano.\nexport const CARAS = ' + json.dumps(caras, ensure_ascii=False, indent=2) + ' as const\n')
print(len(caras), 'caras de fuente')
PY
