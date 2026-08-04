# Regla — voz y escriba ambiental

Aplica a: `src/lib/asr/`, `src/hooks/useGrabacionAudio.ts`,
`src/app/api/expediente/transcribir*`.

## El orden del pipeline es política, no estilo

```
audio → sesgo de vocabulario (ANTES de transcribir)
      → reconocedor
      → corrector léxico + guardián
      → cifras y unidades → siglas
      → guardián otra vez, sobre lo que él no vigiló
      → compuerta de ambigüedad
      → transcripción final
```

**El sesgo es lo único que cambia lo que el motor OYE.** El corrector, el
guardián y las marcas de confianza trabajan sobre lo ya oído: ninguno recupera
una palabra que nunca llegó. Por eso el vocabulario del paciente que está
enfrente pesa más que cualquier catálogo.

## El crudo nunca se borra

`transcripcionMotor` es lo que oyó el reconocedor; `transcripcionCruda` es el
texto de trabajo que el médico pudo editar. **Los dos se guardan.** De esa pareja
cuelga el aprendizaje y cualquier discusión medicolegal.

## Dos motores, un mismo contrato

La diarización se intenta primero y Whisper es el respaldo. **Todo lo que se le
manda a uno se le manda al otro** — y por los dos caminos, el corto (multipart) y
el largo (JSON de la consulta grande). Cablear sólo uno deja sin defensa a la
consulta más difícil. Ya pasó tres veces.

## Lo que se aprende del médico

Sólo sustituciones de **una palabra por una palabra**, vistas **dos veces**, que
no toquen cifra, unidad ni par prohibido (mg↔mcg, mL↔L, derecha↔izquierda), y
**nunca partes del nombre del paciente**: lo aprendido se comparte por
consultorio.

Y **sólo sesga**: saber qué palabra dice el médico no es permiso para cambiarla.

## El presupuesto del prompt

224 tokens en las rutas de Whisper; 1 000 términos en `universal-3.5-pro` y 200
en `universal-2`. **El orden decide qué entra.** Un recorte silencioso del
proveedor tiraría justo lo que más importa, así que el tope se presupuesta para
el modelo que se pide por su nombre.
