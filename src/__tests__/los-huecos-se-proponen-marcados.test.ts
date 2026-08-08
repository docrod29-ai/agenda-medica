/**
 * LOS HUECOS SE PROPONEN, MARCADOS Y SÓLO AL FINAL — REG-228 · I-6 del loop.
 *
 * ── LO QUE EL MÉDICO PIDIÓ ──────────────────────────────────────────────────
 *
 * «dejas espacios porque la inteligencia no entendió» · «no me gusta nada, deja
 * dudas». Preguntado qué prefería, eligió —leyendo la advertencia de que eso
 * inventa contenido clínico— **«que la IA lo complete con lo que sea probable»**.
 *
 * ── CÓMO SE HACE SIN QUE SEA UNA FALSIFICACIÓN ──────────────────────────────
 *
 * Se hace: se completa. Pero **marcado y sin entrar solo**.
 *
 * Una nota es un documento legal con su cédula. Si dice «niega tabaquismo» y el
 * paciente nunca lo dijo, **eso lo afirmó él**. La diferencia entre completar y
 * falsificar es que lo propuesto se vea, se pueda juzgar, y entre con un toque.
 *
 * ── LAS DOS FRONTERAS ───────────────────────────────────────────────────────
 *
 * **1. SÓLO EN EL PASE FINAL.** La nota se estructura sola cada 15 segundos, y
 * la primera pasada ocurre cuando apenas se dictó la ficha de identificación.
 * Con la propuesta activa ahí, esa pasada rellenaría la consulta entera antes de
 * que el médico dijera una palabra clínica. Eso ya pasó una vez, con la regla
 * vieja que escribía «No referido» en todo (REG-217), y fue el defecto más caro
 * de aquella noche.
 *
 * Durante la consulta, un apartado vacío sigue diciendo lo que dice: que falta.
 *
 * **2. NINGUNA CIFRA.** Una sección propuesta se lee, se juzga y se acepta o se
 * borra. Una CIFRA propuesta —una tensión, un peso, una creatinina— **se lee
 * exactamente igual que una medida real**, y a partir de ahí ya nadie puede
 * distinguirlas. Si un apartado sólo se podría llenar con cifras, se queda
 * vacío: es lo honesto.
 *
 * Ésa es la frontera entre completar y falsificar, y por eso está escrita dos
 * veces —en la regla y en el bloque— a propósito.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { buildSystemPrompt } from '@/lib/expediente/prompts'
import { MARCA_SUGERENCIA, sugerenciasPendientes } from '@/lib/expediente/sugerencias-ia'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')

describe('la propuesta se activa sólo cuando se pide', () => {
  it('sin opciones, el prompt NO trae el bloque', () => {
    const p = buildSystemPrompt('primera_vez')
    expect(p).not.toContain('COMPLETA LOS APARTADOS VACÍOS')
  })

  it('con proponerHuecos:false tampoco', () => {
    const p = buildSystemPrompt('primera_vez', 'Medicina Interna', undefined, { proponerHuecos: false })
    expect(p).not.toContain('COMPLETA LOS APARTADOS VACÍOS')
  })

  it('con proponerHuecos:true sí', () => {
    const p = buildSystemPrompt('primera_vez', 'Medicina Interna', undefined, { proponerHuecos: true })
    expect(p).toContain('COMPLETA LOS APARTADOS VACÍOS')
  })

  it('la regla 15-bis está siempre escrita, pero declara que depende del bloque', () => {
    // La regla vive en el prompt base; lo que la enciende es el bloque. Así el
    // modelo no ve una regla contradictoria: ve una regla condicionada.
    const p = buildSystemPrompt('primera_vez')
    expect(p).toContain('15-bis.')
    expect(p).toMatch(/SÓLO SI SE TE PIDE/)
    expect(p).toMatch(/Si no está, manda la 15: la sección va VACÍA/)
  })
})

describe('las dos fronteras están escritas', () => {
  const conBloque = buildSystemPrompt('primera_vez', undefined, undefined, { proponerHuecos: true })

  it('todo lo propuesto va marcado, sin una sola línea suelta', () => {
    expect(conBloque).toContain(MARCA_SUGERENCIA)
    expect(conBloque).toMatch(/TODAS sus líneas empezando por/)
    expect(conBloque).toMatch(/Ni una línea sin marcar/)
  })

  it('PROHIBIDO proponer cifras, y dice cuáles', () => {
    expect(conBloque).toMatch(/PROHIBIDO proponer CIFRAS/)
    for (const cifra of ['tensión', 'frecuencia', 'temperatura', 'peso', 'talla', 'saturación', 'laboratorio']) {
      expect(conBloque, `falta «${cifra}» en la lista de cifras prohibidas`).toContain(cifra)
    }
  })

  it('y si un apartado sólo se podría llenar con cifras, se deja VACÍO', () => {
    expect(conBloque).toMatch(/DÉJALO VACÍO — es lo honesto/)
  })

  it('lo dictado no se completa: la 15 y la 14 siguen mandando', () => {
    expect(conBloque).toMatch(/Si de un apartado SÍ se dictó algo, no lo completes/)
  })
})

describe('está conectado, y sólo al pase final', () => {
  const ruta = leer('src/app/api/expediente/procesar/route.ts')

  it('la ruta pasa la opción', () => {
    expect(ruta).toMatch(/buildSystemPrompt\(tipo, contexto\.especialidad, contexto\.instruccionesIA, \{ proponerHuecos: !rapido \}\)/)
  })

  it('y la ata a `rapido`, que es lo que distingue el pase en vivo del final', () => {
    /**
     * `rapido` viene del cliente como `enVivo || preliminar`. Negarlo es
     * exactamente «sólo en el pase final». Si alguien invierte esto, la primera
     * pasada de 30 segundos rellena la consulta entera.
     */
    expect(ruta).toContain('const rapido = body.rapido === true')
    expect(ruta).not.toMatch(/proponerHuecos: rapido/)
  })

  it('el cliente manda `rapido` en vivo y en preliminar', () => {
    const page = leer('src/app/(dashboard)/consulta/[patientId]/page.tsx')
    expect(page).toMatch(/rapido: enVivo \|\| preliminar/)
  })
})

describe('la pantalla ya sabe contar y resolver lo propuesto', () => {
  it('cuenta las líneas marcadas', () => {
    expect(sugerenciasPendientes([{ value: `${MARCA_SUGERENCIA} algo\notra cosa` }])).toBe(1)
    expect(sugerenciasPendientes([{ value: 'todo dictado' }])).toBe(0)
  })

  it('y la consulta enseña el aviso con el conteo', () => {
    const page = leer('src/app/(dashboard)/consulta/[patientId]/page.tsx')
    expect(page).toContain('sugerenciasPendientes(secciones)')
    expect(page).toContain('resolverSugerencias')
  })

  it('la firma pregunta por lo que sigue sin resolver', () => {
    // Aceptar es un toque; lo que no puede pasar es firmar sin enterarse.
    const page = leer('src/app/(dashboard)/consulta/[patientId]/page.tsx')
    const firmar = page.slice(page.indexOf('const firmar = '))
    expect(firmar).toContain('sugerenciasPendientes(secciones)')
  })
})

describe('la versión del prompt subió con el cambio', () => {
  it('no se quedó atrás', () => {
    const v = leer('src/lib/expediente/prompt-version.ts')
    // Si el prompt cambia y la versión no, no se puede acotar qué notas salieron
    // con qué prompt — que es lo que exige IEC 62304.
    expect(v).toMatch(/PROMPT_VERSION = 'nota-2026-08-07-3'/)
  })
})
