/**
 * GUARDIÁN — una variable de entorno que sólo existe en el código es una
 * configuración que nadie sabe que hay que poner.
 *
 * ── QUÉ FALLABA, Y CÓMO SE DESCUBRIÓ ────────────────────────────────────────
 *
 * Documentando las cuatro variables pendientes del dueño se contaron las que el
 * código lee de verdad: **128**, dieciséis de ellas públicas. No existía
 * `.env.example` ni ningún inventario. Lo que cada una espera vivía en
 * comentarios repartidos por el árbol.
 *
 * Es exactamente el patrón que ya costó caro con los índices de Firestore
 * (`el-indice-que-nadie-declaro`, y después REG-506): **el dato existía y el
 * registro que lo reúne, no**. Repartido así, nadie puede saber cuántas faltan
 * ni pedirlas de una vez, y cada consultorio nuevo, cada proyecto restaurado y
 * cada máquina de trabajo recién montada las descubre **de una en una, en
 * producción** — que es cuando una configuración que falta ya cuesta dinero o
 * una consulta.
 *
 * ── QUÉ VIGILA ──────────────────────────────────────────────────────────────
 *
 * Que el inventario derivado (`docs/ops/inventario-de-entorno.json`) y la
 * plantilla (`.env.example`) coincidan con lo que el árbol lee **hoy**. Si
 * alguien añade `process.env.LO_QUE_SEA` y no regenera, esto se pone rojo en su
 * PR y no seis meses después.
 *
 * ── QUÉ NO CUBRE, DECLARADO ─────────────────────────────────────────────────
 *
 * · **No dice si la variable está puesta en Vercel.** Eso se mira del otro lado
 *   —regla «el dato tiene que LLEGAR»— y no puede vivir en el repositorio.
 * · **No juzga si un valor es correcto**, ni si el respaldo por omisión es el
 *   adecuado. Sólo dice quién lee qué y con qué respaldo literal.
 * · **Sólo ve valores por omisión LITERALES.** Uno que caiga a una constante
 *   (`?? DEFAULT_OWNER`, real en `superadmin-client.ts`) se cuenta como «sin
 *   respaldo». Se prefiere ese error a la inversa: decir «tiene respaldo» de
 *   algo que no lo tiene sería peor.
 * · **No ve variables construidas dinámicamente** (`process.env[nombre]`). Hoy
 *   no hay ninguna; el día que la haya, este inventario no la verá.
 * · **No comprueba que el archivo generado sea igual en OTRA máquina.** Lo que
 *   comprueba es que no dependa del orden de llegada de los archivos, que es
 *   por donde se coló REG-509. Otras fuentes de no-determinismo —una versión
 *   distinta de `grep`, un `src/` con archivos que aquí no existen— seguirían
 *   sin verse desde aquí.
 * · No comprueba que `INVENTARIO-DE-ENTORNO.md` describa cada una: el
 *   conocimiento humano se escribe a mano y no se puede exigir por conteo sin
 *   invitar a rellenarlo con ruido.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { inventarioDelArbol } from '../../scripts/ops/inventario-de-entorno.mjs'

const inventarioEnDisco = JSON.parse(
  readFileSync('docs/ops/inventario-de-entorno.json', 'utf8'),
) as { total: number; variables: { nombre: string; publica: boolean; ambito: string }[] }

const delArbol = inventarioDelArbol() as { nombre: string; publica: boolean; ambito: string }[]

describe('ninguna variable de entorno vive sin declarar', () => {
  it('el lector encuentra variables de verdad (si no, pasaría vacío)', () => {
    /* El modo de fallo de un guardián derivado es no encontrar nada y dar todo
       por bueno. Ya pasó con la expresión regular de `el-indice-que-nadie-declaro`. */
    expect(delArbol.length).toBeGreaterThan(100)
    expect(delArbol.map(v => v.nombre)).toContain('STRIPE_WEBHOOK_SECRET')
  })

  it('el inventario en disco es el del árbol', () => {
    const enDisco = inventarioEnDisco.variables.map(v => v.nombre).sort()
    const hoy = delArbol.map(v => v.nombre).sort()
    const faltan = hoy.filter(n => !enDisco.includes(n))
    const sobran = enDisco.filter(n => !hoy.includes(n))
    expect(
      { faltan, sobran },
      'inventario desfasado → node scripts/ops/inventario-de-entorno.mjs',
    ).toEqual({ faltan: [], sobran: [] })
  })

  it('AL REVÉS: una variable nueva sin regenerar se detecta', () => {
    /**
     * La prueba del guardián. Se le quita una del inventario y se comprueba que
     * la comparación la echa de menos. Sin esto, los dos casos de arriba podrían
     * estar pasando porque la comparación no compara nada.
     */
    const mutilado = inventarioEnDisco.variables
      .map(v => v.nombre)
      .filter(n => n !== 'CRON_SECRET')
    const faltan = delArbol.map(v => v.nombre).filter(n => !mutilado.includes(n))
    expect(faltan).toEqual(['CRON_SECRET'])
  })

  it('`.env.example` está al día y no lleva ningún valor', () => {
    const ejemplo = readFileSync('.env.example', 'utf8')
    const conValor = ejemplo
      .split('\n')
      .filter(l => /^[A-Z][A-Z0-9_]*=.+/.test(l))
    expect(
      conValor,
      'la plantilla se versiona: un valor real aquí es un secreto publicado',
    ).toEqual([])

    /* Y que la generación esté al día — el script lo compara entero. */
    expect(() => execSync('node scripts/ops/inventario-de-entorno.mjs --verificar', { stdio: 'pipe' }))
      .not.toThrow()
  })

  it('AL REVÉS: el orden en que llegan los archivos no cambia el resultado', () => {
    /**
     * REG-509 — LA PRUEBA QUE FALTABA, Y QUE HABRÍA AHORRADO UN CI EN ROJO.
     *
     * `grep -rl` devuelve los archivos en el orden del sistema de archivos.
     * Nueve variables se leen en más de un archivo de `src/`, y el respaldo
     * elegido era «el primero que apareciera»: en esta máquina uno, en el
     * runner otro, y el archivo generado salía distinto **sin que cambiara una
     * línea del código**. El guardián de arriba lo vio en CI y no aquí, que es
     * la peor forma de verlo.
     *
     * Se le pasa la lista al revés y se exige el MISMO resultado. Con el código
     * anterior —sin ordenar, y eligiendo por orden de llegada— esto falla.
     */
    const archivos = execSync(
      "grep -rl 'process\\.env' src scripts --include=*.ts --include=*.tsx --include=*.mjs --include=*.js 2>/dev/null || true",
      { encoding: 'utf8' },
    ).trim().split('\n').filter(Boolean)
    expect(archivos.length).toBeGreaterThan(100)

    const alDerecho = inventarioDelArbol(archivos)
    const alReves = inventarioDelArbol([...archivos].reverse())
    expect(
      alReves,
      'el inventario depende del orden en que el sistema de archivos devuelve los archivos',
    ).toEqual(alDerecho)
  })

  it('la plantilla se puede versionar (si no, el guardián moriría en un clon limpio)', () => {
    /**
     * `.gitignore` trae `.env*`. Sin la excepción, `.env.example` no se sube: un
     * clon limpio no lo tendría, el caso de arriba fallaría en CI y el remedio
     * obvio —borrar la comprobación— dejaría el inventario sin dueño otra vez.
     */
    expect(readFileSync('.gitignore', 'utf8')).toContain('!.env.example')
  })

  it('ninguna variable PÚBLICA lleva un secreto en el nombre', () => {
    /**
     * `NEXT_PUBLIC_*` se inserta en el paquete que baja el navegador: es texto
     * plano para cualquiera que abra las herramientas de desarrollo.
     *
     * Las dos que hoy dan positivo por su nombre son públicas **por diseño** del
     * proveedor —la llave web de Firebase y la clave de sitio de App Check están
     * pensadas para ir en el cliente; lo que protege ahí son las reglas de
     * Firestore, no el secreto de la llave—. Cualquier OTRA sería un secreto
     * publicado, y eso es lo que este caso vigila.
     */
    const PUBLICAS_A_PROPOSITO = new Set([
      'NEXT_PUBLIC_FIREBASE_API_KEY',
      'NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY',
    ])
    const sospechosas = delArbol
      .filter(v => v.publica)
      .map(v => v.nombre)
      .filter(n => /SECRET|TOKEN|PASSWORD|CREDENTIAL|PRIVATE/i.test(n) || (/KEY/i.test(n) && !PUBLICAS_A_PROPOSITO.has(n)))
    expect(sospechosas, 'una NEXT_PUBLIC_ con un secreto dentro es un secreto publicado').toEqual([])
  })
})
