/**
 * NADIE FIRMA SIN NOMBRE — GP-FINAL · REG-336.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Recorriendo el consultorio en un navegador de verdad (Golden Path GP-FINAL,
 * `scripts/golden-path/`), como médico y de punta a punta: agenda → consulta →
 * dictado → firma → receta → **entrega al paciente**.
 *
 * La nota se firmó. La receta salió. Y el botón «Liberar al paciente» estaba
 * APAGADO, con este mensaje debajo:
 *
 *     «Esta nota no tiene firma con cédula profesional:
 *      no hay a quién atribuir el papel.»
 *
 * Con la cédula PUESTA. El documento en Firestore la tenía:
 *
 *     firma: { nombreMedico: '', cedulaProfesional: '12345678', … }
 *
 * Lo que faltaba era el NOMBRE. El mensaje mandaba al médico a arreglar lo
 * único que no estaba roto.
 *
 * ── LA CAUSA RAÍZ: DOS COMPUERTAS QUE NO PIDEN LO MISMO ─────────────────────
 *
 * `validarNOM004` exige `medicoId` y `cedulaProfesional`. **No exige el
 * nombre.**
 * `componerPaquete` exige `firma.nombreMedico` **y** `firma.cedulaProfesional`.
 *
 * Entre las dos queda un hueco por el que se cuela una nota firmable e
 * inservible. Y `nota.firma` es un **snapshot inmutable**: cuando el hueco se
 * nota, ya no se puede tapar. El médico se queda con una nota válida en el
 * expediente y un paciente que no recibirá nunca su hoja, sin más recurso que
 * repetir la consulta.
 *
 * Cómo se llega ahí sin hacer nada raro: un consultorio cuya configuración
 * todavía no tiene `nombreMedico` —recién creado, o creado por el atajo de
 * «Falta cédula profesional», que escribe con `saveConfigPartial` SÓLO la
 * cédula— firma con `identidadFirma.nombre === ''`.
 *
 * ── LA FAMILIA ──────────────────────────────────────────────────────────────
 *
 * Es la de REG-189 y la del aviso de dosis: **el aviso llegaba después de
 * firmar, cuando la nota ya es inmutable**. La misma cura: decirlo ANTES, en el
 * único momento en que todavía se puede arreglar.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * Lo que el snapshot inmutable va a necesitar, se exige ANTES de estamparlo.
 * Firmar sin nombre no se «avisa»: se impide, y se dice por qué.
 *
 * ── QUÉ **NO** CUBRE ────────────────────────────────────────────────────────
 *
 * - No prueba la pantalla: prueba las funciones puras que la pantalla usa y el
 *   hecho de que las use. El recorrido en navegador vive en
 *   `scripts/golden-path/` y no corre en CI (necesita emuladores + build).
 * - No repara las notas YA firmadas sin nombre. Son inmutables por diseño; lo
 *   único que se hace por ellas es que el mensaje diga la verdad sobre qué les
 *   falta, para que nadie busque una cédula que sí está.
 * - No opina sobre qué nombre debe usarse cuando hay varios médicos: de eso ya
 *   se ocupa `identidadFirma` bloqueando la cédula si no resuelve quién firma.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  motivosParaNoFirmar,
  sePuedeFirmar,
  porQueNoSePuedeFirmar,
} from '@/lib/expediente/por-que-no-se-firma'
import { componerPaquete } from '@/lib/paciente/paquete-de-visita'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')

/** Una nota firmada, con lo mínimo que `componerPaquete` mira. */
const notaFirmada = (firma: Record<string, unknown> | null) => ({
  id: 'nota-gp-final',
  estado: 'firmada',
  fechaConsulta: '2026-08-27T10:00:00.000Z',
  diagnosticos: [{ descripcion: 'Gastritis aguda' }],
  medicamentos: [],
  firma,
})

