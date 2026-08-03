/**
 * GUARDIÁN + GOLDEN — las colecciones que crecían sin techo, y la línea que
 * ninguna barrida puede cruzar.
 *
 * ── EL FALLO ─────────────────────────────────────────────────────────────────
 *
 * Había dos crons y **ninguno borraba nada de Firestore** —`limpiar-audio` toca
 * únicamente Cloud Storage—. Mientras tanto:
 *
 * · `rate_limits` escribe **un documento por petición limitada**, y su propio
 *   código dice que guarda `exp` «para poder purgar con TTL de Firestore **si
 *   algún día se activa**». No se activó nunca: no hay `firestore.indexes.json`
 *   ni política TTL en ninguna parte. Otra vez la regla escrita en un comentario
 *   que nada hace cumplir.
 * · `platform_csp` la escribe un endpoint **público y sin autenticar**.
 * · `errores` crece sin techo.
 *
 * Nada de eso rompe hoy. Todo eso rompe con cien consultorios, por la vía más
 * cara: la factura y el rendimiento de las consultas.
 *
 * ── LA LÍNEA QUE NO SE CRUZA ─────────────────────────────────────────────────
 *
 * **Nada del expediente.** Cuánto se conserva un expediente lo fija la NOM-004 y
 * el abogado del consultorio, no un cron. Un barrendero que se lleve por delante
 * un dato clínico es infinitamente peor que una colección que crece: lo segundo
 * cuesta dinero, lo primero cuesta el expediente de alguien.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { REGLAS, SIN_BARRER, caducado, POR_QUE_NADA_CLINICO } from '@/lib/ops/retencion'
import { PERIODO_MIN } from '@/lib/ops/latido'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')
const ruta = leer('src', 'app', 'api', 'cron', 'retencion', 'route.ts')
const AHORA = Date.parse('2026-08-03T12:00:00.000Z')
const hace = (dias: number) => new Date(AHORA - dias * 86_400_000)

describe('LA LÍNEA: el barrendero no toca nada clínico', () => {
  it('ninguna regla apunta a una colección del consultorio', () => {
    /**
     * Si esto se pone rojo, alguien acaba de escribir un cron que borra
     * expedientes. No hay excepción declarable: la retención clínica no la
     * decide este archivo.
     */
    const clinicas = ['patients', 'notas', 'laboratorios', 'fotos', 'clinico', 'internamientos',
      'appointments', 'cobros', 'audit_log', 'arco_requests', 'doctors', 'config']
    for (const r of REGLAS) {
      expect(clinicas, `¡${r.coleccion} es del expediente!`).not.toContain(r.coleccion)
    }
  })

  it('y la ruta sólo recorre colecciones de primer nivel', () => {
    // `adminDb.collection('clinics').doc(...)` sería el principio del desastre.
    expect(ruta).not.toContain("collection('clinics')")
    expect(ruta).toContain('adminDb.collection(regla.coleccion)')
  })

  it('está escrito por qué, y no como una nota al margen', () => {
    expect(POR_QUE_NADA_CLINICO).toMatch(/NOM-004/)
    expect(POR_QUE_NADA_CLINICO).toMatch(/cuesta el expediente de alguien/)
  })
})

describe('lo que no se puede fechar, no se borra', () => {
  const regla = REGLAS.find(r => r.coleccion === 'errores')!

  it('un documento viejo sí se borra', () => {
    expect(caducado(regla, hace(200).toISOString(), AHORA).borrar).toBe(true)
  })

  it('uno reciente no', () => {
    expect(caducado(regla, hace(10).toISOString(), AHORA).borrar).toBe(false)
  })

  it('sin fecha legible NO se borra, y se dice', () => {
    // La misma regla que el barrido de audio: borrar ante la duda es la única
    // forma de que un barrendero se convierta en una pérdida de datos.
    for (const v of [undefined, null, '', 'ayer', {}]) {
      const r = caducado(regla, v, AHORA)
      expect(r.borrar, String(v)).toBe(false)
      expect(r.porQue).toMatch(/ante la duda/)
    }
  })

  it('una fecha en el futuro tampoco', () => {
    const r = caducado(regla, new Date(AHORA + 10 * 86_400_000).toISOString(), AHORA)
    expect(r.borrar).toBe(false)
    expect(r.porQue).toMatch(/futuro/)
  })

  it('el formato `timestamp` entiende Date y Firestore Timestamp', () => {
    /**
     * Comparar mal el formato no borra de MÁS: no borra NADA, y eso pasa
     * desapercibido — el barrendero corre en verde y la colección sigue
     * creciendo.
     */
    const rl = REGLAS.find(r => r.coleccion === 'rate_limits')!
    expect(caducado(rl, hace(5), AHORA).borrar).toBe(true)
    expect(caducado(rl, { toDate: () => hace(5) }, AHORA).borrar).toBe(true)
    expect(caducado(rl, hace(1), AHORA).borrar).toBe(false)
  })
})

