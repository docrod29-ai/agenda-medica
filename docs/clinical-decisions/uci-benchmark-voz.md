# ADR · Benchmark de voz (§41)

**Motor:** `uci-benchmark-voz` · `src/lib/uci/benchmark-voz.ts`
**Estado:** `validado` — el motor. **El dataset no existe todavía.**

## Fuente de verdad

Charter §41. Métricas estándar de reconocimiento de voz: **WER** sobre palabras
(distancia de edición), y **exactitud por término**.

## Referencia

Métricas estándar de reconocimiento automático del habla: **WER** (word error
rate) por distancia de edición sobre palabras, y exactitud por término. Ninguna
fuente clínica: son métricas de ingeniería de voz.

## Por qué el WER no basta

El WER trata «el» y «norepinefrina» como si valieran lo mismo. En un pase de
visita no valen lo mismo: perder un artículo no cambia nada, perder «PEEP»
arruina el dato.

Un caso del golden congela exactamente eso: una frase con **1 palabra mal de 9**
—WER < 0.2, que «suena excelente»— donde la única palabra perdida es la única
que llevaba información clínica.

Por eso **la métrica que manda es la exactitud por término clínico**, y el WER
se reporta al lado sólo como referencia comparable con la literatura.

## Lo que el módulo NO hace

**No corrige.** Mide. Las confusiones que encuentre son material para
`CONFUSIONES_CONOCIDAS`, pero meterlas ahí es una decisión revisada, no un efecto
secundario de medir. Un caso comprueba que no existe ninguna función de
corrección o entrenamiento.

**No fija una nota de aprobado.** `muestraSuficiente()` avisa cuando hay tan
pocas frases que el porcentaje engaña, pero qué exactitud es «suficiente» es una
decisión operativa que nadie ha tomado.

## Dato faltante

Un término que **no está en el gold** no se evalúa: ni a favor ni en contra. Si
ninguna frase trae términos clínicos, la exactitud es **`null`, no 100 %** —
contar frases sin nada que vigilar como éxito inflaría la métrica.

## El dataset: por qué no lo puedo fabricar

Un conjunto sintético mediría **lo bien que yo imito el habla de UCI**, no lo
bien que la aplicación entiende la del médico: su acento, el ruido de sus
ventiladores, cómo abrevia él y cómo abrevia su residente. Un benchmark inventado
daría un número bonito y falso, que es peor que no tener número.

**`NEEDS_CLINICAL_REVIEW` / ICU-Q1:** el material lo aporta la unidad.

## PHI

**No se graban pases reales.** El guion son casos ficticios: se habla igual que
en la unidad —mismo acento, misma jerga, mismo ruido— pero el paciente lo inventa
el médico. Se mide igual de bien y no hay nada que proteger. La pantalla lo dice
en rojo antes de la primera grabación.

## El guion

Se compone con el vocabulario que la aplicación **ya conoce**
(`VOCABULARIO_POR_CONTEXTO`); no se inventa terminología. Los números son
arbitrarios y **no son recomendaciones clínicas**: sirven para oír cómo se
pronuncian.

## Golden

`src/__tests__/uci-benchmark-voz.test.ts` — **26 casos**.

| Congela |
|---|
| «peep» por «pip» es **un** error, no dos |
| Un WER bajo puede esconder la pérdida del dato que importa |
| Un término ausente del gold no cuenta ni a favor ni en contra |
| Inventar el término en la transcripción no lo hace acertado |
| Sin términos evaluados, la exactitud es `null`, **no** 100 % |
| Un punto final no es una palabra distinta; el decimal y el rango **sí** se conservan |
| No existe ninguna función que corrija o entrene |