describe('nadie firma sin nombre — REG-336', () => {
  describe('la compuerta de la firma exige a QUIÉN se le atribuye', () => {
    it('sin nombre de quien firma, no se puede firmar', () => {
      /**
       * Ésta es la que muerde. Probada al revés: si se quita el motivo nuevo de
       * `motivosParaNoFirmar`, este caso cae — que es exactamente el estado en
       * el que el Golden Path encontró el producto.
       */
      expect(sePuedeFirmar({ sinQuienFirma: true })).toBe(false)
    })

    it('el motivo se DICE, y nombra lo que falta de verdad', () => {
      const texto = porQueNoSePuedeFirmar({ sinQuienFirma: true })
      // Un botón gris sin explicación es la peor forma de decir que no.
      expect(texto).not.toBe('')
      expect(texto.toLowerCase()).toContain('nombre')
      // Y NO puede mandar a arreglar la cédula, que es lo que hacía el mensaje
      // de `componerPaquete` y lo que hizo perder el tiempo en el recorrido.
      expect(texto.toLowerCase()).not.toContain('cédula profesional del médico')
    })

    it('el motivo viaja con su origen, para que la pantalla lo agrupe', () => {
      const m = motivosParaNoFirmar({ sinQuienFirma: true })
      expect(m).toHaveLength(1)
      expect(m[0].origen).toBe('atribucion')
    })

    it('con otros motivos delante, el que se ENSEÑA sigue siendo el del nombre', () => {
      // Si no, el médico rellena secciones una por una y sólo al final descubre
      // que le faltaba algo que ni siquiera está en esta pantalla.
      const texto = porQueNoSePuedeFirmar({
        sinQuienFirma: true,
        erroresNOM004: ['Falta: Exploración física'],
        dosisIncompletas: [{ nombre: 'Omeprazol', mensaje: 'Falta la dosis' }],
      })
      expect(texto.toLowerCase()).toContain('nombre')
    })

    it('con nombre, este motivo desaparece y no estorba a los demás', () => {
      expect(motivosParaNoFirmar({ sinQuienFirma: false })).toHaveLength(0)
      // Y no se come los motivos que ya existían.
      const conNOM = motivosParaNoFirmar({
        sinQuienFirma: false,
        erroresNOM004: ['Falta: Exploración física'],
      })
      expect(conNOM).toHaveLength(1)
      expect(conNOM[0].origen).toBe('nom004')
    })

    it('el motivo nuevo se SUMA a los viejos, no los sustituye', () => {
      const m = motivosParaNoFirmar({
        sinQuienFirma: true,
        erroresNOM004: ['Falta: Exploración física'],
        dosisIncompletas: [{ nombre: 'Omeprazol', mensaje: 'Falta la dosis' }],
      })
      /**
       * La atribución va PRIMERA a propósito: `porQueNoSePuedeFirmar` enseña el
       * primer motivo y remata con «y N más arriba». Las secciones y las dosis
       * SÍ están arriba en esa pantalla; el nombre de quien firma vive en
       * Configuración. Puesto el último, el único motivo que el médico no podía
       * encontrar solo era también el único que el mensaje nunca le enseñaba.
       */
      expect(m.map(x => x.origen)).toEqual(['atribucion', 'nom004', 'dosis'])
    })
  })

  describe('la pantalla de la consulta USA la compuerta', () => {
    /**
     * «Escrito y sin conectar» es la familia más cara de este repositorio: la
     * compuerta puede estar perfecta y no cambiar nada si nadie la llama. Se
     * comprueba que la consulta le pase el dato, y que lo saque de la MISMA
     * identidad que va a estampar en el snapshot.
     */
    const PAGINA = leer('src', 'app', '(dashboard)', 'consulta', '[patientId]', 'page.tsx')

    it('la consulta le pasa `sinQuienFirma` a la compuerta', () => {
      expect(PAGINA).toContain('sinQuienFirma')
    })

    it('el dato sale de `identidadFirma`, que es lo que se estampa al firmar', () => {
      // Si saliera de otro sitio, la compuerta vigilaría un valor distinto del
      // que acaba dentro de `nota.firma`, y volveríamos al hueco de origen.
      expect(PAGINA).toMatch(/sinQuienFirma:\s*!identidadFirma\.nombre\.trim\(\)/)
      expect(PAGINA).toMatch(/nombreMedico:\s*identidadFirma\.nombre/)
    })
  })

  describe('el mensaje de la entrega dice la verdad sobre lo que falta', () => {
    it('una nota sin nombre no compone paquete (la compuerta de abajo sigue)', () => {
      const r = componerPaquete({
        // Fixture mínimo: `componerPaquete` sólo mira estado, firma, diagnósticos
        // y medicamentos, y `EntradaDelPaquete` los admite laxos a propósito.
        nota: notaFirmada({ nombreMedico: '', cedulaProfesional: '12345678' }),
        medicacionPrevia: null,
        alergias: null,
      })
      expect(r.ok).toBe(false)
    })

    it('y una sin cédula tampoco', () => {
      const r = componerPaquete({
        // Fixture mínimo: `componerPaquete` sólo mira estado, firma, diagnósticos
        // y medicamentos, y `EntradaDelPaquete` los admite laxos a propósito.
        nota: notaFirmada({ nombreMedico: 'Dra. Elena Sandoval Rivas', cedulaProfesional: '' }),
        medicacionPrevia: null,
        alergias: null,
      })
      expect(r.ok).toBe(false)
    })

    it('el texto que se le enseña al médico no culpa sólo a la cédula', () => {
      /**
       * El mensaje decía «no tiene firma con cédula profesional» con la cédula
       * puesta. Mandar al médico a revisar lo único que no está roto es peor que
       * no decirle nada: gasta el rato que tiene al paciente delante.
       */
      const RUTA = leer('src', 'app', 'api', 'expediente', 'paquete-de-visita', 'route.ts')
      const linea = RUTA.split('\n').find(l => l.includes("'nota-sin-firma':")) ?? ''
      expect(linea).toContain('nombre')
    })
  })
})
