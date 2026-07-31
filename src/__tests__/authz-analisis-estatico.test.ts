import { describe, it, expect } from 'vitest'
import { analizarRuta, limpiarComentarios, GUARDIAS } from '@/lib/authz/analisis-estatico'

/**
 * El analizador estático, probado con fuentes SINTÉTICAS (unidad Nexus OS E0-07,
 * lote de cierre).
 *
 * POR QUÉ ESTE ARCHIVO EXISTE. `authz-rutas-declaradas.test.ts` apoya toda su
 * garantía en `analizarRuta`: si el analizador se rompe y devuelve listas vacías, el
 * guardián pasa por vacío y deja de proteger nada. Ese fue exactamente el modo de
 * falla que la verificación adversarial encontró en la primera versión de la unidad.
 * Aquí se fija su comportamiento sobre casos escritos a mano —incluidos los tres
 * casos reales del repo que lo complican— para que el guardián no pueda estar verde
 * por no encontrar nada.
 *
 * Los fragmentos NO son PHI ni datos reales: son `route.ts` inventados.
 */

describe('E0-07 · limpiarComentarios respeta las cadenas', () => {
  it('borra el comentario de línea pero NO el `//` de una URL', () => {
    const src = [
      "const u = 'https://ejemplo.mx/a'   // esto sí se va",
      "const v = 'segundo'",
    ].join('\n')
    const limpio = limpiarComentarios(src)
    expect(limpio).toContain("'https://ejemplo.mx/a'")
    expect(limpio).not.toContain('esto sí se va')
    // La segunda línea sobrevive: un `replace` ingenuo de `//…` se la habría comido
    // junto con el resto del archivo si hubiera quedado dentro de la cadena.
    expect(limpio).toContain("'segundo'")
  })

  it('borra comentarios de bloque sin pegar los tokens de los lados', () => {
    expect(limpiarComentarios('a/* x */b').replace(/\s+/g, ' ')).toBe('a b')
  })

  it('un comentario que CITA un guardián no cuenta como llamada', () => {
    // El repo comenta a propósito el nombre del guardián que se cambió; sin limpiar,
    // cada comentario sería un falso positivo.
    const src = [
      '// OJO: esta ruta va con verificarMedico(req, clinicId), no con verificarMiembro(req, clinicId).',
      '/* histórico: antes llamaba a verificarCapacidad(req, cid, \'firmar\') */',
      'export async function POST(req: NextRequest) {',
      "  const acc = await verificarUsuario(req)",
      '}',
    ].join('\n')
    const a = analizarRuta(src)
    expect(a.llamadas.map(l => l.guardia)).toEqual(['verificarUsuario'])
  })
})

describe('E0-07 · el argumento de capacidad se extrae de verdad', () => {
  it('lo saca aunque el clinicId venga con una expresión en medio (caso receta/verificacion-url)', () => {
    // Real: `verificarCapacidad(req, body.clinicId || '', 'firmar')`. Un split(',')
    // ingenuo se rompe con el `''` intermedio; el balance de paréntesis no.
    const src = [
      'export async function POST(req: NextRequest) {',
      "  const acc = await verificarCapacidad(req, body.clinicId || '', 'firmar')",
      '}',
    ].join('\n')
    const [ll] = analizarRuta(src).llamadas
    expect(ll.guardia).toBe('verificarCapacidad')
    expect(ll.argumentoNoLiteral).toBe(false)
    expect(ll.literales).toEqual(['', 'firmar'])
  })

  it('reordenar los argumentos legítimos no cambia lo que se observa (control negativo)', () => {
    const a = analizarRuta("export async function POST(r) { verificarCapacidad(r, String(body.clinicId ?? ''), 'firmar') }")
    expect(a.llamadas[0].argumentoNoLiteral).toBe(false)
    expect(a.llamadas[0].literales).toContain('firmar')
  })

  it('aguanta paréntesis anidados y un `)` DENTRO de una cadena', () => {
    const src = "export async function POST(r) { verificarCapacidad(r, resolver(a, (b)), 'administrar') }"
    const [ll] = analizarRuta(src).llamadas
    expect(ll.argumentoNoLiteral).toBe(false)
    expect(ll.literales).toEqual(['administrar'])

    const conParen = "export async function POST(r) { verificarCapacidad(r, ')raro(', 'cobrar') }"
    const [ll2] = analizarRuta(conParen).llamadas
    expect(ll2.literales).toEqual([')raro(', 'cobrar'])
    expect(ll2.argumentoNoLiteral).toBe(false)
  })

  it('el módulo del entitlement también se ve', () => {
    const a = analizarRuta("export async function POST(r) { verificarModuloIA(r, 'expediente') }")
    expect(a.llamadas[0].literales).toEqual(['expediente'])
    expect(a.llamadas[0].argumentoNoLiteral).toBe(false)
    const b = analizarRuta("export async function POST(r) { verificarModuloYCapacidad(r, 'uci', 'clinico.escribir') }")
    expect(b.llamadas[0].literales).toEqual(['uci', 'clinico.escribir'])
    expect(b.llamadas[0].argumentoNoLiteral).toBe(false)
  })
})

