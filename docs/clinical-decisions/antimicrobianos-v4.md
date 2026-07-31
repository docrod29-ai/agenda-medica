# Motor de inteligencia antimicrobiana V4

## Fuente de verdad

`NexusMED_Antibacterial_Dosing_V3_EVIDENCE_VERIFIED.json`, entregado por el Dr.
Rodríguez el 30-jul-2026 y sellado por SHA-256 en
`src/lib/antimicrobianos/v4/data/dosing-v3-verificado.json`
(`924573038c4befcef87059512378b87de46dd8a435a0a5b756811a8eb88b3005`).

49 fármacos · 39 fuentes · 12 reglas de motor. El propio dataset declara 20
antibióticos **pendientes** de verificar. **No se rellenan de memoria.**

El software no aporta ni una cifra clínica: aporta la forma, las comprobaciones
y el orden en que se preguntan las cosas.

## Referencia

- FDA / DailyMed (etiquetado vigente)
- IDSA 2026 (guía de resistencia antimicrobiana)
- CLSI M100 Ed36 (2026) y EUCAST v16.1 (2026), **versionados por separado**
- Consenso y metaanálisis de PubMed para PK/PD y TDM

El dataset advierte explícitamente que **Sanford no se usó** y que no se puede
afirmar validación cruzada con Sanford sin una integración licenciada.

## Decisión: por qué desaparece `drug.maxDose`

Un antibiótico no tiene «una dosis máxima». Tiene máximos distintos según la
indicación, el sitio, el microorganismo, la CMI, la función renal, el peso, la
estrategia PK/PD y la formulación. Con un solo número quedan marcadas como error:

- ceftriaxona 2 g q12h en meningitis,
- daptomicina 10 mg/kg/día,
- meropenem 2 g q8h en 3 h con aclaramiento aumentado.

Las tres son cosas que un intensivista hace cada semana. Una alerta que se
equivoca en lo cotidiano enseña a ignorarla, y el día que tenga razón tampoco se
va a leer.

En su lugar: `usualMax` / `contextualMax` / `absolutoMax` + `tipoMaximo`
(`EXPLICIT` · `CONTEXTUAL` · `PKPD_DEPENDENT` · `TDM_DEPENDENT` · `NONE`).

## Decisión: faltar un dato no es lo mismo que estar mal

Son dos respuestas distintas y el motor las da por separado:

- amikacina sin peso → una pregunta sin responder, no una dosis peligrosa;
- colistina «150 mg» sin CBA/CMS/UI → una unidad ambigua;
- ceftriaxona 2 g q12h en meningitis → por encima de lo habitual y correcta.

Lo que decide el veredicto por encima de lo usual es el **origen** de la pauta
(ficha / guía / PK-PD / off-label respaldado), **no la magnitud**.

## Decisión: la prosa clínica no se parsea

Los campos del dataset son texto: «eGFR 30-49: 2 g q8h; 15-29: 2 g q12h; <15:
1 g q12h». Convertir eso en números es parseo, y un fallo de parseo aquí **no
produce un error visible**: produce una dosis distinta que en pantalla se ve
igual de segura que la correcta.

El texto verificado se entrega íntegro. La estructura sólo se emite cuando la
lectura es inequívoca; lo demás sale como `UNKNOWN_INSUFFICIENT_DATA`.

## Decisión: la pauta de CrCl <10 no es la pauta de CRRT

`RULE_CRRT_NO_GENERIC`. La mayoría de los 49 fármacos dice literalmente «No
automatic CRRT rule». Un motor que ante un anúrico en CVVHDF cayera a la fila de
insuficiencia renal grave daría una dosis plausible, ordenada y **baja**, e
infradosificaría al enfermo más grave de la unidad — el que menos margen tiene.
Sale como valoración de especialista: es incómodo y es correcto.

## Defecto abierto del dataset (no lo arregla el software)

`RULE_SOURCE_SEPARATION` es una regla HARD y **11 de las 49 entradas la
incumplen**: la dosis de ficha y la de guía vienen fusionadas en una sola cadena,
copiada en los dos campos. Entre ellas ceftazidima/avibactam y ceftriaxona. Y 46
de 49 tienen los dos campos idénticos.

El motor lo **detecta y lo declara**; no parte la frase. Separar «2 h» de «3 h»
con una expresión regular sería justo el parseo con consecuencia clínica que este
diseño evita. Callarlo sería peor que el defecto: la aplicación afirmaría que
respeta una regla que su propia fuente no respeta.

## Dónde vive

- `src/lib/antimicrobianos/v4/tipos.ts` — el vocabulario: `LimitesDosis`,
  `ReglaDosis`, `FuncionRenal`, `TerapiaReemplazoRenal`, `Microbiologia`.
- `src/lib/antimicrobianos/v4/kernel.ts` — el Safety Kernel: `evaluar`,
  `datosQueFaltan`, `unidadAmbigua`, `dejaPasar`.
- `src/lib/antimicrobianos/v4/resolver.ts` — `resolveDoseRule`, `fusionadas`.
- `src/lib/antimicrobianos/v4/catalogo.ts` — `buscarFarmaco`, `candidatos`,
  `estaPendiente`, `reglasDuras`, `HUELLA_DATASET`.
- `src/lib/antimicrobianos/v4/limites.ts` — `revisar`, `limitesDe`, `utilizable`,
  `avance`. Los topes los carga el médico con su fuente; el software sólo revisa
  la coherencia interna (orden de los máximos, cifras positivas, unidad, fuente).
- `src/app/(dashboard)/uci/antimicrobianos` — probar un caso y cargar los topes.

## Golden

- `src/__tests__/antimicrobianos-v4-kernel.test.ts` — los ocho estados y los seis
  escenarios que el Dr. planteó al pedir el motor.
- `src/__tests__/antimicrobianos-v4-catalogo.test.ts` — integridad del dataset
  (huella, fuentes, pendientes) y que buscar un fármaco no sea adivinarlo.
- `src/__tests__/antimicrobianos-v4-resolver.test.ts` — las doce reglas del motor
  sobre fármacos reales del catálogo.
- `src/__tests__/antimicrobianos-v4-limites.test.ts` — que ninguna cifra pase sin
  fuente y que los topes vayan en orden (un habitual por encima del contextual
  invierte el significado de la alerta).

## NEEDS_CLINICAL_REVIEW

1. Cargar los límites (`usualMax` / `contextualMax` / `absolutoMax`) por fármaco
   e indicación. **Sin ellos el kernel responde `UNKNOWN`, que es lo correcto**,
   pero el motor todavía no puede juzgar una cifra. La pantalla para hacerlo ya
   existe: `/uci/antimicrobianos`, pestaña «Cargar topes». Ninguna cifra viene
   sugerida — un campo pre-llenado se acepta, y aquí lo que habría puesto el
   programa no lo sabe nadie.
2. Separar los 11 campos fusionados en `label_regimen` y `guideline_regimen`.
3. Completar los 20 antibióticos pendientes.
4. `Vancomycin PO` y `Metronidazole` no declaran fuentes.
