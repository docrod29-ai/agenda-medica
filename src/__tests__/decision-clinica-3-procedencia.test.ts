/**
 * GOLDEN — decisión 3 del Dr. (3-ago-2026): cuándo el motor puede EDITAR la
 * categoría del laboratorio.
 *
 * Fuente: `docs/maintenance/DECISIONES-CLINICAS-2026-08-03.md`.
 *
 * ── LA PREGUNTA ──────────────────────────────────────────────────────────────
 *
 * La CMI dice R y el reporte dice S. ¿Edita o sólo advierte? Hasta ahora **sólo
 * advertía**: mostraba las dos y resaltaba en ámbar, y la categoría que arrastra
 * el razonamiento seguía siendo la del laboratorio.
 *
 * Respuesta del Dr.: **B condicionada**. Edita, pero SÓLO con la procedencia
 * plenamente verificada — los ocho campos. CLSI reconoce que un equipo comercial
 * puede usar cortes de la FDA, de otra edición, o sin actualizar; recalcular sin
 * comprobarlo **no corrige un error, inventa una resistencia**.
 *
 * Y descartó la corrección asimétrica «sólo hacia lo más restrictivo»: no es una
 * regla de CLSI y puede crear falsas resistencias. Corregir en una sola
 * dirección no es prudencia, es sesgo.
 *
 * ── LA CONSECUENCIA QUE HAY QUE MIRAR DE FRENTE ──────────────────────────────
 *
 * El extractor de la foto NO captura el estándar ni su edición: no vienen
 * impresos en la mayoría de los reportes. Así que, mientras el médico no los
 * declare, **el motor no edita nunca**. No es un defecto de la implementación:
 * es la consecuencia correcta de la regla. Editar por omisión es justo lo que la
 * decisión prohíbe.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { interpretarAntibiograma } from '@/lib/expediente/antibiograma/motor'
import {
  verificarProcedencia, mismaEdicion, edicionesPorPuntoDeCorte, avisoBloqueo,
  POR_QUE_NO_SE_EDITA_SIN_VERIFICAR, POR_QUE_NO_LA_CORRECCION_ASIMETRICA, ALCANCE_DEL_BLOQUEO,
  type ProcedenciaAntibiograma,
} from '@/lib/expediente/antibiograma/procedencia'
import type { EntradaAntibiograma } from '@/lib/expediente/antibiograma/tipos'

/** Meropenem CMI 16 en *E. coli*: el corte da R y el laboratorio reportó S. */
const DISCORDANTE: EntradaAntibiograma = {
  organismo: 'Escherichia coli', sitio: 'sangre',
  resultados: [{ antibiotico: 'Meropenem', interpretacion: 'S', cmi: 16 }],
}
const COMPLETA: ProcedenciaAntibiograma = {
  estandar: 'CLSI', edicion: 'M100-Ed35', metodo: 'mic', unidad: 'mg/L',
}

describe('ESCENARIO 2 (el de hoy): sin procedencia NO se edita nada', () => {
  const r = interpretarAntibiograma(DISCORDANTE)

  it('el panel conserva la categoría del laboratorio', () => {
    expect(r.resultadosEfectivos[0].interpretacion).toBe('S')
    expect(r.resultadosEfectivos[0].interpretacionLab).toBeUndefined()
  })

  it('la discordancia sigue viéndose', () => {
    const c = r.categoriasCMI[0]
    expect(c.categoriaCLSI).toBe('R')
    expect(c.categoriaReportada).toBe('S')
    expect(c.concuerda).toBe(false)
  })

  it('y la fila queda BLOQUEADA, con lo que falta para desbloquearla', () => {
    /**
     * «Bloquear las conclusiones dependientes» — un «no se puede resolver» sin
     * motivo obliga al médico a adivinar qué tiene que capturar.
     */
    const c = r.categoriasCMI[0]
    expect(c.bloqueaConclusiones).toBe(true)
    expect(c.editadaPorPuntoDeCorte).toBeUndefined()
    expect(c.faltaParaVerificar!.join(' ')).toMatch(/ESTÁNDAR/)
    expect(c.faltaParaVerificar!.join(' ')).toMatch(/EDICIÓN/)
  })

  it('el bloqueo se DICE en las advertencias, no sólo en un campo', () => {
    /**
     * Una discordancia que el motor no puede resolver y de la que nadie se
     * entera es peor que no detectarla: el médico lee una categoría y no sabe
     * que hay otra lectura posible.
     */
    const a = r.advertencias.find(x => x.includes('procedencia del punto de corte no está verificada'))
    expect(a).toBeDefined()
    expect(a!).toMatch(/NO construyas conclusiones sobre este resultado/)
  })
})

