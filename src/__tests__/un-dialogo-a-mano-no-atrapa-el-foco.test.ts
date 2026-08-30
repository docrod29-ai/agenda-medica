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
 * · No mira `src/app/mi/**` (portal del paciente) ni UCI/hospital.
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
const ABIERTOS: Record<string, string> = {
  'src/components/AutoLogout.tsx':
    'aviso de cierre de sesión: NO debe cerrarse con Escape —sería desactivar ' +
    'un control de seguridad sin querer— pero le faltan la trampa de foco y el rol',
  'src/components/laboratorio/PanelLaboratorios.tsx':
    'revisión de lo que leyó la IA; le faltan las tres',
  'src/app/(dashboard)/layout.tsx':
    'cajón de navegación en móvil: tiene role=dialog, le faltan Escape y trampa',
  'src/components/OnboardingTour.tsx': 'tiene Escape; le falta la trampa de foco',
  'src/components/PaletteBusqueda.tsx':
    'tiene Escape y enfoca su campo; le faltan la trampa y el rol',
}

// Sin la bandera `s`: no se usa `.` en ninguna parte —`[^}]` ya cruza saltos de
// línea— y el objetivo de TypeScript de este proyecto no la admite.
const CAPA = /position: ['"]fixed['"][^}]{0,220}(inset: 0|top: 0[^}]{0,80}left: 0)/

/**
 * Los tres rasgos, cada uno con las formas que el repositorio usa de verdad.
 * `Modal` escribe la trampa como `e.key !== 'Tab'` (sale pronto); un diálogo a
 * mano la escribiría como `=== 'Tab'`. Pedir sólo una de las dos daba por
 * bueno lo que no lo era y por malo el canónico — la primera versión de esta
 * prueba falló contra `ui/Modal`, que es justo el que está bien.
 */
const ESCAPE = /key === 'Escape'/
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
    const completo = ESCAPE.test(s) && TRAMPA.test(s) && ROL.test(s)
    if (!completo) fuera.push(f)
  }
  return fuera.sort()
}

describe('el diálogo canónico sigue siendo canónico', () => {
  const MODAL = readFileSync('src/components/ui/Modal.tsx', 'utf8')

  it('trae las cuatro cosas que un diálogo necesita', () => {
    expect(MODAL, 'Escape').toMatch(ESCAPE)
    expect(MODAL, 'trampa de foco').toMatch(TRAMPA)
    expect(MODAL, 'se anuncia').toMatch(ROL)
    expect(MODAL, 'aria-modal').toMatch(/aria-modal/)
    // Y devuelve el foco: sin esto, cerrar deja al teclado al principio de todo.
    expect(MODAL, 'devuelve el foco a quien lo abrió').toMatch(/disparador\?\.focus/)
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
    const declarados = new Set([...Object.keys(ABIERTOS), ...Object.keys(NO_SON_DIALOGOS)])
    const nuevos = encontrados.filter(f => !declarados.has(f))
    expect(
      nuevos,
      `capa(s) a pantalla completa sin teclado y sin declarar: ${nuevos.join(', ')}. ` +
      'Usa `ui/Modal` — ya resuelve Escape, trampa de foco y anuncio.',
    ).toEqual([])
  })

  it('la lista de abiertos no crece', () => {
    // Sólo puede bajar. Es el mismo contrato que los demás trinquetes.
    expect(Object.keys(ABIERTOS).length).toBeLessThanOrEqual(5)
  })

  it('el barrido mira código de verdad', () => {
    // Sin esto, un `find` que no devuelva nada haría pasar todo lo anterior.
    const archivos = execSync("find src/app src/components -name '*.tsx'", { encoding: 'utf8' })
      .trim().split('\n')
    expect(archivos.length).toBeGreaterThan(100)
    expect(dialogosAMano().length).toBeGreaterThan(0)
  })
})
