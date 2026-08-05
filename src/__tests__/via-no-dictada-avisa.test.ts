/**
 * GOLDEN — la receta afirmaba una vía que nadie dictó.
 *
 * ── LA DECISIÓN DEL MÉDICO DUEÑO (4-ago-2026) ────────────────────────────────
 *
 * Literalmente: «déjalo oral pero que avise si no se dictó la vía».
 *
 * Es su decisión y no mía: yo puedo detectar que el dato falta; qué se hace
 * clínicamente cuando falta lo decide él. Vaciar la vía habría obligado a
 * teclearla en cada receta; callarla deja el documento afirmando algo que nadie
 * dijo.
 *
 * ── DE DÓNDE VIENE ───────────────────────────────────────────────────────────
 *
 * El prompt de extracción trae `"via": "oral"` en su plantilla, así que el modelo
 * la rellena **siempre**. `via-parenteral.ts` ya rescataba el caso más grave
 * —«insulina · oral», que no existe— pero sólo para fármacos sin presentación
 * oral. El resto pasaba mudo.
 *
 * ── POR QUÉ SE MIRA LA CITA Y NO SE PREGUNTA AL MODELO ───────────────────────
 *
 * Se le podría pedir que declare si la vía venía en el audio, pero eso es fiarse
 * de que confiese — y «esto no se dijo» es justo la señal que un generativo peor
 * distingue, porque rellenar el hueco es lo que sabe hacer.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { seDictoLaVia, conViaAsumida, avisoDeViaAsumida } from '@/lib/expediente/via-asumida'

describe('SE RECONOCE LA VÍA CUANDO SÍ SE DICTÓ', () => {
  it('dicha con todas sus letras', () => {
    expect(seDictoLaVia('paracetamol 500 miligramos vía oral cada 8 horas')).toBe(true)
  })

  it('en la forma en que se habla de verdad', () => {
    // Un médico dicta «que se lo tome», no «vía oral».
    expect(seDictoLaVia('que se lo tome cada 8 horas con alimento')).toBe(true)
    expect(seDictoLaVia('una tableta cada 12 horas')).toBe(true)
  })

  it('y abreviada', () => {
    expect(seDictoLaVia('ceftriaxona 1 gramo IV cada 24 horas')).toBe(true)
    expect(seDictoLaVia('enoxaparina 40 mg SC')).toBe(true)
  })

  it('las parenterales por su forma hablada', () => {
    expect(seDictoLaVia('se lo va a poner inyectado en el abdomen')).toBe(true)
  })

  it('y las que no son ni oral ni inyectable', () => {
    expect(seDictoLaVia('aplicar la crema en la piel dos veces al día')).toBe(true)
    expect(seDictoLaVia('un supositorio si tiene fiebre')).toBe(true)
  })
})

describe('Y SE DETECTA CUANDO NO SE DICTÓ', () => {
  it('la frase habla del fármaco pero no de por dónde entra', () => {
    expect(seDictoLaVia('le voy a dejar paracetamol 500 cada 8 horas por 5 días')).toBe(false)
  })

  it('sin cita, no se puede afirmar que se dictó', () => {
    // Ausencia de dato no es prueba de que se dijera.
    expect(seDictoLaVia('')).toBe(false)
    expect(seDictoLaVia(undefined)).toBe(false)
  })
})

describe('SÓLO SE AVISA DE LO QUE NOSOTROS RELLENAMOS', () => {
  it('un fármaco oral sin vía dictada entra en el aviso', () => {
    const r = conViaAsumida([{ nombre: 'Paracetamol', via: 'oral', source_quote: 'paracetamol 500 cada 8 horas' }])
    expect(r.map(m => m.nombre)).toEqual(['Paracetamol'])
  })

  it('si la vía SÍ se dictó, no se avisa', () => {
    const r = conViaAsumida([{ nombre: 'Paracetamol', via: 'oral', source_quote: 'paracetamol vía oral cada 8 horas' }])
    expect(r).toEqual([])
  })

  it('y una vía que NO es oral tampoco se toca', () => {
    /**
     * Si acabó en `iv` o `sc` es porque alguien —el dictado o el motor de
     * parenterales— lo decidió con un motivo. Avisar ahí sería ruido, y el ruido
     * se acaba ignorando junto con los avisos que sí importan.
     */
    expect(conViaAsumida([{ nombre: 'Insulina', via: 'sc', source_quote: 'insulina 10 unidades' }])).toEqual([])
  })

  it('la cita propia manda sobre el texto de respaldo', () => {
    /**
     * Que en la consulta se hablara de vías no dice nada sobre LA de este
     * fármaco. Sin esto, un solo «vía oral» en toda la consulta apagaría el
     * aviso para todos los medicamentos.
     */
    const r = conViaAsumida(
      [{ nombre: 'Amoxicilina', via: 'oral', source_quote: 'amoxicilina 500 cada 8' }],
      'antes le dimos ceftriaxona intravenosa',
    )
    expect(r.map(m => m.nombre)).toEqual(['Amoxicilina'])
  })
})

describe('EL AVISO SE ENTIENDE Y NO SE REPITE', () => {
  it('uno solo, con su nombre', () => {
    expect(avisoDeViaAsumida(['Paracetamol'])).toContain('No se dictó la vía de Paracetamol')
    expect(avisoDeViaAsumida(['Paracetamol'])).toContain('ORAL')
  })

  it('varios se agrupan en un aviso, no en cinco', () => {
    // Uno por medicamento sería la fatiga de alerta que ya se corrigió aquí.
    const a = avisoDeViaAsumida(['A', 'B', 'C', 'D', 'E'])!
    expect(a).toContain('5 medicamentos')
    expect(a).toContain('y 2 más')
  })

  it('y sin nada que decir, no se dice nada', () => {
    expect(avisoDeViaAsumida([])).toBeNull()
  })
})

describe('ESTÁ CONECTADO Y SE PUEDE QUITAR', () => {
  const pagina = readFileSync(join(process.cwd(), 'src/app/(dashboard)/consulta/[patientId]/page.tsx'), 'utf8')

  it('la consulta lo calcula y lo enseña', () => {
    expect(pagina).toContain('conViaAsumida(')
    expect(pagina).toContain('avisoDeViaAsumida(viasAsumidas)')
  })

  it('con «Ya lo revisé», como los demás avisos', () => {
    // El Dr lo pidió con estas palabras: «estas cosas deben poderse quitar».
    expect(pagina).toContain("marcarRevisado('via', n)")
    expect(pagina).toContain("avisosRevisados.includes(`via:${n}`)")
  })

  it('en ámbar y no en rojo', () => {
    /**
     * Una vía asumida no es un error como afirmar algo que se negó: casi siempre
     * será oral de verdad. Pintarla de rojo devaluaría el rojo.
     */
    const i = pagina.indexOf('No se dictó la vía de administración')
    expect(pagina.slice(i - 300, i)).toContain('tone="warning"')
  })
})
