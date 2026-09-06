/**
 * S-010 · ASE-017 · Panel de Lujo (S-ciberseguridad, AS-expedientes) — catorce
 * colecciones raíz que el servidor escribe no estaban en la matriz ni tenían
 * regla propia; `googleTokens` tenía regla y no estaba en el manifiesto del
 * respaldo (ni excluida ni incluida).
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 * `MATRIZ_ACCESO` sólo tiene entradas para colecciones con `match`, así que lo
 * que el Admin SDK escribe sin `match` era invisible para los tres sitios de
 * `security-tenant.md` a la vez (la lección de REG-340, en la raíz). Y
 * `RAIZ_EXCLUIDAS` no declaraba `googleTokens`: tras restaurar, cada médico
 * amanece sin Google Calendar y el acta no lo decía.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 * Auditor S-ciberseguridad (S-010) y AS-expedientes (ASE-017); el equipo rojo
 * corrigió el censo (`libro` es un fixture; falta `whatsapp_dedup`).
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 * 1. Toda colección de PRIMER NIVEL que aparezca en `adminDb.collection('…')`
 *    en `src/` está en `MATRIZ_ACCESO` (y por tanto tiene `match`), o en una
 *    lista de exenciones con motivo (hoy vacía).
 * 2. Todo `match` de raíz está en `COLECCIONES_RAIZ` o en `RAIZ_EXCLUIDAS`
 *    (con `platform_*` como comodín). Probado al revés con googleTokens.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 * Colecciones nombradas por variable (`adminDb.collection(NOMBRE)`): el censo
 * es literal. Las subcolecciones bajo `clinics/` las cubre
 * `lo-que-el-codigo-escribe-esta-declarado.test.ts`.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { MATRIZ_ACCESO, normalizarRuta } from '@/lib/authz/matriz-acceso'
import { COLECCIONES_RAIZ, RAIZ_EXCLUIDAS, LO_QUE_HAY_QUE_RECONECTAR_A_MANO } from '@/lib/clinica/respaldo'

const RAIZ = process.cwd()

function archivos(dir: string): string[] {
  const out: string[] = []
  for (const n of readdirSync(dir)) {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) { if (n !== '__tests__') out.push(...archivos(p)) }
    else if (/\.tsx?$/.test(n)) out.push(p)
  }
  return out
}

/** Colecciones RAÍZ que el servidor toca, por literal. */
function censoDelServidor(): Set<string> {
  const out = new Set<string>()
  for (const f of [...archivos(join(RAIZ, 'src/app')), ...archivos(join(RAIZ, 'src/lib'))]) {
    const src = readFileSync(f, 'utf8')
    for (const m of src.matchAll(/adminDb\.collection\('([A-Za-z_]+)'\)/g)) out.add(m[1])
  }
  return out
}

/**
 * Primer segmento de cada match de RAÍZ de la matriz.
 *
 * Se descartan las SUBcolecciones que cuelgan de `clinics/{clinicId}/…`, no el
 * consultorio mismo: `clinics/{clinicId}` son dos segmentos y es una raíz como
 * cualquier otra. Filtrar por `startsWith('clinics/')` a secas la dejaba fuera
 * y el censo declaraba huérfana la colección más escrita de todo el producto.
 */
function raicesDeclaradas(): Set<string> {
  return new Set(MATRIZ_ACCESO.map(r => r.ruta)
    .filter(r => !r.startsWith('{'))
    .filter(r => !(r.startsWith('clinics/') && r.split('/').length > 2))
    .map(r => r.split('/')[0]))
}

function cubiertaPorElRespaldo(nombre: string, excluidas: Record<string, string>): boolean {
  if (COLECCIONES_RAIZ.some(c => c.ruta === nombre)) return true
  if (excluidas[nombre]) return true
  return Object.keys(excluidas).some(k => k.endsWith('*') && nombre.startsWith(k.slice(0, -1)))
}

