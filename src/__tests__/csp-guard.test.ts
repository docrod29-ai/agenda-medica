import { describe, it, expect, afterAll } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { RUTAS_PRIVADAS, RE_RUTAS_PRIVADAS, RUTAS_PACIENTE_CON_PHI, RE_RUTAS_PACIENTE } from '@/lib/security/rutas-privadas'
import nextConfig from '../../next.config'

/**
 * Guardián ESTÁTICO de la política de seguridad de cabeceras (unidad Nexus OS E0-10).
 * Molde: `firestore-rules-guard.test.ts` — fija invariantes que un cambio accidental
 * no debe romper, sin desplegar nada ni depender de la red.
 *
 * Los tres fallos que este archivo caza ANTES de apretar la CSP a enforce:
 *   1. el worker de pdf.js se carga de unpkg.com y no estaba en la política
 *      (lo caza el escáner de POSICIONES_DE_CARGA: el host está literal en el código),
 *   2. el iframe de teleconsulta (Daily) no estaba en `frame-src`
 *      (lo caza IFRAMES_DE_ORIGEN_DINAMICO; ver el porqué justo abajo),
 *   3. media docena de pantallas con PHI (/uci, /hospitalizacion, /receta…) y la
 *      consola del dueño (/superadmin) no llevaban NINGUNA cabecera anti-iframe.
 *
 * CORRECCIÓN DE UNA AFIRMACIÓN QUE ERA FALSA (verificación adversarial de E0-10, V-3):
 * hasta la pasada de cierre este comentario decía que el archivo habría cazado los
 * tres, y no era verdad para el (2): el iframe de teleconsulta monta un `src`
 * DINÁMICO (`src={url}`, con la URL de la sala que devuelve /api/telesalud/sala), así
 * que el host `*.daily.co` NO aparece en el código y ninguna regex podía verlo.
 * Mutante que sobrevivía: quitar `https://*.daily.co` de ORIGENES_FRAME dejaba el CI
 * verde y la videoconsulta en blanco bajo enforce. Lo cierra el registro de iframes de
 * origen dinámico de más abajo.
 *
 * Aquí no hay criterio clínico: son invariantes de configuración de software.
 */
const RAIZ = process.cwd()
const DIR_DASHBOARD = resolve(RAIZ, 'src/app/(dashboard)')
const DIR_APP = resolve(RAIZ, 'src/app')

/** Llama a `headers()` con el modo pedido (se lee de env en cada llamada). */
async function cabeceras(modo?: 'enforce' | 'report-only') {
  const previo = process.env.CSP_MODE
  if (modo) process.env.CSP_MODE = modo
  else delete process.env.CSP_MODE
  try {
    return await nextConfig.headers!()
  } finally {
    if (previo === undefined) delete process.env.CSP_MODE
    else process.env.CSP_MODE = previo
  }
}

const CSP_ENV_ORIGINAL = process.env.CSP_MODE
afterAll(() => {
  if (CSP_ENV_ORIGINAL === undefined) delete process.env.CSP_MODE
  else process.env.CSP_MODE = CSP_ENV_ORIGINAL
})

type Bloque = { source: string; headers: { key: string; value: string }[] }

/** Valores de cabeceras CSP (de cualquiera de las dos claves) de un bloque. */
function politicasDe(bloque: Bloque, clave?: RegExp): string[] {
  return bloque.headers
    .filter(h => /^content-security-policy(-report-only)?$/i.test(h.key))
    .filter(h => (clave ? clave.test(h.key) : true))
    .map(h => h.value)
}

/** Valores de UNA directiva de la política (p.ej. `frame-src`), sin el nombre. */
function directiva(politica: string, nombre: string): string[] {
  const d = politica.split('; ').find(x => x === nombre || x.startsWith(nombre + ' '))
  return d ? d.split(/\s+/).slice(1) : []
}

const bloquesRO = (await cabeceras()) as Bloque[]
const bloquesEnforce = (await cabeceras('enforce')) as Bloque[]

