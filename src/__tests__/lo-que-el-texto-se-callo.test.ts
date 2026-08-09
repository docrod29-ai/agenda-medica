/**
 * LO QUE EL TEXTO SE CALLÓ — REG-259.
 *
 * ── EL OTRO MODO DE FALLO, Y EL MÁS SILENCIOSO ──────────────────────────────
 *
 * `validarRazonamiento` ya cazaba lo que el modelo dice y **contradice** al
 * motor determinista: recomendar un antibiótico al que el organismo es
 * intrínsecamente resistente, por ejemplo.
 *
 * No cazaba lo que el modelo **omite**. El motor detecta una carbapenemasa, el
 * texto del modelo no la menciona, y el médico lee un razonamiento que se lee
 * impecable y **no dice lo único que había que decir**.
 *
 * Contradecir es ruidoso: choca con lo que hay al lado. Omitir no choca con
 * nada — por eso hace falta un motor que lo busque.
 *
 * ── LA FUNCIÓN EXISTÍA ──────────────────────────────────────────────────────
 *
 *     src/lib/expediente/antibiograma/validar-razonamiento.ts::omiteAlertasCriticas
 *
 * Escrita, con su prueba, y sin un solo llamador. Cuarta cosecha del
 * instrumento de REG-255.
 *
 * ── LO QUE NO SE HACE ───────────────────────────────────────────────────────
 *
 * No se reescribe el texto ni se le añade la alerta que falta. Se **avisa**, y
 * las alertas del motor ya están arriba, enteras. Completar el razonamiento del
 * modelo por cuenta propia sería inventar juicio clínico — y este proyecto no
 * cruza esa línea ni cuando sería cómodo.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { omiteAlertasCriticas } from '@/lib/expediente/antibiograma/validar-razonamiento'
import type { InterpretacionAntibiograma } from '@/lib/expediente/antibiograma/tipos'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')
const ruta = leer('src', 'app', 'api', 'expediente', 'antibiograma-razonar', 'route.ts')
const page = leer('src/app/(dashboard)/antibiograma/page.tsx')

const conAlerta = (mensaje: string) => ({
  alertas: [{ nivel: 'critica', mensaje }],
} as unknown as InterpretacionAntibiograma)

describe('el motor, medido', () => {
  it('caza el texto que se calla una alerta crítica', () => {
    const interp = conAlerta('Carbapenemasa probable: confirmar y notificar')
    const texto = 'Aislamiento sensible a varios agentes. Se sugiere continuar el esquema actual.'
    expect(omiteAlertasCriticas(texto, interp)).toBe(true)
  })

  it('y NO se queja si el texto sí la menciona', () => {
    const interp = conAlerta('Carbapenemasa probable: confirmar y notificar')
    const texto = 'El perfil sugiere carbapenemasa; hay que confirmarla antes de decidir.'
    expect(omiteAlertasCriticas(texto, interp)).toBe(false)
  })

  it('sin alertas críticas no hay nada que omitir', () => {
    /** Un aviso que salta cuando no hay nada que avisar es ruido. */
    expect(omiteAlertasCriticas('cualquier texto', { alertas: [] } as unknown as InterpretacionAntibiograma)).toBe(false)
  })
})

describe('CORRE en la ruta de razonamiento', () => {
  it('la ruta lo importa y lo llama para los DOS modelos', () => {
    expect(ruta).toContain('validarRazonamiento, omiteAlertasCriticas')
    expect(ruta).toMatch(/const omitidas = omiteAlertasCriticas\(rc\.texto, interp\)/)
    expect(ruta).toMatch(/const omitidasGPT = gptTexto \? omiteAlertasCriticas\(gptTexto, interp\) : false/)
  })

  it('y lo manda al cliente', () => {
    expect(ruta).toMatch(/omiteAlertasCriticas: true/)
    expect(ruta).toMatch(/omiteAlertasCriticasSegundaOpinion: true/)
  })

  it('la segunda opinión NO se queda sin revisar', () => {
    /**
     * Ya pasó una vez: `contradiccionesSegundaOpinion` viajaba del servidor y
     * el cliente la tiraba, así que la segunda opinión se enseñaba sin su caja
     * roja. No se repite con las omisiones.
     */
    expect(page).toMatch(/omiteSegunda: data\.omiteAlertasCriticasSegundaOpinion/)
  })
})

describe('el aviso dice qué pasó, no sólo que pasó algo', () => {
  it('distingue omitir de contradecir', () => {
    /**
     * Son dos cosas distintas y el médico decide distinto: una le dice que el
     * texto está equivocado, la otra que está incompleto.
     */
    expect(page).toMatch(/no menciona las alertas críticas del motor/)
    expect(page).toMatch(/No las contradice: las omite/)
  })

  it('en ámbar, no en rojo', () => {
    /**
     * El rojo está reservado para la contradicción, que es peor. Si todo grita
     * igual, nada se oye — la lección de REG-245.
     */
    const bloque = page.slice(page.indexOf('LO QUE EL TEXTO SE CALLÓ'), page.indexOf('razonamiento.texto}</p>'))
    expect(bloque).toMatch(/var\(--amber\)/)
    expect(bloque).not.toMatch(/var\(--red\)/)
  })
})

describe('no se cruza la línea', () => {
  it('el texto del modelo NO se completa ni se reescribe', () => {
    /**
     * Añadirle la alerta que falta sería poner en boca del modelo un juicio
     * que no hizo. Se avisa; las alertas del motor están arriba, enteras.
     */
    expect(ruta).toMatch(/No se reescribe el texto ni se le añade nada/)
    const bloque = ruta.slice(ruta.indexOf('const omitidas ='), ruta.indexOf('void registrarCreditos'))
    expect(bloque).not.toMatch(/rc\.texto\s*=|texto\s*\+=/)
  })
})
