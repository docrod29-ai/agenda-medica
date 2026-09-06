/**
 * GOLDEN — la «O» de ARCO se resolvía con un `prompt()` y no apagaba nada.
 *
 * ── EL DEFECTO ───────────────────────────────────────────────────────────────
 *
 * La pantalla de Cumplimiento aceptaba solicitudes de Oposición y las «resolvía»
 * escribiendo un texto libre: la solicitud pasaba a «resuelta», el plazo de 20
 * días hábiles se daba por cumplido, y **el paciente seguía recibiendo
 * recordatorios**.
 *
 * Lo que lo vuelve grave es la comparación: el paciente que contestaba «BAJA»
 * por WhatsApp SÍ dejaba de recibir mensajes, porque ese camino llama a
 * `registrarBaja`. El que ejercía su derecho por la vía formal —por escrito, en
 * el portal, con plazo legal— era el único al que no se le atendía.
 *
 * Se encontró verificando que la «A» y la «C» sí estuvieran cerradas.
 *
 * ── LA REPARACIÓN ────────────────────────────────────────────────────────────
 *
 * `POST /api/arco/oponerse` registra la baja del teléfono —el candado que el
 * envío proactivo ya consulta en cada mensaje—, marca el expediente, cierra la
 * solicitud y lo asienta en la bitácora.
 *
 * ── LO QUE ESTE GOLDEN VIGILA POR ENCIMA DE TODO ─────────────────────────────
 *
 * Que esté **conectado**. Una ruta perfecta que nadie llama es exactamente el
 * defecto anterior con más código: la solicitud se seguiría resolviendo con el
 * `prompt()` y nadie lo notaría hasta que un paciente reclamara.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { planDeOposicion, marcaDeOposicion, FINES, TODOS_LOS_FINES } from '@/lib/arco/oposicion'

const leer = (r: string) => readFileSync(join(process.cwd(), r), 'utf8')

describe('EL PLAN: qué se apaga y qué sólo se registra', () => {
  it('sin fines declarados se asume el contacto proactivo', () => {
    /**
     * El formulario público es texto libre: casi siempre dice «que ya no me
     * manden mensajes». Asumir el más protector para el titular es la lectura
     * correcta, y aquí ningún camino es irreversible: se puede dar de alta.
     */
    const p = planDeOposicion(undefined)
    expect(p.fines).toEqual(['contacto_proactivo'])
    expect(p.requiereBajaContacto).toBe(true)
  })

  it('el contacto proactivo es ejecutable porque hay un candado real', () => {
    // La baja se consulta POR TELÉFONO en cada envío proactivo.
    expect(FINES.contacto_proactivo.ejecutable).toBe(true)
    expect(planDeOposicion(['contacto_proactivo']).requiereBajaContacto).toBe(true)
  })

  it('las promociones NO se declaran apagadas, porque nada las apaga', () => {
    /**
     * No hay motor de campañas que cerrar. Marcarlo ejecutable haría que el
     * médico leyera «listo» sobre algo que ningún código detiene.
     */
    const p = planDeOposicion(['mercadotecnia'])
    expect(p.requiereBajaContacto).toBe(false)
    expect(p.soloRegistrados).toEqual(['mercadotecnia'])
    expect(p.avisos).toHaveLength(1)
  })

  it('y lo no ejecutable SIEMPRE viene con su aviso: nunca se calla', () => {
    for (const f of TODOS_LOS_FINES) {
      const p = planDeOposicion([f])
      if (!FINES[f].ejecutable) expect(p.avisos.length).toBeGreaterThan(0)
    }
  })

  it('una mezcla ejecuta lo que puede y declara lo que no', () => {
    const p = planDeOposicion(['contacto_proactivo', 'compartir_terceros'])
    expect(p.requiereBajaContacto).toBe(true)
    expect(p.soloRegistrados).toEqual(['compartir_terceros'])
  })

  it('un fin inventado se ignora, no se acepta a ciegas', () => {
    expect(planDeOposicion(['borrar_todo']).fines).toEqual(['contacto_proactivo'])
  })

  it('los repetidos no duplican', () => {
    expect(planDeOposicion(['encuestas', 'encuestas']).fines).toEqual(['encuestas'])
  })
})

