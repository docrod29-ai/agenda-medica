/**
 * GUARDIÁN — la decisión 3 tiene que poder DISPARARSE.
 *
 * ── EL DEFECTO QUE ESTO IMPIDE ───────────────────────────────────────────────
 *
 * La v970 implementó la decisión 3 completa: el motor edita una categoría
 * discordante sólo con los ocho campos verificados. Y quedó **imposible de
 * disparar**: dos de esos campos —estándar y edición— no los capturaba nadie.
 * Ni la pantalla, ni el extractor de la foto.
 *
 * O sea: una regla escrita, probada, desplegada… y muerta. Exactamente el fallo
 * que este repositorio lleva persiguiendo toda la sesión, cometido por mí, en la
 * versión anterior.
 *
 * Esta prueba existe para que no vuelva a pasar: si alguien quita la captura, la
 * decisión 3 deja de ser alcanzable y esto se pone rojo.
 *
 * ── LO QUE **NO** SE HACE, Y ES LA MITAD DEL ASUNTO ──────────────────────────
 *
 * Nada se rellena por omisión. Un `estandar` vacío significa «no se declaró», y
 * el motor responde no editando nada. Poner «CLSI» porque es lo más común sería
 * declarar por el laboratorio justo el campo que la regla existe para comprobar
 * — y el resultado sería un motor que corrige categorías creyendo que verificó
 * algo que nadie verificó.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PerfilExtraido, procedenciaDelPerfil, perfilAEntradaConDescartes } from '@/lib/expediente/antibiograma/vision'
import { interpretarAntibiograma } from '@/lib/expediente/antibiograma/motor'
import { EDICION_DEL_MOTOR, ESTANDAR_DEL_MOTOR } from '@/lib/expediente/antibiograma/procedencia'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')

describe('la PANTALLA captura los dos campos que faltaban', () => {
  const page = leer('src', 'app', '(dashboard)', 'antibiograma', 'page.tsx')

  it('hay un bloque de procedencia', () => {
    expect(page).toContain('Procedencia del reporte')
  })

  it('con estándar y edición, que eran los inalcanzables', () => {
    expect(page).toMatch(/setProcedencia\(p => \(\{ \.\.\.p, estandar:/)
    expect(page).toMatch(/setProcedencia\(p => \(\{ \.\.\.p, edicion:/)
  })

  it('y método y unidad, para completar los ocho', () => {
    expect(page).toMatch(/setProcedencia\(p => \(\{ \.\.\.p, metodo:/)
    expect(page).toMatch(/setProcedencia\(p => \(\{ \.\.\.p, unidad:/)
  })

  it('la procedencia LLEGA al motor', () => {
    /**
     * Capturarla y no pasarla sería el mismo defecto una capa más adentro.
     */
    expect(page).toMatch(/interpretarAntibiograma\(\{[^}]*procedencia \}\)/)
  })

  it('y también al razonamiento con IA', () => {
    expect(page).toMatch(/pruebas, procedencia, motor: 'maxima'/)
  })

  it('nace VACÍA: no se declara nada por el médico', () => {
    expect(page).toContain('useState<ProcedenciaAntibiograma>({})')
  })

  it('la pantalla dice con qué estándar interpreta el motor', () => {
    // Sin eso, el médico no sabe contra qué se está comparando su reporte.
    expect(page).toContain('ESTANDAR_DEL_MOTOR')
    expect(page).toContain('EDICION_DEL_MOTOR')
  })
})

