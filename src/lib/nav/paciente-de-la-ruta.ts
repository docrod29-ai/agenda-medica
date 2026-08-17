/**
 * DE QUÉ PACIENTE ES ESTA PANTALLA — derivado de la URL, no de un contexto nuevo.
 *
 * ── EL HUECO ─────────────────────────────────────────────────────────────────
 *
 * `InstrumentStrip` (Capa 1, V15 §5) quedó documentado desde
 * V15-SHELL-GREYBOX-001 sin pintar «paciente actual»: pintarlo exigía o
 * inventar un selector nuevo, o leer PHI fuera del componente que ya lo hacía
 * con permisos verificados. Ahora que `PatientAnchor` existe
 * (V15-PATIENT-WORKSPACE-001), la pregunta pendiente era qué significa
 * «paciente actual» FUERA del expediente — al pasar a consulta, receta, orden,
 * nota o referencia, que hoy dejan la franja en blanco y el médico pierde de
 * vista en quién está.
 *
 * ── POR QUÉ DE LA URL Y NO DE UN CONTEXTO DE REACT ──────────────────────────
 *
 * Un contexto de "paciente activo" que cada pantalla tuviera que publicar
 * exigiría tocar seis páginas ya escritas, cada una con su propia lógica
 * clínica congelada por esta fase. La URL YA lleva el `patientId` como primer
 * segmento dinámico en las seis — es un invariante del propio enrutador, no
 * un dato que haya que duplicar ni sincronizar.
 *
 * ── LO QUE NO HACE ───────────────────────────────────────────────────────────
 *
 * No lee Firestore. No sabe el NOMBRE del paciente, sólo su id: quien llama
 * decide cómo (y si) lo resuelve — `getPatient()`, la misma función que ya usan
 * expediente/consulta/receta/orden/nota/referencia, no una nueva.
 *
 * Módulo PURO.
 */

/**
 * Primer segmento de cada ruta cuyo segundo segmento es un `patientId`.
 *
 * Debe coincidir 1:1 con las carpetas reales bajo `src/app/(dashboard)/` con
 * forma `[patientId]` o `[patientId]/[algo]`. NO incluye `/pacientes` (lista,
 * sin paciente en la URL) ni `/hospitalizacion/[internamientoId]` (el segundo
 * segmento ahí es un internamiento, no un paciente).
 */
const PRIMER_SEGMENTO_CON_PACIENTE = new Set([
  'expediente', 'consulta', 'nota', 'receta', 'orden', 'referencia',
])

/**
 * El `patientId` de la pantalla actual, o `null` si esta ruta no es de un
 * paciente concreto (agenda, pendientes, operaciones, lista de pacientes…).
 */
export function patientIdDeLaRuta(pathname: string | null | undefined): string | null {
  if (!pathname) return null
  const seg = pathname.split('/').filter(Boolean)
  if (seg.length < 2) return null
  if (!PRIMER_SEGMENTO_CON_PACIENTE.has(seg[0])) return null
  const patientId = seg[1]
  if (!patientId) return null
  try {
    return decodeURIComponent(patientId)
  } catch {
    return null   // segmento corrupto (%-escape inválido) — mejor "no hay paciente" que tronar la franja
  }
}
