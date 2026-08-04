/**
 * GOLDEN — el saldo de los proveedores de IA se vigila, y AssemblyAI ya cuesta.
 *
 * ── LO QUE PIDIÓ EL DR. (3-ago-2026) ─────────────────────────────────────────
 *
 * «Implementa en los paquetes y en los costos todo lo de AssemblyAI, y estar al
 * pendiente cuánto saldo tengo, para estarle abonando y los clientes no se
 * queden sin IA.»
 *
 * ── LO QUE ESTABA MAL ────────────────────────────────────────────────────────
 *
 * 1. **AssemblyAI no tenía tarifa.** Cada transcripción diarizada entraba al
 *    libro de costos con `costoUsd: null` y salía por «sin tarifa». O sea: el
 *    renglón que corre en TODAS las consultas era invisible en el margen. El
 *    propio código lo decía —«cargar el precio real es un pendiente declarado,
 *    no un olvido»—, y ahí seguía.
 *
 * 2. **Y los minutos tampoco viajaban.** El costo se anotaba en el POST, que
 *    sólo encola: la duración del audio no se sabe hasta que el trabajo termina.
 *    Un precio por minuto sin minutos habría dado cero, que es peor que `null`
 *    porque parece un dato.
 *
 * 3. **Nadie miraba el saldo.** Si la cuenta de AssemblyAI llega a cero, TODAS
 *    las consultas pierden la separación de voces a la vez — y desde la v973 se
 *    avisa, pero se avisa DESPUÉS, con el paciente ya enfrente.
 *
 * ── POR QUÉ EL SALDO SE LLEVA Y NO SE CONSULTA ───────────────────────────────
 *
 * Se buscó en su referencia de API: no existe endpoint de saldo ni de consumo.
 * Así que el dueño anota lo que abona y el libro de costos aporta lo gastado.
 * Eso además sirve igual para los tres proveedores, con un solo aviso.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  saldoDe, avisoDeSaldo, DIAS_AVISO, DIAS_CRITICO,
  POR_QUE_SE_LLEVA_Y_NO_SE_CONSULTA, POR_QUE_SE_LLAMA_ESTIMADO, POR_QUE_EL_UMBRAL_ES_EN_DIAS,
  type Recarga,
} from '@/lib/finanzas/saldo-proveedores'
import { TARIFAS, costoUsd } from '@/lib/finanzas/precios-modelo'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')

describe('1. ASSEMBLYAI YA TIENE PRECIO', () => {
  it('el modelo que se usa de verdad está tarifado', () => {
    /**
     * La app pide `speech_model: 'best'`, que AssemblyAI enruta a
     * Universal-3.5 Pro. Se tarifan los dos nombres: el que mandamos y el que
     * puede acabar registrándose.
     */
    for (const m of ['best', 'universal-3-pro']) {
      const t = TARIFAS.find(x => x.modelo === m)
      expect(t, m).toBeDefined()
      expect(t!.usdPorMinuto, m).toBeGreaterThan(0)
    }
  })

  it('el precio trae su fuente y la fecha en que se consultó', () => {
    // Una tarifa sin fuente es una cifra de memoria, que es exactamente lo que
    // esta sesión lleva toda la noche desmontando.
    const t = TARIFAS.find(x => x.modelo === 'best')!
    expect(t.fuente).toMatch(/assemblyai\.com\/pricing/)
    expect(t.consultado).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('y una consulta real ya no sale en cero ni en «sin tarifa»', () => {
    // Doce minutos, la duración de la consulta que falló en producción.
    const c = costoUsd('best', { entrada: 0, salida: 0, minutosAudio: 12 })
    expect(c.motivo).toBeUndefined()
    expect(c.usd).not.toBeNull()
    expect(c.usd!).toBeGreaterThan(0)
    // $0.23/hora → doce minutos son unos 4.6 centavos. Se comprueba el orden de
    // magnitud, no la cifra exacta: la exacta es la del proveedor, no la mía.
    expect(c.usd!).toBeLessThan(0.10)
  })

  it('NEEDS_CLINICAL_REVIEW no aplica aquí: es un precio publicado, no una cifra clínica', () => {
    // Se deja dicho para que nadie lo confunda con los umbrales que sí exigen
    // validación del Dr.: éste se lee de la página del proveedor y se cita.
    expect(leer('src', 'lib', 'finanzas', 'precios-modelo.ts')).toContain('https://www.assemblyai.com/pricing')
  })
})

