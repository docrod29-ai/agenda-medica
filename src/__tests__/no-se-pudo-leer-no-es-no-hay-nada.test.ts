/**
 * «NO SE PUDO LEER» NO ES «NO HAY NADA».
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * Seis superficies clínicas pintaban EL MISMO PÍXEL —ninguno— para dos estados
 * que no tienen nada que ver:
 *
 *   · la lectura falló (red caída, permiso denegado, servidor lento)
 *   · la lectura salió bien y no había nada que enseñar
 *
 * En concreto, y con la línea exacta que lo hacía:
 *
 *   ZC-001  AlertasDelEpisodio        `if (!alertas || alertas.length === 0) return null`
 *   ZC-004  CabosSueltosDelPaciente   `if (!cabos) return null`
 *   ZC-005  InternamientosDelPaciente `if (!lista || lista.length === 0) return null`
 *   ZC-006  ContinuidadPanel          `.catch(() => {})` y luego el vacío borra la zona
 *   C-010   /hospitalizacion/indicadores  `.catch(() => {})` → «0 internados»
 *   C-037   AsientosSection           `.catch(() => {})` → la sección desaparece
 *
 * Traducido a lo que le pasa a alguien: un potasio de 7.2 con su alerta escrita
 * se vuelve invisible; un «resultado sin leer» del expediente desaparece; un
 * paciente que estuvo ingresado dos veces se lee como si nunca lo hubieran
 * internado; y el tablero de indicadores afirma «0 internados» con la misma cara
 * de dato bueno que cuando de verdad no hay nadie.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Auditoría del Panel de Lujo, 6-sep-2026. La oleada de cierre de componentes
 * (`crudos/Z-cierre-componentes.json`) y el auditor de código (`C-*`) llegaron a
 * la misma familia por caminos distintos: cinco de los seis archivos llevaban
 * escrito en su PROPIO comentario que esto no había que hacerlo, y lo hacían dos
 * líneas más abajo. El comentario decía «`null` es "no se pudo leer", que NO es
 * "no hay pendientes"» y el `if` siguiente trataba ese `null` como el vacío.
 *
 * ── CAUSA RAÍZ ──────────────────────────────────────────────────────────────
 *
 * Un solo estado (`null`) para dos hechos incompatibles, y ninguna pieza
 * compartida que dijera cómo se pinta un fallo de lectura. Sin esa pieza, cada
 * componente nuevo vuelve a elegir — y la elección barata es `return null`.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * Regla 4 de seguridad clínica: **ausencia de dato no es dato de ausencia**.
 * Esta prueba es esa regla aplicada a la interfaz: el fallo tiene su propio
 * estado, se pinta con `NoSePudoLeer`, y esa rama va ANTES que la del vacío.
 * El orden importa: una rama de fallo escrita debajo del `return null` del
 * vacío no se alcanza nunca, y el defecto vuelve con la prueba en verde.
 *
 * ── QUÉ **NO** CUBRE ────────────────────────────────────────────────────────
 *
 * · No renderiza: la suite corre en `environment: 'node'` y no hay DOM. Se
 *   comprueba el CONTRATO del archivo (qué estados hay y en qué orden se
 *   consultan), no los píxeles. Un fallo de estilo que dejara el aviso
 *   invisible pasaría esta prueba.
 * · No cubre las superficies de otras rebanadas con el mismo defecto: `/crm`
 *   (C-008) y `/membresias` (C-009) quedan en el handoff, y esta prueba no las
 *   mira.
 * · No comprueba que el reintento vuelva a leer de verdad: comprueba que el
 *   botón existe y que hay un contador de intento en las dependencias.
 * · No dice nada sobre qué pasa si la lectura falla **y** hay datos viejos en
 *   pantalla: hoy ninguna de las seis conserva lo anterior.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { POR_QUE_EXISTE } from '@/components/ui/NoSePudoLeer'

const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

/**
 * Se mira el CÓDIGO, no lo que el archivo cuenta de sí mismo.
 *
 * Sin esto la prueba se engañaba sola: los comentarios de estos archivos citan
 * literalmente el defecto que reparan («`.catch(() => {})` dejaba `tareas` en
 * `[]`…»), así que un guardián que buscara ese patrón sobre el texto entero se
 * ponía rojo por la explicación de por qué ya no está. Un guardián que no
 * distingue el código de su comentario mide otra cosa.
 */
const soloCodigo = (src: string) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1')

/**
 * Las seis superficies, con la rama de vacío que ANTES se comía el fallo.
 *
 * `vacio: null` = la superficie no tiene una rama de vacío que preceder (el
 * tablero de indicadores pinta cifras, no un hueco); ahí sólo se exige que el
 * fallo exista y se pinte.
 */
