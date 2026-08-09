/**
 * REG-297 — «sin referencia de dosis» se descartaba también en pediatría.
 *
 * QUÉ FALLABA: `revisarDosis()` marca `sin_referencia` (severidad `info`) cuando
 * un fármaco no está en el catálogo — es la forma en que el motor dice «no sé»
 * en vez de callarse. Dos llamadores lo descartaban SIEMPRE, sin mirar la edad:
 * la pantalla de receta (`receta/[patientId]/[notaId]/page.tsx`) y el aviso
 * antes de firmar (`dosisPeligrosasDeLaLista`, llamado desde consulta).
 *
 * CÓMO SE DESCUBRIÓ: auditoría de nueve dimensiones (hallazgo G2, SAFE-003 en
 * `agent-state/BACKLOG.json`).
 *
 * CAUSA RAÍZ: el filtro `.filter(a => a.codigo !== 'sin_referencia')` es
 * correcto para adulto («no está en el catálogo» no es un hallazgo sobre el
 * paciente, y saturaría la pantalla) pero incorrecto para pediátrico: ahí la
 * dosis va por kilo y el margen es estrecho, así que «no tengo referencia de
 * este fármaco» es información distinta de «no hay alerta» — regla 5 de
 * seguridad clínica, señalar de menos nunca de más. Callarlo se lee como dosis
 * comprobada.
 *
 * LA REGLA QUE LO HACE SEGURO: `filtrarSinReferencia(alertas, esPediatrico)` en
 * `src/lib/seguridad/dosis.ts` es el ÚNICO lugar que decide la política; los dos
 * llamadores sólo calculan si el paciente es pediátrico (edad < 18) y se la
 * pasan. Ningún umbral clínico nuevo: la edad de corte ya existía en ambas
 * pantallas para la comprobación mg/kg.
 *
 * QUÉ NO CUBRE: no cambia qué alerta BLOQUEA la firma — `sin_referencia` sigue
 * siendo `info`, nunca crítica. No añade ningún fármaco al catálogo. Si la edad
 * del paciente no se conoce, se trata como NO pediátrico (comportamiento previo,
 * conservador: no inventa un supuesto de que sí lo es).
 */
import { describe, it, expect } from 'vitest'
import { filtrarSinReferencia, revisarDosis } from '@/lib/seguridad/dosis'
import { dosisPeligrosasDeLaLista } from '@/lib/seguridad/dosis-de-la-lista'
import { cantidad } from '@/types/clinical-quantity'

const FARMACO_FUERA_DEL_CATALOGO = 'Zzzarmacozzz-inventado-para-la-prueba'

describe('filtrarSinReferencia — la política única', () => {
  it('AL REVÉS: sin la reparación, un fármaco pediátrico fuera de catálogo no avisa nada', () => {
    // Reproduce el defecto directamente: el filtro viejo, sin distinguir edad.
    const alertas = revisarDosis({
      farmaco: FARMACO_FUERA_DEL_CATALOGO,
      dosis: cantidad(50, 'mg', 'masa'),
    })
    const filtroViejo = alertas.filter(a => a.codigo !== 'sin_referencia')
    expect(filtroViejo).toHaveLength(0) // esto es justo el defecto: silencio total
  })

  it('en adulto, se calla sin_referencia (no es ruido nuevo)', () => {
    const alertas = revisarDosis({ farmaco: FARMACO_FUERA_DEL_CATALOGO, dosis: cantidad(50, 'mg', 'masa') })
    expect(filtrarSinReferencia(alertas, false)).toHaveLength(0)
  })

  it('en pediátrico, sin_referencia SE CONSERVA', () => {
    const alertas = revisarDosis({ farmaco: FARMACO_FUERA_DEL_CATALOGO, dosis: cantidad(50, 'mg', 'masa') })
    const out = filtrarSinReferencia(alertas, true)
    expect(out).toHaveLength(1)
    expect(out[0].codigo).toBe('sin_referencia')
    expect(out[0].severidad).toBe('info') // nunca bloquea la firma
  })

  it('un fármaco SÍ catalogado no dispara sin_referencia en ninguna edad', () => {
    const alertas = revisarDosis({ farmaco: 'Paracetamol', dosis: cantidad(500, 'mg', 'masa') })
    expect(alertas.find(a => a.codigo === 'sin_referencia')).toBeUndefined()
    expect(filtrarSinReferencia(alertas, true).find(a => a.codigo === 'sin_referencia')).toBeUndefined()
  })
})

describe('dosisPeligrosasDeLaLista — el aviso antes de firmar', () => {
  it('niño de 5 años con fármaco fuera de catálogo: SÍ aparece el aviso', () => {
    const out = dosisPeligrosasDeLaLista(
      [{ nombre: FARMACO_FUERA_DEL_CATALOGO, dosis: '50 mg' }],
      { edadAnios: 5 },
    )
    expect(out).toHaveLength(1)
    expect(out[0].alertas.some(a => a.codigo === 'sin_referencia')).toBe(true)
  })

  it('adulto de 40 años con el mismo fármaco: sigue en silencio (sin cambio de comportamiento)', () => {
    const out = dosisPeligrosasDeLaLista(
      [{ nombre: FARMACO_FUERA_DEL_CATALOGO, dosis: '50 mg' }],
      { edadAnios: 40 },
    )
    expect(out).toHaveLength(0)
  })

  it('sin edad conocida: se trata como no pediátrico (no se inventa el supuesto)', () => {
    const out = dosisPeligrosasDeLaLista([{ nombre: FARMACO_FUERA_DEL_CATALOGO, dosis: '50 mg' }])
    expect(out).toHaveLength(0)
  })

  it('en el límite: 17 años es pediátrico, 18 ya no', () => {
    const ninio = dosisPeligrosasDeLaLista([{ nombre: FARMACO_FUERA_DEL_CATALOGO, dosis: '50 mg' }], { edadAnios: 17 })
    const adulto = dosisPeligrosasDeLaLista([{ nombre: FARMACO_FUERA_DEL_CATALOGO, dosis: '50 mg' }], { edadAnios: 18 })
    expect(ninio).toHaveLength(1)
    expect(adulto).toHaveLength(0)
  })
})
