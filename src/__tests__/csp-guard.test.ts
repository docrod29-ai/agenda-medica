import { describe, it, expect, afterAll } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { RUTAS_PRIVADAS, RE_RUTAS_PRIVADAS } from '@/lib/security/rutas-privadas'
import nextConfig from '../../next.config'

/**
 * Guardián ESTÁTICO de la política de seguridad de cabeceras (unidad Nexus OS E0-10).
 * Molde: `firestore-rules-guard.test.ts` — fija invariantes que un cambio accidental
 * no debe romper, sin desplegar nada ni depender de la red.
 *
 * Los tres fallos que este archivo habría cazado ANTES de apretar la CSP a enforce:
 *   1. el worker de pdf.js se carga de unpkg.com y no estaba en la política,
 *   2. el iframe de teleconsulta (Daily) no estaba en `frame-src`,
 *   3. media docena de pantallas con PHI (/uci, /hospitalizacion, /receta…) y la
 *      consola del dueño (/superadmin) no llevaban NINGUNA cabecera anti-iframe.
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
 * restringe imágenes por host), pero se deja anotado porque es un HALLAZGO abierto
 * de privacidad, no una bendición: ver docs/seguridad/csp-enforce.md §Hallazgos.
 */
const EXENCIONES: Record<string, string> = {
  'api.qrserver.com': 'img-src permite https: en general (QR del enrolamiento MFA). HALLAZGO abierto: manda el otpauth:// a un tercero.',
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

  it('cubre las pantallas con PHI y la consola del dueño (regresión de E0-10)', () => {
    // Estas seis viajaban SIN protección en producción antes de esta unidad.
    for (const r of ['uci', 'hospitalizacion', 'superadmin', 'receta', 'orden', 'corte-caja']) {
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
    expect(idx('/(mi|resena|verificar)/:path*')).toBe(bloquesRO.length - 1)
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
