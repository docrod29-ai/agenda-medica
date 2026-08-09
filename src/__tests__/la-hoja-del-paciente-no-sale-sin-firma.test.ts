/**
 * LA HOJA DEL PACIENTE NO SALE SIN FIRMA — REG-294 (V7 · POSTVISIT-GATE-001).
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * `HojaParaElPaciente` se montaba con el estado VIVO de `medicamentos` y
 * `estudiosOrden`. La única guarda era `{!esNotaHospital}`. Justo encima, en la
 * misma pantalla, `ComoCerrarLaConsulta` sí exigía `{firmada && …}`.
 *
 * Así que el médico podía componer la hoja de un borrador a medio dictar,
 * pulsar «Copiar» y mandarla por WhatsApp. Lo que el paciente se llevaba a casa
 * no era lo que el médico había revisado: era lo que hubiera en pantalla en ese
 * segundo.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Auditoría `PATIENT-UX-TRUTH-001` de V9 (8-ago-2026), ítem `POSTVISIT-GATE-001`
 * en `agent-state/BACKLOG.json`. No lo delató ninguna prueba: las de REG-242
 * cubren el MOTOR (qué dice la hoja), y el motor siempre estuvo bien. El defecto
 * estaba en CUÁNDO se puede entregar lo que el motor compone.
 *
 * ── CAUSA RAÍZ ──────────────────────────────────────────────────────────────
 *
 * La cabecera del módulo afirmaba —desde REG-242— que cada línea sale de un
 * campo que el médico «ya revisó y firmó». Era **intención de diseño escrita en
 * un comentario**, y un comentario no es una precondición. Nada lo comprobaba.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * `patient-facing-ai.md` §4: firmar y entregar son DOS ACTOS. Firmar es
 * medicolegal, hacia el expediente; entregar es comunicación, hacia el paciente.
 * El estado se DERIVA de la firma (`estadoDeLaHoja`) y sin `RELEASED` no se
 * entrega. Fail-closed: cualquier cosa que no sea `true` es borrador.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No se ha abierto un navegador.** Esto comprueba el motor puro y la forma
 *   del fuente; no comprueba que el aviso se VEA bien ni que el papel salga
 *   como se espera. `design-system.md` exige recorrer el flujo de verdad, y eso
 *   sigue pendiente (`NAV-NAVEGADOR-001`).
 * · No cubre el portal del paciente: hoy la hoja no llega ahí por ningún camino
 *   (`POSTVISIT-ENTREGA-001`, todavía abierto). Cuando llegue, la compuerta
 *   tendrá que vivir **en el servidor**, no en este componente — §3 de
 *   `patient-facing-ai.md`: la prohibición no puede vivir sólo en la pantalla.
 * · No convierte esto en el `PatientVisitPackage` completo de V9: no hay
 *   `approvedAt`, `approvedBy` ni `version`. Es su cimiento, no el paquete.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  estadoDeLaHoja, sePuedeEntregar, AVISO_BORRADOR,
  POR_QUE_FIRMAR_Y_ENTREGAR_SON_DOS_ACTOS,
} from '@/lib/paciente/como-se-lo-explico'

const RAIZ = join(__dirname, '..', '..')
const COMPONENTE = readFileSync(join(RAIZ, 'src/components/HojaParaElPaciente.tsx'), 'utf8')
const CONSULTA = readFileSync(
  join(RAIZ, 'src/app/(dashboard)/consulta/[patientId]/page.tsx'), 'utf8',
)

describe('el estado de la hoja se deriva de la firma, y falla cerrado', () => {
  it('nota firmada → RELEASED, y sólo eso se entrega', () => {
    expect(estadoDeLaHoja(true)).toBe('RELEASED')
    expect(sePuedeEntregar('RELEASED')).toBe(true)
  })

  it('nota sin firmar → DRAFT, y DRAFT no se entrega', () => {
    expect(estadoDeLaHoja(false)).toBe('DRAFT')
    expect(sePuedeEntregar('DRAFT')).toBe(false)
  })

  /**
   * El caso que de verdad importa: la prop que nadie pasó.
   *
   * Si `estadoDeLaHoja` usara `!!v` o `v !== false`, un `undefined` —una prop
   * olvidada en un sitio de llamada nuevo— se leería como entregable. Por eso
   * la comparación es `=== true` y no una conversión a booleano.
   */
  it.each([undefined, null, 0, '', 'true', 'RELEASED', 1, {}, []])(
    'cualquier cosa que no sea `true` es DRAFT: %o', (v) => {
      expect(estadoDeLaHoja(v)).toBe('DRAFT')
      expect(sePuedeEntregar(estadoDeLaHoja(v))).toBe(false)
    },
  )
})

