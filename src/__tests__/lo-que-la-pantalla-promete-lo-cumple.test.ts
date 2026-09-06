/**
 * LO QUE LA PANTALLA PROMETE, LO CUMPLE.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * Once hallazgos del Panel de Lujo (6-sep-2026) de la misma familia: un control
 * o un texto que dice una cosa y el producto hace otra.
 *
 *   C-001 (P2)  «Mensaje para pacientes» se guardaba en `publicBookingNote` y el
 *               paciente no lo veía nunca: la ruta pública devuelve
 *               `publicBookingEnabled` y nada más.
 *   C-002 (P3)  «Hora de resumen diario» se podía configurar y ningún cron la
 *               leía. No falta la hora: no existe el resumen.
 *   C-003 (P3)  El interruptor «Mostrar signos vitales (en órdenes)» no cambiaba
 *               nada: la palabra «signos» no aparece en la orden ni en la receta.
 *   C-004 (P3)  «…y cuántas copias salen» sin ningún control debajo.
 *   ASM-015 (P2) La «vista previa de los mensajes que se envían automáticamente»
 *               enseñaba el texto de los botones MANUALES; el cron manda otro, y
 *               pide otra palabra de respuesta.
 *   ASM-018 (P3) El aviso mandaba a conectar WhatsApp «en la pestaña WhatsApp»,
 *               que no existe: se llama Integraciones.
 *   N-008 (P2)  La prueba se anunciaba con «Todas las funciones» y la IA está
 *               topada — la portada ya lo decía bien.
 *   N-010 (P2)  El cliente anual veía un precio mensual en la única pantalla
 *               donde comprueba qué paga.
 *   N-012, N-013 (P3) El índice de Operaciones ofrecía «Mensajes con pacientes»
 *               (abre el chat interno) y «De dónde llegan los pacientes» (no hay
 *               un solo dato de origen).
 *   C-028 (P3)  La página pública decía «Membresías: roadmap» y está viva.
 *   ZC-008 (P3) «Descargar PDF/texto» bajaba un `.txt`.
 *   RT-007 (P2) El Consultor ponía «✓ N citas verificadas contra las fuentes»
 *               después de comprobar que los números caben en la lista.
 *   PC-010 (P2) La Ayuda afirmaba que el acceso del cuidador ya existe con
 *               bitácora y revocación. No existe nada de eso.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Lente 2 y Lente 3 del Panel de Lujo, recorriendo el producto y comparando cada
 * promesa con el código que debía cumplirla. El equipo rojo hizo el `grep` de
 * cada campo: la mitad de estos defectos son «se guarda y nadie lo lee».
 *
 * ── CAUSA RAÍZ ──────────────────────────────────────────────────────────────
 *
 * «El dato tiene que LLEGAR». Un control que escribe correctamente en la base y
 * un texto que describe correctamente lo que se quería construir pasan las
 * pruebas de contrato de su lado; nadie miraba el otro extremo.
 *
 * ── QUÉ **NO** CUBRE ────────────────────────────────────────────────────────
 *
 * · No comprueba que los campos retirados hayan desaparecido del TIPO: quitarlos
 *   de `src/types/index.ts` es de otra rebanada y va en el handoff. Se retiran
 *   los controles, no los datos guardados — el valor que un médico escribió no
 *   se borra por una reparación.
 * · C-001 sigue sin llegar al paciente: conectar `publicBookingNote` toca la
 *   ruta pública y `/reservar`, de otra rebanada. Lo que se comprueba aquí es
 *   que la pantalla ya no promete que llega.
 * · No renderiza nada: la suite corre sin DOM. Se comprueba el contrato del
 *   archivo, no los píxeles.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const leerCrudo = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

/**
 * Se mira el CÓDIGO, no lo que el archivo cuenta de sí mismo.
 *
 * Cada reparación de esta tanda deja escrito en un comentario el texto que
 * retiró («decía "Todas las funciones"…»), que es justo lo que hay que hacer
 * para que dentro de un año se entienda el cambio. Un guardián que buscara ese
 * texto sobre el archivo entero se pondría rojo por la explicación de por qué ya
 * no está: mediría el comentario, no el producto.
 */
const soloCodigo = (src: string) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1')

const leer = (p: string) => soloCodigo(leerCrudo(p))
const CONFIG = 'src/app/(dashboard)/configuracion/page.tsx'
const RECETAS = 'src/app/(dashboard)/configuracion/secciones-recetas.tsx'
const OPERACIONES = 'src/app/(dashboard)/operaciones/page.tsx'

