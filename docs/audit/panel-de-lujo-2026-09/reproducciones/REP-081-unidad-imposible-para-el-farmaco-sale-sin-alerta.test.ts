/**
 * REP-081 · RT-003 (equipo rojo, ataques propios) — «Digoxina 250 mg» y
 * «Enoxaparina 60 mcg» —el factor de MIL que el propio módulo nombra como su
 * motivo de existir— salen impresas sin una sola alerta y sin un solo motivo de
 * confirmación: la unidad sólo se vigila cuando FALTA, nunca cuando es
 * imposible para ese fármaco.
 *
 * ── QUÉ FALLA ────────────────────────────────────────────────────────────────
 * Tres huecos, cada uno con su línea:
 *  · `src/lib/seguridad/dosis.ts:499-522`, `revisarUnidadDosis`: sólo devuelve
 *    alerta para `sin_cifra` y `sin_unidad`. La clase `masa` (:470-476) se da
 *    por completa aunque la unidad sea imposible para ese fármaco. Digoxina,
 *    fentanilo, clonidina y levonorgestrel están nombrados uno por uno en el
 *    comentario que justifica el módulo (:411-412) y ninguno está en
 *    `CATALOGO` (:70-107, once fármacos).
 *  · `revisarDosis` (:169) con un fármaco fuera de `CATALOGO` devuelve
 *    `sin_referencia` de severidad `info`, la más baja — y el llamador real
 *    (`receta/[patientId]/[notaId]/page.tsx:241`) la FILTRA para «no saturar».
 *  · `src/lib/asr/pipeline.ts:110-122`: la compuerta de ambigüedad sólo levanta
 *    `dosis_o_unidad_ambigua` cuando el propio pipeline alteró algo. Si el
 *    reconocedor oyó «microgramos» y nadie lo corrigió, no hay violación que
 *    traducir. `PARES_PROHIBIDOS` mg↔mcg (politica-critica.ts:64) impide que el
 *    corrector haga el cambio; no comprueba que la unidad dictada sea posible.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 * Equipo rojo, RT-003 (`crudos/R-ataques-propios.json`), sobre los módulos
 * reales con jiti. Salida literal:
 *   Enoxaparina 60 mcg → extraerMg 0.06, alertasDosis [sin_referencia:info], alertaUnidad null
 *   Digoxina 250 mg    → extraerMg 250,  alertasDosis [sin_referencia:info], alertaUnidad null
 *   Metformina 850 g   → 3 alertas (dosis_extrema:critica, sobre_maximo_dosis:critica, sobre_maximo_diario:alta)
 *   procesarTranscript('Digoxina 250 miligramos cada 24 horas') → motivos: []
 * Emparentado con REG-043 (OPEN: el catálogo no se amplía sin datos del
 * médico) y MP-004 (R-M-pediatra).
 *
 * ── CAUSA RAÍZ ───────────────────────────────────────────────────────────────
 * El motor vigila la MAGNITUD contra un catálogo de once fármacos y la
 * AUSENCIA de unidad como hecho del texto; no vigila la DIMENSIÓN (mg vs mcg)
 * como hecho del fármaco. Fuera del catálogo, la única salida es un `info` que
 * el llamador descarta.
 *
 * ── REGLA ────────────────────────────────────────────────────────────────────
 * clinical-safety §1 (nunca inventar una cifra: por eso aquí NO se propone
 * ningún rango, sólo se exige UNA señal) y §5 (señalar de menos, nunca de más:
 * la ausencia de aviso no es aprobación; el propio archivo lo declara en su
 * cabecera «AUSENCIA de alerta ≠ dosis segura»). voice-asr: el par mg↔mcg es
 * «factor de MIL» en `PARES_PROHIBIDOS`.
 *
 * ── TIPO DE PRUEBA ───────────────────────────────────────────────────────────
 * COMPORTAMIENTO, motores puros reales. Para cada renglón atacado se recorren
 * los TRES caminos que el producto tiene (`revisarUnidadDosis`, `revisarDosis`
 * por la vía exacta de la receta, `procesarTranscript`) y se exige que AL MENOS
 * UNO produzca una señal por encima de `info`: una alerta `alta`/`critica` o
 * un motivo de confirmación. NO se fija cuál ni con qué texto: la lista de qué
 * fármaco vive en qué escala es NEEDS_CLINICAL_REVIEW y la aporta el médico
 * dueño. Se prueba AL REVÉS: con la unidad correcta («Digoxina 250 mcg»,
 * «Enoxaparina 60 mg») los mismos caminos deben seguir callados, o el aviso
 * se vuelve ruido; y el control positivo «Metformina 850 g» demuestra que la
 * cadena sí sabe gritar cuando el fármaco está en el catálogo.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 * No cubre el volumen sin concentración («Insulina glargina 10 mL»: MP-005,
 * REP-001). No cubre la infradosificación dentro de la misma unidad
 * («Paracetamol 1 mg»): no hay mínimo terapéutico en el motor y ponerlo es una
 * cifra clínica. No cubre la unidad que el reconocedor oyó MAL: sólo el sesgo
 * de vocabulario actúa antes. No cubre que la receta PINTE la alerta
 * (`receta/page.tsx:241` filtra `sin_referencia`): si la reparación elige
 * subir `sin_referencia` a `alta`, ese filtro tiene su propia prueba.
 */
