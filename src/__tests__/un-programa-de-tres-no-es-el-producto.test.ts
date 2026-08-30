/**
 * GOLDEN — EL TABLERO CUSTODIABA UN PROGRAMA DE TRES, Y NADIE PODÍA NOTARLO.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * El censo de Ausculta está bien vigilado: 78 requisitos, sello, y un guardián
 * que impide que un dominio canónico se quede sin fila. Pero custodia **un
 * programa de tres**.
 *
 * En `agent-state/` viven otros dos con sus propios backlogs —V9 (experiencia
 * del paciente y diseño) y V10 (excelencia visual)— y el tablero no los
 * mencionaba. Así que «quedan 8 accionables» era **cierto del censo y falso del
 * producto**, y no había forma de notarlo leyendo el tablero.
 *
 * Es el mismo defecto que este censo existe para impedir, un nivel más arriba:
 * ningún documento derivado puede notar la ausencia de algo que no está en su
 * fuente. Antes se evaporó un dominio; aquí, un programa entero.
 *
 * ── EL SEGUNDO DEFECTO: EL CONTRATO NO SOBREVIVÍA A LA SESIÓN ───────────────
 *
 * `AUSCULTA_MASTER_LOOP.md` tenía 33 líneas, apuntaba a una rama que ya no
 * existe y **no contenía el directivo**: sus 26 apartados vivían sólo en el
 * mensaje del dueño. Un loop cuyo contrato se pierde al cerrar la sesión se
 * reinterpreta en la siguiente — y eso es exactamente lo que pasó.
 *
 * ── LO QUE SE MIDIÓ ─────────────────────────────────────────────────────────
 *
 * Los 10 items abiertos de V9 se comprobaron **uno por uno contra el árbol**, no
 * contra el archivo:
 *
 *     EVAL-003           trinquete de voz en CI    → YA ESTABA HECHO
 *     PATIENT-TELE-002   token de videoconsulta    → YA ESTABA HECHO (7 casos sellados)
 *     PATIENT-I18N-001   i18n sin consumidor       → YA ESTABA HECHO (lo importa el portal)
 *     DESIGN-MIGRAR-001  nadie usa las nx-         → HECHO EN PARTE (3 páginas)
 *     PATIENT-PREVIO-001 dónde se pinta el previo  → COMPROBADO (page.tsx:453)
 *     SAFE-003           dosis sin referencia      → ABIERTO DE VERDAD
 *     DESIGN-TABLAS-001  tablas a 375 px           → necesita navegador
 *     NAV-NAVEGADOR-001  seis comprobaciones       → necesita navegador
 *     EVAL-001           gold de 6000 audios       → bloqueado: la voz es biométrica
 *     UX-002             contraste en oscuro       → ya marcado medido y falso
 *
 * **Cinco de diez ya estaban hechos y nadie los había marcado.** Un backlog que
 * exagera el trabajo pendiente se abandona igual que uno que lo esconde.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * Los tres programas se **cuentan**, no se fusionan. V10 es el carril de Product
 * Excellence: el §20 del directivo prohíbe rehacer su trabajo y el §18, invadir
 * sus cambios visuales. Absorberlo al censo de Master sería justo esa invasión.
 *
 * Contar sin ejecutar es la única postura que no miente en ninguna de las dos
 * direcciones.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · NO comprueba que un item de V9/V10 marcado CERRADO lo esté. Comprueba que el
 *   conteo del documento coincida con los archivos. Verificar el contenido
 *   clínico o visual de cada item es trabajo de su propio carril.
 * · NO fusiona los estados: V9 y V10 usan cadenas libres («abierto»,
 *   «parcialmente-cerrado») y Master una unión tipada. Normalizarlas exigiría
 *   reescribir dos programas ajenos.
 * · NO cubre Nexus OS ni V15, que tienen estado en `docs/roadmap/` y
 *   `agent-state/V15_*` y todavía no se han reconciliado. Queda dicho.
 * · «Abierto» aquí es **todo lo que no dice CERRADO/RESUELTO/desbloqueado**, así
 *   que `parcialmente-cerrado` cuenta como abierto. Señala de más a propósito:
 *   en un conteo de custodia, equivocarse hacia arriba es lo seguro.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import {
  PROGRAMAS, contarBacklog, estaCerrado, generarInforme, DESTINO,
} from '../../scripts/programa/reconciliar-programas.mjs'
import { REQUISITOS, sinProbar } from '@/lib/programa/requisitos'

const DIRECTIVO = 'agent-state/AUSCULTA_MASTER_LOOP_DIRECTIVO.md'

describe('el contrato del loop sobrevive al fin de sesión', () => {
  it('el directivo está en disco, no sólo en un mensaje', () => {
    expect(existsSync(DIRECTIVO)).toBe(true)
  })

  it('trae los 26 apartados, numerados', () => {
    /* Del §0 al §26 son 27 encabezados. Si alguien recorta el directivo para
       «resumirlo», esto cae: un contrato resumido es otro contrato. */
    const texto = readFileSync(DIRECTIVO, 'utf8')
    const apartados = [...texto.matchAll(/^## (\d+)\./gm)].map(m => Number(m[1]))
    for (let n = 0; n <= 26; n += 1) {
      expect([n, apartados.includes(n)]).toEqual([n, true])
    }
  })

  it('conserva las ocho condiciones del §25 y la regla del §26', () => {
    /**
     * Son las dos partes que un agente cansado tiene más incentivo en aflojar:
     * cuándo puede declarar terminado, y si puede pararse entre requisitos.
     */
    const texto = readFileSync(DIRECTIVO, 'utf8')
    const condiciones = texto.slice(texto.indexOf('## 25.'), texto.indexOf('## 26.'))
    for (let n = 1; n <= 8; n += 1) expect(condiciones).toContain(`${n}.`)
    expect(texto).toContain('NO detenerse después de cada requisito')
    expect(texto).toContain('NO MERGE')
    expect(texto).toContain('NO DEPLOY')
  })

  it('y el estado operativo apunta al directivo en vez de sustituirlo', () => {
    /* El archivo viejo se quedó con 33 líneas y una rama muerta, y se leía como
       si fuera el contrato. Ahora dice cuál manda. */
    const estado = readFileSync('agent-state/AUSCULTA_MASTER_LOOP.md', 'utf8')
    expect(estado).toContain('AUSCULTA_MASTER_LOOP_DIRECTIVO.md')
    expect(estado).not.toContain('claude/ausculta-consultorio-completion-hoahgw')
  })
})

