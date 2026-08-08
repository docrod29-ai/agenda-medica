# Iteración actual — MASTER LOOP V7, al día

**Actualizado**: 8-ago-2026, 00:40. **Producción**: `nexusmed-v1126`.
**Rama**: `agent/pagos/PAY-001`. **Pruebas**: 7 841 en verde. **Lint**: 96 (techo).

**Modo**: autónomo CON despliegue. El dueño levantó §31 de viva voz y por escrito
muchas veces. Lo demás sigue en pie y no se relaja: **nada de datos reales de
pacientes**, nada destructivo, **ninguna cifra clínica inventada**.

**El tablero ya no depende de mi memoria** (REG-241): `MASTER_STATE.json` se
deriva del repositorio con `node scripts/agent-state/actualizar.mjs`, y
`el-tablero-del-loop-no-miente.test.ts` falla si se desfasa. Esto es lo que hace
el programa reanudable — si se corta la sesión, se retoma desde aquí sin perder
nada.

---

## Lo desplegado esta noche (v1120 → v1126), todo verificado en vivo

| Versión | REG | Qué |
|---|---|---|
| v1120 | 238 | **«14 editas» y «24 tras»** de su nota FIRMADA. Nada comprobaba la forma de una pauta. Avisa mientras receta; **nunca propone el valor correcto** |
| v1121 | 239 | **«¿De dónde salió esto?»** — cada frase junto al fragmento del dictado que la sostiene. El motor existía con corpus oro y la pantalla usaba media función |
| v1122 | 240 | **Una reescritura no pierde cifras**. Se autoriza por UNIDAD: nombrar un `mg` autoriza los `mg`, no las horas |
| v1122 | 241 | El **tablero mentía** sobre la versión, tres veces. Familia nueva `depende_de_recordar` |
| v1123 | 242 | **Lo que se lleva el paciente**, en español llano. Familia nueva `hueco_frente_al_mercado` |
| v1124 | 243 | **Qué es de qué** — el plan atado al problema, y sólo donde él lo dijo |
| v1125 | 244 | **La orden no se queda en el tintero**: con receta Y estudios no se imprimía nunca |
| v1126 | — | La hoja del paciente no aparece en un paciente **internado** |

### Lo que la investigación (I-12) mandó construir, y por qué

El dato que decidió: sobre **62 811 pares borrador→nota final** (AMIA 2026) los
médicos borraron **216 199 oraciones** y las reescribieron para **añadir cautela**
(p < 0,001). El borrador de IA afirma de más.

De los tres productos del mercado, **sólo Abridge** tiene mecanismo contra eso
(*Linked Evidence*). **Suki no publica ninguno.** **Nabla borra el audio
original** (AP, oct-2024), así que estructuralmente no puede tenerlo.

Ninguno de los tres genera la nota en español. Ninguno reclama NOM-004/NOM-024.
En los 2,5 millones de usos de Kaiser, **infectología fue de las que menos lo
usaron**.

---

## Verificado, no supuesto

- La nota de **hospital y UCI se escribe en esta MISMA pantalla**
  (`/consulta/[id]?internamiento=…`), así que los siete motores de esta noche ya
  les aplican. No hay que duplicarlos.
- El **«Procesar con IA» automático ya estaba conectado** por tres caminos:
  streaming al detener, re-proyección al llegar la diarización, y una oferta si
  el médico ya escribió encima. I-7 estaba más cerrado de lo que decía la cola.

---

## Cola inmediata, en orden

1. **Barrido de pantalla estrecha** en las pantallas internas (sigue sin
   instrumento: Chrome no cambia el viewport al redimensionar).
2. **Hueco 2 de la investigación** — UCI: dictado por aparatos y sistemas sin
   conversación. Es donde el mercado es más débil y donde su especialidad está,
   medida y publicada, peor servida.
3. Revisar las **10 ramas huérfanas** (verificadas como duplicados de trabajo ya
   desplegado; se pueden borrar).

---

## Bloqueado en el Dr (NO tocar, va al final)

1. **I-3** — las frases que usa al cambiar de tema («pasemos a la exploración»…).
2. **I-1** — grabar 8+ minutos y confirmar que separa las voces.
3. **I-9** — un dictado real para re-medir el WER (sigue en 25,55 % crudo).
4. Requisitos legales de la receta impresa · STRIPE_WEBHOOK_SECRET ·
   OPS_ALERTA_WEBHOOK.

---

## Familias de defecto — lo que este sistema repite

92 REG clasificados en 15 familias. La más grande, **19 de 92**, sigue siendo:

> **«Escrito, probado y sin conectar»** — el módulo existe, tiene pruebas, está
> bien, y NO CORRE en el camino que el médico recorre.

Esta noche apareció **tres veces**: `diasDeDuracion()` sabía que «14 editas» no
era una duración y nadie se lo preguntaba (238); `rastrearNota()` tenía corpus
oro y la pantalla usaba media función (239); la ruta de la orden existía y no
corría con receta y estudios juntos (244).

**Antes de dar algo por entregado: buscar el símbolo en `app/`, `hooks/` y
`components/`.**

Dos familias nuevas esta noche:

- **`depende_de_recordar`** — el dato existe en el repositorio y un segundo
  sitio lo repite a mano. La reparación nunca es copiarlo bien: es **derivarlo**,
  con una compuerta que falle cuando se separen.
- **`hueco_frente_al_mercado`** — función que el mercado da por supuesta y que
  aquí nunca existió. Ninguna prueba interna puede delatarla: no hay nada roto
  que medir. Se encuentra **comparando**, no leyendo el código.
