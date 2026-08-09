# Cómo se mide, y qué se puede publicar

**Regla única de esta casa: una cifra que no distingue «producto» de «sin
producto» no se publica como desempeño.** La produce igual un competidor que no
haya escrito una línea de código.

## La ablación

Toda métrica de voz que se publique lleva pegada su **ablación**: la misma
medición con el motor conectado y con el motor borrado. La diferencia —el
**aporte**, en puntos porcentuales— es lo que de verdad aporta NexusMED.

Medido el **8-ago-2026** sobre las 6 000 frases de `fixtures/voz/corpus-v3-6000.csv`,
partiendo de la forma HABLADA:

| Categoría | n | Con motor | Sin motor | **Aporte** |
|---|---|---|---|---|
| Unidades | 216 | 99,54 % | 99,54 % | **0,00 pp** |
| Números | 498 | 50,60 % | 47,59 % | **3,01 pp** |
| Acrónimos | 1 738 | 44,42 % | 40,39 % | **4,03 pp** |

### Lo que esto obliga a decir

**El 99,54 % de unidades NO se publica como desempeño del producto.** Es el
comparador: `canonizar()` traduce «microgramos por kilo por minuto» a
`mcg/kg/min` por su cuenta, así que el término sobrevive tanto si el pipeline lo
tocó como si no. Es una cifra real y es una cifra inútil para juzgar el motor.

**En números y acrónimos el motor sí aporta** —3,01 y 4,03 puntos— pero la
exactitud absoluta ronda el 50 %, no el 99 %. Cualquier material que diga otra
cosa está describiendo un deseo, no una medición.

### La n también se declara

1 738 «acrónimos» no son 1 738 casos distintos: son **56 acrónimos distintos**
repetidos. 216 «unidades» son **25 unidades distintas**. Un porcentaje sobre
repeticiones dice menos de lo que parece, y ocultarlo sería el truco más viejo
del oficio.

## Lo que ya está medido y publicado

| Métrica | Valor | Con qué salvedad |
|---|---|---|
| WER crudo / tras pipeline | **25,55 % / 22,81 %** | whisper-1, **una sola voz sintética, sin ruido ni solapamiento**. Es un PISO de laboratorio, no una consulta real |
| Aporte del sesgo de vocabulario | el expediente aporta **2,01 pp** de 4,0 | n = 150 frases × 4 condiciones |
| Exactitud de turno (diarización) | **81,94 %** (59/72) · IC95 71,52–89,13 | **TECHO-ORÁCULO**: el mapeo etiqueta→rol se elige sabiendo la respuesta. Piso trivial del mismo sistema: 52,78 % |

## Lo que NO se puede publicar todavía, y por qué

- **Exactitud de hablante con n defendible** — hacen falta ~165 diálogos frente a
  los 12 actuales. La máquina genera el audio; **el oro lo tiene que firmar un
  médico**.
- **Exactitud de medicamento en los 5 campos** — no existe corpus de órdenes con
  nombre + cifra + unidad + vía + frecuencia.
- **Especificidad (falsos positivos)** — hacen falta renglones de receta
  correctos, y sólo un médico puede declarar que lo son.
- **Soporte real del artículo citado** — sólo un médico puede juzgarlo.

## Por qué esto es el foso

Ninguno de los productos de referencia —Suki, Nabla, Abridge, DAX— publica **WER,
tasa de alucinación, ni ablación** sobre un banco independiente. Ser el único que
enseña cuánto de su número es suyo vale más que tener el número más alto sin
poder demostrarlo.

**Un 94 % publicado y reproducible le gana a un 99 % afirmado.**
