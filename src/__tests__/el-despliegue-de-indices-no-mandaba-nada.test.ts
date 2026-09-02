/**
 * GUARDIÁN — REG-506. El despliegue decía «deploying indexes...», contestaba
 * `Deploy complete!` y no mandaba **ni un índice**.
 *
 * ── QUÉ FALLABA, Y CÓMO SE DESCUBRIÓ ────────────────────────────────────────
 *
 * Repasando los pendientes del dueño, el primero de la lista era «desplegar
 * índices y reglas». `docs/ops/INDICES-DE-FIRESTORE.md` lo daba por medio
 * resuelto: «el workflow de producción los MANDA desde v1175, y los mandó el
 * 31-ago con v1177», y decía que lo único que faltaba era mirar en la consola
 * que estuvieran `Enabled` y no `Building`.
 *
 * Se fue a mirar la respuesta real del proveedor —la regla «el dato tiene que
 * LLEGAR»— en el log de la ejecución #13 (1-sep-2026, la que cerró v1178):
 *
 *     i  firestore: deploying indexes...
 *     ✔  firestore: released rules firestore.rules to cloud.firestore
 *     ✔  Deploy complete!
 *
 * Faltan las DOS líneas que `firebase-tools` imprime cuando de verdad manda
 * índices: `reading indexes from <archivo>...` (de `prepareIndexes`) y
 * `deployed indexes in <archivo> successfully` (de `deployIndexes`). Ninguna
 * salió en ninguna de las tres ejecuciones, y el acta cerró `SUCCESS`.
 *
 * ── LA CAUSA RAÍZ ───────────────────────────────────────────────────────────
 *
 * `firebase.json` declaraba `firestore.rules` y **no** `firestore.indexes`. En
 * firebase-tools 15.25.1 (`src/deploy/firestore/prepare.ts`) el envío entero
 * cuelga de esa clave:
 *
 *     if (firestoreConfig.indexes) { prepareIndexes(...) }   // ← nunca entraba
 *
 * Sin ella `context.firestore.indexes` se queda en `[]`, y `deployIndexes`
 * imprime su encabezado, recorre un arreglo vacío y **sale bien**. `--only
 * firestore:indexes` en la línea de comandos no lo arregla: ese argumento
 * decide si el paso corre, no de dónde saca los índices.
 *
 * Es el mismo patrón de REG-167 y REG-160: el comando contesta que sí y el
 * dato no cruza la frontera.
 *
 * ── POR QUÉ IMPORTA ─────────────────────────────────────────────────────────
 *
 * Cuatro de los ocho índices del archivo (REG-379) son de consultas que el
 * producto **ya hace hoy** —bandeja ARCO, lista de farmacia, rastro de un
 * controlado y la página PÚBLICA del médico—. Firestore no degrada una consulta
 * sin índice: la rechaza entera con `FAILED_PRECONDITION`. Y el repositorio
 * llevaba tres ejecuciones creyendo que ya estaban enviados.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No dice que los índices estén CONSTRUIDOS.** Declarar, enviar y construir
 *   son tres actos. Este guardián cubre el segundo —que el envío incluya el
 *   archivo—; el tercero es asíncrono y se mira en la consola del proyecto.
 * · **No dice que esas cuatro consultas estén rotas en producción hoy**: un
 *   índice pudo crearse a mano desde el enlace del error. Lo que afirma es que
 *   el camino automático no los mandaba.
 * · **No lee firebase-tools.** Si una versión futura cambia la condición o el
 *   texto de sus mensajes, esto sigue en verde. Por eso el candado de verdad
 *   está en el workflow, que exige la línea de éxito en la salida REAL del
 *   despliegue; este archivo vigila la configuración desde la que sale.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const firebaseJson = JSON.parse(readFileSync('firebase.json', 'utf8'))
const workflow = readFileSync('.github/workflows/deploy-production.yml', 'utf8')

/**
 * Las líneas de CÓDIGO del workflow, sin los comentarios.
 *
 * Hace falta porque el propio workflow EXPLICA el defecto en su cabecera —«iban
 * en UN paso con `--only firestore:rules,firestore:indexes`»— y una comprobación
 * que busque esa cadena en el archivo entero da positivo sobre la nota que
 * cuenta por qué ya no se hace. Un comentario que describe lo que se dejó de
 * hacer no es lo que se hace.
 */
