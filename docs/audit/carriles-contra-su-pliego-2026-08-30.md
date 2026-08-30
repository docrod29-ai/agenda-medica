# Los dos carriles, medidos contra su propio pliego — 30-ago-2026

> **Por qué existe este documento.** Los dos pliegos del dueño vivían en
> conversaciones de chat. El 30-ago se guardaron en `docs/ai/`
> (`AUSCULTA-MASTER-COMPLETION-LOOP.md` y
> `AUSCULTA-PRODUCT-EXCELLENCE-LOOP.md`). Por primera vez se puede comprobar
> si cada carril está haciendo lo que su pliego pide, en vez de suponerlo.
>
> Esto **no** es una auditoría del código. Es una comprobación de cobertura:
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

**Huecos medidos contra §1 (custodia del programa).** §1 dice: *«Ningún
requisito puede desaparecer simplemente porque cambió el documento»*. Contando
menciones en `docs/product/AUSCULTA-MASTER-BOARD.md`:

- **`Automation` — 0 menciones.** El §16 del pliego existe y el tablero no lo
  custodia con estado.
- **`Production Readiness` — 0 menciones en el tablero.** Existe como documento
  aparte (`AUSCULTA-CONSULTORIO-FINAL-READINESS.md`), que no es lo mismo que
  llevarlo en la lista de requisitos con estado inequívoco.
- **Las metas intermedias de escala no están.** §1 exige custodiar
  15k / 20k / 30k / 50k / 100k usuarios y 10k / 20k / 30k / 50k pacientes por
  médico. En el tablero aparecen `100 k usuarios` y `50 000`, **una vez cada
  una**; 15k, 20k y 30k no aparecen.

Los demás dominios del §1 sí están, en español: verdad clínica (3), voz (4),
aprendizaje (1), observabilidad (1), respaldo/restauración (19),
especialidad (2).

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
