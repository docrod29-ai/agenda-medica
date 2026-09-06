/**
 * ASN-008 · ASN-007 (Panel de Lujo 2026-09, auditor AS-notas) — «Últimos
 * signos» del expediente tomaba los de un borrador sin firmar sin marcarlo, y
 * pintaba las cifras sin unidad.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * · **ASN-008** — el `useMemo` recorría las notas ordenadas por fecha y devolvía
 *   los primeros `signosVitales` que encontrara, **sin mirar `n.estado`**. El
 *   llamador (`expediente/[patientId]/page.tsx:356`) pasa las notas SIN filtrar
 *   —el `PatientAnchor` depende de ello para detectar el encuentro abierto—, así
 *   que los signos podían salir del borrador de la consulta que está abierta
 *   ahora mismo. Y a dos centímetros, el bloque de Problemas/Toma promete que lo
 *   suyo sale «de sus notas firmadas» y sí filtra (`:182`). Dos bloques vecinos,
 *   dos verdades, y ninguna forma de saber cuál era cuál.
 * · **ASN-007** — «TA 118/74 · FC 82 · FR 16 · T° 36.8»: cuatro cifras clínicas
 *   sin unidad en la línea que se copia a una interconsulta. `talla` existía en
 *   `SignosVitales` y no se pintaba en ninguna parte. Y `signos.imc` era un
 *   lector sin escritor —0 escrituras de `imc:` en `src/`—, así que la línea del
 *   IMC no salía nunca. La fecha de la toma tampoco: «última visita» está dos
 *   renglones más abajo y **puede mentir**, porque los signos salen de la
 *   primera nota hacia atrás que traiga alguno, no de la más reciente.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 * Auditor AS-notas sobre `ResumenPaciente.tsx:23` y `:89`. El equipo rojo
 * verificó el llamador y confirmó la incoherencia entre las dos líneas; corrigió
 * al auditor en un punto —el IMC SÍ lo calcula el copiloto de la consulta con
 * motor determinista; lo que no ocurre es persistirlo— y matizó lo de «sin
 * fecha», que es lo que aquí se repara con la trampa de procedencia incluida.
 *
 * ── CAUSA RAÍZ ───────────────────────────────────────────────────────────────
 * El resumen se escribió como una foto («lo último que hay») y no como un hecho
 * con procedencia. Ausencia de estado ≠ dato firmado: es la regla 4 de seguridad
 * clínica leída al revés.
 *
 * ── REGLA ────────────────────────────────────────────────────────────────────
 * `design-system.md`, principio PROCEDENCIA: lo que la pantalla afirma enseña de
 * dónde salió. Y clinical-safety §1: la cifra clínica no se pinta pelada — el
 * IMC se DERIVA con el motor determinista que ya existe
 * (`cardiometabolico/obesidad.imc`), no con una segunda fórmula escrita aquí, y
 * no se CLASIFICA: «Sobrepeso» es un juicio con fuente (consenso AACE 2025) y su
 * sitio es el copiloto con su sello, no un resumen de un vistazo.
 *
 * ── TIPO DE PRUEBA ───────────────────────────────────────────────────────────
 * CONTRATO TEXTUAL sobre `ResumenPaciente.tsx` + COMPORTAMIENTO sobre el motor
 * de IMC que ahora consume. Declarado: este repo corre vitest en
 * `environment: 'node'`, sin jsdom ni testing-library, así que el componente no
 * se monta. Se prueba al revés: hay casos que fijan lo que NO debe hacer
 * (clasificar el IMC, esconder el borrador).
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 * No monta el componente ni comprueba el pintado. No cubre `glasgow` ni
 * `escalaDolor`, que siguen siendo lectores sin escritor (ASN-013, de otra
 * rebanada). No cubre que la consulta PERSISTA el IMC que ya calcula: eso vive
 * en `consulta/**` y va en `handoff-EXPEDIENTES.md`.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { imc, clasificarIMC } from '@/lib/expediente/cardiometabolico/obesidad'

const fuente = readFileSync(resolve(process.cwd(), 'src/components/expediente/ResumenPaciente.tsx'), 'utf8')
const codigo = fuente.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('ASN-008 · los signos dicen si vienen de una nota firmada', () => {
  it('se guarda la NOTA de la que salen los signos, no sólo la cifra', () => {
    expect(codigo).toMatch(/const notaDeLosSignos = useMemo\(/)
    expect(codigo).toMatch(/notaDeLosSignos\?\.estado === 'firmada'/)
    expect(codigo).toMatch(/notaDeLosSignos\?\.fechaConsulta \|\| notaDeLosSignos\?\.createdAt/)
  })

  it('el borrador se MARCA, no se esconde: el signo recién tomado es información', () => {
    expect(codigo).toMatch(/de un borrador sin firmar/)
    // Si se filtrara por estado, el médico perdería de vista lo que acaba de
    // medir. La reparación dice de dónde sale; no borra.
    expect(codigo).not.toMatch(/if \(n\.estado !== 'firmada'\) continue/)
  })

  it('la marca del borrador se distingue en color, no sólo en palabras', () => {
    expect(codigo).toMatch(/signosFirmados \? 'var\(--text3\)' : 'var\(--amber\)'/)
  })
})

describe('ASN-007 · cada cifra con su unidad, y la fecha de la toma', () => {
  it.each([
    ['ta', 'mmHg'], ['fc', 'lpm'], ['fr', 'rpm'],
    ['temperatura', '°C'], ['spo2', '%'], ['peso', 'kg'], ['talla', 'cm'],
    ['glucometria', 'mg/dL'],
  ])('«%s» sale con su unidad (%s)', (campo, unidad) => {
    expect(codigo, `${campo} sigue saliendo pelado`).toMatch(
      new RegExp(`signos\\.${campo}\\}[^\`]*${unidad.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
    )
  })

  it('la talla, que estaba en el tipo y no se pintaba, ya se pinta', () => {
    expect(codigo).toMatch(/label: 'Talla'/)
  })

  it('la fecha de la toma va pegada a los signos, no deducida de «última visita»', () => {
    expect(codigo).toMatch(/tomados el \$\{fmt\(fechaDeLaToma\)\}/)
  })
})

describe('ASN-007 · el IMC se deriva con el motor que ya existe, y no se clasifica', () => {
  it('control: el motor determinista calcula lo que tiene que calcular', () => {
    expect(imc(70, 170)).toBe(24.2)
    expect(imc(0, 170)).toBeNull()
    expect(imc(70, 0)).toBeNull()
  })

  it('el componente usa ese motor, no una segunda fórmula', () => {
    expect(fuente).toMatch(/from '@\/lib\/expediente\/cardiometabolico\/obesidad'/)
    expect(codigo).toMatch(/calcularImc\(signos\.peso, signos\.talla\)/)
    // Una división escrita a mano aquí sería una segunda fuente de verdad para
    // el mismo número, que es justo lo que CLAUDE.md prohíbe.
    expect(codigo).not.toMatch(/\/\s*\(m \* m\)|talla\s*\/\s*100/)
  })

  it('probada al revés: el resumen NO emite el juicio clínico', () => {
    // `clasificarIMC` existe al lado y devuelve «Sobrepeso»/«Obesidad clase I»
    // con su fuente (consenso AACE 2025). Eso es una afirmación clínica y su
    // sitio es el copiloto con su sello, no una línea de resumen.
    expect(clasificarIMC(27)).toBe('Sobrepeso')
    expect(codigo).not.toMatch(/clasificarIMC/)
    expect(codigo).not.toMatch(/Sobrepeso|Obesidad clase/)
  })

  it('el `imc` guardado, si algún día lo escribe alguien, gana al derivado', () => {
    // Si una nota trae `imc` medido, ése es el dato; el cálculo es el respaldo.
    expect(codigo).toMatch(/signos\.imc \?\? \(signos\.peso && signos\.talla/)
  })
})