import { describe, it, expect } from 'vitest'
import { revisarUnidadDosis, revisarDosis, extraerMg, esDosisPorKg, type AlertaDosis } from '@/lib/seguridad/dosis'
import { cantidad } from '@/types/clinical-quantity'
import { procesarTranscript } from '@/lib/asr/pipeline'

/** La vía EXACTA de la receta (receta/[patientId]/[notaId]/page.tsx:227-241), sin el filtro final. */
function alertasComoLaReceta(farmaco: string, dosis: string): AlertaDosis[] {
  const out: AlertaDosis[] = []
  const unidad = revisarUnidadDosis(farmaco, dosis)
  if (unidad) out.push(unidad)
  const mg = extraerMg(dosis)
  if (mg == null) return out
  const prescrita = esDosisPorKg(dosis)
    ? cantidad(mg, 'mg/kg/dosis', 'dosis_por_peso')
    : cantidad(mg, 'mg', 'masa')
  out.push(...revisarDosis({ farmaco, dosis: prescrita, tomasDia: 1 }))
  return out
}

/** Señales por encima de `info` en los tres caminos. Vacío = el renglón sale en silencio. */
function señales(farmaco: string, dosis: string, dictado: string): string[] {
  const s: string[] = []
  for (const a of alertasComoLaReceta(farmaco, dosis)) {
    if (a.severidad !== 'info') s.push(`${a.codigo}:${a.severidad}`)
  }
  for (const m of procesarTranscript(dictado).motivos) s.push(`motivo:${m}`)
  return s
}

describe('REP-081 · una unidad imposible para el fármaco produce al menos una señal', () => {
  it('control positivo: «Metformina 850 g» (en catálogo) levanta alertas críticas', () => {
    const s = señales('Metformina', '850 g', 'Metformina 850 gramos cada 12 horas')
    expect(s.length).toBeGreaterThanOrEqual(3)
    expect(s.some(x => x.endsWith(':critica'))).toBe(true)
  })

  it('control: fuera del catálogo la cadena sólo sabe decir `sin_referencia:info`, y el llamador lo filtra', () => {
    const digoxina = alertasComoLaReceta('Digoxina', '250 mg')
    expect(digoxina.map(a => `${a.codigo}:${a.severidad}`)).toContain('sin_referencia:info')
    expect(extraerMg('60 mcg')).toBeCloseTo(0.06, 5)   // la milésima parte de la profilaxis
  })

  it('HOY FALLA: «Digoxina 250 mg» (mil veces la escala del digitálico) no puede salir sin ninguna señal', () => {
    const s = señales('Digoxina', '250 mg', 'Digoxina 250 miligramos cada 24 horas')
    expect(s, 'ni alerta alta/crítica ni motivo de confirmación: el renglón se imprime en silencio').not.toEqual([])
  })

  it('HOY FALLA: «Enoxaparina 60 mcg» (la milésima parte del anticoagulante) no puede salir sin ninguna señal', () => {
    const s = señales('Enoxaparina', '60 mcg', 'Le doy enoxaparina 60 microgramos subcutánea cada 24 horas')
    expect(s, 'ni alerta alta/crítica ni motivo de confirmación: el renglón se imprime en silencio').not.toEqual([])
  })

  it('probada al revés: con la unidad correcta los mismos caminos siguen callados (o el aviso se vuelve ruido)', () => {
    expect(señales('Digoxina', '250 mcg', 'Digoxina 250 microgramos cada 24 horas')).toEqual([])
    expect(señales('Enoxaparina', '60 mg', 'Le doy enoxaparina 60 miligramos subcutánea cada 24 horas')).toEqual([])
  })
})
