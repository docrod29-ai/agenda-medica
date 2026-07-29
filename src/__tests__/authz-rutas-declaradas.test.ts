import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve, join, relative, sep } from 'node:path'
import {
  REGISTRO_RUTAS, TIPOS_CON_MOTIVO, capacidadesDeRuta, activaEnCodigo,
  type ExigenciaRuta,
} from '@/lib/authz/registro-rutas'
import { rolesCon, ROLES_NO_CLINICOS } from '@/lib/authz/capabilities'

/**
 * GUARDIÁN DEL REGISTRO DE RUTAS (unidad Nexus OS E0-07).
 * Molde: `api-authz-guard.test.ts` de E0-06, incluida su limpieza de comentarios
 * —obligatoria aquí: los comentarios de este repo CITAN a propósito el nombre del
 * guardián que se cambió («va con verificarMEDICO, no verificarMiembro»), y sin
 * limpiarlos el escaneo produce falsos positivos.
 *
 * ESTE ARCHIVO ES EL CRITERIO DE ACEPTACIÓN de la unidad: «cada ruta declara la
 * capacidad que exige; no hay any-member implícito». Convierte el registro en algo
 * que no se puede dejar viejo:
 *  · una ruta nueva sin declarar → rojo,
 *  · una clave declarada que ya no existe en disco → rojo,
 *  · una exención sin motivo escrito → rojo,
 *  · un registro que dice una cosa y un archivo que hace otra → rojo.
 */

const DIR_API = resolve(process.cwd(), 'src/app/api')

/** Colecciones cuyo contenido es secreto médico (las mismas que van a `isMedico`). */
const COLECCIONES_CLINICAS = ['notas', 'laboratorios', 'fotos', 'clinico']

function archivosDeRuta(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) archivosDeRuta(p, out)
    else if (e.name === 'route.ts') out.push(p)
  }
  return out
}

