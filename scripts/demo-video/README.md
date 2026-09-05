# Video de demostración de Ausculta

Un recorrido completo del producto, grabado sobre la **aplicación real** corriendo en
el arnés local (emuladores de Firebase + `next dev`) con un consultorio sintético.
Cero pacientes reales: la médica, las pacientes, los teléfonos y los valores de
laboratorio son inventados.

## Qué hay aquí

| Archivo | Qué hace |
|---|---|
| `guion.mjs` | La única fuente de verdad del video: capítulos, escenas, narración, diálogo de la consulta y chats de WhatsApp. |
| `tts.py` | Sintetiza la narración y el diálogo con Kokoro (voz neuronal local, sin red). Deja `remotion/public/voz`, `remotion/public/dialogo` y `duraciones.json`. |
| `sembrar-extra.ts` | Completa la siembra del arnés para la paciente ficticia: notas previas **selladas con el hash real**, laboratorios, paquete liberado, firma de la médica, domicilio. |
| `resembrar.sh` | Deja el consultorio como al principio (siembra base + reserva pública + extra). Correr antes de cada grabación. |
| `grabar.mjs` | Recorre la app con Chromium y graba un video por bloque (`landing`, `agenda`, `consulta`, `portal`, `seguimiento`) escribiendo las **marcas** de cada escena. |
| `nota-sintetica.mjs` | Respuestas sintéticas de los dos proveedores externos que la sesión no tenía (voz a texto y redacción de la nota). Ver «Qué es real». |
| `cursor.mjs` | Puntero visible para la grabación (Chromium sin cabeza no lo dibuja). |
| `musica.py` | Cama musical ambiental generada, sin muestras de terceros. |
| `preparar.sh` | Deja listo `remotion/public/`: guion, marcas, clips recodificados a H.264, música. |
| `remotion/` | La composición: línea de tiempo calculada desde las marcas, subtítulos, capítulos, chats animados, marco de teléfono, cierre. |

## Cómo regenerarlo

```bash
# 1. Arnés local (dos terminales)
npm run arnes:emuladores
PORTAL_PACIENTE_SECRET=<16+ caracteres> NEXT_PUBLIC_APP_URL=http://localhost:3200 npm run arnes:dev

# 2. Datos
scripts/demo-video/resembrar.sh

# 3. Voz (una vez; pide el modelo Kokoro en ONNX y su archivo de voces)
node scripts/demo-video/exportar-guion.mjs > /tmp/guion.json
python3 scripts/demo-video/tts.py /tmp/guion.json kokoro-v1.0.onnx voices-v1.0.bin
ffmpeg -i scripts/demo-video/remotion/public/dialogo/dialogo.wav -ar 48000 -ac 1 -c:a pcm_s16le \
       scripts/demo-video/remotion/public/dialogo/mic-48k.wav     # el «micrófono» de la consulta

# 4. Token del portal (mismo secreto que el paso 1) → marcas/tokens.json {"agenda":…, "clinico":…}

# 5. Grabar, preparar, renderizar
node scripts/demo-video/grabar.mjs
scripts/demo-video/preparar.sh
cd scripts/demo-video/remotion && npm install && npx remotion render src/index.ts AuscultaDemo out/ausculta-demo.mp4
```

## Qué es real y qué no

- **Real**: todas las pantallas, la navegación, la agenda, la reserva pública, la
  transacción de citas, la lista de espera, los motores de seguridad de la receta,
  la procedencia frase→segundo, la firma con hash NOM-024, la receta y la orden con
  QR, el paquete de visita, el portal del paciente, el clasificador determinista de
  preguntas, los pendientes, el expediente, la bitácora, la configuración.
- **Sintético, declarado**: la sesión donde se grabó no tenía llaves de AssemblyAI
  ni de Anthropic, así que `grabar.mjs` intercepta en el navegador
  `transcribir-diarizado`, `atribuir-roles`, `procesar` y `verificar-nota` y
  devuelve `nota-sintetica.mjs`, con la forma exacta del contrato de cada ruta.
  La interfaz que se ve procesando esas respuestas es la real. Con llaves, basta
  quitar `mocksConsulta()` para grabarlo en vivo.