describe('los tres programas se cuentan en un solo sitio', () => {
  it('están declarados los tres, con su carril', () => {
    expect(PROGRAMAS).toHaveLength(3)
    expect([...PROGRAMAS.map(p => p.id)].sort()).toEqual(['ausculta', 'v10', 'v9'])
    /* El carril es lo que decide quién EJECUTA. Sin él, contar V10 se leería
       como comprometerse a hacerlo. */
    expect(PROGRAMAS.find(p => p.id === 'v10')!.carril).toBe('product-excellence')
  })

  it('cada backlog declarado existe y se puede contar', () => {
    /**
     * El cero falso: si un archivo cambiara de nombre, `contarBacklog` devolvería
     * `null`, el documento pondría un guion y el conteo pasaría en verde
     * custodiando nada.
     */
    for (const p of PROGRAMAS.slice(1)) {
      const c = contarBacklog(p.fuente)
      expect([p.id, c === null]).toEqual([p.id, false])
      expect([p.id, c!.total > 0]).toEqual([p.id, true])
    }
  })

  it('el documento coincide con lo que dicen los archivos', () => {
    const censo = { total: REQUISITOS.length, abiertos: sinProbar().length }
    expect(readFileSync(DESTINO, 'utf8')).toBe(generarInforme(censo))
  })

  it('el informe no puede generarse sin el conteo del censo', () => {
    /* Opcional, un llamador que lo olvidara publicaría un documento donde
       Ausculta sale con un guion — y el programa que sí custodiamos sería el
       único invisible. */
    // @ts-expect-error se comprueba justamente que falte
    expect(() => generarInforme()).toThrow()
    // @ts-expect-error idem
    expect(() => generarInforme({})).toThrow()
  })

  it('«abierto» señala de más, no de menos', () => {
    expect(estaCerrado('CERRADO 9-ago-2026')).toBe(true)
    expect(estaCerrado('RESUELTO 10-ago-2026')).toBe(true)
    /* Parcialmente cerrado NO es cerrado. En custodia, equivocarse hacia arriba
       es lo seguro. */
    expect(estaCerrado('parcialmente-cerrado')).toBe(false)
    expect(estaCerrado('abierto')).toBe(false)
    expect(estaCerrado(undefined)).toBe(false)
  })
})

describe('lo que se midió de V9 queda con su evidencia', () => {
  const v9 = contarBacklog('agent-state/BACKLOG.json')!

  it('bajó de diez abiertos a cinco, y no por decreto', () => {
    /* Cinco estaban hechos. El número no se ajustó: se comprobó cada uno. */
    expect(v9.abiertos).toBe(5)
  })

  it('cada item que sigue abierto dice qué se comprobó contra el árbol', () => {
    /**
     * Al revés: un item que vuelva a quedarse sin comprobación pone esto rojo.
     * Es lo que impide que el backlog vuelva a envejecer tres semanas sin que
     * nadie lo note.
     */
    for (const i of v9.lista) {
      expect([i.id, typeof i.verificado === 'string' && i.verificado.length > 40])
        .toEqual([i.id, true])
    }
  })

  it('el que sigue abierto de verdad está nombrado', () => {
    /* SAFE-003: el golden de dosis desconocida no tiene un solo caso pediátrico.
       Es trabajo interno real, y por eso no se cerró. */
    const abierto = v9.lista.find(i => i.id === 'SAFE-003')
    expect(abierto).toBeDefined()
    expect(abierto!.verificado).toContain('pediatric')
  })
})

describe('el censo custodia los dos programas ajenos', () => {
  it('hay una fila que responde por ellos', () => {
    /* Sin fila, el conteo viviría sólo en un script y volvería a perderse: es
       exactamente cómo se perdieron seis dominios antes. */
    const fila = REQUISITOS.find(r => r.id === 'WS-01.programas-paralelos')
    expect(fila).toBeDefined()
    expect(fila!.estado).toBe('PROVEN')
    expect(fila!.evidencia).toContain('V10')
  })

  it('y otra responde por el directivo durable', () => {
    const fila = REQUISITOS.find(r => r.id === 'WS-01.directivo-durable')
    expect(fila).toBeDefined()
    expect(fila!.artefactos).toContain(DIRECTIVO)
  })
})