/** Exenciones del censo, con motivo. Hoy ninguna: todo lo que el servidor escribe en raíz tiene match. */
const EXENTAS_DEL_CENSO: Record<string, string> = {}

describe('S-010 · lo que el servidor escribe en la raíz está en la matriz', () => {
  const censo = censoDelServidor()
  const declaradas = raicesDeclaradas()

  it('el censo encuentra colecciones de verdad', () => {
    expect(censo.has('clinics')).toBe(true)
    expect(censo.has('whatsapp_channels')).toBe(true)
    expect(censo.size).toBeGreaterThan(15)
  })

  it('cada colección raíz que toca el Admin SDK tiene entrada en MATRIZ_ACCESO (o exención con motivo)', () => {
    const huerfanas = [...censo].filter(c => !declaradas.has(c) && !EXENTAS_DEL_CENSO[c]).sort()
    expect(huerfanas, `colecciones raíz sin match ni matriz: ${huerfanas.join(', ')}`).toEqual([])
  })

  it('las catorce del hallazgo (y la nueva de N-007) están declaradas', () => {
    for (const c of ['errores', 'soporte', 'rate_limits', 'oauthStates', 'transcript_owners', 'whatsapp_channels',
      'whatsapp_dedup', 'anticipos_procesados', 'recargas_procesadas', 'platform_config', 'platform_incidentes',
      'platform_heartbeats', 'platform_recargas', 'platform_csp', 'pruebas_estrenadas']) {
      expect(declaradas.has(c), c).toBe(true)
    }
  })

  it('las raíces sólo-servidor de la matriz están cerradas al cliente en las dos direcciones', () => {
    for (const r of MATRIZ_ACCESO) {
      if (r.ruta.startsWith('clinics/') || r.ruta.startsWith('{')) continue
      if (['clinic_members', 'clinic_invitations', 'clinic_review_requests'].some(p => r.ruta.startsWith(p))) continue
      expect(r.guardaLectura, r.ruta).toBe('servidor')
      expect(r.guardaEscritura, r.ruta).toBe('servidor')
    }
  })
})

describe('ASE-017 · todo match de raíz se respalda o se declara fuera', () => {
  const raices = [...raicesDeclaradas()].filter(r => r !== 'clinics')

  it('googleTokens y las demás están en COLECCIONES_RAIZ o en RAIZ_EXCLUIDAS', () => {
    const sinClasificar = raices.filter(r => !cubiertaPorElRespaldo(r, RAIZ_EXCLUIDAS))
    expect(sinClasificar, `raíces sin clasificar en el respaldo: ${sinClasificar.join(', ')}`).toEqual([])
    expect(RAIZ_EXCLUIDAS.googleTokens).toMatch(/credencial/i)
  })

  it('al revés: sin la entrada de googleTokens el guardián se pone rojo', () => {
    const { googleTokens: _fuera, ...sinGoogle } = RAIZ_EXCLUIDAS
    void _fuera
    expect(cubiertaPorElRespaldo('googleTokens', sinGoogle)).toBe(false)
    expect(cubiertaPorElRespaldo('platform_lo_que_sea', sinGoogle)).toBe(true)
  })

  it('el acta de restauración sabe qué hay que reconectar a mano', () => {
    const nombres = LO_QUE_HAY_QUE_RECONECTAR_A_MANO.map(x => x.coleccion)
    expect(nombres).toContain('googleTokens')
    expect(nombres).toContain('secretos')
    for (const x of LO_QUE_HAY_QUE_RECONECTAR_A_MANO) expect(x.accion.length).toBeGreaterThan(20)
  })

  it('cada entrada de MATRIZ_ACCESO sigue existiendo como match (la matriz no inventa raíces)', () => {
    const reglas = readFileSync(join(RAIZ, 'firestore.rules'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
    for (const r of raices) expect(reglas, r).toMatch(new RegExp(`match /${r}/\\{`))
    expect(normalizarRuta('pruebas_estrenadas/{huella}')).toBe('pruebas_estrenadas/{}')
  })
})
