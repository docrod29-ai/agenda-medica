/**
 * LA NOTA NO SALE HUECA.
 *
 * ── EL DEFECTO (7-ago-2026, REG-217 · reportado con captura) ────────────────
 *
 * El médico dictó una consulta completa. La nota salió así:
 *
 *     Padecimiento actual        →  «No especificado en esta consulta.»
 *     Exploración física         →  «No referida.»
 *     Plan de abordaje           →  «No referido.»
 *
 * Con el dictado entero delante, en el panel de material de origen.
 *
 * ── LA CAUSA: DOS REGLAS DEL PROMPT QUE SE CONTRADECÍAN ────────────────────
 *
 * La regla 15 ORDENABA escribir «No referido» / «No explorado en esta consulta»
 * en toda sección obligatoria sin contenido. La regla 1-bis lo PROHÍBE.
 *
 * El modelo obedecía a la 15. Y el guardián de contradicciones no lo cazaba
 * porque esas dos frases **no estaban en su lista**.
 *
 * ── EL MECANISMO, QUE ES LO QUE LO HACÍA IRREPARABLE ───────────────────────
 *
 * La nota se estructura sola cada 15 s mientras el médico habla. La PRIMERA
 * pasada ocurre cuando apenas se dictó la ficha de identificación → la regla 15
 * rellenaba TODAS las obligatorias con huecos escritos.
 *
 * Y entonces la guarda `if (enVivo && s.value?.trim()) return s` daba el hueco
 * por contenido: **ninguna pasada posterior podía corregirlo**. El médico
 * dictaba veinte minutos y la nota se quedaba con lo de los primeros quince
 * segundos.
 *
 * ── Y LO PEOR ──────────────────────────────────────────────────────────────
 *
 * La compuerta que impide firmar sólo comprueba `!s.value.trim()`. Una sección
 * que dice «No referido.» **la pasa**. La nota hueca quedaba firmable, con
 * cédula profesional.
 *
 * Es el mismo patrón que el recuadro naranja (REG-179/180): dos reglas del
 * prompt anulándose, y ninguna mal por su cuenta.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { seccionEsHueco, sinHuecoDeProsa } from '@/lib/expediente/hueco-textual'
import { validarNOM004 } from '@/lib/expediente/nom004'

const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

describe('la nota no sale hueca', () => {
  describe('los huecos exactos de la captura se reconocen', () => {
    it.each([
      'No especificado en esta consulta.',
      'No referida.',
      'No referido.',
      'No explorado en esta consulta.',
      'No se exploró en esta consulta',
      'No mencionado.',
    ])('«%s» es un hueco, no una sección escrita', frase => {
      expect(seccionEsHueco(frase)).toBe(true)
      expect(sinHuecoDeProsa(frase)).toBe('')
    })
  })

  describe('el negativo pertinente NO se borra', () => {
    it.each([
      'No refiere fiebre ni disnea.',
      'Cefalea de tres días de evolución.',
      'Paciente refiere dolor. No especificado el lado.',
      'Niega tabaquismo, niega etilismo.',
    ])('«%s» es un dato clínico y se conserva', frase => {
      /**
       * La regla 16 del prompt PIDE documentar los negativos pertinentes. Vaciar
       * por contención los borraría — y son de lo más valioso que tiene una nota.
       * Por eso se compara la sección ENTERA, no si contiene la frase.
       */
      expect(seccionEsHueco(frase)).toBe(false)
      expect(sinHuecoDeProsa(frase)).toBe(frase)
    })
  })

  describe('la compuerta de firma ve la sección hueca', () => {
    const nota = (valor: string) => ({
      metadata: { medicoId: 'm1', cedulaProfesional: '123' },
      fechaConsulta: '2026-08-07T10:00:00Z',
      tipo: 'primera_vez',
      resumen: 'x',
      diagnosticos: [{ descripcion: 'Faringitis' }],
      secciones: [{ key: 'exploracionFisica', label: 'Exploración física', obligatorio: true, value: valor }],
      signosVitales: { fc: 80 },
      medicamentos: [],
      alergias: [],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any

    it('ANTES: «No referida.» pasaba la compuerta — la nota hueca era firmable', () => {
      // Se conserva como prueba del defecto: si esto deja de valer, el saneo de
      // abajo estaría certificando algo distinto.
      expect(validarNOM004(nota('No referida.')).errores).toHaveLength(0)
    })

    it('AHORA: saneada, la compuerta la bloquea', () => {
      const errores = validarNOM004(nota(sinHuecoDeProsa('No referida.'))).errores
      expect(errores.length).toBeGreaterThan(0)
      expect(errores.join(' ')).toContain('Exploración física')
    })

    it('una sección con contenido real sigue pasando', () => {
      expect(validarNOM004(nota('Abdomen blando, sin datos de irritación peritoneal.')).errores)
        .toHaveLength(0)
    })
  })

  describe('la regla 15 ya no ordena lo contrario que la 1-bis', () => {
    const prompt = leer('src/lib/expediente/prompts.ts')

    it('la orden de escribir el hueco desapareció', () => {
      expect(prompt).not.toContain('escríbelo\n    explícitamente como "No referido"')
      expect(prompt).not.toContain('"No explorado en esta consulta" — NUNCA en blanco')
    })

    it('y ahora dice lo mismo que la 1-bis', () => {
      expect(prompt).toContain('la sección va VACÍA')
      expect(prompt).toContain('UNA SECCIÓN VACÍA ES INFORMACIÓN')
    })

    it('el guardián de contradicciones ya vigila estas dos frases', () => {
      // No las cazaba porque no estaban en su lista, y la contradicción vivió meses.
      const g = leer('src/__tests__/el-prompt-no-se-contradice.test.ts')
      expect(g).toContain("'no referido'")
      expect(g).toContain("'no explorado en esta consulta'")
    })
  })

  describe('ESTÁ CABLEADO', () => {
    const page = leer('src/app/(dashboard)/consulta/[patientId]/page.tsx')

    it('todo lo que llega a una sección pasa por el saneo del hueco', () => {
      /**
       * Eran dos sitios. Desde REG-226 son tres: se añadió un cálculo previo de
       * «qué escribió la IA» —para poder distinguir su texto del del médico— y
       * ése también tiene que sanear, o la anotación de procedencia guardaría el
       * hueco como si fuera contenido.
       *
       * Se comprueba el MÍNIMO, no la cifra exacta: la cifra exacta convierte
       * cualquier sitio nuevo en un fallo aunque esté bien escrito. Lo que no
       * puede bajar es la cobertura.
       */
      expect(page.split('sinHuecoDeProsa(').length - 1).toBeGreaterThanOrEqual(3)
    })

    it('el saneo va ANTES de la guarda del pase en vivo', () => {
      /**
       * El orden ES el arreglo: si el hueco se escribiera primero, quedaría
       * anotado como texto de la IA y sobreviviría a los pases siguientes.
       */
      const i = page.indexOf('const limpio = sinHuecoDeProsa(valorIA)')
      const j = page.indexOf('if (enVivo && loCambioElMedico) return s')
      expect(i).toBeGreaterThan(-1)
      expect(j).toBeGreaterThan(i)
    })

    it('la guarda del pase en vivo mira QUIÉN escribió, no si hay texto (REG-226)', () => {
      /**
       * LA FORMA VIEJA NO PUEDE VOLVER.
       *
       * `if (enVivo && s.value?.trim()) return s` congelaba el apartado en
       * cuanto CUALQUIERA escribía algo — incluido un pase anterior de la propia
       * IA, hecho con el modelo rápido y la consulta apenas empezada. Ninguna
       * pasada posterior podía corregirlo.
       *
       * Le pegaba justo al médico que dicta SALTANDO de tema: cuando regresaba a
       * antecedentes en el minuto diez, el apartado llevaba nueve minutos
       * congelado con la peor versión.
       *
       * La distinción correcta no es «vacío o lleno»: es quién lo escribió.
       */
      expect(page).not.toContain('if (enVivo && s.value?.trim()) return s')
      expect(page).toContain('const loPusoLaIa = seccionesDeLaIaRef.current[s.key]')
      expect(page).toContain('if (enVivo && loCambioElMedico) return s')
    })

    it('la anotación de procedencia se hace FUERA del actualizador de estado', () => {
      /**
       * React puede ejecutar un actualizador de estado dos veces. Anotar desde
       * dentro dejaría el registro de «esto lo escribió la IA» dependiendo de
       * cuántas veces corrió — y con él, la decisión de si el apartado se puede
       * corregir o no.
       */
      const anotar = page.indexOf('seccionesDeLaIaRef.current = { ...seccionesDeLaIaRef.current')
      const cierraSet = page.indexOf('setSecciones(prev => {')
      expect(anotar).toBeGreaterThan(cierraSet)
      expect(page).toContain('const loQueEscribeLaIa: Record<string, string> = {}')
    })
  })
})
