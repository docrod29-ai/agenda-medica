/**
 * GOLDEN — en el portal del paciente, el aviso de urgencia era el texto más
 * pequeño y más apagado de la pantalla, y el número no se podía marcar.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Mirándolo. Sesión real contra el emulador, token de alcance CLÍNICO —el que
 * abre recetas y paquetes, porque con el de mostrador media pantalla es un muro
 * y se estaría juzgando el muro—, los cinco destinos, dos anchos y dos temas:
 * `scripts/ausculta-transformacion/mirar-el-portal.mjs`. Capturas en
 * `docs/audit/ausculta-transformacion/portal/`.
 *
 * Y esto es lo que hay que subrayar: **axe daba las veinte combinaciones
 * limpias**, con las etiquetas WCAG A/AA/2.2 y las buenas prácticas encendidas.
 * Cero violaciones, antes y después. La máquina no tenía nada que decir sobre
 * la pantalla donde alguien con dolor torácico busca a quién llamar.
 *
 * ── LO QUE SE MIDIÓ, EN PÍXELES ─────────────────────────────────────────────
 *
 * Estilos computados del destino «Preguntar» a 390, tema oscuro:
 *
 *     H1  «Hola, Rosalía»                      19px   #F2EFE9   y=60
 *     P   «Aquí puedes gestionar tus citas.»   14px   #8A8F94   y=88
 *     H2  «Preguntar»                          16px   #F2EFE9   y=149
 *     P   «Si tienes una duda…»                14px   #A8ACAE   y=202
 *     P   «Si es una urgencia —dolor en el
 *          pecho…— llama al 911»               12px   #8A8F94   y=283  ← el último
 *
 * Doce píxeles y `--text3`: **el texto más pequeño y más apagado de todo el
 * portal** era la instrucción de qué hacer ante un infarto. Tercer párrafo,
 * último elemento, y sólo en una de las cinco pestañas. `enlaces tel: = 0`.
 *
 * ── LA REGLA QUE ESTO INCUMPLE, PALABRA POR PALABRA ─────────────────────────
 *
 * `.claude/rules/patient-facing-ai.md` §6: «La urgencia gana a todo lo demás […]
 * **Un aviso urgente que llega en el tercer párrafo no llegó.**» Era, literal,
 * el tercer párrafo.
 *
 * ── LA CAUSA RAÍZ, Y POR QUÉ ES LA DE SIEMPRE ───────────────────────────────
 *
 * `src/lib/paciente/urgencia.ts` existe y hace esto BIEN: `mensajeDeUrgencia()`
 * pone el aviso en la primera línea, con el número, y su comentario cita el §6
 * al hacerlo. Ese módulo nació para arreglar el canal de WhatsApp — y su propia
 * cabecera dice de dónde sacó la política:
 *
 *     «la vía de contacto —urgencias o 911— es la que el portal del paciente
 *      (`app/mi/[token]`) le dice desde siempre a quien entra por ahí»
 *
 * O sea: se copió la política DEL portal, se aplicó bien en WhatsApp, y no se
 * volvió a mirar el portal. La lección se aprendió en un canal y no en el de al
 * lado — la misma familia que la fecha del encuentro y que el rojo de grabar.
 *
 * ── Y LA LISTA SE HABÍA QUEDADO ATRÁS ───────────────────────────────────────
 *
 * La prosa del portal nombraba TRES motivos. `MOTIVO_LABEL` tiene CUATRO: el
 * que faltaba es **ingesta accidental o sobredosis**, que es justo el caso que
 * la puerta de `evals/patient-ai/` cazó en las doce preguntas del §0 de V9
 * («me tomé por accidente la medicina de otra persona»). Una lista de seguridad
 * copiada a mano se queda atrás sin que nadie lo note; por eso ahora se lee del
 * módulo y no se puede desincronizar.
 *
 * ── LOS OTROS DOS DEFECTOS DE LA MISMA PANTALLA ─────────────────────────────
 *
 * · **«Preguntar» pintaba CERO controles.** Medido: `ctrl 0` en las cuatro
 *   combinaciones. El destino que existe para llevarte con tu médico te decía
 *   que hablaras con él, sin decir cómo — porque el consultorio no tenía
 *   teléfono en su configuración y el enlace estaba detrás de un `&&`. El
 *   silencio se lee como «ya lo intenté».
 *
 * · **Los diálogos NATIVOS.** Disparado en el navegador: cancelar una cita
 *   sacaba `confirm: ¿Cancelar esta cita?`. Ese cuadro no se rotula, no se
 *   traduce y sus botones dicen «Aceptar» y «Cancelar» — donde «Cancelar»
 *   significa *no cancelar*. Y los tres `alert()` de error eran peores: se
 *   cierran sin dejar rastro, así que el paciente que falló al cancelar veía
 *   una pantalla idéntica a la del éxito.
 *
 * ── PROBADO AL REVÉS ────────────────────────────────────────────────────────
 *
 * Devolviendo el párrafo de urgencia a la tarjeta de «Preguntar», falla el
 * primer bloque. Volviendo a poner `confirm(` en el botón de cancelar, falla el
 * tercero. Copiando otra vez los tres motivos en prosa, falla el segundo.
 *
 * ── QUÉ **NO** CUBRE ────────────────────────────────────────────────────────
 *
 * · **No prueba que el 911 marque.** `tel:` en un Chromium sin marcador no
 *   llama a nadie; lo que se comprueba es que el destino sea un enlace `tel:`
 *   con el número del módulo, y no texto muerto. En un teléfono de verdad
 *   —WebKit real, que aquí no hay— esto no se ha probado y se dice.
 * · **No juzga la política clínica.** Qué cuadros son urgencia lo decide
 *   `urgencia.ts` desde el §6, y ampliarlo es trabajo con nombre. Aquí sólo se
 *   vigila que el portal no vuelva a llevar una COPIA de esa lista.
 * · **No mide contraste.** Lo mide axe sobre la página servida, en los dos
 *   temas — y ya salía limpio con el defecto puesto, que es justo el motivo de
 *   que este golden exista.
 * · No cubre el canal de WhatsApp, que ya tiene el suyo.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { MOTIVO_LABEL, TELEFONO_EMERGENCIAS } from '@/lib/paciente/urgencia'

const leer = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8')
const PORTAL = leer('src/app/mi/[token]/page.tsx')
const VIA = leer('src/components/portal/ViaDeUrgencia.tsx')
const CSS = leer('src/app/globals.css')

const sinComentarios = (src: string) =>
  src.replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ')
const CODIGO = sinComentarios(PORTAL)

describe('la vía de urgencia llega la primera, no la última', () => {
  it('se pinta antes que el contenido del destino, y fuera de cualquier pestaña', () => {
    // Fuera del `destino === …`: si viviera dentro de uno, volvería a existir
    // sólo en una de las cinco pantallas.
    expect(CODIGO).toContain('<ViaDeUrgencia telefonoConsultorio={sesion.clinica?.telefono} />')
    const iVia = CODIGO.indexOf('<ViaDeUrgencia')
    const iPrimerDestino = CODIGO.indexOf("{destino === 'hoy' &&")
    expect(iVia, 'no se pinta').toBeGreaterThan(-1)
    expect(iPrimerDestino, 'ya no hay destinos').toBeGreaterThan(-1)
    expect(iVia, 'la urgencia volvió a quedar por debajo del contenido').toBeLessThan(iPrimerDestino)
  })

  it('y el párrafo enterrado de antes no volvió', () => {
    expect(CODIGO, 'volvió el aviso dentro de la tarjeta de Preguntar')
      .not.toMatch(/no esperes respuesta por aquí/i)
    // El número suelto en prosa es lo que lo hacía intocable.
    expect(CODIGO, 'volvió el número escrito como texto muerto').not.toMatch(/llama al 911/i)
  })

  it('el número es un enlace que marca, no una cadena de texto', () => {
    expect(VIA).toContain('href={`tel:${TELEFONO_EMERGENCIAS}`}')
    expect(TELEFONO_EMERGENCIAS, 'el módulo dejó de declarar el número').toBeTruthy()
  })

  it('y el teléfono del consultorio sólo se ofrece cuando lo hay', () => {
    // Un botón que marca la cadena vacía es peor que ningún botón el día que urge.
    expect(VIA).toContain('{tel && (')
  })
})

describe('la lista de motivos no se copia a mano', () => {
  it('sale de MOTIVO_LABEL, que es donde vive la política', () => {
    expect(VIA).toContain("import { MOTIVO_LABEL, TELEFONO_EMERGENCIAS } from '@/lib/paciente/urgencia'")
    expect(VIA).toContain('Object.values(MOTIVO_LABEL)')
  })

  it('y así incluye el motivo que la copia en prosa había perdido', () => {
    // La prosa nombraba tres de cuatro. El que faltaba es el que cazó la puerta
    // de evals/patient-ai/ en las doce preguntas del §0.
    expect(Object.keys(MOTIVO_LABEL)).toContain('ingesta_accidental_o_sobredosis')
    expect(Object.values(MOTIVO_LABEL).length, 'cambió el número de motivos: revisa la pantalla').toBe(4)
  })

  it('el aviso NO se presenta como una lista cerrada', () => {
    // clinical-safety.md §5: vocabulario, no criterio. Que un cuadro no esté
    // nombrado significa que no se nombra, no que sea benigno.
    expect(VIA).toContain('o cualquier otro malestar grave')
  })
})

describe('la pantalla del paciente no habla por diálogos del navegador', () => {
  it('ningún confirm() decide sobre una cita médica', () => {
    expect(CODIGO, 'volvió el confirm() nativo').not.toMatch(/\bconfirm\s*\(/)
    // Y la confirmación que lo sustituye dice lo que importa ANTES: la ventana
    // de aviso del consultorio, y que reagendar no pierde la cita.
    expect(CODIGO).toContain('Mejor reagendar')
    expect(CODIGO).toContain('horas de anticipación')
  })

  it('ningún alert() cuenta un fallo que se cierra sin dejar rastro', () => {
    expect(CODIGO, 'volvió el alert() nativo').not.toMatch(/\balert\s*\(/)
    // El aviso se QUEDA en la pantalla, y dice que la cita no cambió: cerrar un
    // diálogo dejaba la pantalla idéntica a la del éxito.
    expect(CODIGO).toContain('const [avisoAccion, setAvisoAccion] = useState')
    expect(CODIGO).toMatch(/Tu cita sigue como estaba/)
  })
})

describe('el encabezado dice dónde estás', () => {
  it('cada destino trae su propia línea, y no una sola para los cinco', () => {
    // Medido: «Aquí puedes gestionar tus citas.» se pintaba en las VEINTE
    // combinaciones de destino, ancho y tema — encima del plan de cuidado y
    // encima de las recetas.
    expect(CODIGO, 'volvió el subtítulo único').not.toContain('Aquí puedes gestionar tus citas.')
    expect(CODIGO).toContain("DESTINOS.find(d => d.id === destino)?.pista")
    const pistas = (CODIGO.match(/pista: '/g) ?? []).length
    expect(pistas, 'algún destino se quedó sin decir qué es').toBe(5)
  })

  it('y ningún destino se queda sin una sola acción', () => {
    // «Preguntar» pintaba `ctrl 0`: existe para llevarte con tu médico y no
    // decía cómo, ni decía que no lo sabía.
    expect(CODIGO).toContain('Tu consultorio no dejó aquí un teléfono')
  })
})

describe('la barra de destinos puede tener dos formas', () => {
  it('su colocación vive en la hoja, no en un estilo en línea', () => {
    /**
     * Es la causa MECÁNICA de que fuera la misma pantalla estirada: un estilo
     * en línea gana a toda media query, así que con `position/left/right/grid`
     * en el `style={{ }}` la barra no podía comportarse distinto en un
     * escritorio ni queriendo. Medido antes: 1440 × 60, cinco columnas de
     * 288 px, con la columna de contenido en 560. Después: 560 × 69, centrada.
     */
    expect(CODIGO).toContain('<nav aria-label="Secciones" className="mi-barra-destinos">')
    expect(CODIGO, 'volvió la colocación en línea').not.toMatch(/mi-barra-destinos" style=/)
    expect(CSS).toContain('.mi-barra-destinos {')
    const i = CSS.indexOf('@media (min-width: 900px) {\n  .mi-barra-destinos {')
    expect(i, 'la barra volvió a tener una sola forma').toBeGreaterThan(-1)
    expect(CSS.slice(i, i + 300)).toContain('transform: translateX(-50%)')
  })

  it('el destino activo es una pastilla, no una losa de un quinto de pantalla', () => {
    expect(CSS).toContain(".nx-destino-portal { border-radius: 10px; }")
    expect(CSS).toContain(".nx-destino-portal[aria-current='page'] { color: var(--nexus); background: var(--nexus-soft); }")
  })
})
