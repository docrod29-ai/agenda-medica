/**
 * GOLDEN — el ensamble podía reescribir las citas, y nadie las volvía a mirar.
 *
 * ── LO QUE PASABA ────────────────────────────────────────────────────────────
 *
 * En el motor máximo, GPT redacta su versión del mismo caso y un tercer paso
 * **fusiona** los dos borradores. La fusión pasa por `safeParse`, así que se
 * comprobaba la **forma** del JSON — pero no que las `source_quote` fusionadas
 * siguieran existiendo en la transcripción.
 *
 * ── POR QUÉ NO SALTABA NADA ──────────────────────────────────────────────────
 *
 * La cita es lo único que sostiene el sello «dictado». `procedencia.ts` lo
 * comprueba al firmar y, si la cita no aparece, **degrada el campo a «ia»**.
 *
 * O sea que una cita reescrita por el sintetizador no rompía nada ruidosamente:
 * hacía que un dato **dictado dejara de parecerlo**. El médico veía más avisos
 * de «no se pudo comprobar» y ninguna explicación de por qué — el defecto estaba
 * dos pasos más arriba.
 *
 * ── LA REGLA ─────────────────────────────────────────────────────────────────
 *
 * Elemento por elemento: lo que la fusión rompió vuelve al borrador base si allí
 * la cita sí verifica; y si nadie tiene una buena, la cita se vacía y el campo
 * queda marcado. Nunca se busca «la frase más parecida»: eso sería fabricar la
 * evidencia que justifica el dato.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  revalidarCitas, citaVerifica, normaliza, MIN_CITA,
  POR_QUE_NO_SE_BUSCA_LA_FRASE_PARECIDA, POR_QUE_ELEMENTO_A_ELEMENTO,
  POR_QUE_IMPORTA_AUNQUE_EL_SELLO_YA_LO_VEA,
} from '@/lib/ia/revalidar-citas'
import { normaliza as normalizaSello } from '@/lib/expediente/procedencia'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')
const ruta = leer('src', 'app', 'api', 'expediente', 'procesar', 'route.ts')

const DICTADO = 'El paciente refiere dolor abdominal desde hace tres días. Le indico meropenem dos gramos cada ocho horas.'

describe('SE NORMALIZA IGUAL QUE EL SELLO', () => {
  it('si no, esto daría por buena una cita que el sello rechaza al firmar', () => {
    /**
     * Serían dos jueces con criterios distintos: aquí pasa, al firmar no. El
     * médico vería el aviso justo cuando ya no puede hacer nada barato.
     */
    for (const s of ['DOLOR Abdominal', '  dos   gramos ', 'Meropenem, dos gramos']) {
      expect(normaliza(s), s).toBe(normalizaSello(s))
    }
  })
})

describe('QUÉ CUENTA COMO CITA VERIFICADA', () => {
  it('una cita textual del dictado verifica', () => {
    expect(citaVerifica('dolor abdominal desde hace tres días', normaliza(DICTADO))).toBe(true)
  })

  it('una cita que no está, no verifica', () => {
    expect(citaVerifica('el paciente niega dolor torácico previo', normaliza(DICTADO))).toBe(false)
  })

  it('sin cita no hay nada que romper', () => {
    expect(citaVerifica('', normaliza(DICTADO))).toBe(true)
    expect(citaVerifica(undefined, normaliza(DICTADO))).toBe(true)
  })

  it('las citas muy cortas se dan por buenas', () => {
    /**
     * Un fragmento de tres letras aparece en cualquier transcripción por
     * casualidad: «verificarlo» daría por buena una prueba que no prueba nada.
     */
    expect(MIN_CITA).toBeGreaterThan(3)
    expect(citaVerifica('sí', normaliza(DICTADO))).toBe(true)
  })

  it('sin transcripción no se juzga aquí', () => {
    // El sello ya falla cerrado en ese caso; duplicarlo aquí sólo vaciaría
    // citas correctas cuando el dictado no viajó.
    expect(citaVerifica('cualquier cosa larga', '')).toBe(true)
  })
})

