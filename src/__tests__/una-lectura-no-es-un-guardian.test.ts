/**
 * GOLDEN — «NINGUNA FUENTE SE OBTIENE SALTÁNDOSE SU LICENCIA» ESTABA
 * VERIFICADO POR LECTURA, QUE NO ES UNA GARANTÍA.
 *
 * ── QUÉ FALTABA ─────────────────────────────────────────────────────────────
 *
 * `WS-06.sin-scraping` llevaba `PARTIAL` con esta frase: «Verificado por
 * lectura: no hay puppeteer, ni credenciales compartidas, ni corpus copiado;
 * `no-configurado.ts` no conoce ninguna URL. Falta un guardián que lo mantenga
 * así.»
 *
 * Se comprobó, y era cierto. Pero una lectura es una foto: el día que un `fetch`
 * nuevo apuntara a la página de un editor, **ninguna prueba se pondría roja**.
 * El requisito no pedía encontrar un defecto — pedía que no pudiera entrar uno.
 *
 * ── LO QUE SE MIDIÓ, ANTES DE DECLARAR NADA ─────────────────────────────────
 *
 * Se escribió el escáner primero y se corrió sobre el árbol. Ocho hosts en todo
 * el camino de evidencia, y ninguno es la página de un editor:
 *
 *     se baja       eutils.ncbi.nlm.nih.gov    API oficial de NCBI
 *     se baja       api.fda.gov                API pública de openFDA
 *     se baja       api.anthropic.com          el modelo, no una fuente
 *     sólo enlace   pubmed.ncbi.nlm.nih.gov    el registro, para abrirlo
 *     sólo enlace   www.accessdata.fda.gov     el buscador de la propia FDA
 *     sólo enlace   www.google.com             búsqueda de la GPC del CENETEC
 *     sólo enlace   www.ncbi.nlm.nih.gov       en un comentario, sobre la llave
 *     no resuelve   example.invalid            el adaptador sintético
 *
 * ── LA DISTINCIÓN QUE ESTO SOSTIENE ─────────────────────────────────────────
 *
 * **Enlazar no es recuperar, y es casi lo contrario.** Un `href` manda al médico
 * al sitio del editor, donde el editor le enseña lo que quiera bajo sus términos.
 * Bajar esa misma URL desde el servidor y quedarse con el HTML es tomar el
 * material sin pasar por donde el editor pone sus condiciones.
 *
 * La URL es la misma y el acto es el contrario. Por eso la clasificación no
 * puede salir de la cadena de texto: la dice una persona y queda escrita.
 *
 * ── POR QUÉ EL ESCÁNER NO ADIVINA ───────────────────────────────────────────
 *
 * Lo natural sería mirar si el host está dentro de un `fetch(`. Sería frágil: la
 * URL se arma en una constante, se pasa por un ayudante con regulador de
 * velocidad, se compone con plantillas. Un analizador que acierte el 90 % da una
 * lista que **parece** completa, que es peor que no tenerla.
 *
 * Así que el instrumento lista todo host que aparece, y el guardián exige que
 * cada uno esté clasificado. Misma forma que
 * `ACCIONES_CON_EVENTO_DURABLE`/`..._SIN_...`: una partición que obliga a
 * decidir, no un detector que opina.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · SÍ bloquea al pedir, y eso se añadió DESPUÉS. La primera versión era sólo un
 *   guardián de CI, y tres guardianes de este árbol la rechazaron por no estar
 *   conectada. Tenían razón por un motivo mayor que el lint: una comprobación en
 *   CI no cierra un `fetch`. Ahora `exigeQueSeBaje` corre en las dos puertas de
 *   salida y lanza antes de ir a la red.
 * · Lo que NO cubre es una puerta TERCERA que alguien añada sin llamarla: el host
 *   nuevo lo caza la partición, pero la petición ya habría salido una vez.
 * · NO demuestra que un host `solo_se_enlaza` no se baje. Comprueba que no
 *   aparezca en la misma línea que un `fetch`, y eso se le escapa si alguien
 *   guarda la URL en una constante y la baja tres líneas más abajo. Lo que sí
 *   impide es que el cambio pase inadvertido: mover un host de columna hay que
 *   hacerlo a mano, en el módulo, con su base legal.
 * · NO cubre el resto del producto. WhatsApp, Stripe y el correo tienen sus
 *   propios hosts y no son fuentes que se citen. El alcance está declarado en
 *   `CAMINO_DE_EVIDENCIA` y ampliarlo es una decisión.
 * · NO juzga si una licencia PERMITE lo que se hace con el material una vez
 *   traído. Eso es `catalogo.ts` y su matriz, y es otro eje.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  inventariar, CAMINO_DE_EVIDENCIA,
} from '../../scripts/evidence/hosts-del-camino-de-evidencia.mjs'
import {
  HOSTS_DE_EVIDENCIA, SE_BAJAN, estaDeclarado, LO_QUE_SERIA_RASPAR,
  exigeQueSeBaje, HostNoDeclarado,
} from '@/lib/evidence-integrations/de-donde-se-baja'

const PAQUETE = JSON.parse(readFileSync('package.json', 'utf8'))
const NO_CONFIGURADO = readFileSync('src/lib/evidence-integrations/adaptadores/no-configurado.ts', 'utf8')

describe('la partición no deja huecos', () => {
  it('todo host del árbol está clasificado', () => {
    /* El guardián entero. Un host nuevo sin clasificar rompe esto a propósito:
       no impide escribirlo, obliga a decir qué se hace con él. */
    for (const { host, donde } of inventariar()) {
      expect([host, donde.join(' '), estaDeclarado(host)]).toEqual([host, donde.join(' '), true])
    }
  })

  it('y no se declara un host que ya no existe', () => {
    /* Al revés: una declaración que sobrevive al código que la justificaba es
       una lista que envejece y deja de leerse. */
    const enElArbol = new Set(inventariar().map(h => h.host))
    for (const h of HOSTS_DE_EVIDENCIA) {
      expect([h.host, enElArbol.has(h.host)]).toEqual([h.host, true])
    }
  })

  it('el escáner mira de verdad el camino de evidencia', () => {
    /**
     * Sin esto, un escáner que apuntara a un directorio vacío devolvería cero
     * hosts y las dos comprobaciones de arriba pasarían en verde vigilando
     * nada. Es la misma trampa del cero falso que ya cazó otro guardián de este
     * árbol.
     */
    const inv = inventariar()
    expect(inv.length).toBeGreaterThanOrEqual(8)
    expect(CAMINO_DE_EVIDENCIA).toContain('src/lib/evidencia')
    expect(inv.map(h => h.host)).toContain('eutils.ncbi.nlm.nih.gov')
  })
})

