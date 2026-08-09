/**
 * LO REVISADO NO ERA LO QUE SE FIRMA — REG-229 · I-8 del loop.
 *
 * ── LO QUE EL MÉDICO PIDIÓ ──────────────────────────────────────────────────
 *
 * Preguntado qué le haría confiar en la nota **sin releerla entera**, eligió
 * «que un segundo modelo la revise».
 *
 * ── Y YA EXISTÍA. ÉSE ERA EL PROBLEMA ───────────────────────────────────────
 *
 * La segunda opinión lleva tiempo corriendo: otro modelo compara la nota contra
 * el dictado y devuelve hallazgos de seguridad, sola al terminar el pase de IA.
 *
 * Pero después de eso **el médico edita**: corrige un apartado, cambia una
 * dosis, acepta las líneas propuestas, quita un diagnóstico. Y el panel seguía
 * diciendo, en verde, «sin observaciones de seguridad» — de una versión del
 * texto que **ya no existe**.
 *
 * Un sello de revisión sobre un texto que cambió no es una garantía: es una
 * garantía caducada que se lee igual que una vigente. **Peor que no tenerla**,
 * porque invita a no releer — que es exactamente para lo que él la quería.
 *
 * ── POR QUÉ NO BLOQUEA LA FIRMA ─────────────────────────────────────────────
 *
 * Bloquear por una revisión caducada convertiría cada coma corregida en un
 * trámite, y él aprendería a esquivarlo. Lo que faltaba no era una compuerta
 * más: era **poder decir la verdad** sobre qué se revisó.
 *
 * ── POR QUÉ LA HUELLA SE ORDENA ANTES DE MEDIR ──────────────────────────────
 *
 * Firestore reordena las llaves, así que un hash sobre `JSON.stringify` cambia
 * sin que cambie el contenido — eso ya costó un banner de «INTEGRIDAD NO
 * VERIFICADA» que era falso. Aquí el orden lo fija el módulo, no quien lo llame.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  huellaRevisable, textoRevisable, estadoDeRevision, COMO_SE_DICE,
} from '@/lib/expediente/lo-que-se-reviso'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')

const nota = {
  resumen: 'Varón de 54 años con fiebre de tres días',
  secciones: [
    { titulo: 'Padecimiento actual', contenido: 'Fiebre de 72 horas, tos productiva' },
    { titulo: 'Exploración física', contenido: 'Estertores en base derecha' },
  ],
  diagnosticos: [{ descripcion: 'Neumonía adquirida en la comunidad', codigoCIE10: 'J18.9' }],
  medicamentos: [{ nombre: 'amoxicilina', dosis: '875 mg', via: 'oral', frecuencia: 'cada 12 h', duracion: '7 días' }],
}

describe('la huella distingue lo que importa', () => {
  it('la misma nota da la misma huella', () => {
    expect(huellaRevisable(nota)).toBe(huellaRevisable({ ...nota }))
  })

  it('cambiar una DOSIS cambia la huella', () => {
    const otra = { ...nota, medicamentos: [{ ...nota.medicamentos[0], dosis: '500 mg' }] }
    expect(huellaRevisable(otra)).not.toBe(huellaRevisable(nota))
  })

  it('cambiar el texto de un apartado cambia la huella', () => {
    const otra = {
      ...nota,
      secciones: [nota.secciones[0], { titulo: 'Exploración física', contenido: 'Sin estertores' }],
    }
    expect(huellaRevisable(otra)).not.toBe(huellaRevisable(nota))
  })

  it('quitar un diagnóstico cambia la huella', () => {
    expect(huellaRevisable({ ...nota, diagnosticos: [] })).not.toBe(huellaRevisable(nota))
  })
})

describe('la huella NO se altera por cosas que no son la nota', () => {
  it('reordenar las secciones no la cambia', () => {
    const alReves = { ...nota, secciones: [...nota.secciones].reverse() }
    expect(huellaRevisable(alReves)).toBe(huellaRevisable(nota))
  })

  it('reordenar los medicamentos tampoco', () => {
    const dos = { ...nota, medicamentos: [nota.medicamentos[0], { nombre: 'paracetamol', dosis: '1 g' }] }
    const alReves = { ...dos, medicamentos: [...dos.medicamentos].reverse() }
    expect(huellaRevisable(alReves)).toBe(huellaRevisable(dos))
  })

  it('los espacios de más no la cambian', () => {
    const conEspacios = { ...nota, resumen: '  Varón de 54 años   con fiebre de tres días  ' }
    expect(huellaRevisable(conEspacios)).toBe(huellaRevisable(nota))
  })

  it('una sección VACÍA que aparece o desaparece no la cambia', () => {
    // Una sección sin contenido no se revisó: que esté en la lista no puede
    // caducar una revisión válida.
    const conVacia = { ...nota, secciones: [...nota.secciones, { titulo: 'Estudios previos', contenido: '' }] }
    expect(huellaRevisable(conVacia)).toBe(huellaRevisable(nota))
  })

  it('hay separador entre campos: dos notas distintas no colisionan', () => {
    /** Sin separador, «ab»+«c» y «a»+«bc» darían la misma huella. */
    const a = { diagnosticos: [{ descripcion: 'ab', codigoCIE10: 'c' }] }
    const b = { diagnosticos: [{ descripcion: 'a', codigoCIE10: 'bc' }] }
    expect(textoRevisable(a)).not.toBe(textoRevisable(b))
    expect(huellaRevisable(a)).not.toBe(huellaRevisable(b))
  })
})

