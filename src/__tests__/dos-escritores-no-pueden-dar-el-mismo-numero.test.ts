/**
 * DOS ESCRITORES NO PUEDEN DAR EL MISMO NÚMERO — REG-445.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * El 2-sep-2026 el contador de regresiones se repartió mal SEIS veces en un
 * solo día, entre varias sesiones que no se veían:
 *
 *   REG-434  la cita de la portada        (#433, 00:05)
 *   REG-434  el backfill inejecutable     (#436, 00:58)   → renumerado a 436
 *   REG-436  el backfill inejecutable     (main, 04:35)
 *   REG-436  la lista de alergias         (rama, 04:47)   → renumerado a 437
 *   REG-438  ESTE MISMO GUARDIÁN          (#438, 05:39)   → renumerado a 440
 *   REG-438  el riel del expediente       (#440, 06:13)
 *   REG-440  ESTE MISMO GUARDIÁN, otra vez (#438)          → renumerado a 444
 *   REG-440  la siembra del arnés          (#440, fusionado a main)
 *   REG-444  ESTE MISMO GUARDIÁN, tercera  (#438)          → renumerado a 445
 *   REG-444  el token del paciente         (#441, fusionado a main)
 *
 * TRES de las seis se las llevó este fichero. Cada vez que se renumeró al primer
 * libre, otra rama alcanzó `main` con ese número antes que él. El número sólo es
 * estable cuando el PR se fusiona: mientras espera, es una apuesta.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Las dos primeras, al unificar cuatro PRs abiertos a la vez: los ficheros de
 * contabilidad chocaron y hubo que leerlos. La tercera, por casualidad — un
 * aviso programado de OTRA sesión mencionó de pasada un «REG-436» doce minutos
 * después de que ese número ya hubiera entrado a `main`.
 *
 * «Por casualidad» es el dato importante. No hubo compuerta roja en ninguna.
 *
 * ── LA CUARTA Y LA QUINTA SE LAS LLEVÓ ESTE FICHERO ──────────────────────────
 *
 * Se escribió como REG-438; mientras corría su CI, otra sesión reclamó ese
 * número para el riel del expediente, y pasó a REG-440. Mientras esperaba a que
 * lo fusionaran, ESE número también se lo llevó otra rama —la siembra del
 * arnés—, que además llegó a `main` primero. Acabó en REG-445.
 *
 * Dos renumeraciones antes de aterrizar, y ninguna culpa de nadie: es la forma
 * del sistema haciendo exactamente lo que hace.
 *
 * ── Y LA QUINTA LA CAZÓ ÉL MISMO, EN VIVO ────────────────────────────────────
 *
 * Al traer `main` dentro, git fusionó las dos fichas de REG-440 SIN CONFLICTO
 * —caían lejos una de otra— y las dejó conviviendo. Nada del repositorio lo
 * habría dicho salvo esta prueba, que se puso roja y las nombró:
 *
 *   REG-440
 *     · REG-440 — la siembra del arnés hacía parecer rota una pantalla sana
 *     · REG-440 — el mismo número de regresión se podía dar dos veces
 *
 * No es un fixture: es el ledger de verdad, en la fusión de verdad. Es el caso
 * exacto que este fichero existe para impedir, y ocurrió mientras se escribía.
 *
 * (Y una nota sobre cómo se escribió esta cabecera: el primer intento de
 * corregirla NO se aplicó — la búsqueda ya no casaba tras un renombrado previo,
 * y `str.replace` no avisa cuando no encuentra nada. Quedó una tabla diciendo
 * cinco y una prosa contando cuatro. La misma familia de defecto, en el mismo
 * fichero, el mismo día.)
 *
 * ── LA CAUSA RAÍZ ────────────────────────────────────────────────────────────
 *
 * El contador es GLOBAL, se asigna A MANO, y tiene VARIOS ESCRITORES que numeran
 * contra el `main` que veían al empezar. Una rama abierta ayer no puede saber
 * qué número reclamó otra hace diez minutos. Eso no es descuido de nadie: es la
 * forma del sistema, y REG-267 ya lo había dicho — allí costó perder una
 * reparación clínica entera.
 *
 * ── LA REGLA QUE ESTO HACE SEGURA ────────────────────────────────────────────
 *
 * No se puede impedir que dos sesiones ELIJAN el mismo número: nada dentro de
 * una rama sabe qué hay en otra. Lo que sí se puede impedir —y es donde el daño
 * de verdad ocurre— es que dos entradas con el mismo número lleguen a CONVIVIR
 * en el ledger sin que nada lo diga.
 *
 * Y convivir en silencio es fácil: si las dos entradas caen lejos una de otra,
 * git las fusiona sin conflicto. Fue exactamente lo que pasó. El único motivo de
 * que la colisión de REG-434 se viera es que las entradas quedaron adyacentes.
 *
 * ── QUÉ NO CUBRE, DECLARADO ──────────────────────────────────────────────────
 *
 * · **No ve otra rama.** Corre sobre el árbol que tiene delante. Dos ramas con
 *   el mismo número siguen siendo verdes por separado; lo que ya no pueden es
 *   fusionarse calladas. El aviso llega al fusionar, no al numerar.
 * · **No propone el número libre.** Eso lo calcula
 *   `scripts/mantenimiento/absorber-rama.mjs`, que ya existía.
 * · **No mira la serie 50x** de forma distinta: son números del mismo contador y
 *   entran igual.
 * · **No comprueba que el número sea el SIGUIENTE.** Un hueco no es un defecto:
 *   los números se saltan al renumerar, y exigir que sean correlativos
 *   convertiría cada renumeración en un rojo.
 * · **No mira las menciones en prosa.** «Ver REG-436» dentro de un párrafo es una
 *   referencia, no una declaración, y debe poder repetirse cuantas veces haga
 *   falta.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const LEDGER = join(process.cwd(), 'docs/audit/regression-ledger.md')

/**
 * Qué números DECLARA cada encabezado del ledger.
 *
 * Sólo cuentan las líneas `## REG-…`. Un encabezado puede declarar más de uno
 * —REG-179 y REG-180 comparten causa y comparten ficha— y eso es legítimo: lo
 * que no puede es que DOS encabezados distintos declaren el mismo número.
 */
