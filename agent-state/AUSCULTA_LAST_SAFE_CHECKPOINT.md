# AUSCULTA — último punto seguro

## Checkpoint · 29-ago-2026 — **P0 = 0 y P1 internos = 0. Empieza el trabajo de los workstreams sin cola**

```
CURRENT_BRANCH=claude/ausculta-master-completion-4clx9v
CURRENT_HEAD=(este commit)
CURRENT_PR=#389
CURRENT_WORKSTREAM=WS-03 (consultorio grande) — queda el inventario de lecturas de CITAS
LAST_COMPLETED_UNIT=P1-19 · REG-359 · la verificación de citas por fin corre, y marca lo no respaldado
CURRENT_PARTIAL_UNIT=(ninguna)
EXACT_NEXT_ACTION=La cola prioritaria está vacía. Sigue el trabajo POR WORKSTREAM, empezando por el que hoy está más lejos de PROVEN y no depende de nadie de fuera: WS-11 (ciclo cerrado — faltan `acted_on`, `patient_notified`, `scheduled` y el registro de transiciones; las interconsultas y referencias no están en el ciclo y la imagen no tiene entidad). Después WS-10 (Patient State: alergias, procedimientos, dispositivos, laboratorios, tendencias — y sin `asOf` ni versión), WS-09 (aplicabilidad, hoy NOT_STARTED), WS-12 (evals/patient-ai NO EXISTE y la regla lo exige como compuerta) y WS-02 (arnés de carga que produzca el JSON que el validador ya sabe leer).
FILES_IN_SCOPE=src/lib/tareas-clinicas/ · src/lib/expediente/laboratorio/ · src/types/expediente.ts
FILES_LOCKED=(ninguno — un solo writer)
TESTS_PASSED=10790
TESTS_FAILED=1
KNOWN_ENVIRONMENT_FAILURES=ops-timeout-y-punto-ciego.test.ts — exige que 10.255.255.1 trague paquetes; el proxy del contenedor rechaza al instante. NO tocar la aserción.
BUILD=compila con los placeholders NEXT_PUBLIC_FIREBASE_* del CI; sin ellos falla en «collect page data» (auth/invalid-api-key), que es del entorno
P0_OPEN=(ninguno interno)
P1_OPEN=(ninguno interno)
BLOCKED_EXTERNAL=P1-6 E0-06 alergias · P1-14 índice compuesto · iPhone/WebKit real · despliegue de firestore.rules · PITR/restore real · pentest · licencias de evidencia
DO_NOT_REGRESS=REG-323 · REG-337…REG-359
```

### Cerrado en esta tanda

| REG | Qué |
|---|---|
| 348 | El respaldo se llevaba las colecciones de nivel raíz y el importador las rechazaba todas |
| 349 | Esa restauración podía **quitarle la cuenta a otro consultorio**: miraba de quién era el documento fuera de transacción |
| 350 | El historial completo de un paciente se bajaba en cada pantalla — y con él caían dos amplificaciones peores y una salvaguarda que habría quedado colgando del techo |
| 351 | Nueve pantallas trataban el recorte del directorio como el censo completo: typeahead que decía «no está», importador que duplicaba el consultorio, panel NOM-004 que afirmaba «al día», libro de controlados sin el nombre de a quién se le dio |
| 352 | La baja de un paciente leía la agenda ENTERA y se tragaba el fallo: por ese camino pasa la cancelación ARCO, y podía borrar el expediente dejando citas con su nombre y su teléfono |
| 353 | Un proveedor caído se seguía reintentando en cada petición, pagando el timeout entero. Interruptor por proveedor **y por llave**: una llave revocada de un consultorio no puede apagar a los demás |
| 354 | El repositorio no sabía si sus reglas rigen en producción. `vercel --prod` no las publica, y la nota viajaba en prosa desde E0-06. Ahora se deriva del sha256 y una compuerta exige declarar qué se rompe mientras tanto |
| 355 | Quedaban escritores de scroll que no preguntaban. La regla correcta existía **dentro de un componente**; ahora es del sistema. Y `overscroll-behavior` no aparecía en todo el repositorio |
| 356 | La evidencia de la consulta no decía dónde NO había mirado. La maquinaria estaba escrita y probada desde REG-345, y esta ruta no la tenía cableada |
| 357 | Se reproducía texto completo de PMC sin leer la licencia del artículo. «Acceso abierto» dice que se puede LEER, no que se pueda COPIAR en un producto de pago. Ahora falla cerrado |
| 358 | Un duplicado con los nombres al revés no aparecía: el buscador decía «no está» y el antiduplicado no saltaba, así que la historia quedaba partida en dos expedientes |
| 359 | Se comprobaba que la cita estuviera en RANGO, no que el artículo dijera eso. Un `[2]` que apuntara a un artículo que dice lo contrario pasaba, con la apariencia de estar respaldado |

