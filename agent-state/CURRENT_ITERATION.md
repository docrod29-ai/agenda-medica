# Iteración actual — MASTER LOOP V7, al día

**Actualizado**: 7-ago-2026, 23:55. **Producción**: `nexusmed-v1121`.
**Rama**: `agent/pagos/PAY-001`. **Pruebas**: 7 740 en verde. **Lint**: 96 (techo).

**Modo**: autónomo CON despliegue. El dueño levantó §31 de viva voz y por escrito
muchas veces («despliega el fix ya», «no pares», «quita los candados»). Lo demás
sigue en pie y no se relaja: **nada de datos reales de pacientes**, nada
destructivo, **ninguna cifra clínica inventada** (se marca NEEDS_CLINICAL_REVIEW
y se sigue con otra cosa).

---

## Lo primero: el tablero ya no depende de mi memoria (REG-241)

Decía `v1030` con producción en v1079. Se puso al día. Dijo `v1084` con v1096. Se
puso al día. Dijo `v1096` con **v1121**. Tres veces.

Y este mismo archivo ya tenía escrito el diagnóstico correcto después de la
segunda: *«la causa no es descuido: es que actualizarlo depende de que yo me
acuerde. Mientras no lo derive un script, va a volver a pasar.»* Volvió a pasar.

Cerrado: `scripts/agent-state/actualizar.mjs` **deriva** del repositorio la
versión, la última REG, el conteo de pruebas y la rama. Y
`el-tablero-del-loop-no-miente.test.ts` **falla** si el tablero se desfasa.

Lo que es criterio —la iteración en curso, los bloqueos, las decisiones del
dueño— se sigue escribiendo a mano: eso no sale de un `grep`.

Esto es lo que hace el programa **reanudable**, que es lo que él pidió con sus
palabras: «si se acaban los tokens guarda el avance y cuando te ponga 1 sigue
donde te quedaste».

---

## Dónde va el loop, por workstream del charter

### Workstream B — conversación clínica (el foco de esta sesión)

Su encargo textual: *«sobre todo quiero mejorar el proceso de grabación,
procesamiento de nota y nota final debe de ser perfecta»*.

| | Estado |
|---|---|
| **I-1** grabación larga se moría | **CERRADO** — 7 min 30 s exactos por aritmética (64 000 b/s ÷ 8 = 8 000 B/s; 3 600 000 ÷ 8 000 = 450 s) **y** `storage.rules` con `read: if false`. Reglas desplegadas aparte. Falta que él grabe 8+ min y confirme voces separadas |
| **I-4** un monólogo no es un diálogo | CERRADO |
| **I-5** huecos propuestos y marcados | CERRADO |
| **I-6** lo revisado es lo que se firma | CERRADO |
| **I-7** menos pasos para cerrar | PARCIAL — falta quitar el «Procesar con IA» manual y la pantalla única de cierre |
| **I-8** la nota la escribe un especialista | CERRADO (16 guías, `guiaDe()` elige por la raíz que aparece antes) |
| **I-9** precisión de audio | PARCIAL — antibióticos cerrados (118 sustituciones → 0); WER sigue en 25,55 % crudo / 22,81 % pipeline. Necesita **un dictado real suyo** para re-medir |
| **I-12** competencia | **CERRADO** — informe con fuentes en el chat; tres huecos identificados |
| **I-13** barrido con su Chrome | CERRADO |
| **I-3** anclas de sección | **BLOQUEADO EN ÉL** — hacen falta las frases reales que usa al cambiar de tema |

### Lo que salió de I-12 y ya está construido

- **v1120 · REG-238** — «14 editas» / «24 tras» de su nota FIRMADA. Nada
  comprobaba la forma de una pauta. Avisa **mientras receta**; nunca propone el
  valor correcto.
- **v1121 · REG-239** — «¿de dónde salió esto?»: cada frase de la nota junto al
  fragmento del dictado que la sostiene. El motor (`rastrearNota`, con corpus
  oro) existía y la pantalla sólo usaba su mitad negativa. Es el mecanismo que
  en el mercado **sólo tiene Abridge**, y que **Nabla no puede tener** porque
  borra el audio original (AP, oct-2024).

### En curso ahora mismo

- **REG-240** — que una reescritura por chat **no pueda perder ni cambiar una
  cifra**. El editor por lenguaje natural ya existía (`/api/expediente/corregir`,
  conectado); lo que no existía es el guardián. Motor puro escrito
  (`la-reescritura-no-pierde-cifras.ts`); falta cablearlo y sellarlo.
  La regla: toda cifra con unidad sobrevive **salvo que aparezca en la
  instrucción del médico** — «la dosis es 500 mg» autoriza; «hazlo más conciso»
  no autoriza nada.

### Cola inmediata, en orden

1. Cerrar REG-240 (cablear + guardián + desplegar).
2. **Instrucciones para el paciente** en español llano — Suki y Nabla las tienen,
   nosotros no. Hueco 1 de la investigación.
3. **Problem-based charting**: plan atado a cada diagnóstico con su CIE-10.
4. Resto de I-7: quitar el «Procesar con IA» manual, pantalla única de cierre.

---

## Bloqueado en el Dr (no lo toco, va al final)

1. **I-3** — las frases que usa al cambiar de tema.
2. **I-1** — grabar 8+ minutos y confirmar que separa las voces.
3. **I-9** — un dictado real para re-medir el WER.
4. Requisitos legales de la receta impresa · STRIPE_WEBHOOK_SECRET ·
   OPS_ALERTA_WEBHOOK.

---

## Familias de defecto — lo que este sistema repite

86 REG clasificados. La familia más grande, **18 de 87**, sigue siendo la misma:

> **«Escrito, probado y sin conectar»** — el módulo existe, tiene pruebas, está
> bien, y NO CORRE en el camino que el médico recorre.

En esta sesión apareció **dos veces más**: `diasDeDuracion()` sabía que «14
editas» no era una duración y nadie se lo preguntaba (REG-238); `rastrearNota()`
tenía corpus oro y la pantalla usaba media función (REG-239).

Antes de dar algo por entregado: **buscar el símbolo en `app/`, `hooks/` y
`components/`**.
