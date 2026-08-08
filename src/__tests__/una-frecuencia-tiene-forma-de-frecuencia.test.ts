/**
 * UNA FRECUENCIA TIENE FORMA DE FRECUENCIA — REG-238.
 *
 * ── EL CASO, Y NO ES INVENTADO ──────────────────────────────────────────────
 *
 * Salió de una captura del médico dueño, de una nota **ya firmada**, con su
 * cédula:
 *
 *     «Moxifloxacino 400 mg vo cada 24 horas por 14 EDITAS»
 *     «Moxifloxacino tabletas 400 mg · oral · 24 TRAS · 14 días»
 *
 * Los dos sitios se rompieron DISTINTO —la prosa perdió los días, la lista
 * perdió las horas—, que es la huella de que el daño viene del reconocedor o
 * del modelo, no de un corrector que sustituye igual en todas partes.
 *
 * ── LO QUE SE COMPROBÓ ANTES DE ESCRIBIR NADA ───────────────────────────────
 *
 * Se le pasó al corrector léxico el texto limpio y el partido —«por 14 di as»,
 * «cada 24 ho ras», «cada 24 hrs»— y no corrompe ninguno. Se descartó como
 * origen midiendo, no leyendo.
 *
 * ── LA REGLA ────────────────────────────────────────────────────────────────
 *
 * Se avisa de lo que no se entiende. **No se propone el valor correcto.** Decir
 * «esto no parece una frecuencia» es un hecho comprobable; decir «debería ser
 * cada 24 horas» sería inventar una pauta clínica.
 */
import { describe, it, expect } from 'vitest'
import {
  esFrecuenciaReconocible,
  esDuracionReconocible,
  revisarFormaDeLaPauta,
  pautasDeformadas,
  POR_QUE_NO_SE_CORRIGE_SOLO,
} from '@/lib/seguridad/forma-de-la-pauta'
import { construirAvisos, NIVEL } from '@/lib/expediente/avisos-consulta'
import { mientrasReceta, alFirmar } from '@/lib/expediente/cuando-avisar'
import { corregirTranscripcion } from '@/lib/expediente/medical-vocabulary'
import { readFileSync } from 'fs'
import { join } from 'path'

describe('el caso real de su nota firmada', () => {
  it('caza «14 editas» Y «24 tras» — los DOS campos, no uno', () => {
    const r = revisarFormaDeLaPauta({
      farmaco: 'Moxifloxacino', frecuencia: '24 tras', duracion: '14 editas',
    })
    expect(r.map(a => a.campo).sort()).toEqual(['duracion', 'frecuencia'])
  })

  it('la pauta CORRECTA no molesta', () => {
    expect(revisarFormaDeLaPauta({
      farmaco: 'Moxifloxacino', frecuencia: 'cada 24 horas', duracion: '14 días',
    })).toEqual([])
  })

  it('cita lo escrito LITERAL, sin parafrasear', () => {
    const [a] = revisarFormaDeLaPauta({ farmaco: 'Moxifloxacino', frecuencia: '24 tras' })
    expect(a.loEscrito).toBe('24 tras')
    expect(a.mensaje).toContain('«24 tras»')
  })

  it('NO propone el valor correcto en ningún mensaje', () => {
    /**
     * La tentación es obvia —«24 tras» sólo puede ser «24 horas»—. Y es
     * justamente donde empieza a inventar cifras clínicas.
     */
    const todos = revisarFormaDeLaPauta({
      farmaco: 'Moxifloxacino', frecuencia: '24 tras', duracion: '14 editas',
    }).map(a => a.mensaje).join(' ')
    expect(todos).not.toMatch(/deber[íi]a ser|quiso decir|correcto es|cambia a/i)
    expect(POR_QUE_NO_SE_CORRIGE_SOLO).toMatch(/inventar una pauta cl[íi]nica/)
  })
})

describe('el corrector léxico quedó descartado MIDIENDO', () => {
  it.each([
    'Moxifloxacino 400 mg vía oral cada 24 horas por 14 días',
    'por 14 di as',
    'cada 24 ho ras',
    'cada 24 hrs',
  ])('no corrompe %s', (txt) => {
    expect(corregirTranscripcion(txt).corregido).toBe(txt)
  })
})