/** El código SIN comentarios (ver la nota de cabecera). */
function codigo(p: string): string {
  return readFileSync(p, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
}

/** `src/app/api/hospital/mutar/route.ts` → `hospital/mutar` (clave del registro). */
function claveDe(p: string): string {
  return relative(DIR_API, p).split(sep).slice(0, -1).join('/')
}

const ARCHIVOS = archivosDeRuta(DIR_API)
const CLAVES_DISCO = ARCHIVOS.map(claveDe).sort()
const FUENTE = new Map(ARCHIVOS.map(p => [claveDe(p), codigo(p)]))
const entrada = (clave: string): ExigenciaRuta | undefined => REGISTRO_RUTAS[clave]

describe('E0-07 · el escaneo encuentra rutas de verdad', () => {
  it('hay 74 rutas en disco (un guardián que no encuentra archivos pasa vacío y no protege nada)', () => {
    // Si este número cambia es porque se añadió o quitó una ruta: hay que declararla
    // en REGISTRO_RUTAS y ajustar el conteo, a propósito y a mano.
    expect(CLAVES_DISCO.length).toBe(74)
  })
})

describe('E0-07 · toda ruta de API declara qué exige', () => {
  it('ninguna ruta en disco se queda sin entrada en REGISTRO_RUTAS', () => {
    const sinDeclarar = CLAVES_DISCO.filter(c => !entrada(c))
    expect(sinDeclarar, `rutas sin declarar: ${sinDeclarar.join(', ')}`).toEqual([])
  })

  it('no hay entradas zombis (declarar una ruta que ya no existe esconde el borrado)', () => {
    const enDisco = new Set(CLAVES_DISCO)
    const zombis = Object.keys(REGISTRO_RUTAS).filter(c => !enDisco.has(c))
    expect(zombis, `claves declaradas sin archivo: ${zombis.join(', ')}`).toEqual([])
  })

  it('toda exención trae MOTIVO no vacío: se puede eximir una ruta, pero no en silencio', () => {
    const mudas: string[] = []
    for (const [clave, e] of Object.entries(REGISTRO_RUTAS)) {
      if (!(TIPOS_CON_MOTIVO as readonly string[]).includes(e.tipo)) continue
      const motivo = (e as { motivo?: string }).motivo ?? ''
      if (motivo.trim().length < 20) mudas.push(`${clave} (${e.tipo})`)
    }
    expect(mudas, `exenciones sin motivo escrito: ${mudas.join(', ')}`).toEqual([])
  })

  it('toda ruta que espera una decisión del dueño dice QUÉ decisión espera', () => {
    for (const [clave, e] of Object.entries(REGISTRO_RUTAS)) {
      const pendiente = (e as { activacionPendiente?: string }).activacionPendiente
      if (pendiente === undefined) continue
      expect(pendiente.trim().length, `${clave}: activacionPendiente vacío`).toBeGreaterThan(20)
      // Una espera solo tiene sentido si HAY una capacidad esperando.
      expect(capacidadesDeRuta(e).length, `${clave}: pendiente sin capacidad declarada`).toBeGreaterThan(0)
    }
  })
})

describe('E0-07 · `verificarMedico` ya no existe bajo src/app/api', () => {
  it('CERO llamadas: el gate binario de rol quedó sustituido por capacidades', () => {
    const supervivientes = [...FUENTE].filter(([, src]) => /verificarMedico\s*\(/.test(src)).map(([c]) => c)
    expect(supervivientes, `rutas que siguen llamando a verificarMedico: ${supervivientes.join(', ')}`).toEqual([])
  })
})

describe('E0-07 · `verificarMiembro` solo donde está DECLARADO que sigue', () => {
  /**
   * `verificarMiembro` es el «any-member» de la unidad. No se puede borrar de golpe:
   * las rutas que lo conservan estrecharían el acceso de usuarios reales al migrar
   * (regla 5 de la carta operativa). Lo que este test impide es que siga siendo
   * IMPLÍCITO: cada superviviente tiene que estar declarado, o con
   * `activacionPendiente` (esperando una decisión del médico dueño) o como
   * `porAccion` (donde la membresía es solo el primer paso y la capacidad la impone
   * `exigeCapacidad`). Una ruta NUEVA con `verificarMiembro` y sin declarar → rojo.
   */
  const CON_MIEMBRO = [...FUENTE].filter(([, src]) => /verificarMiembro\s*\(/.test(src)).map(([c]) => c).sort()

  it('todos los supervivientes están declarados como pendientes o como porAccion', () => {
    const indebidos = CON_MIEMBRO.filter(c => {
      const e = entrada(c)
      if (!e) return true
      if (e.tipo === 'porAccion') return false
      return !(e as { activacionPendiente?: string }).activacionPendiente
    })
    expect(indebidos, `rutas con any-member NO declarado: ${indebidos.join(', ')}`).toEqual([])
  })

  it('la lista de supervivientes está CONGELADA (bajar una ruta a any-member se ve)', () => {
    expect(CON_MIEMBRO).toEqual([
      'appointments',
      'calendar/sync',
      'clinic/ai-keys',
      'clinic/miembros',
      'facturacion/descargar',
      'facturacion/pagos',
      'hl7/convertir',
      'hospital/mutar',
      'portal/link',
      'stripe/asientos',
      'telesalud/sala',
      'whatsapp/entregas',
      'whatsapp/waitlist-notify',
    ])
  })
})

describe('E0-07 · el registro no puede MENTIR sobre el código', () => {
  it('una capacidad ya ACTIVA implica una llamada real a verificarCapacidad', () => {
    const mentirosas: string[] = []
    for (const [clave, e] of Object.entries(REGISTRO_RUTAS)) {
      if (e.tipo !== 'capacidad' && e.tipo !== 'porMetodo') continue
      if (!activaEnCodigo(e)) continue
      if (!/verificarCapacidad\s*\(/.test(FUENTE.get(clave) ?? '')) mentirosas.push(clave)
    }
    expect(mentirosas, `declaran capacidad activa pero no la exigen: ${mentirosas.join(', ')}`).toEqual([])
  })

  it('una capacidad PENDIENTE implica que el guardián viejo sigue ahí de verdad', () => {
    // Impide que `activacionPendiente` se convierta en una escotilla para dejar una
    // ruta sin guardia alguna «hasta que el Dr. decida».
    const huecas: string[] = []
    for (const [clave, e] of Object.entries(REGISTRO_RUTAS)) {
      const pendiente = (e as { activacionPendiente?: string }).activacionPendiente
      if (!pendiente) continue
      const src = FUENTE.get(clave) ?? ''
      const conGuardiaVieja = /verificarMiembro\s*\(/.test(src) || /verificarModuloIA\s*\(/.test(src)
      if (!conGuardiaVieja) huecas.push(clave)
    }
    expect(huecas, `pendientes que se quedaron SIN guardián: ${huecas.join(', ')}`).toEqual([])
  })

  it('el gateway `porAccion` impone la capacidad por acción con exigeCapacidad', () => {
    for (const [clave, e] of Object.entries(REGISTRO_RUTAS)) {
      if (e.tipo !== 'porAccion') continue
      expect(FUENTE.get(clave), clave).toMatch(/exigeCapacidad\s*\(/)
    }
  })

  it('cada tipo de exención se corresponde con el guardián que dice usar', () => {
    const desajustes: string[] = []
    for (const [clave, e] of Object.entries(REGISTRO_RUTAS)) {
      const src = FUENTE.get(clave) ?? ''
      if (e.tipo === 'superadmin' && !/verificarSuperadmin\s*\(/.test(src)) desajustes.push(`${clave}: sin verificarSuperadmin`)
      if (e.tipo === 'sesion' && !/verificarUsuario\s*\(/.test(src)) desajustes.push(`${clave}: sin verificarUsuario`)
      if (e.tipo === 'tokenPaciente' && !/verificarTokenPaciente\s*\(/.test(src)) desajustes.push(`${clave}: sin verificarTokenPaciente`)
      if (e.tipo === 'entitlementIA' && !/verificarModulo(IA|YCapacidad)\s*\(/.test(src)) desajustes.push(`${clave}: sin entitlement de módulo`)
    }
    expect(desajustes).toEqual([])
  })

  it('las rutas SIN guardián de sesión son exactamente las 13 declaradas públicas/webhook/cron', () => {
    const GUARDIANES = /verificar(Usuario|Miembro|Medico|Capacidad|ModuloIA|ModuloYCapacidad|Superadmin|TokenPaciente)\s*\(/
    const sinGuardia = [...FUENTE].filter(([, src]) => !GUARDIANES.test(src)).map(([c]) => c).sort()
    const exentas = new Set(['publica', 'webhook', 'cron'])
    for (const c of sinGuardia) {
      const e = entrada(c)
      expect(e, `${c} no está declarada`).toBeTruthy()
      expect(exentas, `${c} no tiene guardián y NO está declarada como exenta (${e!.tipo})`).toContain(e!.tipo)
    }
    // Congelado: si aparece una 14.ª ruta sin guardián, hay que justificarla a mano.
    expect(sinGuardia).toEqual([
      'calendar/callback',
      'cron/reminders',
      'csp-report',
      'demo/evidencia',
      'public/availability/[clinicId]',
      'public/booking',
      'public/clinic/[clinicId]',
      'public/resena',
      'receta/diseno',
      'stripe/webhook',
      'whatsapp/360dialog-callback',
      'whatsapp/360dialog-webhook',
      'whatsapp/webhook',
    ])
  })
})

describe('E0-07 · propiedad heredada de E0-06, ahora expresada en capacidades', () => {
  /**
   * E0-06 exigía que ninguna ruta que lea una colección clínica se conformara con
   * `verificarMiembro`, y lo comprobaba buscando la CADENA `verificarMedico` en el
   * archivo. Esa señal desaparece al migrar a capacidades, así que la propiedad se
   * re-expresa —y queda MÁS FUERTE—: la ruta tiene que DECLARAR una capacidad cuyo
   * conjunto de roles no incluya a ningún rol no clínico, y el test de arriba
   * comprueba además que el código coincide con la declaración.
   */
  it('leer PHI clínico exige una capacidad que excluye a los roles no clínicos', () => {
    const infractoras: string[] = []
    for (const [clave, src] of FUENTE) {
      const leeClinico = COLECCIONES_CLINICAS.some(c => src.includes(`collection('${c}')`))
      if (!leeClinico) continue
      const e = entrada(clave)
      if (!e) { infractoras.push(`${clave}: sin declarar`); continue }
      // El token del PACIENTE es vía legítima: desde E0-06 lleva alcance y la ruta
      // lo comprueba en el handler.
      if (e.tipo === 'tokenPaciente') continue
      const caps = capacidadesDeRuta(e)
      if (caps.length === 0) { infractoras.push(`${clave}: sin capacidad`); continue }
      for (const cap of caps) {
        const fuga = rolesCon(cap).filter(r => ROLES_NO_CLINICOS.includes(r))
        if (fuga.length) infractoras.push(`${clave}: ${cap} alcanza a ${fuga.join('/')}`)
      }
    }
    expect(infractoras, `PHI clínico bajo capacidad insuficiente: ${infractoras.join(', ')}`).toEqual([])
  })

  it('el control de que la comprobación anterior NO pasa por vacío', () => {
    // Si el walker o el filtro se rompen, la lista de rutas que leen PHI clínico
    // queda vacía y el test de arriba pasa sin comprobar nada.
    const conPHI = [...FUENTE].filter(([, src]) =>
      COLECCIONES_CLINICAS.some(c => src.includes(`collection('${c}')`))).map(([c]) => c).sort()
    expect(conPHI).toEqual(['fhir/paciente/[patientId]', 'portal'])
  })
})
