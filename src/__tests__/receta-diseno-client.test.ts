/**
 * R-06 / issue #350 — el lado CLIENTE del circuito: la papelería sigue saliendo
 * cuando el proxy deja de aceptar un `?path=` pelado.
 *
 * QUÉ FALLABA: cerrar `/api/receta/diseno` sin más deja las `<img>` del membrete,
 * la firma y el sello en 403 — la receta se imprime en blanco. El acuñado del
 * cliente es lo que impide que un arreglo de seguridad se convierta en un
 * defecto clínico. Y su predicado antiguo era «¿el src trae `sig=`?», que con el
 * TTL de 24 h casi nunca mentía; con el TTL de 15 minutos de esta unidad da por
 * buena para siempre una capacidad ya VENCIDA, así que la pantalla abierta un
 * rato imprime sin membrete y nadie ve un error.
 *
 * CÓMO SE DESCUBRIÓ: al revisar el checkpoint de este lane contra el criterio
 * «valid prescription design rendering remains compatible through the mint flow»
 * del contrato: el servidor estaba probado por los dos lados y el cliente —el
 * único punto donde el dato tiene que LLEGAR a la hoja impresa— no tenía prueba.
 *
 * CAUSA RAÍZ: confundir «la URL tiene forma de capacidad» con «la capacidad sirve
 * ahora».
 *
 * REGLA QUE LO HACE SEGURO: se re-acuña cuando NO hay capacidad y también cuando
 * la que hay está a menos del margen de su caducidad; y el acuñado es a prueba de
 * fallos — si el endpoint falla, tarda o no hay sesión, la `<img>` se queda como
 * estaba y el resto del documento sale igual.
 *
 * QUÉ NO CUBRE: no renderiza React ni html2canvas (no hay jsdom en esta suite: se
 * usan dobles de `HTMLImageElement`), no prueba la autorización del servidor —eso
 * vive en `receta-diseno-ruta.test.ts` y `receta-diseno-token.test.ts`—, no toca
 * el membrete embebido en el `.doc` de Word (residual declarado en el contrato) ni
 * el espacio de fotos clínicas (R-05 / #353). Datos 100 % ficticios.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/** Doble de la frontera autenticada: aquí no hay Firebase ni navegador. */
const fetchAutenticado = vi.fn()
vi.mock('@/lib/auth-client', () => ({
  fetchAutenticado: (...a: unknown[]) => fetchAutenticado(...a),
}))

import { firmarImagenesDiseno } from '@/lib/receta-diseno-client'
import { acunarCapacidadDiseno, urlDeCapacidad, DISENO_TOKEN_TTL_S } from '@/lib/receta-diseno-token'

const ORIGEN = 'https://app.ejemplo.mx'
const OWNER = 'uidAAAAAAAAAAAAAAAAAAAAAAAAA'
const PATH = `receta-diseno/${OWNER}/membrete.png`
const AHORA = 1_800_000_000_000 // epoch ms fijo (determinista)

const env = process.env as Record<string, string | undefined>
let secretoPrevio: string | undefined

/**
 * URL del proxy CON capacidad, acuñada como la acuñaría el servidor pero fechada
 * a `desdeMs`. Se usa el acuñador de verdad para que el cliente y el servidor no
 * puedan divergir en la forma de la URL sin que esta prueba se entere.
 */
const conCapacidad = (desdeMs: number): string =>
  ORIGEN + urlDeCapacidad(acunarCapacidadDiseno({
    path: PATH, ownerUid: OWNER, clinicId: 'clinicA', ahoraMs: desdeMs,
  })!)

