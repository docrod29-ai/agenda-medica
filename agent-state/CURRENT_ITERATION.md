# Iteración actual — MASTER LOOP V7 · programa hijo **V9** abierto

> **La cabecera de cifras se DERIVA**: `node scripts/agent-state/actualizar.mjs`
> escribe versión, última REG y conteo de pruebas en `MASTER_STATE.json`, y
> `el-tablero-del-loop-no-miente` falla si se desfasa (REG-241). Lo de este
> archivo es **criterio**, y el criterio no sale de un `grep`.
>
> **Las cifras ya no se copian aquí a mano** — era la cuarta vez que se
> desfasaban. Se leen de `MASTER_STATE.json`, que las deriva del repositorio.
> Ver `agent-state/RECONCILIACION-V9-2026-08-08.md`.

**Cifras**: → `agent-state/MASTER_STATE.json` (derivadas)
**Loop en curso**: **V9 — Patient Companion + World-Class Product Experience**
· directiva íntegra en
[`docs/ai/NEXUSMED_PATIENT_EXPERIENCE_AND_DESIGN_MASTER_LOOP_V9.md`](../docs/ai/NEXUSMED_PATIENT_EXPERIENCE_AND_DESIGN_MASTER_LOOP_V9.md)
**Unidad actual**: `PATIENT-UX-TRUTH-001` ✅ **CERRADA** (8-ago) · **los cuatro
P0 del backlog de V9** ✅ **CERRADOS** (9-ago, el último con REG-291) →
en curso: `DESIGN-SYSTEM-001`.
Punto de reanudación: [`LAST_SAFE_CHECKPOINT.md`](./LAST_SAFE_CHECKPOINT.md)

---

## V9 · lo que encontró la auditoría, en una frase

**El producto pierde consultas ya grabadas, y le dice al paciente que su cita no
existe.**

Y una que no se esperaba: **la premisa de la directiva no se cumple.** No hay
«cara de producto generado por IA» —cero degradados, cero morados, una tarjeta
`rounded-2xl` en toda la aplicación— sino una identidad declarada con el
contraste medido a mano. El defecto es el contrario: **el sistema de diseño
existe y la aplicación no le obedece** (88,5 % de los archivos con estilo en
línea; primitivos compartidos al 24 %).

| P0 | Estado |
|---|---|
| Volver a grabar **borra el audio anterior** — 22 min desaparecen sin transcribir | CERRADO v1158 (REG-283) — `PATIENT-AUDIO-001` |
| Navegar **termina la grabación** en silencio | CERRADO v1161 (REG-287) — `PATIENT-AUDIO-002` |
| El cierre por inactividad **no oye dictar** y borra la recuperación | CERRADO v1161 (REG-287) — `PATIENT-AUDIO-003` |
| El enlace de videoconsulta del paciente **daba 404** desde su propio portal | **REG-265 · reparado** |
| El enlace de la videoconsulta **no llegaba por WhatsApp**, que es por donde se anuncia | CERRADO 9-ago (REG-291) — `PATIENT-TELE-002` |

Los tres primeros comparten causa de fondo: **el esfuerzo de persistencia se puso
donde ya había red** —el texto de la nota, con borrador en memoria, respaldo
local, autoguardado y volcado— **y no donde no la hay**: el audio, que no tiene
segunda copia en ninguna parte.

También reparado: **REG-266**, `@keyframes spin` no existía en ningún sitio
global pese a 90 referencias, incluidos los dos primitivos compartidos. El giro
funcionaba «según en qué pantalla estuvieras».

Detalle: `docs/design/CURRENT_PRODUCT_DESIGN_AUDIT.md` y sus seis hermanos.
Estado por dominio: `DESIGN_STATE.md` · `PATIENT_COMPANION_STATE.md`.

**Modo V9**: autónomo **SIN desplegar y SIN fusionar a `main`**. El dueño
restableció el candado de despliegue al abrir V9 (§9 de la directiva). Lo demás
sigue igual: nada de datos reales de pacientes, nada destructivo, **ninguna cifra
clínica inventada** (se marca `NEEDS_CLINICAL_REVIEW` y se sigue con otra cosa).

> **V7 se mudó** el 8-ago-2026 a `agent-state/V7-ITERACION.md` y a la rama
> `agent/v7/master-loop`: los dos programas se pisaban en este archivo. Lo que
> sigue abajo es el historial de V7 hasta la mudanza, conservado como estaba.

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
