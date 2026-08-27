/**
 * EL ENLACE DE LA TELECONSULTA — prometido en todos los mensajes, enviado en ninguno.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * `lib/telesalud/donde-es.ts` decide qué se le dice al paciente sobre dónde es
 * su cita. Para una TELECONSULTA sólo emite el enlace de la sala si le llega un
 * `tokenPaciente`, y si no lo tiene dice la verdad:
 *
 *     «Recibirás el enlace de la videollamada por este medio antes de tu cita.»
 *
 * Esa decisión es correcta: `/api/telesalud/sala` exige prueba de titularidad y
 * responde 404 «Cita no encontrada» a un enlace sin token, así que un enlace sin
 * credencial es peor que ninguno.
 *
 * Lo que fallaba está una capa más arriba: **ningún llamador pasaba el token**.
 * Los cuatro sitios que componen mensajes para el paciente —la confirmación del
 * bot de WhatsApp, la confirmación de lista de espera, los dos recordatorios del
 * cron y los mensajes manuales de `lib/whatsapp.ts`— llamaban a `dondeEsLaCita`
 * sin `tokenPaciente`. El campo era opcional, así que compilaba.
 *
 * Resultado: el paciente de videoconsulta agendado por WhatsApp recibía la
 * promesa del enlace en la confirmación, la volvía a recibir en el recordatorio
 * de 24 h, la volvía a recibir el mismo día… y el enlace no llegaba nunca,
 * porque el único mensaje que decía «antes de tu cita» repetía la misma promesa.
 * A la hora de la consulta el paciente no tiene forma de entrar a la sala.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Recorriendo el flujo canónico del Bloque 7 (WhatsApp → cita → confirmación →
 * recordatorio → retorno a consulta) con la pregunta de
 * `.claude/rules/el-dato-tiene-que-llegar.md`: «¿dónde acaba este dato?». El
 * enlace acababa en la función que lo compone. `grep dondeEsLaCita` devolvía
 * cuatro llamadas y `grep tokenPaciente` ninguna fuera del propio módulo.
 *
 * ── LA CAUSA RAÍZ ────────────────────────────────────────────────────────────
 *
 * `enlaceSalaPaciente()` hizo el token OBLIGATORIO en su firma, y su cabecera
 * explica por qué: siendo obligatorio, cada llamador tiene que DECIDIR qué token
 * pone, y quien no tenga ninguno lo dice con `''`, que es una decisión escrita y
 * no un olvido. `donde-es.ts` volvió a hacerlo opcional un nivel más arriba, y
 * el defecto reapareció exactamente donde ese comentario avisaba: en silencio,
 * en el siguiente llamador.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 *
 * · No prueba que Daily cree la sala ni que el vídeo funcione: eso vive detrás
 *   de `/api/telesalud/sala` y de una clave de proveedor.
 * · No prueba la ventana horaria de apertura de la sala (`ventana-sala.ts`).
 * · No prueba la revocación por versión: `/api/telesalud/sala` autoriza hoy sin
 *   mirar `tokenVigente`, y ampliarlo es otra unidad de trabajo — queda
 *   registrado, no arreglado aquí.
 * · No manda un WhatsApp real: aquí no hay proveedor.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { dondeEsLaCita, SIN_ENLACE } from '@/lib/telesalud/donde-es'
import { crearTokenPaciente, verificarTokenPaciente } from '@/lib/patient-token'
import { PLANTILLAS_DEFAULT, ENLACE_TELECONSULTA_NO_CABE_EN_PLANTILLA } from '@/lib/whatsapp/templates'

const CLINICA = 'clinica-sintetica-alfa'
const VECINA = 'clinica-sintetica-beta'
const PACIENTE = 'pac-sintetico-1'
const OTRO_PACIENTE = 'pac-sintetico-2'
const CITA = 'cita-sintetica-1'
const BASE = 'https://ausculta.example'

/** El texto del enlace tal y como lo recibiría el paciente en su WhatsApp. */
function enlaceDelMensaje(tokenPaciente: string): string {
  const lugar = dondeEsLaCita({
    tipo: 'teleconsulta',
    citaId: CITA,
    clinicId: CLINICA,
    baseUrl: BASE,
    tokenPaciente,
  })
  const linea = lugar.lineas.find(l => l.includes('http')) ?? ''
  return linea.replace(/^🔗\s*/, '')
}

