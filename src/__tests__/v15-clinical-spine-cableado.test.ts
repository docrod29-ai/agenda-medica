/**
 * V15-PATIENT-WORKSPACE-001 (Fase 4, §7) — el CLINICAL SPINE está CONECTADO
 * en el expediente, sus anclas de destino existen de verdad en la página, y
 * no abre una segunda fuente de verdad para lo que ya cargaron
 * `CabosSueltosDelPaciente`/`InternamientosDelPaciente`/`useExpediente`.
 *
 * ── QUÉ PROTEGE ──────────────────────────────────────────────────────────────
 *
 * §7 pide "a longitudinal structural element... should allow movement
 * through encounters, diagnoses, medications, labs...". Antes de esta
 * corrida `expediente/[patientId]/page.tsx` era una pila lineal sin forma de
 * moverse entre categorías salvo la rueda del ratón — exactamente lo que
 * §14 (feature-menu test) prohíbe, aplicado a contenido en vez de
 * navegación primaria.
 *
 * El riesgo es la misma familia que ya atrapan
 * `v15-flow-rail-cableado.test.ts` y `v15-patient-anchor-cableado.test.ts`:
 * que `ClinicalSpine.tsx` se escriba huérfano (import borrado, o dejó de
 * renderizarse), que sus anclas de destino (`id="spine-<id>"`) se borren de
 * `page.tsx` sin borrar el item correspondiente (un botón que no lleva a
 * ningún lado), o que alguien le agregue a `ClinicalSpine`, o a los
 * callbacks `onResumen`/`onCargado` que lo alimentan, su propia consulta a
 * Firestore — que sería una segunda fuente de verdad para lo mismo que ya
 * leen `CabosSueltosDelPaciente` e `InternamientosDelPaciente`.
 *
 * También protege un bug concreto de la implementación: si `onResumenRef`/
 * `onCargadoRef`/`itemsRef` entraran al arreglo de dependencias del
 * `useEffect` que ya lee Firestore, una función inline nueva en cada render
 * releería la colección sin que `clinicId`/`patientId` hubieran cambiado.
 *
 * ── LO QUE VERIFICA ──────────────────────────────────────────────────────────
 *
 * 1. La página importa y renderiza `<ClinicalSpine items={spineItems} />`.
 * 2. Cada id que `spineItems` puede producir ('encuentros', 'problemas',
 *    'herramientas', 'pendientes', 'internamientos') tiene su ancla
 *    `id="spine-<id>"` real en `page.tsx` — no un botón que apunta a nada.
 * 3. `ClinicalSpine.tsx` no declara su propia consulta a Firestore.
 * 4. `CabosSueltosDelPaciente`/`InternamientosDelPaciente` siguen sin
 *    `onResumen`/`onCargado` en el arreglo de dependencias de su efecto de
 *    carga (evita el bucle de relectura descrito arriba).
 * 5. La página pasa `onResumen`/`onCargado` reales, no los ignora.
 *
 * Probado al revés: si `page.tsx` dejara de importar `ClinicalSpine`, el
 * caso 1 falla. Si se borrara `id="spine-pendientes"` sin borrar el item del
 * riel, el caso 2 falla nombrando exactamente qué ancla falta. Si
 * `ClinicalSpine.tsx` ganara un `collection(db, ...)` propio, el caso 3
 * falla. Verificado manualmente: `onResumenRef` en el array de dependencias
 * hace fallar el caso 4 con el mensaje correcto.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 *
 * · No renderiza el componente ni prueba el `IntersectionObserver` real
 *   (resaltar la sección visible): eso es comportamiento de navegador, no de
 *   análisis estático — queda para el arnés de capturas de esta corrida.
 * · No cubre el Active Patient Canvas (§7): sigue pendiente de una corrida
 *   posterior de `V15-PATIENT-WORKSPACE-001`.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

const PAGINA = leer('src/app/(dashboard)/expediente/[patientId]/page.tsx')
const RIEL = leer('src/components/expediente/ClinicalSpine.tsx')
const CABOS = leer('src/components/CabosSueltosDelPaciente.tsx')
const INTERNAMIENTOS = leer('src/components/InternamientosDelPaciente.tsx')

describe('V15-PATIENT-WORKSPACE-001 — ClinicalSpine conectado en el expediente, no huérfano', () => {
  it('la página importa ClinicalSpine', () => {
    expect(PAGINA).toContain(
      "import { ClinicalSpine, type ClinicalSpineItem } from '@/components/expediente/ClinicalSpine'",
    )
  })

  it('la renderiza con los items reales, no una lista fija a mano', () => {
    expect(PAGINA).toContain('<ClinicalSpine items={spineItems} />')
  })
})

describe('V15-PATIENT-WORKSPACE-001 — cada categoría del riel tiene un destino real en el DOM', () => {
  const IDS = ['encuentros', 'problemas', 'herramientas', 'pendientes', 'internamientos']

  it.each(IDS)('existe id="spine-%s" en la página', (id) => {
    expect(PAGINA).toContain(`id="spine-${id}"`)
  })
})

describe('V15-PATIENT-WORKSPACE-001 — ClinicalSpine no abre fuente propia', () => {
  it('no declara su propia consulta a Firestore', () => {
    expect(RIEL).not.toMatch(/collection\(\s*db,/)
    expect(RIEL).not.toMatch(/getDocs\(|onSnapshot\(/)
  })

  it('los conteos llegan por props (`items`), no por un fetch interno', () => {
    expect(RIEL).not.toMatch(/\buseEffect\([^)]*fetch/)
  })
})

describe('V15-PATIENT-WORKSPACE-001 — los callbacks que alimentan el riel no relanzan la lectura', () => {
  it('CabosSueltosDelPaciente: onResumen NO está en las dependencias del efecto de carga', () => {
    expect(CABOS).toMatch(/\}, \[clinicId, patientId, cargar\]\)/)
    expect(CABOS).not.toMatch(/\[clinicId, patientId, cargar, onResumen\]/)
  })

  it('CabosSueltosDelPaciente: reporta el resultado ya cargado via ref, no vía dependencia', () => {
    expect(CABOS).toMatch(/onResumenRef\.current\?\.\(/)
  })

  it('InternamientosDelPaciente: onCargado NO está en las dependencias del efecto de carga', () => {
    expect(INTERNAMIENTOS).toMatch(/\}, \[clinicId, patientId, cargar\]\)/)
    expect(INTERNAMIENTOS).not.toMatch(/\[clinicId, patientId, cargar, onCargado\]/)
  })

  it('InternamientosDelPaciente: reporta el resultado ya cargado via ref, no vía dependencia', () => {
    expect(INTERNAMIENTOS).toMatch(/onCargadoRef\.current\?\.\(/)
  })
})

describe('V15-PATIENT-WORKSPACE-001 — la página conecta los callbacks reales, no los ignora', () => {
  it('CabosSueltosDelPaciente recibe onResumen={setPendientesPaciente}', () => {
    expect(PAGINA).toContain('onResumen={setPendientesPaciente}')
  })

  it('InternamientosDelPaciente recibe onCargado={setInternamientosPaciente}', () => {
    expect(PAGINA).toContain('onCargado={setInternamientosPaciente}')
  })
})