describe('lo que se baja necesita base legal; lo que se enlaza, no', () => {
  it('cada host que se baja dice por qué se puede', () => {
    expect(SE_BAJAN.length).toBeGreaterThan(0)
    for (const h of HOSTS_DE_EVIDENCIA) {
      if (h.comoSeUsa !== 'se_baja') continue
      /* Una base legal de una línea es una casilla marcada. Se exige que diga
         cuál es la vía y por qué es la oficial. */
      expect([h.host, h.baseLegal.length > 100]).toEqual([h.host, true])
    }
  })

  it('sólo se bajan APIs, y las tres están nombradas', () => {
    expect([...SE_BAJAN].sort()).toEqual([
      'api.anthropic.com', 'api.fda.gov', 'eutils.ncbi.nlm.nih.gov',
    ])
  })

  it('ningún host de sólo-enlace aparece junto a un `fetch`', () => {
    /* Comprobación estrecha y se declara como tal en la cabecera: se le escapa
       una URL guardada en una constante y bajada más abajo. Lo que sí impide es
       el cambio inadvertido. */
    const soloEnlace = HOSTS_DE_EVIDENCIA.filter(h => h.comoSeUsa === 'solo_se_enlaza')
    for (const { host, donde } of inventariar()) {
      if (!soloEnlace.some(h => h.host === host)) continue
      for (const archivo of donde) {
        for (const linea of readFileSync(archivo, 'utf8').split('\n')) {
          if (linea.includes(host) && /\bfetch\s*\(/.test(linea)) {
            expect([host, archivo, linea.trim()]).toEqual([host, archivo, 'NO DEBERÍA BAJARSE'])
          }
        }
      }
    }
  })

  it('el adaptador de lo no configurado sigue sin conocer ningún host', () => {
    /**
     * Es el adaptador de los proveedores con los que NO hay contrato. Que
     * aprendiera una URL sería exactamente el defecto: intentar entrar donde no
     * hay licencia. Su estado es `not_configured` y tiene que quedarse mudo.
     */
    expect(NO_CONFIGURADO).not.toMatch(/https?:\/\//)
    expect(NO_CONFIGURADO).not.toMatch(/\bfetch\s*\(/)
  })
})

describe('la puerta corre al pedir, no sólo en el CI', () => {
  it('deja pasar las dos vías oficiales', () => {
    expect(() => exigeQueSeBaje('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed')).not.toThrow()
    expect(() => exigeQueSeBaje('https://api.fda.gov/drug/label.json?search=x')).not.toThrow()
  })

  it('la página de un editor NO sale a la red', () => {
    /* El caso que esto existe para impedir. Y no basta con que el CI lo cace:
       una comprobación en CI no cierra un `fetch`. */
    expect(() => exigeQueSeBaje('https://www.sciencedirect.com/science/article/pii/X'))
      .toThrow(HostNoDeclarado)
  })

  it('un host que SÓLO se enlaza tampoco se puede pedir', () => {
    /**
     * La distinción entera, hecha ejecutable: la MISMA URL que es legítima como
     * enlace es ilegítima como petición. `doi.org` y el registro de PubMed se
     * abren en el navegador del médico; pedirlos desde el servidor es otro acto.
     */
    expect(() => exigeQueSeBaje('https://pubmed.ncbi.nlm.nih.gov/12345/')).toThrow(HostNoDeclarado)
    expect(() => exigeQueSeBaje('https://www.google.com/search?q=gpc')).toThrow(HostNoDeclarado)
  })

  it('una URL que ni siquiera se puede leer tampoco pasa', () => {
    /* Falla cerrado: si no se sabe a qué host va, no se sabe si está permitido. */
    expect(() => exigeQueSeBaje('no-es-una-url')).toThrow(HostNoDeclarado)
    expect(() => exigeQueSeBaje('')).toThrow(HostNoDeclarado)
  })

  it('el error dice qué hacer, no sólo que no', () => {
    try {
      exigeQueSeBaje('https://www.uptodate.com/contents/x')
      expect.unreachable('debió lanzar')
    } catch (e) {
      expect((e as Error).message).toContain('de-donde-se-baja.ts')
      expect((e as Error).message).toContain('base legal')
    }
  })

  it('y las dos puertas de salida la llaman', () => {
    /* Si alguien añade una tercera puerta que no la llame, el host nuevo lo caza
       la partición de arriba — pero la petición ya habría salido. */
    for (const f of ['src/lib/evidencia/pubmed.ts', 'src/lib/evidencia/openfda.ts']) {
      expect(readFileSync(f, 'utf8')).toContain('exigeQueSeBaje(url)')
    }
  })
})

describe('las cuatro formas de raspar que el árbol no puede tomar', () => {
  it('ningún navegador sin cabeza en las dependencias de producción', () => {
    const prod = Object.keys(PAQUETE.dependencies ?? {})
    for (const p of prod) {
      expect([p, /puppeteer|selenium|playwright/i.test(p)]).toEqual([p, false])
    }
  })

  it('Playwright existe SÓLO para las pruebas, y ahí se queda', () => {
    /* Al revés: si alguien lo asciende a dependencia de producción, esto se
       pone rojo. Un navegador sin cabeza en el servidor no tiene otro uso aquí
       que abrir páginas que no se pueden pedir por API. */
    const dev = Object.keys(PAQUETE.devDependencies ?? {})
    expect(dev.some(p => /playwright/i.test(p))).toBe(true)
    expect(Object.keys(PAQUETE.dependencies ?? {}).some(p => /playwright/i.test(p))).toBe(false)
  })

  it('nada del camino de evidencia analiza HTML', () => {
    /**
     * La segunda forma: pedir la página del editor y sacarle el texto. Si no hay
     * analizador de HTML en este camino, no hay con qué.
     */
    for (const { donde } of inventariar()) {
      for (const archivo of donde) {
        const src = readFileSync(archivo, 'utf8')
        expect([archivo, /\b(cheerio|jsdom|DOMParser|parseFromString)\b/.test(src)])
          .toEqual([archivo, false])
      }
    }
  })

  it('las cinco formas están enumeradas para poder buscarlas', () => {
    /* La lista no es documentación: cada línea corresponde a una comprobación
       de arriba, o a una que se declara como no cubierta. */
    expect(LO_QUE_SERIA_RASPAR.length).toBe(5)
    const todo = LO_QUE_SERIA_RASPAR.join(' ')
    expect(todo).toContain('Puppeteer')
    expect(todo).toContain('credencial institucional compartida')
    expect(todo).toContain('corpus copiado')
  })
})
