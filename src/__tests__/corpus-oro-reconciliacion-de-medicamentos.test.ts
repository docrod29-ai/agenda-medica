/**
 * CORPUS ORO — RECONCILIACIÓN DE MEDICAMENTOS (§F3 del charter)
 *
 *     DISCREPANCIA → DUEÑO → REVISIÓN → RESOLUCIÓN → CERRADA
 *
 * ── EL AGUJERO QUE TAPA ─────────────────────────────────────────────────────
 *
 * El paciente dice «el losartán ya lo dejé» y el expediente sigue diciendo lo de
 * antes. Para siempre. Y de esa lista cuelgan el cruce de interacciones, el de
 * alergias, el motor de dosis y la receta que se imprime.
 *
 * Una lista desactualizada no es un dato viejo: es un **motor de seguridad
 * razonando sobre un paciente que no existe**.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { comoSeDice, discrepanciasDeMedicacion } from '@/lib/tareas-clinicas/reconciliacion'

const VIGENTES = [
  { nombre: 'Losartán', dosis: '50', unidad: 'mg' },
  { nombre: 'Metformina', dosis: '500', unidad: 'mg' },
  { nombre: 'Atorvastatina', dosis: '20', unidad: 'mg' },
]

const detectar = (dictado: string, recetadosHoy?: { nombre: string }[]) =>
  discrepanciasDeMedicacion({ dictado, vigentes: VIGENTES, recetadosHoy })

describe('corpus oro · reconciliación de medicamentos', () => {
  describe('el paciente dice que lo suspendió', () => {
    it.each([
      ['el losartán ya lo dejé', 'Losartán'],
      ['dejé de tomar la atorvastatina hace un mes', 'Atorvastatina'],
      ['me quitaron el losartán en el otro hospital', 'Losartán'],
      ['ya no tomo la metformina', 'Metformina'],
    ])('«%s» → discrepancia en %s', (frase, farmaco) => {
      const d = detectar(frase)
      expect(d).toHaveLength(1)
      expect(d[0].clase).toBe('ya_no_lo_toma')
      expect(d[0].farmaco).toBe(farmaco)
      // El aviso tiene que decir QUÉ hay en la lista, o no se puede reconciliar.
      expect(comoSeDice(d[0])).toContain('lista')
    })
  })

  describe('el paciente refiere otra dosis', () => {
    it('«la metformina me la subieron a 850» → dosis distinta', () => {
      /**
       * La forma normal de decirlo **no lleva unidad**. Exigirla dejaba pasar el
       * caso más frecuente de cambio de dosis entero — lo encontró medir frases
       * reales, no leer el módulo.
       */
      const d = detectar('la metformina me la subieron a 850')
      expect(d).toHaveLength(1)
      expect(d[0].clase).toBe('dosis_distinta')
      expect(d[0].loQueSeDijo).toContain('850')
      expect(d[0].enLaLista).toContain('500')
    })

    it('la misma dosis que ya está registrada NO es discrepancia', () => {
      expect(detectar('ahora tomo metformina 500')).toHaveLength(0)
    })
  })

  describe('los tres filtros que evitan el aviso inútil', () => {
    it('lo que le pasó a un FAMILIAR no toca la lista del paciente', () => {
      expect(detectar('a mi mamá le quitaron el losartán')).toHaveLength(0)
    })

    it('lo dicho con DUDA no contradice la lista', () => {
      // «Creo que ya no lo tomo» es una pregunta para el médico, no un hecho.
      expect(detectar('creo que ya no tomo la atorvastatina')).toHaveLength(0)
    })

    it('lo que el médico receta HOY ya está reconciliado', () => {
      // Si lo tiene delante y lo prescribe, ya lo decidió con su criterio.
      expect(detectar('el losartán ya lo dejé', [{ nombre: 'Losartán' }])).toHaveLength(0)
    })
  })

  describe('no inventa discrepancias', () => {
    it.each([
      'sigo tomando la metformina igual',
      'tomo metformina de 500',
      'la metformina la tomo de 500 como siempre',
      'dolor de cabeza desde hace tres días',
    ])('«%s» → ninguna', frase => {
      expect(detectar(frase)).toHaveLength(0)
    })

    it('sin lista vigente no hay nada que reconciliar', () => {
      expect(discrepanciasDeMedicacion({ dictado: 'ya lo dejé', vigentes: [] })).toHaveLength(0)
    })

    it('sin dictado tampoco', () => {
      expect(discrepanciasDeMedicacion({ dictado: '', vigentes: VIGENTES })).toHaveLength(0)
    })
  })

  describe('sobre una consulta entera', () => {
    it('separa las tres discrepancias sin repetir fármaco', () => {
      const dictado = [
        'Buenos días. El losartán ya lo dejé porque me mareaba.',
        'La metformina me la subieron a 850.',
        'Sigo con la atorvastatina igual.',
      ].join(' ')
      const d = detectar(dictado)
      expect(d).toHaveLength(2)
      expect(d.map(x => x.farmaco).sort()).toEqual(['Losartán', 'Metformina'])
    })
  })

  describe('ESTÁ CABLEADO', () => {
    /**
     * La familia de defecto más grande de este repositorio (9 de 62) es
     * «escrito, probado y sin conectar». Un motor perfecto que no corre en la
     * consulta no protege a nadie, y su corpus oro pasa en verde igual.
     */
    const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

    it('la consulta deriva tareas de reconciliación al firmar', () => {
      const page = leer('src/app/(dashboard)/consulta/[patientId]/page.tsx')
      expect(page).toContain('discrepanciasDeMedicacion')
      expect(page).toContain('tareasDeReconciliacion')
    })

    it('compara contra lo VIGENTE, no contra lo que se receta hoy', () => {
      // Una discrepancia contra algo escrito hace un minuto no es discrepancia.
      const page = leer('src/app/(dashboard)/consulta/[patientId]/page.tsx')
      expect(page).toContain('.filter(m => !m.deHoy)')
      expect(page).toContain('recetadosHoy')
    })

    it('la pantalla de pendientes sabe etiquetar el tipo nuevo', () => {
      // Sin etiqueta, la tarea aparece como «Pendiente» y nadie sabe qué es.
      expect(leer('src/app/(dashboard)/pendientes/page.tsx'))
        .toContain('reconciliacion_medicamento')
    })
  })

  describe('el sistema NO corrige la lista solo', () => {
    it('devuelve discrepancias para revisar, no cambios aplicados', () => {
      /**
       * §C3: no elegir la verdad automáticamente. El paciente puede
       * equivocarse, el reconocedor puede transcribir mal el nombre, y
       * suspender un anticoagulante es un acto médico.
       *
       * La forma del dato lo garantiza: no hay ningún campo que diga «aplicar».
       */
      const d = detectar('el losartán ya lo dejé')[0]
      expect(Object.keys(d).sort()).toEqual(
        ['clase', 'enLaLista', 'farmaco', 'frase', 'loQueSeDijo'],
      )
    })
  })
})