describe('el manifiesto se explica', () => {
  it('cada regla dice por qué ese plazo y por qué se puede borrar', () => {
    for (const r of REGLAS) {
      expect(r.porQue.length, r.coleccion).toBeGreaterThan(60)
      /**
       * `dias: 0` es legítimo y significa «cuando el propio campo diga que
       * caducó»: es lo que hace `whatsapp_dedup`, que ya escribe su `expira`.
       * Respetar el plazo que el módulo declaró es mejor que inventar uno.
       */
      expect(r.dias, r.coleccion).toBeGreaterThanOrEqual(0)
    }
  })

  it('el plazo del dedup NO se inventa: sale de su propio `expira`', () => {
    const d = REGLAS.find(r => r.coleccion === 'whatsapp_dedup')!
    expect(d.dias).toBe(0)
    expect(d.campo).toBe('expira')
    expect(d.porQue).toMatch(/no se inventa un plazo/)
  })

  it('`rate_limits` está, que es el que su propio código dejó pendiente', () => {
    const rl = REGLAS.find(r => r.coleccion === 'rate_limits')
    expect(rl, 'el TTL que «algún día se activaría» sigue sin activarse').toBeDefined()
    expect(rl!.porQue).toMatch(/si algún día se activa/)
  })

  it('cada colección que se deja crecer trae su razón', () => {
    // Para distinguir «se me olvidó» de «se decidió».
    for (const [c, razon] of Object.entries(SIN_BARRER)) {
      expect(razon.length, c).toBeGreaterThan(40)
    }
  })

  it('ninguna colección está a la vez barrida y exenta', () => {
    for (const r of REGLAS) expect(SIN_BARRER, r.coleccion).not.toHaveProperty(r.coleccion)
  })
})

describe('GUARDIÁN — toda colección de plataforma está decidida', () => {
  /**
   * Barre `src/` buscando `adminDb.collection('X')` de primer nivel. Cada una
   * tiene que estar **o** en las reglas **o** en la lista de exentas: una
   * colección nueva que crezca sin que nadie lo haya decidido vuelve al punto de
   * partida sin que nadie lo note.
   */
  function coleccionesDePlataforma(): string[] {
    const encontradas = new Set<string>()
    const walk = (dir: string): string[] => {
      const out: string[] = []
      for (const e of readdirSync(dir)) {
        const p = join(dir, e)
        if (statSync(p).isDirectory()) { if (e !== '__tests__') out.push(...walk(p)); continue }
        if (e.endsWith('.ts') || e.endsWith('.tsx')) out.push(p)
      }
      return out
    }
    for (const f of walk(join(process.cwd(), 'src'))) {
      const src = readFileSync(f, 'utf8')
      for (const m of src.matchAll(/adminDb\s*\.?\s*\n?\s*\.?collection\('([a-z_]+)'\)/g)) {
        encontradas.add(m[1])
      }
    }
    return [...encontradas].sort()
  }

  const encontradas = coleccionesDePlataforma()

  it('el guardián encuentra colecciones (si no, pasaría vacío)', () => {
    expect(encontradas.length).toBeGreaterThan(5)
  })

  it('ninguna está sin decidir', () => {
    const decididas = new Set([...REGLAS.map(r => r.coleccion), ...Object.keys(SIN_BARRER)])
    const huerfanas = encontradas.filter(c => !decididas.has(c))
    expect(huerfanas, `colecciones de plataforma sin regla ni exención: ${huerfanas.join(', ')}`).toEqual([])
  })
})

describe('la ruta barre bien', () => {
  it('pagina por `__name__` y filtra en memoria, a propósito', () => {
    /**
     * Un `where` sobre la fecha exigiría un índice creado a mano, y mientras no
     * exista la consulta falla ENTERA y no se borra nada. Un barrendero que no
     * barre porque falta un índice es un barrendero que nadie echa de menos.
     */
    expect(ruta).toContain("orderBy('__name__').limit(PAGINA)")
    expect(ruta).toContain('índice creado a mano')
  })

  it('borra por lotes, con tope y declarando el rezago', () => {
    expect(ruta).toContain('adminDb.batch()')
    expect(ruta).toContain('const TOPE = 5000')
    expect(ruta).toContain('hayMas = true')
  })

  it('una colección que falla no tumba el barrido de las demás', () => {
    expect(ruta).toContain("error: 'no se pudo barrer'")
    expect(ruta).toContain('continue')
  })

  it('con el candado fail-closed: un endpoint que BORRA no queda abierto', () => {
    expect(ruta).toContain('CRON_SECRET no configurado (fail-closed)')
  })

  it('y late en sus dos salidas, como exige el guardián de crons', () => {
    expect((ruta.match(/registrarLatido\(/g) ?? []).length).toBeGreaterThanOrEqual(2)
    expect(PERIODO_MIN).toHaveProperty('retencion')
  })
})
