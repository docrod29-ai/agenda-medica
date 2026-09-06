import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { limpiarComentarios } from '@/lib/authz/analisis-estatico'
import {
  creatininaDelExpediente, creatininaParaDosificar, comoSeDiceLaCreatinina,
} from '@/lib/seguridad/creatinina-para-la-receta'
import { medicacionDelCuadro } from '@/lib/expediente/cuadro-completo'
import { interaccionesDelCuadro, detectarInteracciones } from '@/lib/expediente/farmacovigilancia'
import { STALE_RENAL_FUNCTION } from '@/lib/expediente/laboratorio/vigencia-de-la-funcion-renal'

/**
 * LA RECETA VE EL EXPEDIENTE COMPLETO — REG-527.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * La consulta cruza lo que se prescribe hoy con la medicación VIGENTE del
 * expediente (REG-188) y ve la creatinina de los paneles con su vigencia
 * (REG-368, REG-375). La pantalla de RECETA —donde se imprime lo que se
 * dispensa— no hacía ninguna de las dos cosas:
 *
 *   - `detectarInteracciones(meds)` sólo miraba los renglones de HOY. La
 *     warfarina firmada en marzo con el ketorolaco que se imprime hoy no
 *     disparaba nada.
 *   - El campo «Creatinina (mg/dL)» nacía vacío y nada lo precargaba. La
 *     creatinina 2.4 del panel del mes pasado no llegaba al ajuste renal, y
 *     el médico tenía que recordarla y teclearla.
 *
 * Dos superficies, dos entradas distintas al mismo motor: la más importante
 * era la que menos veía.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Auditoría read-only de medicación del 5-sep-2026 (readiness §3, hallazgo
 * P1 «la receta no ve el expediente»). Verificado por el orquestador en
 * `receta/[patientId]/[notaId]/page.tsx` antes de tocarlo.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * Mismo motor, misma entrada: la receta construye el cuadro con
 * `medicacionDelCuadro(hoy, vigentes)` y pasa por `interaccionesDelCuadro`,
 * que además dice si la interacción la introduce lo de hoy o ya existía. Para
 * la creatinina, `creatininaParaDosificar`: la tecleada manda; si no hay, la
 * más reciente del expediente **con fecha y vigencia** (ventana conservadora
 * de 7 días, porque esta pantalla no conoce el contexto); fuera de ventana se
 * marca `STALE_RENAL_FUNCTION` y se sigue calculando —la política del dueño
 * dice «pide una actual», no «apaga el ajuste». Todo se DICE debajo del campo.
 *
 * ── PROBADO AL REVÉS ─────────────────────────────────────────────────────────
 *
 * Con la receta como estaba (`git stash` de la pantalla), el bloque de fuente
 * de abajo se pone rojo: seguía llamando `detectarInteracciones(meds)` y no
 * leía paneles ni notas firmadas.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 *
 * - No renderiza la receta: las funciones son puras y se prueban con tabla; el
 *   cableado se vigila por fuente con los comentarios quitados.
 * - No prueba `listarPanelesLab` ni `listarNotasCompat` contra Firestore: ya
 *   tienen sus propias pruebas y la consulta los usa igual.
 * - No decide el CONTEXTO renal (hospitalizado, AKI): la receta no lo conoce y
 *   por eso aplica la ventana conservadora. Cuando lo conozca, se le pasan las
 *   señales y la ventana se abre sola (REG-375).
 * - No mira la alergia ni el duplicado terapéutico: siguen siendo del
 *   siguiente corte del readiness (§11).
 */

const AHORA = '2026-09-05T12:00:00.000Z'

const panel = (fecha: string, creatinina?: number, extra: Record<string, unknown> = {}) => ({
  fecha,
  resultados: creatinina === undefined ? [] : [{ clave: 'creatinina', valor: creatinina, ...extra }],
})