- **Simulado**: WhatsApp no está conectado en el arnés. La oferta del hueco a la
  lista de espera se da por enviada (`waitlist-notify` responde `ok`) y el estado
  «contactado» se escribe como lo escribiría el servidor. Las conversaciones de
  WhatsApp del video son animaciones con los textos reales de las plantillas.
- **Voz**: Kokoro, por ser lo único disponible sin red. Las pistas se pueden
  regenerar con cualquier otro sintetizador (ElevenLabs, Azure…) sin tocar la
  composición: sólo consume los WAV y `duraciones.json`.

## De dónde sale cada afirmación de la narración

| Se dice | Dónde está |
|---|---|
| Perfil público indexable, reserva sin cuenta, huecos que descuentan descansos, festivos y Google Calendar | `src/app/dr/[clinicId]`, `src/app/reservar/[clinicId]`, `src/app/api/public/availability` |
| Aviso al consultorio por WhatsApp al reservar | `src/lib/whatsapp/avisar-consultorio.ts` |
| Bot de WhatsApp: agendar, cancelar, reagendar | `src/app/api/whatsapp/webhook/route.ts`, `src/lib/whatsapp/intencion.ts` |
| Transacción del hueco (se entrega una sola vez) | `src/app/api/appointments/route.ts` (`slot_locks`) |
| Estados de la cita y transición en servidor con bitácora | `src/types/index.ts` (`AppointmentStatus`), `src/lib/agenda/transicion-cita.ts` |
| Recordatorio 24 h y mismo día, respuesta SÍ/NO | `src/app/api/cron/reminders/route.ts` |
| Lista de espera automática al cancelar | `src/lib/whatsapp/ofrecer-hueco.ts`, `src/lib/whatsapp/lista-espera.ts` |
| Diarización, palabras con duda, nada se corrige en silencio | `src/hooks/useGrabacionAudio.ts`, `src/lib/expediente/confianza-audio.ts`, `src/components/CorreccionesPanel.tsx` |
| El modelo redacta y extrae; no calcula | `.claude/rules/clinical-safety.md`, `src/lib/clinical/registry.ts` |
| Procedencia frase→segundo | `src/components/DeDondeSalioEsto.tsx`, `src/components/EscucharElMomento.tsx`, `src/lib/expediente/cuando-se-dijo.ts` |
| Lo que bloquea vs lo que se revisa antes de firmar | `src/components/AntesDeFirmar.tsx`, `src/lib/expediente/por-que-no-se-firma.ts` |
| Sello de integridad, bitácora, adenda | `src/lib/expediente/integrity.ts`, `src/lib/expediente/audit-log.ts`, `src/components/HistorialVersiones.tsx` |
| Receta: sólo lo prescrito hoy; alergias, interacciones, dosis, función renal; folio y QR | `src/lib/expediente/que-va-en-la-receta.ts`, `src/lib/seguridad/*`, `src/lib/expediente/farmacovigilancia.ts`, `src/lib/receta-folio.ts`, `src/app/verificar/[token]` |
| Órdenes prepobladas; resultados: la IA transcribe, un motor valida y grafica | `src/app/(dashboard)/orden`, `src/components/laboratorio/PanelLaboratorios.tsx`, `src/lib/expediente/laboratorio/extraccion.ts` |
| Firmar ≠ liberar; DRAFT invisible; enlace sin contenido clínico | `src/lib/paciente/paquete-de-visita.ts`, `src/lib/paciente/entrega-del-paquete.ts` |
| Cinco destinos del portal; confirmar/reagendar con huecos reales | `src/app/mi/[token]/page.tsx`, `src/app/api/portal/route.ts` |
| Cinco clases de respuesta; nunca cambia un tratamiento; urgencia primero | `src/lib/paciente/pregunta-del-paciente.ts`, `src/lib/paciente/urgencia.ts`, `.claude/rules/patient-facing-ai.md` |
| Pendientes derivados de la nota; expediente longitudinal; bitácora exportable | `src/lib/tareas-clinicas/derivar.ts`, `src/components/expediente/ClinicalSpine.tsx`, `src/app/api/cumplimiento/bitacora` |
| Catorce días gratis, sin tarjeta | `CLAUDE.md` (decisión del dueño, v972) |