const global = bloquesRO.find(b => b.source === '/:path*')!
const politicaGlobal = politicasDe(global)[0] ?? ''

describe('E0-10 · la política global es completa y no se afloja', () => {
  it('declara las directivas mínimas de contención', () => {
    for (const directiva of [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "form-action 'self'",
      'report-uri /api/csp-report',
    ]) {
      expect(politicaGlobal, `falta la directiva: ${directiva}`).toContain(directiva)
    }
  })

  it('no hay comodines abiertos ni http: en las directivas de ejecución', () => {
    // `https://*.dominio` sí se permite; ` * ` pelado y `http:` no.
    for (const nombre of ['default-src', 'script-src', 'connect-src', 'frame-src', 'worker-src']) {
      const dir = politicaGlobal.split('; ').find(d => d.startsWith(nombre + ' ')) ?? ''
      expect(dir.split(' ').slice(1), `${nombre} tiene un comodín abierto`).not.toContain('*')
      expect(dir, `${nombre} permite http: en claro`).not.toMatch(/\bhttp:\/\//)
    }
  })

  it('el receptor de reportes existe en el repo', () => {
    expect(existsSync(resolve(RAIZ, 'src/app/api/csp-report/route.ts'))).toBe(true)
  })

  it('emite también el `report-to` moderno con su grupo declarado', () => {
    // report-uri está deprecado; sin Reporting-Endpoints, `report-to` es papel mojado.
    expect(politicaGlobal).toContain('report-to csp')
    const grupo = global.headers.find(h => h.key === 'Reporting-Endpoints')
    expect(grupo?.value).toContain('csp="/api/csp-report"')
  })
})

/**
 * TRINQUETE anti-aflojamiento (patrón E0-03): la lista de orígenes externos se
 * congela aquí. Añadir uno obliga a tocar este archivo → nadie amplía la superficie
 * de ejecución de terceros en silencio.
 */
const ORIGENES_ESPERADOS = [
  'https://*.cloudfunctions.net',
  'https://*.daily.co',
  'https://*.firebaseapp.com',
  'https://*.firebaseio.com',
  'https://*.firebasestorage.app',
  'https://*.google.com',
  'https://*.googleapis.com',
  'https://accounts.google.com',
  'https://api.stripe.com',
  'https://apis.google.com',
  'https://connect.facebook.net',
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com',
  'https://hooks.stripe.com',
  'https://js.stripe.com',
  'https://recaptcha.net',
  'https://unpkg.com',
  'https://va.vercel-scripts.com',
  'https://vitals.vercel-insights.com',
  'https://www.facebook.com',
  'https://www.google.com',
  'https://www.gstatic.com',
  'https://www.recaptcha.net',
  'wss://*.firebaseio.com',
  'wss://*.googleapis.com',
].sort()

/** Todos los orígenes que aparecen en CUALQUIER variante de la política. */
function origenesDeclarados(bloques: Bloque[]): string[] {
  const set = new Set<string>()
  for (const b of bloques) {
    for (const politica of politicasDe(b)) {
      for (const token of politica.split(/[\s;]+/)) {
        if (/^(https|wss):\/\/./.test(token)) set.add(token)
      }
    }
  }
  return [...set].sort()
}

describe('E0-10 · trinquete: la superficie de terceros está congelada', () => {
  it('los orígenes externos son EXACTAMENTE los declarados en este test', () => {
    expect(origenesDeclarados(bloquesRO)).toEqual(ORIGENES_ESPERADOS)
  })

  it('el modo enforce no amplía la superficie respecto a report-only', () => {
    expect(origenesDeclarados(bloquesEnforce)).toEqual(origenesDeclarados(bloquesRO))
  })

  it('Meta NO entra en la política global (las URLs clínicas llevan IDs de paciente)', () => {
    // src/components/MetaPixel.tsx:3-6 lo exige. Meta sólo se concede en /, /registro
    // y /configuracion (SDK del alta de WhatsApp).
    expect(politicaGlobal).not.toContain('facebook')
    const conMeta = bloquesRO.filter(b => politicasDe(b).some(p => p.includes('connect.facebook.net')))
    expect(conMeta.map(b => b.source).sort()).toEqual(['/', '/configuracion/:path*', '/registro/:path*'])
  })
})

/**
 * CRUCE CÓDIGO ↔ POLÍTICA. Escanea las POSICIONES DE CARGA del navegador (no
 * cualquier URL suelta: un `fetch` de servidor no pasa por la CSP del navegador) y
 * exige que cada host esté permitido por la política o exento con motivo escrito.
 * Fail-closed a propósito: es el test que caza el próximo unpkg.com.
 */
const POSICIONES_DE_CARGA = [
  /workerSrc\s*=\s*[`"']https:\/\/([a-z0-9.-]+)/gi,
  /\.src\s*=\s*[`"']https:\/\/([a-z0-9.-]+)/gi,
  /\bsrc=[`"'{]{1,2}https:\/\/([a-z0-9.-]+)/gi,
  /importScripts\(\s*[`"']https:\/\/([a-z0-9.-]+)/gi,
  /[`"']script[`"']\s*,\s*[`"']https:\/\/([a-z0-9.-]+)/gi,
]

/**
 * Exenciones con MOTIVO. Sin motivo no hay exención.
 * Ojo: `api.qrserver.com` está permitido por `img-src ... https:` (la política no
 * restringe imágenes por host), y se deja anotado con lo que hoy manda de verdad:
 * ver docs/seguridad/csp-enforce.md §Hallazgos.
 *
 * REG-502 CERRÓ LA PARTE GRAVE. El hallazgo decía «manda el otpauth:// a un
 * tercero», y era cierto en las DOS pantallas de enrolamiento: el `otpauth://`
 * lleva dentro el secreto compartido del segundo factor. Ya no lo manda ninguna
 * — las dos dibujan el QR en el navegador con `qrcode`.
 *
 * LO QUE QUEDA, Y POR QUÉ NO ES LO MISMO: dos QR de enlaces PÚBLICOS (el
 * `wa.me` de auto-agenda y la URL de reservas del consultorio). Ahí no viaja
 * ningún secreto: viaja una dirección hecha para repartirse. Sigue siendo una
 * dependencia de un tercero y no funciona sin red, pero no es divulgación de
 * un secreto y no se cuenta como si lo fuera.
 */
const EXENCIONES: Record<string, string> = {
  'api.qrserver.com': 'img-src permite https: en general. Sólo QR de enlaces PÚBLICOS (auto-agenda, reservas). El secreto TOTP ya NO viaja: REG-502.',
}

/** Sólo código que se sirve al navegador: los tests no se despachan a nadie. */
function archivosFuente(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) {
      if (e.name === '__tests__') continue
      archivosFuente(p, acc)
    } else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) {
      acc.push(p)
    }
  }
  return acc
}

function permitidoPorPolitica(host: string, declarados: string[]): boolean {
  return declarados.some(o => {
    const sinEsquema = o.replace(/^(https|wss):\/\//, '')
    if (sinEsquema === host) return true
    if (sinEsquema.startsWith('*.')) return host.endsWith(sinEsquema.slice(1))
    return false
  })
}

describe('E0-10 · ningún host cargado por el navegador queda fuera de la política', () => {
  it('cada origen externo del código está permitido o exento con motivo', () => {
    const declarados = origenesDeclarados(bloquesRO)
    const huerfanos: string[] = []
    for (const archivo of archivosFuente(resolve(RAIZ, 'src'))) {
      const texto = readFileSync(archivo, 'utf8')
      for (const re of POSICIONES_DE_CARGA) {
        re.lastIndex = 0
        let m: RegExpExecArray | null
        while ((m = re.exec(texto))) {
          const host = m[1].toLowerCase()
          if (permitidoPorPolitica(host, declarados)) continue
          if (EXENCIONES[host]) continue
          huerfanos.push(`${host} ← ${archivo.replace(RAIZ + '/', '')}`)
        }
      }
    }
    expect(
      [...new Set(huerfanos)],
      huerfanos.length
        ? 'Estos hosts los carga el NAVEGADOR y la CSP no los permite: con CSP_MODE=enforce ' +
          'el recurso se bloquea y el flujo se rompe en silencio.\n  ' +
          [...new Set(huerfanos)].join('\n  ')
        : '',
    ).toEqual([])
  })

  it('el escáner no es de cartón: detecta un host inventado', () => {
    // Autotest de las regex (si se rompieran, el bloque anterior quedaría verde vacuo).
    const muestra = `pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdn.malicioso.example/w.mjs'`
    const encontrados: string[] = []
    for (const re of POSICIONES_DE_CARGA) {
      re.lastIndex = 0
      let m: RegExpExecArray | null
      while ((m = re.exec(muestra))) encontrados.push(m[1])
    }
    expect(encontrados).toContain('cdn.malicioso.example')
    expect(permitidoPorPolitica('cdn.malicioso.example', origenesDeclarados(bloquesRO))).toBe(false)
  })
})

/**
 * IFRAMES DE ORIGEN DINÁMICO — el hueco que dejaba pasar el mutante de Daily (V-3).
 *
 * El escáner de arriba sólo ve hosts LITERALES en el código. Un `<iframe src={url}>`
 * cuya URL llega en runtime desde una API no tiene host que escanear, así que la
 * única forma de atarlo a la política es DECLARARLO aquí: cada entrada dice de dónde
 * sale la URL y el test exige que `frame-src` permita ese origen.
 */
const IFRAMES_DE_ORIGEN_DINAMICO: { archivo: string; origen: string; porQue: string }[] = [
  {
    archivo: 'src/app/teleconsulta/[citaId]/page.tsx',
    origen: 'https://una-sala.daily.co',
    porQue:
      'room.url que devuelve /api/telesalud/sala (Daily). Sin frame-src el iframe sale EN BLANCO ' +
      'con enforce y la videoconsulta deja de existir.',
  },
]

/**
 * iframes que aparecen en el código pero que ESTA app no monta (texto que se copia a
 * otro sitio). Sin motivo escrito no hay exención.
 */
const IFRAMES_EXENTOS: Record<string, string> = {
  'src/app/(dashboard)/configuracion/page.tsx':
    'snippetIframe es una CADENA que el consultorio pega en SU web y apunta a /reservar de este ' +
    'mismo origen: no es un iframe que renderice NexusMED, y /reservar es embebible a propósito.',
}

/** Apertura de cada `<iframe …>` del archivo (hasta el `>` de cierre de la etiqueta). */
/**
 * Tag de apertura de un <iframe>, SIN cota de longitud.
 *
 * Tenía `{0,400}`, y esa cota era un escape: un tag de apertura de más de 400
 * caracteres (nada raro en JSX con estilos y props en línea) quedaba INVISIBLE
 * para el escáner, así que un `src={url}` no declarado pasaba en verde.
 * Demostrado por la verificación adversarial de E0-10 (mutante M3b: 23/23 verde).
 *
 * `[^>]*` no cruza el cierre del tag, así que no hace falta acotar nada.
 */
const RE_APERTURA_IFRAME = /<iframe[^>]*>/g

describe('E0-10 · los iframes de origen DINÁMICO están atados a frame-src (V-3)', () => {
  // Se cruza contra el `frame-src` de la política GLOBAL a propósito: /teleconsulta no
  // está en RUTAS_PRIVADAS (la abre el paciente por enlace), así que la política que
  // realmente aplica al iframe es la global. Y se compara contra ESA directiva, no
  // contra "todos los orígenes de la política": así, quitar https://*.daily.co sólo de
  // ORIGENES_FRAME pone el CI en rojo aunque el host siguiera en otra directiva.
  const frameSrcGlobal = directiva(politicaGlobal, 'frame-src')

  it('frame-src permite el origen de cada iframe dinámico declarado', () => {
    const noPermitidos = IFRAMES_DE_ORIGEN_DINAMICO.filter(
      i => !permitidoPorPolitica(new URL(i.origen).hostname, frameSrcGlobal),
    ).map(i => `${new URL(i.origen).hostname} ← ${i.archivo} (${i.porQue})`)
    expect(
      noPermitidos,
      noPermitidos.length
        ? 'frame-src no permite estos orígenes: el iframe saldría EN BLANCO con enforce.\n  ' +
          noPermitidos.join('\n  ')
        : '',
    ).toEqual([])
  })

  it('la declaración no se podre: cada archivo existe y sigue montando un iframe', () => {
    for (const { archivo } of IFRAMES_DE_ORIGEN_DINAMICO) {
      const ruta = resolve(RAIZ, archivo)
      expect(existsSync(ruta), `${archivo} ya no existe: revisa la declaración`).toBe(true)
      expect(readFileSync(ruta, 'utf8'), `${archivo} ya no monta ningún iframe`).toContain('<iframe')
    }
  })

  it('TRINQUETE: ningún iframe con src dinámico queda sin declarar ni exento', () => {
    const declarados = new Set(IFRAMES_DE_ORIGEN_DINAMICO.map(i => i.archivo))
    const sinDeclarar: string[] = []
    for (const archivo of archivosFuente(resolve(RAIZ, 'src'))) {
      const rel = archivo.replace(RAIZ + '/', '')
      const texto = readFileSync(archivo, 'utf8')
      RE_APERTURA_IFRAME.lastIndex = 0
      let m: RegExpExecArray | null
      while ((m = RE_APERTURA_IFRAME.exec(texto))) {
        // `src={algo}` o `src="${algo}"`: el host no está en el código.
        if (!/src\s*=\s*\{|src\s*=\s*["'`]\$\{/.test(m[0])) continue
        if (declarados.has(rel) || IFRAMES_EXENTOS[rel]) continue
        sinDeclarar.push(rel)
      }
    }
    expect(
      [...new Set(sinDeclarar)],
      sinDeclarar.length
        ? 'Iframes con src dinámico sin declarar: la CSP no los cubre y el escáner de hosts ' +
          'literales no puede verlos.\n  ' +
          [...new Set(sinDeclarar)].join('\n  ') +
          '\n\nDeclara el origen en IFRAMES_DE_ORIGEN_DINAMICO o exímelo con motivo en IFRAMES_EXENTOS.'
        : '',
    ).toEqual([])
  })
})

/**
 * RUTAS QUE RECIBEN DOS POLÍTICAS COMPLETAS (riesgo residual V-6).
 *
 * El «gana la última cabecera» está leído del servidor Node de Next, NO del proxy de
 * Vercel que sirve producción (nadie lo ha medido en HTTP real). Si ese proxy
 * ACUMULARA en vez de reemplazar, el navegador aplicaría la INTERSECCIÓN de las dos
 * políticas y estas rutas perderían los orígenes que sólo declara la específica.
 *
 * `frame-ancestors` no corre ese riesgo en ninguna de las dos semánticas: la política
 * global OMITE la directiva, y una política sin `frame-ancestors` no restringe el
 * encuadre → la intersección con 'none' sigue siendo 'none' y con * sigue embebible.
 * El riesgo se reduce, por tanto, a «el Pixel y el alta de WhatsApp podrían no cargar
 * bajo enforce»: visible, no silencioso y reversible en dos minutos.
 *
 * La lista está CONGELADA: que crezca exige una decisión explícita, no un descuido.
 */
const RUTAS_CON_POLITICA_MAS_ANCHA_QUE_LA_GLOBAL = ['/', '/configuracion/:path*', '/registro/:path*']

describe('E0-10 · el conjunto expuesto a la semántica del proxy está congelado (V-6)', () => {
  it('sólo estas rutas declaran orígenes que la política global no tiene', () => {
    const origenesDe = (b: Bloque) =>
      politicasDe(b).flatMap(p => p.split(/[\s;]+/).filter(t => /^(https|wss):\/\/./.test(t)))
    const g = bloquesEnforce.find(b => b.source === '/:path*')!
    const delGlobal = new Set(origenesDe(g))
    const masAnchas = bloquesEnforce
      .filter(b => b.source !== '/:path*' && origenesDe(b).some(o => !delGlobal.has(o)))
      .map(b => b.source)
      .sort()
    expect(
      masAnchas,
      'Cambió el conjunto de rutas con política más ancha que la global. Si el proxy de Vercel ' +
        'acumulara cabeceras en vez de reemplazarlas, estas rutas perderían esos orígenes bajo ' +
        'enforce (ver docs/seguridad/csp-enforce.md §3).',
    ).toEqual([...RUTAS_CON_POLITICA_MAS_ANCHA_QUE_LA_GLOBAL].sort())
  })
})

describe('E0-10 · la zona autenticada está completa y sin rutas fantasma', () => {
  const dirsDashboard = readdirSync(DIR_DASHBOARD, { withFileTypes: true })
    .filter(e => e.isDirectory())
    .map(e => e.name)

  it('TODA pantalla de src/app/(dashboard) está protegida contra clickjacking', () => {
    const re = new RegExp('^' + RE_RUTAS_PRIVADAS.replace('(.*)', '(.*)$'))
    const desprotegidas = dirsDashboard.filter(d => !re.test('/' + d))
    expect(
      desprotegidas,
      desprotegidas.length
        ? `Pantallas del dashboard SIN cabecera anti-iframe:\n  /${desprotegidas.join('\n  /')}\n\n` +
          'Añádelas a src/lib/security/rutas-privadas.ts (o justifica la exclusión ahí mismo).'
        : '',
    ).toEqual([])
  })

  it('no hay rutas fantasma en la lista (cada entrada existe en disco)', () => {
    const fantasmas = RUTAS_PRIVADAS.filter(
      r => !existsSync(join(DIR_DASHBOARD, r)) && !existsSync(join(DIR_APP, r)),
    )
    expect(fantasmas, 'rutas privadas que ya no existen como página').toEqual([])
  })

  it('cubre las pantallas con PHI, la consola del dueño y el login (regresión de E0-10)', () => {
    // Estas seis viajaban SIN protección en producción antes de esta unidad, y `login`
    // se sumó en la pasada de cierre (V-7a): la pantalla de credenciales embebida en un
    // iframe invisible es el clickjacking de manual. Sin este caso, quitar 'login' de la
    // lista no rompería nada (el resto de invariantes sólo mira (dashboard)/).
    for (const r of ['uci', 'hospitalizacion', 'superadmin', 'receta', 'orden', 'corte-caja', 'login']) {
      expect(RUTAS_PRIVADAS as readonly string[], `perdió la protección: /${r}`).toContain(r)
    }
  })
})

describe('E0-10 · el interruptor CSP_MODE se comporta', () => {
  it('sin CSP_MODE la política NO bloquea (report-only): un enforce accidental es imposible', () => {
    const claves = bloquesRO.flatMap(b => b.headers.map(h => h.key))
    expect(claves).toContain('Content-Security-Policy-Report-Only')
    // La única CSP en modo enforce permitida en report-only es la de frame-ancestors.
    const enforceRaras = bloquesRO.flatMap(b =>
      politicasDe(b, /^content-security-policy$/i).filter(v => !/^frame-ancestors [^;]+;?$/.test(v.trim())),
    )
    expect(enforceRaras, 'hay política de bloqueo activa sin pedirlo').toEqual([])
  })

  it('con CSP_MODE=enforce la política completa pasa a la cabecera que bloquea', () => {
    const g = bloquesEnforce.find(b => b.source === '/:path*')!
    expect(g.headers.map(h => h.key)).toContain('Content-Security-Policy')
    expect(g.headers.map(h => h.key)).not.toContain('Content-Security-Policy-Report-Only')
    expect(politicasDe(g)[0]).toContain("default-src 'self'")
  })

  it('frame-ancestors es ENFORCE en los DOS modos (no se degrada al flipar)', () => {
    // El efecto colateral que este diseño corrige: al renombrar la cabecera global,
    // las dos reglas colisionan por clave y gana la última. Si el bloque privado no
    // llevara su propio frame-ancestors, la zona con PHI perdería la capa.
    for (const bloques of [bloquesRO, bloquesEnforce]) {
      const priv = bloques.find(b => b.source === RE_RUTAS_PRIVADAS)!
      const enforce = politicasDe(priv, /^content-security-policy$/i)
      expect(enforce.some(v => v.includes("frame-ancestors 'none'"))).toBe(true)
      expect(priv.headers.find(h => h.key === 'X-Frame-Options')?.value).toBe('DENY')
    }
  })

  it('las páginas embebibles SIGUEN siendo embebibles en los dos modos', () => {
    // /reservar es el widget de agenda que los consultorios incrustan en su web:
    // romperlo con el hardening sería una regresión visible para clientes.
    for (const bloques of [bloquesRO, bloquesEnforce]) {
      for (const source of ['/reservar/:path*', '/privacidad/:path*']) {
        const b = bloques.find(x => x.source === source)!
        expect(politicasDe(b).some(v => v.includes('frame-ancestors *'))).toBe(true)
        expect(b.headers.map(h => h.key)).not.toContain('X-Frame-Options')
      }
    }
  })

  it('el bloque general va ANTES que los específicos (Next se queda con el último)', () => {
    const idx = (s: string) => bloquesRO.findIndex(b => b.source === s)
    expect(idx('/:path*')).toBeLessThan(idx(RE_RUTAS_PRIVADAS))
    expect(idx('/:path*')).toBeLessThan(idx('/reservar/:path*'))
    // Y las rutas con token del paciente, al final del todo (no-referrer gana).
    // La ruta sale de la constante, no escrita a mano: escribirla aquí es lo que
    // rompió esta prueba al añadir 'teleconsulta' al grupo.
    expect(idx(RE_RUTAS_PACIENTE)).toBe(bloquesRO.length - 1)
  })
})

describe('E0-10 · la matriz E2E de seguridad existe y lee la misma lista', () => {
  it('e2e/seguridad.spec.ts está en el repo', () => {
    expect(existsSync(resolve(RAIZ, 'e2e/seguridad.spec.ts'))).toBe(true)
  })

  it('la matriz E2E deriva las rutas privadas del módulo, no de una copia', () => {
    const spec = readFileSync(resolve(RAIZ, 'e2e/seguridad.spec.ts'), 'utf8')
    expect(spec).toContain('rutas-privadas')
    expect(spec).toContain('RUTAS_PRIVADAS')
  })
})

describe('REG-062 · el escáner de iframes no se burla con un tag largo', () => {
  /**
   * CONTROL POSITIVO del propio escáner. La regex tenía una cota `{0,400}`, así
   * que un tag de apertura más largo que eso quedaba invisible y un `src={url}`
   * no declarado pasaba en verde. Lo encontró la verificación adversarial de
   * E0-10 (mutante M3b: 23/23 verde con el hueco abierto).
   *
   * Estos casos ejercitan la REGEX directamente: si alguien le vuelve a poner una
   * cota, el caso del tag largo se pone rojo.
   */
  const encuentraSrcDinamico = (jsx: string): boolean => {
    RE_APERTURA_IFRAME.lastIndex = 0
    const tags = jsx.match(RE_APERTURA_IFRAME) ?? []
    return tags.some(t => /src=\{/.test(t))
  }

  it('detecta `src={url}` en un tag CORTO', () => {
    expect(encuentraSrcDinamico('<iframe src={url} />')).toBe(true)
  })

  it('detecta `src={url}` en un tag LARGO (>400 caracteres) ← el escape cerrado', () => {
    const relleno = ' data-relleno="' + 'x'.repeat(500) + '"'
    expect(encuentraSrcDinamico(`<iframe${relleno} src={url} allow="camera" />`)).toBe(true)
  })

  it('no confunde un iframe con src literal', () => {
    expect(encuentraSrcDinamico('<iframe src="https://ejemplo.test/x" />')).toBe(false)
  })

  it('encuentra los DOS de un archivo con dos iframes largos', () => {
    const largo = (n: string) => `<iframe data-p="${'y'.repeat(450)}" src={${n}} />`
    RE_APERTURA_IFRAME.lastIndex = 0
    const tags = `${largo('a')}\n<div/>\n${largo('b')}`.match(RE_APERTURA_IFRAME) ?? []
    expect(tags).toHaveLength(2)
  })

  it('la regex NO tiene cota de longitud (si vuelve, este caso avisa)', () => {
    expect(RE_APERTURA_IFRAME.source).not.toMatch(/\{\d+,\d+\}/)
  })
})

/**
 * PRACTICE-GA-003 · el portal del paciente también lleva PHI.
 *
 * Estas cuatro rutas quedaron fuera de `RUTAS_PRIVADAS` por estar catalogadas
 * como «superficie pública/paciente», y medido contra producción viajaban SIN
 * `X-Frame-Options` y SIN `frame-ancestors`.
 *
 * Pero público describe cómo se ENTRA, no qué se VE: dentro de `/mi/[token]`
 * están las recetas del paciente y los botones de reagendar y cancelar su cita.
 * Encuadrarlo en un iframe invisible convierte un clic cualquiera en una
 * cancelación.
 */
describe('PRACTICE-GA-003 · las rutas del paciente no se dejan encuadrar', () => {
  const bloque = bloquesRO.find(b => b.source === RE_RUTAS_PACIENTE)

  it('existe un bloque de cabeceras para ellas', () => {
    expect(bloque, `no hay bloque para ${RE_RUTAS_PACIENTE}`).toBeDefined()
  })

  it('cubre el portal, la reseña, la verificación y la teleconsulta', () => {
    expect([...RUTAS_PACIENTE_CON_PHI]).toEqual(['mi', 'resena', 'verificar', 'teleconsulta'])
  })

  it('manda X-Frame-Options: DENY', () => {
    const xfo = bloque!.headers.find(h => /^x-frame-options$/i.test(h.key))
    expect(xfo?.value).toBe('DENY')
  })

  it('el frame-ancestors va en modo ENFORCE, no sólo reportado', () => {
    /**
     * Es la mitad que de verdad bloquea. Una CSP en report-only *avisa* de que
     * alguien nos encuadró — después de que ya ocurrió. `cabecerasCsp` emite
     * aparte una `Content-Security-Policy` real sólo con `frame-ancestors`; si
     * alguien la quita, esta prueba cae.
     */
    const enforce = politicasDe(bloque!, /^content-security-policy$/i)
    // `.includes` sobre el valor y no `directiva()`: la CSP de enforce se emite
    // como `frame-ancestors 'none';` —con punto y coma— y el troceo por directivas
    // devolvería "'none';". Mismo criterio que usa la prueba de la zona privada.
    expect(enforce.some(v => v.includes("frame-ancestors 'none'"))).toBe(true)
  })

  it('NO se protege lo que se embebe a propósito', () => {
    // El widget de reservas y el aviso de privacidad se pegan en la web del
    // consultorio: cerrarlos rompería una función que se vende.
    expect([...RUTAS_PACIENTE_CON_PHI]).not.toContain('reservar')
    expect([...RUTAS_PACIENTE_CON_PHI]).not.toContain('privacidad')
  })

  it('proteger la teleconsulta NO toca la sala de Daily', () => {
    /**
     * La razón por la que estaba excluida era un malentendido: `frame-ancestors`
     * limita quién nos embebe A NOSOTROS; lo que nosotros metemos dentro lo
     * gobierna `frame-src`. Si alguien vuelve a sacar Daily de `frame-src`
     * creyendo que sobra, la videoconsulta sale en blanco bajo enforce.
     */
    const politica = politicasDe(bloque!).find(p => p.includes('frame-src')) ?? ''
    expect(directiva(politica, 'frame-src').some(o => o.includes('daily.co'))).toBe(true)
  })
})