describe('2. LOS MINUTOS VIAJAN, Y VIAJAN DONDE SE SABEN', () => {
  const ruta = leer('src', 'app', 'api', 'expediente', 'transcribir-diarizado', 'route.ts')

  it('el costo se anota al TERMINAR, no al encolar', () => {
    /**
     * El POST sólo encola: ahí la duración del audio todavía no existe. Anotar
     * el costo entonces habría dado cero minutos — un renglón que parece dato y
     * es un hueco.
     */
    const get = ruta.slice(ruta.indexOf('export async function GET'))
    expect(get).toContain('anotarLlamada')
    expect(get).toContain('duracionSeg')
  })

  it('la duración sale de lo que dice AssemblyAI, no de una estimación nuestra', () => {
    expect(ruta).toContain('audio_duration')
  })
})

describe('3. EL SALDO: aritmética que no inventa', () => {
  const R = (montoUsd: number): Recarga[] => [{ proveedor: 'assemblyai', montoUsd, fecha: '2026-07-01' }]

  it('resta lo gastado de lo abonado', () => {
    const s = saldoDe('assemblyai', R(50), { proveedor: 'assemblyai', usdGastado: 20, diasMedidos: 30 })
    expect(s.restanteUsd).toBeCloseTo(30)
    expect(s.usdPorDia).toBeCloseTo(20 / 30)
  })

  it('proyecta los días que aguanta al ritmo medido', () => {
    // $30 restantes a $1/día = 30 días.
    const s = saldoDe('assemblyai', R(60), { proveedor: 'assemblyai', usdGastado: 30, diasMedidos: 30 })
    expect(s.diasRestantes).toBe(30)
    expect(s.nivel).toBe('ok')
  })

  it('avisa ANTES de que se acabe, no cuando se acabó', () => {
    // $9 restantes a $1/día = 9 días → dentro de la ventana de aviso.
    const s = saldoDe('assemblyai', R(39), { proveedor: 'assemblyai', usdGastado: 30, diasMedidos: 30 })
    expect(s.diasRestantes).toBe(9)
    expect(s.nivel).toBe('avisar')
    expect(DIAS_AVISO).toBeGreaterThan(DIAS_CRITICO)
  })

  it('y sube a crítico cuando quedan pocos días', () => {
    const s = saldoDe('assemblyai', R(33), { proveedor: 'assemblyai', usdGastado: 30, diasMedidos: 30 })
    expect(s.nivel).toBe('critico')
  })

  it('cero o menos es «agotado», sin proyectar nada', () => {
    const s = saldoDe('assemblyai', R(30), { proveedor: 'assemblyai', usdGastado: 30, diasMedidos: 30 })
    expect(s.nivel).toBe('agotado')
  })

  it('SIN ABONOS REGISTRADOS no se declara agotado', () => {
    /**
     * El defecto más fácil de cometer aquí: un consultorio que aún no ha anotado
     * ningún abono tendría `cargado = 0` y saldría en rojo con la cuenta del
     * proveedor llena. Un aviso falso enseña a ignorar los avisos, que deja peor
     * que no tenerlos.
     */
    const s = saldoDe('assemblyai', [], { proveedor: 'assemblyai', usdGastado: 12, diasMedidos: 30 })
    expect(s.nivel).toBe('ok')
    expect(s.diasRestantes).toBeNull()
    expect(avisoDeSaldo(s)).toBeNull()
  })

  it('sin gasto medido no se proyecta una fecha inventada', () => {
    const s = saldoDe('assemblyai', R(50), null)
    expect(s.usdPorDia).toBeNull()
    expect(s.diasRestantes).toBeNull()
    expect(s.nivel).toBe('ok')
  })

  it('las recargas de OTRO proveedor no cuentan', () => {
    const s = saldoDe('assemblyai', [{ proveedor: 'anthropic', montoUsd: 500, fecha: '2026-07-01' }], null)
    expect(s.cargadoUsd).toBe(0)
  })
})

