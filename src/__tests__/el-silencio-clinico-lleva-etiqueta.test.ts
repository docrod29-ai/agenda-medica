/**
 * EL SILENCIO CLÍNICO LLEVA ETIQUETA, Y LA CUENTA IMPLAUSIBLE SE DICE.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * Cuatro hallazgos del Panel de Lujo (6-sep-2026) de la misma familia: un motor
 * que se calla, y el silencio leído como una afirmación.
 *
 *   MG-010 (P2)  La calculadora gestacional no tenía techo ni acotaba el ciclo.
 *                `gestacionPorFUM('2024-09-01', '2026-09-06')` devolvía
 *                «105 semanas · 3.º trimestre» con la misma cara de dato bueno
 *                que «32.4», y se podía pegar a la nota. Y un ciclo NEGATIVO no
 *                sólo desplazaba la fecha probable de parto: inflaba la edad
 *                gestacional 33 días sobre un embarazo real de 67.
 *   MG-021 (P2)  Tres hitos prenatales llevan una DOSIS dentro (ácido fólico,
 *                aspirina, inmunoglobulina anti-D) y la fuente vivía sólo en la
 *                cabecera del archivo; el motor está declarado
 *                `pendiente_validacion` en el registro y la pantalla no lo decía.
 *   MI-007 (P2)  Con ocho fármacos frecuentes, `detectarInteracciones` devuelve
 *                `[]` y nada acompañaba a ese vacío. Un arreglo vacío en una
 *                pantalla de interacciones se lee «no hay interacción»; lo que
 *                hay es que esos pares no están en el catálogo.
 *   MI-008 (P3)  «No toma el losartán desde hace un mes» no se reconocía como
 *                suspensión: la regla exigía un pronombre entre «no» y «toma».
 *   MI-013 (P3)  La farmacia del consultorio dispensaba sin cruzar la alergia
 *                del paciente: el lote caducado era su única guarda clínica.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Auditores M-ginecologa, M-internista y M-farmacia del Panel de Lujo; el
 * equipo rojo reprodujo los cinco con el código real y corrigió dos de las
 * premisas (MI-008 y MI-013 bajaron a P3 por eso).
 *
 * ── CAUSA RAÍZ ──────────────────────────────────────────────────────────────
 *
 * La misma en los cinco: un motor que devuelve su resultado sin devolver su
 * ALCANCE. Cuando la salida no dice de qué está hecha, el lector la completa —y
 * la completa con la conclusión tranquilizadora.
 *
 * ── LA REGLA ────────────────────────────────────────────────────────────────
 *
 * Regla 4 («ausencia de dato no es dato de ausencia») y regla 5 («los
 * vocabularios son vocabulario, no criterio: que falte un término significa que
 * ese caso NO se vigila»). Y regla 1 para MG-021: una dosis sin fuente al lado
 * no existe.
 *
 * ── QUÉ **NO** CUBRE ────────────────────────────────────────────────────────
 *
 * · No amplía el catálogo de interacciones ni por un par: qué pares entran es
 *   criterio clínico y lo decide el Dr. Aquí sólo se etiqueta el silencio.
 * · No confirma ninguna cifra de los hitos prenatales: las fuentes por renglón
 *   reparten la referencia que el registro ya declaraba para el conjunto. Cuál
 *   norma respalda cada cifra exacta sigue siendo NEEDS_CLINICAL_REVIEW.
 * · El techo de 45 semanas y el rango de ciclo 21-45 NO son puntos de corte
 *   clínicos —de embarazo prolongado ya habla `HITOS_PRENATALES` con [41, 42]—
 *   sino los límites en los que la cuenta sigue siendo una cuenta.
 * · MI-008: se reconocen más formas, no todas. Lo que sigue fuera está
 *   declarado en `LO_QUE_NO_RECONOCE_LA_CESACION` y esta prueba no lo persigue.
 * · MI-013: se comprueba el contrato del archivo, no un clic real. Que el
 *   diálogo aparezca de verdad en el navegador no lo mira esta suite.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  gestacionPorFUM, HITOS_PRENATALES, HITOS_PRENATALES_AVISO,
  TECHO_SEMANAS_PLAUSIBLES, CICLO_MINIMO_DIAS, CICLO_MAXIMO_DIAS,
} from '@/lib/expediente/ginecologia'
import {
  detectarInteracciones, coberturaDeclarada, PARES_VIGILADOS,
  LO_QUE_NO_VIGILA_FARMACOVIGILANCIA,
} from '@/lib/expediente/farmacovigilancia'
import { farmacosSoloMencionadosEnPasado } from '@/lib/expediente/el-farmaco-que-ya-no-toma'
import { herramientasDe } from '@/lib/herramientas-por-especialidad'

const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

describe('MG-010 · la cuenta gestacional dice cuándo no cuadra', () => {
  it('una FUM de hace dos años no sale como «3.º trimestre» y ya', () => {
    const g = gestacionPorFUM('2024-09-01', '2026-09-06')!
    /* La cifra SIGUE saliendo —no se corrige en silencio— pero acompañada. */
    expect(g.semanas).toBeGreaterThan(TECHO_SEMANAS_PLAUSIBLES)
    expect(g.aviso, 'salió sin aviso, como antes').toBeTruthy()
    expect(g.aviso).toMatch(/no corresponde a un embarazo en curso/)
  })

  it('un ciclo de 90 días no contamina la edad gestacional', () => {
    const normal = gestacionPorFUM('2026-07-01', '2026-09-06')!
    const raro = gestacionPorFUM('2026-07-01', '2026-09-06', 90)!
    expect(raro.diasTotales).toBe(normal.diasTotales)
    expect(raro.aviso).toMatch(new RegExp(`${CICLO_MINIMO_DIAS}-${CICLO_MAXIMO_DIAS}`))
  })

  it('un ciclo NEGATIVO ya no infla 33 días la gestación', () => {
    /*
     * El hallazgo del equipo rojo, literal: gestacionPorFUM(fum, hoy, -5) daba
     * 14 semanas 2 días sobre un embarazo real de 67 días (9.4).
     */
    const real = gestacionPorFUM('2026-07-01', '2026-09-06')!
    const conCicloAbsurdo = gestacionPorFUM('2026-07-01', '2026-09-06', -5)!
    expect(conCicloAbsurdo.diasTotales).toBe(real.diasTotales)
    expect(conCicloAbsurdo.semanas).toBe(9)
    expect(conCicloAbsurdo.aviso).toBeTruthy()
  })

  it('una cuenta normal NO lleva aviso — el guardián no grita de más', () => {
    /* AL REVÉS: si el aviso saliera siempre, el arreglo sería ruido. */
    const g = gestacionPorFUM('2026-02-01', '2026-09-06', 30)!
    expect(g.aviso).toBeUndefined()
    expect(g.semanas).toBeGreaterThan(20)
  })

  it('el panel no deja pegar a la nota una cuenta con aviso', () => {
    const panel = leer('src/components/PanelGineco.tsx')
    expect(panel).toMatch(/gest\.aviso \? \(/)
    expect(panel).toContain('No se puede agregar a la nota mientras la cuenta no cuadre.')
  })
})

