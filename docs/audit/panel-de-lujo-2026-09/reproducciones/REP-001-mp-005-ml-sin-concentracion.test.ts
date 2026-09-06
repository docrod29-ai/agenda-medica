/**
 * REP-001 — MP-005 · «Amoxicilina 5 mL cada 8 horas» sin concentración pasa
 * TODOS los tramos sin un solo aviso y llega literal al cuidador.
 *
 * ── QUÉ FALLA ────────────────────────────────────────────────────────────────
 *
 * Un renglón cuya dosis es un VOLUMEN («5 mL») y que no lleva concentración
 * («250 mg/5 mL») no determina la dosis: en México la amoxicilina en suspensión
 * existe en más de una concentración de uso común, y la farmacia elige. Hoy:
 *
 *   · `claseDeUnidad('5 mL')`            → 'volumen'   (el motor SABE que es volumen)
 *   · `revisarUnidadDosis('Amoxicilina', '5 mL')` → null  (…y no dice nada)
 *   · `extraerMg('5 mL')`                → null        (correcto: no se puede convertir)
 *   · `dosisPeligrosasDeLaLista([...])`  → []          (el renglón se SALTA por el null)
 *   · `comoTomarlo(...)`                 → «Amoxicilina · 5 mL · por la boca · …»
 *   · `componerPaquete(...)`             → el paquete del paciente lo lleva tal cual
 *
 * Cero avisos en la barra de consulta, cero en la receta, y al portal.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Panel de Lujo 2026-09, auditor M-pediatra, hallazgo MP-005 (P0, severidad 5,
 * probabilidad alta). Confirmado por el equipo rojo (R-M-pediatra) siguiendo el
 * camino entero con jiti: `crudos/M-pediatra.json`, `crudos/R-M-pediatra.json`.
 * La entrada sintética es la que usó el equipo rojo, sin cambios.
 *
 * ── CAUSA RAÍZ ───────────────────────────────────────────────────────────────
 *
 * `src/lib/seguridad/dosis.ts:429` declara el volumen como «otro problema
 * (hace falta la concentración), no éste» y `revisarUnidadDosis` sólo alerta en
 * `sin_cifra` y `sin_unidad` (:504-522). `extraerMg` devuelve null para mL
 * (:305) —bien— pero `dosis-de-la-lista.ts` hace `if (mg == null) continue`, así
 * que «no se puede validar» se convierte en «no se dice nada». Y `Medicamento`
 * (`src/types/expediente.ts:121`) no tiene campo de concentración/presentación,
 * así que no hay dónde ponerla aunque el médico quisiera.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * Seguridad clínica §4 y §5: «ausencia de dato no es dato de ausencia» y
 * «señalar de menos, nunca de más» — pero *señalar*, no callar. Un volumen sin
 * concentración es un dato INCOMPLETO comprobable en el texto (no requiere
 * inventar ninguna cifra): hace falta un aviso de la misma familia que
 * `dosis_sin_unidad`. Si bloquea la firma o sólo avisa: decisión del dueño
 * (la pregunta del 5-ago en su forma pediátrica). Esta prueba exige SÓLO que
 * haya un aviso, no que bloquee.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 *
 *   · Gotas (mg/gota varía por producto), «1 cucharadita», sobres.
 *   · La dosis acumulada de paracetamol en dos presentaciones.
 *   · La pantalla de la receta ni el Word/PDF (`receta-word.ts:107`,
 *     `RecetaDocumento.tsx:512`): son superficies, no motores; si los motores
 *     avisan, ellas tienen dónde leerlo.
 *   · NO propone la tabla de presentaciones comerciales: NEEDS_CLINICAL_REVIEW,
 *     la aporta el Dr., no se deduce.
 *   · El control «250 mg/5 mL, 5 mL → sin aviso» pasa HOY: está para que el
 *     arreglo no avise de más. No es una tautología: compara contra el
 *     motor real.
 *
 * Estado al escribirla (6-sep-2026): FALLA con el código tal cual está.
 */
import { describe, it, expect } from 'vitest'
import {
  claseDeUnidad, revisarUnidadDosis, extraerMg, type AlertaDosis,
} from '@/lib/seguridad/dosis'
import { dosisPeligrosasDeLaLista } from '@/lib/seguridad/dosis-de-la-lista'
import { comoTomarlo } from '@/lib/paciente/como-se-lo-explico'
import { componerPaquete } from '@/lib/paciente/paquete-de-visita'
import type { Medicamento } from '@/types/expediente'

/* ── Entrada sintética exacta del equipo rojo: preescolar de 12 kg ─────────── */
const RENGLON = {
  nombre: 'Amoxicilina',
  dosis: '5 mL',
  via: 'oral' as const,
  frecuencia: 'cada 8 horas',
  duracion: '7 días',
}
const CONTEXTO = { edadAnios: 4, pesoKg: 12 }

