/**
 * V15-PATIENT-WORKSPACE-001 (continuación) — INSTRUMENT STRIP pinta «paciente
 * actual» reutilizando `getPatient()`, no una lectura propia con su propio
 * criterio de permisos, y limpia el nombre ANTES de resolver el siguiente
 * paciente (no lo deja viejo mientras carga).
 *
 * ── QUÉ PROTEGE ─────────────────────────────────────────────────────────────
 *
 * `InstrumentStrip.tsx` traía documentado desde V15-SHELL-GREYBOX-001 que
 * pintar «paciente actual» exigía «leer PHI fuera del componente que ya lo
 * hace con permisos verificados» — el riesgo exacto que este cambio evita
 * llamando LA MISMA `getPatient()` de `@/lib/firestore` que ya usan
 * expediente/consulta/receta/orden/nota/referencia, en vez de escribir un
 * `getDoc`/`onSnapshot` nuevo con su propio alcance de clínica.
 *
 * El segundo riesgo es el familiar de esta fase (mismo patrón que
 * `v15-patient-anchor-cableado.test.ts`): que el componente exista pero quede
 * sin usar `patientIdDeLaRuta()` (y entonces nunca sepa en qué paciente está),
 * o que muestre el nombre del paciente ANTERIOR mientras el siguiente todavía
 * carga — confuso justo en el momento en que el médico cambia de paciente.
 *
 * Probado al revés: si `usePacienteActual` devolviera `cargado` directamente
 * en vez de filtrar por `cargado.id === patientId`, el caso "sólo enseña si
 * coincide con la ruta actual" fallaría (el nombre del paciente anterior
 * seguiría en pantalla mientras carga el siguiente). Si se reemplazara
 * `getPatient` por un `getDoc(doc(db, 'clinics', ...))` propio, el caso
 * "reutiliza getPatient" fallaría nombrando la duplicación. La primera versión
 * de este cambio SÍ hacía `setPaciente(null)` como primera línea del efecto —
 * `node scripts/lint-trinquete.mjs` lo cazó como `react-hooks/set-state-in-effect`
 * antes de llegar a esta versión; por eso el guardián también protege que no
 * vuelva.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 *
 * · No renderiza el componente con Firestore simulado: análisis estático de
 *   fuente, como sus hermanos de fase. La verificación en navegador real
 *   (desktop + móvil + axe, navegando expediente → receta) queda para el
 *   arnés de capturas de esta corrida.
 * · No cubre "última novedad" (§7): sigue sin construirse, no se rellena con
 *   un placeholder.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const FRANJA = leer('src/components/InstrumentStrip.tsx')

describe('V15 — InstrumentStrip reutiliza getPatient(), no inventa una lectura propia', () => {
  it('importa getPatient de @/lib/firestore — la misma función que expediente/consulta/receta/orden/nota/referencia', () => {
    expect(FRANJA).toContain("import { getPatient } from '@/lib/firestore'")
  })

  it('no declara su propia consulta a Firestore (doc/getDoc/onSnapshot directos)', () => {
    expect(FRANJA).not.toMatch(/doc\(db,\s*['"]clinics['"]/)
    expect(FRANJA).not.toMatch(/onSnapshot\(/)
  })

  it('deriva el patientId de la URL con patientIdDeLaRuta, no con un contexto nuevo', () => {
    expect(FRANJA).toContain("import { patientIdDeLaRuta } from '@/lib/nav/paciente-de-la-ruta'")
    expect(FRANJA).toContain('const patientId = patientIdDeLaRuta(pathname)')
  })
})

describe('V15 — InstrumentStrip nunca enseña el paciente ANTERIOR mientras carga el siguiente', () => {
  it('no llama setState directo dentro del cuerpo del efecto (fuera del callback async) — el bug que cazó el trinquete de lint', () => {
    const efecto = FRANJA.slice(FRANJA.indexOf('useEffect(() => {', FRANJA.indexOf('usePacienteActual')), FRANJA.indexOf('}, [clinicId, patientId])'))
    const primeraLinea = efecto.split('\n')[1].trim()
    expect(primeraLinea).not.toBe('setCargado(null)')
    expect(primeraLinea).toMatch(/^if \(!clinicId \|\| !patientId\) return$/)
  })

  it('el valor devuelto se filtra por id — sólo se enseña si coincide con el patientId de la ruta actual', () => {
    expect(FRANJA).toContain('return cargado && cargado.id === patientId ? cargado : null')
  })
})

describe('V15 — InstrumentStrip se conecta en el shell', () => {
  it('exporta InstrumentStrip (ya cableado en layout.tsx por v15-flow-rail-cableado.test.ts)', () => {
    expect(FRANJA).toContain('export function InstrumentStrip()')
  })

  it('el nombre del paciente enlaza de vuelta al expediente — continuidad, no un texto muerto', () => {
    expect(FRANJA).toMatch(/href=\{`\/expediente\/\$\{paciente\.id\}`\}/)
  })
})
