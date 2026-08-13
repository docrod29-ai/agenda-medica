/**
 * V15-PERF-001 (§43 orden 15, 3ª rebanada) — /consulta no paga por adelantado
 * los paneles que una consulta típica nunca monta.
 *
 * ── CÓMO SE DESCUBRIÓ EL DEFECTO ────────────────────────────────────────────
 *
 * El baseline de percepción (medir-perf-v15.mjs) midió /consulta en 734 KB de
 * JS transferido contra ~490 KB de sus hermanas de la cadena clínica, con las
 * long tasks móviles más altas de las cinco rutas (591–766 ms, reproducido en
 * dos muestras). La vía obvia de atribución —`ANALYZE=true npm run build`—
 * resultó muerta: @next/bundle-analyzer es un plugin de webpack y Next 16
 * compila con Turbopack, que lo ignora EN SILENCIO (build verde, cero
 * reporte). La atribución honesta se hizo en el navegador
 * (atribuir-js-consulta-v15.mjs): 7 chunks exclusivos de /consulta, ~746 KB de
 * cuerpo, y dentro el código compilado de paneles enteros de especialidad que
 * en una consulta típica NUNCA se montan — la valoración inmuno con todo
 * `src/lib/inmuno`, las escalas preoperatorias, el modal de cobro, el panel de
 * laboratorios plegado, y los paneles de revisión/NER que sólo existen DESPUÉS
 * de que la IA procesó un dictado.
 *
 * ── LA CAUSA RAÍZ ───────────────────────────────────────────────────────────
 *
 * El archivo ya tenía el patrón correcto (PanelPediatria, PanelGineco,
 * AntibiogramaTool… van con `dynamic()` desde antes), pero seis paneles con
 * condición real de montaje seguían importados de forma estática — así que su
 * peso viajaba en el chunk inicial de la ruta aunque el gate de render nunca
 * se abriera. Un import estático se paga al cargar; la condición sólo decide
 * si además se monta.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * 1. Panel con condición real de montaje (tipo de nota concreto, modal
 *    abierto, herramienta desplegada, resultado de IA que aún no existe al
 *    cargar) → `dynamic()` con ssr:false, igual que sus hermanos.
 * 2. Panel que se monta en TODA consulta (Copiloto, AntesDeFirmar,
 *    HojaParaElPaciente, HistorialVersiones) → se queda ESTÁTICO a propósito:
 *    diferirlo no ahorra transferencia, la mueve unos milisegundos después y
 *    añade una petición en cascada. La decisión está escrita en el comentario
 *    del bloque dynamic() del page.tsx.
 * 3. Equivalencia funcional (§42): dynamic() no cambia props ni semántica —
 *    el mismo gate de render decide, sólo que ahora también decide la
 *    descarga.
 *
 * Probado al revés (git stash del page.tsx): los casos 1 y 2 fallan contra el
 * árbol previo — los seis eran imports estáticos.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · Es análisis estático de fuente: no mide los KB reales. El peso se mide en
 *   navegador con medir-perf-v15.mjs (baseline vivo) y la atribución con
 *   atribuir-js-consulta-v15.mjs; la evidencia del ANTES queda en
 *   docs/design/capturas/v15-perf/atribucion-consulta.json.
 * · No garantiza que Turbopack de verdad parta el chunk — eso lo verifica la
 *   re-medición en navegador de la misma rebanada (734 → menos).
 * · No cubre los paneles de otras rutas (/expediente tiene los suyos) ni
 *   futuros paneles que alguien importe estático: cubre exactamente estos
 *   seis y la lista de siempre-montados de hoy.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const PAGE = readFileSync(
  join(process.cwd(), 'src/app/(dashboard)/consulta/[patientId]/page.tsx'),
  'utf8',
)

/** Los seis con condición real de montaje: van con dynamic(). */
const DIFERIDOS: Array<[nombre: string, patron: RegExp]> = [
  ['PreopAssessment', /const PreopAssessment = dynamic\(\(\) => import\('@\/components\/PreopAssessment'\)/],
  ['ValoracionInmuno', /const ValoracionInmuno = dynamic\(\(\) => import\('@\/components\/pacientes\/ValoracionInmuno'\)/],
  ['CobrarModal', /const CobrarModal = dynamic\(\(\) => import\('@\/components\/CobrarModal'\)/],
  ['PanelLaboratorios', /const PanelLaboratorios = dynamic\(\(\) => import\('@\/components\/laboratorio\/PanelLaboratorios'\)/],
  ['RevisionPanel', /const RevisionPanel = dynamic\(\(\) => import\('@\/components\/RevisionPanel'\)/],
  ['NerPanel', /const NerPanel = dynamic\(\(\) => import\('@\/components\/NerPanel'\)/],
]

describe('V15-PERF — /consulta no paga paneles que no abre', () => {
  it('1. los seis paneles condicionales van con dynamic(), ssr:false', () => {
    for (const [nombre, patron] of DIFERIDOS) {
      expect(PAGE, nombre).toMatch(patron)
      // ssr:false en la misma declaración (todas viven en una línea).
      const linea = PAGE.split('\n').find(l => patron.test(l))
      expect(linea, `${nombre} sin ssr:false`).toContain('{ ssr: false }')
    }
  })

  it('2. ninguno de los seis sigue importado estático (el peso ya no viaja en el chunk inicial)', () => {
    expect(PAGE).not.toMatch(/^import \{ PreopAssessment \}/m)
    expect(PAGE).not.toMatch(/^import ValoracionInmuno from/m)
    expect(PAGE).not.toMatch(/^import \{ CobrarModal \}/m)
    expect(PAGE).not.toMatch(/^import \{ PanelLaboratorios \}/m)
    expect(PAGE).not.toMatch(/^import \{ RevisionPanel \}/m)
    // De NerPanel sólo pueden quedar los TIPOS (se borran al compilar).
    expect(PAGE).not.toMatch(/^import \{ NerPanel[,\s}]/m)
    expect(PAGE).toMatch(/^import type \{ NegacionCorregida, AvisoTemporal \} from '@\/components\/NerPanel'/m)
  })

  it('3. los siempre-montados se quedan estáticos A PROPÓSITO (diferirlos no ahorra, encascada)', () => {
    expect(PAGE).toMatch(/^import \{ Copiloto \}/m)
    expect(PAGE).toMatch(/^import \{ AntesDeFirmar \}/m)
    expect(PAGE).toMatch(/^import \{ HojaParaElPaciente \}/m)
    expect(PAGE).toMatch(/^import \{ HistorialVersiones \}/m)
    // Y la razón está escrita donde vive la decisión.
    expect(PAGE).toContain('diferirlos no ahorra transferencia')
  })

  it('4. la evidencia del ANTES está congelada: la atribución acusó chunks exclusivos de /consulta', () => {
    // El archivo -antes es INMUTABLE (atribucion-consulta.json es el vivo y
    // cada re-corrida lo sobrescribe — la primera corrida lo demostró).
    const antes = JSON.parse(
      readFileSync(
        join(process.cwd(), 'docs/design/capturas/v15-perf/atribucion-consulta-antes.json'),
        'utf8',
      ),
    )
    expect(antes.excedenteKB).toBe(746)
    expect(antes.chunksSoloConsulta).toHaveLength(7)
    expect(antes.transferSizeConsultaKB).toBe(734)
  })
})
