# Corpus actuado de consulta — guion y verdad de terreno

**Material de prueba para medir el reconocimiento de voz. No es material
clínico**: ninguna frase de aquí es una indicación, una recomendación ni un
criterio. Lo único que importa de cada dosis o cifra es **que se transcriba tal
como se dijo**.

## Por qué existe

Los 6 000 audios que ya hay son de **una sola voz** leyendo frases sueltas.
Sirven para medir si el motor **oye** bien, y no sirven para lo otro: saber si
acierta **quién habló**.

Y de eso cuelgan las dos defensas que más trabajo han costado:

- La **negación**: «¿enfermedades crónicas como diabetes o presión alta?» «No.»
  Si el sistema atribuye ese «No» al médico en vez de al paciente, el motor de
  negaciones razona sobre una atribución falsa y responde con la misma seguridad
  que si fuera verdad.
- La **temporalidad**: «tuvo neumonía hace tres años» dicho por el acompañante no
  es lo mismo que dicho por el paciente.

Sin diálogo etiquetado no se puede medir ninguna de las dos.

## Cero pacientes reales

Todos los nombres son inventados y las voces son sintéticas. **La voz es
biométrica**: un audio «desidentificado» sigue identificando a quien habla, así
que el corpus de evaluación nace actuado, nunca de una consulta real. Esa regla
está en `.claude/rules/data-privacy.md` y no la cambia una prisa.

## Qué trae cada diálogo

| Campo | Qué es |
|---|---|
| `id` | Identificador estable |
| `pone_a_prueba` | Qué defensa ejercita: `negacion`, `temporalidad`, `dosis`, `lateralidad`, `acompanante`, `alergia` |
| `turnos[]` | `{rol, texto}` en orden. `rol` ∈ Médico · Paciente · Acompañante |
| `nota_esperada` | Lo que la nota **debería** afirmar y lo que **no**. Es lo que hace medible el resultado, no sólo la transcripción |

## Cómo se convierte en verdad de terreno

`scripts/generar-corpus-dialogo.ts` sintetiza **cada turno por separado**, con
una voz distinta por rol, y los concatena con un silencio corto en medio. Como
la duración de cada trozo se mide con `ffprobe` **después** de generarlo, el
manifiesto sale con el milisegundo exacto en que empieza y termina cada turno.

Eso es lo que permite medir de verdad:

- **Atribución de rol**: ¿el sistema dijo «Paciente» donde el guion dice Paciente?
- **Diarización**: ¿partió el audio en las voces correctas y en los sitios
  correctos?
- **Y lo que de verdad importa**: ¿la nota afirma lo que el guion dice que debe
  afirmar, y calla lo que debe callar?

## Lo que este corpus NO mide

- **Acústica real.** Es texto a voz limpio: sin ruido de consultorio, sin
  solapamiento verdadero, sin la sala. Un WER medido aquí es un **piso**, no lo
  que se va a ver en su consultorio.
- **Acento y variedad de hablante.** Las voces del proveedor no son una muestra
  de la población mexicana.
- **Solapamiento.** Dos personas hablando encima sólo se produce con audio
  actuado por personas de verdad, no concatenando turnos.

Se dice aquí para que nadie use este número como si fuera otro.
