# MASTER LOOP V7 — tablero propio

> **Separado de V9 el 8-ago-2026.** Los dos programas compartían
> `CURRENT_ITERATION.md` y se pisaban: V9 reescribió la cabecera mientras V7
> trabajaba. Ahora cada uno tiene el suyo.
>
> · **V7** (éste) → rama `agent/v7/master-loop`
> · **V9** → rama `claude/nexus-patient-ux-v9`, tablero en `CURRENT_ITERATION.md`
>
> Las cifras se DERIVAN: `node scripts/agent-state/actualizar.mjs`. Lo de aquí es
> **criterio**, y el criterio no sale de un `grep`.

**Cifras**: → `agent-state/MASTER_STATE.json` (derivadas)
**Rama**: `agent/v7/master-loop` · **Producción**: `nexusmed-v1146`

**Modo V7**: autónomo CON despliegue. El dueño lo levantó de viva voz el
8-ago-2026 («despliega y sigue en V7») después de que V9 pusiera su propio
candado. **El candado de V9 sigue en pie para V9**: son dos programas.

Lo que no se relaja en ninguno de los dos: nada de datos reales de pacientes,
nada destructivo, **ninguna cifra clínica inventada**.

---

## El hilo de esta sesión, en una frase

**Nada de lo que se desplegó fue una función nueva por capricho: fueron motores
que ya existían y no corrían, defectos que certificaban falsedades en verde, y
medidores que mentían por agregación.** Incluidos cuatro medidores míos.

---

## Desplegado y verificado en vivo (v1120 → v1144)

| Versión | REG | Qué |
|---|---|---|
| v1120 | 238 | «14 editas» y «24 tras» de una nota **firmada**: nada comprobaba la forma de una pauta |
| v1121 | 239 | **«¿De dónde salió esto?»** — cada frase junto al trozo del dictado que la sostiene |
| v1122 | 240-241 | Una reescritura no pierde cifras · el **tablero del loop** mintió tres veces y ahora se deriva |
| v1123 | 242 | **Lo que se lleva el paciente**, en español llano |
| v1124 | 243 | **Qué es de qué** — el plan atado al problema, sólo donde él lo dijo |
| v1125 | 244 | Con receta **y** estudios, **la orden no se imprimía nunca** |
| v1126 | — | La hoja del paciente no sale en un internado |
| v1127 | 245 | **UCI**: «infusión continua», «en bolo», «DU» salían como pauta no reconocida |
| v1128 | 246 | Perder el **`/kg`** de una infusión (70× la dosis) pasaba indetectado |
| v1129 | 247 | **`2 U/h` de insulina** salía como «dosis sin unidad» |
| v1130 | 248 | **«alergias negadas»** quedaba registrado **como una alergia** |
| v1131 | 249 | El audio se subía y **se tiraba**: no había nada que reproducir |
| v1132 | 250 | **Pulsar una frase y escuchar el segundo exacto** |
| v1133 | **251** | **P0** — el panel certificaba **en verde** lo contrario de lo dictado |
| v1134 | 252 | El bucle de laboratorio tenía **fuga del 100 %**: nunca empezaba |
| v1135 | 253 | **0 high** en producción · la cifra de seguridad ya no se pudre |
| v1136 | 254 | **La prueba de placebo**: una métrica que daba igual con motor y sin motor |
| v1137 | 255 | **El instrumento** contra «escrito, probado y sin conectar» |
| v1138 | 256 | Las alertas del episodio se escribían y **nadie las leía** |
| v1139 | 257 | **CAM-ICU** y tres motores **POCUS** no corrían |
| v1140 | 258 | Oxígeno con cifras y sin declarar: **NEWS2 salía 2 puntos bajo** |
| v1141 | 259 | El texto de la IA podía **callarse una carbapenemasa** |
| v1142 | 260 | El número decía «42» y significaba otra cosa |
| v1143 | 261 | El expediente **no enseñaba los ingresos hospitalarios** |
| v1144 | 262 | El expediente no resumía problemas ni medicación |

### El P0, porque merece su párrafo

`rastrearNota` decía **respaldada · cobertura 1,00 · VERDE** para:

- nota «Paciente **niega** alergia a penicilina» / dictado «soy **alérgico**»
- nota «Warfarina **10 mg**» / dictado «warfarina **2 mg**»

Dos causas: `'niega'` estaba en las palabras vacías, y `contenido()` filtraba
`w.length > 3` — o sea, **tiraba todas las dosis**. Reparado con tres cambios;
las 7 938 pruebas de entonces siguieron pasando: **ninguna dependía del
comportamiento roto**.

---

## El trinquete de motores sin conectar

**50 → 39.** Y el desglose importa más que el número (REG-260):

| | Cuántos | Qué son |
|---|---|---|
| Envoltorios | 34 | ≤3 líneas sobre algo que **sí corre**. No son defectos |
| Con cuerpo real | **5** | Los que hay que mirar |

De esos cinco, **`validarCorreccion` está bloqueado en el Dr.**, no en el
código. Quedan cuatro que dependen de mí: `invariantesProtegidos`,
`obtenerVersion`, `coherenteConElTipo`, `correrBenchmark`.

---

## Cuatro errores míos, cazados antes que él