describe('EL AVISO dice qué se rompe, no sólo que falta dinero', () => {
  it('el de AssemblyAI nombra lo que se pierde', () => {
    const s = saldoDe('assemblyai', [{ proveedor: 'assemblyai', montoUsd: 31, fecha: '2026-07-01' }],
      { proveedor: 'assemblyai', usdGastado: 30, diasMedidos: 30 })
    const a = avisoDeSaldo(s)!
    expect(a).toMatch(/separación de voces/)
    expect(a).toMatch(/estimado/)
  })

  it('un aviso sin acción no es un aviso', () => {
    const s = saldoDe('anthropic', [{ proveedor: 'anthropic', montoUsd: 10, fecha: '2026-07-01' }],
      { proveedor: 'anthropic', usdGastado: 30, diasMedidos: 30 })
    expect(avisoDeSaldo(s)).toMatch(/Abona ya/)
  })
})

describe('LAS RAZONES ESTÁN ESCRITAS, no sólo el código', () => {
  it('por qué se lleva y no se consulta', () => {
    expect(POR_QUE_SE_LLEVA_Y_NO_SE_CONSULTA).toMatch(/no publica endpoint de saldo/)
  })
  it('por qué se llama estimado', () => {
    expect(POR_QUE_SE_LLAMA_ESTIMADO).toMatch(/tablero en verde/)
  })
  it('por qué el umbral es en días y no en dólares', () => {
    expect(POR_QUE_EL_UMBRAL_ES_EN_DIAS).toMatch(/un mes para un consultorio y dos días para veinte/)
  })
})

describe('EL SALDO ESTÁ CONECTADO — no es otro módulo escrito y sin usar', () => {
  it('el vigilante lo mira cada vez que corre', () => {
    const v = leer('src', 'app', 'api', 'cron', 'vigilante', 'route.ts')
    expect(v).toContain('saldosDeProveedores')
    expect(v).toContain('avisoDeSaldo')
    expect(v).toContain('enviarAlertaOps')
  })

  it('y el aviso sale por el mismo canal que las demás alertas de operación', () => {
    // Un canal nuevo sería un canal más que vigilar; y el que ya existe está
    // probado por el guardián del vigilante.
    const v = leer('src', 'app', 'api', 'cron', 'vigilante', 'route.ts')
    expect(v).toMatch(/origen: 'cron\/vigilante'/)
  })

  it('la consola de costos lo muestra', () => {
    const page = leer('src', 'app', 'superadmin', 'costos', 'page.tsx')
    expect(page).toContain('Saldo con los proveedores de IA')
    expect(page).toContain('avisoDeSaldo')
  })

  it('y el dueño puede registrar el abono SIN tocar Firestore a mano', () => {
    /**
     * Un saldo que sólo se puede alimentar editando documentos en la consola de
     * Google es un saldo que nadie alimenta — y entonces el aviso nunca dispara
     * y la pantalla queda en verde para siempre.
     */
    const page = leer('src', 'app', 'superadmin', 'costos', 'page.tsx')
    expect(page).toContain('Registrar abono')
    expect(leer('src', 'app', 'api', 'superadmin', 'costos', 'route.ts')).toContain('export async function POST')
  })
})

describe('EL REGISTRO DE ABONOS se protege como lo que es: dinero', () => {
  const ruta = leer('src', 'app', 'api', 'superadmin', 'costos', 'route.ts')

  it('sólo el dueño de la plataforma', () => {
    const post = ruta.slice(ruta.indexOf('export async function POST'))
    expect(post).toContain('verificarSuperadmin')
  })

  it('no se acepta un proveedor cualquiera', () => {
    expect(ruta).toContain('PROVEEDORES_VIGILADOS.includes')
  })

  it('ni un monto negativo, que bajaría el saldo sin que nadie gastara', () => {
    const post = ruta.slice(ruta.indexOf('export async function POST'))
    expect(post).toMatch(/montoUsd <= 0/)
  })

  it('la colección quedó DECIDIDA en el manifiesto de retención', () => {
    // El guardián de retención lo exige, y con razón: es contabilidad.
    expect(leer('src', 'lib', 'ops', 'retencion.ts')).toContain('platform_recargas')
  })
})

describe('LO GASTADO NO SE REDONDEA HACIA ABAJO', () => {
  it('los asientos sin costo NO se suman como cero', () => {
    /**
     * Si un modelo sin tarifa contara como $0, el gasto se vería menor del real
     * y el aviso llegaría tarde — el único fallo que este módulo no se puede
     * permitir.
     */
    const s = leer('src', 'lib', 'finanzas', 'saldo-servidor.ts')
    expect(s).toMatch(/if \(typeof e\.costoUsd !== 'number'\) continue/)
    expect(s).toMatch(/NO se cuentan como cero/)
  })
})
