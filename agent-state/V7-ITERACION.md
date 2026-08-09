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
**Rama de esta corrida**: `claude/clever-lamport-xv6ul4` — continúa
`claude/clever-lamport-3fkemu` (mismo linaje, sin fusionar cuando esta corrida
empezó: se recuperó por fast-forward en vez de reconstruir REG-306/307 desde
cero). `agent/v7/master-loop` sigue siendo la rama larga de V7 y está
fusionada en `main` hasta `0144257c`.

---

## Corrida del 9-ago-2026 — la directiva V7 ya vive en el repositorio

**Lo primero, porque era la causa de que cada corrida empezara a ciegas**: el
archivo que la rutina declara como autoridad —
`docs/ai/NEXUSMED_AUTONOMOUS_MEDICAL_INTELLIGENCE_MASTER_LOOP_V7.md` —
**no existía en el repositorio**. Nunca había existido: `git log --diff-filter=A`
sobre esa ruta no devuelve nada en ninguna rama. V7 llevaba corridas
reconstruyendo su propio criterio de `CLAUDE.md`, de `.claude/rules/` y del
tablero, que es justo lo que la directiva prohíbe.

Instalado desde el adjunto del dueño, **íntegro y verificado**: 2 290 líneas,
`sha256 c576ceb18f15cad98a04a55f83bda565d22c3e0ccc60f05533a50d5dd3e732c0`,
idéntico byte a byte al adjunto. No se resumió, no se reescribió, no se
reinterpretó.

**Iteraciones cerradas en esta corrida**:

1. `PATIENT-PORTAL-001` → **REG-306**. Límite de tasa en las tres rutas que no
   lo tenían.
2. `POSTVISIT-GATE-001` → **REG-307**. La hoja del paciente no se entrega sin
   firma. Comprobado antes de empezar que V9 **no** lo tenía abierto: sus
   unidades vivas son `PATIENT-COMPANION-001`, `NAVIGATION-001` y
   `DESIGN-SYSTEM-001`.

**REG-292 lo tomó otra rutina** en `agent/v7/master-loop` mientras ésta corría.
Por eso el número siguiente se saca de `scripts/estado-de-las-ramas.mjs` sobre
**todas** las ramas, nunca de `main`: desde `main` los dos disparos habrían
elegido 291.

**Siguiente por el algoritmo §7** (los tres P0 de audio ya están cerrados por V9
en v1158/v1161 — **no se rehacen**):

1. ~~`POSTVISIT-ENTREGA-001` (60)~~ → **CERRADO, REG-308** (ver «Esta corrida»
   arriba). La hoja no llegaba nunca al paciente: dos botones, portapapeles e
   impresora, y nada en `/mi/[token]` ni en `/api/portal`. Continuación
   natural de REG-307; la compuerta vive en el servidor, no en el componente
   (§3 de `patient-facing-ai.md`).
2. `PATIENT-TELE-002` (55) — el enlace de videoconsulta que viaja por WhatsApp
   sigue sin token (REG-265 sólo cerró el camino del portal).
3. `DESIGN-THEME-001` (52) — **de V9**: comprobar antes de tocarlo.

**Lo que quedó abierto de este mismo ítem y NO se cierra por mi cuenta**: la
comprobación de revocación (`portalTokenVersion`) falla ABIERTA. Que un enlace
revocado vuelva a valer durante una incidencia de Firestore es un riesgo que
acepta el dueño, no yo. → `OWNER_DECISIONS_REQUIRED.md`.

---

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

## Esta corrida (9-ago-2026, tras recuperar 3fkemu)

**Sin desplegar** — CLAUDE.md prohíbe explícitamente `desplegar a producción`
sin autorización explícita del dueño, y esta corrida no tiene forma de
verificar en vivo la autorización que `MASTER_STATE.json`/esta misma nota
afirman de sesiones previas. Se sigue `deployment-and-flags.md`: «autonomía
hasta el PR, no más allá». Rama + commit + PR, sin tocar `public/sw.js` ni
`version.txt` (bumped sólo tiene sentido junto a un despliegue real).

| REG | Qué |
|---|---|
| REG-308 | **POSTVISIT-ENTREGA-001** — la hoja del paciente (REG-242/307) nunca llegaba a `/mi/[token]`: sólo se pintaba en la pantalla del médico. Acción `instrucciones` en `/api/portal` con el mismo gate de alcance clínico que `documentos`; sólo entrega notas FIRMADAS y excluye las de internamiento — los dos filtros viven en el servidor, no en la pantalla (`patient-facing-ai.md` §3) |

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