describe('lo que SÍ es una frecuencia no se toca', () => {
  it.each([
    'cada 8 horas', 'cada 8 h', 'c/8h', 'c/12 hrs', 'cada 12 horas',
    'cada día', 'cada tercer día', '3 veces al día', 'una vez al día',
    'dos veces por semana', 'qd', 'bid', 'tid', 'q8h', 'diario',
    'dosis única', 'por la noche', '24 horas', 'cada 30 min',
  ])('«%s» pasa', (f) => expect(esFrecuenciaReconocible(f)).toBe(true))

  it.each(['24 tras', 'editas', 'cada mucho', 'xxxx'])(
    '«%s» NO pasa', (f) => expect(esFrecuenciaReconocible(f)).toBe(false))

  it('vacío pasa: la AUSENCIA de frecuencia es otro problema, con otro motor', () => {
    expect(esFrecuenciaReconocible('')).toBe(true)
    expect(esFrecuenciaReconocible(null)).toBe(true)
  })
})

describe('lo que SÍ es una duración no se toca', () => {
  it.each([
    '14 días', '7 dias', 'siete días', 'un mes', '2 semanas', '3 meses',
    'indefinido', 'permanente', 'de por vida', 'hasta terminar el frasco',
    'según respuesta', 'crónico',
  ])('«%s» pasa', (d) => expect(esDuracionReconocible(d)).toBe(true))

  it.each(['14 editas', 'editas', 'zzz'])(
    '«%s» NO pasa', (d) => expect(esDuracionReconocible(d)).toBe(false))
})

describe('llega a la pantalla, y en el MOMENTO correcto', () => {
  const avisos = construirAvisos({
    pautas: [{ nombre: 'Moxifloxacino', frecuencia: '24 tras', duracion: '14 editas' }],
  })

  it('produce los dos avisos', () => {
    expect(avisos.filter(a => a.origen === 'pauta_deformada')).toHaveLength(2)
  })

  it('se ve MIENTRAS receta, no al firmar', () => {
    /**
     * La receta se imprime al firmar. Un aviso sobre lo que va impreso que
     * llega al firmar llega tarde — es REG-173 y REG-190 otra vez.
     */
    expect(mientrasReceta(avisos).filter(a => a.origen === 'pauta_deformada')).toHaveLength(2)
    expect(alFirmar(avisos).filter(a => a.origen === 'pauta_deformada')).toHaveLength(0)
  })

  it('ancla en el medicamento POR NOMBRE, nunca por índice', () => {
    const a = avisos.find(x => x.origen === 'pauta_deformada')!
    expect(a.ancla).toEqual({ seccion: 'medicamentos', nombre: 'Moxifloxacino' })
  })

  it('avisa, NO bloquea — y es deliberado', () => {
    /**
     * «14 editas» puede ser una forma que este motor no conoce todavía. Apagar
     * el botón por un posible falso positivo enseña a esquivar la compuerta.
     */
    expect(NIVEL.pauta_deformada).toBe('revisa')
  })

  it('el detalle dice POR QUÉ importa: sale impreso', () => {
    const a = avisos.find(x => x.origen === 'pauta_deformada')!
    expect(a.detalle).toMatch(/sale impresa en la receta/)
  })

  it('una pauta correcta no genera NINGÚN aviso', () => {
    expect(construirAvisos({
      pautas: [{ nombre: 'Moxifloxacino', frecuencia: 'cada 24 horas', duracion: '14 días' }],
    }).filter(a => a.origen === 'pauta_deformada')).toHaveLength(0)
  })

  it('sin pautas no truena', () => {
    expect(() => construirAvisos({})).not.toThrow()
    expect(pautasDeformadas([])).toEqual([])
  })
})

describe('está CONECTADO — no escrito y sin conectar', () => {
  it('la consulta le pasa la lista de medicamentos', () => {
    const page = readFileSync(
      join(process.cwd(), 'src/app/(dashboard)/consulta/[patientId]/page.tsx'), 'utf8')
    expect(page).toMatch(/pautas: medicamentos/)
  })
})
