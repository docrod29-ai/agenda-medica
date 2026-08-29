/**
 * GOLDEN — EL EXPEDIENTE INTEROPERABLE AFIRMABA UNA CONFIRMACIÓN QUE NADIE HIZO,
 * DABA POR RESUELTA UNA ENFERMEDAD CRÓNICA, Y CONVERTÍA UN DESCARTE EN SOSPECHA.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * La exportación FHIR resolvía el estado de una `Condition` con dos ternarios:
 *
 *     verificationStatus: dx.tipo === 'definitivo' ? 'confirmed' : 'provisional'
 *     clinicalStatus:     dx.estado === 'activo'   ? 'active'    : 'resolved'
 *
 * **1. Una confirmación firmada por nadie.** `tipo` lo pone el modelo de
 * lenguaje —el prompt le pide distinguir sospecha de diagnóstico confirmado— o
 * lo rellena el esquema por omisión, y **ninguna pantalla deja al médico
 * elegirlo** (REG-365). Así que un `definitivo` del MODELO salía a otro sistema
 * como `confirmed`: una afirmación clínica que ninguna persona hizo, en un
 * registro interoperable que este producto ya no controla una vez enviado.
 *
 * **2. Un descarte convertido en sospecha.** `descartado` caía en el `else` y
 * salía como `provisional` — «todavía en estudio». Es REG-364 por la puerta de
 * la interoperabilidad.
 *
 * **3. Una enfermedad crónica dada por resuelta.** `estado` tiene cuatro
 * valores y el ternario reconocía uno: `cronico` y `en_seguimiento` salían como
 * **`resolved`**. El expediente interoperable de un diabético decía que su
 * diabetes está resuelta.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Cerrando el hueco de modelo que el tablero tenía escrito: «la extracción por
 * defecto no puede volverse un diagnóstico presuntivo o confirmado elegido por
 * el médico». Siguiendo a dónde va `tipo` apareció que su destino final es un
 * `verificationStatus` que otro sistema lee como un hecho.
 *
 * ── LA CAUSA RAÍZ ───────────────────────────────────────────────────────────
 *
 * El modelo de datos no distinguía **quién** puso `tipo`, y la traducción a FHIR
 * aplanaba cuatro valores en dos. Familia «el sistema se contradice a sí mismo»:
 * la pantalla ya no trata un `presuntivo` por omisión como un juicio (REG-365) y
 * la exportación sí lo hacía.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * **Confirmar es un acto y sólo lo puede hacer una persona.** `confirmed` se
 * reserva a `tipoOrigen === 'medico'`. Lo demás sale como `unconfirmed`, que es
 * el código de FHIR para «no consta verificación» — no dice que el diagnóstico
 * sea falso, dice que nadie firmó su verificación, que es lo que ocurre.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No crea la pantalla donde el médico elija `tipo`.** Sigue sin existir, así
 *   que hoy `tipoOrigen: 'medico'` sólo lo lleva el diagnóstico que el médico
 *   añade a mano. Esto hace la carencia VISIBLE en vez de resolverla en falso.
 * · **No cambia `tipo` ni `estado`** de ningún diagnóstico, ni reclasifica nada.
 * · **No toca las notas ya firmadas.** Su objeto sigue igual y siguen
 *   verificando: `tipoOrigen` va DENTRO de `Diagnostico`, que el sello v3 ya
 *   cubre entero, así que no hace falta un sello nuevo.
 * · **Las notas históricas bajan de `confirmed` a `unconfirmed`** — y es
 *   correcto: de ellas no consta quién verificó. Deja de afirmarse algo que
 *   nunca se registró.
 * · **No cubre `AllergyIntolerance`**, que exporta `confirmed` fijo y tiene su
 *   propia historia.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  verificationStatusDe, clinicalStatusDe,
  POR_QUE_CONFIRMED_SE_GANA, POR_QUE_UNCONFIRMED_NO_PIERDE_NADA,
} from '@/lib/fhir/la-certeza-que-sale-al-mundo'
import { DiagnosticoAuditado } from '@/lib/expediente/extraction-schema'
import type { Diagnostico } from '@/types/expediente'

const dx = (p: Partial<Diagnostico>): Diagnostico =>
  ({ descripcion: 'X', tipo: 'presuntivo', estado: 'activo', ...p })

describe('confirmar es un acto, y sólo lo hace una persona', () => {
  it('AL REVÉS — la regla anterior daba `confirmed` a lo que dijo el modelo', () => {
    /* El ternario que había: `dx.tipo === 'definitivo' ? 'confirmed' : ...`.
       Se reproduce aquí para fijar qué separa un caso del otro. */
    const delModelo = dx({ tipo: 'definitivo', tipoOrigen: 'extraccion' })
    expect(delModelo.tipo === 'definitivo' ? 'confirmed' : 'provisional').toBe('confirmed')
    expect(verificationStatusDe(delModelo)).toBe('unconfirmed')
  })

  it('un `definitivo` que eligió el médico SÍ sale confirmado', () => {
    expect(verificationStatusDe(dx({ tipo: 'definitivo', tipoOrigen: 'medico' }))).toBe('confirmed')
  })

  it('un `definitivo` puesto por omisión tampoco confirma', () => {
    expect(verificationStatusDe(dx({ tipo: 'definitivo', tipoOrigen: 'por_defecto' }))).toBe('unconfirmed')
  })

  it('una nota histórica, sin `tipoOrigen`, no afirma verificación', () => {
    /* No consta quién verificó. `unconfirmed` deja de afirmar lo que nunca se
       registró; no dice que el diagnóstico sea falso. */
    expect(verificationStatusDe(dx({ tipo: 'definitivo' }))).toBe('unconfirmed')
  })
})