describe('MG-021 · cada hito prenatal dice de dónde sale', () => {
  it('los once llevan fuente', () => {
    for (const h of HITOS_PRENATALES) {
      expect(h.fuente, h.titulo).toBeTruthy()
      expect(h.fuente.length, h.titulo).toBeGreaterThan(6)
    }
  })

  it('los cuatro que llevan una cantidad están marcados como tales', () => {
    /* Las tres dosis del hallazgo y, además, los 75 g de la curva de tolerancia:
       el guardián de abajo no puede distinguirlos mirando el texto, y a la
       paciente se le administran los cuatro. */
    const conDosis = HITOS_PRENATALES.filter(h => h.llevaDosis).map(h => h.titulo)
    expect(conDosis).toEqual([
      'Ácido fólico',
      'Aspirina si hay riesgo de preeclampsia',
      'Tamizaje de diabetes gestacional',
      'Inmunoglobulina anti-D si Rh negativo',
    ])
  })

  it('todo renglón con una cifra de dosis en el texto está marcado', () => {
    /*
     * AL REVÉS, y es lo que de verdad guarda: si alguien añade un hito con una
     * dosis dentro y no lo marca, esto se pone rojo. El patrón busca un número
     * seguido de una unidad de dosis en el detalle.
     */
    const conCifra = HITOS_PRENATALES.filter(h => /\d+\s*(?:µg|mcg|mg|g|UI)\b/.test(h.detalle))
    expect(conCifra.map(h => h.titulo).sort())
      .toEqual(HITOS_PRENATALES.filter(h => h.llevaDosis).map(h => h.titulo).sort())
  })

  it('el panel dice que el motor está pendiente de validación', () => {
    expect(HITOS_PRENATALES_AVISO).toMatch(/pendientes de validación/)
    const panel = leer('src/components/PanelGineco.tsx')
    expect(panel).toContain('HITOS_PRENATALES_AVISO')
    expect(panel).toMatch(/h\.hito\.fuente/)
  })
})

