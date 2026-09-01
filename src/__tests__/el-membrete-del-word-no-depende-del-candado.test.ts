/**
 * GUARDIÁN — REG-507. El .doc de la receta guardaba un ENLACE al membrete, no el
 * membrete. Y ese enlace sólo funcionaba porque el candado estaba apagado.
 *
 * ── QUÉ FALLABA, Y CÓMO SE DESCUBRIÓ ────────────────────────────────────────
 *
 * Preparando el último pendiente del dueño —poner
 * `RECETA_DISENO_FIRMA=obligatoria`, que cierra una ruta que sirve papelería y
 * fotografía clínica sin comprobar sesión (R-06)— se fue a verificar el primer
 * paso del plan de dos pasos que el propio código describe: *«primero se acuñan
 * URLs firmadas en el camino de impresión y se PRUEBA la papelería real; sólo
 * entonces se pone el candado»*.
 *
 * Los caminos de pantalla **sí** estaban cubiertos: `print-element`,
 * `pdf-download` y el `FirmadorDisenos` montado en el layout del dashboard
 * reescriben las `<img>` a su versión firmada antes de imprimir.
 *
 * El del **Word no**, y no podía estarlo: `receta-word` no lee del DOM, lee
 * `recetaConfig.membreteDataUrl` —la URL guardada, sin firma— y la incrusta
 * ABSOLUTIZADA en el .doc. Word abre el archivo desde el disco y pide esa URL
 * **sin sesión y sin firma**. Hoy pasa porque la ruta acepta enlaces sin firmar;
 * con el candado puesto habría devuelto 403 y el membrete habría salido roto en
 * la receta impresa, con la cédula del médico al lado.
 *
 * Ningún guardián lo habría visto: el candado se activa con una variable de
 * entorno en Vercel, no con un cambio de código, así que el defecto habría
 * aparecido en la primera receta que alguien abriera en Word.
 *
 * ── POR QUÉ UN data URI Y NO UNA URL FIRMADA ────────────────────────────────
 *
 * Firmar habría bastado para no romperse el primer día, y habría roto el
 * trigésimo: una firma caduca a las 24 h (`DISENO_TOKEN_TTL_S`) y un .doc se
 * guarda, se reenvía y se reabre semanas después. Un membrete que desaparece
 * solo de un documento medicolegal, sin que nadie toque nada, es peor que uno
 * que nunca estuvo.
 *
 * Incrustado, el .doc deja de depender de la red, de la sesión, del candado y
 * del reloj. Y de paso deja de ser un consumidor del camino sin firma, que es
 * exactamente lo que el candado quiere quedarse sin.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No prueba que Word lo pinte bien.** Esto verifica el HTML que se genera;
 *   que el .doc se vea correcto en Word real es la comprobación en vivo que el
 *   plan de dos pasos exige del dueño ANTES de poner el candado.
 * · **Sólo cubre el membrete pequeño.** Con `disenoCompletoDataUrl` el Word usa
 *   el encabezado de texto limpio a propósito (Word no reproduce bien un diseño
 *   a página completa), así que ahí no hay imagen que incrustar.
 * · **No cubre las URLs `https://` legadas** de Storage guardadas en configs
 *   viejas: traerlas sería una petición cross-origin. Se quedan como estaban, y
 *   la rama `?u=` del proxy queda cerrada por el candado — declarado, no tapado.
 * · No mide el tamaño del .doc resultante. Un membrete grande engorda el archivo.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { resolverMembreteParaWord } from '@/lib/receta-word'

const PROXY = '/api/receta/diseno?path=receta-diseno%2Fuid123%2Fmembrete-1.png'
const PNG_1PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg=='

/** `fetch` + `FileReader` de mentira, porque esto corre fuera del navegador. */
function montarNavegador(opts: { ok?: boolean; tipo?: string; lanza?: boolean } = {}) {
  const { ok = true, tipo = 'image/png', lanza = false } = opts
  vi.stubGlobal('window', { location: { origin: 'https://ejemplo.test' } })
  vi.stubGlobal('fetch', vi.fn(async () => {
    if (lanza) throw new Error('red caída')
    return { ok, blob: async () => ({ type: tipo }) } as unknown as Response
  }))
  class FR {
    result: string | null = null
    onload: (() => void) | null = null
    onerror: (() => void) | null = null
    readAsDataURL(b: { type: string }) {
      this.result = b.type.startsWith('image/') ? PNG_1PX : 'data:text/html;base64,PHNjcmlwdD4='
      queueMicrotask(() => this.onload?.())
    }
  }
  vi.stubGlobal('FileReader', FR)
}

describe('REG-507 · el membrete del .doc viaja dentro, no como enlace', () => {
  beforeEach(() => { vi.unstubAllGlobals() })
  afterEach(() => { vi.unstubAllGlobals() })

  it('una URL del proxy se convierte en data URI', async () => {
    montarNavegador()
    expect(await resolverMembreteParaWord(PROXY)).toBe(PNG_1PX)
  })

  it('AL REVÉS: sin el arreglo, lo que viajaría es el enlace sin firma', () => {
    /**
     * El defecto, escrito. `receta-word` absolutizaba la URL guardada y la metía
     * en el .doc; Word la pedía sin sesión ni firma. Se comprueba que ESO es
     * justo lo que ya no se devuelve — si `resolverMembreteParaWord` volviera a
     * devolver la URL, el caso de arriba fallaría y éste explica por qué importa.
     */
    const comoViajabaAntes = new URL(PROXY, 'https://ejemplo.test').href
    expect(comoViajabaAntes).toContain('/api/receta/diseno')
    expect(comoViajabaAntes).not.toContain('sig=')   // nunca llevó firma
  })

  it('si el proxy contesta mal, el documento sale como salía (no se rompe)', async () => {
    montarNavegador({ ok: false })
    expect(await resolverMembreteParaWord(PROXY)).toBe(PROXY)
  })

  it('si la red falla o tarda, tampoco se rompe', async () => {
    montarNavegador({ lanza: true })
    expect(await resolverMembreteParaWord(PROXY)).toBe(PROXY)
  })

  it('lo que no es una imagen NO se incrusta', async () => {
    /**
     * Un data URI de `text/html` dentro del documento sería contenido activo
     * traído de una ruta que sirve lo que el médico subió. La misma razón por la
     * que `/api/config/imagen` rechaza los `<script>`.
     */
    montarNavegador({ tipo: 'text/html' })
    expect(await resolverMembreteParaWord(PROXY)).toBe(PROXY)
  })

  it('no toca lo que no es del proxy: data URIs y URLs ajenas se dejan igual', async () => {
    montarNavegador()
    expect(await resolverMembreteParaWord(PNG_1PX)).toBe(PNG_1PX)
    expect(await resolverMembreteParaWord('https://otro.example/m.png')).toBe('https://otro.example/m.png')
    expect(await resolverMembreteParaWord('')).toBe('')
  })

  it('fuera del navegador devuelve la entrada sin intentar nada', async () => {
    vi.unstubAllGlobals()
    vi.stubGlobal('window', undefined)
    expect(await resolverMembreteParaWord(PROXY)).toBe(PROXY)
  })
})