describe('REG-527 · creatininaDelExpediente', () => {
  it('EL CASO: la creatinina del panel más reciente, con su fecha', () => {
    expect(creatininaDelExpediente([panel('2026-07-01', 1.1), panel('2026-08-12', 2.4)]))
      .toEqual({ valor: 2.4, medidoEn: '2026-08-12' })
  })

  it('un panel sin creatinina no tapa al anterior que sí la trae', () => {
    expect(creatininaDelExpediente([panel('2026-08-12', 2.4), panel('2026-09-01')]))
      .toEqual({ valor: 2.4, medidoEn: '2026-08-12' })
  })

  it('un límite («>3») no es un número; sin paneles, null', () => {
    expect(creatininaDelExpediente([panel('2026-08-12', 3, { censurada: { signo: '>' } })])).toBeNull()
    expect(creatininaDelExpediente([])).toBeNull()
    expect(creatininaDelExpediente(undefined)).toBeNull()
    expect(creatininaDelExpediente([panel('2026-08-12', 0)])).toBeNull()
  })
})

describe('REG-527 · creatininaParaDosificar', () => {
  const delExpediente = { valor: 2.4, medidoEn: '2026-08-12' }

  it('la tecleada manda, aunque haya una en el expediente', () => {
    expect(creatininaParaDosificar('1.3', delExpediente, AHORA)).toEqual({ origen: 'tecleada', valor: 1.3 })
  })

  it('EL CASO: sin teclear, la del expediente llega con su fecha y fuera de la ventana de 7 días se marca', () => {
    const c = creatininaParaDosificar('', delExpediente, AHORA)
    expect(c.origen).toBe('expediente')
    if (c.origen !== 'expediente') throw new Error('inalcanzable')
    expect(c.valor).toBe(2.4)
    expect(c.medidoEn).toBe('2026-08-12')
    expect(c.vigencia.vigente).toBe(false)
    expect(c.vigencia.marca).toBe(STALE_RENAL_FUNCTION)
    expect(c.vigencia.contexto).toBe('indeterminado')
    expect(c.vigencia.ventanaHoras).toBe(7 * 24)
  })

  it('dentro de la ventana, vigente y sin marca', () => {
    const c = creatininaParaDosificar('', { valor: 1.9, medidoEn: '2026-09-03' }, AHORA)
    if (c.origen !== 'expediente') throw new Error('inalcanzable')
    expect(c.vigencia.vigente).toBe(true)
    expect(c.vigencia.marca).toBeUndefined()
  })

  it('un tecleo inválido no cuenta como tecleado: cae al expediente; y sin nada, ninguna', () => {
    expect(creatininaParaDosificar('abc', delExpediente, AHORA).origen).toBe('expediente')
    expect(creatininaParaDosificar('0', delExpediente, AHORA).origen).toBe('expediente')
    expect(creatininaParaDosificar('-1', null, AHORA)).toEqual({ origen: 'ninguna' })
    expect(creatininaParaDosificar('', null, AHORA)).toEqual({ origen: 'ninguna' })
  })
})

describe('REG-527 · comoSeDiceLaCreatinina', () => {
  it('sólo habla cuando la cifra viene del expediente', () => {
    expect(comoSeDiceLaCreatinina({ origen: 'tecleada', valor: 1.3 })).toBe('')
    expect(comoSeDiceLaCreatinina({ origen: 'ninguna' })).toBe('')
  })

  it('vigente: dice el valor, la fecha y que se usa', () => {
    const c = creatininaParaDosificar('', { valor: 1.9, medidoEn: '2026-09-03' }, AHORA)
    const frase = comoSeDiceLaCreatinina(c)
    expect(frase).toContain('Creatinina 1.9 mg/dL del expediente (2026-09-03)')
    expect(frase).toContain('Se usa para el ajuste')
    expect(frase).not.toContain(STALE_RENAL_FUNCTION)
  })

  it('caduca: dice el valor, la fecha, la marca literal y la ventana de 7 días', () => {
    const c = creatininaParaDosificar('', { valor: 2.4, medidoEn: '2026-08-12' }, AHORA)
    const frase = comoSeDiceLaCreatinina(c)
    expect(frase).toContain('Creatinina 2.4 mg/dL del expediente (2026-08-12)')
    expect(frase).toContain(STALE_RENAL_FUNCTION)
    expect(frase).toContain('7 días')
    expect(frase).toContain('La decisión es del médico')
  })
})