describe('ESCENARIO 1: con los ocho campos, MANDA LA CMI', () => {
  const r = interpretarAntibiograma({ ...DISCORDANTE, procedencia: COMPLETA })

  it('la categoría del panel pasa a ser la del punto de corte', () => {
    expect(r.resultadosEfectivos[0].interpretacion).toBe('R')
  })

  it('y el dato del laboratorio NO se destruye', () => {
    expect(r.resultadosEfectivos[0].interpretacionLab).toBe('S')
    expect(r.categoriasCMI[0].categoriaReportada).toBe('S')
  })

  it('la fila queda marcada como editada por punto de corte, no bloqueada', () => {
    expect(r.categoriasCMI[0].editadaPorPuntoDeCorte).toBe(true)
    expect(r.categoriasCMI[0].bloqueaConclusiones).toBeUndefined()
  })

  it('la razón dice POR QUÉ se permitió editar', () => {
    const e = r.edicionesInterpretativas.find(x => x.antibiotico === 'Meropenem')!
    expect(e.razon).toMatch(/procedencia está verificada/)
    expect(e.razon).toMatch(/manda la CMI/)
  })

  it('LA PARTE QUE IMPORTA: la edición gobierna TODO el razonamiento', () => {
    /**
     * Si la sustitución se hiciera al final —al armar la tabla de CMI— el panel
     * diría R y los fenotipos se habrían calculado con la S del laboratorio.
     * Es exactamente el defecto E0-15a que costó la v958: una pantalla donde el
     * sistema muestra R y sigue razonando con S.
     */
    const conCarbapenemR = interpretarAntibiograma({
      organismo: 'Klebsiella pneumoniae', sitio: 'sangre', procedencia: COMPLETA,
      resultados: [
        { antibiotico: 'Meropenem', interpretacion: 'S', cmi: 16 },
        { antibiotico: 'Ceftriaxona', interpretacion: 'R' },
      ],
    })
    // Con el meropenem ya editado a R, el motor razona sobre un carbapenémico R.
    expect(conCarbapenemR.resultadosEfectivos.find(x => x.antibiotico === 'Meropenem')!.interpretacion).toBe('R')
    expect(conCarbapenemR.fenotipos.map(f => f.clave).join(' ')).toMatch(/carbapenemasa/)
  })
})

describe('los ocho campos, uno por uno', () => {
  const fila = { hayPuntoDeCorte: true, hayValor: true, sitioResueltoSiHaceFalta: true }

  it('con los ocho, verificada', () => {
    expect(verificarProcedencia(COMPLETA, fila).verificada).toBe(true)
  })

  it('sin estándar declarado, NO', () => {
    expect(verificarProcedencia({ ...COMPLETA, estandar: undefined }, fila).verificada).toBe(false)
  })

  it('con OTRO estándar, NO — y se dice cuál', () => {
    const v = verificarProcedencia({ ...COMPLETA, estandar: 'FDA' }, fila)
    expect(v.verificada).toBe(false)
    expect(v.faltan.join(' ')).toMatch(/usó FDA y el motor interpreta con CLSI/)
  })

  it('sin EDICIÓN, NO: los cortes cambian entre ediciones', () => {
    expect(verificarProcedencia({ ...COMPLETA, edicion: undefined }, fila).verificada).toBe(false)
  })

  it('con otra edición, NO', () => {
    const v = verificarProcedencia({ ...COMPLETA, edicion: 'M100-Ed31' }, fila)
    expect(v.verificada).toBe(false)
    expect(v.faltan.join(' ')).toMatch(/M100-Ed31/)
  })

  it('con unidad que no es mg/L, NO', () => {
    const v = verificarProcedencia({ ...COMPLETA, unidad: 'mm' }, fila)
    expect(v.verificada).toBe(false)
    expect(v.faltan.join(' ')).toMatch(/no es mg\/L/)
  })

  it('si el método es DISCO, NO: el disco no produce una CMI', () => {
    const v = verificarProcedencia({ ...COMPLETA, metodo: 'disco' }, fila)
    expect(v.verificada).toBe(false)
    expect(v.faltan.join(' ')).toMatch(/DIFUSIÓN EN DISCO/)
  })

  it('sin sitio cuando el corte lo exige, NO', () => {
    expect(verificarProcedencia(COMPLETA, { ...fila, sitioResueltoSiHaceFalta: false }).verificada).toBe(false)
  })

  it('sin valor de CMI, NO', () => {
    expect(verificarProcedencia(COMPLETA, { ...fila, hayValor: false }).verificada).toBe(false)
  })

  it('y se enumera también lo que SÍ cumple', () => {
    // Para que el médico vea que va por buen camino, no sólo lo que le falta.
    expect(verificarProcedencia(COMPLETA, fila).cumplen.length).toBeGreaterThanOrEqual(6)
  })
})

