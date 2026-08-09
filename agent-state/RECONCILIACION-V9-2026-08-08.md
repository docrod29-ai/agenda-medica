# Reconciliación del tablero — apertura de V9 · 8-ago-2026

**Regla aplicada** (instrucción §1 del dueño): *gana la verdad del repositorio y
el historial de Git commiteado. No se revierte trabajo válido ya terminado.*

---

## Lo que estaba en desacuerdo

| Campo | `MASTER_STATE.json` decía | `CURRENT_ITERATION.md` decía | **La verdad del repositorio** |
|---|---|---|---|
| Versión desplegada | `nexusmed-v1145` ✅ | `nexusmed-v1144` ❌ | **`nexusmed-v1145`** — `public/version.txt`, `public/sw.js` y `curl` a producción coinciden los tres |
| Rama activa | `claude/nexus-patient-ux-v9` ✅ | `agent/pagos/PAY-001` ❌ | **`claude/nexus-patient-ux-v9`** — `git rev-parse --abbrev-ref HEAD` |
| Nº de pruebas | 7 169 ✅ | 8 063 ❌ | **7 169** en **540** archivos — conteo de `it(`/`test(` del árbol |
| Última REG | REG-263 ✅ | «110 clasificados» ❌ | **REG-263**, **111** entradas en el ledger |
| Trabajo local sin subir | 12 archivos ❌ | — | **Ninguno.** Árbol limpio; esos 12 entraron en `1ddcc55c` |

## Cómo se resolvió

1. **`MASTER_STATE.json`** — regenerado con `node scripts/agent-state/actualizar.mjs`.
   El script lee la verdad del repositorio, no la memoria de nadie. Único cambio
   real: se vació `trabajoLocalSinSubir`, que listaba 12 archivos ya commiteados
   en `1ddcc55c` («el barrido de motores se cierra», REG-263, v1145).
2. **`CURRENT_ITERATION.md`** — se le **quitó la cabecera de cifras**. Ésa era la
   causa raíz: el archivo repetía a mano cuatro números que `MASTER_STATE.json`
   ya deriva. Ahora apunta al tablero derivado en vez de duplicarlo.
3. **Nada se revirtió.** Las 490 confirmaciones de la rama, las 111 REG del
   ledger, los sellos de `invariantes-clinicos.json` y las 7 169 pruebas quedan
   exactamente como estaban. La reconciliación tocó **dos archivos de estado** y
   **cero líneas de código productivo**.

## Por qué volvió a pasar, y qué cambia esta vez

El propio `MASTER_STATE.json` traía escrito el diagnóstico, de la vez anterior:

> «La causa no es descuido: es que actualizarlo depende de que yo me acuerde.
> Mientras no lo derive un script, va a volver a pasar.»

REG-241 derivó `MASTER_STATE.json` y le puso guardián
(`el-tablero-del-loop-no-miente`). **Pero dejó fuera `CURRENT_ITERATION.md`**, que
seguía repitiendo las mismas cifras a mano — y por tanto seguía pudiendo mentir.
El guardián no lo cazó porque no lo vigilaba.

Es exactamente la familia `depende_de_recordar` que este proyecto ya nombró. El
arreglo correcto no es «acordarse mejor»: es **quitar el segundo sitio donde el
dato se repite**. Eso es lo que se hizo.

**Pendiente de esta reconciliación** (queda anotado, no se hace ahora para no
mezclarlo con la apertura de V9): extender
`src/__tests__/el-tablero-del-loop-no-miente.test.ts` para que **falle si
`CURRENT_ITERATION.md` vuelve a contener una versión `nexusmed-vNNN`, un conteo
de pruebas o un nombre de rama en su cabecera.** Sin ese guardián, la prohibición
depende otra vez de que alguien se acuerde. → entra al backlog de V9 como
**P2 · STATE-001**.

## Desfases menores detectados, no corregidos aquí

- `CLAUDE.md` dice «6413 casos, 435 archivos»; lo real es **7 169 en 540**. Es
  documentación, no tablero de reanudación, y tocarla ahora mezclaría el cambio
  con la apertura de V9. → backlog **P3 · DOC-001**.
- El comando `/v1` (`~/.claude/commands/v1.md`) apunta a una bitácora del
  1-ago y menciona `mcp__claude-in-chrome__*`, que **ya no existe** en esta
  sesión. → backlog **P2 · STATE-002**.
