/**
 * GOLDEN — el diálogo canónico existe, y hay diálogos que no lo usan.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * El trinquete de interfaz declara en su cabecera lo que NO ve: «no ve el
 * movimiento ni el orden de tabulación». Sesenta combinaciones en cero de axe
 * no dicen nada sobre el teclado. Así que se barrió el árbol buscando capas a
 * pantalla completa —`position: fixed` con `inset: 0`— y se miró cuáles traen
 * lo que un diálogo necesita.
 *
 * ── LO QUE SALIÓ ────────────────────────────────────────────────────────────
 *
 * `ui/Modal.tsx` está BIEN hecho: cierra con Escape, atrapa el foco entre el
 * primero y el último elemento, se anuncia con `role="dialog"` y `aria-modal`,
 * y devuelve el foco a quien lo abrió. Alguien hizo ese trabajo.
 *
 * Y varios diálogos no lo usan. El peor era el de **anular un cobro**: escrito
 * a mano con dos `div`, sin Escape, sin trampa de foco y sin anunciarse. Con el
 * foco suelto, tabular desde ahí se va a la página de detrás — el médico sigue
 * tabulando creyendo que está dentro del diálogo. Y no es un panel cualquiera:
 * es la confirmación de un acto **destructivo sobre dinero**.
 *
 * Familia conocida de este repositorio: la lección vive en un componente y
 * nada obliga a usarlo. La misma de `Field.tsx` en la unidad 46.
 *
 * ── POR QUÉ ESTA PRUEBA TIENE UNA LISTA ─────────────────────────────────────
 *
 * Porque quedan más, y esconderlos sería peor que declararlos. La lista dice
 * cuáles son y por qué siguen abiertos. Un diálogo NUEVO a mano hace fallar la
 * prueba; cerrar uno de los declarados obliga a quitarlo de la lista.
 *
 * ── PROBADO AL REVÉS ────────────────────────────────────────────────────────
 *
 * Devolviendo el diálogo de anular a mano, cae. Añadiendo una capa nueva sin
 * teclado a cualquier archivo, cae con el nombre del archivo.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · Escáner de fuente: no pulsa Escape ni tabula. Que `ui/Modal` atrape el foco
 *   de verdad se comprueba en navegador, y esta prueba sólo exige que el
 *   diálogo de anular PASE por él.
 * · **CORREGIDO el 31-ago: SÍ mira `src/app/mi/**`.** La línea anterior decía
 *   que no, y era falsa: el barrido es `find src/app src/components`, o sea 221
 *   archivos con el portal dentro. Medido, y probado al revés metiéndole al
 *   portal un `fixed; inset: 0` sin teclado — el guardián lo canta por su
 *   nombre. Lo que pasa es que el portal HOY no tiene ninguna capa a pantalla
 *   completa: su única `fixed` es la barra de destinos (`left/right/bottom`),
 *   que no es un diálogo.
 *
 *   Se corrige porque una limitación declarada de menos cuesta trabajo real:
 *   llevó a planear una unidad entera para «cubrir el portal», que ya estaba
 *   cubierto. Un «QUÉ NO CUBRE» equivocado hacia abajo es tan caro como uno
 *   equivocado hacia arriba — sólo que la factura la paga el siguiente.
 * · **UCI/hospital SÍ entran** por el mismo `find`; no se separan del resto.
 * · Lo que de verdad NO cubre: un diálogo que no sea una capa `fixed` a pantalla
 *   completa —el patrón `CAPA` pide `inset: 0` o `top: 0 … left: 0`—, y el
 *   teclado de verdad: esto lee fuente, no pulsa Escape ni tabula.
 * · No juzga el orden de tabulación dentro de un diálogo correcto.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

/**
 * Capas a pantalla completa que NO son diálogos y por qué. Verificado leyendo,
 * no suponiendo: un barrido por patrón las confunde con un diálogo y las dos
 * primeras versiones de este barrido lo hicieron.
 */
const NO_SON_DIALOGOS: Record<string, string> = {
  'src/app/(dashboard)/citas/page.tsx':
    'capturador de clic fuera para cerrar un menú, sin contenido dentro',
  'src/components/DoctorFilter.tsx':
    'lo mismo: el desplegable va aparte, en position absolute',
}

/**
 * Diálogos a mano que siguen sin el teclado completo. Declarados, no
 * escondidos. Cerrar uno obliga a quitarlo de aquí.
 */
/**
 * Diálogos a mano SIN el teclado completo. Vacío desde la unidad 51.
 *
 * Empezó en cinco (unidad 48) con dos de sus razones **exageradas**: el barrido
 * no conocía `useCerrarConEscape`, el gancho estrecho que ya existía, así que
 * dio por «sin Escape» a `PanelLaboratorios` y al cajón de navegación, que lo
 * tenían desde antes. A los dos les faltaba la trampa de foco, no las tres
 * cosas. Corregido al aprender el idioma.
 *
 * Que esté vacío NO significa que no queden diálogos a mano: significa que los
 * que hay traen el teclado. El caso de abajo impide que aparezca uno sin él.
 */
