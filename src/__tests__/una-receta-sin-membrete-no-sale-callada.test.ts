/**
 * UNA RECETA SIN MEMBRETE NO SALE CALLADA
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * No es un defecto que existiera: es uno que el #355 IBA A CREAR y se cerró en
 * el mismo cambio.
 *
 * Hasta el #355, una `<img>` de papelería con la URL pelada
 * (`/api/receta/diseno?path=…`, sin firma) la servía el proxy sin más. Al cerrar
 * R-06 el proxy pasa a fallar CERRADO, así que esa misma imagen deja de verse.
 *
 * El acuñado en el cliente la repone antes de imprimir… salvo cuando no puede:
 * sin sesión, con el endpoint caído, o pasados los 1 500 ms de tope. En esos
 * casos el documento salía IGUAL, sin membrete y sin firma, y sin decir nada.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Leyendo el propio comentario del módulo al revivir el PR: «si el endpoint
 * falla […] las imágenes se quedan con su URL original (que el proxy ya rechaza:
 * se verá rota, pero el resto del documento sale)». Estaba declarado como
 * comportamiento aceptado. Lo es para el CÓDIGO —el documento no se rompe— y no
 * lo es para el MÉDICO, que se entera cuando el paciente ya se fue con el papel.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * Nada cambia en silencio. Un documento que sale distinto de como el médico lo
 * ve en pantalla se avisa ANTES del último momento en que puede pararlo.
 *
 * Avisa, NO bloquea: una receta sin membrete sigue siendo válida —el contenido
 * legal es el texto y la cédula, no la papelería— así que la decisión es del
 * médico. Bloquear le quitaría una receta que sí puede entregar.
 *
 * ── QUÉ NO CUBRE, DECLARADO ──────────────────────────────────────────────────
 *
 *  · NO comprueba que el médico LEA el aviso. El canal es el toast de la app, y
 *    se auto-cierra a los 3,5 s — que es exactamente lo que REG-411 llama «un
 *    aviso efímero sobre una pérdida permanente es no avisar». Aquí la pérdida
 *    no es permanente (se vuelve a imprimir) y por eso no se escaló a modal,
 *    pero la limitación queda escrita y no descubierta dentro de seis meses.
 *  · NO cubre la VISTA PREVIA (`FirmadorDisenos`), que reacuña en cada mutación
 *    del DOM: avisar ahí sería avisar en bucle. La vista previa enseña la imagen
 *    rota, que en pantalla sí se ve.
 *  · NO impide que la capacidad caduque ENTRE el aviso y la impresión.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const fetchAutenticado = vi.fn()
vi.mock('@/lib/auth-client', () => ({ fetchAutenticado }))

const PATH = 'receta-diseno/uidAAAA/membrete.png'
const PELADA = `/api/receta/diseno?path=${encodeURIComponent(PATH)}`
const ACUNADA = `${PELADA}&v=v2&own=uidAAAA&cid=clinicA&exp=99999999999&sig=${'a'.repeat(64)}`

/** Una `<img>` de mentira: sólo lo que el módulo toca. */
const imagen = (src: string) => {
  const o: Record<string, unknown> = {
    src, complete: true,
    addEventListener: () => {}, removeEventListener: () => {},
  }
  return o as unknown as HTMLImageElement
}

const conRespuesta = (r: unknown) => { fetchAutenticado.mockResolvedValue(r) }
const ok = (urls: Record<string, string>) =>
  ({ ok: true, json: async () => ({ ok: true, urls }) })

beforeEach(() => {
  vi.resetModules()
  fetchAutenticado.mockReset()
  Object.defineProperty(globalThis, 'window', {
    value: { location: { origin: 'https://x.mx' } }, configurable: true, writable: true,
  })
})

const correr = async (img: HTMLImageElement) => {
  const avisos: number[] = []
  const { firmarImagenesDiseno } = await import('@/lib/receta-diseno-client')
  const n = await firmarImagenesDiseno([img], {
    esperarRecargaMs: 0,
    onIncompleto: (faltan) => avisos.push(faltan),
  })
  return { n, avisos }
}

