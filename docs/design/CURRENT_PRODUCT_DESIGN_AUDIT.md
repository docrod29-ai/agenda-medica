# Auditoría del producto real — `PATIENT-UX-TRUTH-001`

> **Unidad**: V9 · iteración 0 · 8-ago-2026
> **Rama**: `claude/nexus-patient-ux-v9`
> **Qué es**: el documento cabecera de la auditoría. El detalle vive en los seis
> hermanos que se listan en §6.

---

## §1 — Lo que se buscaba, y lo que se encontró

La directiva V9 abre pidiendo que se audite el producto real y que se busquen,
entre otras cosas, «cara de producto generado por IA», exceso de tarjetas
redondeadas, degradados morados y cristal por todas partes.

**Nada de eso está aquí.** Se midió cada señal y salen a cero o a uno. Lo que hay
es una identidad visual declarada, oscura por defecto y con los cocientes de
contraste WCAG **calculados a mano y escritos en el propio CSS**.

Lo que sí se encontró es otra cosa, y es peor:

> **El producto pierde consultas ya grabadas, y le dice al paciente que su cita
> no existe.**

Tres defectos P0 de integridad de datos alrededor de la grabación, y un P0 de la
superficie del paciente que ya quedó reparado en esta misma unidad.

## §2 — Los cuatro P0

| # | P0 | Estado |
|---|---|---|
| 1 | **Volver a grabar borra el audio anterior.** El blob se arma con los trozos de esta sesión; el borrado arrasa el rango entero de la clave. 22 minutos grabados desaparecen sin transcribir | **ABIERTO** — `PATIENT-AUDIO-001` |
| 2 | **Navegar termina la grabación en silencio.** El desmontaje libera recursos sin llamar a `detener()`, y `template.tsx` garantiza el desmontaje en cada navegación | **ABIERTO** — `PATIENT-AUDIO-002` |
| 3 | **El cierre por inactividad no oye dictar y se lleva la recuperación.** Hablar no genera ratón ni teclado; a los 30 minutos cierra sesión y borra la base de recuperación en **las dos** ramas | **ABIERTO** — `PATIENT-AUDIO-003` |
| 4 | **El enlace de la videoconsulta del paciente no llevaba token** → 404 «Cita no encontrada» en la hora de su consulta, incluso desde su propio portal | **REPARADO** — REG-268 |

Los tres primeros comparten una causa de fondo que conviene nombrar: **el
esfuerzo de persistencia se puso donde ya había red** —el texto de la nota, que
tiene borrador en memoria, respaldo local, autoguardado y volcado— y **no donde
no la hay**: el audio, que no tiene segunda copia en ninguna parte.

## §3 — Los dos defectos reparados en esta unidad

**REG-268 · El enlace del paciente no llevaba con qué entrar.**
`enlaceSalaPaciente` componía `?c=<clinicId>` y nada más; `/api/telesalud/sala`
exige token HMAC o sesión de miembro, y responde 404 a quien no trae ninguno —
a propósito, para no confirmar que el `citaId` existe. El paciente pulsaba
«Entrar a la videoconsulta» **dentro de su portal**, con el token en la barra de
direcciones, y recibía «Cita no encontrada».

Nadie de dentro lo veía: el botón del médico sí añade `&t=`. **Sólo fallaba el
camino que ningún empleado recorre.** El token es ahora un parámetro obligatorio,
y el portal pasa el suyo.

**REG-269 · `@keyframes spin` no existía en ningún sitio global.** 90
referencias, incluidas las dos piezas compartidas del sistema de diseño. Lo
definían 31 archivos de pantalla en `<style>` locales, así que el giro funcionaba
mientras alguno estuviera montado y se congelaba en cuanto no. Un indicador de
carga parado no dice «esperando», dice «se colgó», y el médico vuelve a pulsar
sobre una petición que sí corría.

Los dos con prueba que **falla sin el arreglo**, comprobada al revés.

## §4 — El instrumento que deja esta unidad

Una auditoría es una foto y caduca. Por eso la parte contable **se deriva**:

- `scripts/design/inventario-de-pantallas.mjs` genera
  `docs/design/SCREEN_INVENTORY.md` desde el árbol de rutas.
- `src/__tests__/el-inventario-de-pantallas-no-miente.test.ts` falla si el
  documento se queda atrás, y también si aparece una ruta que nadie ha
  clasificado por superficie.

Es la lección de REG-241 aplicada por adelantado: cualquier cifra que dependa de
que alguien se acuerde acabará mintiendo.

**78 pantallas · 9 del paciente · 32 del médico · 10 alpha · 18 públicas · 9
internas.**