describe('los tres estados', () => {
  it('sin revisar, cuando no hay huella', () => {
    expect(estadoDeRevision({ ahora: nota })).toBe('sin_revisar')
    expect(estadoDeRevision({ huellaRevisada: '', ahora: nota })).toBe('sin_revisar')
    expect(estadoDeRevision({ huellaRevisada: null, ahora: nota })).toBe('sin_revisar')
  })

  it('al día, cuando se revisó ESTA versión', () => {
    expect(estadoDeRevision({ huellaRevisada: huellaRevisable(nota), ahora: nota })).toBe('al_dia')
  })

  it('caducada, en cuanto la nota cambia', () => {
    const antes = huellaRevisable(nota)
    const despues = { ...nota, medicamentos: [{ ...nota.medicamentos[0], dosis: '500 mg' }] }
    expect(estadoDeRevision({ huellaRevisada: antes, ahora: despues })).toBe('caducada')
  })

  it('cada estado tiene su frase, y la de caducada dice lo que pasa', () => {
    expect(COMO_SE_DICE.caducada).toMatch(/lo revisado ya no es lo que vas a firmar/)
    expect(COMO_SE_DICE.sin_revisar).toBeTruthy()
    expect(COMO_SE_DICE.al_dia).toBeTruthy()
  })
})

describe('está conectado de verdad', () => {
  const page = leer('src/app/(dashboard)/consulta/[patientId]/page.tsx')

  it('la verificación guarda la huella de lo que mandó a revisar', () => {
    expect(page).toMatch(/const huella = huellaRevisable\(nota as ContenidoRevisable\)/)
    expect(page).toMatch(/setVerificacion\(\{ modelo: data\.modelo \?\? 'IA', hallazgos: data\.hallazgos \?\? \[\], huella \}\)/)
  })

  it('la huella es de lo que SE MANDÓ, no de lo que hay en pantalla al volver', () => {
    // Entre que sale la petición y vuelve, el médico puede teclear. Medir al
    // volver marcaría como caducada una revisión que sí cubrió lo que se mandó.
    expect(page).toMatch(/La huella es de lo que SE MANDÓ a revisar/)
  })

  it('el panel deja de decir «sin observaciones» en verde cuando caduca', () => {
    expect(page).toMatch(/color: revisionCaducada \? 'var\(--text3\)' : 'var\(--teal\)'/)
    expect(page).toMatch(/revisionCaducada \? ' — sobre la versión anterior\.' : '\.'/)
  })

  it('y al firmar se dice, sin bloquear', () => {
    const firmar = page.slice(page.indexOf('const firmar = useCallback'))
    expect(firmar).toContain("const revision = estadoDeRevision({")
    expect(firmar).toContain("if (revision === 'caducada')")
    // Se pregunta, no se impide: la opción de firmar así existe.
    expect(firmar).toMatch(/confirmar: 'Firmar así'/)
  })

  it('el estado se recalcula con la nota, no una sola vez', () => {
    expect(page).toMatch(/const revisionCaducada = useMemo\(\(\) => estadoDeRevision\(/)
    expect(page).toMatch(/\}\) === 'caducada', \[verificacion\?\.huella, resumen, secciones, diagnosticos, medicamentos\]\)/)
  })
})