describe('la edición se compara con tolerancia, no como cadena cruda', () => {
  it('«M100-Ed35», «M100 Ed 35» y «35» son la misma', () => {
    /**
     * Comparar cadenas crudas convertiría un espacio en una discrepancia de
     * estándar, y el médico no entendería por qué no se desbloquea.
     */
    expect(mismaEdicion('M100-Ed35', 'M100 Ed 35')).toBe(true)
    expect(mismaEdicion('Ed35', 'M100-Ed35')).toBe(true)
    expect(mismaEdicion('35', 'M100-Ed35')).toBe(true)
  })

  it('pero 31 y 35 no', () => {
    expect(mismaEdicion('M100-Ed31', 'M100-Ed35')).toBe(false)
  })

  it('y una edición sin números no cuela', () => {
    expect(mismaEdicion('vigente', 'M100-Ed35')).toBe(false)
  })
})

describe('lo que NO se edita, aunque haya procedencia', () => {
  const fila = {
    antibiotico: 'X', hayValor: true, soloUTI: false, referencia: 'r',
  }

  it('un SDD no entra en la comparación', () => {
    // No es S/I/R: forzarlo para comparar es lo que prohíbe la decisión 2.
    const { ediciones } = edicionesPorPuntoDeCorte(
      [{ ...fila, categoriaLab: 'SDD', categoriaCorte: 'R', noAplicable: false }], COMPLETA, true)
    expect(ediciones).toEqual([])
  })

  it('una fila donde el corte NO aplica tampoco', () => {
    // Sin corte válido para el caso no hay discordancia que resolver.
    const { ediciones, bloqueadas } = edicionesPorPuntoDeCorte(
      [{ ...fila, categoriaLab: 'S', categoriaCorte: 'R', noAplicable: true }], COMPLETA, true)
    expect(ediciones).toEqual([])
    expect(bloqueadas).toEqual([])
  })

  it('y si coinciden, no hay nada que editar', () => {
    const { ediciones } = edicionesPorPuntoDeCorte(
      [{ ...fila, categoriaLab: 'R', categoriaCorte: 'R', noAplicable: false }], COMPLETA, true)
    expect(ediciones).toEqual([])
  })

  it('LA ASIMETRÍA DESCARTADA: también edita de R a S, no sólo a más restrictivo', () => {
    /**
     * El Dr. descartó explícitamente «corregir sólo hacia lo más restrictivo»:
     * no es una regla de CLSI y puede crear falsas resistencias. Corregir en una
     * sola dirección no es prudencia, es sesgo.
     */
    const { ediciones } = edicionesPorPuntoDeCorte(
      [{ ...fila, categoriaLab: 'R', categoriaCorte: 'S', noAplicable: false }], COMPLETA, true)
    expect(ediciones).toHaveLength(1)
    expect(ediciones[0]).toMatchObject({ de: 'R', a: 'S' })
  })
})

describe('el aviso de bloqueo se puede leer', () => {
  it('nombra el fármaco, lo que falta, y qué NO hacer', () => {
    const a = avisoBloqueo({ antibiotico: 'Cefepime', faltan: ['no se declaró la EDICIÓN'] })
    expect(a).toMatch(/Cefepime/)
    expect(a).toMatch(/no se declaró la EDICIÓN/)
    expect(a).toMatch(/NO construyas conclusiones/)
  })
})

describe('lo que está escrito y no se calla', () => {
  it('por qué no se edita sin verificar', () => {
    expect(POR_QUE_NO_SE_EDITA_SIN_VERIFICAR).toMatch(/INVENTA una resistencia/)
  })

  it('por qué se descartó la corrección asimétrica', () => {
    expect(POR_QUE_NO_LA_CORRECCION_ASIMETRICA).toMatch(/no es prudencia, es sesgo/)
  })

  it('y hasta dónde llega el bloqueo — el límite se declara', () => {
    /**
     * Un rastreo completo de dependencias no está hecho. Decirlo es lo que
     * impide que alguien lea «bloquea las conclusiones» y crea que el motor
     * sabe qué fenotipo cuelga de qué celda.
     */
    expect(ALCANCE_DEL_BLOQUEO).toMatch(/a nivel de FILA/)
    expect(ALCANCE_DEL_BLOQUEO).toMatch(/NO está hecho/)
  })

  it('el código cita el documento de decisiones', () => {
    for (const ruta of [
      ['src', 'lib', 'expediente', 'antibiograma', 'procedencia.ts'],
      ['src', 'lib', 'expediente', 'antibiograma', 'motor.ts'],
    ]) {
      expect(readFileSync(join(process.cwd(), ...ruta), 'utf8'), ruta.join('/'))
        .toContain('DECISIONES-CLINICAS-2026-08-03.md')
    }
  })
})