describe('la FOTO aporta lo que venga impreso, y sólo eso', () => {
  it('el prompt lo pide, y prohíbe suponerlo', () => {
    const vision = leer('src', 'lib', 'expediente', 'antibiograma', 'vision.ts')
    expect(vision).toMatch(/estandar \/ edicionEstandar \/ unidadCmi/)
    expect(vision).toMatch(/Si no aparece impreso, NO lo pongas/)
    expect(vision).toMatch(/suponerlo cambiaría cómo se interpreta/)
  })

  it('un reporte que declara CLSI M100-Ed35 llega completo', () => {
    const p = PerfilExtraido.parse({
      organismo: 'Escherichia coli', metodo: 'MIC',
      estandar: 'Interpretación según CLSI', edicionEstandar: 'M100-Ed35', unidadCmi: 'mg/L',
      resultados: [{ antibiotico: 'Meropenem', interpretacion: 'S', cmi_texto: '16' }],
    })
    expect(procedenciaDelPerfil(p)).toEqual({
      estandar: 'CLSI', edicion: 'M100-Ed35', metodo: 'mic', unidad: 'mg/L',
    })
  })

  it('EUCAST se reconoce como EUCAST, no como CLSI', () => {
    const p = PerfilExtraido.parse({ organismo: 'x', estandar: 'EUCAST v14', resultados: [] })
    expect(procedenciaDelPerfil(p).estandar).toBe('EUCAST')
  })

  it('un estándar que no se reconoce cae en «otro», no en el del motor', () => {
    /**
     * Meterlo en CLSI porque no se supo leer sería la peor forma de fallar:
     * desbloquearía la edición con un estándar desconocido.
     */
    const p = PerfilExtraido.parse({ organismo: 'x', estandar: 'Norma interna del hospital', resultados: [] })
    expect(procedenciaDelPerfil(p).estandar).toBe('otro')
  })

  it('sin nada impreso, la procedencia queda VACÍA', () => {
    const p = PerfilExtraido.parse({ organismo: 'x', resultados: [] })
    expect(procedenciaDelPerfil(p)).toEqual({})
  })
})

describe('EL CICLO COMPLETO: de la foto al motor', () => {
  const conProcedencia = PerfilExtraido.parse({
    organismo: 'Escherichia coli', muestra: 'sangre', metodo: 'MIC',
    estandar: 'CLSI', edicionEstandar: EDICION_DEL_MOTOR, unidadCmi: 'mg/L',
    resultados: [{ antibiotico: 'Meropenem', interpretacion: 'S', cmi_texto: '16' }],
  })
  const sinProcedencia = PerfilExtraido.parse({
    organismo: 'Escherichia coli', muestra: 'sangre', metodo: 'MIC',
    resultados: [{ antibiotico: 'Meropenem', interpretacion: 'S', cmi_texto: '16' }],
  })

  it('con la procedencia impresa, el motor SÍ corrige la discordancia', () => {
    const { entrada } = perfilAEntradaConDescartes(conProcedencia)
    const r = interpretarAntibiograma(entrada)
    expect(r.resultadosEfectivos[0].interpretacion).toBe('R')
    expect(r.resultadosEfectivos[0].interpretacionLab).toBe('S')
    expect(r.categoriasCMI[0].editadaPorPuntoDeCorte).toBe(true)
  })

  it('y sin ella NO corrige: la señala y dice qué falta', () => {
    const { entrada } = perfilAEntradaConDescartes(sinProcedencia)
    const r = interpretarAntibiograma(entrada)
    expect(r.resultadosEfectivos[0].interpretacion).toBe('S')
    expect(r.categoriasCMI[0].bloqueaConclusiones).toBe(true)
    expect(r.advertencias.join(' ')).toMatch(/NO construyas conclusiones/)
  })

  it('el estándar del motor sigue siendo el que dicen las tablas', () => {
    // Si alguien actualiza las tablas y no esta constante, el motor empezaría a
    // aceptar como «misma edición» una que ya no lo es.
    expect(ESTANDAR_DEL_MOTOR).toBe('CLSI')
    expect(EDICION_DEL_MOTOR).toMatch(/M100/)
    const tablas = leer('src', 'lib', 'expediente', 'antibiograma', 'clsi-breakpoints.ts')
    expect(tablas).toContain(EDICION_DEL_MOTOR)
  })
})
