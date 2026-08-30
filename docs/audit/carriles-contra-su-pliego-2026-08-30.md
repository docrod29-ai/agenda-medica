# Los dos carriles, medidos contra su propio pliego — 30-ago-2026

> **Por qué existe este documento.** Los dos pliegos del dueño vivían en
> conversaciones de chat. El 30-ago se guardaron en `docs/ai/`
> (`AUSCULTA-MASTER-COMPLETION-LOOP.md` y
> `AUSCULTA-PRODUCT-EXCELLENCE-LOOP.md`). Por primera vez se puede comprobar
> si cada carril está haciendo lo que su pliego pide, en vez de suponerlo.
>
> Esto **no** es una auditoría del código. **Corregido el 30-ago a las 17:00**:
> la primera versión acusó al carril A de perder requisitos que no había perdido.
> La corrección está en su sitio, sin borrar el error. Es una comprobación de cobertura:
> qué secciones del pliego tienen trabajo y cuáles no lo tienen todavía.

---

## Los dos carriles SÍ están trabajando

Medido el 30-ago a las 16:20 UTC:

| Carril | Rama | Último commit | Ritmo |
|---|---|---|---|
| **A — Master Completion** | `claude/ausculta-master-completion-4clx9v` | 15:57 | REG-404 … REG-411 en el día |
| **B — Product Excellence** | `product/ausculta-product-excellence` | 15:17 | 51 commits · 296 archivos · +16 389 líneas |

Ninguno está parado. La pregunta no era ésa; era si hacen **lo que dice su
pliego**.

---

## Carril A — Master Completion

**Lo que sí ejecuta**, con commits de hoy que lo demuestran:

| § del pliego | Evidencia |
|---|---|
| §10 WS-10 Patient State | REG-405, 406, 407, 410 · censo `WS-10.pantalla-de-certeza` |
| §11 WS-11 Ciclo cerrado | REG-403, 404 · censo `WS-11.interconsultas-imagen` |
| §14 Voice | REG-409 — «un WER bajo no compensa una dosis por mil», que es literalmente lo que §14 exige: *WER global NO es suficiente* |
| §2 WS-02 Escala | REG-408 — «100 000 usuarios no nombraba ningún experimento» |
| §22 Anti-repetición | los tres REG que chocaban con `main` se renumeraron a 501-503 en vez de duplicarse |

**Lo que dije que faltaba, y era FALSO — corregido el mismo día.**

La primera versión de este documento afirmó que el tablero había perdido
`Automation`, `Production Readiness` y las metas intermedias de escala
(15k / 20k / 30k). **No era cierto, y el error era de método**: conté menciones
en el markdown y llamé «desaparecido» a lo que estaba en otro sitio.

El programa las tiene todas, en `src/lib/programa/requisitos.ts`, con estado y
evidencia, y con `el-programa-no-pierde-requisitos.test.ts` vigilando que los
21 dominios y los once escalones no se caigan. Ese censo se escribió
precisamente porque seis dominios enteros SÍ se habían perdido antes —voz,
aprendizaje, autoridad de la automatización, WhatsApp, razonamiento,
accesibilidad—, y el carril A ya había cerrado ese agujero.

Se deja escrito en vez de borrarse porque una acusación falsa que desaparece
sin dejar rastro se vuelve a hacer.

**El hueco REAL, que sí existía.** Las metas vivían **sólo en TypeScript**. El
tablero en prosa —el que lee una persona, y del que salen las notas de PR y el
`FINAL-READINESS`— nombraba `100 k` y `50 000` una vez cada uno; 15k, 20k y 30k
no aparecían en ninguna línea.

El §1 no pide que los objetivos existan: pide **custodiarlos**. Un objetivo que
sólo vive en un archivo de código está guardado, no custodiado — y es
exactamente por eso que el dueño, leyendo el tablero, no reconocía el estado que
se le reportaba.

**Cerrado el 30-ago**: el tablero deriva ahora ese bloque del censo
(`censo-en-prosa.ts` + `scripts/product/censo-al-tablero.mjs`), con
`el-tablero-ensena-las-metas.test.ts` como guardián, probado al revés en los dos
sentidos —tablero sin bloque y censo sin una meta—. Los demás dominios del §1 ya
estaban en el tablero, en español: verdad clínica (3), voz (4), aprendizaje (1),
observabilidad (1), respaldo/restauración (19), especialidad (2).

---

## Carril B — Product Excellence

**Lo que sí ejecuta.** Su bitácora propia (`docs/audit/lane-product-excellence.md`)
lleva 16 defectos encadenados, y el encadenamiento es real: cada uno apareció al
comprobar el anterior.

| § del pliego | Evidencia |
|---|---|
| §3 Inventario de pantallas | `SCREEN_INVENTORY.md` generado, 80 pantallas, con guardián que falla si se queda atrás |
| §4 Staticness audit | `techos-de-estaticidad.json` |
| §5 Motion system | `lib/ui/movimiento.ts` · `prefers-reduced-motion` con guardián |
| §6 Microinteractions | «dieciséis botones en la consulta, ninguno acusaba el puntero» |
| §17 Error states | fallo de red ≠ contraseña equivocada · el fallo del dictado se anuncia |
| §24 Design tokens | el tema claro duplicado, cerrado token a token; literales de Tailwind → tokens semánticos |
| §26 Accesibilidad | contraste medido en WCAG 2.1 · orden del tabulador · objetivos táctiles · caja con scroll alcanzable por teclado |
| §32 No silent loss | «automático» sobrevive a la recarga |