describe('cada tipo tiene su código, y ninguno cae en un `else`', () => {
  it('lo descartado se REFUTA, no se deja en estudio', () => {
    /* REG-364 por la puerta de FHIR: `provisional` decía «todavía se considera». */
    expect(verificationStatusDe(dx({ tipo: 'descartado' }))).toBe('refuted')
    expect(verificationStatusDe(dx({ tipo: 'descartado', tipoOrigen: 'medico' }))).toBe('refuted')
  })

  it('un diferencial es `differential`', () => {
    expect(verificationStatusDe(dx({ tipo: 'diferencial' }))).toBe('differential')
  })

  it('un presuntivo es `provisional`, venga de donde venga', () => {
    for (const o of ['medico', 'extraccion', 'por_defecto', undefined] as const) {
      expect(verificationStatusDe(dx({ tipo: 'presuntivo', tipoOrigen: o }))).toBe('provisional')
    }
  })
})

describe('una enfermedad crónica no está resuelta', () => {
  it('AL REVÉS — la regla anterior daba `resolved` a lo crónico', () => {
    const cronica = dx({ estado: 'cronico' })
    expect(cronica.estado === 'activo' ? 'active' : 'resolved').toBe('resolved')
    expect(clinicalStatusDe(cronica)).toBe('active')
  })

  it('en seguimiento sigue siendo un problema vigente', () => {
    expect(clinicalStatusDe(dx({ estado: 'en_seguimiento' }))).toBe('active')
  })

  it('lo resuelto sí es `resolved`, y lo activo `active`', () => {
    expect(clinicalStatusDe(dx({ estado: 'resuelto' }))).toBe('resolved')
    expect(clinicalStatusDe(dx({ estado: 'activo' }))).toBe('active')
  })

  it('un estado desconocido NO se da por resuelto', () => {
    /* Ausencia de dato no es dato de ausencia: ante un valor que este código no
       conoce, lo que no pierde al paciente de vista es `active`. */
    expect(clinicalStatusDe({ estado: 'lo_que_sea' as Diagnostico['estado'] })).toBe('active')
  })

  it('los cuatro estados del tipo están cubiertos sin caer en el default', () => {
    const src = readFileSync('src/lib/fhir/la-certeza-que-sale-al-mundo.ts', 'utf8')
    for (const e of ['activo', 'resuelto', 'cronico', 'en_seguimiento']) {
      expect(src, `${e} no tiene caso propio`).toMatch(new RegExp(`case '${e}':`))
    }
  })
})

describe('el esquema conserva quién puso el tipo', () => {
  it('si el modelo lo DICE, queda como extracción', () => {
    const d = DiagnosticoAuditado.parse({ descripcion: 'Neumonía', tipo: 'definitivo' })
    expect(d.tipo).toBe('definitivo')
    expect(d.tipoOrigen).toBe('extraccion')
  })

  it('si el modelo NO lo dice, el efectivo sigue siendo presuntivo — y se sabe', () => {
    /* El comportamiento no cambia: sin `tipo` sigue valiendo `presuntivo`. Lo
       que cambia es que deja de perderse que nadie lo dijo. */
    const d = DiagnosticoAuditado.parse({ descripcion: 'Anemia' })
    expect(d.tipo).toBe('presuntivo')
    expect(d.tipoOrigen).toBe('por_defecto')
  })

  it('el esquema NUNCA marca `medico`: una sugerencia no es una firma', () => {
    const d = DiagnosticoAuditado.parse({ descripcion: 'Neumonía', tipo: 'definitivo' })
    expect(d.tipoOrigen).not.toBe('medico')
    const src = readFileSync('src/lib/expediente/extraction-schema.ts', 'utf8')
    expect(src).not.toMatch(/tipoOrigen:\s*'medico'/)
  })
})

describe('el dato tiene que LLEGAR', () => {
  it('la exportación FHIR usa el criterio y ya no lleva los ternarios', () => {
    const src = readFileSync('src/lib/fhir-export.ts', 'utf8')
    expect(src).toContain('verificationStatusDe(dx)')
    expect(src).toContain('clinicalStatusDe(dx)')
    expect(src).not.toContain("dx.tipo === 'definitivo' ? 'confirmed'")
    expect(src).not.toContain("dx.estado === 'activo' ? 'active' : 'resolved'")
  })

  it('el diagnóstico que el médico añade a mano queda marcado como suyo', () => {
    const src = readFileSync('src/app/(dashboard)/consulta/[patientId]/page.tsx', 'utf8')
    expect(src).toContain("tipo: 'presuntivo', estado: 'activo', tipoOrigen: 'medico'")
  })

  it('los porqués están escritos donde se aplican', () => {
    expect(POR_QUE_CONFIRMED_SE_GANA).toMatch(/firmada por nadie/)
    expect(POR_QUE_UNCONFIRMED_NO_PIERDE_NADA).toMatch(/no pierde información/)
  })
})