1. El instrumento de conexión dio **152** en vez de 50 y casi «reparo»
   `crossResistenciaFQ`, que funcionaba (REG-255).
2. Ese mismo número, **42**, mezclaba envoltorios con defectos (REG-260).
3. El guardián de pautas **gritaba en toda la UCI** (REG-245) — defecto que yo
   introduje en v1120.
4. Un `override` global de `brace-expansion` **rompió ESLint**; el trinquete
   falló en vez de pasar en silencio (REG-253).

---

## Cola inmediata

1. Los **cuatro** motores con cuerpo real que dependen de mí.
2. **Hueco 2 de la investigación** — UCI: dictado por aparatos y sistemas, donde
   el mercado es más débil y su especialidad está peor servida (Kaiser, 2,5 M de
   usos).
3. Barrido de pantalla estrecha en pantallas internas (sin instrumento aún).

---

## BLOQUEADO EN EL DR — no lo toco, va al final

**De minutos, y desbloquean lo más grande:**

1. **Grabar 8+ minutos** y confirmar que separa las voces (cierra I-1).
2. **Un dictado real** para re-medir el WER (sigue en 25,55 % crudo).
3. **Las frases que usa al cambiar de tema** (I-3).

**De criterio:**

4. **Política de correcciones** (REG-260): quién corrige, quién anula una
   administración, cuántas horas, si el motivo es obligatorio. Cuatro frases.
5. **Retención del audio** (REG-249): autorizó conservarlo; falta el plazo.
6. Requisitos legales de la receta impresa · `STRIPE_WEBHOOK_SECRET` ·
   `OPS_ALERTA_WEBHOOK`.

---

## Lo que este sistema repite

**«Escrito, probado y sin conectar» — 27 de 110.** La familia más grande, con
diferencia. Desde REG-255 hay instrumento; antes se encontraban por casualidad.

**Antes de dar algo por entregado: buscar el símbolo en `app/`, `hooks/` y
`components/`.**

Tres familias nuevas esta sesión:

- **`depende_de_recordar`** — el dato existe y un segundo sitio lo repite a
  mano. Se **deriva**, con compuerta que falle al separarse.
- **`hueco_frente_al_mercado`** — función que el mercado da por supuesta y que
  aquí nunca existió. Ninguna prueba interna puede delatarla.
- Y la lección transversal: **un medidor que grita de más enseña a ignorarlo**,
  igual que un aviso clínico.

---

## 9-ago-2026 — reanudación: la cola de este archivo ya estaba resuelta

Al reanudar se comprobó primero la «cola inmediata» de arriba contra el
repositorio, como manda la coordinación entre programas (repo → tests →
git log → especificación → estado). **Los cuatro motores sin conectar
(`invariantesProtegidos`, `obtenerVersion`, `coherenteConElTipo`,
`correrBenchmark`) ya estaban cerrados** desde v1145 (REG-263,
`el-barrido-de-motores-esta-explicado.test.ts`): no se rehizo. Los otros dos
puntos de la cola (hueco 2 UCI, barrido de pantalla estrecha) siguen abiertos
y sin instrumento — quedan para la próxima sesión.

Se tomó en su lugar **`PATIENT-PORTAL-001`** de `agent-state/BACKLOG.json`
(score 62, seguridad+regulatorio), sin conflicto con el trabajo activo de V9
(que sigue en `POSTVISIT-001`, pantalla distinta): `/api/portal`,
`/api/public/resena` y `/api/payment/create-checkout` no tenían **ningún**
`limitar*`, a diferencia de sus hermanas (`telesalud/sala`, `public/booking`).
**REG-309** (renumerado de REG-306 al fusionar con `main`: V10 ya había usado
ese número para un hallazgo distinto, el problema T-1 de
`OWNER_DECISIONS_REQUIRED.md`). Las tres rutas del hallazgo quedan con `limitarOResponder`
—portal 40/600s + 10/600s en confirmar/cancelar/reagendar, reseña 10/3600s por
IP, pago 8/600s—, guardián probado al revés
(`src/__tests__/portal-limite-de-tasa.test.ts`, 10 casos), y el sello de
invariantes (`src/lib/clinical/invariantes-clinicos.json`) actualizado porque
el guardián está citado en el ledger. La segunda mitad del hallazgo —la
revocación del token que falla abierta— **no se tocó**: ya está documentada y
razonada en el propio código (`route.ts:166-184`); es política del Dr., no un
defecto.

**Compuertas**: `npx vitest run` 8 563 casos · 1 fallo preexistente de entorno
(`ops-timeout`, red no disponible en este contenedor) · `lint-trinquete` 96,
igual que el techo · `npx tsc --noEmit` limpio. `npm run build` falla en este
contenedor por falta de credenciales de Firebase (`auth/invalid-api-key` en
`/dr/[clinicId]`) — se verificó que falla **igual sin este cambio** (revertido
temporalmente y reproducido), así que es del entorno, no del cambio.

**Siguiente**: el hueco 2 de la investigación (UCI, dictado por aparatos y
sistemas) o el barrido de pantalla estrecha, ninguno de los dos tiene
instrumento todavía y los dos necesitan definirse antes de ejecutarse. Si
ninguno se puede acotar en la siguiente sesión, revisar `BACKLOG.json` por
otro ítem `pendiente` de score alto que no pise el trabajo activo de V9/V10.
