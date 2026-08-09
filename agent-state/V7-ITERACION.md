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
>
> **9-ago-2026**: el disparo programado de V7 pide leer
> `docs/ai/NEXUSMED_AUTONOMOUS_MEDICAL_INTELLIGENCE_MASTER_LOOP_V7.md` como
> especificación autoritativa. **Ese archivo no existe** en el repositorio ni en
> su historia (B-12 en `BLOCKERS.md`). Este tablero y `BACKLOG.json` +
> `docs/audit/regression-ledger.md` son la especificación operativa real — es
> lo que ya usaban las 27 versiones anteriores.

**Cifras**: → `agent-state/MASTER_STATE.json` (derivadas)
**Rama de esta sesión**: `claude/clever-lamport-c0vsq7` (el disparador asignó
esta rama; `agent/v7/master-loop` sigue siendo la rama de referencia del
programa) · **Producción**: `nexusmed-v1167` (sin desplegar esta sesión — ver
abajo)

> **Renumeración del 9-ago**: esta sesión usó primero REG-291/292 (v1164/1165)
> y otra sesión concurrente fusionó a `main` SUS REG-291/292/293 (v1164–v1167)
> — el defecto T-1 otra vez, y otra vez por no correr
> `scripts/estado-de-las-ramas.mjs` antes de numerar. Los de esta sesión son
> ahora **REG-294** (hoja del paciente) y **REG-295** (portal), v1168/v1169,
> renumerados al fusionar `origin/main` en la rama. Los commits `982fd90` y
> `3e8ac7c` llevan los números viejos en el mensaje; el ledger manda.

---

## Sesión 9-ago-2026 — REG-294

**Baseline al arrancar** (con dependencias reinstaladas desde cero, el
contenedor no las traía): `npx vitest run` → 8 458 pasan, **1 fallo** ya
documentado como de entorno (`ops-timeout-y-punto-ciego`, ver
`LAST_SAFE_CHECKPOINT.md` — abre un socket a una IP no enrutable y el proxy de
este contenedor lo corta rápido en vez de agotar el tiempo; confirmado flaky
corriéndolo 3 veces suelto: 1-2 fallos según la carrera). `lint-trinquete`: 96,
en el techo. `tsc --noEmit`: limpio. `npm run build`: compila y falla
recolectando datos de página por falta de claves de Firebase — mismo defecto de
entorno que ya declaraba el checkpoint anterior.

**Reconciliado contra el repositorio real** (backlog vs ledger vs
`CURRENT_ITERATION.md`): `PATIENT-AUDIO-001/002/003` seguían en `"pendiente"` en
`BACKLOG.json` pese a estar cerrados desde v1158/v1161 (REG-283, REG-287). Es
exactamente el defecto que el propio programa señala en su sección «Lo que este
sistema repite»: un tablero que no se deriva se desfasa. Marcados `CERRADO` con
su REG.

**Trabajado — `POSTVISIT-GATE-001` (score 63, el más alto pendiente)**: la hoja
para el paciente se montaba con `{!esNotaHospital && (<HojaParaElPaciente…}`,
sin exigir `firmada`. El propio encabezado del componente afirma que compone
«de lo que el médico ya revisó y firmó» — era intención de diseño, no
precondición. Arreglo de un operando: `{firmada && !esNotaHospital && (…)}`.
Prueba nueva en `lo-que-se-lleva-el-paciente.test.ts`, probada al revés
(revirtiendo el archivo se confirma que falla sin el arreglo). Detalle completo
en `docs/audit/regression-ledger.md` REG-294.

**Gates tras el cambio**: vitest 8 459/8 460 (mismo fallo de entorno, cero
nuevos), `lint-trinquete` 96 (sin subir), `tsc --noEmit` limpio,
`clinical-safety-gate.test.ts` (metagate E0-11) 37/37.

**No desplegado.** El dueño autorizó despliegue en V7 el 8-ago, pero esta rama
la asignó el disparador de la sesión (`claude/clever-lamport-c0vsq7`), distinta
de `agent/v7/master-loop`; se deja en rama + commit, sin desplegar ni fusionar,
para no mezclar dos ramas «autorizadas para desplegar» a la vez.

**Segunda iteración de la sesión — REG-295 (`PATIENT-PORTAL-001`, ordenada por
el dueño: «sigue con PATIENT-PORTAL-001»)**: dos frenos en `/api/portal` (por
IP antes del HMAC, por paciente después), freno por IP en `public/resena` y
`payment/create-checkout`, `ipDe` compartida desde `lib/rate-limit.ts`, y la
revocación del enlace ahora **falla cerrada** (503) — decisión documentada en
`DECISION_LOG.md`, reversible. Lo que destapó: los dobles de
`portal-alcance.test.ts` no tenían `get` en el documento del paciente, así que
la comprobación de revocación llevaba desde su nacimiento tirando `TypeError`
en los tests y el fail-open se lo tragaba — **los tests pasaban porque el
defecto los dejaba pasar**. Probada al revés: revirtiendo sólo la ruta, 3 de
los 9 casos nuevos fallan. Detalle: `regression-ledger.md` REG-295.

**Siguiente iteración V7**: `POSTVISIT-ENTREGA-001` (score 60) — la hoja del
paciente sigue sin llegar al portal (`/mi/[token]`); REG-294 ya le dio la
compuerta de firma (DRAFT→RELEASED) de la que este ítem declaraba depender.
Alternativa de menor riesgo si esa superficie exige decisión de producto:
`DESIGN-THEME-001` (score 52).

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