describe('una receta sin membrete no sale callada', () => {
  it('el endpoint responde y la imagen se acuña: NO se avisa de nada', async () => {
    conRespuesta(ok({ [PATH]: ACUNADA }))
    const img = imagen(PELADA)
    const { n, avisos } = await correr(img)
    expect(n).toBe(1)
    expect(img.src).toBe(ACUNADA)
    expect(avisos, 'avisar cuando todo salió bien enseña a ignorar el aviso').toEqual([])
  })

  it.each([
    ['el endpoint devuelve error', { ok: false, json: async () => ({}) }],
    ['el endpoint no devuelve urls', { ok: true, json: async () => ({ ok: true }) }],
    ['la respuesta no es JSON', { ok: true, json: async () => { throw new Error('x') } }],
  ])('%s → el documento sale, y SE AVISA', async (_caso, res) => {
    conRespuesta(res)
    const img = imagen(PELADA)
    const { n, avisos } = await correr(img)
    expect(n).toBe(0)
    expect(img.src, 'el documento no se rompe: la imagen queda como estaba').toBe(PELADA)
    expect(avisos, 'ésta es la mitad que faltaba: salir incompleto SIN decirlo').toEqual([1])
  })

  it('el endpoint lanza: se avisa igual, no se traga la excepción', async () => {
    fetchAutenticado.mockRejectedValue(new Error('red caída'))
    const img = imagen(PELADA)
    const { n, avisos } = await correr(img)
    expect(n).toBe(0)
    expect(avisos).toEqual([1])
  })

  it('ACUÑADO PARCIAL: vuelve el membrete y no la firma → se avisa por la que falta', async () => {
    /**
     * El caso que un `try/catch` no ve. El servidor comprueba el consultorio
     * POR PATH, así que puede devolver la capacidad de una imagen y no la de
     * otra. Un documento al que le falta la FIRMA no es un documento al que no
     * le falta nada.
     */
    const OTRO = 'receta-diseno/uidAAAA/firma.png'
    const peladaOtro = `/api/receta/diseno?path=${encodeURIComponent(OTRO)}`
    conRespuesta(ok({ [PATH]: ACUNADA }))
    const avisos: number[] = []
    const { firmarImagenesDiseno } = await import('@/lib/receta-diseno-client')
    const a = imagen(PELADA)
    const b = imagen(peladaOtro)
    const n = await firmarImagenesDiseno([a, b], {
      esperarRecargaMs: 0,
      onIncompleto: (faltan) => avisos.push(faltan),
    })
    expect(n).toBe(1)
    expect(a.src).toBe(ACUNADA)
    expect(b.src, 'la que no volvió se queda como estaba').toBe(peladaOtro)
    expect(avisos).toEqual([1])
  })

  it('sin imágenes de papelería no se avisa ni se llama al servidor', async () => {
    const img = imagen('https://cdn.x.mx/logo-que-no-es-papeleria.png')
    const { n, avisos } = await correr(img)
    expect(n).toBe(0)
    expect(avisos).toEqual([])
    expect(fetchAutenticado).not.toHaveBeenCalled()
  })
})

describe('el aviso llega a los caminos que producen papel', () => {
  const leer = async (rel: string) =>
    (await import('node:fs')).readFileSync(
      (await import('node:path')).join(process.cwd(), rel), 'utf8')

  it('la impresión avisa ANTES de abrir el diálogo', async () => {
    /**
     * El orden importa: el diálogo de impresión es lo último que el médico
     * puede cancelar. Un aviso después es un aviso sobre un papel ya impreso.
     */
    const src = await leer('src/lib/print-element.ts')
    expect(src).toContain('onIncompleto:')
    /* Se ancla a la LLAMADA final, no al cierre del archivo: desde ZL-002
       `imprimirElemento` devuelve su resultado, así que después de
       `.finally(esperarImagenesEImprimir)` ya no está la llave de cierre. Lo
       que esta prueba congela es el ORDEN —avisar antes de disparar la
       impresión—, y eso no cambió. */
    expect(src.indexOf('onIncompleto:')).toBeLessThan(src.indexOf('.finally(esperarImagenesEImprimir)'))
    expect(src).toContain('onAvisoPapeleria')
    // Y si nadie pasó canal, cae a `alert` en vez de callarse.
    expect(src).toContain('window.alert(msg)')
  })

  it('el PDF avisa, y los tres documentos que lo generan pasan el canal', async () => {
    expect(await leer('src/lib/pdf-download.ts')).toContain('onIncompleto:')
    for (const p of [
      'src/app/(dashboard)/receta/[patientId]/[notaId]/page.tsx',
      'src/app/(dashboard)/orden/[patientId]/[notaId]/page.tsx',
      'src/app/(dashboard)/nota/[patientId]/[notaId]/page.tsx',
    ]) {
      expect(await leer(p), `${p} genera un PDF sin cablear el aviso`).toContain('onAvisoPapeleria')
    }
  })
})
