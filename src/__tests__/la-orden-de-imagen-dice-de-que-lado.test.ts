/**
 * GOLDEN — una orden de imagen dice qué región, de qué lado, y queda en el
 * expediente.
 *
 * Cuatro hallazgos del Panel de Lujo (sep-2026):
 *
 *   · MO-003 (M-ortopedia, CONFIRMADO, P2) — la orden de imagen era texto libre:
 *     se podía imprimir y firmar «Radiografía de extremidades», sin región, sin
 *     lado y sin proyección, con folio y cédula.
 *   · PO-015 (P-ortopedia, CONFIRMADO, P2) — la cara del paciente del mismo
 *     defecto: el portal responde la línea literal de la orden con sello de
 *     procedencia, así que le presta autoridad a una orden incompleta.
 *   · MO-012 (M-ortopedia, CONFIRMADO, P3) — el catálogo imprimía sus propias
 *     opciones: «Radiografía de columna (cervical / dorsal / lumbar)» salía
 *     literal, con las tres barras.
 *   · MO-005 (M-ortopedia, CONFIRMADO, P2) — lo elegido no se guardaba en
 *     ninguna parte: al reabrir /orden la lista salía vacía, el expediente no
 *     decía qué se pidió y dos órdenes distintas compartían folio.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 * Recorrido de una consulta de esguince de siete minutos. El equipo rojo
 * verificó que `ordenVacia` (page.tsx:557) era la ÚNICA compuerta de impresión,
 * que hay TRES entradas del catálogo con lista de opciones dentro del nombre —no
 * una— y que el propio código confiesa el defecto de MO-005 en un comentario:
 * «el médico elige los estudios AQUÍ, imprime, y la nota se queda vacía».
 *
 * ── CAUSA RAÍZ ───────────────────────────────────────────────────────────────
 * No había modelo de estudio de imagen: una cadena de texto hace de región, lado
 * y proyección a la vez, así que nada podía comprobarse. Y la pantalla se
 * construyó como generador de papel, no como emisor de una orden clínica.
 *
 * ── REGLA ────────────────────────────────────────────────────────────────────
 * clinical-safety §6 — ante una ambigüedad crítica (la lateralidad lo es: un
 * lado equivocado es radiación, costo y, en cirugía, un evento centinela) la
 * interfaz PREGUNTA. Aquí además bloquea, porque el dato falta y se sabe que
 * falta. «Bilateral» es una respuesta válida y está a un clic.
 * E invariante: UN MODELO DE ORDEN · UNA LÍNEA DE TIEMPO.
 *
 * ── TIPO DE PRUEBA ───────────────────────────────────────────────────────────
 * COMPORTAMIENTO sobre `orden-estudio-imagen.ts` (puro) y CONTRATO TEXTUAL
 * declarado sobre la pantalla, que es un componente cliente con Firestore y no
 * se monta en node. Probada al revés: un estudio que YA dice el lado no se
 * marca, y una región impar (tórax, abdomen, cráneo) no se bloquea nunca.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 * No fija qué proyecciones corresponden a cada región: lo decide un radiólogo,
 * NEEDS_CLINICAL_REVIEW, y por eso su ausencia no bloquea. La lista de regiones
 * pares es VOCABULARIO, no criterio: que falte una significa que ese caso no se
 * vigila (regla 5). No comprueba que la adenda quede ESCRITA en Firestore (eso
 * exige el emulador). No cubre órdenes de hospital/UCI (D-030) ni el
 * `estudiosOrden` que la extracción del dictado debería poblar (MO-004, otra
 * rebanada).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import {
  admiteLateralidad, lateralidadDe, faltaLateralidad, estudiosSinLateralidad,
  conLateralidad, componerEstudioImagen, textoDelLado,
} from '@/lib/orden-estudio-imagen'
import { textoDeLaOrdenEmitida, motivoDeLaOrdenEmitida } from '@/lib/orden-emitida'

const raiz = process.cwd()
const pagina = readFileSync(
  path.join(raiz, 'src', 'app', '(dashboard)', 'orden', '[patientId]', '[notaId]', 'page.tsx'), 'utf8')

describe('MO-003 · PO-015 — la lateralidad de una región par', () => {
  it('las regiones pares se reconocen', () => {
    for (const e of ['Radiografía de tobillo', 'Radiografía de rodilla', 'RM de hombro',
      'Ultrasonido Doppler venoso de miembros', 'Mastografía']) {
      expect(admiteLateralidad(e), e).toBe(true)
    }
  })

  it('las impares no piden lado: no se bloquea lo que no lo necesita', () => {
    for (const e of ['Radiografía de tórax (PA y lateral)', 'Radiografía de abdomen (simple y de pie)',
      'TC de cráneo simple', 'Ultrasonido abdominal completo', 'Radiografía de columna lumbar']) {
      expect(faltaLateralidad(e), e).toBe(false)
    }
  })

  it('el lado ya escrito se lee, incluido «bilateral»', () => {
    expect(lateralidadDe('Radiografía de tobillo izquierdo')).toBe('izquierdo')
    expect(lateralidadDe('Radiografía de rodilla derecha')).toBe('derecho')
    expect(lateralidadDe('Mastografía bilateral')).toBe('bilateral')
    expect(lateralidadDe('Radiografía de tobillo')).toBeNull()
  })

  it('al revés: un estudio que ya dice el lado NO se marca como incompleto', () => {
    expect(faltaLateralidad('Radiografía de tobillo izquierdo')).toBe(false)
    expect(estudiosSinLateralidad([
      'Radiografía de tobillo izquierdo', 'Radiografía de tórax (PA y lateral)',
    ])).toEqual([])
  })

  it('la orden incompleta se nombra: qué estudio y en qué orden', () => {
    expect(estudiosSinLateralidad([
      'Radiografía de tórax (PA y lateral)', 'Radiografía de rodilla', 'Radiografía de mano',
    ])).toEqual(['Radiografía de rodilla', 'Radiografía de mano'])
  })

  it('añadir el lado escribe el texto que se imprime, y corregirlo no lo duplica', () => {
    expect(conLateralidad('Radiografía de tobillo', 'izquierdo')).toBe('Radiografía de tobillo izquierdo')
    expect(conLateralidad('Radiografía de tobillo izquierdo', 'derecho')).toBe('Radiografía de tobillo derecho')
    expect(conLateralidad('Mastografía', 'bilateral')).toBe('Mastografía bilateral')
  })

  it('concuerda el género donde el papel lo nota', () => {
    expect(textoDelLado('Radiografía de rodilla', 'izquierdo')).toBe('izquierda')
    expect(textoDelLado('Radiografía de tobillo', 'izquierdo')).toBe('izquierdo')
  })

  it('el estudio estructurado se PINTA como el texto de siempre', () => {
    expect(componerEstudioImagen({ base: 'Radiografía de tobillo', lado: 'izquierdo', proyecciones: 'AP y lateral' }))
      .toBe('Radiografía de tobillo izquierdo — AP y lateral')
    expect(componerEstudioImagen({ base: 'Radiografía de tórax' })).toBe('Radiografía de tórax')
  })

  it('la pantalla no deja EMITIR con un lado pendiente', () => {
    expect(pagina).toContain('estudiosSinLateralidad(estudios)')
    expect(pagina).toContain('const noSePuedeEmitir = ordenVacia || ordenIncompleta')
    // Los tres caminos que producen papel usan la misma compuerta.
    expect((pagina.match(/noSePuedeEmitir/g) ?? []).length).toBeGreaterThanOrEqual(4)
  })
})

describe('MO-012 · el catálogo de imagen no imprime sus propias opciones', () => {
  const CATEGORIAS_IMAGEN = /'Imagen — [^']*': \[([\s\S]*?)\]/g

  it('ninguna entrada de imagen lleva una lista de opciones separada por «/»', () => {
    const malas: string[] = []
    for (const bloque of pagina.matchAll(CATEGORIAS_IMAGEN)) {
      for (const m of bloque[1].matchAll(/'([^']+)'/g)) {
        // «(PA y lateral)» y «(simple y de pie)» describen UN estudio; lo que no
        // puede haber es una alternativa que el gabinete tenga que resolver.
        if (m[1].includes('/')) malas.push(m[1])
      }
    }
    expect(malas, `entradas con opciones dentro: ${malas.join(' · ')}`).toEqual([])
  })

  it('«Radiografía de extremidades» ya no existe: se pide la región concreta', () => {
    expect(pagina).not.toContain("'Radiografía de extremidades'")
    expect(pagina).toContain("'Radiografía de tobillo'")
    expect(pagina).toContain("'Radiografía de columna lumbar'")
  })
})

describe('MO-005 · la orden emitida queda asentada', () => {
  it('el texto que se asienta lleva folio, cómo se entregó y qué se pidió', () => {
    const t = textoDeLaOrdenEmitida({
      folio: 'OM-ABC1234',
      estudios: ['Radiografía de tobillo izquierdo', 'Biometría hemática completa'],
      diagnostico: 'Esguince sintético',
      formato: 'impresa',
    })
    expect(t).toContain('OM-ABC1234')
    expect(t).toContain('impresa')
    expect(t).toContain('· Radiografía de tobillo izquierdo')
    expect(t).toContain('Diagnóstico de sospecha: Esguince sintético')
  })

  it('el motivo de la adenda cuenta los estudios y concuerda en singular', () => {
    expect(motivoDeLaOrdenEmitida('OM-1', 1)).toBe('Orden de estudios emitida (OM-1) — 1 estudio')
    expect(motivoDeLaOrdenEmitida('OM-1', 3)).toBe('Orden de estudios emitida (OM-1) — 3 estudios')
  })

  it('la pantalla escribe en el expediente al emitir, no sólo imprime', () => {
    expect(pagina).toContain('agregarAdenda(')
    expect(pagina).toContain("asentarOrden('impresa')")
    expect(pagina).toContain("asentarOrden('pdf')")
    expect(pagina).toContain("asentarOrden('word')")
  })

  it('y sólo cuando la orden salió de verdad (ZL-002)', () => {
    expect(pagina).toContain("resultado === 'abierta'")
  })
})