## §5 — Lo que esto cambia del plan de V9

El orden de la directiva se respeta, con dos ajustes que salen de la evidencia:

1. **Los tres P0 de audio van primero**, aunque su ficha diga `NAVIGATION-001`.
   Es pérdida irreversible de datos clínicos, y la propia rutina dice que un P0
   de integridad manda sobre el orden.
2. **`DESIGN-SYSTEM-001` no empieza por colores** —lo prohíbe §13 de la
   directiva— **y tampoco le hace falta**: el color no es el problema. El
   problema es que `@theme inline` expone a Tailwind **cuatro** valores
   (`globals.css:126-131`), así que no hay utilidades que usar y el 88,5 % de los
   archivos cae al estilo en línea. Ensanchar esa exposición es la causa raíz.

Y una confirmación que ahorra trabajo: **«Resultados» no es una navegación.**
`PanelLaboratorios` se monta dentro de la consulta y del expediente, así que esa
pata del ciclo de la directiva ya no cuesta nada. La que cuesta es la de la
Agenda.

## §6 — Los documentos de esta unidad

| Documento | Qué contiene |
|---|---|
| `docs/design/SCREEN_INVENTORY.md` | **Derivado.** Las 78 pantallas por superficie |
| `docs/design/NAVIGATION_STATE_AUDIT.md` | Los 3 P0 de audio, 4 P1, 10 P2/P3, y las 6 comprobaciones que exigen navegador |
| `docs/design/GENERIC_AI_AESTHETIC_AUDIT.md` | Que la premisa no se cumple, y cuál es el defecto real, con recuentos |
| `docs/patient/PATIENT_COMPANION_BASELINE.md` | Lo que el paciente puede hacer hoy, con evidencia |
| `docs/competitive/PATIENT_EXPERIENCE_MATRIX.md` | 19 capacidades contra 4 competidores, con lo que no se sabe marcado |
| `docs/competitive/UX_UI_MATRIX.md` | Principios de interacción extraídos, y los 10 principios de V9 puntuados |
| `agent-state/BACKLOG.json` | El backlog priorizado P0/P1/P2/P3 |

## §7 — Qué **NO** cubre esta auditoría

Y esto es lo más importante del documento, porque marca dónde **no** puede
apoyarse la siguiente sesión:

1. **No se abrió la aplicación.** Ni una pantalla, ni un navegador, ni un
   viewport móvil. Todo es lectura de código y recuentos. La directiva V9 §4 dice
   que no se aprueba interfaz leyendo código, y **esta auditoría no aprueba
   ninguna pantalla**: prioriza el barrido.
2. **Hay seis comprobaciones que sólo un navegador puede resolver**, listadas en
   `NAVIGATION_STATE_AUDIT.md` §6. Dos de ellas **pueden convertir un P2 en P0**:
   si pulsar el botón central de la barra inferior remonta la consulta, mata una
   grabación; y si `stripUndefined` no protege lo que se cree, una nota firmada
   puede archivarse sin su diálogo diarizado.
3. **La reparación del fotograma `spin` no se verificó en navegador.** Se
   confirmó de forma estática. Definir un fotograma referenciado 90 veces no
   puede empeorar nada, pero verlo girar sigue pendiente. El build no llegó a
   emitir CSS en este entorno (falta la clave de Firebase; ver §8).
4. **Las columnas de la competencia son información pública**, y la cara del
   paciente está mal documentada. Un `?` significa «no encontré fuente», no «no
   lo tienen».
5. **No se auditó Hospital ni UCI** más allá de contarlos. Siguen en ALPHA y su
   incompletitud no bloquea Practice.
6. **No se midió rendimiento.** Ninguna métrica.

## §8 — Estado de las compuertas en esta unidad

| Compuerta | Resultado |
|---|---|
| `npx vitest run` | **8 083 casos · 1 fallo preexistente y de entorno** — `ops-timeout-y-punto-ciego`, que abre una conexión a una IP no enrutable esperando que expire; detrás del proxy de este entorno falla rápido en vez de expirar. Comprobado con las modificaciones guardadas aparte: falla igual en `HEAD` limpio |
| `node scripts/lint-trinquete.mjs` | **96 errores, igual que el techo. Sin deuda nueva** |
| `npx tsc --noEmit` | **limpio** |
| `npm run build` | **compila** («Compiled successfully in 41s») y **luego falla al recolectar datos de página** con `auth/invalid-api-key`: este contenedor no tiene las variables de Firebase. Es entorno, no código |
| navegador / móvil / accesibilidad | **no ejecutadas.** Se definen en `DESIGN-SYSTEM-001` |