describe('LA RESTAURACIÓN, ELEMENTO A ELEMENTO', () => {
  const base = {
    extraction: {
      diagnosticos: [{ descripcion: 'Dolor abdominal', source_quote: 'dolor abdominal desde hace tres días' }],
      medicamentos: [{ nombre: 'Meropenem', source_quote: 'meropenem dos gramos cada ocho horas' }],
    },
  }

  it('lo que la fusión rompió vuelve al borrador base', () => {
    const fusion = {
      extraction: {
        diagnosticos: [{ descripcion: 'Dolor abdominal', source_quote: 'el paciente comenta molestia en el vientre' }],
        medicamentos: base.extraction.medicamentos,
      },
    }
    const r = revalidarCitas(fusion, base, DICTADO)
    expect(r.restaurados).toBe(1)
    expect(r.descartadas).toBe(0)
    expect((r.nota as typeof base).extraction.diagnosticos[0].source_quote)
      .toBe('dolor abdominal desde hace tres días')
  })

  it('lo que estaba bien NO se toca', () => {
    const r = revalidarCitas(base, base, DICTADO)
    expect(r.restaurados).toBe(0)
    expect(r.descartadas).toBe(0)
    expect(r.revisadas).toBe(2)
    expect(r.nota).toEqual(base)
  })

  it('una cita mala NO tira el resto de la fusión', () => {
    /**
     * Es la lección del guardián del corrector: descartar todo por una
     * violación costaba veinte minutos de correcciones buenas.
     */
    const fusion = {
      extraction: {
        diagnosticos: [{ descripcion: 'Dolor abdominal, a estudio', source_quote: 'frase que nadie dijo en esta consulta' }],
        medicamentos: [{ nombre: 'Meropenem', dosis: '2 g', source_quote: 'meropenem dos gramos cada ocho horas' }],
      },
    }
    const r = revalidarCitas(fusion, base, DICTADO)
    // El medicamento mejorado por la fusión se conserva con su dosis.
    expect((r.nota as typeof fusion).extraction.medicamentos[0].dosis).toBe('2 g')
  })

  it('si nadie tiene una cita buena, se vacía y se marca para revisión', () => {
    const fusion = {
      extraction: {
        diagnosticos: [{ descripcion: 'Colecistitis', source_quote: 'una cita inventada por completo' }],
      },
    }
    const sinBase = { extraction: { diagnosticos: [{ descripcion: 'Colecistitis', source_quote: 'otra cita igual de falsa' }] } }
    const r = revalidarCitas(fusion, sinBase, DICTADO)
    expect(r.descartadas).toBe(1)
    const d = (r.nota as { extraction: { diagnosticos: Record<string, unknown>[] } }).extraction.diagnosticos[0]
    expect(d.source_quote).toBe('')
    expect(d.needs_review).toBe(true)
    expect(String(d.reason)).toMatch(/no aparece en la transcripción/)
    // Y el dato clínico NO se borra: lo que se cae es la prueba, no el hallazgo.
    expect(d.descripcion).toBe('Colecistitis')
  })

  it('nunca se inventa una cita parecida', () => {
    expect(POR_QUE_NO_SE_BUSCA_LA_FRASE_PARECIDA).toMatch(/fabricar la evidencia/)
    expect(POR_QUE_ELEMENTO_A_ELEMENTO).toMatch(/minuto 18/)
  })

  it('funciona a cualquier profundidad, no sólo en las listas conocidas', () => {
    // El propio esquema dice que los campos crecen con el tiempo: una lista
    // cerrada de rutas se quedaría atrás en silencio.
    const fusion = { secciones: { nivel2: { nivel3: { source_quote: 'esto no se dijo nunca aquí' } } } }
    const r = revalidarCitas(fusion, {}, DICTADO)
    expect(r.descartadas).toBe(1)
  })

  it('sin transcripción no se toca nada', () => {
    const fusion = { extraction: { diagnosticos: [{ source_quote: 'lo que sea, bien largo' }] } }
    const r = revalidarCitas(fusion, {}, '')
    expect(r.revisadas).toBe(0)
    expect(r.nota).toEqual(fusion)
  })
})

describe('LA RUTA LO USA, Y LO DICE', () => {
  it('revalida justo después de fusionar', () => {
    expect(ruta).toContain('const rev = revalidarCitas(merged, validation.data, transcripcion)')
    expect(ruta).toContain('notaFinal = rev.nota')
  })

  it('deja rastro cuando cambió algo', () => {
    // Una corrección silenciosa se ve igual que un acierto.
    expect(ruta).toContain('if (rev.restaurados > 0 || rev.descartadas > 0)')
    expect(ruta).toContain('_citasFusion: citasFusion')
  })

  it('y sin ensamble no se inventa un informe', () => {
    expect(ruta).toContain('let citasFusion: { revisadas: number; restauradas: number; descartadas: number } | null = null')
  })

  it('está escrito por qué esto importaba aunque el sello ya lo viera', () => {
    expect(POR_QUE_IMPORTA_AUNQUE_EL_SELLO_YA_LO_VEA).toMatch(/dejara de parecerlo/)
  })
})