describe('la compuerta está CONECTADA, no sólo escrita', () => {
  /**
   * «Escrito, probado y sin conectar» es la familia más grande del ledger
   * (33 de 139). Un motor de compuerta con sus pruebas en verde y ningún
   * llamador sería exactamente ese defecto otra vez.
   */
  it('el componente importa y usa la compuerta', () => {
    expect(COMPONENTE).toMatch(/estadoDeLaHoja/)
    expect(COMPONENTE).toMatch(/sePuedeEntregar/)
  })

  it('`notaFirmada` es OBLIGATORIA — un sitio de llamada nuevo no puede olvidarla', () => {
    // `notaFirmada?: boolean` volvería a abrir el agujero en silencio.
    expect(COMPONENTE).toMatch(/notaFirmada:\s*boolean/)
    expect(COMPONENTE).not.toMatch(/notaFirmada\?\s*:/)
  })

  it('la pantalla de consulta le pasa la firma de verdad', () => {
    expect(CONSULTA).toMatch(/notaFirmada=\{firmada\}/)
  })

  /**
   * La puerta va en el camino que MUEVE el dato, no en el `disabled`.
   * Un `disabled` se quita desde las herramientas del navegador; y deshabilitar
   * un control es decorar, no impedir.
   */
  it('copiar e imprimir se cierran en el manejador, no sólo en el atributo', () => {
    const copiar = COMPONENTE.slice(COMPONENTE.indexOf('const copiar'), COMPONENTE.indexOf('const imprimir'))
    expect(copiar).toMatch(/if\s*\(!entregable\)\s*return/)

    const imprimir = COMPONENTE.slice(COMPONENTE.indexOf('const imprimir'))
    const cuerpoImprimir = imprimir.slice(0, imprimir.indexOf('}'))
    expect(cuerpoImprimir).toMatch(/if\s*\(!entregable\)\s*return/)
    // Y el `window.print()` queda DESPUÉS de la guarda, no antes.
    expect(cuerpoImprimir.indexOf('!entregable')).toBeLessThan(cuerpoImprimir.indexOf('window.print'))
  })
})

describe('el aviso de borrador SE IMPRIME — la mitad que se olvida', () => {
  /**
   * EL DATO TIENE QUE LLEGAR.
   *
   * Deshabilitar los botones sólo cierra el camino de esta pantalla. El médico
   * puede darle a Ctrl+P del navegador, y la página de consulta esconde todos
   * los `button` al imprimir:
   *
   *     @media print { button, textarea:disabled { display: none; } }
   *
   * Sin un aviso que IMPRIMA, el papel de un borrador saldría idéntico a uno
   * entregable. Por eso el aviso no puede llevar `no-print`.
   */
  it('la página de consulta sí esconde los botones al imprimir (la premisa del riesgo)', () => {
    expect(CONSULTA).toMatch(/@media print\s*\{\s*button/)
  })

  it('el aviso de borrador NO lleva la clase que lo quitaría del papel', () => {
    const i = COMPONENTE.indexOf('AVISO_BORRADOR')
    const j = COMPONENTE.indexOf('{!entregable && (')
    expect(j).toBeGreaterThan(-1)
    const bloqueDelAviso = COMPONENTE.slice(j, COMPONENTE.indexOf('</div>', j))
    expect(bloqueDelAviso).toMatch(/AVISO_BORRADOR/)
    expect(bloqueDelAviso).not.toMatch(/no-print/)
    expect(i).toBeGreaterThan(-1)
  })

  it('el aviso dice que es borrador Y que no se entrega — las dos cosas', () => {
    expect(AVISO_BORRADOR).toMatch(/BORRADOR/)
    expect(AVISO_BORRADOR).toMatch(/no se entrega/i)
    expect(AVISO_BORRADOR).toMatch(/firmada/i)
  })
})

describe('la razón queda escrita donde se pueda leer', () => {
  it('firmar y entregar se declaran como dos actos distintos', () => {
    expect(POR_QUE_FIRMAR_Y_ENTREGAR_SON_DOS_ACTOS).toMatch(/medicolegal/i)
    expect(POR_QUE_FIRMAR_Y_ENTREGAR_SON_DOS_ACTOS).toMatch(/expediente/i)
    expect(POR_QUE_FIRMAR_Y_ENTREGAR_SON_DOS_ACTOS).toMatch(/paciente/i)
  })

  it('la cabecera del componente ya no afirma lo que no comprobaba', () => {
    // Antes decía «se componen de lo que el médico ya revisó y firmó» y nada lo
    // comprobaba. Ahora tiene que decir que es una precondición.
    expect(COMPONENTE).toMatch(/precondici[óo]n/i)
    expect(COMPONENTE).toMatch(/REG-294/)
  })
})
