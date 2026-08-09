/**
 * RESTAURAR NUNCA DEBE PODER TUMBAR LA PANTALLA.
 *
 * ── EL DEFECTO (7-ago-2026, REG-218 · «Algo se atoró en esta pantalla») ─────
 *
 * Reportado desde un iPhone, con el aviso de «Hay audio guardado de una sesión
 * anterior» justo antes.
 *
 * La consulta restaura estado de tres sitios —la nota de Firestore, el respaldo
 * local y la sesión guardada— y los tres guardan lo que había EL DÍA que se
 * escribieron. El código que los lee daba por hecha la forma de hoy:
 *
 *     setSignos(n.signosVitales ?? {})   ← con guarda
 *     setSecciones(n.secciones)          ← SIN guarda
 *     setDiagnosticos(n.diagnosticos)    ← SIN guarda
 *     setMedicamentos(n.medicamentos)    ← SIN guarda
 *
 * Alguien puso la guarda en uno y no en los otros tres.
 *
 * Y donde SÍ había comprobación era ésta:
 *
 *     if (Array.isArray(b.medicamentos)) setMedicamentos(b.medicamentos as Medicamento[])
 *
 * que valida **el contenedor, no los elementos**: un `null` dentro, o un
 * elemento de un esquema anterior, pasaba entero y tronaba igual.
 *
 * ── ALCANCE HONESTO DE ESTA PRUEBA ─────────────────────────────────────────
 *
 * No está confirmado que ÉSTE fuera el fallo del iPhone del Dr. — la excepción
 * real vive en `/superadmin/errores` y no se pudo leer desde aquí. Lo que sí
 * está confirmado es que **estos huecos existían y podían producir exactamente
 * ese síntoma**. Se reparan porque son defectos por sí mismos.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  diagnosticosSanos, medicamentosSanos, seccionesSanas,
} from '@/lib/expediente/nota-restaurada'

describe('restaurar no tumba la pantalla', () => {
  describe('lo que falta no deja el estado en undefined', () => {
    it.each([undefined, null, 'texto', 42, {}])('%s → arreglo vacío, no undefined', v => {
      // Es el fallo exacto: `undefined.map` revienta el render entero.
      expect(seccionesSanas(v)).toEqual([])
      expect(diagnosticosSanos(v)).toEqual([])
      expect(medicamentosSanos(v)).toEqual([])
    })
  })

  describe('un elemento con forma inesperada se descarta, no tumba la lista', () => {
    it('secciones: sobrevive lo pintable', () => {
      const r = seccionesSanas([
        null,
        { key: 'exploracionFisica', label: 'Exploración física', value: 'Abdomen blando' },
        { value: 'sin key ni label' },
        'una cadena suelta',
        { key: 'plan', label: 'Plan' },
      ])
      expect(r).toHaveLength(2)
      expect(r.map(s => s.key)).toEqual(['exploracionFisica', 'plan'])
    })

    it('diagnósticos: sin descripción no hay diagnóstico', () => {
      const r = diagnosticosSanos([
        null, { codigoCIE10: 'E11' }, { descripcion: 'Diabetes mellitus tipo 2', codigoCIE10: 'E11' },
      ])
      expect(r).toHaveLength(1)
      expect(r[0].descripcion).toBe('Diabetes mellitus tipo 2')
    })

    it('medicamentos: sin nombre no hay medicamento', () => {
      const r = medicamentosSanos([{ dosis: '500' }, null, { nombre: 'Metformina', dosis: '500' }])
      expect(r).toHaveLength(1)
      expect(r[0].nombre).toBe('Metformina')
    })

    it('un `value` que no es texto no revienta el render', () => {
      // Un esquema anterior guardaba objetos donde hoy va una cadena.
      const r = seccionesSanas([{ key: 'k', label: 'L', value: { texto: 'x' } }])
      expect(r).toHaveLength(1)
      expect(typeof r[0].value).toBe('string')
    })
  })

  describe('lo sano pasa intacto', () => {
    it('no se pierde nada de una nota bien formada', () => {
      const secciones = [{ key: 'a', label: 'A', value: 'contenido', obligatorio: true }]
      expect(seccionesSanas(secciones)).toHaveLength(1)
      expect(seccionesSanas(secciones)[0].obligatorio).toBe(true)
    })
  })

  describe('ESTÁ CABLEADO en los tres sitios que restauran', () => {
    const page = readFileSync(
      join(process.cwd(), 'src/app/(dashboard)/consulta/[patientId]/page.tsx'), 'utf8')

    it('la carga de la nota sanea los tres campos', () => {
      expect(page).toContain('setSecciones(seccionesSanas(n.secciones))')
      expect(page).toContain('setDiagnosticos(diagnosticosSanos(n.diagnosticos))')
      expect(page).toContain('setMedicamentos(medicamentosSanos(n.medicamentos))')
    })

    it('los dos caminos de respaldo también', () => {
      // Tres sitios con la misma regla, no tres reglas.
      expect(page.split('seccionesSanas(').length - 1).toBeGreaterThanOrEqual(3)
      expect(page.split('medicamentosSanos(').length - 1).toBeGreaterThanOrEqual(3)
    })

    it('ya no queda ningún casteo crudo del respaldo', () => {
      expect(page).not.toContain('b.secciones as NotaSeccion[]')
      expect(page).not.toContain('b.medicamentos as Medicamento[]')
      expect(page).not.toContain('b.diagnosticos as Diagnostico[]')
    })
  })

  describe('el trozo que no cargó se distingue, porque «Reintentar» no lo arregla', () => {
    const boundary = readFileSync(
      join(process.cwd(), 'src/app/(dashboard)/consulta/[patientId]/error.tsx'), 'utf8')

    it('el boundary reconoce las cuatro formas del error', () => {
      for (const f of ['chunkloaderror', 'loading chunk',
        'failed to fetch dynamically imported module', 'importing a module script failed']) {
        expect(boundary.toLowerCase()).toContain(f)
      }
    })

    it('para ese caso el botón principal RECARGA, no reintenta', () => {
      /**
       * `reset()` vuelve a renderizar el mismo árbol y el trozo sigue sin
       * estar. El médico pulsa, ve lo mismo, y concluye que la app se rompió.
       */
      expect(boundary).toContain('trozo ? (')
      // El botón de la rama del trozo dice «Recargar» a secas, y es el primario.
      const rama = boundary.slice(boundary.indexOf('trozo ? ('), boundary.indexOf(') : ('))
      expect(rama).toContain('location.reload()')
      expect(rama).toContain('Recargar')
      expect(rama).not.toContain('reset()')
    })

    it('se registra con un origen propio, para poder contarlos aparte', () => {
      expect(boundary).toContain("'boundary:consulta:chunk'")
    })
  })
})
