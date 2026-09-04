/**
 * RTC-09 — la IA vive en el PACIENTE, no en el índice administrativo.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * `/operaciones` tenía un grupo titulado **«Clínico»** con cuatro filas:
 * Hospitalización, UCI, **Consultor IA** y **Antibiograma**. Los dos paneles
 * del equipo rojo (ORT-02 y RT-09, unificados como RTC-09 en el registro
 * canónico) marcaron lo mismo por separado:
 *
 *   1. La pantalla se presenta a sí misma como «lo administrativo del
 *      consultorio, **aparte del trabajo clínico del día**» y acto seguido
 *      abría un cajón llamado «Clínico». La pantalla se contradecía sola.
 *   2. «Consultor IA» como destino-módulo es IA **feature-first**: la antítesis
 *      literal de §3.2 («AI must be contextual… never a feature-first module»).
 *      Obligaba al médico a acordarse de que la capacidad existe, salir del
 *      paciente, y volver a teclear de quién estaba hablando.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Panel de equipo rojo de originalidad (§41) sobre las 27 capturas de
 * V15-ORIGINALITY-REDTEAM-001; la superficie Operaciones puntuó 7/10 en
 * GENERIC_AI_LOOK — el peor empate de la corrida junto con Pacientes.
 *
 * ── LA CAUSA RAÍZ ───────────────────────────────────────────────────────────
 *
 * El índice de Operaciones nació (V15-IA-001) como el destino de los 18 enlaces
 * que salieron del Sidebar de 23. Se agruparon por PARECIDO temático —lo que
 * suena clínico, junto— en vez de por la pregunta que contestan. Agrupar por
 * tema mete una capacidad de IA en un menú; agrupar por pregunta la manda al
 * sitio donde la pregunta ocurre.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * 1. `/operaciones` no tiene ningún grupo titulado «Clínico», y ninguno de sus
 *    grupos enlaza `/consultor` ni `/antibiograma`.
 * 2. Las dos capacidades se declaran UNA vez, en
 *    `@/lib/nav/capacidades-del-paciente`, con la ruta que sustituyen.
 * 3. El expediente CONSUME esa declaración (no una copia): si la fila
 *    desaparece, las rutas se quedan sin puerta y esto se pone rojo. Es la
 *    regla «escrito y sin conectar» aplicada a una reforma de navegación.
 * 4. El consultor se abre LLEVANDO al paciente (`?paciente=`) — que es lo que
 *    lo hace contextual y no un módulo con otro sitio de entrada.
 *
 * Probado al revés: devolviendo el grupo «Clínico» con sus dos filas de IA
 * fallan los casos 1-3; quitando el `CAPACIDADES_DEL_PACIENTE` del expediente
 * falla el caso 5; quitando `?paciente=` de la declaración falla el caso 6.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · No prueba que el consultor USE bien el contexto del paciente una vez
 *   cargado — eso es de su propia página y de sus pruebas.
 * · No mide layout ni contraste: eso es el arnés de navegador
 *   (`verificar-rtc09-rtc11-v15.mjs`).
 * · No cubre la paleta de comandos (⌘K), que sigue teniendo el consultor como
 *   atajo global a propósito: reconocer > recordar para quien ya sabe qué
 *   busca. La paleta es una superficie de COMANDO, no una jerarquía de IA.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { CAPACIDADES_DEL_PACIENTE, RUTAS_DE_CAPACIDADES } from '@/lib/nav/capacidades-del-paciente'

const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

const OPERACIONES = leer('src/app/(dashboard)/operaciones/page.tsx')
const EXPEDIENTE = leer('src/app/(dashboard)/expediente/[patientId]/page.tsx')

/** Los `href` declarados dentro del arreglo GRUPOS de /operaciones. */
const hrefsDeOperaciones = (): string[] => {
  const inicio = OPERACIONES.search(/const GRUPOS:/)
  const cierre = OPERACIONES.indexOf('\n]', inicio)
  return [...OPERACIONES.slice(inicio, cierre).matchAll(/href:\s*'([^']+)'/g)].map(m => m[1])
}