/**
 * La MISMA comprobación que hace `/api/telesalud/sala` para dejar entrar al
 * paciente. Se replica aquí a propósito: si alguien la relaja allí, este golden
 * seguirá describiendo la regla que el enlace tiene que satisfacer.
 */
function salaAutoriza(token: string, clinicIdDeLaSala: string, pacienteIdDeLaCita: string): boolean {
  const tk = verificarTokenPaciente(token)
  return !!tk && tk.clinicId === clinicIdDeLaSala && !!tk.patientId && tk.patientId === pacienteIdDeLaCita
}

describe('el enlace que recibe el paciente ABRE su sala', () => {
  it('lleva token y ese token es el que la sala acepta', () => {
    const token = crearTokenPaciente(CLINICA, PACIENTE, undefined, 'agenda')
    const url = enlaceDelMensaje(token)

    expect(url).toContain(`/teleconsulta/${CITA}`)
    expect(url).toContain(`c=${CLINICA}`)

    const t = new URL(url).searchParams.get('t') ?? ''
    expect(t).not.toBe('')
    expect(salaAutoriza(t, CLINICA, PACIENTE)).toBe(true)
  })

  it('no lleva alcance clínico: es un enlace que se reenvía por WhatsApp', () => {
    // `agenda` deja entrar a la sala; `clinico` abriría además los documentos
    // firmados en /api/portal. Un enlace que viaja por un canal externo no puede
    // cargar más de lo que necesita.
    const token = crearTokenPaciente(CLINICA, PACIENTE, undefined, 'agenda')
    expect(verificarTokenPaciente(token)?.alcance).toBe('agenda')
  })

  it('el enlace no lleva PHI: sólo identificadores opacos y la firma', () => {
    const token = crearTokenPaciente(CLINICA, PACIENTE, undefined, 'agenda')
    const url = enlaceDelMensaje(token)
    // Nada del paciente viaja en claro: ni nombre, ni teléfono, ni motivo.
    for (const phi of ['nombre', 'telefono', 'motivo', 'diagnostico']) {
      expect(url.toLowerCase()).not.toContain(phi)
    }
  })
})

describe('y sólo la suya — el enlace reenviado no abre otra cita', () => {
  it('el token de OTRO paciente del mismo consultorio no autoriza', () => {
    const token = crearTokenPaciente(CLINICA, OTRO_PACIENTE, undefined, 'agenda')
    expect(salaAutoriza(token, CLINICA, PACIENTE)).toBe(false)
  })

  it('el token del consultorio VECINO no autoriza', () => {
    const token = crearTokenPaciente(VECINA, PACIENTE, undefined, 'agenda')
    expect(salaAutoriza(token, CLINICA, PACIENTE)).toBe(false)
  })

  it('un token inventado no autoriza', () => {
    expect(salaAutoriza('esto.noEsUnToken', CLINICA, PACIENTE)).toBe(false)
  })
})

describe('sin token se dice la verdad, no se manda un enlace roto', () => {
  it('cae al aviso de que el enlace llega aparte', () => {
    const lugar = dondeEsLaCita({
      tipo: 'teleconsulta', citaId: CITA, clinicId: CLINICA, baseUrl: BASE, tokenPaciente: '',
    })
    expect(lugar.lineas).toContain(SIN_ENLACE)
    expect(lugar.lineas.join('\n')).not.toContain('http')
  })
})

// ── LA REGRESIÓN: el dato tiene que LLEGAR ──────────────────────────────────

const RAIZ = join(process.cwd(), 'src')

function archivosTs(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) {
      if (e.name === '__tests__' || e.name === 'node_modules') continue
      archivosTs(p, acc)
    } else if (e.name.endsWith('.ts') || e.name.endsWith('.tsx')) {
      acc.push(p)
    }
  }
  return acc
}

/** Las llamadas a `dondeEsLaCita(` con sus argumentos, por paréntesis balanceados. */
function llamadas(fuente: string): string[] {
  const out: string[] = []
  const marca = 'dondeEsLaCita('
  let i = fuente.indexOf(marca)
  while (i !== -1) {
    let profundidad = 0
    let j = i + marca.length - 1
    for (; j < fuente.length; j++) {
      if (fuente[j] === '(') profundidad++
      else if (fuente[j] === ')') {
        profundidad--
        if (profundidad === 0) break
      }
    }
    out.push(fuente.slice(i, j + 1))
    i = fuente.indexOf(marca, j)
  }
  return out
}