describe('E0-07 · una capacidad que no es literal se REPORTA, no se adivina', () => {
  it('plantilla literal → argumentoNoLiteral', () => {
    const a = analizarRuta('export async function POST(r) { verificarCapacidad(r, cid, `${pre}.escribir`) }')
    expect(a.llamadas[0].argumentoNoLiteral).toBe(true)
  })

  it('ternario → argumentoNoLiteral', () => {
    const a = analizarRuta("export async function POST(r) { verificarCapacidad(r, cid, esAdmin ? 'administrar' : 'cobrar') }")
    expect(a.llamadas[0].argumentoNoLiteral).toBe(true)
    // Los dos literales SÍ se ven: el test de rutas necesita el dato para explicar
    // el rojo, pero no puede elegir uno por su cuenta.
    expect(a.llamadas[0].literales).toEqual(['administrar', 'cobrar'])
  })

  it('variable → argumentoNoLiteral', () => {
    const a = analizarRuta('export async function POST(r) { verificarCapacidad(r, cid, capacidad) }')
    expect(a.llamadas[0].argumentoNoLiteral).toBe(true)
    expect(a.llamadas[0].literales).toEqual([])
  })

  it('el caso dinámico LEGÍTIMO de hospital/mutar se distingue por el dato, no por una regex del test', () => {
    // `exigeCapacidad(acc, capacidad)` TIENE que ser dinámico: la capacidad sale del
    // mapa ACCIONES_HOSPITAL_MUTAR que vive en el registro. La exención del guardián
    // se apoya en esta forma exacta: guardia `exigeCapacidad`, cero literales.
    const src = [
      'export async function POST(req: NextRequest) {',
      '  const acc = await verificarMiembro(req, clinicId)',
      '  const denegado = exigeCapacidad(acc, capacidad)',
      '}',
    ].join('\n')
    const a = analizarRuta(src)
    const ex = a.llamadas.find(l => l.guardia === 'exigeCapacidad')!
    expect(ex.argumentoNoLiteral).toBe(true)
    expect(ex.literales).toEqual([])
    // Y el guardián de membresía del mismo archivo NO se marca: no recibe capacidad,
    // así que no puede mentir sobre cuál exige.
    expect(a.llamadas.find(l => l.guardia === 'verificarMiembro')!.argumentoNoLiteral).toBe(false)
  })

  it('los guardianes sin vocabulario nunca se marcan', () => {
    const sinVocab = ['verificarUsuario', 'verificarMiembro', 'verificarMedico', 'verificarSuperadmin', 'verificarTokenPaciente']
    for (const g of sinVocab) {
      const a = analizarRuta(`export async function POST(r) { ${g}(r, algo) }`)
      expect(a.llamadas[0].guardia, g).toBe(g)
      expect(a.llamadas[0].argumentoNoLiteral, g).toBe(false)
    }
  })
})