/** Los `titulo:` declarados dentro del arreglo GRUPOS. */
const titulosDeOperaciones = (): string[] => {
  const inicio = OPERACIONES.search(/const GRUPOS:/)
  const cierre = OPERACIONES.indexOf('\n]', inicio)
  return [...OPERACIONES.slice(inicio, cierre).matchAll(/titulo:\s*'([^']+)'/g)].map(m => m[1])
}

describe('RTC-09 — /operaciones deja de contener «lo clínico»', () => {
  it('1 · ningún grupo se llama «Clínico»', () => {
    const titulos = titulosDeOperaciones()
    expect(titulos.length).toBeGreaterThan(3)
    expect(titulos.map(t => t.toLowerCase())).not.toContain('clínico')
  })

  it('2 · el índice administrativo no enlaza las capacidades de IA', () => {
    const hrefs = hrefsDeOperaciones()
    for (const ruta of RUTAS_DE_CAPACIDADES) {
      expect(hrefs, `/operaciones sigue enlazando ${ruta} como página-módulo`).not.toContain(ruta)
    }
  })

  it('3 · el copy de la pantalla dice lo que la pantalla PINTA — hoy, sin Hospital/UCI', () => {
    /**
     * ACTUALIZADO EL 4-sep-2026 — la regla no cambió, lo que se pinta sí.
     *
     * Cuando se escribió, este caso exigía que el subtítulo nombrara «los
     * módulos de hospital» porque el índice los alojaba: una pantalla que se
     * describe mal es la misma familia de defecto que un grupo mal llamado.
     *
     * El dueño pausó Hospital y UCI en la navegación (la consulta y su agenda
     * son la prioridad; los dos siguen en ALPHA). Las filas siguen DECLARADAS
     * —pausar no es borrar— pero ya no se pintan, así que el subtítulo tampoco
     * puede prometerlas. El invariante es el mismo de siempre: el copy dice lo
     * que la pantalla enseña.
     *
     * La pausa en sí la defiende `hospital-y-uci-en-pausa.test.ts`, incluido
     * el caso al revés.
     */
    expect(hrefsDeOperaciones()).toContain('/hospitalizacion')   // declarado…
    expect(OPERACIONES).toMatch(/!enPausa\(it\.href\)/)          // …y filtrado
    const subtitulo = OPERACIONES.match(/subtitle="([^"]+)"/)?.[1] ?? ''
    expect(subtitulo).not.toMatch(/hospital/i)
  })
})

describe('RTC-09 — la capacidad vive en el paciente y LLEGA', () => {
  it('4 · la declaración es única y nombra la ruta que sustituye', () => {
    expect(CAPACIDADES_DEL_PACIENTE.length).toBe(2)
    expect(RUTAS_DE_CAPACIDADES).toContain('/consultor')
    expect(RUTAS_DE_CAPACIDADES).toContain('/antibiograma')
  })

  it('5 · el expediente CONSUME la declaración (no una copia suelta)', () => {
    // «Escrito y sin conectar» es la familia de defecto más cara del ledger:
    // un módulo declarado que nadie renderiza deja las rutas sin puerta y la
    // prueba de alcanzabilidad pasando en verde por el motivo equivocado.
    expect(EXPEDIENTE).toContain("from '@/lib/nav/capacidades-del-paciente'")
    expect(EXPEDIENTE).toMatch(/CAPACIDADES_DEL_PACIENTE\.map\(/)
  })

  it('6 · el consultor se abre LLEVANDO al paciente', () => {
    const consultor = CAPACIDADES_DEL_PACIENTE.find(c => c.id === 'consultor')!
    expect(consultor.conPaciente).toBeTypeOf('function')
    expect(consultor.conPaciente!('abc123')).toBe('/consultor?paciente=abc123')
  })

  it('7 · el antibiograma se USA en el expediente en vez de mandar a otra pantalla', () => {
    const anti = CAPACIDADES_DEL_PACIENTE.find(c => c.id === 'antibiograma')!
    expect(anti.conPaciente).toBeNull()
    // Y el embebido existe de verdad: mismo componente que ya usa la consulta.
    expect(EXPEDIENTE).toContain("import('@/app/(dashboard)/antibiograma/page')")
    expect(EXPEDIENTE).toContain('m.AntibiogramaTool')
  })
})
