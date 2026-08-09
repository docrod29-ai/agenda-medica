import { describe, it, expect } from 'vitest'
import { revisarDosis, filtrarAlertasParaMostrar } from '@/lib/seguridad/dosis'
import { dosisPeligrosasDeLaLista } from '@/lib/seguridad/dosis-de-la-lista'
import { cantidad } from '@/types/clinical-quantity'

/**
 * REG-309 — «SIN REFERENCIA DE DOSIS» SE DESCARTABA TAMBIÉN EN NIÑOS
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * `revisarDosis` marca `sin_referencia` (severidad `info`) cuando el fármaco no
 * está en `CATALOGO`: es la forma explícita del motor de decir «no puede
 * verificar esta dosis», para que la ausencia de alerta no se lea como «dosis
 * comprobada» (regla clinical-safety.md #1 y #4). Tanto la pantalla de receta
 * como la revisión previa a firmar (`dosisPeligrosasDeLaLista`) descartaban ese
 * código SIEMPRE, sin mirar la edad del paciente.
 *
 * ── POR QUÉ IMPORTA PARA UN PACIENTE ─────────────────────────────────────────
 *
 * En un adulto, ocultar `sin_referencia` es una decisión de ruido en pantalla:
 * el resto del catálogo cubre los errores más caros (decimal, techo por vía).
 * En un paciente PEDIÁTRICO la dosis se calcula por kilogramo y el margen entre
 * la dosis útil y la tóxica es estrecho; que el fármaco recetado no tenga
 * referencia en el catálogo es precisamente el caso en el que el motor NO pudo
 * hacer la comprobación mg/kg — y la pantalla lo callaba igual que si sí la
 * hubiera hecho.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * `filtrarAlertasParaMostrar(alertas, esPediatrico)` en `dosis.ts`: mantiene
 * TODAS las alertas cuando el paciente es menor de 18 años, y sigue
 * descartando `sin_referencia` en adultos. Un único punto de decisión,
 * reutilizado por la receta (post-firma) y por la revisión antes de firmar.
 *
 * ── QUÉ NO CUBRE ──────────────────────────────────────────────────────────────
 *
 * No decide si `sin_referencia` debería mostrarse también en adultos — eso es
 * una pregunta de ruido en pantalla, no de seguridad pediátrica, y queda en
 * agent-state/OWNER_DECISIONS_REQUIRED.md. No amplía el catálogo de fármacos:
 * un fármaco pediátrico común que SÍ está en el catálogo sigue sin disparar
 * `sin_referencia` en absoluto, con o sin este cambio.
 */
describe('REG-309 — sin_referencia no se apaga en pediatría', () => {
  const farmacoFueraDelCatalogo = 'FármacoDePrueba-No-Existe-En-Catalogo'

  it('revisarDosis SIGUE marcando sin_referencia igual en niños y adultos (el motor no cambia)', () => {
    const alertas = revisarDosis({ farmaco: farmacoFueraDelCatalogo, dosis: cantidad(100, 'mg', 'masa'), edadAnios: 5 })
    expect(alertas.some(a => a.codigo === 'sin_referencia')).toBe(true)
  })

  it('filtrarAlertasParaMostrar: en pediatría CONSERVA sin_referencia', () => {
    const alertas = revisarDosis({ farmaco: farmacoFueraDelCatalogo, dosis: cantidad(100, 'mg', 'masa'), edadAnios: 5 })
    const mostradas = filtrarAlertasParaMostrar(alertas, true)
    expect(mostradas.some(a => a.codigo === 'sin_referencia')).toBe(true)
  })

  it('filtrarAlertasParaMostrar: en adulto sigue descartando sin_referencia (sin cambio de comportamiento)', () => {
    const alertas = revisarDosis({ farmaco: farmacoFueraDelCatalogo, dosis: cantidad(100, 'mg', 'masa'), edadAnios: 40 })
    const mostradas = filtrarAlertasParaMostrar(alertas, false)
    expect(mostradas.some(a => a.codigo === 'sin_referencia')).toBe(false)
  })

  it('filtrarAlertasParaMostrar no toca alertas que no sean sin_referencia', () => {
    // Ketorolaco vía oral no está aprobado antes de los 17 años: dispara
    // `via_edad_no_aprobada`, que nunca debe filtrarse, en niño o en adulto.
    const alertas = revisarDosis({ farmaco: 'ketorolaco', dosis: cantidad(10, 'mg', 'masa'), via: 'oral', edadAnios: 10 })
    expect(filtrarAlertasParaMostrar(alertas, true).some(a => a.codigo === 'via_edad_no_aprobada')).toBe(true)
    expect(filtrarAlertasParaMostrar(alertas, false).some(a => a.codigo === 'via_edad_no_aprobada')).toBe(true)
  })

  it('PRUEBA AL REVÉS: sin el filtro pediátrico, dosisPeligrosasDeLaLista calla el fármaco sin referencia en un niño', () => {
    // Reproduce el defecto tal cual vivía antes del arreglo: filtrar
    // incondicionalmente, sin mirar la edad.
    const filtroRoto = (m: { nombre?: string; dosis?: string }, edadAnios: number) =>
      revisarDosis({ farmaco: m.nombre ?? '', dosis: cantidad(100, 'mg', 'masa'), edadAnios })
        .filter(a => a.codigo !== 'sin_referencia')
    const conElDefecto = filtroRoto({ nombre: farmacoFueraDelCatalogo }, 5)
    expect(conElDefecto.length).toBe(0) // así fallaba: cero avisos para un fármaco no verificado en un niño de 5 años

    // El comportamiento reparado, con la misma entrada, en el llamador real:
    const reparado = dosisPeligrosasDeLaLista(
      [{ nombre: farmacoFueraDelCatalogo, dosis: '100 mg', via: 'oral' }],
      { edadAnios: 5 },
    )
    expect(reparado.length).toBe(1)
    expect(reparado[0].alertas.some(a => a.codigo === 'sin_referencia')).toBe(true)
  })

  it('dosisPeligrosasDeLaLista: en adulto, el mismo fármaco sin referencia sigue sin generar aviso', () => {
    const lista = dosisPeligrosasDeLaLista(
      [{ nombre: farmacoFueraDelCatalogo, dosis: '100 mg', via: 'oral' }],
      { edadAnios: 40 },
    )
    expect(lista.length).toBe(0)
  })

  it('dosisPeligrosasDeLaLista: sin edad conocida, se trata como NO pediátrico (mismo comportamiento que antes)', () => {
    const lista = dosisPeligrosasDeLaLista(
      [{ nombre: farmacoFueraDelCatalogo, dosis: '100 mg', via: 'oral' }],
      {},
    )
    expect(lista.length).toBe(0)
  })
})
