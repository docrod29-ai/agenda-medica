/**
 * GOLDEN — la incidencia de IA se guardaba, se enseñaba… y el dueño no se
 * enteraba.
 *
 * ── CÓMO SE ENCONTRÓ ─────────────────────────────────────────────────────────
 *
 * El 4-ago-2026, en vivo: al Dr. le salió «El servicio de IA no está disponible»
 * **a media consulta**, con un paciente enfrente.
 *
 * ── LO QUE YA FUNCIONABA (y hay que decirlo) ─────────────────────────────────
 *
 * Todo el camino estaba hecho: `claseDeFallo` clasifica, `avisoAlDueno` redacta
 * el titular y qué hacer, `reportarFalloIA` lo agrupa por hora y lo guarda, y
 * `/superadmin/costos` lo enseña. Nada de eso faltaba.
 *
 * ── LO QUE FALTABA ───────────────────────────────────────────────────────────
 *
 * Que llegara a él. Para enterarse tenía que **saber que esa pantalla existe y
 * acordarse de abrirla justo ese día**, mientras atendía. El propio repositorio
 * lo había escrito una versión antes, hablando de otra cosa: «una alerta que vive
 * en su propia pantalla es una alerta que nadie ve».
 *
 * ── LO QUE ESTO NO HACE ──────────────────────────────────────────────────────
 *
 * No le sale a ningún cliente. Un consultorio no puede arreglar la llave de la
 * plataforma, y decírselo sólo le roba tiempo con un paciente enfrente — la
 * misma razón por la que el mensaje del médico y el del dueño se escribieron
 * distintos desde el principio.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { avisoAlDueno } from '@/lib/ia/fallo-proveedor'
import { REGISTRO_RUTAS } from '@/lib/authz/registro-rutas'
import { POR_QUE_SOLO_AL_DUENO, POR_QUE_NO_BASTA_EL_TABLERO } from '@/components/AvisoIncidenteIA'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')
const ruta = leer('src', 'app', 'api', 'superadmin', 'incidentes', 'route.ts')
const shell = leer('src', 'app', '(dashboard)', 'layout.tsx')
const comp = leer('src', 'components', 'AvisoIncidenteIA.tsx')

describe('LA FRANJA SÓLO ES DEL DUEÑO', () => {
  it('se pinta con el mismo chequeo que ya decide enseñar /superadmin', () => {
    expect(shell).toContain('<AvisoIncidenteIA esDueno={esSuperadminCliente(user?.email)} />')
  })

  it('y el componente se apaga solo si no es él', () => {
    expect(comp).toContain('if (!esDueno || oculto || incidentes.length === 0) return null')
  })

  it('un fallo de la llave del CONSULTORIO no es incidencia de plataforma', () => {
    // Ya lo decidía `avisoAlDueno`; aquí se ata para que nadie lo cambie sin ver
    // que llenaría el tablero del dueño de ruido ajeno.
    expect(avisoAlDueno('sin_saldo', 'clinica', 'anthropic')).toBeNull()
    expect(avisoAlDueno('sin_saldo', 'plataforma', 'anthropic')?.urgente).toBe(true)
  })

  it('están escritas las dos razones', () => {
    expect(POR_QUE_SOLO_AL_DUENO).toMatch(/roba tiempo con un paciente enfrente/)
    expect(POR_QUE_NO_BASTA_EL_TABLERO).toMatch(/alerta que nadie ve/)
  })
})

describe('LA RUTA ES LIGERA Y ESTÁ GUARDADA', () => {
  it('exige superadmin en el servidor, no sólo en la pantalla', () => {
    expect(ruta).toContain('const acc = await verificarSuperadmin(req)')
    expect(ruta).toContain('if (!acc.ok) return acc.response')
    expect(REGISTRO_RUTAS['superadmin/incidentes']).toEqual({ tipo: 'superadmin' })
  })

  it('no arrastra el tablero entero: sólo lee incidencias', () => {
    /**
     * `/api/superadmin/costos` resume el libro de costos, consulta Stripe y pide
     * los saldos. Llamarlo en cada carga de la app para pintar una franja sería
     * pagar un tablero completo para saber una sola cosa.
     */
    expect(ruta).toContain('incidentesRecientes(20)')
    expect(ruta).not.toContain('stripe')
    expect(ruta).not.toContain('saldosDeProveedores')
  })

  it('y una caída vieja deja de avisar', () => {
    // Un aviso que no se apaga deja de ser un aviso.
    expect(ruta).toContain('const HORAS_VIGENTES = 6')
    expect(ruta).toContain("vigentes = todos.filter(i => String(i.hora ?? '') >= corte)")
  })
})

