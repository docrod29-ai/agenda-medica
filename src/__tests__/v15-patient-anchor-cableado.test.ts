/**
 * V15-PATIENT-WORKSPACE-001 — el PATIENT ANCHOR está CONECTADO en el
 * expediente, es de verdad el único aviso de alergias/identidad (no un
 * tercero al lado de los dos que reemplazó), y no abre una fuente de verdad
 * propia para "encuentro actual"/"último cambio".
 *
 * ── QUÉ PROTEGE ──────────────────────────────────────────────────────────────
 *
 * `docs/ai/NEXUSMED_MASTER_LOOP_V15_STRUCTURAL_UIUX_REARCHITECTURE.md` §7
 * pide un Patient Anchor SIEMPRE visible con identidad, edad/sexo,
 * alergia/seguridad, encuentro actual y último cambio — "no route should
 * mentally reset the physician". Antes de esta corrida el expediente tenía
 * DOS bloques sueltos e independientes al inicio (banner de alergias +
 * encabezado de identidad, cada uno con su propio layout): exactamente el
 * patrón de "many equally weighted destinations" que §14 prohíbe, sólo que
 * aplicado a avisos en vez de navegación.
 *
 * El riesgo es la misma familia que ya atrapó `v15-flow-rail-cableado.test.ts`
 * y `v15-continuidad-en-hoy.test.ts`: que `PatientAnchor.tsx` se escriba y
 * quede huérfano (import borrado, o page.tsx revierte a los dos bloques
 * viejos), o que alguien le agregue su propia consulta a Firestore para
 * "encuentro actual" en vez de derivarlo de `notas` — que sería una segunda
 * fuente de verdad para lo mismo que ya carga `useExpediente`.
 *
 * ── LO QUE VERIFICA ──────────────────────────────────────────────────────────
 *
 * 1. `expediente/[patientId]/page.tsx` importa y renderiza `<PatientAnchor>`
 *    con `patient`/`notas` — no quedó escrito y sin conectar.
 * 2. Los dos bloques viejos (banner de alergias suelto + encabezado `<h1>`
 *    de identidad) NO siguen en `page.tsx`: si reaparecieran, el expediente
 *    volvería a tener dos avisos para la misma pregunta.
 * 3. `PatientAnchor.tsx` no declara su propia consulta a Firestore: deriva
 *    "encuentro actual" y "último cambio" de la prop `notas`.
 * 4. El aviso de alergias sigue siendo SIEMPRE visible (no condicional a que
 *    haya alergias) y sigue diciendo "no registradas" cuando el campo está
 *    vacío — regla 4 de seguridad clínica, ausencia de dato no es dato de
 *    ausencia.
 * 5. El ancla es `position: sticky` — la parte de "SIEMPRE visible" de §7 es
 *    una propiedad de layout real, no sólo texto en un comentario.
 *
 * Probado al revés: si `PatientAnchor` se declarara pero `page.tsx` no la
 * importara, el caso 1 falla. Si `page.tsx` restaurara el `<h1 className="t-h1">`
 * de identidad suelto, el caso 2 falla. Si `PatientAnchor.tsx` reemplazara la
 * derivación de `notas` por un `query(collection(db, 'clinics', ...))` propio,
 * el caso 3 falla nombrando la duplicación.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 *
 * · No renderiza el componente con Firestore simulado: es un análisis
 *   estático de fuente, como sus hermanos de fase. La verificación en
 *   navegador real (desktop + móvil + axe) queda para el arnés de capturas
 *   de esta corrida.
 * · No cubre la Clinical Spine ni el Active Patient Canvas — el resto de §7
 *   sigue pendiente de fase para una corrida posterior de
 *   V15-PATIENT-WORKSPACE-001.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

const PAGINA = leer('src/app/(dashboard)/expediente/[patientId]/page.tsx')
const ANCLA = leer('src/components/expediente/PatientAnchor.tsx')

describe('V15-PATIENT-WORKSPACE-001 — PatientAnchor conectado en el expediente, no huérfano', () => {
  it('la página importa PatientAnchor', () => {
    expect(PAGINA).toContain("import { PatientAnchor } from '@/components/expediente/PatientAnchor'")
  })

  it('la renderiza con patient y notas', () => {
    expect(PAGINA).toMatch(/<PatientAnchor\s+patient=\{patient\}\s+notas=\{notas\}/)
  })

  it('los dos bloques viejos (banner suelto + encabezado h1) ya no están', () => {
    // El <h1> de identidad suelto que había antes del ancla.
    expect(PAGINA).not.toMatch(/<h1 className="t-h1"/)
    // El banner de alergias inline que vivía fuera de cualquier componente.
    expect(PAGINA).not.toMatch(/const sin = !a \|\| \/\^\(ninguna/)
  })
})

describe('V15-PATIENT-WORKSPACE-001 — PatientAnchor deriva de notas, no abre fuente propia', () => {
  it('no declara su propia consulta a Firestore', () => {
    expect(ANCLA).not.toMatch(/collection\(\s*db,\s*['"]clinics['"]/)
    expect(ANCLA).not.toMatch(/getDocs\(|onSnapshot\(/)
  })

  it('deriva encuentroActivo y ultimoCambio de la prop notas', () => {
    expect(ANCLA).toMatch(/orden\.find\(n => n\.estado !== 'firmada'\)/)
    expect(ANCLA).toMatch(/orden\.find\(n => n\.estado === 'firmada'\)/)
  })
})

describe('V15-PATIENT-WORKSPACE-001 — el aviso de alergias sigue SIEMPRE visible', () => {
  it('no es condicional a que existan alergias', () => {
    // Debe mostrarse el banner tanto si hay error de lectura como si no —
    // nunca "if (alergias) mostrar banner".
    expect(ANCLA).not.toMatch(/\{alergiaTexto && \(/)
  })

  it('el campo vacío sigue diciendo "no registradas", nunca "sin alergias"', () => {
    expect(ANCLA).toContain("'no registradas'")
  })
})

describe('V15-PATIENT-WORKSPACE-001 — el ancla es SIEMPRE visible, no sólo en el primer scroll', () => {
  it('usa position: sticky en el contenedor del ancla', () => {
    expect(ANCLA).toMatch(/position: 'sticky', top: 0/)
  })
})