describe('REG-527 · la interacción con lo que el paciente YA toma', () => {
  const hoy = [{ nombre: 'Ketorolaco', dosis: '10 mg', via: 'oral' as const, frecuencia: 'cada 8 h', duracion: '3 días' }]
  const vigentes = [{ medicamento: { nombre: 'Warfarina', dosis: '5 mg', via: 'oral' as const, frecuencia: 'cada 24 h', duracion: 'crónico' } }]

  it('EL CASO: sólo con lo de hoy no sale nada; con el cuadro, sale y se sabe que la introduce hoy', () => {
    // Lo que veía la receta antes del arreglo:
    expect(detectarInteracciones(hoy)).toEqual([])
    // Lo que ve ahora:
    const cuadro = medicacionDelCuadro(hoy, vigentes)
    expect(cuadro.map(m => [m.nombre, m.deHoy])).toEqual([['Ketorolaco', true], ['Warfarina', false]])
    const its = interaccionesDelCuadro(cuadro)
    expect(its).toHaveLength(1)
    expect(its[0].titulo).toBe('Anticoagulante o antiagregante + AINE')
    expect(its[0].severidad).toBe('mayor')
    expect(its[0].introducidaHoy).toBe(true)
  })

  it('la que ya existía antes de hoy se dice, pero marcada como previa', () => {
    const cuadro = medicacionDelCuadro(
      [{ nombre: 'Paracetamol', dosis: '500 mg', via: 'oral' as const, frecuencia: 'cada 8 h', duracion: '3 días' }],
      [...vigentes, { medicamento: { nombre: 'Ibuprofeno', dosis: '400 mg', via: 'oral' as const, frecuencia: 'cada 8 h', duracion: 'crónico' } }],
    )
    const its = interaccionesDelCuadro(cuadro)
    expect(its.map(i => [i.titulo, i.introducidaHoy])).toEqual([['Anticoagulante o antiagregante + AINE', false]])
  })
})

describe('REG-527 · la receta pasa por el cuadro completo (comentarios fuera)', () => {
  const receta = limpiarComentarios(readFileSync(join(process.cwd(), 'src/app/(dashboard)/receta/[patientId]/[notaId]/page.tsx'), 'utf8'))

  it('las interacciones salen del cuadro (hoy + vigentes), no sólo del papel de hoy', () => {
    expect(receta).toContain('medicacionDelCuadro(medicamentos, vigentes)')
    expect(receta).toContain('interaccionesDelCuadro(medsDelCuadro)')
    expect(receta).not.toMatch(/detectarInteracciones\(/)
  })

  it('lee los paneles y las notas firmadas del expediente, igual que la consulta', () => {
    expect(receta).toContain('listarPanelesLab(clinicId, patientId)')
    expect(receta).toContain('listarNotasCompat(clinicId, patientId)')
    expect(receta).toMatch(/estadoDeMedicamentos\(firmadas, new Date\(\)\.toISOString\(\), \{ historialIncompleto: truncada \}\)\.vigentes/)
  })

  it('la creatinina del ajuste renal pasa por creatininaParaDosificar y su frase se pinta', () => {
    expect(receta).toContain('creatininaParaDosificar(creatinina, crExpediente, ahoraParaVigencia)')
    expect(receta).toMatch(/const cr = crDosis\.origen === 'ninguna' \? 0 : crDosis\.valor/)
    expect(receta).not.toMatch(/const cr = parseFloat\(creatinina\)/)
    expect(receta).toContain('{fraseCreatinina}')
  })

  it('lo que ya existía antes de hoy se distingue en pantalla, y el historial recortado se declara', () => {
    expect(receta).toMatch(/!it\.introducidaHoy && /)
    expect(receta).toContain('ya existía antes de hoy')
    expect(receta).toMatch(/historialTruncado && /)
  })
})