/** Una concentración escrita: «250 mg/5 mL», «125mg / 5 ml», «500 mg por 5 mL». */
const RE_CONCENTRACION = /\d+(?:[.,]\d+)?\s*(mg|mcg|µg|g)\s*(\/|por)\s*\d*(?:[.,]\d+)?\s*(ml|mililitros?|cc)\b/i
/** Un volumen: la misma familia de unidades que RE_VOLUMEN en dosis.ts. */
const RE_VOLUMEN = /\d+(?:[.,]\d+)?\s*(ml|mililitros?|cc)\b/i

function esVolumenSinConcentracion(texto: string): boolean {
  return RE_VOLUMEN.test(texto) && !RE_CONCENTRACION.test(texto)
}

describe('REP-001 · MP-005 — un volumen SIN concentración no puede quedar sin ningún aviso', () => {
  it('control: el motor reconoce que «5 mL» es volumen y que no se puede pasar a mg', () => {
    // No es tautología: fija el punto de partida real. Si esto cambiara, el
    // resto de la prueba mediría otra cosa.
    expect(claseDeUnidad(RENGLON.dosis)).toBe('volumen')
    expect(extraerMg(RENGLON.dosis)).toBeNull()
    expect(esVolumenSinConcentracion(RENGLON.dosis)).toBe(true)
  })

  it('FALLA HOY · tramo 1 — la compuerta de unidad avisa cuando la dosis es un volumen sin concentración', () => {
    const aviso = revisarUnidadDosis(RENGLON.nombre, RENGLON.dosis)
    expect(aviso).not.toBeNull()
    expect(aviso?.mensaje ?? '').toMatch(/concentraci[óo]n/i)
  })

  /**
   * No se exige que el aviso salga de `dosisPeligrosasDeLaLista` en particular:
   * hoy ese tramo se SALTA el renglón (`if (mg == null) continue`), pero si el
   * aviso nace en la compuerta de unidad, el invariante queda cubierto. Lo que
   * no puede pasar es que NINGÚN tramo diga nada.
   */
  it('FALLA HOY · en conjunto — entre TODOS los tramos hay al menos un aviso (hoy son cero)', () => {
    const avisos: AlertaDosis[] = []
    const unidad = revisarUnidadDosis(RENGLON.nombre, RENGLON.dosis)
    if (unidad) avisos.push(unidad)
    for (const h of dosisPeligrosasDeLaLista([RENGLON], CONTEXTO)) avisos.push(...h.alertas)
    expect(avisos.length).toBeGreaterThan(0)
  })

  it('PASA HOY (control de no-avisar-de-más): con la concentración escrita, la compuerta de unidad calla', () => {
    // El equipo rojo comprobó que la forma correcta SÍ se distingue.
    expect(claseDeUnidad('250 mg/5 mL, 5 mL')).toBe('masa')
    expect(revisarUnidadDosis(RENGLON.nombre, '250 mg/5 mL, 5 mL')).toBeNull()
    expect(esVolumenSinConcentracion('250 mg/5 mL, 5 mL')).toBe(false)
  })
})

describe('REP-001 · MP-005 — el paquete del paciente no entrega «5 mL» sin concentración', () => {
  /**
   * Una nota FIRMADA, con firma, y el renglón etiquetado como prescripción de
   * hoy: exactamente lo que `medicamentosDeLaReceta` deja pasar al papel.
   */
  const medicamento: Medicamento = {
    ...RENGLON,
    procedenciaClinica: 'se_prescribe_hoy',
  }
  const entrada = {
    nota: {
      id: 'nota-sintetica-mp005',
      estado: 'firmada',
      fechaConsulta: '2026-09-06',
      medicamentos: [medicamento],
      diagnosticos: [{ descripcion: 'Faringoamigdalitis aguda' }],
      firma: { nombreMedico: 'Dra. Ficticia Prueba', cedulaProfesional: '00000000', especialidad: 'Pediatría' },
    },
    medicacionPrevia: [] as string[],
    alergias: null,
  }

  it('FALLA HOY · `comoTomarlo` no compone una línea con un volumen sin concentración', () => {
    const linea = comoTomarlo(RENGLON)
    // Hoy: «Amoxicilina · 5 mL · por la boca · cada 8 horas (3 veces al día) · durante 7 días»
    expect(esVolumenSinConcentracion(linea)).toBe(false)
  })

  it('FALLA HOY · `componerPaquete` no deja en `medicationInstructions` un volumen sin concentración', () => {
    const c = componerPaquete(entrada)
    expect(c.ok).toBe(true)
    if (!c.ok) return
    const conVolumenSinConcentracion = c.paquete.medicationInstructions
      .filter(m => esVolumenSinConcentracion(m.instruccion))
    // O el renglón lleva su concentración, o no baja al paciente (se retiene y
    // se le dice al médico). Lo que no puede es bajar así.
    expect(conVolumenSinConcentracion).toEqual([])
  })
})