describe('MG-018 · el antibiograma vuelve a gineco-obstetricia', () => {
  it('está entre las herramientas por defecto del tronco', () => {
    const ids = herramientasDe('Ginecología y Obstetricia').map(h => h)
    expect(ids).toContain('antibiograma')
  })

  it('control: el arreglo NO fue darle todo el catálogo al tronco', () => {
    /*
     * Si «añadir el antibiograma» hubiera acabado en «que gineco vea todo», no
     * sería una reparación. Las herramientas de cirugía y de pediatría siguen
     * fuera; `esCasoQuirurgico` ya enciende la de cirugía cuando toca.
     */
    const ids = herramientasDe('Ginecología y Obstetricia')
    expect(ids).not.toContain('cirugia')
    expect(ids).not.toContain('pediatria')
    expect(ids).not.toContain('cardiometabolico')
  })
})

describe('MI-007 · el silencio del cruce de interacciones se etiqueta', () => {
  const OCHO = [
    'metformina', 'losartán', 'amlodipino', 'atorvastatina',
    'ácido acetilsalicílico', 'furosemida', 'levotiroxina', 'omeprazol',
  ].map(nombre => ({ nombre }))

  it('los ocho fármacos del hallazgo siguen sin disparar ninguna alerta', () => {
    /* Control: NO se ha ampliado el catálogo. Ése era el punto. */
    expect(detectarInteracciones(OCHO)).toEqual([])
  })

  it('pero el vacío ya no viaja solo', () => {
    const dicho = coberturaDeclarada(OCHO, detectarInteracciones(OCHO))!
    expect(dicho).toBeTruthy()
    expect(dicho).toContain(`${PARES_VIGILADOS} parejas vigiladas`)
    expect(dicho).toContain('NO significa que no haya')
  })

  it('con una alerta en pantalla no se dice nada: el silencio ya no es mudo', () => {
    /* AL REVÉS: si la declaración saliera siempre, sería ruido en cada receta. */
    expect(coberturaDeclarada(OCHO, [{ titulo: 'algo' }])).toBeNull()
  })

  it('con un solo fármaco tampoco: no hay pareja posible', () => {
    expect(coberturaDeclarada([{ nombre: 'metformina' }], [])).toBeNull()
  })

  it('la declaración nombra lo que NO mira', () => {
    expect(LO_QUE_NO_VIGILA_FARMACOVIGILANCIA).toMatch(/alimentos|suplementos/)
    expect(LO_QUE_NO_VIGILA_FARMACOVIGILANCIA).toMatch(/función renal/)
  })

  it('y llega a la barra de la consulta, no se queda en el módulo', () => {
    /* «El dato tiene que LLEGAR»: una declaración que nadie pinta no existe. */
    const avisos = leer('src/lib/expediente/avisos-consulta.ts')
    expect(avisos).toContain('coberturaInteracciones')
    expect(avisos).toContain("id: 'interacciones:cobertura'")
  })
})

describe('MI-008 · las formas de decir que ya no lo toma', () => {
  const VIGENTES = [{ nombre: 'Losartán 50 mg' }]

  it.each([
    'Ya no toma el losartán',
    'Dejó de tomar el losartán',
    'Se le suspendió el losartán',
    'No toma el losartán desde hace un mes',
    'No se ha tomado el losartán desde hace un mes',
    'Nunca se tomó el losartán que le receté',
    'Abandonó el losartán hace un mes',
  ])('«%s» se reconoce', (frase) => {
    expect(farmacosSoloMencionadosEnPasado(VIGENTES, frase)).toHaveLength(1)
  })

  it('AL REVÉS · «le receté amoxicilina hace tres días» sigue sin avisar (REG-374)', () => {
    /*
     * El control que no se puede perder: ese antibiótico está corriendo, y un
     * aviso aquí saldría en casi todas las consultas hasta enseñar a cerrarlo.
     */
    const r = farmacosSoloMencionadosEnPasado(
      [{ nombre: 'Amoxicilina 500 mg' }],
      'le receté amoxicilina hace tres días por la faringitis',
    )
    expect(r).toHaveLength(0)
  })
})

describe('MI-013 · la farmacia cruza la alergia antes de dispensar', () => {
  const src = leer('src/app/(dashboard)/farmacia/page.tsx')

  it('usa los motores que ya existen, no unos nuevos', () => {
    expect(src).toContain("from '@/lib/seguridad/alergias'")
    expect(src).toContain('validarAlergiasVsMedicamentos')
  })

  it('avisa y deja continuar, como con el lote caducado', () => {
    /* Bloquear la dispensación sería fijar política clínica: no toca aquí. */
    expect(src).toMatch(/tiene registrada alergia a/)
    expect(src).toMatch(/¿Dispensar de todos modos\?/)
  })

  it('un fallo al leer la ficha NO se lee como «sin alergias»', () => {
    expect(src).toContain('NO_SE_PUDO_LEER')
    expect(src).toMatch(/sale SIN cruzar alergias/)
  })
})