const SUPERFICIES: { id: string; archivo: string; que: string; vacio: string | null }[] = [
  {
    id: 'ZC-001', archivo: 'src/components/AlertasDelEpisodio.tsx',
    que: 'las alertas de este paciente',
    vacio: 'if (!alertas || alertas.length === 0) return null',
  },
  {
    id: 'ZC-004', archivo: 'src/components/CabosSueltosDelPaciente.tsx',
    que: 'los pendientes de este paciente',
    vacio: 'if (!cabos) return null',
  },
  {
    id: 'ZC-005', archivo: 'src/components/InternamientosDelPaciente.tsx',
    que: 'sus ingresos hospitalarios',
    vacio: 'if (!lista || lista.length === 0) return null',
  },
  {
    id: 'ZC-006', archivo: 'src/components/ContinuidadPanel.tsx',
    que: 'los pendientes que siguen abiertos',
    vacio: 'if (cargando || ordenadas.length === 0) return null',
  },
  {
    id: 'C-010', archivo: 'src/app/(dashboard)/hospitalizacion/indicadores/page.tsx',
    que: 'los episodios de hospitalización',
    vacio: null,
  },
  {
    id: 'C-037', archivo: 'src/components/AsientosSection.tsx',
    que: 'los médicos que se están cobrando',
    vacio: 'if (!st || !st.conAsientos) return null',
  },
]

describe('el fallo de lectura tiene estado propio y se ve', () => {
  it.each(SUPERFICIES)('$id · $archivo lo guarda aparte y lo pinta', ({ archivo, que }) => {
    const src = leer(archivo)
    /* Un estado propio: no se reutiliza el `null` del dato. */
    expect(src).toMatch(/const \[falloAlLeer, setFalloAlLeer\] = useState<unknown>\(undefined\)/)
    /* Y se pinta con la pieza compartida, con el sustantivo de ESTA superficie. */
    expect(src).toContain('<NoSePudoLeer')
    expect(src).toContain(`que="${que}"`)
  })

  it.each(SUPERFICIES.filter(s => s.vacio))(
    '$id · la rama del fallo va ANTES que la del vacío',
    ({ archivo, vacio }) => {
      const src = soloCodigo(leer(archivo))
      const fallo = src.indexOf('falloAlLeer !== undefined')
      const hueco = src.indexOf(vacio!)
      expect(hueco, `no se encontró la rama de vacío: ${vacio}`).toBeGreaterThan(-1)
      expect(fallo).toBeGreaterThan(-1)
      expect(fallo).toBeLessThan(hueco)
    },
  )

  it.each(SUPERFICIES)('$id · ningún `catch` se traga el error en silencio', ({ archivo }) => {
    const src = soloCodigo(leer(archivo))
    /*
     * AL REVÉS: si alguien vuelve a poner `.catch(() => {})` —el patrón exacto
     * de ZC-006, C-010 y C-037— esta línea se pone roja. Se comprueba sobre el
     * archivo entero, no sólo sobre la lectura principal.
     */
    expect(src).not.toMatch(/\.catch\(\(\)\s*=>\s*\{\s*\}\)/)
  })

  it('reintentar existe en todas y no es decorativo', () => {
    for (const { archivo } of SUPERFICIES) {
      const src = leer(archivo)
      expect(src, archivo).toMatch(/alReintentar=\{/)
      /* El reintento tiene que volver a disparar la lectura: o hay un contador
         en las dependencias del efecto, o la propia función de carga se llama. */
      expect(src, archivo).toMatch(/intento\]|alReintentar=\{cargar\}/)
    }
  })
})

describe('la pieza compartida dice lo único que sabe', () => {
  const comp = leer('src/components/ui/NoSePudoLeer.tsx')

  it('no afirma cuántos elementos había', () => {
    /* Sólo se afirma que NO se leyeron. Cualquier cifra sería inventada. */
    expect(comp).toContain('No se pudieron leer ${que}.')
    expect(POR_QUE_EXISTE).toMatch(/[Aa]usencia de dato no es dato de ausencia/)
  })

  it('avisa de que lo visible puede estar incompleto', () => {
    /* Es el punto entero: sin esta frase el hueco se vuelve a leer como «no hay
       nada», que es lo que pasaba antes. */
    expect(comp).toContain('Lo que ves abajo no está completo')
  })

  it('el objetivo táctil de Reintentar llega a 44 px', () => {
    expect(comp).toMatch(/minHeight: 44, minWidth: 44/)
  })

  it('no interrumpe: es `status`, no `alert`', () => {
    /* Un fallo de lectura no le quita el foco al médico de donde estaba. */
    const codigo = soloCodigo(comp)
    expect(codigo).toMatch(/role="status"/)
    expect(codigo).not.toMatch(/role="alert"/)
  })

  it('no imprime el error crudo', () => {
    /* El error entra para TRADUCIRSE, nunca para pintarse. */
    const codigo = soloCodigo(comp)
    expect(codigo).not.toMatch(/\{String\(error\)\}|\{error\}/)
    expect(codigo).toMatch(/enEspanolLlano\(error\)/)
  })
})
