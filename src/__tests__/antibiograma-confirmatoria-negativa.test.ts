/**
 * GOLDEN — el resultado NEGATIVO de una confirmatoria se leía, se tipaba, se
 * transportaba hasta el motor… y se iba al suelo.
 *
 * ── EL FALLO, REPRODUCIDO CORRIENDO EL MOTOR ─────────────────────────────────
 *
 * Un *S. aureus* con **oxacilina R** en el panel y el **tamiz de cefoxitina
 * NEGATIVO** capturado del reporte producía esta nota:
 *
 *     Fenotipo: S. aureus resistente a meticilina (MRSA) [confirmado]
 *     Advertencias: MRSA: ignore cualquier β-lactámico reportado S…
 *     Aislamiento: Precauciones de contacto (MRSA).
 *     Notificación epidemiológica OBLIGATORIA.
 *     Pruebas por solicitar: Tamiz de cefoxitina…; D-zone test
 *
 * Tres defectos en una sola salida:
 *
 *  1. El negativo acababa en un `didactica` **que la nota no imprimía nunca**.
 *     Las dos afirmaciones convivían en el documento y la inferida ganaba en
 *     silencio — encima con confianza `confirmado`, que es exactamente la
 *     palabra que la prueba negativa desmiente.
 *  2. Se pedían las DOS pruebas cuyo resultado el médico acababa de capturar del
 *     propio reporte.
 *  3. Nada declaraba que las dos fuentes se contradicen.
 *
 * ── LO QUE ESTE CAMBIO **NO** HACE ───────────────────────────────────────────
 *
 * NO decide cuál gana. «Cefoxitina-neg contra oxacilina-R, ¿cuál manda?» es una
 * de las seis preguntas clínicas que el Dr. tiene pendientes, y sigue pendiente:
 * el fenotipo NO se toca, ni su confianza, ni el aislamiento, ni la
 * notificación. **NEEDS_CLINICAL_REVIEW.**
 *
 * Lo que un programa sí puede hacer sin decidir nada es no dejar que las dos
 * afirmaciones convivan calladas.
 */
import { describe, it, expect } from 'vitest'
import { interpretarAntibiograma } from '@/lib/expediente/antibiograma/motor'
import { resumenParaNota } from '@/lib/expediente/antibiograma/resumen-nota'
import { pruebasPendientes } from '@/lib/expediente/antibiograma/clsi-pruebas'
import { conflictosConfirmatorias } from '@/lib/expediente/antibiograma/confirmatorias'
import type { EntradaAntibiograma } from '@/lib/expediente/antibiograma/tipos'

/** El caso exacto: el panel dice MRSA, el reporte dice que la cefoxitina salió negativa. */
const CASO: EntradaAntibiograma = {
  organismo: 'Staphylococcus aureus', sitio: 'sangre',
  resultados: [
    { antibiotico: 'Oxacilina', interpretacion: 'R' },
    { antibiotico: 'Vancomicina', interpretacion: 'S' },
    { antibiotico: 'Eritromicina', interpretacion: 'R' },
    { antibiotico: 'Clindamicina', interpretacion: 'S' },
  ],
  pruebas: { cefoxitinaScreen: 'neg', dTest: 'neg' },
}

describe('EL CASO QUE SE ROMPÍA: cefoxitina negativa junto a MRSA inferido', () => {
  const r = interpretarAntibiograma(CASO)
  const nota = resumenParaNota(CASO, r)

  it('el conflicto se DECLARA, y nombra las dos fuentes', () => {
    const conflicto = r.alertas.find(a => a.mensaje.includes('CONFLICTO') && a.mensaje.includes('cefoxitina'))
    expect(conflicto, 'sin esto, las dos afirmaciones conviven calladas').toBeDefined()
    expect(conflicto!.mensaje).toMatch(/NEGATIVO/)
    expect(conflicto!.mensaje).toMatch(/patrón S\/I\/R/)
  })

  it('sale como ALERTA y no enterrado en el párrafo de advertencias', () => {
    /**
     * Las advertencias se imprimen concatenadas: una contradicción entre el
     * laboratorio y el motor a mitad de un párrafo se lee igual que un consejo
     * de stewardship, y no lo es.
     */
    expect(r.alertas.some(a => a.nivel === 'alta' && a.mensaje.includes('CONFLICTO'))).toBe(true)
    expect(r.advertencias.join(' ')).not.toContain('CONFLICTO')
  })

  it('y llega a la NOTA, que es lo que queda en el expediente', () => {
    expect(nota).toMatch(/CONFLICTO/)
    expect(nota).toMatch(/tamiz de cefoxitina\/oxacilina NEGATIVO/)
  })

  it('el D-test negativo también, que era el segundo caso', () => {
    expect(r.alertas.some(a => a.mensaje.includes('CONFLICTO') && a.mensaje.includes('D-test'))).toBe(true)
  })

  it('la didáctica del negativo deja de perderse en la nota', () => {
    // Existía, estaba citada, se enseñaba en pantalla, y la nota no la imprimía.
    expect(r.didactica.map(d => d.titulo)).toContain('Tamiz de cefoxitina negativo')
    expect(nota).toContain('Tamiz de cefoxitina negativo')
    expect(nota).toMatch(/No hay mecA/)
    expect(nota).toMatch(/D-test negativo/)
  })

  it('ya NO se piden las dos pruebas que el reporte trae', () => {
    expect(r.pruebasSugeridas.map(p => p.id)).not.toContain('CEFOXITINA_MRSA')
    expect(r.pruebasSugeridas.map(p => p.id)).not.toContain('D_ZONE')
    expect(nota).not.toMatch(/Pruebas por solicitar:.*cefoxitina/)
  })

  it('pero tampoco desaparecen en silencio: se dice que ya vienen', () => {
    /**
     * Un recorte invisible no deja distinguir «no aplicaba» de «ya estaba
     * hecha», y son dos cosas distintas para quien lee la nota en seis meses.
     */
    expect(r.pruebasYaReportadas?.map(p => p.id).sort()).toEqual(['CEFOXITINA_MRSA', 'D_ZONE'])
    expect(nota).toMatch(/Ya vienen en el reporte \(no se piden de nuevo\)/)
  })

  it('LO QUE NO CAMBIA: la resolución clínica sigue siendo del Dr.', () => {
    /**
     * NEEDS_CLINICAL_REVIEW. Si esta prueba se pone roja porque alguien decidió
     * que el negativo degrada o cancela el fenotipo, esa decisión tiene que
     * venir del médico, no de un refactor.
     */
    const mrsa = r.fenotipos.find(f => f.clave === 'MRSA')
    expect(mrsa, 'el fenotipo NO se toca').toBeDefined()
    expect(mrsa!.confianza).toBe('confirmado')
    expect(r.aislamiento).toMatch(/MRSA/)
    expect(r.notificacionObligatoria).toBe(true)
  })
})

