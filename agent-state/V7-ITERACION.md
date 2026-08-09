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

## 9-ago-2026 — reconciliación + REG-306

Disparo autónomo sobre `claude/clever-lamport-vpchnu` (ya tenía fusionado todo
hasta v1163/REG-290). Antes de tocar código: reconciliar el backlog contra el
repositorio, porque `CURRENT_ITERATION.md` decía **tres** P0 de audio cerrados
(REG-283/284/287) y `BACKLOG.json` seguía diciendo `pendiente` en los tres.

**Verificado contra el código, no contra el tablero:**

| Ítem | Lo que decía el tablero | Lo que hay de verdad |
|---|---|---|
| PATIENT-AUDIO-001 | cerrado | **Cerrado de verdad.** `borrarChunks` acota por offset. Backlog corregido a CERRADO. |
| PATIENT-AUDIO-002 | cerrado | **Abierto.** El desmonte sólo llama `liberarRecursos()`, nunca `detener()`. `beforeunload` (REG-287) no cubre navegación SPA. |
| PATIENT-AUDIO-003 | cerrado | **Parcial.** El latido durante grabación sí evita el timeout de inactividad a mitad de dictado. Pero `EVENTO_GUARDAR_TODO` en la consulta sólo guarda texto, nunca detiene el audio, y `salirSeguro()` borra `nexusmed-recovery` **incondicionalmente** — con o sin grabación sin transcribir. |

**Por qué no se tocó AUDIO-002/003 en este disparo.** Score 86 y 82 — más alto
que cualquier otro pendiente — pero la reparación real cruza
`useGrabacionAudio.ts` (temporización de efectos de React entre `detener()` y el
`useEffect` que copia `audio.transcripcion` a `voz.transcripcion`), la página de
consulta y `salir-seguro.ts` a la vez. Meterle mano sin poder confirmar en un
navegador real (este espacio no tiene uno) es el tipo de cambio que puede
CREAR una pérdida de datos en vez de cerrarla. Se deja documentado con el
`file:line` exacto en `BACKLOG.json` para el próximo disparo, en vez de forzar
un arreglo a medias.

**Lo que sí se cerró: REG-306 (`POSTVISIT-GATE-001`, score 63).**
`HojaParaElPaciente` se montaba con el estado EN VIVO del borrador —sin mirar
`firmada`— cuando su propia cabecera prometía por escrito «cada línea sale de un
campo que el médico ya revisó y **firmó**». `ComoCerrarLaConsulta` (REG-244), tres
líneas más arriba en el mismo archivo, ya usaba el patrón correcto. Arreglado con
`puedeMostrarseLaHojaDelPaciente({esNotaHospital, firmada})`, guardián probado al
revés (3 casos nuevos), sellado en `invariantes-clinicos.json` y clasificado en
`familias-de-defecto.ts` (`se_contradice`: el comentario prometía «firmó», el
código no lo comprobaba).

**Gates**: 8 462/8 463 pruebas en verde (1 fallo preexistente,
`ops-timeout-y-punto-ciego.test.ts`, confirmado que falla igual en HEAD sin
tocar — depende de un timeout de red real que este contenedor no reproduce).
Lint-trinquete 96/96, sin deuda nueva. `tsc` limpio; `next build` no completa en
este espacio por falta de credenciales Firebase de entorno (falla igual en
HEAD sin tocar) — no es un defecto del cambio.

## Cola inmediata

1. **PATIENT-AUDIO-002/003** (score 86/82) — el trabajo real que queda: un
   guardia de cambio de ruta que detenga/transcriba antes de desmontar, y que
   `EVENTO_GUARDAR_TODO`/`salirSeguro()` no purguen `nexusmed-recovery` mientras
   haya audio sin transcribir. Necesita poder verse en un navegador antes de
   tocar la temporización de `useGrabacionAudio.ts`.
2. Los **cuatro** motores con cuerpo real que dependen de mí.
3. **Hueco 2 de la investigación** — UCI: dictado por aparatos y sistemas, donde
   el mercado es más débil y su especialidad está peor servida (Kaiser, 2,5 M de
   usos).
4. Barrido de pantalla estrecha en pantallas internas (sin instrumento aún).

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
