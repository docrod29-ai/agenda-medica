# Modo manos libres (comandos de voz en la consulta)

Permite operar la grabación de la consulta **sin tocar la pantalla** — pensado para
usar el consultorio con las manos ocupadas o con unos lentes/audífono con micrófono
Bluetooth (p. ej. Ray-Ban Meta usados como micrófono del teléfono).

## Cómo se usa
1. En la pantalla de consulta, activa el botón **“Manos libres”** (aparece junto al
   botón de grabar, solo si el navegador soporta comandos de voz).
2. Di **“iniciar consulta”** → arranca la grabación (la 1ª vez de la sesión pide un
   toque de consentimiento, obligatorio por normativa).
3. Di **“cerrar consulta”** → detiene y la nota se llena sola (flujo de auto-proceso
   existente).

Variantes reconocidas: iniciar/inicia/empezar/comenzar/abrir/nueva **consulta** ·
cerrar/cierra/terminar/finalizar/detener/guardar **consulta**.

## Piezas
- `src/lib/voz/comandos.ts` — `detectarComando(texto)` **puro** (variantes, acentos,
  antifalsos como “iniciar tratamiento” o “la consulta anterior”). Probado.
- `src/hooks/useComandoVoz.ts` — escucha con la Web Speech API, se reinicia solo,
  antirrebote de 4 s, opt-in.
- `consulta/[patientId]/page.tsx` — toggle + aviso visible + callbacks cableados al
  grabador real (`arrancarSegunModo` / `audio.detener`).

## Modo 100% en el dispositivo (Picovoice) — rama `feat/comandos-on-device`

Para que el audio de la escucha de comandos **nunca salga del equipo**, hay un
segundo motor (Picovoice Porcupine, WebAssembly). Está **cableado y con respaldo
automático** al modo Web Speech: si no hay configuración, la consulta usa el modo
estándar (sin cambios). **No desplegado a producción** hasta verificarlo con la clave.

- `src/hooks/usePorcupineComando.ts` — carga Porcupine por import dinámico (solo
  cliente), todo protegido; ante cualquier fallo no arranca y se cae al modo estándar.
- `src/app/api/voz/comandos-config/route.ts` — guarda `clinic.voz.picovoice`
  (AccessKey + URLs de las palabras clave), solo médico/admin.
- La consulta elige motor: **on-device si hay config**, si no Web Speech. El aviso
  indica “🔒 en el dispositivo” vs “en la nube”.

### Paso externo del Dr. (una sola vez)
1. Cuenta gratis en console.picovoice.ai → **AccessKey**.
2. Entrenar 2 palabras clave en español (“iniciar consulta”, “cerrar consulta”),
   plataforma Web (WASM) → 2 archivos `.ppn`.
3. Colocar los `.ppn` + `porcupine_params_es.pv` en `public/porcupine/`
   (ver `public/porcupine/LEEME.txt`).
4. Guardar el AccessKey en la app (o pasármelo y lo dejo puesto).

Hasta entonces, el modo estándar (Web Speech) sigue funcionando en producción.

## Límites honestos (v1)
- **Privacidad:** la Web Speech API de Chrome procesa el audio en servidores del
  navegador mientras escucha. Por eso es **opt-in**, solo en la pantalla de consulta,
  con aviso visible. Mejora natural siguiente: motor de palabra clave 100% en el
  dispositivo (Picovoice Porcupine, WebAssembly) para que nada salga del equipo.
- **Micrófono compartido:** el reconocedor de comandos y el grabador Whisper usan el
  mismo micrófono. En Chrome de escritorio conviven bien; en algunos móviles puede
  haber conflicto — si pasa, el botón manual de grabar sigue funcionando.
- **Falsos disparos:** decir “cerrar consulta” como parte del dictado podría detener.
  Riesgo bajo (frases específicas) y acotado: “iniciar consulta” se ignora si ya está
  grabando. Con un hotword dedicado (Picovoice) se elimina.
- **Lentes Meta:** hoy funcionan como micrófono Bluetooth del teléfono; Meta no expone
  un SDK para disparar apps de terceros ni el stream del micrófono en vivo, así que el
  “cerebro” es el teléfono, no los lentes.