describe('campos de configuración que nadie leía', () => {
  it('C-002 · «Hora de resumen diario» ya no se ofrece', () => {
    const src = leer(CONFIG)
    expect(src).not.toMatch(/htmlFor="cfg-hora-de-resumen-diario"/)
    expect(src).not.toMatch(/value=\{form\.horaResumenDiario\}/)
  })

  it('C-002 · pero el dato guardado NO se destruye', () => {
    /*
     * Retirar el control es reparar; borrar el campo del tipo sería perder en
     * silencio la hora que alguien eligió a propósito. El tipo es de otra
     * rebanada y su retirada, si el dueño la quiere, va en el handoff.
     */
    expect(leer('src/types/index.ts')).toMatch(/horaResumenDiario/)
  })

  it('C-003 · el interruptor de signos vitales ya no se ofrece', () => {
    const src = leer(RECETAS)
    expect(src).not.toMatch(/<Toggle label="Mostrar signos vitales/)
    /* Y sus hermanos, que SÍ se leen, siguen ahí: no se retiró de más. */
    expect(src).toMatch(/<Toggle label="Mostrar caja de alergias"/)
    expect(src).toMatch(/<Toggle label="Mostrar diagnóstico"/)
    expect(src).toMatch(/<Toggle label="QR de verificación al pie"/)
  })

  it('C-004 · ya no se prometen copias que no existen', () => {
    const src = leer(RECETAS)
    expect(src).not.toMatch(/cuántas copias salen/)
  })

  it('C-004 · y el verificador no da por vigilado lo que nadie escribe', () => {
    const src = leer(RECETAS)
    const lista = /const CAMPOS_VERIFICABLES[^=]*= \[[\s\S]*?\n {2}\]/.exec(src)![0]
    for (const campo of ['copiasEnHoja', 'registroAntidopaje', 'mostrarSignosVitales']) {
      expect(lista, campo).not.toContain(campo)
    }
    /* AL REVÉS: los que sí se editan e imprimen siguen verificándose. */
    for (const campo of ['rfc', 'avisoLegal', 'mostrarQR']) {
      expect(lista, campo).toContain(campo)
    }
  })

  it('C-001 · la pantalla ya no promete que el paciente lee la nota del portal', () => {
    const src = leer(CONFIG)
    expect(src).toContain('Todavía no se le muestra al paciente')
    /* El texto se sigue guardando: no se pierde lo escrito. */
    expect(src).toMatch(/publicBookingNote: note/)
  })
})

describe('textos que decían otra cosa que la que pasa', () => {
  it('ASM-015 · la vista previa dice que son los mensajes MANUALES', () => {
    const src = leer(CONFIG)
    expect(src).not.toMatch(/Vista previa de los mensajes de WhatsApp que se envían automáticamente/)
    expect(src).toContain('abres tú desde la agenda')
    expect(src).toContain('No son los recordatorios automáticos')
  })

  it('ASM-018 · el aviso lleva a Integraciones en vez de nombrar una pestaña que no existe', () => {
    const src = leer(CONFIG)
    expect(src).not.toMatch(/en la pestaña <em>WhatsApp<\/em>/)
    expect(src).toMatch(/setTab\('integraciones'\)/)
    expect(src).toContain('Conectar WhatsApp en Integraciones')
  })

  it('N-008 · la prueba ya no promete «todas las funciones»', () => {
    const src = leer(CONFIG)
    expect(src).not.toMatch(/trial: {4}\['14 días gratuitos', 'Todas las funciones'/)
    expect(src).toContain('con la IA clínica limitada')
  })

  it('N-010 · el precio del plan actual conoce el ciclo', () => {
    const src = leer(CONFIG)
    expect(src).toMatch(/precioDelCiclo\(plan, cicloActual\)/)
    expect(src).toMatch(/MXN al año/)
    /* Y el importe sale del catálogo, no de un número tecleado. */
    expect(src).toMatch(/precioAnual\(p\)/)
  })

  it('N-012 · el índice no llama «mensajes con pacientes» al chat del equipo', () => {
    const src = leer(OPERACIONES)
    expect(src).not.toMatch(/'Mensajes con pacientes y con el equipo'/)
    expect(src).toContain('Mensajes entre el médico y su asistente')
  })

  it('N-013 · el CRM no promete un dato de origen que no tiene', () => {
    const src = leer(OPERACIONES)
    expect(src).not.toMatch(/De dónde llegan los pacientes/)
    expect(src).toContain('Cómo va la agenda')
  })

  it('C-028 · Membresías deja de anunciarse como «roadmap»', () => {
    const src = leer('src/app/operacion/page.tsx')
    expect(src).toMatch(/\{ nombre: 'Membresías de pacientes', estado: 'activo'/)
    /* «Comisiones: parcial» SE QUEDA: el rojo lo defendió, calcula por médico y
       no por servicio, que es justo lo que el texto llama en construcción. */
    expect(src).toMatch(/\{ nombre: 'Comisiones', estado: 'parcial'/)
  })

  it('ZC-008 · el botón nombra el formato que entrega', () => {
    const src = leer('src/components/AvisoPrivacidadModal.tsx')
    expect(src).not.toMatch(/Descargar PDF\/texto/)
    expect(src).toContain('Descargar texto')
    /* Y sigue bajando exactamente el texto cuyo hash se sella. */
    expect(src).toMatch(/text\/plain;charset=utf-8/)
  })

  it('RT-007 · el Consultor dice lo que midió, no «verificada»', () => {
    const src = leer('src/app/(dashboard)/consultor/page.tsx')
    expect(src).not.toMatch(/verificada\$\{|verificadas? contra las fuentes/)
    expect(src).toContain('apunta')
  })

  it('PC-010 · la Ayuda deja de afirmar que el cuidador ya existe', () => {
    const src = leer('src/lib/ayuda/conocimiento.ts')
    expect(src).not.toMatch(/Un familiar autorizado es una autorización explícita, revocable y con bitácora/)
    expect(src).toMatch(/Todavía NO existe un acceso propio para un familiar o cuidador/)
  })
})

describe('ZC-009 · desde el escritorio sólo se asienta lo que ocurre delante', () => {
  const src = leer('src/components/AvisoPrivacidadModal.tsx')

  it('ya no se puede afirmar que el paciente aceptó en el portal o por WhatsApp', () => {
    /*
     * Los dos medios tienen un camino real que los origina CON evidencia —el
     * portal y el bot los sellan en el servidor, con su propio hash—, así que
     * dejar que el mostrador los tecleara volvía indistinguibles un hecho
     * comprobable y un clic.
     */
    expect(src).not.toMatch(/\['presencial', 'whatsapp', 'portal'\]/)
    expect(src).toMatch(/\(\['presencial'\] as const\)/)
    expect(src).toContain('ya no se asientan desde aquí')
  })

  it('el botón dice cuál está elegido, no sólo con el color', () => {
    expect(src).toMatch(/aria-pressed=\{medio === m\}/)
  })

  it('el ámbar sale de los tokens', () => {
    expect(src).not.toMatch(/rgba\(255,200,0/)
  })
})

describe('C-013 y C-036 · nada destructivo pasa al primer clic', () => {
  it('C-013 · eliminar una cama pregunta y captura el error', () => {
    const src = leer('src/app/(dashboard)/hospitalizacion/camas/page.tsx')
    expect(src).toMatch(/¿Eliminar la cama/)
    expect(src).toMatch(/noSePudo\('eliminar la cama', e\)/)
  })

  it('C-036 · «Empezar de cero» pregunta cuando hay algo que perder', () => {
    const src = leer('src/app/(dashboard)/uci/benchmark/page.tsx')
    expect(src).toMatch(/capturas\.length > 0 && !\(await confirm\(/)
    /* Y NO pregunta cuando la lista está vacía: un diálogo que sale siempre
       enseña a decir que sí sin leer. */
    expect(src).toMatch(/Borrar y empezar de cero/)
  })

  it('C-031 · la consola del dueño no usa diálogos nativos', () => {
    const src = leer('src/app/superadmin/page.tsx')
    expect(src).not.toMatch(/window\.confirm\(/)
    expect(src).not.toMatch(/\balert\('/)
    expect(src).toMatch(/const \{ toast, confirm \} = useToast\(\)/)
  })
})

describe('el comando de mantenimiento que CLAUDE.md cita existe', () => {
  it('está en package.json y apunta a un archivo real', () => {
    /*
     * `CLAUDE.md` lo citaba entre los cinco comandos del proyecto y no existía:
     * quien llegaba nuevo lo tecleaba el primer día y aprendía que la
     * documentación miente.
     */
    const pkg = JSON.parse(leerCrudo('package.json'))
    expect(pkg.scripts.mantenimiento).toBe('node scripts/mantenimiento/chequeo.mjs')
    expect(() => leerCrudo('scripts/mantenimiento/chequeo.mjs')).not.toThrow()
  })

  it('y NINGÚN comando citado en la carta operativa falta', () => {
    /* AL REVÉS y para siempre: el guardián que evita que vuelva a pasar con otro. */
    const carta = leerCrudo('CLAUDE.md')
    const pkg = JSON.parse(leerCrudo('package.json'))
    const citados = [...new Set([...carta.matchAll(/npm run ([a-z0-9:-]+)/g)].map(m => m[1]))]
    expect(citados.length).toBeGreaterThan(2)
    expect(citados.filter(c => !(c in pkg.scripts))).toEqual([])
  })

  it('el chequeo es de SÓLO LECTURA', () => {
    const src = leerCrudo('scripts/mantenimiento/chequeo.mjs')
    for (const prohibido of ['writeFileSync', 'rmSync', 'unlinkSync', 'execSync', 'spawnSync']) {
      expect(src, prohibido).not.toContain(prohibido)
    }
  })
})

describe('D-014 · una ruta, un nombre', () => {
  it('el Sidebar lee la tabla en vez de inventar su propio nombre', () => {
    const src = leer('src/components/Sidebar.tsx')
    expect(src).toContain("from '@/lib/navegacion/etiquetas'")
    expect(src).not.toMatch(/label: 'Dashboard'/)
    expect(src).not.toMatch(/href: '\/pacientes',\s+label: 'Consulta'/)
  })

  it('Sidebar y Operaciones no le dan dos nombres a la misma ruta', () => {
    /*
     * El guardián de verdad: si alguien vuelve a escribir a mano un rótulo
     * distinto para una ruta que las dos listas contienen, esto se pone rojo.
     */
    const ops = leer(OPERACIONES)
    const etiquetas = leer('src/lib/navegacion/etiquetas.ts')
    const enOps = [...ops.matchAll(/href: '(\/[a-z-]+)', label: '([^']+)'/g)]
    const choques: string[] = []
    for (const [, href, label] of enOps) {
      const canon = new RegExp(`'${href}': '([^']+)'`).exec(etiquetas)?.[1]
      if (canon && canon !== label) choques.push(`${href}: «${label}» vs «${canon}»`)
    }
    expect(choques).toEqual([])
  })
})

describe('ASC-006 y ASE-018 · la asistente llega a lo que usa', () => {
  const sidebar = leer('src/components/Sidebar.tsx')
  const ops = leer(OPERACIONES)

  it.each([
    ['/finanzas', 'ASC-006 · cobra y hace el corte'],
    ['/migracion', 'ASE-018 · migra los expedientes'],
    ['/legal', 'ASE-018 · imprime el aviso de privacidad'],
  ])('%s le aparece en las dos listas (%s)', (href) => {
    expect(new RegExp(`href: '${href}'[^\\n]*modos: 'ambos'`).test(sidebar), 'Sidebar').toBe(true)
    expect(new RegExp(`href: '${href}'[^\\n]*modos: 'ambos'`).test(ops), 'Operaciones').toBe(true)
  })

  it('AL REVÉS · «Cumplimiento» sigue siendo del médico', () => {
    /* Si el arreglo hubiera sido «abrirle todo», no sería un arreglo. */
    expect(ops).toMatch(/href: '\/cumplimiento'[^\n]*modos: 'medico'/)
  })
})

describe('N-017 y N-018 · la puerta de entrada', () => {
  it('N-017 · el contador de pasos de un asistente sin pasos ya no está', () => {
    const src = leer('src/app/setup/page.tsx')
    expect(src).not.toMatch(/const \[step, setStep\] = useState\(0\)/)
  })

  it('N-018 · el registro vende la promesa vigente, no la de hace dos versiones', () => {
    const src = leer('src/app/registro/page.tsx')
    expect(src).not.toMatch(/'Bot de WhatsApp para auto-agendamiento'/)
    expect(src).toMatch(/Sal de la consulta/)
    expect(src).toMatch(/con la nota hecha/)
    /* La agenda y el bot no desaparecen: bajan al sitio que la portada les dio. */
    expect(src).toMatch(/Agenda, recordatorios por WhatsApp y lista de espera/)
  })

  it('N-011 · en el teléfono queda dicho que son 14 días sin tarjeta', () => {
    const src = leer('src/app/registro/page.tsx')
    /* La tira vive en la columna del formulario, que es la que sobrevive al
       `display: none` de la media query. */
    const form = src.slice(src.indexOf('Crea tu cuenta'))
    expect(form).toMatch(/14 días gratis · sin tarjeta/)
    expect(form).toMatch(/PLANES\.agenda\.precioMXN/)
  })
})