**Huecos medidos:**

- **WebKit: 0 menciones en 51 commits.** §21 lo exige explícitamente y §38 dice
  con todas las letras que *«se ve bien en Chromium» no demuestra WebKit*. 390 px
  sí se mide (30 menciones). Éste es el mismo hueco que WS-05 tiene declarado en
  el otro carril: **falta el dispositivo**, no la intención. Queda
  `BLOCKED_EXTERNAL` con desbloqueo concreto: un iPhone real, o WebKit en el
  entorno de pruebas.
- **Benchmark: `Abridge` 0 menciones.** §29 y §30 piden comparar principios
  contra Abridge, Linear, Stripe, Apple, Perplexity. No hay trabajo de esa
  familia todavía.
- **Lectura, no medición**: los 16 defectos de la bitácora son **correcciones**
  —tema, contraste, teclado, foco, mensajes— no rediseño de jerarquía, densidad,
  tipografía o identidad. Es la mitad de «corrección» del pliego. La mitad de
  «excelencia visual» —§7 jerarquía, §8 card fatigue, §22 tipografía,
  §23 ritmo, §25 identidad, §9 la consulta como command center— **todavía no
  ha empezado**, y es la que sostiene la misión declarada del pliego:
  *«que una captura sin logo pueda empezar a sentirse Ausculta»*.

---

## Lo que este documento NO afirma

- No dice que el trabajo hecho esté mal. Los 16 defectos del carril B son
  reales y varios eran de seguridad clínica percibida (un valor de laboratorio
  crítico con contraste 3,79 sobre 4,5 exigido).
- No mide calidad de implementación: cuenta cobertura de secciones del pliego.
- El conteo de menciones es un indicio, no una prueba. Un dominio puede estar
  custodiado con otras palabras. Por eso los términos se buscaron en español y
  en inglés antes de declarar un cero.

---

## Ficha para el ledger — REG sin número todavía

> **Por qué sin número.** `docs/audit/regression-ledger.md`,
> `docs/quality/FAMILIAS-DE-DEFECTO.md` y
> `src/lib/calidad/familias-de-defecto.ts` los está editando el carril A hoy
> mismo, y el guardián `de-que-se-enferma-este-sistema` obliga a tocar los tres
> a la vez. Meter aquí un número sería chocar en el número **y** en el texto.
> Es el mismo precedente que ya estableció el carril B en
> `docs/audit/lane-product-excellence.md`: **el número se asigna al fusionar**.
> Lo que no puede pasar es que se pierda.

**Título** — El tablero que se lee omitía nueve de las once metas del §1.

**Qué fallaba.** El §1 del pliego manda conservar 15k/20k/30k/50k/100k usuarios
registrados y 10k/20k/30k/50k pacientes por médico. El censo
(`src/lib/programa/requisitos.ts`) los tenía los once, con estado y evidencia.
`AUSCULTA-MASTER-BOARD.md` —el tablero que lee una persona, y del que salen las
notas de PR y el `FINAL-READINESS`— nombraba `100 k` y `50 000` una vez cada
uno. 15k, 20k y 30k no aparecían en ninguna línea.

**Cómo se descubrió.** Contando menciones en el tablero, el 30-ago, al medir los
carriles contra los pliegos recién guardados en `docs/ai/`. La primera lectura
fue peor que el defecto: concluyó que el programa había perdido los requisitos.
No los había perdido — los tenía donde una persona no los ve.

**Causa raíz.** Dos representaciones del mismo programa, una legible por máquina
y otra por personas, **sin nada que las ate**, y la incompleta era la que se lee
en voz alta. `depende_de_recordar`, el patrón de REG-241.

**Qué se hizo.** Lo derivable se deriva. `bloqueDelCenso()` vive dentro del
propio censo —no en un módulo nuevo, para no mover el techo de islas ni las
listas de otros dos guardianes—; `scripts/product/censo-al-tablero.mjs` lo
escribe en el tablero; `el-tablero-ensena-las-metas.test.ts` falla si el tablero
se queda atrás. **El censo sigue siendo la única fuente de verdad.**

**Efecto lateral, y es el bueno**: `requisitos.ts` era un huérfano aceptado —su
único consumidor era el guardián que lo sella— y ha dejado de serlo. Sale de
`HUERFANOS_ACEPTADOS` porque se conectó, no porque se le escribiera una excusa
mejor.

**Probado al revés, dos veces.** (1) Tablero sin el bloque, como estaba a las
16:00: 4 casos en rojo. (2) Alguien borra `30_000` del censo: 2 casos en rojo.
Restaurado, los 5 en verde.

**Qué NO cubre.** No comprueba que un estado sea verdad — de eso responde el
guardián del censo. No vigila la prosa escrita a mano fuera de las marcas. Y no
demuestra que alguien lo lea: demuestra que ya no se puede decir que no estaba.

**Compuertas** — `npx vitest run`: 11 593 pasan, 1 falla (`ops-timeout`, del
entorno, sin tocar). `lint-trinquete`: 95, igual que el techo.
`npx tsc --noEmit`: limpio. `npm run build`: compila.