const LLAMADORES = archivosTs(RAIZ)
  .filter(p => !p.endsWith(join('telesalud', 'donde-es.ts')))
  .map(p => ({ ruta: p.slice(process.cwd().length + 1), fuente: readFileSync(p, 'utf8') }))
  .filter(f => f.fuente.includes('dondeEsLaCita('))

describe('ningún llamador puede olvidarse del token', () => {
  it('hay llamadores que auditar (si esto falla, el descubrimiento se rompió)', () => {
    expect(LLAMADORES.length).toBeGreaterThan(0)
  })

  it.each(LLAMADORES.map(f => f.ruta))('%s decide explícitamente qué token pone', (ruta) => {
    const f = LLAMADORES.find(x => x.ruta === ruta)!
    const cs = llamadas(f.fuente)
    expect(cs.length).toBeGreaterThan(0)
    for (const c of cs) {
      expect(c, `una llamada de ${ruta} no pasa tokenPaciente:\n${c}`).toContain('tokenPaciente')
    }
  })
})

describe('el recordatorio —el mensaje que promete el enlace— lo emite de verdad', () => {
  const cron = readFileSync(join(RAIZ, 'app', 'api', 'cron', 'reminders', 'route.ts'), 'utf8')

  it('firma un token de paciente antes de componer el mensaje', () => {
    expect(cron).toContain('crearTokenPaciente')
    expect(cron).toContain("from '@/lib/patient-token'")
  })

  it('lo firma para el paciente DE ESA CITA, no para uno cualquiera', () => {
    expect(cron).toMatch(/crearTokenPaciente\(\s*clinicId,\s*appt\.pacienteId/)
  })

  it('con alcance de agenda: el recordatorio no reparte documentos clínicos', () => {
    expect(cron).toContain("'agenda'")
    expect(cron).not.toContain("crearTokenPaciente(clinicId, appt.pacienteId, 1, 'clinico'")
  })

  it('y lo mete en el mensaje por el módulo, no por una URL escrita a mano', () => {
    const c = llamadas(cron)
    expect(c).toHaveLength(1)
    expect(c[0]).toContain('tokenPaciente')
    expect(cron).not.toContain('/teleconsulta/')
  })
})


/**
 * HASTA DÓNDE LLEGA LA REPARACIÓN — y por qué el resto no es código.
 *
 * El recordatorio sale por dos caminos: TEXTO LIBRE si la ventana de servicio de
 * 24 h está abierta, y PLANTILLA HSM si está cerrada. El enlace sólo cabe en el
 * primero. La plantilla lleva los parámetros que Meta aprobó —todos de texto— y
 * meter una URL ahí, o mandar texto libre fuera de la ventana, es lo que el
 * proveedor rechaza.
 *
 * Estos casos no piden que el defecto se arregle: piden que la limitación esté
 * DECLARADA. Una ausencia declarada se puede planear; una ausencia silenciosa se
 * confunde con una función que ya sirve.
 */
describe('la limitación que queda está declarada, no escondida', () => {
  it('ninguna plantilla aprobada lleva hoy un parámetro de URL', () => {
    const muestra = {
      paciente: 'Paciente Sintético', medico: 'Dra. Sintética',
      fecha: '10 de marzo', hora: '10:00', clinica: 'Consultorio Sintético',
      direccion: 'Calle Sintética 1', telefono: '5555555555',
    }
    for (const [clave, plantilla] of Object.entries(PLANTILLAS_DEFAULT)) {
      const params = plantilla.construirParametros(muestra)
      for (const p of params) {
        expect(p, `la plantilla ${clave} metió una URL en un parámetro de texto`).not.toContain('http')
        expect(p, `la plantilla ${clave} metió una ruta de sala en un parámetro`).not.toContain('/teleconsulta/')
      }
    }
  })

  it('y el catálogo lo dice por escrito, con quién puede resolverlo', () => {
    expect(ENLACE_TELECONSULTA_NO_CABE_EN_PLANTILLA).toContain('botón de URL dinámica')
    expect(ENLACE_TELECONSULTA_NO_CABE_EN_PLANTILLA).toContain('dueño')
  })
})
