/**
 * NINGÚN CAMINO PUEDE VOLVER A EMPAREJAR POR TELÉFONO A SOLAS.
 *
 * ── EL FALLO, EN UNA FRASE ───────────────────────────────────────────────────
 *
 * Cuatro caminos distintos decidían a qué expediente pertenece una cita, y tres
 * lo hacían buscando por TELÉFONO y quedándose con el primero. En México el
 * celular es de la casa: la reserva de un hijo aterrizaba en el expediente de
 * quien se hubiera registrado antes con ese número — y con ella la nota, el
 * diagnóstico y la receta que se escribieran después.
 *
 * No es un expediente partido, que se arregla. Es información clínica en la
 * persona equivocada, y no se ve como un error: se ve como un paciente que vino
 * a consulta.
 *
 * ── POR QUÉ UNA PRUEBA QUE LEE EL CÓDIGO ─────────────────────────────────────
 *
 * Es exactamente el fallo que vuelve: alguien añade un cuarto camino —un portal
 * nuevo, otro bot— y «buscar el paciente por su teléfono» es lo primero que se
 * le ocurre a cualquiera. Es la solución obvia, y es la equivocada.
 *
 * Esta prueba recorre los archivos que deciden y falla si alguno vuelve a
 * emparejar sin pasar por el motor, que exige parecido de NOMBRE.
 *
 * ── Y POR QUÉ ESA PRUEBA NO PROTEGÍA — REG-518 ──────────────────────────────
 *
 * El test-the-test del 5-sep-2026 aplicó el mutante obvio a los tres caminos:
 * sustituir la llamada al motor por `candidatos[0]`, dejando el `import` y los
 * comentarios. **Los tres siguieron en verde.** La aserción era
 * `toMatch(/elegirExpedienteParaCita/)` sobre la fuente CON comentarios, y el
 * mostrador menciona el símbolo cuatro veces —tres en comentarios que explican
 * por qué existe— y lo llama una. Un guardián del cero #1 del charter
 * («paciente equivocado») que se satisface con un comentario: familia de
 * REG-506, y el peor sitio posible para tenerla.
 *
 * La segunda aserción tenía el mismo hueco por otro lado: una ventana de 80
 * caracteres entre `where('telefono'…)` y `limit(1)` se salta con un comentario
 * largo en medio.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * 1. Se mira el código SIN comentarios (`limpiarComentarios`, que respeta las
 *    cadenas), y se exige la LLAMADA, no la mención.
 * 2. Se exige que lo que decide el id sea EL RESULTADO del motor: el valor que
 *    devuelve es el que se asigna. Una llamada cuyo resultado se tira y un
 *    `candidatos[0]` al lado ya no pasan.
 * 3. Ningún camino toma `[0]` de una lista de candidatos, salvo el ÚNICO caso
 *    declarado: el bot sin nombre utilizable (`nombreUtil.length < 4`), que el
 *    código razona y que aquí se cuenta —exactamente uno, y guardado.
 * 4. AUTOTEST: los dos mutantes del auditor se aplican a la fuente real en
 *    memoria y el detector tiene que ponerse rojo con cada uno. Un guardián
 *    que no se prueba contra su propio defecto es cartón (patrón de
 *    `clinical-safety-gate`).
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 *
 * - Sigue siendo de fuente: no ejecuta el mostrador ni el bot con dos
 *   homónimos que comparten teléfono. El motor sí está probado con esos casos
 *   (`pacientes-duplicados.test.ts`); esto vigila que los caminos lo USEN.
 * - Un cuarto camino que empareje por teléfono y no esté en `CAMINOS` no se
 *   vería. El barrido de abajo lo mitiga: cualquier archivo de `src/app` que
 *   consulte `patients` por teléfono tiene que estar en la lista.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { limpiarComentarios } from '@/lib/authz/analisis-estatico'

const leer = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8')

/** Los caminos por los que una cita puede acabar colgada de un expediente. */
const CAMINOS = [
  'src/app/(dashboard)/asistente/page.tsx',      // el mostrador
  'src/app/api/public/booking/route.ts',         // el paciente reservando solo
  'src/app/api/whatsapp/webhook/route.ts',       // el bot
] as const