const ABIERTOS: Record<string, string> = {}

/**
 * Diálogos que usan el gancho `useDialogoDeTeclado` en vez de `ui/Modal`, con
 * la razón por la que no pueden ser un `Modal`. Tienen el teclado completo; lo
 * que cambia es una regla, y está declarada.
 *
 * El barrido por patrón no los distingue —no llevan `key === 'Escape'` escrito,
 * lo trae el gancho— así que se piden por nombre: cada uno debe llamar al
 * gancho y anunciarse con su rol.
 */
const CON_GANCHO: Record<string, string> = {
  'src/components/AutoLogout.tsx':
    'aviso de cierre de sesión: NO debe cerrarse con Escape, sería desactivar ' +
    'un control de seguridad sin querer',
  'src/components/PaletteBusqueda.tsx':
    'la paleta gobierna su propio teclado (flechas, Enter) y enfoca su campo',
  'src/components/laboratorio/PanelLaboratorios.tsx':
    'diálogo dentro de un panel con su propio estado; migrarlo a Modal movería ' +
    'su maquetación (maxHeight + scroll propio) sin necesidad',
  'src/app/(dashboard)/layout.tsx':
    'el cajón entra deslizándose desde el borde y vive montado: no es la forma ' +
    'de Modal',
  'src/components/OnboardingTour.tsx':
    'gobierna flecha derecha y Enter para avanzar el tour',
}