### El saldo, escrito

`cerrado −1 (P1-16)` · `nuevo +1 (P1-18)` · `cerrado −1 (P1-18)` ·
`cerrado −1 (P1-12)` · `cerrado −1 (P1-11)` · `cerrado −1 (P1-15)` ·
`cerrado −1 (P1-2)` · `cerrado −1 (P1-13)` · `cerrado −1 (P1-9)` ·
`cerrado −1 (P1-10)` · `cerrado −1 (P1-17)` · **`nuevo +1 (P1-19)`** ·
`cerrado −1 (P1-19)` → **9 → 0 P1 internos abiertos**.

**Cerrados 11, nuevos 2** (P1-18 y P1-19, los dos abiertos y cerrados dentro de
esta tanda). Ninguno de los dos se escondió: los dos salieron de revisar lo que
se acababa de cerrar, que es de donde salen los defectos que importan.

El nuevo sale de cerrar P1-9: la otra mitad de ese requisito —que la ruta
produzca `Source` con procedencia estructurada (#314), y que la verificación de
citas (`mapaDeSoporte`, `esRespuestaRespaldada`, `tasaSinRespaldo`) **tenga algún
llamador fuera de pruebas**— no se cerró y no se esconde.
Un P1 nuevo no borra uno cerrado; se enseñan los dos movimientos.

### La cola está vacía. Lo que NO significa

`P0 = 0` y `P1 = 0` **no** quiere decir que el producto esté terminado: quiere
decir que la cola prioritaria del tablero está vacía y que el trabajo pasa a ser
**por workstream**. Sigue faltando, y está escrito en el tablero:

| Workstream | Qué falta de verdad |
|---|---|
| WS-02 escala | El **arnés que produzca** el JSON de carga. Hay validador de forma; no hay medición. 2k…100k son `NOT_STARTED` |
| WS-09 aplicabilidad | `NOT_STARTED`: no hay motor que diga si una evidencia aplica a ESTE paciente |
| WS-10 Patient State | Faltan alergias, procedimientos, dispositivos, laboratorios, tendencias; sin `asOf`, sin versión, sin persistir |
| WS-11 ciclo cerrado | Faltan `acted_on`, `patient_notified`, `scheduled` y el registro de transiciones. Interconsultas y referencias fuera del ciclo; imagen sin entidad |
| WS-12 evaluación | `evals/patient-ai/` **no existe**, y `.claude/rules/patient-facing-ai.md` §7 lo exige como compuerta |
| WS-13 observabilidad | Sin correlation ID de punta a punta; un solo llamador de alertas |

Y las fases de prueba final (carga, inyección de fallos, restauración,
benchmarks, equipo rojo, Final Readiness) siguen sin ejecutarse.

### WS-05 sigue SIN ser `PROVEN`, y es a propósito

Tres de los cuatro mecanismos candidatos del rebote de iPhone están cerrados en
código (REG-342 ×2, REG-355), y `overscroll-behavior` ya existe. **Nada de eso
es una observación**: sólo hay Chromium en el entorno. Falta lo que §38 exige —
WebKit, 390 px, diez repeticiones, `scrollTop` que nunca baje solo— y hasta
entonces no se marca verde. El CSS lleva escrito dentro que no está verificado,
con una prueba que falla si alguien borra esa advertencia.

Queda abierto el cuarto mecanismo: los banners asíncronos que cambian la altura
por encima de `<main>` (41 px medidos por `PorQueEstaAqui`). Sacarlos del flujo
es un cambio de layout del panel y no se hace a ciegas.

### Lo bloqueado por fuera ya no es invisible

Dos huecos que vivían en comentarios sueltos pasan a ser artefactos con lista:

| Qué | Dónde | Comando del dueño |
|---|---|---|
| Índices compuestos (P1-14, worklist, lista de espera, citas, resumen) | `firestore.indexes.json` + `docs/ops/INDICES-DE-FIRESTORE.md` | `npx firebase deploy --only firestore:indexes` |
| Reglas escritas y sin desplegar (`members`, bloque `clinico`, los `match` de REG-340) | `firestore.rules.estado.json` + `docs/ops/REGLAS-DE-FIRESTORE.md` | `npx firebase deploy --only firestore:rules` |

Los dos siguen `BLOCKED_EXTERNAL`. La diferencia es que ahora se puede pedir de
una vez y se sabe qué se rompe mientras tanto. **Conviene pedir las dos juntas.**

### Lo que el tablero decía y el código desmentía

- `PaletteBusqueda` figuraba como «descarga 50 000 pacientes para enseñar 6».
  **REG-341 ya lo había cerrado**; el tablero estaba atrasado y queda corregido.
- `pacientes/page.tsx:934` (segunda descarga sin caché para deduplicar) también
  estaba cerrado desde REG-347.
- **P1-2 figuraba abierto con «ninguna prueba recorre `src/` buscando
  `.collection('…')`»** — y REG-340 había construido exactamente esa prueba. Las
  siete colecciones de consultorio que citaba están en los tres sitios;
  verificado el 29-ago. Lo único vivo era el despliegue de las reglas, que cierra
  REG-354.

### Dos defectos del ARNÉS que salieron al escribir REG-352

Los dos hacían **pasar pruebas vacías**, así que quedan anotados:

1. **`writeBatch` del doble de cliente era un muñeco.** Cualquier prueba que
   afirmara sobre una escritura pasaba sin que la escritura ocurriera.
2. **El `ref` de un documento de consulta sólo tenía `path`**, y media aplicación
   pasa ese `d.ref` a `batch.delete(...)`: el lote no sabía qué borrar y no
   borraba, en silencio.

Cualquier prueba anterior que afirmara sobre escrituras con este doble hay que
mirarla de nuevo: pudo estar en verde por esto.

### El índice que falta ya no vive en comentarios

`firestore.indexes.json` + `docs/ops/INDICES-DE-FIRESTORE.md` reúnen los cuatro
módulos que hoy están peor por no tener índice compuesto (worklist P1-14, lista de
espera, citas del paciente, resumen de notas). Sigue `BLOCKED_EXTERNAL` —lo
despliega el dueño con `npx firebase deploy --only firestore:indexes`— pero ahora
es **una acción concreta y no un hueco invisible**.

### Herramientas que el resto del programa puede usar

1. **`_harness/firestore-admin-en-memoria.ts`** — `doc`, `getAll`, `batch`,
   `tx.getAll` y un gancho de interceptación **en la lectura**.
2. **`_harness/firestore-cliente-en-memoria.ts`** — cuenta documentos leídos,
   entiende `getCountFromServer`, `startAfter` **en la dirección del orden**, y
   sabe simular una **lectura caída** —global (`fallos.lectura`) o en una
   colección concreta (`fallos.lecturaEn`)—, que es como se prueba que alguien
   distingue «no hay» de «no se pudo preguntar»; y **escribe de verdad**
   (`writeBatch`, `setDoc`, `deleteDoc`), que antes no.
3. **`src/lib/pacientes/candidatos.ts`** + `useBusquedaDePacientes` +
   `usePacientesPorId` — la forma canónica de preguntar por un paciente.

Una ruta de `/api` o una pantalla **ya no tiene que probarse leyendo su fuente
como texto**. Varias casillas `PARTIAL` del tablero descansan todavía sobre
substrings; ésta es la vía para convertirlas en medición.

---

## Checkpoint anterior · REG-337–339


## Checkpoint anterior · 28-ago-2026 — A1: el tablero existe y está medido

Cinco auditorías read-only en paralelo con verificación directa del orquestador.
Detalle completo en `docs/product/AUSCULTA-MASTER-BOARD.md`.
