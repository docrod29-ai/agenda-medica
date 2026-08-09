/**
 * LA DURACIÓN QUE YA VENCIÓ — §D1 del charter.
 *
 * ── EL AGUJERO (7-ago-2026, REG-219) ────────────────────────────────────────
 *
 * Un antibiótico prescrito «7 días» hace un mes **seguía apareciendo como
 * vigente**. Para siempre. Porque nadie comparaba la duración con el calendario.
 *
 * Y de esa lista cuelgan el cruce de interacciones, el cruce alergia ↔ fármaco y
 * el motor de dosis: **motores de seguridad razonando sobre un paciente que no
 * existe**. Es el daño de REG-215 por otra puerta — allá lo decía el paciente,
 * aquí lo dice el calendario.
 *
 * ── LO QUE EL CHARTER PIDE, Y LA TERCERA FRASE ES LA QUE IMPORTA ───────────
 *
 *     «Cuando la duración expira: PROBABLY_COMPLETED. Pide reconciliación.
 *      NO lo marques completado en silencio.»
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DIAS_DE_GRACIA, diasDeDuracion, yaDebioTerminar } from '@/lib/expediente/duracion-cumplida'

const AHORA = Date.parse('2026-08-07T12:00:00Z')
const hace = (d: number) => new Date(AHORA - d * 86_400_000).toISOString()
const venció = (duracion: string, dias: number) =>
  yaDebioTerminar({ duracion, prescritoEn: hace(dias), ahoraMs: AHORA }).yaDebioTerminar

describe('la duración que ya venció', () => {
  describe('las duraciones que se dictan en un consultorio', () => {
    it.each([
      ['7 días', 7], ['10 dias', 10], ['siete días', 7], ['2 semanas', 14],
      ['un mes', 30], ['3 meses', 90], ['1 año', 365], ['quince días', 15],
    ])('«%s» → %i días', (d, esperado) => {
      expect(diasDeDuracion(d)).toBe(esperado)
    })
  })

  describe('lo crónico NO caduca', () => {
    it.each([
      'indefinido', 'permanente', 'crónico', 'de por vida',
      'hasta nueva indicación', 'continuo',
    ])('«%s» no tiene fecha de término', d => {
      /**
       * La metformina de un diabético no «termina» a los 30 días. Marcarla
       * llenaría el worklist de tareas falsas cada mes — y un worklist que se
       * llena se abandona, y entonces tampoco se ve la que sí importaba.
       */
      expect(diasDeDuracion(d)).toBeNull()
      expect(venció(d, 400)).toBe(false)
    })
  })

  describe('el caso real: el antibiótico de la consulta pasada', () => {
    it('«7 días» hace un mes → ya debió terminar', () => {
      expect(venció('7 días', 30)).toBe(true)
    })

    it('«7 días» hace 5 días → todavía lo está tomando', () => {
      expect(venció('7 días', 5)).toBe(false)
    })

    it('el margen de gracia evita avisar el día exacto', () => {
      /**
       * El paciente rara vez empieza el mismo día: surte la receta al día
       * siguiente, o el lunes. Avisar el día exacto produce tareas que el
       * médico cierra sin mirar.
       */
      expect(venció('7 días', 7 + DIAS_DE_GRACIA)).toBe(false)
      expect(venció('7 días', 7 + DIAS_DE_GRACIA + 1)).toBe(true)
    })
  })

  describe('ante la duda, se calla', () => {
    it.each([
      ['duración incontable', { duracion: 'hasta que se acabe el frasco', prescritoEn: hace(90) }],
      ['fecha ilegible', { duracion: '7 días', prescritoEn: 'basura' }],
      ['fecha futura', { duracion: '7 días', prescritoEn: hace(-5) }],
      ['sin duración', { duracion: '', prescritoEn: hace(90) }],
      ['sin nada', { duracion: null, prescritoEn: null }],
    ])('%s → no dice que venció', (_, p) => {
      /**
       * El error caro es decirle al médico que suspenda algo que el paciente
       * debe seguir tomando.
       */
      expect(yaDebioTerminar({ ...p, ahoraMs: AHORA } as never).yaDebioTerminar).toBe(false)
    })
  })

  describe('el estado nuevo dice lo que de verdad se sabe', () => {
    it('existe «probablemente_terminada», distinta de «terminada»', () => {
      const tipos = readFileSync(join(process.cwd(), 'src/types/expediente.ts'), 'utf8')
      expect(tipos).toContain("'probablemente_terminada'")
      // La distinción ES el arreglo: el sistema sabe que el calendario venció,
      // no que el paciente lo terminara.
      expect(tipos).toContain('NO lo marques completado en silencio')
    })
  })

  describe('ESTÁ CABLEADO', () => {
    const page = readFileSync(
      join(process.cwd(), 'src/app/(dashboard)/consulta/[patientId]/page.tsx'), 'utf8')

    it('al firmar se revisan las duraciones vencidas', () => {
      expect(page).toContain('yaDebioTerminar({')
    })

    it('abre TAREA, no cambia el expediente solo', () => {
      // §D1 y §C3: no elegir la verdad automáticamente.
      const i = page.indexOf('const vencidos = vigentes')
      const bloque = page.slice(i, i + 1400)
      expect(bloque).toContain('tareasDeReconciliacion')
      expect(bloque).not.toContain('setMedicamentos')
    })

    it('no avisa de lo que el médico está recetando HOY', () => {
      // Si lo tiene delante y lo prescribe, ya lo reconcilió con su criterio.
      const i = page.indexOf('const vencidos = vigentes')
      expect(page.slice(i, i + 400)).toContain('!medicamentos.some')
    })
  })
})