describe('E0-07 · atribución al handler HTTP (esto es lo que cierra el hueco por método)', () => {
  it('el GET viejo y el POST migrado quedan separados (caso clinic/ai-keys)', () => {
    const src = [
      'export async function GET(req: NextRequest) {',
      '  const acceso = await verificarMiembro(req, clinicId)',
      '  return NextResponse.json({ ok: true })',
      '}',
      '',
      'export async function POST(req: NextRequest) {',
      "  const acceso = await verificarCapacidad(req, clinicId, 'administrar')",
      '  return NextResponse.json({ ok: true })',
      '}',
    ].join('\n')
    const a = analizarRuta(src)
    expect(a.metodosExportados).toEqual(['GET', 'POST'])
    expect(a.porMetodo.GET?.map(l => l.guardia)).toEqual(['verificarMiembro'])
    expect(a.porMetodo.POST?.map(l => l.guardia)).toEqual(['verificarCapacidad'])
    expect(a.porMetodo.POST?.[0].literales).toContain('administrar')
    expect(a.compartidas).toEqual([])
  })

  it('degradar el POST a any-member se ve EN SU SEGMENTO (el sabotaje P1-3)', () => {
    const saboteado = [
      'export async function GET(req: NextRequest) {',
      '  const acceso = await verificarMiembro(req, clinicId)',
      '}',
      'export async function POST(req: NextRequest) {',
      '  const acceso = await verificarMiembro(req, clinicId)',
      '}',
    ].join('\n')
    const a = analizarRuta(saboteado)
    expect(a.porMetodo.POST?.some(l => l.guardia === 'verificarCapacidad')).toBeFalsy()
    expect(a.porMetodo.POST?.map(l => l.guardia)).toEqual(['verificarMiembro'])
  })

  it('una llamada FUERA de todo handler va a `compartidas` (no se atribuye a ciegas)', () => {
    const src = [
      'async function ayudante(req: NextRequest) {',
      '  return verificarMiembro(req, clinicId)',
      '}',
      'export async function POST(req: NextRequest) {',
      '  const acc = await ayudante(req)',
      '}',
    ].join('\n')
    const a = analizarRuta(src)
    expect(a.compartidas.map(l => l.guardia)).toEqual(['verificarMiembro'])
    expect(a.porMetodo.POST ?? []).toEqual([])
  })

  it('un archivo con dos llamadas en el mismo handler las conserva en orden', () => {
    const src = [
      'export async function POST(req: NextRequest) {',
      '  const tk = verificarTokenPaciente(token)',
      '  const acc = await verificarMiembro(req, clinicId)',
      '}',
    ].join('\n')
    expect(analizarRuta(src).porMetodo.POST?.map(l => l.guardia))
      .toEqual(['verificarTokenPaciente', 'verificarMiembro'])
  })
})

describe('E0-07 · el analizador no inventa llamadas', () => {
  it('un identificador que CONTIENE el nombre del guardián no cuenta', () => {
    const src = [
      'export async function POST(req: NextRequest) {',
      '  const x = miverificarMiembro(req, cid)',
      '  const y = wrapper.verificarCapacidad(req, cid, "administrar")',
      '}',
    ].join('\n')
    expect(analizarRuta(src).llamadas).toEqual([])
  })

  it('un import sin llamada no cuenta', () => {
    const src = [
      "import { verificarCapacidad } from '@/lib/authz/verificar'",
      'export async function POST(req: NextRequest) { return null }',
    ].join('\n')
    expect(analizarRuta(src).llamadas).toEqual([])
  })

  it('el catálogo de guardianes está cerrado y sin duplicados', () => {
    expect(new Set(GUARDIAS).size).toBe(GUARDIAS.length)
    expect(GUARDIAS).toContain('verificarCapacidad')
    expect(GUARDIAS).toContain('exigeCapacidad')
  })
})
