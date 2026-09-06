/**
 * REP-056 · MC-005 (M-cirujano) — las dosis de profilaxis antibiótica
 * quirúrgica no tienen fuente citada, el registro las declara «pendiente de
 * validación», y el panel las agrega a la nota sin ningún sello de SIN VALIDAR.
 *
 * ── QUÉ FALLA ────────────────────────────────────────────────────────────────
 * `src/lib/expediente/cirugia.ts:177-187` `ANTIBIOTICOS_PROFILAXIS` — nueve
 * filas con dosis, re-dosis y umbral de peso, sin referencia por fila ni en la
 * cabecera del archivo (l.1-10 sólo dice «Funciones PURAS y testeadas»).
 * `src/lib/clinical/registry.ts:1146-1160`: `rangoValido.fuente:
 * 'pendiente_validacion_clinica'`, `estado: 'pendiente_validacion'`.
 * `PanelCirugia.tsx:150-154` «Agregar a la nota» con la dosis; `SelloMotor` no
 * se pinta en ningún sitio (MI-003 / REP-020). Agravante del equipo rojo: el
 * registro promete «sin tipo de cirugía no propone esquema» y el panel arranca
 * en Cefazolina (`useState(0)`, PanelCirugia.tsx:42).
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 * Auditor M-cirujano, MC-005; equipo rojo confirmado P1: buscó la fuente donde
 * el encargo pedía (comentario cercano, docs/clinical-decisions/) y no está.
 *
 * ── CAUSA RAÍZ ───────────────────────────────────────────────────────────────
 * Cifras transcritas sin cita, en un motor que el propio registro declara
 * pendiente, y una pantalla que las firma con cédula sin decirlo.
 *
 * ── REGLA ────────────────────────────────────────────────────────────────────
 * clinical-safety §1 («o salen de una fuente citada, o no existen»; «rellenar
 * una cifra plausible es el fallo más caro: sale impreso con cédula») y §7
 * (todo motor trae su registro). NEEDS_CLINICAL_REVIEW: esta prueba NO
 * propone ninguna cifra ni ninguna fuente.
 *
 * ── TIPO DE PRUEBA ───────────────────────────────────────────────────────────
 * CONTRATO declarado sobre datos reales: cada fila del catálogo debe llevar
 * `fuente` no vacía (el campo que ya usan `pediatria.ts:481` y `preop.ts:366`
 * para citar); y el motor `profilaxis-quirurgica` del registro debe estar
 * `validado` con fuente real, O la pantalla que lo agrega a la nota debe
 * pintar `SelloMotor`. Hoy no se cumple ninguna de las dos.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 * No valida clínicamente ninguna cifra. No cubre ajuste renal ni pediátrico de
 * esos antibióticos. No cubre la profilaxis extendida «28 a 35 días» de
 * caprini() ni los porcentajes de rcri() (mismo tratamiento, según el
 * hallazgo; se reproducen aparte si se decide). Si el dueño valida con fuente,
 * el caso del sello pasa por la primera rama y no exige pintar nada.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { ANTIBIOTICOS_PROFILAXIS, ESQUEMAS_POR_CIRUGIA } from '@/lib/expediente/cirugia'
import { motorPorId } from '@/lib/clinical/registry'

const raiz = path.resolve(__dirname, '../../../..')
const PANEL = readFileSync(path.join(raiz, 'src/components/PanelCirugia.tsx'), 'utf8')
const fuenteDe = (fila: object) => String((fila as Record<string, unknown>).fuente ?? '').trim()

describe('REP-056 · la profilaxis quirúrgica cita su fuente o se pinta como SIN VALIDAR', () => {
  const motor = motorPorId('profilaxis-quirurgica')

  it('control: el motor está en el registro, apunta a cirugia.ts y el panel agrega la dosis a la nota', () => {
    expect(motor?.file).toBe('src/lib/expediente/cirugia.ts')
    expect(PANEL).toMatch(/Agregar a la nota/)
    expect(PANEL).toMatch(/ANTIBIOTICOS_PROFILAXIS/)
  })

  it('cada fila de ANTIBIOTICOS_PROFILAXIS lleva `fuente` no vacía (hoy: ninguna)', () => {
    const sin = ANTIBIOTICOS_PROFILAXIS.filter(f => !fuenteDe(f)).map(f => f.nombre)
    expect(sin, `sin fuente: ${sin.join(', ')}`).toHaveLength(0)
  })

  it('cada fila de ESQUEMAS_POR_CIRUGIA lleva `fuente` no vacía (hoy: ninguna)', () => {
    const sin = ESQUEMAS_POR_CIRUGIA.filter(f => !fuenteDe(f)).map(f => f.cirugia)
    expect(sin, `sin fuente: ${sin.join(', ')}`).toHaveLength(0)
  })

  it('el motor está validado con fuente real, O PanelCirugia pinta SelloMotor (hoy: ni lo uno ni lo otro)', () => {
    const validado = motor?.estado === 'validado' && motor.rangoValido.fuente !== 'pendiente_validacion_clinica'
    const sellado = /<SelloMotor\b/.test(PANEL)
    expect(validado || sellado,
      `estado=${motor?.estado}, rangoValido.fuente=${motor?.rangoValido.fuente}, SelloMotor en PanelCirugia=${sellado}`,
    ).toBe(true)
  })
})