describe('EL CONTROL: sin contradicción no se inventa una', () => {
  it('cefoxitina POSITIVA con MRSA inferido no genera conflicto', () => {
    const r = interpretarAntibiograma({ ...CASO, pruebas: { cefoxitinaScreen: 'pos' } })
    expect(r.alertas.some(a => a.mensaje.includes('CONFLICTO'))).toBe(false)
  })

  it('cefoxitina negativa SIN fenotipo MRSA tampoco', () => {
    const r = interpretarAntibiograma({
      organismo: 'Staphylococcus aureus', sitio: 'sangre',
      resultados: [{ antibiotico: 'Oxacilina', interpretacion: 'S' }, { antibiotico: 'Vancomicina', interpretacion: 'S' }],
      pruebas: { cefoxitinaScreen: 'neg' },
    })
    expect(r.alertas.some(a => a.mensaje.includes('CONFLICTO'))).toBe(false)
  })

  it('sin pruebas capturadas, todo sigue exactamente igual que antes', () => {
    const sinPruebas = { ...CASO, pruebas: undefined }
    const r = interpretarAntibiograma(sinPruebas)
    expect(r.alertas.some(a => a.mensaje.includes('CONFLICTO'))).toBe(false)
    expect(r.pruebasSugeridas.map(p => p.id)).toContain('CEFOXITINA_MRSA')
    expect(r.pruebasYaReportadas).toEqual([])
  })

  it('la función de conflictos es pura y no se inventa nada sin datos', () => {
    expect(conflictosConfirmatorias([], undefined)).toEqual([])
    expect(conflictosConfirmatorias([{ clave: 'MRSA', nombre: 'x' }], {})).toEqual([])
  })
})

describe('un resultado INDETERMINADO no cierra la pregunta', () => {
  it('si la prueba no trae pos ni neg, se sigue pidiendo', () => {
    /**
     * `pruebasDesdeReporte` deja la clave fuera cuando el texto del laboratorio
     * no es interpretable. Tratar «no sé» como «ya está» perdería la prueba.
     */
    const { pedir, yaReportadas } = pruebasPendientes('Staphylococcus aureus', ['MRSA'], {})
    expect(pedir.map(p => p.id)).toContain('CEFOXITINA_MRSA')
    expect(yaReportadas).toEqual([])
  })
})

describe('las pruebas que responden OTRA pregunta se siguen pidiendo', () => {
  it('con carbapenemasa positiva sin clase, el molecular sigue en la lista', () => {
    /**
     * `CARBA_NP`/`mCIM_eCIM` responden «¿hay carbapenemasa?» y ya está contestado.
     * `MOLECULAR`/`INMUNOCROMATOGRAFIA` responden «¿de qué CLASE?», que es lo que
     * elige el inhibidor — filtrarlas sería recortar de más.
     */
    const r = interpretarAntibiograma({
      organismo: 'Klebsiella pneumoniae', sitio: 'sangre',
      resultados: [{ antibiotico: 'Meropenem', interpretacion: 'R' }, { antibiotico: 'Ceftriaxona', interpretacion: 'R' }],
      pruebas: { carbapenemasa: 'pos' },
    })
    const ids = r.pruebasSugeridas.map(p => p.id)
    expect(ids).toContain('MOLECULAR')
    expect(ids).not.toContain('CARBA_NP')
    expect(r.pruebasYaReportadas?.map(p => p.id)).toContain('CARBA_NP')
  })
})
