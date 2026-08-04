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
