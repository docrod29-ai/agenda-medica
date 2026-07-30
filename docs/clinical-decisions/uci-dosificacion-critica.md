# ADR · Dosificación de meropenem en el adulto crítico

**Motor:** `uci-dosificacion-critica` · `src/lib/uci/dosificacion-critica.ts`
**Estado:** `validado` para lo que el Dr. entregó. **Sólo meropenem.**

## Fuente de verdad

**Algoritmo entregado por el Dr. David Alonso Rodríguez Luna el 2026-07-30**, con
su tabla por función renal, sus cuatro escenarios de reemplazo, sus criterios de
alta exposición y sus advertencias.

El Dr. cita como respaldo la ficha estadounidense actualizada en mayo de 2025
(ajuste con CrCl ≤ 50 mL/min), el esquema de UCSF, el consenso
ACC­P/BSAC/ESCMID/IDSA/SCCM/SIDP sobre infusiones prolongadas, simulaciones de
PTA en ARC y datos de PIRRT de 2026.

**Fundamento aportado por el médico**, no verificado por mí contra las fuentes
primarias: la decisión se registra como suya.

## Referencia

Farmacocinética/farmacodinamia de betalactámicos. El objetivo que el Dr. señala
como práctico en el crítico es **100 % fT>MIC**, más exigente que el clásico
40 %; y descarta explícitamente perseguir 100 % fT>4×MIC en todos.

## La regla que organiza el motor

> «Yo **NO** programaría meropenem simplemente como CrCl → dosis.»

El orden que él fija: **foco y gravedad → CrCl → detectar ARC → identificar
IHD/CRRT/PIRRT → conocer MIC → elegir dosis → elegir duración de infusión → TDM
y reajuste.**

Por eso el motor **no recibe un CrCl y devuelve una dosis**: recibe el escenario
y devuelve el esquema, o dice qué falta.

## El error que este motor existe para impedir

> «CRRT: aquí **NO** usaría el ajuste de falla renal convencional. Un enfermo con
> CrCl prácticamente cero sin diálisis puede requerir 500 mg c/24 h, mientras que
> un paciente anúrico conectado a CVVHD/CVVHDF puede requerir **varios gramos
> diarios** porque el filtro elimina meropenem.»

Un paciente en CRRT tratado como «CrCl < 10» queda **gravemente
infradosificado**. Es rama propia, y un caso lo congela: con `crCl: 5` y
`modalidad: 'crrt'` el esquema es **1 g c/8 h**, no 500 mg c/24 h.

## El motor NO elige la columna

El Dr. da dos columnas y advierte que **«la de alta exposición NO significa que
todo paciente crítico deba recibir 6 g/día»**.

El motor devuelve **las dos**, lista **qué criterios de alta exposición se
cumplen** en este paciente, y marca `eligeElMedico: true`. Un caso comprueba que
no existe ninguna función con nombre de recomendar / elegir / sugerir.

## Dato faltante

**Sin la modalidad de reemplazo no se propone nada** (`esquema: null`). Proponer
una dosis sin saber si está en CRRT es exactamente el error grave de arriba.

Sin CrCl y sin terapia de reemplazo, tampoco. La MIC ausente y la falta de TDM se
declaran como avisos.

## Lo que NO está, y por qué

`FARMACOS_SIN_ALGORITMO` declara trece fármacos sin algoritmo cargado. El Dr.
entregó el de meropenem; **los demás no se deducen de él**: cada uno tiene su
farmacocinética, su aclaramiento por filtro y su objetivo PK/PD. Copiar la pauta
del meropenem a la vancomicina **sería inventarla**.

La pantalla lo dice en vez de callarse.

## Golden

`src/__tests__/uci-dosificacion-critica.test.ts` — **24 casos**.

| Congela |
|---|
| Las cuatro filas de la tabla renal, con sus cifras |
| **CRRT no aplica la tabla renal** |
| PIRRT no se maneja como CrCl < 10; HD se administra después de la sesión |
| El motor devuelve las dos columnas y **no elige** |
| Sin modalidad, `esquema: null` |
| ARC se detecta del CrCl ≥ 130 y avisa; por debajo **no se inventa** |
| «La resistencia no se vence con dosis» sale siempre |
| Sólo hay algoritmo de meropenem, y la ausencia se **dice** |

## Pendiente del Dr.

Los algoritmos de los otros fármacos. Cada uno como éste: su tabla, sus
escenarios de reemplazo, sus criterios. **No los infiero.**
