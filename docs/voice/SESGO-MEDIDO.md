# Cuánto rinde sesgar el motor con el expediente del paciente

**Fecha:** 5 de agosto de 2026 · **Motor:** `universal-3-5-pro` · **Muestra:** 150 frases del corpus clínico, audio válido, semilla fija

Reproducible:

```bash
npx tsx scripts/medir-sesgo-vocabulario.ts ~/Downloads/NexusMED_V3_UNA_VOZ_CORAL 150
```

Las transcripciones se guardan; repetir la medición no vuelve a pagar.

---

## El resultado

| Condición | Término clínico acertado | WER |
|---|---:|---:|
| Sin sesgo | 78,89 % | 26,26 % |
| Sólo catálogo genérico | 80,90 % | 23,20 % |
| **+ expediente del paciente** | **82,91 %** | **22,07 %** |
| + tope ampliado (491 términos) | 83,42 % | 22,35 % |

**El sesgo completo aporta 4,0 puntos de acierto clínico y baja el WER 4,2
puntos.**

Y se reparte en dos mitades que no valen lo mismo:

- **2,01 pp** los da el catálogo genérico. Eso lo puede hacer cualquier producto.
- **2,01 pp** los da el **expediente del paciente**. Eso exige tener la historia
  clínica y el motor de voz en la misma mano.

La segunda mitad es el foso, y ahora tiene número.

### Términos que **sólo** rescata el expediente

`erisipela` · `pielonefritis enfisematosa` · `HFNC` · `PCWP` · `NEWS2`

Sin el expediente del paciente se perdían.

### Sobre ampliar el tope

Subir de 200 a 491 términos aporta **+0,50 pp de acierto clínico** pero **empeora
el WER en 0,28 pp**. Más vocabulario ayuda a cazar la palabra rara y mete algo de
ruido en el resto.

Se despliega con el tope grande porque **el acierto clínico manda sobre el WER**:
una dosis bien oída vale más que tres artículos bien puestos. Pero es un ajuste
fino, no la palanca.

---

## Por qué esta medición encontró un defecto grave

La primera corrida dio **0,00 pp de aporte**. No cuadraba, y al perseguirlo
apareció REG-167: la ruta mandaba `word_boost` junto a una **lista** de modelos,
y como ese parámetro es incompatible con `universal-3-5-pro`, el proveedor
descartaba el modelo bueno y corría con `universal-2` — sin error y sin aviso.

Es decir: **el parámetro puesto para mejorar la precisión estaba degradando el
motor en cada consulta**, y la medición comparaba modelos en vez de sesgos.

Los números de arriba son de **después** de repararlo, con las cuatro condiciones
sobre el mismo motor.

---

## Límites — esto es un piso de laboratorio

- **Una sola voz sintética.** No mide acentos, edad, prosodia ni patología del
  habla.
- **Sin ruido de consultorio, sin solapamiento, sin distancia al micrófono.**
- La condición «expediente del paciente» asume que el término **ya está** en el
  expediente. En una consulta real, un fármaco que se prescribe por primera vez
  puede no estarlo: es el techo, no el caso medio.

En consulta real los valores absolutos serán peores. Lo que se sostiene es la
**diferencia entre condiciones**, que es lo que esta medición existe para
establecer.

Datos crudos en [`SESGO-MEDIDO.json`](SESGO-MEDIDO.json).
