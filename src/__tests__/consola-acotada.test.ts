/**
 * GOLDEN — la página por omisión del panel dejó de escanear tablas enteras, y el
 * recorte se ve.
 *
 * ── EL FALLO ─────────────────────────────────────────────────────────────────
 *
 * La consola del dueño hacía esto, en las dos pantallas que se abren primero:
 *
 *     adminDb.collection('clinics').get(),
 *     adminDb.collection('platform_payments').get(),
 *
 * **Sin `limit`, sin `where`.** `platform_payments` crece un documento por cada
 * cargo de Stripe, **para siempre**. Y después, dentro del `map`, una lectura
 * más de `secretos/ia` **por cada consultorio**: un N+1 sobre una lista sin
 * techo.
 *
 * Es la página por omisión del panel: la primera que daría *timeout*.
 *
 * ── LA TRAMPA DE ARREGLARLO ──────────────────────────────────────────────────
 *
 * Poner un `limit` y ya está convierte «ingreso histórico» en «ingreso de lo que
 * cupo», con el mismo nombre y el mismo aspecto. **Un recorte que nadie ve se
 * lee como el total** — y sobre ese número se toman decisiones de precio.
 *
 * Es el mismo fallo que esta sesión lleva persiguiendo desde el `limit(60)` de
 * la lista de espera. Por eso el alcance viaja en la respuesta y la pantalla lo
 * enseña.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  desdeVentana, alcanceDePagos, alcanceDeClinicas,
  MESES_VENTANA, TOPE_CLINICAS, TOPE_PAGOS, POR_QUE_SE_DEVUELVE_EL_ALCANCE,
} from '@/lib/ops/alcance'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')
const clientes = leer('src', 'app', 'api', 'superadmin', 'clientes', 'route.ts')
const contabilidad = leer('src', 'app', 'api', 'superadmin', 'contabilidad', 'route.ts')
const panel = leer('src', 'app', 'superadmin', 'page.tsx')

describe('la ventana', () => {
  it('son doce meses hacia atrás', () => {
    const ahora = Date.parse('2026-08-03T12:00:00.000Z')
    const d = new Date(desdeVentana(ahora))
    expect(d.getUTCFullYear()).toBe(2025)
    expect(d.getUTCMonth()).toBe(7) // agosto
    expect(MESES_VENTANA).toBe(12)
  })

  it('cubre el año fiscal y la comparación interanual, que es para lo que se mira', () => {
    // El histórico completo vive en Stripe, que es su sitio: la consola no es el
    // libro mayor.
    expect(MESES_VENTANA).toBeGreaterThanOrEqual(12)
  })
})

describe('el alcance dice la verdad', () => {
  it('cuando NO se recortó, lo dice sin alarmar', () => {
    const a = alcanceDePagos('2025-08-03T00:00:00.000Z', 120)
    expect(a.recortado).toBe(false)
    expect(a.etiqueta).toBe('últimos 12 meses')
  })

  it('cuando SÍ se recortó, lo GRITA', () => {
    /**
     * «Faltan datos» tiene que estar en la etiqueta, no en un campo booleano que
     * la pantalla podría no leer.
     */
    const a = alcanceDePagos('2025-08-03T00:00:00.000Z', TOPE_PAGOS)
    expect(a.recortado).toBe(true)
    expect(a.etiqueta).toMatch(/SE ALCANZÓ EL TOPE/)
    expect(a.etiqueta).toMatch(/faltan datos/)
  })

  it('lo mismo con la lista de consultorios', () => {
    expect(alcanceDeClinicas(10).recortado).toBe(false)
    expect(alcanceDeClinicas(TOPE_CLINICAS).recortado).toBe(true)
    expect(alcanceDeClinicas(TOPE_CLINICAS).etiqueta).toMatch(/hay más que no se están enseñando/)
  })

  it('está escrito por qué el alcance viaja', () => {
    expect(POR_QUE_SE_DEVUELVE_EL_ALCANCE).toMatch(/decisiones de precio/)
  })
})

describe('las dos rutas ya no escanean tablas enteras', () => {
  for (const [nombre, src] of [['clientes', clientes], ['contabilidad', contabilidad]] as const) {
    it(`${nombre}: ninguna lectura sin cota`, () => {
      const codigo = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '')
      expect(codigo, nombre).not.toContain("adminDb.collection('clinics').get()")
      expect(codigo, nombre).not.toContain("adminDb.collection('platform_payments').get()")
    })

    it(`${nombre}: los cobros van por ventana y con tope`, () => {
      expect(src, nombre).toContain("where('fecha', '>=', desde")
      expect(src, nombre).toContain('limit(TOPE_PAGOS)')
    })

    it(`${nombre}: devuelve el alcance`, () => {
      expect(src, nombre).toContain('alcance')
      expect(src, nombre).toContain('alcanceDePagos(')
    })
  }
})

describe('el N+1 por consultorio desapareció', () => {
  it('las lecturas de `secretos/ia` van en UNA sola ida', () => {
    /**
     * Estaban dentro del `map`: una ida y vuelta por consultorio, sobre una
     * lista que además no tenía techo. `getAll` las hace todas de golpe — misma
     * información, fracción de la latencia.
     */
    expect(clientes).toContain('adminDb.getAll(...refsIA)')
    const codigo = clientes.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '')
    expect(codigo).not.toContain('await adminDb.doc(`clinics/${cid}/secretos/ia`).get()')
  })

  it('y si la lectura en bloque falla, no tumba la pantalla', () => {
    // El nivel de IA es un adorno de la fila; la lista de clientes no.
    expect(clientes).toContain('.catch(() => [])')
  })
})

describe('el número dejó de llamarse como no es', () => {
  it('«ingresoTotal» pasó a «ingresoVentana» en la API', () => {
    /**
     * El nombre cambia con el dato. Dejarlo llamarse `ingresoTotal` mientras se
     * calcula sobre doce meses es exactamente el recorte silencioso que esto
     * viene a evitar.
     */
    expect(clientes).toContain('ingresoVentana: ingresoTotal')
  })

  it('y la pantalla enseña de cuándo a cuándo', () => {
    expect(panel).toContain('Ingreso cobrado')
    expect(panel).toContain('alcance?.cobros.etiqueta')
  })

  it('la pantalla avisa si la lista de consultorios se cortó', () => {
    // Una lista que se corta en silencio se lee como «ésos son todos», y sobre
    // esa lectura se decide a quién llamar.
    expect(panel).toContain('alcance?.consultorios.recortado')
    expect(panel).toContain('Hay más consultorios que no')
  })

  it('y el CSV que se le manda al contador también lo dice', () => {
    const csv = leer('src', 'app', 'superadmin', 'contabilidad', 'page.tsx')
    expect(csv).toContain('ALCANCE,')
    expect(csv).toContain('Ingreso cobrado (')
    expect(csv).not.toContain('MRR,Ingreso histórico,')
  })
})