// Sin la bandera `s`: no se usa `.` en ninguna parte —`[^}]` ya cruza saltos de
// línea— y el objetivo de TypeScript de este proyecto no la admite.
/** El código sin su prosa: un comentario no puede satisfacer una prueba. */
const sinComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const CAPA = /position: ['"]fixed['"][^}]{0,220}(inset: 0|top: 0[^}]{0,80}left: 0)/

/**
 * Los tres rasgos, cada uno con las formas que el repositorio usa de verdad.
 * `Modal` escribe la trampa como `e.key !== 'Tab'` (sale pronto); un diálogo a
 * mano la escribiría como `=== 'Tab'`. Pedir sólo una de las dos daba por
 * bueno lo que no lo era y por malo el canónico — la primera versión de esta
 * prueba falló contra `ui/Modal`, que es justo el que está bien.
 */
/**
 * Escape, en las DOS formas que este repositorio usa: a mano, o con el gancho
 * estrecho `useCerrarConEscape` que ya existía en `lib/ui/activable`.
 *
 * La primera versión de este barrido sólo conocía la primera, y por eso dijo
 * que a `PanelLaboratorios` «le faltan las tres» y al cajón de navegación «le
 * faltan Escape y trampa». **Las dos afirmaciones exageraban el defecto**: los
 * dos cierran con Escape desde antes. Lo que les faltaba era la trampa de foco.
 * Corregido aquí y en la bitácora.
 */
const ESCAPE = /key === 'Escape'|useCerrarConEscape\(/
const TRAMPA = /key [!=]== 'Tab'/
const ROL = /role=["']dialog["']/

function dialogosAMano(): string[] {
  const archivos = execSync("find src/app src/components -name '*.tsx'", { encoding: 'utf8' })
    .trim().split('\n')
  const fuera: string[] = []
  for (const f of archivos) {
    if (f.endsWith('ui/Modal.tsx')) continue
    const s = readFileSync(f, 'utf8')
    if (!CAPA.test(s) && !/className=["'][^"']*modal-overlay/.test(s)) continue
    // El gancho trae Escape y trampa; quien lo usa sólo pone el rol.
    const conGancho = /useDialogoDeTeclado\(/.test(s)
    const completo = conGancho
      ? ROL.test(s)
      : ESCAPE.test(s) && TRAMPA.test(s) && ROL.test(s)
    if (!completo) fuera.push(f)
  }
  return fuera.sort()
}

describe('el teclado del diálogo vive en un solo sitio', () => {
  const GANCHO = readFileSync('src/hooks/useDialogoDeTeclado.ts', 'utf8')
  const MODAL = readFileSync('src/components/ui/Modal.tsx', 'utf8')

  it('el gancho trae las cinco cosas que un diálogo necesita', () => {
    expect(GANCHO, 'Escape').toMatch(ESCAPE)
    expect(GANCHO, 'trampa de foco').toMatch(TRAMPA)
    // Devuelve el foco: sin esto, cerrar deja al teclado al principio de todo.
    expect(GANCHO, 'devuelve el foco a quien lo abrió').toMatch(/disparador\?\.focus/)
    // Y bloquea el scroll del cuerpo, que en móvil se desplazaba por debajo.
    expect(GANCHO, 'bloquea el scroll del cuerpo').toMatch(/body\.style\.overflow = 'hidden'/)
    // El ciclo se cierra en los DOS sentidos: sin shift también.
    expect(GANCHO, 'trampa en los dos sentidos').toMatch(/e\.shiftKey/)
  })

  it('y el canónico se anuncia', () => {
    expect(MODAL, 'se anuncia').toMatch(ROL)
    expect(MODAL, 'aria-modal').toMatch(/aria-modal/)
  })
})

describe('anular un cobro pasa por el diálogo canónico', () => {
  const FINANZAS = readFileSync('src/app/(dashboard)/finanzas/page.tsx', 'utf8')

  it('usa <Modal>, no una capa a mano', () => {
    expect(FINANZAS).toMatch(/<Modal\s/)
    expect(FINANZAS).toMatch(/title="Anular cobro"/)
  })

  it('conserva lo que ya hacía bien: guardando no se cierra', () => {
    // Cerrar a media anulación deja al médico sin saber si el cobro se anuló.
    expect(FINANZAS).toMatch(/closeOnOverlay=\{!anulaGuardando\}/)
    expect(FINANZAS).toMatch(/if \(!anulaGuardando\) setAnulando\(null\)/)
  })

  it('el motivo de la anulación tiene nombre, no sólo placeholder', () => {
    expect(FINANZAS).toMatch(/aria-label="Motivo de la anulación"/)
  })
})

describe('no aparece un diálogo a mano nuevo', () => {
  it('todo lo que el barrido encuentra está declarado', () => {
    const encontrados = dialogosAMano()
    const declarados = new Set([
      ...Object.keys(ABIERTOS), ...Object.keys(NO_SON_DIALOGOS), ...Object.keys(CON_GANCHO),
    ])
    const nuevos = encontrados.filter(f => !declarados.has(f))
    expect(
      nuevos,
      `capa(s) a pantalla completa sin teclado y sin declarar: ${nuevos.join(', ')}. ` +
      'Usa `ui/Modal` — ya resuelve Escape, trampa de foco y anuncio.',
    ).toEqual([])
  })

  it('la lista de abiertos no crece', () => {
    // Sólo puede bajar. Es el mismo contrato que los demás trinquetes.
    // 5 en la unidad 48 · 3 en la 49 · 0 en la 51. Sólo baja.
    expect(Object.keys(ABIERTOS).length).toBeLessThanOrEqual(0)
  })

  it('los que usan el gancho lo usan de verdad, y se anuncian', () => {
    for (const [f, razon] of Object.entries(CON_GANCHO)) {
      const s = readFileSync(f, 'utf8')
      expect(s, `${f} dejó de usar el gancho (${razon})`).toMatch(/useDialogoDeTeclado\(/)
      expect(s, `${f} no se anuncia como diálogo`).toMatch(/role=["'](dialog|alertdialog)["']/)
      expect(s, `${f} sin aria-modal`).toMatch(/aria-modal/)
    }
  })

  it('el aviso de cierre de sesión NO se descarta con Escape', () => {
    /**
     * La única diferencia legítima, y tiene que seguir siendo deliberada: un
     * Escape distraído desactivaría un control de seguridad.
     *
     * SIN COMENTARIOS, a propósito. La primera versión de este caso miraba el
     * archivo entero y **la prosa que explica la opción la satisfacía**:
     * quitando la opción del código, la prueba seguía verde porque el párrafo
     * de arriba la nombra. Probado al revés y cazado ahí.
     */
    const s = sinComentarios(readFileSync('src/components/AutoLogout.tsx', 'utf8'))
    expect(s, 'la opción está en la prosa, no en el código').toMatch(/cierraConEscape: false/)
    // Y es `alertdialog`, no `dialog`: interrumpe y pide decisión con plazo.
    expect(s).toMatch(/role="alertdialog"/)
  })

  it('el gancho salió de Modal, y Modal lo usa — no hay dos implementaciones', () => {
    const modal = readFileSync('src/components/ui/Modal.tsx', 'utf8')
    expect(modal, 'Modal volvió a escribir su propio teclado').toMatch(/useDialogoDeTeclado\(/)
    // Y ya no queda la copia a mano dentro de Modal.
    expect(modal).not.toMatch(/key !== 'Tab'/)
  })

  it('el barrido mira código de verdad', () => {
    // Sin esto, un `find` que no devuelva nada haría pasar todo lo anterior.
    const archivos = execSync("find src/app src/components -name '*.tsx'", { encoding: 'utf8' })
      .trim().split('\n')
    expect(archivos.length).toBeGreaterThan(100)
    // Y sigue habiendo capas a pantalla completa que mirar: si el patrón deja
    // de encontrarlas, la lista vacía de arriba no significaría nada.
    const capas = archivos.filter(f => CAPA.test(readFileSync(f, 'utf8')))
    expect(capas.length, 'el patrón dejó de encontrar capas').toBeGreaterThan(3)
  })
})
