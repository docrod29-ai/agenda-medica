# NEXUSMED — VISUAL EXCELLENCE AND CLINICAL INTERACTION · MASTER LOOP V10

> **Estado**: ABIERTO · 9-ago-2026
> **Autoridad**: la directiva **V9**, escrita por el dueño y pegada íntegra en
> `docs/ai/NEXUSMED_PATIENT_EXPERIENCE_AND_DESIGN_MASTER_LOOP_V9.md`.

---

## ⚠ Qué es este archivo, y qué NO es

**Esto es un documento de ENRUTAMIENTO, no una especificación nueva.**

La tarea programada de V10 exige leer este archivo como «la especificación
autorizada» y **prohíbe sustituirla por un plan propio del agente**. La corrida
del 9-ago-2026 encontró que el archivo **no existía** y —correctamente— **se
plantó**: registró el bloqueo en `agent-state/V10_OWNER_DECISIONS_REQUIRED.md` y
no inventó trabajo. Hizo lo que había que hacer.

El acta de ese bloqueo ofrecía dos salidas, y ésta es la segunda, textual:

> *«Si la intención era que V10 corriera **sobre la directiva V9 existente** (las
> unidades `DESIGN-SYSTEM-001` → `VISUAL-EXCELLENCE-001`), basta decirlo en ese
> archivo.»*

**Se dice aquí.** El dueño lo autorizó de viva voz el 9-ago-2026 («desbloquea
v10»).

### Por qué esta salida y no escribir una especificación nueva

Redactar unidades V10 desde cero sería **darle al dueño un plan mío disfrazado
del suyo** — exactamente lo que la propia directiva prohíbe, y exactamente por lo
que la rutina se negó a improvisar.

La directiva V9 **ya declara** una unidad llamada `VISUAL-EXCELLENCE-001`, que es
el nombre literal de la tarea programada de V10 («AUTONOMOUS VISUAL EXCELLENCE
ENGINE»). No hace falta inventar el destino: ya estaba escrito.

### El dueño puede reemplazar este archivo cuando quiera

Si tenía en la cabeza un V10 distinto, **sustituya este contenido** por su
especificación y la siguiente corrida obedecerá esa y no ésta. Este archivo
existe para que el loop deje de estar parado, no para fijar su rumbo.

---

## §1 — Autoridad y precedencia

1. **La directiva V9 manda.** Todo lo que dice sobre alcance, prohibiciones,
   método y criterios de cierre se aplica igual bajo V10.
2. **V7 sigue vivo y por encima**: seguridad clínica, motores, evaluaciones,
   despliegue y el charter. V10 es un programa **hijo**, como lo es V9.
3. **Las reglas de dominio de `.claude/rules/` y las prohibiciones de
   `CLAUDE.md` §Prohibido siguen intactas y vinculantes.** V10 no relaja
   ninguna.
4. Ante conflicto entre este archivo y la directiva V9, **gana V9**.

---

## §2 — Qué gobierna V10

Las unidades de V9 del dominio **visual y de interacción clínica** que siguen
abiertas. No se crean unidades nuevas.

Estado verificado el 9-ago-2026 leyendo el historial completo (`git log --all`),
no de memoria:

| Unidad de V9 | Estado | Bajo V10 |
|---|---|---|
| `PATIENT-UX-TRUTH-001` | **cerrada** | no se toca |
| `DESIGN-SYSTEM-001` | **cerrada** | no se toca |
| `DESIGN-THEME-001` | **cerrada** | no se toca |
| `DESIGN-SLATE-001` | **cerrada** | no se toca |
| `NAVIGATION-001` | **cerrada** | no se toca |
| `PATIENT-COMPANION-001` | **cerrada** | no se toca |
| **`VISUAL-EXCELLENCE-001`** | **abierta** | **primera unidad de V10** |
| `POSTVISIT-001` | abierta | después |
| `PATIENT-LANGUAGE-001` | abierta | después |
| `DOCUMENTS-001` | abierta | después |
| `CLOSED-LOOP-PATIENT-001` | abierta | después |
| `PATIENT-AI-001` | abierta | después |

**El orden lo fija V9**, no este archivo. Si V9 no lo fija, se toma la primera
abierta de la tabla.

---

## §3 — Una regla del dueño que V10 tiene que respetar, y es nueva

Dicha el 9-ago-2026, y ya vigilada por
`src/__tests__/lo-que-hace-si-como-lo-hace-no.test.ts`:

> *«La manera en que funciona la app no debe de enseñarse. Sólo se menciona lo
> que puede ser para promocionar: sólo lo que hace, no cómo lo hace.»*

Para un loop de **excelencia visual** esto no es un detalle: significa que
ninguna pantalla nueva puede explicar motores, números de reparación, jerga
interna ni «lo que hacía antes». Se enseña **qué resuelve**.

Ya costó una reparación (REG-292): una pantalla mía terminó en el menú del
médico hablando de reparaciones internas. **No se repite.**

---

## §4 — Método

El de V9, sin cambios. Y las dos reglas que este repositorio ha pagado caras:

- **Se mide, no se lee.** Ningún hallazgo se da por bueno sin reproducirlo con el
  motor real sobre el árbol que corre en producción.
- **Ninguna cifra clínica inventada.** Lo que falte se declara con una constante
  `FALTA_*` —así aparece sola en `docs/DECISIONES-DEL-DUENO.md`— y se sigue con
  otra cosa.

---

## §5 — Numeración, y por qué se dice aquí

Varios programas han estado numerando REG contra un tronco que se movía, y ha
costado **cuatro colisiones** (REG-267 la primera). Antes de reservar un número:

```bash
node scripts/agent-state/actualizar.mjs   # dice cuál es la última REG real
```

El número se toma de ahí, **no de la memoria de la corrida anterior**.

---

## §6 — Despliegue

**V10 no despliega por su cuenta.** Deja el trabajo en su rama y lo declara. El
despliegue lo autoriza el dueño, como en V9.

---

## §7 — Cuando esta directiva sea sustituida

Si el dueño coloca aquí su especificación real, **este contenido desaparece
entero**. No hay nada en él que valga la pena conservar salvo el desbloqueo: su
único mérito es haber dejado de tener parada una rutina que llevaba horas dando
vueltas por un archivo que no existía.