const SIN_CAPACIDAD = `${ORIGEN}/api/receta/diseno?path=${encodeURIComponent(PATH)}`
const LEGADA_U = `${ORIGEN}/api/receta/diseno?u=${encodeURIComponent(
  `https://firebasestorage.googleapis.com/v0/b/bucket/o/${encodeURIComponent(PATH)}?alt=media`,
)}`
const RECIEN_ACUNADA = `/api/receta/diseno?path=${encodeURIComponent(PATH)}&v=v2&own=${OWNER}&cid=clinicA&exp=99999&sig=${'a'.repeat(64)}`

/** Doble de `<img>`: `complete: true` para que la espera de recarga no use temporizadores. */
const img = (src: string) => ({ src, complete: true }) as unknown as HTMLImageElement

/** Respuesta del acuñador con el mapa path → URL. */
const responde = (urls: Record<string, string>, ok = true, status = 200) =>
  fetchAutenticado.mockResolvedValue({ ok, status, json: async () => ({ ok, urls }) })

beforeEach(() => {
  secretoPrevio = env.RECETA_DISENO_SECRET
  env.RECETA_DISENO_SECRET = 'secreto-de-prueba'
  vi.stubGlobal('window', { location: { origin: ORIGEN } })
  vi.spyOn(Date, 'now').mockReturnValue(AHORA)
  fetchAutenticado.mockReset()
})
afterEach(() => {
  if (secretoPrevio === undefined) delete env.RECETA_DISENO_SECRET
  else env.RECETA_DISENO_SECRET = secretoPrevio
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('firmarImagenesDiseno — la receta sigue saliendo con el proxy cerrado', () => {
  it('una imagen SIN capacidad se re-acuña y queda apuntando a la URL ligada', async () => {
    responde({ [PATH]: RECIEN_ACUNADA })
    const i = img(SIN_CAPACIDAD)
    expect(await firmarImagenesDiseno([i])).toBe(1)
    expect(i.src).toBe(RECIEN_ACUNADA)

    // Y el path que se pidió acuñar es el del bucket, no la URL de la pantalla.
    const body = JSON.parse((fetchAutenticado.mock.calls[0][1] as RequestInit).body as string)
    expect(body.paths).toEqual([PATH])
  })

  it('REGRESIÓN: una capacidad A PUNTO DE VENCER se re-acuña (el predicado viejo la daba por buena)', async () => {
    // Acuñada hace 14 min con TTL de 15: le quedan 60 s, menos del margen.
    const casiVencida = conCapacidad(AHORA - (DISENO_TOKEN_TTL_S - 60) * 1000)
    expect(casiVencida).toContain('sig=')          // el predicado antiguo diría «ya está firmada»
    responde({ [PATH]: RECIEN_ACUNADA })
    const i = img(casiVencida)
    expect(await firmarImagenesDiseno([i])).toBe(1)
    expect(i.src).toBe(RECIEN_ACUNADA)
  })

  it('una capacidad VENCIDA se re-acuña', async () => {
    responde({ [PATH]: RECIEN_ACUNADA })
    const i = img(conCapacidad(AHORA - (DISENO_TOKEN_TTL_S + 60) * 1000))
    expect(await firmarImagenesDiseno([i])).toBe(1)
    expect(i.src).toBe(RECIEN_ACUNADA)
  })

  it('una capacidad FRESCA no se re-acuña: ni una llamada de más al servidor', async () => {
    const fresca = conCapacidad(AHORA)
    const i = img(fresca)
    expect(await firmarImagenesDiseno([i])).toBe(0)
    expect(i.src).toBe(fresca)
    expect(fetchAutenticado).not.toHaveBeenCalled()
  })

  it('la forma LEGADA `?u=` se traduce al path del bucket, que sí es acuñable', async () => {
    responde({ [PATH]: RECIEN_ACUNADA })
    const i = img(LEGADA_U)
    expect(await firmarImagenesDiseno([i])).toBe(1)
    expect(i.src).toBe(RECIEN_ACUNADA)
    const body = JSON.parse((fetchAutenticado.mock.calls[0][1] as RequestInit).body as string)
    expect(body.paths).toEqual([PATH])
  })

  it('una imagen ajena al proxy no se toca ni provoca llamada', async () => {
    const i = img('https://cdn.ejemplo.mx/logo.png')
    expect(await firmarImagenesDiseno([i])).toBe(0)
    expect(i.src).toBe('https://cdn.ejemplo.mx/logo.png')
    expect(fetchAutenticado).not.toHaveBeenCalled()
  })

  it('A PRUEBA DE FALLOS: si el acuñador revienta, la imagen se queda como estaba', async () => {
    fetchAutenticado.mockRejectedValue(new Error('red caída'))
    const i = img(SIN_CAPACIDAD)
    expect(await firmarImagenesDiseno([i])).toBe(0)
    expect(i.src).toBe(SIN_CAPACIDAD)
  })

  it('A PRUEBA DE FALLOS: sin sesión (401) no se inventa URL y el documento sale igual', async () => {
    responde({}, false, 401)
    const i = img(SIN_CAPACIDAD)
    expect(await firmarImagenesDiseno([i])).toBe(0)
    expect(i.src).toBe(SIN_CAPACIDAD)
  })

  it('si el servidor NIEGA el acuñado (cruce de clínica) la imagen se queda sin capacidad, no con una inventada', async () => {
    responde({})                                   // 200 con el path ausente: el servidor se negó
    const i = img(SIN_CAPACIDAD)
    expect(await firmarImagenesDiseno([i])).toBe(0)
    expect(i.src).toBe(SIN_CAPACIDAD)
  })

  it('una URL devuelta SIN firma se ignora: el cliente no acepta un pase pelado del servidor', async () => {
    responde({ [PATH]: `/api/receta/diseno?path=${encodeURIComponent(PATH)}` })
    const i = img(SIN_CAPACIDAD)
    expect(await firmarImagenesDiseno([i])).toBe(0)
    expect(i.src).toBe(SIN_CAPACIDAD)
  })

  it('varias imágenes del mismo path piden el acuñado UNA vez y todas quedan ligadas', async () => {
    responde({ [PATH]: RECIEN_ACUNADA })
    const a = img(SIN_CAPACIDAD)
    const b = img(SIN_CAPACIDAD)
    expect(await firmarImagenesDiseno([a, b])).toBe(2)
    expect(fetchAutenticado).toHaveBeenCalledTimes(1)
    const body = JSON.parse((fetchAutenticado.mock.calls[0][1] as RequestInit).body as string)
    expect(body.paths).toEqual([PATH])             // deduplicado
    expect([a.src, b.src]).toEqual([RECIEN_ACUNADA, RECIEN_ACUNADA])
  })

  it('sin ninguna imagen del proxy no se llama al servidor', async () => {
    expect(await firmarImagenesDiseno([])).toBe(0)
    expect(fetchAutenticado).not.toHaveBeenCalled()
  })
})