export function declaracionesPorEncabezado(md: string): { titulo: string; nums: number[] }[] {
  const salida: { titulo: string; nums: number[] }[] = []
  for (const linea of md.split('\n')) {
    if (!linea.startsWith('## REG-')) continue
    const nums = [...linea.matchAll(/REG-(\d+)/g)].map(m => Number(m[1]))
    if (nums.length) salida.push({ titulo: linea.replace(/^##\s*/, '').trim(), nums })
  }
  return salida
}

/**
 * Los números declarados por más de un encabezado, con quiénes los declaran.
 *
 * Devuelve el detalle y no un booleano a propósito: el mensaje de la compuerta
 * tiene que decir CUÁLES son las dos entradas, o quien lo lea a las tres de la
 * mañana tiene que buscarlas a mano.
 */
export function numerosDadosDosVeces(md: string): { num: number; titulos: string[] }[] {
  const porNumero = new Map<number, string[]>()
  for (const { titulo, nums } of declaracionesPorEncabezado(md)) {
    for (const n of nums) porNumero.set(n, [...(porNumero.get(n) ?? []), titulo])
  }
  return [...porNumero.entries()]
    .filter(([, titulos]) => titulos.length > 1)
    .map(([num, titulos]) => ({ num, titulos }))
    .sort((a, b) => a.num - b.num)
}

describe('dos escritores no pueden dar el mismo número de REG', () => {
  const md = readFileSync(LEDGER, 'utf8')

  it('EL CASO: ningún número lo declaran dos encabezados', () => {
    const dobles = numerosDadosDosVeces(md)
    expect(
      dobles,
      dobles.length
        ? 'Números de REG declarados dos veces en el ledger:\n' +
          dobles.map(d => `  REG-${d.num}\n    · ${d.titulos.join('\n    · ')}`).join('\n') +
          '\n\nRenumera el más reciente al primer número libre y DILO en su ficha.'
        : '',
    ).toEqual([])
  })

  it('el ledger declara algo — si se vaciara, la compuerta sería vacua y verde', () => {
    expect(declaracionesPorEncabezado(md).length).toBeGreaterThan(280)
  })

  /* ── AL REVÉS: se le mete el defecto y tiene que fallar ────────────────── */

  it('al revés: caza dos encabezados con el mismo número', () => {
    const falso = [
      '## REG-436 — el paso que «esperaba decisión del dueño» era imposible',
      'texto',
      '## REG-436 — la lista de alergias no cabía en el teléfono',
    ].join('\n')
    expect(numerosDadosDosVeces(falso)).toEqual([
      {
        num: 436,
        titulos: [
          'REG-436 — el paso que «esperaba decisión del dueño» era imposible',
          'REG-436 — la lista de alergias no cabía en el teléfono',
        ],
      },
    ])
  })

  it('al revés del al revés: un encabezado que declara DOS números no es duplicado', () => {
    /**
     * Si el cedazo contara apariciones en vez de encabezados, REG-179/REG-180
     * —que comparten ficha porque comparten causa— saldrían como colisión, y la
     * compuerta se volvería ruido que alguien acabaría desactivando.
     */
    const legitimo = '## REG-179 / REG-180 — dos caras de la misma causa'
    expect(numerosDadosDosVeces(legitimo)).toEqual([])
    expect(declaracionesPorEncabezado(legitimo)).toEqual([
      { titulo: 'REG-179 / REG-180 — dos caras de la misma causa', nums: [179, 180] },
    ])
  })

  it('una mención en prosa no es una declaración', () => {
    /* «Ver REG-436» aparece en el CSS, en el JSX y en tres fichas más. Repetir
       una referencia es lo normal; repetir una declaración es el defecto. */
    const conProsa = [
      '## REG-436 — el paso imposible de ejecutar',
      'Es la misma familia que REG-436 y se parece a REG-436.',
      'Ver REG-436 en `globals.css`.',
    ].join('\n')
    expect(numerosDadosDosVeces(conProsa)).toEqual([])
  })

  it('un encabezado de otro nivel no cuenta — `###` es una sección dentro de una ficha', () => {
    /* Las fichas usan `### Qué NO cubre`, `### La causa raíz`… Si el cedazo
       mirara cualquier `#`, una subsección que citara el número lo declararía. */
    const conSubseccion = ['## REG-437 — la lista de alergias', '### Y REG-437 otra vez, dentro'].join('\n')
    expect(numerosDadosDosVeces(conSubseccion)).toEqual([])
  })

  it('el cedazo es puro: deriva del texto que se le pasa, no del disco', () => {
    expect(declaracionesPorEncabezado('## REG-1 — x')).toEqual([{ titulo: 'REG-1 — x', nums: [1] }])
    expect(declaracionesPorEncabezado('')).toEqual([])
  })
})
