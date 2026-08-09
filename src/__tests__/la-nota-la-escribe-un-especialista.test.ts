/**
 * LA NOTA LA ESCRIBE UN ESPECIALISTA — REG-230 · I-5 del loop.
 *
 * ── LO QUE EL MÉDICO PIDIÓ ──────────────────────────────────────────────────
 *
 * «nota como **internista, pediatra, ginecólogo, cirujano, intensivista,
 * infectólogo** etcétera según sea el caso» · «como la escribe un internista:
 * **prosa que razona**».
 *
 * Y en las doce preguntas contestó dos cosas que cambian el alcance del
 * producto: lo van a usar **médicos de CUALQUIER especialidad**, y **cada
 * especialista valida su propia rama al usarla**.
 *
 * ── LO QUE HABÍA, Y POR QUÉ DEJA DE SERVIR ──────────────────────────────────
 *
 * Dieciséis guías escritas dentro de `prompts.ts`, en medio de un archivo de 800
 * líneas. Mientras la app era para un internista-infectólogo, bastaba.
 *
 * Deja de bastar en cuanto la usa un pediatra: **su criterio no puede vivir en
 * una constante que sólo se cambia recompilando**.
 *
 * ── EL DEFECTO DE VERDAD ERA EL SILENCIO ────────────────────────────────────
 *
 * `guiaEspecialidad()` devolvía cadena vacía cuando no encontraba la rama. Un
 * reumatólogo, un geriatra, un neumólogo pediatra —cualquiera fuera de las
 * dieciséis— recibía una nota redactada **con criterio genérico y sin que nadie
 * se lo dijera**.
 *
 * Un genérico silencioso es la peor de las tres opciones: no es la nota de su
 * especialidad, y encima parece que sí.
 *
 * ── LA MUDANZA NO PODÍA CAMBIAR NADA ────────────────────────────────────────
 *
 * Se comprobó antes de tocar: para las dieciséis especialidades y para una
 * desconocida, el prompt resultante es **idéntico byte a byte** al de antes.
 * Mover criterio clínico de sitio y que cambie de comportamiento sería el peor
 * refactor posible.
 *
 * ── EL LÍMITE, Y ES DURO ────────────────────────────────────────────────────
 *
 * Aquí no se redacta criterio clínico de ramas que el dueño no ejerce. Las
 * dieciséis están porque ya estaban. Una decimoséptima la escribe quien la
 * ejerce, y hasta entonces el sistema **dice que no la tiene** en vez de fingir.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { buildSystemPrompt } from '@/lib/expediente/prompts'
import {
  GUIAS, guiaDe, tieneGuia, bloqueDeEspecialidad, type GuiaDeEspecialidad,
} from '@/lib/expediente/guias-de-especialidad'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')

describe('el registro tiene lo que ya había, y con dueño', () => {
  it('están las dieciséis', () => {
    expect(GUIAS.length).toBeGreaterThanOrEqual(16)
  })

  it('todas declaran de dónde salen', () => {
    for (const g of GUIAS) {
      expect(['repositorio', 'del_medico'], g.clave).toContain(g.origen)
    }
  })

  it('ninguna está vacía ni sin nombre', () => {
    for (const g of GUIAS) {
      expect(g.clave.length, g.clave).toBeGreaterThan(3)
      expect(g.nombre.length, g.clave).toBeGreaterThan(3)
      expect(g.guia.length, g.clave).toBeGreaterThan(60)
    }
  })

  it('no hay dos con la misma clave', () => {
    const claves = GUIAS.map(g => g.clave)
    expect(new Set(claves).size).toBe(claves.length)
  })
})

describe('encuentra la rama aunque esté escrita a mano', () => {
  it('por raíz, no por igualdad', () => {
    expect(guiaDe('Cardiología clínica')?.clave).toBe('cardiolog')
    // MANDA LA PALABRA QUE VA DELANTE, no el orden del arreglo. Esta aserción
    // cazó un defecto real: «Infectología pediátrica» caía en PEDIATRÍA sólo
    // porque `pediatr` estaba antes en la lista. En español el núcleo del
    // nombre va primero.
    expect(guiaDe('Infectología pediátrica')?.clave).toBe('infectolog')
    expect(guiaDe('Cirugía pediátrica')?.clave).toBe('cirug')
    expect(guiaDe('Cardiología pediátrica')?.clave).toBe('cardiolog')
    expect(guiaDe('MEDICINA INTERNA')?.clave).toBe('interna')
  })

  it('sin acentos también', () => {
    expect(guiaDe('Pediatria')?.clave).toBe('pediatr')
  })

  it('y devuelve null cuando NO hay — que es información, no un fallo', () => {
    expect(guiaDe('Reumatología')).toBeNull()
    expect(guiaDe('Geriatría')).toBeNull()
    expect(guiaDe('')).toBeNull()
    expect(guiaDe(undefined)).toBeNull()
    expect(tieneGuia('Reumatología')).toBe(false)
  })
})

describe('la del médico manda sobre la del repositorio', () => {
  it('si él escribe la suya, se usa la suya', () => {
    /**
     * Es lo que exige su respuesta «el médico de esa especialidad valida al
     * usarla»: si un pediatra corrige la guía de pediatría, la suya gana.
     */
    const mia: GuiaDeEspecialidad = {
      clave: 'pediatr', nombre: 'Pediatría', origen: 'del_medico',
      guia: 'PEDIATRÍA (mi criterio): lo que yo decida documentar.',
    }
    expect(guiaDe('Pediatría', [mia])?.origen).toBe('del_medico')
    expect(bloqueDeEspecialidad('Pediatría', [mia])).toContain('mi criterio')
  })

  it('y puede añadir una rama que no existía', () => {
    const mia: GuiaDeEspecialidad = {
      clave: 'reumatolog', nombre: 'Reumatología', origen: 'del_medico',
      guia: 'REUMATOLOGÍA: lo que el reumatólogo decida.',
    }
    expect(tieneGuia('Reumatología', [mia])).toBe(true)
  })
})