type Camino = (typeof CAMINOS)[number]

/**
 * Lo que cada camino tiene que hacer con el RESULTADO del motor. Es la forma de
 * exigir que el motor decida, no sólo que se le llame.
 */
const DECIDE_CON_EL_RESULTADO: Record<Camino, RegExp[]> = {
  'src/app/(dashboard)/asistente/page.tsx': [
    /const existente = elegirExpedienteParaCita\(/,
    /pacienteId = existente\.id/,
  ],
  'src/app/api/public/booking/route.ts': [
    /const elegido = elegirExpedienteParaCita\(/,
    /pacienteId = elegido\.id/,
  ],
  'src/app/api/whatsapp/webhook/route.ts': [
    /const elegido = elegirExpedienteParaCita\(/,
    /if \(elegido\) return elegido\.id/,
  ],
}

/** El único `[0]` sobre candidatos que está permitido, y sólo en el bot. */
const FALLBACK_DECLARADO = /if \(nombreUtil\.length < 4\) return candidatosPac\[0\]\.id/

/**
 * Las listas de EXPEDIENTES candidatos de cada camino. Por nombre y por camino a
 * propósito: el bot tiene otro `candidatos[0]` que es un TELÉFONO normalizado,
 * no un paciente, y un patrón genérico lo acusaría en falso.
 */
const LISTAS_DE_CANDIDATOS: Record<Camino, RegExp> = {
  'src/app/(dashboard)/asistente/page.tsx': /\bpacientes\[0\]/g,
  'src/app/api/public/booking/route.ts': /\b(?:candidatos|pacientesSnap\.docs)\[0\]/g,
  'src/app/api/whatsapp/webhook/route.ts': /\b(?:candidatosPac|snap\.docs)\[0\]/g,
}

/** Qué está mal en ESTE código (ya sin comentarios). Vacío = pasa. */
export function defectosDe(camino: Camino, codigo: string): string[] {
  const d: string[] = []
  if (!/\belegirExpedienteParaCita\s*\(/.test(codigo)) {
    d.push('no LLAMA a elegirExpedienteParaCita (mencionarlo en un comentario no cuenta)')
  }
  for (const re of DECIDE_CON_EL_RESULTADO[camino]) {
    if (!re.test(codigo)) d.push(`no decide con el resultado del motor: falta ${re.source}`)
  }
  // Ningún «el primero de la lista» sobre candidatos o documentos.
  const primeros = codigo.match(LISTAS_DE_CANDIDATOS[camino]) ?? []
  const permitidos = camino === 'src/app/api/whatsapp/webhook/route.ts' && FALLBACK_DECLARADO.test(codigo) ? 1 : 0
  if (primeros.length > permitidos) {
    d.push(`se queda con «el primero»: ${primeros.join(', ')} (permitidos: ${permitidos})`)
  }
  // `limit(1)` sobre una consulta por teléfono es la forma exacta del fallo.
  if (/where\(\s*['"]telefono['"][^;]*?limit\(1\)/.test(codigo)) {
    d.push('consulta por teléfono con limit(1): el índice elige por ti a qué paciente pertenece la cita')
  }
  return d
}

describe('a qué expediente se cuelga una cita', () => {
  for (const archivo of CAMINOS) {
    it(`${archivo.split('/').slice(-2).join('/')} decide con el motor, no con el teléfono — con los comentarios quitados`, () => {
      const defectos = defectosDe(archivo, limpiarComentarios(leer(archivo)))
      expect(defectos, `${archivo}: ${defectos.join(' · ')}`).toEqual([])
    })
  }

  it('el bot conserva su ÚNICO fallback declarado (sin nombre utilizable), y sólo ése', () => {
    const codigo = limpiarComentarios(leer('src/app/api/whatsapp/webhook/route.ts'))
    expect(codigo).toMatch(FALLBACK_DECLARADO)
    expect(codigo.match(/candidatosPac\[0\]/g)).toHaveLength(1)
  })
})

describe('AUTOTEST · el guardián se pone rojo con los mutantes que antes pasaban (REG-518)', () => {
  const MUTANTES: Record<Camino, [RegExp, string]> = {
    // El del auditor: se sustituye la llamada por «el primero», y se deja todo lo demás.
    'src/app/(dashboard)/asistente/page.tsx': [
      /const existente = elegirExpedienteParaCita\([\s\S]*?\n\s*\)/,
      'const existente = pacientes[0]',
    ],
    'src/app/api/public/booking/route.ts': [
      /const elegido = elegirExpedienteParaCita\([^\n]*\)/,
      'const elegido = candidatos[0]',
    ],
    'src/app/api/whatsapp/webhook/route.ts': [
      /const elegido = elegirExpedienteParaCita\([^\n]*\)/,
      'const elegido = candidatosPac[0]',
    ],
  }

  for (const archivo of CAMINOS) {
    it(`${archivo.split('/').slice(-2).join('/')} · mutante «el primero» con el import y los comentarios intactos → ROJO`, () => {
      const fuente = leer(archivo)
      const [re, sustituto] = MUTANTES[archivo]
      expect(fuente, 'el mutante tiene que aplicarse a la llamada real, o el autotest no prueba nada').toMatch(re)
      const mutado = fuente.replace(re, sustituto)
      expect(mutado).not.toBe(fuente)
      // El símbolo sigue mencionado: en el import y en los comentarios. Antes bastaba.
      expect(mutado).toMatch(/elegirExpedienteParaCita/)
      expect(defectosDe(archivo, limpiarComentarios(mutado))).not.toEqual([])
    })
  }

  it('mutante «un comentario largo entre where(telefono) y limit(1)» → ROJO', () => {
    const relleno = '/* ' + 'x'.repeat(200) + ' */'
    const codigo = limpiarComentarios(`const s = await ref.where('telefono', '==', tel)${relleno}.limit(1).get()`)
    expect(defectosDe('src/app/api/public/booking/route.ts', codigo).some(d => d.includes('limit(1)'))).toBe(true)
  })

  it('y el código real, tal cual, pasa (el autotest no es un guardián que grita en falso)', () => {
    for (const archivo of CAMINOS) {
      expect(defectosDe(archivo, limpiarComentarios(leer(archivo)))).toEqual([])
    }
  })
})

describe('ningún cuarto camino consulta pacientes por teléfono fuera de la lista', () => {
  function archivos(dir: string, acc: string[] = []): string[] {
    for (const n of readdirSync(dir)) {
      const p = join(dir, n)
      if (statSync(p).isDirectory()) archivos(p, acc)
      else if (/\.tsx?$/.test(n)) acc.push(p)
    }
    return acc
  }

  it('todo archivo de src/app que filtre `patients` por teléfono está en CAMINOS', () => {
    const raiz = resolve(process.cwd(), 'src/app')
    const consultan = archivos(raiz)
      .filter(p => {
        const c = limpiarComentarios(readFileSync(p, 'utf8'))
        return /collection\(['"]patients['"]\)[\s\S]{0,200}?where\(\s*['"](?:telefono|whatsapp)['"]/.test(c)
      })
      .map(p => p.slice(p.indexOf('src/app')))
      .sort()
    // Si aparece uno nuevo, se añade a CAMINOS con sus expectativas — o se
    // demuestra que no cuelga citas de expedientes.
    const fueraDeLaLista = consultan.filter(p => !(CAMINOS as readonly string[]).includes(p))
    expect(fueraDeLaLista, 'emparejan por teléfono sin que este guardián los vigile').toEqual([])
    expect(consultan.length, 'el barrido no encontró ninguno: el guardián estaría vacuo').toBeGreaterThanOrEqual(2)
  })
})
