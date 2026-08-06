# Programa nocturno — la mejor inteligencia médica del mundo

**Encargo del Dr., 5-ago-2026:** «trabaja toda la noche en mejorar la inteligencia
artificial de la app… un equipo de 30 agentes… que la aplicación tenga una
interfaz amigable, fácil de usar pero muy sofisticada y tecnológica… tiene que
ser la mejor aplicación del mundo compitiendo con las de USA, Europa, Suiza,
Dinamarca».

**Este archivo es la bitácora reanudable.** Si se acaban los créditos o el
internet, el avance NO se pierde: se retoma desde aquí, no desde cero.

---

## Estado al arrancar (verificado en producción)

| | |
|---|---|
| Versión viva | `nexusmed-v1064` |
| Pruebas | 6795 en verde |
| Lint | 97 (techo, sin deuda nueva) |
| WER medido | 25,55 % crudo · 22,81 % con el pipeline |
| Foso de vocabulario medido | 78,89 % → 80,90 % (catálogo) → 82,91 % (expediente) |

### Lo cerrado esta noche, antes de arrancar el programa

| Versión | Qué |
|---|---|
| v1061 | REG-177 · «No especificada» deja de entrar como dato (prompt + esquema) |
| v1062 | REG-178 · el aviso de operación deja de cortar la consulta |
| v1063 | REG-179/180 · la contradicción del prompt que fabricaba el recuadro naranja; el reporte de manipulación que zod borraba; `Spiolto` al vocabulario |
| v1064 | REG-181 · ocho recuadros → una barra de tres niveles |

---

## Las nueve dimensiones que se auditan

Cada una tiene un equipo propio. El criterio no es «¿está bonito?» sino **«¿un
hospital suizo lo aceptaría?»**.

1. **Escucha** — ASR, diarización, sesgo de vocabulario, ruido de consultorio.
2. **Comprensión** — negación, temporalidad, atribución de hablante, incertidumbre.
3. **Razonamiento clínico** — diagnóstico diferencial, PROA, evidencia con cita real.
4. **Seguridad del medicamento** — dosis, unidades, alergias, interacciones, renal.
5. **Redacción** — que la nota se lea como la escribiría un internista.
6. **Determinismo** — qué calcula el LLM y qué debería calcular un motor.
7. **Trazabilidad** — procedencia, sello, versión de prompt, auditoría.
8. **Interfaz** — que sea fácil sin ser simplona, sofisticada sin ser confusa.
9. **Frente a la competencia** — qué tiene Suiza/Dinamarca/USA que aquí falta.

---

## Reglas que no se rompen, ni de noche

- **Ninguna cifra clínica se inventa.** Dosis, umbral o punto de corte que no
  esté respaldado se marca `NEEDS_CLINICAL_REVIEW` y se sigue con otra cosa.
- **Ningún dato real de paciente** sale del navegador del Dr.; de sus datos sólo
  se sacan **recuentos**.
- **Un hallazgo de agente no es un hecho.** Se verifica en el código antes de
  tocar nada — ya pasó esta noche: de cuatro hallazgos, los cuatro eran ciertos,
  pero se comprobaron uno por uno antes de actuar.
- **El ciclo completo o nada**: vitest → tsc → lint → build → sw → commit →
  deploy → verificar con curl → bitácora.

---

## Bitácora de la noche

### Reparaciones cerradas mientras la auditoría corre

Todas verificadas en producción con `curl /version.txt`, con el ciclo completo
(vitest → tsc → lint → build → sw → commit → deploy → bitácora).

| Versión | REG | Qué |
|---|---|---|
| v1065 | 182 | Dos listas que se pagaban en cada nota y no leía nadie. El gasto era lo de menos: `needs_review` ya viaja por campo, así que eran **el mismo hecho contado dos veces** — y dos fuentes de verdad se desincronizan. |
| v1066 | 183 | **El eje que faltaba**: `Medicamento` no distinguía «el paciente ya lo toma» de «se lo receto hoy». Por eso la compuerta de dosis bloqueaba 4 de sus 8 notas por medicación previa. |

**Pruebas: 6819 en verde. Lint 97 (techo). Build limpio.**

### Ronda 1 — auditoría de las nueve dimensiones · TERMINADA

**78 agentes · 68 hallazgos · 52 confirmados · 16 refutados** por el escéptico.

Los **tres primeros del plan ya están en producción**, y los tres eran el mismo
tipo de defecto: trabajo hecho que no llegaba a donde cambia algo.

| Versión | REG | Qué |
|---|---|---|
| v1069 | 186 | «ECG con infradesnivel **en el segmento** ST» se imprimía «infradesnivel**ST**». Un `?` de más hacía opcional el «de la consulta» y el saneador de metatexto se comía las localizaciones anatómicas. Reproducido con el motor real: 4 de cada 5 frases clínicas amputadas, y la primera es un infarto. |
| v1069 | 187 | Al reconocedor se le mandaba **el nombre del cajón** («Sepsis y choque») en vez de las palabras. UCI: 4 → **67 términos**. PROA: 1 → **29**. El sesgo es lo único que cambia lo que la máquina oye. |
| v1070 | 188 | Los motores clínicos recibían **sólo la receta de hoy**. Warfarina de marzo + ketorolaco hoy: la regla de sangrado existe, está probada, y no disparaba. |

**Pruebas: 6879 en verde. Lint bajó de 97 a 96 (trinquete apretado). Build limpio.**

### Lo que queda del plan, por orden

El plan completo de la auditoría lista 14 reparaciones verificadas línea por
línea. Las siguientes por valor:

- **D1** — el contador «nada te impide firmar» lee otra fuente que la que apaga
  el botón: miente en 7 escenarios.
- **D2** — el botón Firmar apagado no dice por qué (el mensaje existe y es
  inalcanzable).
- **G1** — el motor de sobredosis y error de decimal **sólo corre después de
  firmar**.
- **E3** — cuatro cambios de prompt sin mover `PROMPT_VERSION`: no se puede
  acotar el lote afectado (IEC 62304).
- **C2/C3** — «No padece diabetes» sale como antecedente positivo; faltan
  negadores del habla real («pues no», «fíjese que no»).

### Lo que NO se toca sin el Dr.

Queda escrito aparte, sin ejecutar: el catálogo de sobredosis, las escalas sin
motor (NYHA/GOLD/NIHSS), la ventana de antigüedad de la medicación vigente, y si
la compuerta de dosis debe aplicar sólo a lo que se prescribe hoy (ahora que
REG-183 hace esa distinción posible).

Nueve equipos leyendo en paralelo, con un **escéptico independiente por
hallazgo** cuya única misión es refutarlo abriendo el archivo. La carga de la
prueba es del hallazgo: ante la duda, se descarta.

Ya se comprobó esta noche por qué hace falta ese filtro — y también que funciona
al revés: los cuatro hallazgos del primer panel resultaron **los cuatro ciertos**,
y aun así se verificaron uno por uno antes de tocar nada.
