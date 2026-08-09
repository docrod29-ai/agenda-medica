/**
 * LOS DIAGNÓSTICOS NO SE ACUMULAN.
 *
 * ── EL DEFECTO (7-ago-2026, REG-216 · reportado con captura) ────────────────
 *
 * Una sola nota terminó con **19 diagnósticos**, con el mismo cuadro repetido
 * hasta tres veces bajo el MISMO código CIE-10:
 *
 *     R59.1  «Adenopatía cervical bilateral»
 *     R59.1  «Adenopatía cervical bilateral con fiebre y exantema»
 *     R59.1  «Adenopatías cervicales bilaterales … en estudio diferencial»
 *     D64.9  «Anemia» · «Anemia leve»
 *     N39.0  «Infección de vías urinarias recurrente refractaria»
 *            «Infecciones recurrentes de vías urinarias refractarias»
 *
 * ── LAS DOS CAUSAS, Y CUÁL PESABA ──────────────────────────────────────────
 *
 * 1. La fusión CONCATENABA y sólo descartaba el repetido si el texto era
 *    idéntico letra por letra. El código CIE-10 —que estaba ahí, y que el
 *    propio prompt obliga a rellenar— **se ignoraba**.
 *
 * 2. **El multiplicador**: el pase en vivo dispara cada 15 s / 18 palabras
 *    nuevas. Una consulta de diez minutos son ~40 pasadas, cada una mandando la
 *    transcripción entera y re-redactando los síndromes distinto. Cuarenta
 *    tandas sumadas.
 *
 * La segunda es la que explica el volumen. Sin ella, la primera daría 8, no 19.
 *
 * ── POR QUÉ NO SE ARREGLA REEMPLAZANDO ─────────────────────────────────────
 *
 * La fusión existía por una razón buena y documentada: reemplazar **borraba el
 * diagnóstico que el médico había capturado a mano** con su CIE-10 mientras la
 * IA corría. La distinción correcta no es «viejo contra nuevo»: es **lo que
 * puso la IA contra lo que puso el médico**.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Diagnostico } from '@/types/expediente'
import { esElMismo, fusionarDiagnosticos } from '@/lib/expediente/fusionar-diagnosticos'

const dx = (descripcion: string, codigoCIE10?: string): Diagnostico => ({
  descripcion, codigoCIE10, tipo: 'presuntivo', estado: 'activo',
})

describe('los diagnósticos no se acumulan', () => {
  describe('las parejas reales de la captura son el mismo diagnóstico', () => {
    it.each([
      ['Adenopatía cervical bilateral', 'Adenopatía cervical bilateral con fiebre y exantema', 'R59.1'],
      ['Anemia', 'Anemia leve', 'D64.9'],
      ['Infección de vías urinarias recurrente refractaria', 'Infecciones recurrentes de vías urinarias refractarias', 'N39.0'],
    ])('«%s» ≡ «%s»', (a, b, cie) => {
      expect(esElMismo(dx(a, cie), dx(b, cie))).toBe(true)
    })

    it('el mismo código basta, aunque el texto no se parezca', () => {
      // Para eso existe el CIE-10. Es el dato que estaba ahí y se descartaba.
      expect(esElMismo(dx('Fiebre de origen a esclarecer', 'R50.9'),
        dx('Síndrome inflamatorio sistémico febril', 'R50.9'))).toBe(true)
    })

    it('sin código, colapsan por contención de palabras', () => {
      expect(esElMismo(dx('Anemia'), dx('Anemia leve'))).toBe(true)
    })
  })

  describe('lo que NO debe colapsar', () => {
    it.each([
      ['Diabetes mellitus tipo 2', 'E11', 'Hipertensión arterial sistémica', 'I10'],
      ['Leucopenia', 'D70.9', 'Trombocitopenia', 'D69.6'],
    ])('«%s» ≠ «%s»', (a, ca, b, cb) => {
      expect(esElMismo(dx(a, ca), dx(b, cb))).toBe(false)
    })
  })

  describe('cuarenta pasadas del pase en vivo no acumulan', () => {
    it('la segunda pasada SUSTITUYE a la primera, no se le suma', () => {
      const pasada1 = [dx('Infección de vías urinarias recurrente refractaria', 'N39.0'), dx('Diabetes mellitus tipo 2', 'E11')]
      const pasada2 = [dx('Infecciones recurrentes de vías urinarias refractarias', 'N39.0'), dx('Diabetes mellitus tipo 2', 'E11')]
      const r = fusionarDiagnosticos({ previos: pasada1, nuevos: pasada2, deLaIaAnterior: pasada1 })
      expect(r).toHaveLength(2)
    })

    it('cuarenta pasadas seguidas no hacen crecer la lista', () => {
      /**
       * La prueba que reproduce el defecto tal como ocurre: el pase en vivo
       * corriendo una y otra vez sobre una transcripción que crece.
       */
      let lista: Diagnostico[] = []
      let previaDeLaIa: Diagnostico[] = []
      for (let i = 0; i < 40; i++) {
        // La IA redacta distinto cada vez — que es justo lo que rompía el dedupe.
        const nuevos = [
          dx(i % 2 ? 'Adenopatía cervical bilateral' : 'Adenopatía cervical bilateral con fiebre', 'R59.1'),
          dx(i % 3 ? 'Anemia' : 'Anemia leve', 'D64.9'),
          dx('Diabetes mellitus tipo 2', 'E11'),
        ]
        lista = fusionarDiagnosticos({ previos: lista, nuevos, deLaIaAnterior: previaDeLaIa })
        previaDeLaIa = nuevos
      }
      expect(lista).toHaveLength(3)
    })
  })

  describe('lo que el médico escribió a mano NO se borra', () => {
    it('sobrevive a que la IA reprocese', () => {
      /**
       * Es la razón por la que existía la fusión concatenativa. Reemplazar a
       * secas borraba en silencio el diagnóstico que el médico había capturado
       * con su CIE-10 — pérdida de datos clínicos, peor que la acumulación.
       */
      const deLaIa = [dx('Diabetes mellitus tipo 2', 'E11')]
      const aMano = dx('Sospecha de vejiga neurogénica', 'N31.9')
      const r = fusionarDiagnosticos({
        previos: [...deLaIa, aMano],
        nuevos: [dx('Diabetes mellitus tipo 2', 'E11'), dx('Anemia', 'D64.9')],
        deLaIaAnterior: deLaIa,
      })
      expect(r.some(d => d.descripcion.includes('vejiga'))).toBe(true)
    })

    it('ante la duda NO se quita nada', () => {
      // Sin saber qué puso la IA antes, conservar: el error caro es borrarle un
      // diagnóstico al médico, no dejarle uno de más.
      const previos = [dx('Algo que escribió el médico', 'Z99'), dx('Otro', 'Z98')]
      const r = fusionarDiagnosticos({ previos, nuevos: [dx('Anemia', 'D64.9')] })
      expect(r.length).toBeGreaterThanOrEqual(previos.length)
    })
  })

  describe('se queda el más específico', () => {
    it('«Anemia leve» gana a «Anemia» con el mismo código', () => {
      const r = fusionarDiagnosticos({
        previos: [], nuevos: [dx('Anemia', 'D64.9'), dx('Anemia leve', 'D64.9')],
      })
      expect(r).toHaveLength(1)
      expect(r[0].descripcion).toBe('Anemia leve')
    })
  })

  describe('ESTÁ CABLEADO', () => {
    const page = readFileSync(
      join(process.cwd(), 'src/app/(dashboard)/consulta/[patientId]/page.tsx'), 'utf8')

    it('los DOS sitios de fusión usan el motor', () => {
      // Eran dos copias de la misma lógica: dos sitios con la misma regla, no
      // dos reglas. Si uno se queda atrás, el defecto vuelve por esa puerta.
      expect(page.split('fusionarDiagnosticos({').length - 1).toBe(2)
    })

    it('la concatenación anterior ya no existe en ninguno', () => {
      expect(page).not.toContain('return [...prev, ...nuevosDx.filter')
    })

    it('se recuerda lo que puso la IA, que es lo que hace segura la sustitución', () => {
      expect(page).toContain('dxDeLaIaRef')
    })
  })

  describe('el prompt pide una lista corta y razonada', () => {
    const prompt = readFileSync(join(process.cwd(), 'src/lib/expediente/prompts.ts'), 'utf8')

    it('acota el número y prohíbe el inventario', () => {
      expect(prompt).toContain('TRES A SEIS diagnósticos')
      expect(prompt).toContain('UNA ENTRADA POR CÓDIGO CIE-10')
    })

    it('los hallazgos de laboratorio no son diagnósticos', () => {
      // «Leucopenia», «trombocitopenia», «elevación de ferritina» aparecían como
      // entradas propias: son datos que SOSTIENEN un diagnóstico.
      expect(prompt).toContain('HALLAZGOS DE LABORATORIO')
    })

    it('lo crónico del historial no se repite en cada consulta', () => {
      expect(prompt).toContain('LO CRÓNICO DEL HISTORIAL')
    })
  })
})
