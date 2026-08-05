# El WER de NexusMED, medido

**Fecha:** 4 de agosto de 2026 · **Motor:** `whisper-1` · **Corpus:** 6 000 frases clínicas, una voz sintética (`coral`)

Reproducible sin gastar nada:

```bash
npx tsx scripts/medir-wer-limpio.ts ~/Downloads/NexusMED_V3_UNA_VOZ_CORAL
```

Reutiliza las 5 999 transcripciones ya pagadas; no llama a ningún proveedor.

---

## Los dos números, y por qué se publican los dos

| | Todo el corpus | Sólo audio válido |
|---|---:|---:|
| Frases medidas | 5 999 | **4 635** |
| WER crudo | 35,77 % | **25,55 %** |
| WER tras el pipeline | 29,37 % | **22,81 %** |
| Términos clínicos evaluados | 10 097 | 5 690 |
| · sobreviven crudos | 66,95 % | 71,35 % |
| · sobreviven tras el pipeline | 67,37 % | **71,48 %** |

**1 364 filas (el 23 %) tienen el audio corrupto** y quedan fuera de la segunda
columna. No es un defecto del reconocedor: el generador del corpus expandió las
unidades sin límite de palabra y grabó frases que no existen en español —
«microgramos ramos», «agramosua», «Hemogramoslobina»—. El texto de referencia
espera la palabra correcta, así que cada una de esas filas cuenta como error del
motor sin que el motor haya fallado.

Se publican **los dos números** a propósito. Dar sólo el segundo, sin decir qué
se excluyó y por qué, sería elegir la cifra que conviene. Y el tamaño de lo
excluido es en sí mismo un resultado: dice cuánto del corpus hay que regenerar.

---

## Lo que dicen estos números

**El corpus roto costaba 10 puntos de WER.** 35,77 % contra 25,55 %. Cualquier
decisión tomada mirando el primero estaba mirando, en buena parte, un defecto del
generador de datos.

**El pipeline baja el WER 2,74 puntos** (25,55 % → 22,81 %) sobre audio válido.

**Y casi no mueve el recall de términos clínicos** (71,35 % → 71,48 %, +0,13 pp).
Esto merece decirse claro: el pipeline limpia el texto, pero **no recupera el
término clínico que el motor no oyó**. Es coherente con lo que ya está escrito en
el código: el sesgo de vocabulario es lo único que cambia *lo que el motor oye*, y
todo lo que viene después trabaja sobre lo que ya se oyó.

Ahí está la palanca real, no en más post-proceso.

---

## Límites — esto es un piso de laboratorio

- **Una sola voz sintética.** No es una muestra de hablantes reales; no mide
  acentos, edad, prosodia ni patología del habla.
- **Sin ruido de consultorio, sin solapamiento, sin distancia al micrófono.**
- **Frases sueltas**, no consultas completas con su contexto.
- El motor medido es `whisper-1`, que es el de respaldo. La ruta real intenta
  primero la separación de voces (AssemblyAI).

Un número de laboratorio es un **piso**: en consulta real será peor. No debe
citarse como «precisión de NexusMED» sin estas líneas al lado.

---

## Qué hace falta para cerrar el hueco

1. Reparar el CSV — `scripts/reparar-corpus-expansion.ts` ya deja 1 322 de las
   1 364 filas verificadas contra el texto de referencia.
2. **Volver a sintetizar el audio de esas filas** (gasto de TTS, decisión del
   dueño).
3. Repetir esta medición: el número de «audio válido» debería acercarse al de
   «todo el corpus» y, sobre todo, dejar de haber dos.

Los datos crudos quedan en [`WER-MEDIDO.json`](WER-MEDIDO.json).
