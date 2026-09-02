/**
 * GUARDIÁN — `firebase deploy --only X` publica X **sólo si `firebase.json`
 * declara X**. Si no lo declara, no falla: no publica nada y dice `success`.
 *
 * ── QUÉ FALLABA, Y CÓMO SE DESCUBRIÓ ────────────────────────────────────────
 *
 * Acompañando al dueño a crear los índices a mano en la consola de Firebase, la
 * pestaña «Índices → Manuales» del proyecto `nexomed-agenda` salió **vacía**.
 * Cero índices compuestos. Y el acta de `nexusmed-v1177` registraba, sobre el
 * mismo proyecto, el paso `firestore:rules,firestore:indexes` en `success`.
 *
 * Las dos cosas eran ciertas. `firebase.json` decía:
 *
 *     "firestore": { "rules": "firestore.rules" }
 *
 * Las reglas estaban declaradas; **el archivo de índices no**. El despliegue
 * publicaba las reglas —por eso el sello de REG-416 cuadraba— y para los índices
 * no encontraba nada que publicar. Devolvía éxito porque, literalmente, hizo
 * todo lo que se le pidió: lo que se le pidió era nada.
 *
 * ── LA CAUSA RAÍZ ───────────────────────────────────────────────────────────
 *
 * Es la regla «el dato tiene que LLEGAR» en su forma más cara: el archivo
 * `firestore.indexes.json` estaba **bien escrito y bien vigilado** — REG-421 y
 * REG-422 le pusieron un guardián que deriva las consultas del árbol y comprueba
 * el orden de los campos. Todo ese trabajo comprobaba que el contenido fuera
 * correcto. **Nadie comprobaba que el archivo llegara a Firebase.**
 *
 * Y por eso ninguna prueba lo cazó: no hay ninguna que mienta. Faltaba.
 *
 * ── QUÉ SE PIERDE MIENTRAS TANTO, Y POR QUÉ NO SE VE ────────────────────────
 *
 * Una consulta compuesta sin índice se RECHAZA. Pero las tres rutas que ya la
 * hacían la envuelven en un `try/catch` que devuelve vacío: la lista de la
 * farmacia, la página pública del médico y la lista de espera **no se ven
 * rotas, se ven sin datos**. Es exactamente el modo de fallo que REG-422 nombró
 * para el libro de costos, aquí multiplicado por toda la aplicación.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * Lo que el despliegue **dice** publicar y lo que `firebase.json` **declara** no
 * pueden divergir. Este guardián lee los objetivos del `--only` del workflow
 * real —no una lista escrita a mano— y exige que cada uno esté declarado, y que
 * el archivo que declara exista.
 *
 * Es genérico a propósito: el día que alguien añada `storage` o `hosting` al
 * `--only`, este caso lo exige declarado sin que nadie se acuerde de ampliarlo.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No prueba que el despliegue funcione.** Que el archivo esté declarado no
 *   dice que la credencial tenga permiso, ni que el índice termine de
 *   construirse. Eso se mira en la consola, del otro lado, y no puede vivir aquí.
 * · **Sólo lee el workflow de producción.** Un despliegue hecho a mano desde
 *   otra máquina con otro `--only` no lo ve nadie.
 * · **No comprueba el contenido** de `firestore.indexes.json`: de eso se ocupa
 *   `el-indice-que-nadie-declaro.test.ts`.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const RAIZ = process.cwd()
const RUTA_WORKFLOW = '.github/workflows/deploy-production.yml'
const RUTA_FIREBASE = 'firebase.json'

const leer = (rel: string) => readFileSync(resolve(RAIZ, rel), 'utf8')

/**
 * Los objetivos que el workflow dice publicar, derivados de sus `--only`.
 *
 * `firestore:rules` → producto `firestore`, clave `rules`.
 * Se deriva del archivo y no se escribe a mano: una lista escrita a mano es
 * justo lo que se queda vieja el día que alguien cambia el comando.
 */
function objetivosDelDespliegue(yml: string): { producto: string; clave: string }[] {
  const salida: { producto: string; clave: string }[] = []
  for (const m of yml.matchAll(/--only\s+([A-Za-z0-9_:,]+)/g)) {
    for (const objetivo of m[1].split(',')) {
      const [producto, clave] = objetivo.split(':')
      if (producto && clave) salida.push({ producto, clave })
    }
  }
  return [...new Map(salida.map(o => [`${o.producto}:${o.clave}`, o])).values()]
}

const firebaseJson = JSON.parse(leer(RUTA_FIREBASE)) as Record<string, Record<string, string>>

describe('lo que el despliegue dice publicar está declarado en firebase.json', () => {
  const objetivos = objetivosDelDespliegue(leer(RUTA_WORKFLOW))

  it('el lector encuentra objetivos de verdad (si no, pasaría vacío)', () => {
    /* El modo de fallo de este archivo es no encontrar nada y dar todo por
       bueno — el mismo que tuvo el guardián de índices en REG-421. */
    expect(objetivos.length).toBeGreaterThanOrEqual(2)
    expect(objetivos).toContainEqual({ producto: 'firestore', clave: 'indexes' })
  })

  it('cada objetivo del `--only` está declarado, y su archivo existe', () => {
    const huerfanos: string[] = []
    for (const { producto, clave } of objetivos) {
      const declarado = firebaseJson[producto]?.[clave]
      if (!declarado) {
        huerfanos.push(`${producto}:${clave} — el despliegue lo publica y firebase.json NO lo declara`)
        continue
      }
      if (!existsSync(resolve(RAIZ, declarado))) {
        huerfanos.push(`${producto}:${clave} — declara "${declarado}", que no existe`)
      }
    }
    expect(
      huerfanos,
      'Un objetivo sin declarar NO falla el despliegue: no publica nada y devuelve `success`.\n'
      + 'Así estuvo el proyecto sin un solo índice compuesto mientras el acta decía éxito (REG-431).',
    ).toEqual([])
  })

  it('al revés: quitar la declaración de índices deja huérfano su objetivo', () => {
    /**
     * La prueba del guardián. Se reconstruye el `firebase.json` que había ANTES
     * de REG-431 y se comprueba que este archivo lo habría cazado. Sin esto, la
     * comprobación de arriba podría estar pasando por la razón equivocada.
     */
    const comoEstaba = { ...firebaseJson, firestore: { rules: 'firestore.rules' } }
    const huerfanos = objetivos.filter(
      ({ producto, clave }) => !(comoEstaba as Record<string, Record<string, string>>)[producto]?.[clave],
    )
    expect(huerfanos).toContainEqual({ producto: 'firestore', clave: 'indexes' })
  })

  it('y el archivo de índices declarado es el que vigila el otro guardián', () => {
    /* Declarar OTRO archivo pasaría los casos de arriba y desplegaría algo que
       nadie comprueba. Los dos guardianes tienen que mirar el mismo archivo. */
    expect(firebaseJson.firestore?.indexes).toBe('firestore.indexes.json')
    const declarados = JSON.parse(leer('firestore.indexes.json')) as { indexes: unknown[] }
    expect(declarados.indexes.length).toBeGreaterThan(0)
  })
})