describe('NO PUEDE ESTORBAR', () => {
  it('si la consulta falla, no se pinta nada', () => {
    expect(comp).toMatch(/\.catch\(\(\) => \{ \/\* un aviso que se rompe no puede estorbar \*\/ \}\)/)
  })

  it('se pregunta UNA vez al montar, no en bucle', () => {
    // Vigilar en bucle una pantalla que casi siempre está en verde se paga en
    // lecturas de Firestore todos los días del año.
    expect(comp).not.toContain('setInterval')
    expect(comp).toContain('}, [esDueno])')
  })
})

/**
 * ── LA FRANJA SE VOLVIÓ EL RUIDO QUE VENÍA A EVITAR (mismo día) ──────────────
 *
 * El Dr. la vio en su pantalla horas después de desplegarla: **tres líneas del
 * mismo aviso** —«Claude tardó demasiado»— ocupando el ancho completo por
 * encima de su lista de pacientes. Su palabra fue «mugrero».
 *
 * Dos defectos, y los dos eran míos:
 *
 * 1. **Enseñaba lo que no exige nada de él.** Un timeout o una saturación del
 *    proveedor se resuelven solos; no hay botón que apretar. Eso es información
 *    de tablero, no una franja sobre su trabajo.
 * 2. **Repetía el mismo problema.** Las incidencias se agrupan por HORA, así que
 *    una caída de tres horas son tres documentos idénticos — y se pintaban como
 *    tres avisos, haciendo ver tres problemas donde había uno.
 *
 * Es exactamente la fatiga de alerta que se reparó ESA MISMA MAÑANA en la
 * compuerta de dosis (REG-141), reintroducida por el mismo agente en otra
 * pantalla.
 */
describe('LA FRANJA NO PUEDE SER EL RUIDO QUE VIENE A EVITAR', () => {
  const ruta2 = leer('src', 'app', 'api', 'superadmin', 'incidentes', 'route.ts')
  const comp2 = leer('src', 'components', 'AvisoIncidenteIA.tsx')

  it('sólo sale lo URGENTE: lo que está caído hasta que él lo arregle', () => {
    expect(ruta2).toContain('const urgentes = vigentes.filter(i => i.urgente === true)')
  })

  it('un timeout o una saturación NO son urgentes — se resuelven solos', () => {
    // Se ata contra el clasificador, que ya tenía tomada esa decisión.
    expect(avisoAlDueno('timeout', 'plataforma', 'anthropic')?.urgente).toBe(false)
    expect(avisoAlDueno('sobrecarga', 'plataforma', 'anthropic')?.urgente).toBe(false)
    expect(avisoAlDueno('limite_tasa', 'plataforma', 'anthropic')?.urgente).toBe(false)
  })

  it('y lo que SÍ deja al producto caído sigue saliendo', () => {
    expect(avisoAlDueno('llave_invalida', 'plataforma', 'anthropic')?.urgente).toBe(true)
    expect(avisoAlDueno('sin_saldo', 'plataforma', 'anthropic')?.urgente).toBe(true)
  })

  it('una sola línea por problema, aunque dure horas', () => {
    /**
     * Agrupado por hora, una caída larga son varios documentos idénticos.
     * Pintarlos todos hace ver varios problemas donde hay uno.
     */
    expect(ruta2).toContain('const porTitulo = new Map<string,')
    expect(ruta2).toContain('y.veces += veces; continue')
  })

  it('y como mucho dos en pantalla', () => {
    // Si hay más, el sitio es el tablero, no una franja sobre su trabajo.
    expect(comp2).toContain('incidentes.slice(0, 2)')
  })

  it('lo no urgente no se pierde: se dice cuánto quedó en el tablero', () => {
    // Esconder no es lo mismo que callar. Sigue contado.
    expect(ruta2).toContain('noUrgentesEnElTablero: vigentes.length - urgentes.length')
  })
})