describe('LA MARCA ACUMULA — oponerse a algo nuevo no borra lo anterior', () => {
  it('conserva los fines previos', () => {
    /**
     * Si sustituyera, una segunda solicitud reactivaría en silencio lo que el
     * paciente ya había frenado.
     */
    const m = marcaDeOposicion({
      ahoraMs: 1, uid: 'u1', fines: ['mercadotecnia'], previos: ['contacto_proactivo'],
    })
    expect(m.fines).toContain('contacto_proactivo')
    expect(m.fines).toContain('mercadotecnia')
  })

  it('y descarta basura guardada previamente sin romperse', () => {
    const m = marcaDeOposicion({ ahoraMs: 1, uid: 'u1', fines: ['encuestas'], previos: ['xxx'] })
    expect(m.fines).toEqual(['encuestas'])
  })
})

describe('LA RUTA EJECUTA DE VERDAD', () => {
  const ruta = leer('src/app/api/arco/oponerse/route.ts')

  it('registra la baja del contacto, que es lo que muerde hoy', () => {
    expect(ruta).toContain("registrarBaja(clinicId, tel, 'arco_oposicion')")
  })

  it('trata el `false` de la baja como fallo, no sólo la excepción', () => {
    /**
     * `registrarBaja` devuelve false cuando NO persistió. Quedarse sólo con el
     * `catch` dejaría pasar ese false como éxito — el mismo engaño que esta
     * ruta existe para no repetir.
     */
    expect(ruta).toContain('if (!bajaRegistrada)')
    expect(ruta).toContain('.catch(() => false)')
  })

  it('exige acreditar al titular antes de ejecutar', () => {
    expect(ruta).toContain('body.identidadVerificada !== true')
  })

  it('cierra la solicitud: el plazo de 20 días no sigue corriendo', () => {
    expect(ruta).toContain("estado: 'resuelta'")
  })

  it('y lo asienta en la bitácora', () => {
    expect(ruta).toContain("evento: 'arco_solicitud_resuelta'")
  })
})

describe('ESTÁ CONECTADO — lo que más veces ha faltado', () => {
  const pagina = leer('src/app/(dashboard)/cumplimiento/page.tsx')

  it('resolver una oposición llama a la ruta, no al `prompt()`', () => {
    expect(pagina).toContain("req.tipo === 'oposicion' && estado === 'resuelta'")
    expect(pagina).toContain('/api/arco/oponerse')
  })

  it('y el `prompt()` ya no existe: no hay «antes» que discutir', () => {
    /**
     * Este caso pedía que la ejecución saliera ANTES del `prompt()`: si el
     * `prompt()` quedaba arriba, el médico escribía un texto y la ruta no
     * llegaba a correr — el defecto entero, intacto, con código nuevo detrás.
     *
     * C-007 (Panel de Lujo 2026-09) retiró el `prompt()` de la pantalla: era el
     * último de `src/app` fuera de comentarios, y sin foco atrapado ni Escape.
     * La garantía que este caso protegía se vuelve más fuerte, no más débil —
     * ya no hay que ordenar dos caminos, hay uno—, así que se afirma lo que
     * ahora es cierto: la ejecución existe y el `prompt()` no. El diálogo que
     * lo sustituye tiene su propio golden en
     * `una-solicitud-arco-real-se-puede-ejecutar.test.ts`.
     */
    const iOpo = pagina.indexOf("req.tipo === 'oposicion' && estado === 'resuelta'")
    expect(iOpo).toBeGreaterThan(0)
    const sinComentarios = pagina.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    expect(sinComentarios, 'volvió un prompt() nativo a la pantalla').not.toMatch(/\bprompt\s*\(/)
  })

  it('la ruta está declarada en el registro de autorización', () => {
    // Una ruta sin declarar la rechaza el guardián de authz.
    expect(leer('src/lib/authz/registro-rutas.ts')).toContain("'arco/oponerse'")
  })
})