const codigoDelWorkflow = workflow
  .split('\n')
  .filter(l => !/^\s*#/.test(l))
  .join('\n')

/**
 * La decisión de firebase-tools 15.25.1, copiada tal cual desde
 * `src/deploy/firestore/prepare.ts` + `deploy.ts`:
 *
 *   · `getFirestoreConfig` devuelve `{ rules: cfg.rules, indexes: cfg.indexes }`
 *     sin rellenar nada por omisión;
 *   · `prepareIndexes` sólo corre bajo `if (firestoreConfig.indexes)`;
 *   · `deployIndexes` recorre lo que aquélla haya dejado.
 *
 * Devuelve cuántos archivos de índices llegaría a enviar el despliegue.
 */
function archivosDeIndicesQueSeEnviarian(configDeFirebase: unknown): number {
  const cfg = (configDeFirebase as { firestore?: unknown })?.firestore
  const entradas = Array.isArray(cfg) ? cfg : [cfg]
  return entradas.filter(e => Boolean((e as { indexes?: string } | undefined)?.indexes)).length
}

describe('REG-506 · el despliegue de índices envía el archivo, y no sólo lo dice', () => {
  it('firebase.json declara el archivo de índices', () => {
    expect(
      firebaseJson.firestore?.indexes,
      'sin esta clave, `firebase deploy --only firestore:indexes` sale SUCCESS sin enviar nada',
    ).toBe('firestore.indexes.json')
  })

  it('el archivo que declara es el que tiene los ocho índices', () => {
    const declarados = JSON.parse(
      readFileSync(firebaseJson.firestore.indexes, 'utf8'),
    ) as { indexes: { collectionGroup: string }[] }

    /* Los cuatro de consultas que el producto YA hace (REG-379). Si el archivo
       que apunta firebase.json fuera otro, aquí se vería. */
    const colecciones = declarados.indexes.map(i => i.collectionGroup)
    for (const viva of ['arco_requests', 'farmacia', 'farmacia_movimientos', 'reviews']) {
      expect(colecciones, `el índice de ${viva} no está en el archivo declarado`).toContain(viva)
    }
  })

  it('con la configuración de hoy, el despliegue SÍ enviaría índices', () => {
    expect(archivosDeIndicesQueSeEnviarian(firebaseJson)).toBe(1)
  })

  it('AL REVÉS: sin la clave `indexes`, el despliegue no enviaría ninguno', () => {
    /**
     * La prueba del guardián: se reproduce el defecto tal como estaba —la
     * configuración exacta de v1178— y se comprueba que el modelo lo detecta.
     * Sin esto, `archivosDeIndicesQueSeEnviarian` podría devolver 1 siempre y
     * el caso de arriba pasaría por la razón equivocada.
     */
    const comoEstabaEnV1178 = { firestore: { rules: 'firestore.rules' } }
    expect(archivosDeIndicesQueSeEnviarian(comoEstabaEnV1178)).toBe(0)
  })

  it('los índices se despliegan en su PROPIO paso, no colgados de las reglas', () => {
    /**
     * ESTA COMPROBACIÓN CAMBIÓ AL FUSIONAR, Y CONVIENE DECIR POR QUÉ.
     *
     * La primera versión exigía que el paso comprobara su salida buscando la
     * línea de éxito de `deployIndexes`. Mientras esta rama estaba abierta, otra
     * sesión encontró el mismo defecto y su arreglo llegó antes a `main` — y
     * llegó MÁS LEJOS: en vez de un `grep` sobre una salida compartida, partió
     * el paso en dos (`--only firestore:rules` y `--only firestore:indexes`),
     * guardó el log de los índices y añadió el diagnóstico del 403 de IAM, que
     * es el fallo real cuando la credencial publica reglas y no crea índices.
     *
     * Se conserva la de `main`, que es mejor, y aquí se vigila el invariante
     * estructural que las dos comparten: **el éxito de las reglas ya no puede
     * dar por bueno el envío de los índices**, porque son pasos distintos.
     * Volver a juntarlos —o quitarle el `--only firestore:indexes`— reabriría la
     * puerta por la que se coló REG-506.
     */
    expect(workflow).toContain('--only firestore:indexes')
    expect(workflow).toContain('id: indices')
  })

  it('y el éxito de las REGLAS ya no puede dar por bueno el de los índices', () => {
    /**
     * El envío iba en un solo comando —`--only firestore:rules,firestore:indexes`—
     * con una sola salida y un solo código. Por eso «reglas publicadas» y «cero
     * índices enviados» cabían en el mismo `success`, que es lo que dejó pasar
     * REG-506 durante tres ejecuciones del botón. Volver a juntarlos reabre esa
     * puerta aunque `firebase.json` siga bien.
     */
    expect(
      codigoDelWorkflow,
      'los índices volvieron a colgar del mismo comando que las reglas',
    ).not.toContain('firestore:rules,firestore:indexes')
  })
})
