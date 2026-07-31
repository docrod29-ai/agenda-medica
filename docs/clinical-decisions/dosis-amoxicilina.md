# Decisión clínica — amoxicilina, redondeo y estructura del catálogo de dosis

**Fecha:** 2026-07-28
**Decide:** Dr. David Alonso Rodríguez Luna (médico dueño, medicina interna e infectología)
**Implementa:** software, sin elegir ningún umbral por iniciativa
**Cierra:** REG-041, REG-042 · **Deja abierto:** REG-043 (tabla del catálogo adulto)

---

## 1. Amoxicilina — no era elegir entre 1000 y 1500

La pregunta al médico fue «¿1000 o 1500 mg por toma?». Su respuesta fue que **la
pregunta estaba mal planteada**: 1500 mg no es un máximo, es simplemente el
resultado aritmético de una dosificación ponderal, y puede ser válido.

El problema real es que **un solo número no distingue** «fuera del uso habitual»
de «peligroso», y esa confusión era la que marcaba como sobredosis una receta
pediátrica correcta.

### Modelo aprobado

| Parámetro | Valor |
|---|---|
| Máximo habitual por toma | **1000 mg** |
| Máximo habitual diario (adulto) | **3000 mg/día** |
| Máximo absoluto por toma (perfil de dosis alta) | **2000 mg** |
| Máximo absoluto diario | **4000 mg/día** |
| 1001–2000 mg/toma | Requiere contexto/indicación de dosis alta → **aviso**, no crítica |
| > 2000 mg/toma | **Hard stop** |
| > 4000 mg/día | **Hard stop** |

### Fundamento citado por el médico

- UCSF: en pediatría, con 80–90 mg/kg/día el máximo **habitual** es 1000 mg por
  dosis BID — es un *usual maximum*, **no** una frontera de toxicidad; el máximo
  absoluto es 4000 mg/día.
- AAP / Red Book: amoxicilina-clavulanato en dosis alta 80–100 mg/kg/día del
  componente amoxicilina, **máx 2000 mg/dosis**, BID, para OMA, NAC o sinusitis
  en escenarios determinados.
- PIDS/IDSA: amoxicilina hasta 100 mg/kg/día con máximo adulto diario de 4 g en
  infección osteoarticular pediátrica.
- El adulto recibe amoxicilina 1 g cada 8 h en infecciones graves / NAC
  seleccionada, por lo que **1000 mg/toma tampoco es «dosis máxima tóxica»**.

### Caso que esto corrige

Niño de 35 kg a 90 mg/kg/día ÷ 2 = **1575 mg cada 12 h** (3150 mg/día). Está por
debajo de 2 g/dosis y 4 g/día y existen esquemas pediátricos que lo permiten. Ya
no aparece como «sobredosis»; aparece como *dosis alta: verifica indicación y
formulación*.

### Amoxicilina/clavulanato — pendiente explícito

El médico señaló que aquí hay que ser **más estricto**: no basta con vigilar la
amoxicilina. En dosis alta se usa la proporción **14:1** (≈90 mg/kg/día de
amoxicilina con 6.4 mg/kg/día de clavulanato), porque subir el clavulanato
innecesariamente incrementa sobre todo la toxicidad gastrointestinal — y cuatro
tabletas de 500/125 **no** son una dosis alta válida: disparan el clavulanato.

Hoy el combinado **hereda los límites del componente amoxicilina** y la nota del
catálogo advierte de la formulación. Los dos validadores separados
(`amoxicillinMg` y `clavulanateMg`) y la tabla de formulaciones (ES 600/42.9
mg/5 mL en pediatría, XR 2 g c/12 h en adulto) son **una unidad aparte**: exigen
datos de formulación que no se deducen de aquí.

---

## 2. Redondeo — hacia abajo cuando tocaría un tope

**Decisión:** redondear hacia abajo **cuando el redondeo excedería un tope**, y
volver a validar dosis/toma y dosis/día. No redondear todo hacia abajo siempre.

**Razón del médico:** aunque 0.1 mg sea clínicamente irrelevante, la salida
violaba una invariante que el propio objeto farmacológico declara, y el mismo
comportamiento puede producir una desviación mayor al cambiar la precisión, la
presentación o el número de administraciones.

Flujo implementado:

```
calcular dosis ponderal
→ aplicar límite por dosis
→ aplicar límite diario
→ redondear
→ re-verificar límite por dosis y por día
→ si el redondeo excede: bajar al escalón administrable inferior
```

No: `redondear → tolerancia de ±0.05 mg → aceptar la violación`. El epsilon
existe para la aritmética de punto flotante, **no** para modificar la regla
farmacológica.

Ejemplo: con `maxDiaria = 2000` y 3 tomas, la máxima salida compatible es
**666.6 × 3 = 1999.8**, no 666.7.

> Nivel siguiente (no incluido): redondear a una cantidad **administrable** según
> concentración y presentación, no a décimas de mg.

---

## 3. Catálogo adulto — sí ampliarlo, pero no con un solo número

**Decisión:** ampliarlo (hoy 20 de 25 fármacos pediátricos no tienen referencia
adulta y `revisarDosis` responde `sin_referencia`), **pero no** poniendo un
`maxDose`/`maxDaily` único por fármaco: eso introduce errores nuevos, porque los
máximos cambian por indicación, vía, función renal y formulación.

Ejemplos que el médico dio de por qué un único máximo falla: metronidazol (label
permite hasta 4 g/día frente a los 500 mg c/8 h habituales), ondansetrón (24 mg
VO dosis única en quimioterapia altamente emetógena; máx 16 mg/dosis IV; ≤8
mg/día en insuficiencia hepática grave), aciclovir (200/400/800 mg según
indicación y ajuste renal, hasta 4000 mg/día en zóster), prednisona (5–60 mg/día
como rango inicial, pero sin máximo universal), gentamicina/amikacina/vancomicina
(peso, función renal y TDM: un límite estático es conceptualmente incorrecto).

### Estructura objetivo

```
usualMaxPerDose · usualMaxPerDay
hardMaxPerDose  · hardMaxPerDay
route · indication · formulation
renalAdjustment · hepaticAdjustment
weightBased · weightType · requiresTDM
requiresIndicationOverride
source · sourceVersion · evidenceLevel
```

Con tres niveles de respuesta: **VERDE** (esquema habitual) · **AMARILLO**
(supera el habitual pero hay régimen respaldado para esa indicación) · **ROJO /
HARD STOP** (supera el absoluto aplicable a ese régimen, vía o formulación).

**Estado:** implementado el eje `usual` vs `hard` (que es el núcleo del cambio) y
aplicado a amoxicilina. El resto de campos y la tabla por fármaco quedan
**abiertos en REG-043**, a la espera de los datos del médico. No se inventan.