describe('la mudanza no cambió lo que ve el modelo', () => {
  it('el bloque tiene el formato exacto de antes', () => {
    // `\nENFOQUE POR ESPECIALIDAD — …\n`. Un carácter distinto aquí es un
    // cambio de comportamiento clínico disfrazado de refactor.
    const b = bloqueDeEspecialidad('Cardiología')
    expect(b.startsWith('\nENFOQUE POR ESPECIALIDAD — ')).toBe(true)
    expect(b.endsWith('\n')).toBe(true)
  })

  it('sin guía, el bloque es cadena vacía — igual que antes', () => {
    expect(bloqueDeEspecialidad('Reumatología')).toBe('')
  })

  it('el prompt sigue llevando la guía dentro', () => {
    expect(buildSystemPrompt('primera_vez', 'Infectología')).toContain('INFECTOLOGÍA/PROA')
  })

  it('las guías ya NO viven en prompts.ts', () => {
    const p = leer('src/lib/expediente/prompts.ts')
    expect(p).not.toContain('const ESPECIALIDAD_GUIA')
    expect(p).toContain("from './guias-de-especialidad'")
  })
})

describe('cada especialidad que el menú OFRECE tiene guía', () => {
  it('ninguna se ofrece para caer a genérico en silencio', () => {
    /**
     * Añadir una rama al menú sin escribir su guía es exactamente el defecto
     * que este archivo cierra, y es un cambio de una línea que nadie notaría.
     */
    const page = leer('src/app/(dashboard)/consulta/[patientId]/page.tsx')
    const bloque = /const ESPECIALIDADES_POR_GRUPO[\s\S]*?\n\]/.exec(page)?.[0] ?? ''
    expect(bloque, 'no se encontró el menú de especialidades').toBeTruthy()
    const grupos = ['Primer contacto', 'Especialidades médicas', 'Especialidades quirúrgicas']
    const ofrecidas = [...bloque.matchAll(/'([^']+)'/g)]
      .map(m => m[1])
      .filter(x => !grupos.includes(x))
    expect(ofrecidas.length).toBeGreaterThanOrEqual(16)
    const sinGuia = ofrecidas.filter(e => !tieneGuia(e))
    expect(sinGuia, 'ofrecidas en el menú y sin guía').toEqual([])
  })
})

describe('cuando no hay guía, se dice', () => {
  it('la ruta lo reporta al cliente', () => {
    const ruta = leer('src/app/api/expediente/procesar/route.ts')
    expect(ruta).toContain('const conGuia = tieneGuia(contexto.especialidad)')
    expect(ruta).toContain('_especialidadSinGuia')
  })

  it('y sólo cuando el médico SÍ declaró una especialidad', () => {
    // Sin especialidad declarada no hay nada que avisar: no es que falte guía,
    // es que no dijo de qué rama es.
    const ruta = leer('src/app/api/expediente/procesar/route.ts')
    expect(ruta).toMatch(/_especialidadSinGuia: contexto\.especialidad && !conGuia/)
  })
})

describe('la prosa razona, no enumera', () => {
  const p = buildSystemPrompt('primera_vez', 'Medicina Interna')

  it('la regla existe y cita la petición del médico', () => {
    expect(p).toContain('14-bis.')
    expect(p).toMatch(/como la escribe[\s\S]{0,12}un internista/)
  })

  it('pide conectar hallazgo → diagnóstico → plan', () => {
    expect(p).toMatch(/CONECTA/)
    expect(p).toMatch(/el dato que sostiene el diagnóstico y el/)
    expect(p).toMatch(/cada indicación va atada a lo que la justifica/)
  })

  it('y NO afloja la prohibición de inventar', () => {
    /** Razonar no es rellenar: si el dictado no trae el dato, no se pone. */
    expect(p).toMatch(/razonar no es rellenar/)
    expect(p).toMatch(/sigue prohibido inventar el dato que conecta/)
  })
})
