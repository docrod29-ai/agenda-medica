/**
 * EL PACIENTE SUBE SUS ESTUDIOS, Y ENTRAN «SIN REVISAR» — D-058.
 *
 * ── QUÉ FALTABA ──────────────────────────────────────────────────────────────
 *
 * La decisión del dueño (9-sep-2026) incluía «portal: subir estudios». No
 * existía: ninguna acción del portal, ninguna carpeta en Storage para un
 * paciente (que no tiene sesión de Firebase), ninguna forma de que el médico
 * lo viera. El 10-sep pidió «lo más recomendado»: los valores viven en
 * `lib/portal/estudios-aportados.ts` con su razón.
 *
 * ── LA REGLA ─────────────────────────────────────────────────────────────────
 *
 * 1. Se valida ANTES de mover un byte (tipo, tamaño, cantidad, cuota) con el
 *    mismo módulo en el navegador y en el servidor; Storage lo vuelve a exigir.
 * 2. El paciente sube con un token personalizado a SU carpeta y nada más; el
 *    registro lo escribe el servidor tras comprobar que el objeto existe ahí.
 * 3. Entra sin revisar: abre `resultado_por_revisar` a nombre del titular, con
 *    id derivado (reintentar no duplica). «Revisado» vive en la tarea.
 * 4. El médico lo abre por URL firmada del servidor, sólo si es el médico DEL
 *    paciente (D-057). Nadie lee el bucket desde el navegador.
 * 5. Colección y prefijo declarados en los cuatro sitios: reglas, matriz,
 *    respaldo y prefijos de objeto; y `storage.rules` viaja con el despliegue.
 *
 * ── PROBADO AL REVÉS ─────────────────────────────────────────────────────────
 *
 * Con la ruta anterior, `credencial-estudio` cae al `default`; sin el bloque en
 * `storage.rules` el caso «la carpeta del paciente exige su token» está rojo.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 *
 * - Storage y su regla contra el emulador: aquí se lee como texto; la subida
 *   real se vio en el arnés con el emulador de Storage (bitácora del 10-sep).
 * - La lectura con IA del archivo (`laboratorio-vision` con `estudio`): el
 *   proveedor no está aquí; se comprueba en fuente que exige el alcance.
 * - Borrar un estudio: es un acto del consultorio con bitácora, aún sin ruta.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  rechazoDeArchivo, rechazoDelEnvio, rutaDeEstudio, esRutaDeEstudioDe, idDeRuta, uidDelPortal, nombreLimpio, esDelMes,
  MAX_BYTES_POR_ARCHIVO, MAX_ARCHIVOS_POR_ENVIO, MAX_ARCHIVOS_POR_MES, TIPOS_ACEPTADOS, PREFIJO_ESTUDIOS,
} from '@/lib/portal/estudios-aportados'
import { tareaDeUnEstudioAportado, idDeTareaDeEstudio, ORIGEN_ESTUDIO_APORTADO } from '@/lib/tareas-clinicas/de-un-estudio'
import { PREFIJOS_DE_OBJETO } from '@/lib/durability/adjuntos'
import { MATRIZ_ACCESO } from '@/lib/authz/matriz-acceso'
import { COLECCIONES } from '@/lib/clinica/respaldo'

const C = 'clinica-ficticia', P = 'pac-ficticio-001'

describe('lo recomendado, en un solo sitio', () => {
  it('PDF y fotos sí; DICOM, vídeo y texto no; 20 MB, 5 por envío, 12 al mes', () => {
    expect(rechazoDeArchivo({ nombre: 'labs.pdf', contentType: 'application/pdf', bytes: 1_500_000 })).toBeNull()
    expect(rechazoDeArchivo({ nombre: 'foto.heic', contentType: 'image/heic', bytes: 6_000_000 })).toBeNull()
    expect(rechazoDeArchivo({ nombre: 'rx.dcm', contentType: 'application/dicom', bytes: 100 })).toBe('tipo')
    expect(rechazoDeArchivo({ nombre: 'v.mp4', contentType: 'video/mp4', bytes: 100 })).toBe('tipo')
    expect(rechazoDeArchivo({ nombre: 'grande.pdf', contentType: 'application/pdf', bytes: MAX_BYTES_POR_ARCHIVO + 1 })).toBe('tamano')
    expect(rechazoDeArchivo({ nombre: 'vacio.pdf', contentType: 'application/pdf', bytes: 0 })).toBe('vacio')
    const uno = { nombre: 'a.pdf', contentType: 'application/pdf', bytes: 10 }
    expect(rechazoDelEnvio(Array(MAX_ARCHIVOS_POR_ENVIO + 1).fill(uno), 0)).toBe('cantidad')
    expect(rechazoDelEnvio([uno], MAX_ARCHIVOS_POR_MES)).toBe('cuota_mensual')
    expect(rechazoDelEnvio([uno, uno], 0)).toBeNull()
    expect(Object.keys(TIPOS_ACEPTADOS)).not.toContain('application/dicom')
  })
  it('la ruta es SIEMPRE la carpeta del paciente, y sólo esa forma se acepta', () => {
    const ruta = rutaDeEstudio(C, P, 'abc123', 'image/jpeg')
    expect(ruta).toBe(`${PREFIJO_ESTUDIOS}${C}/${P}/abc123.jpg`)
    expect(esRutaDeEstudioDe(ruta, C, P)).toBe(true)
    expect(esRutaDeEstudioDe(ruta, C, 'otro-paciente')).toBe(false)
    expect(esRutaDeEstudioDe(`${PREFIJO_ESTUDIOS}${C}/../${P}/x.pdf`, C, P)).toBe(false)
    expect(esRutaDeEstudioDe(`consultas-audio/${C}/${P}/x.pdf`, C, P)).toBe(false)
    expect(esRutaDeEstudioDe(`${PREFIJO_ESTUDIOS}${C}/${P}/x.exe`, C, P)).toBe(false)
    expect(idDeRuta(ruta)).toBe('abc123')
    expect(() => rutaDeEstudio(C, P, 'a/b', 'image/jpeg')).toThrow()
    expect(() => rutaDeEstudio(C, P, 'abc', 'text/plain')).toThrow()
  })
  it('el uid del portal no es un miembro, el nombre se limpia, y el mes se compara por mes', () => {
    expect(uidDelPortal(C, P)).toBe(`portal__${C}__${P}`)
    expect(nombreLimpio('  mis\tlabs\n.pdf  ')).toBe('mis labs .pdf')
    expect(nombreLimpio('')).toBe('estudio')
    expect(esDelMes('2026-09-01T00:00:00Z', '2026-09-30T23:00:00Z')).toBe(true)
    expect(esDelMes('2026-08-31T23:59:00Z', '2026-09-01T00:00:00Z')).toBe(false)
  })
  it('la tarea: resultado por revisar, alta, a nombre del titular, id derivado, vence en dos días', () => {
    const t = tareaDeUnEstudioAportado({ clinicId: C, patientId: P, patientNombre: 'Paciente', estudioId: 'e1', nombreArchivo: 'labs.pdf', contentType: 'application/pdf', ahoraIso: '2026-09-10T10:00:00.000Z', ownerUid: 'uid-titular' })
    expect(t).toMatchObject({ tipo: 'resultado_por_revisar', prioridad: 'alta', estado: 'solicitada', origen: ORIGEN_ESTUDIO_APORTADO, origenId: 'e1', ownerUid: 'uid-titular', venceEn: '2026-09-12T10:00:00.000Z' })
    expect(t.titulo).toContain('labs.pdf')
    expect(idDeTareaDeEstudio('e1')).toBe('estudio__e1')
    expect(tareaDeUnEstudioAportado({ clinicId: C, patientId: P, estudioId: 'e2', nombreArchivo: 'x.jpg', contentType: 'image/jpeg', ahoraIso: '2026-09-10T10:00:00.000Z' }).ownerUid).toBeUndefined()
  })
})

describe('declarado en los cuatro sitios, y el bucket cerrado a todo menos a su token', () => {
  const reglas = readFileSync('firestore.rules', 'utf8')
  const storage = readFileSync('storage.rules', 'utf8')
  it('firestore.rules: la lee el médico DEL paciente, no la escribe el navegador', () => {
    const i = reglas.indexOf('match /estudios_aportados/{estudioId} {')
    expect(i).toBeGreaterThan(-1)
    const bloque = reglas.slice(i, reglas.indexOf('\n        }', i))
    expect(bloque).toContain('allow read: if esMedicoDelPaciente(clinicId, docId);')
    expect(bloque).toContain('allow write: if false;')
  })
  it('matriz, respaldo y prefijos de objeto', () => {
    const r = MATRIZ_ACCESO.find(x => x.ruta === 'clinics/{clinicId}/patients/{docId}/estudios_aportados/{estudioId}')
    expect(r).toMatchObject({ clase: 'clinico', guardaLectura: 'esMedicoDelPaciente', guardaEscritura: 'servidor' })
    const pacientes = COLECCIONES.find(c => c.ruta === 'patients')!
    expect(pacientes.hijas!.some(h => (typeof h === 'string' ? h : h.ruta) === 'estudios_aportados')).toBe(true)
    expect(PREFIJOS_DE_OBJETO[PREFIJO_ESTUDIOS]).toMatch(/D-058/)
  })
  it('storage.rules: la carpeta del paciente exige SU token, tipo, tamaño; nadie lee ni borra desde el navegador', () => {
    const i = storage.indexOf('match /estudios-paciente/{clinicId}/{patientId}/{archivo} {')
    expect(i).toBeGreaterThan(-1)
    const bloque = storage.slice(i, storage.indexOf('\n    }', i))
    expect(bloque).toContain('request.auth.token.portal == true')
    expect(bloque).toContain('request.auth.token.clinicId == clinicId')
    expect(bloque).toContain('request.auth.token.patientId == patientId')
    expect(bloque).toContain('request.resource.size <= 20 * 1024 * 1024')
    for (const t of Object.keys(TIPOS_ACEPTADOS)) expect(bloque).toContain(`'${t}'`)
    expect(bloque).toContain('allow update, delete, read: if false;')
    // Y el resto del bucket sigue cerrado.
    expect(storage).toMatch(/match \/\{allPaths=\*\*\} \{\s*allow read, write: if false;/)
  })
  it('las reglas del bucket viajan con el despliegue de producción', () => {
    const wf = readFileSync('.github/workflows/deploy-production.yml', 'utf8')
    expect(wf).toContain("name: 'Storage · desplegar REGLAS'")
    expect(wf).toMatch(/firebase deploy --only storage --project/)
  })
  it('la lectura con IA de un estudio del paciente exige ser el médico DEL paciente (fuente)', () => {
    const src = readFileSync('src/app/api/expediente/laboratorio-vision/route.ts', 'utf8')
    expect(src).toMatch(/if \(body\.estudio\) \{[\s\S]*verificarCapacidadSobrePaciente\(req, cId, patientId, 'clinico\.escribir'\)/)
    expect(src).toContain("esRutaDeEstudioDe(e.ruta, cId, patientId)")
  })
})

/* ── El portal: credencial → registro → lista ─────────────────────────────── */

vi.hoisted(() => { process.env.PORTAL_PACIENTE_SECRET ??= 'secreto-sintetico-de-pruebas-32-caracteres' })
vi.mock('@/lib/rate-limit', () => ({ limitarOResponder: async () => null, limitarEstricto: async () => null }))
vi.mock('@/lib/whatsapp/ofrecer-hueco', () => ({ ofrecerHuecoLiberado: vi.fn(async () => undefined) }))
vi.mock('@/lib/calendario/sincronizar-servidor', () => ({ sincronizarCitaDelPortal: vi.fn(async () => undefined), estadoDeSync: () => 'ok' }))
const avisarAlConsultorio = vi.fn(async (..._a: unknown[]) => true)
vi.mock('@/lib/whatsapp/avisar-consultorio', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/whatsapp/avisar-consultorio')>()
  return { ...real, avisarAlConsultorio: (...a: unknown[]) => avisarAlConsultorio(...a) }
})

const objetos = new Map<string, { size: number; contentType: string }>()
const estudiosEscritos = new Map<string, Record<string, unknown>>()
const tareasEscritas = new Map<string, Record<string, unknown>>()
const tokens: { uid: string; claims: Record<string, unknown> }[] = []
let tareaEstado: Record<string, string> = {}

vi.mock('@/lib/firebase-admin', () => ({
  default: {
    auth: () => ({ createCustomToken: async (uid: string, claims: Record<string, unknown>) => { tokens.push({ uid, claims }); return `tok:${uid}` } }),
    storage: () => ({ bucket: () => ({ file: (ruta: string) => ({
      exists: async () => [objetos.has(ruta)],
      getMetadata: async () => [{ size: String(objetos.get(ruta)!.size), contentType: objetos.get(ruta)!.contentType }],
    }) }) }),
    firestore: { FieldValue: { increment: () => 'inc' } },
  },
  adminDb: {
    collection: (top: string) => {
      if (top !== 'clinics') throw new Error('colección superior inesperada ' + top)
      return {
        doc: (clinicId?: string) => ({
          id: clinicId ?? `auto${tokens.length + estudiosEscritos.size + 1}`,
          get: async () => ({ exists: true, data: () => ({ nombreClinica: 'Clínica Ficticia' }) }),
          collection: (sub: string) => {
            if (sub === 'patients') return { doc: (pid: string) => ({
              get: async () => ({ exists: pid === P, data: () => ({ nombre: 'Paciente Ficticio', portalTokenVersion: 0, medicoTitularUid: 'uid-titular' }) }),
              collection: (s2: string) => {
                if (s2 === 'estudios_aportados') return {
                  get: async () => ({ docs: [...estudiosEscritos.entries()].map(([id, d]) => ({ id, data: () => d })) }),
                  doc: (id: string) => ({ set: async (d: Record<string, unknown>) => { estudiosEscritos.set(id, { ...(estudiosEscritos.get(id) ?? {}), ...d }) } }),
                }
                if (s2 === 'paquetes_visita') return { get: async () => ({ docs: [] }) }
                return { get: async () => ({ docs: [], empty: true }), doc: () => ({ get: async () => ({ exists: false }) }) }
              },
            }) }
            if (sub === 'config') return { doc: () => ({ get: async () => ({ exists: true, data: () => ({ whatsappConsultorio: '5215550000000' }) }) }) }
            if (sub === 'tareas_clinicas') return { doc: (id: string) => ({
              set: async (d: Record<string, unknown>) => { tareasEscritas.set(id, d) },
              get: async () => ({ exists: id in tareaEstado, data: () => ({ estado: tareaEstado[id] }) }),
            }) }
            if (sub === 'audit_log') return { add: async () => ({}) }
            return { doc: () => ({ get: async () => ({ exists: false }) }), where: () => ({ get: async () => ({ docs: [], empty: true }) }), get: async () => ({ docs: [], empty: true }) }
          },
        }),
      }
    },
  },
}))

import { POST } from '@/app/api/portal/route'
import { crearTokenPaciente } from '@/lib/patient-token'

function llamar(action: string, extra: Record<string, unknown> = {}, alcance: 'agenda' | 'clinico' = 'clinico') {
  const token = crearTokenPaciente(C, P, 7, alcance, 0)
  const req = { json: async () => ({ action, token, ...extra }), headers: new Headers({ 'x-forwarded-for': '203.0.113.9' }) }
  return POST(req as unknown as Parameters<typeof POST>[0])
}

beforeEach(() => { objetos.clear(); estudiosEscritos.clear(); tareasEscritas.clear(); tokens.length = 0; tareaEstado = {}; avisarAlConsultorio.mockClear() })

describe('el portal', () => {
  it('EL CASO: credencial con su token y sus rutas → objeto en el bucket → registro, tarea al titular y aviso sin PHI', async () => {
    const rc = await llamar('credencial-estudio', { archivos: [{ nombre: 'labs.pdf', contentType: 'application/pdf', bytes: 120_000 }] })
    expect(rc.status).toBe(200)
    const cred = await rc.json()
    expect(cred.token).toBe(`tok:${uidDelPortal(C, P)}`)
    expect(tokens[0].claims).toEqual({ portal: true, clinicId: C, patientId: P })
    expect(cred.rutas).toHaveLength(1)
    expect(esRutaDeEstudioDe(cred.rutas[0].ruta, C, P)).toBe(true)

    objetos.set(cred.rutas[0].ruta, { size: 120_000, contentType: 'application/pdf' })
    const rr = await llamar('registrar-estudio', { ruta: cred.rutas[0].ruta, nombre: 'labs.pdf' })
    expect(rr.status).toBe(200)
    const reg = await rr.json()
    expect(reg).toMatchObject({ ok: true, id: cred.rutas[0].id, estado: 'sin_revisar' })
    expect(estudiosEscritos.get(reg.id)).toMatchObject({ clinicId: C, patientId: P, nombre: 'labs.pdf', contentType: 'application/pdf', bytes: 120_000, origen: 'paciente' })
    const t = tareasEscritas.get(idDeTareaDeEstudio(reg.id))
    expect(t).toMatchObject({ tipo: 'resultado_por_revisar', ownerUid: 'uid-titular', origenId: reg.id, patientNombre: 'Paciente Ficticio' })
    expect(avisarAlConsultorio).toHaveBeenCalledTimes(1)
    expect(String(avisarAlConsultorio.mock.calls[0][2])).not.toMatch(/labs\.pdf|Ficticio/)

    const rl = await llamar('estudios')
    const lista = (await rl.json()).estudios
    expect(lista).toHaveLength(1)
    expect(lista[0]).toMatchObject({ id: reg.id, estado: 'sin_revisar' })
    tareaEstado[idDeTareaDeEstudio(reg.id)] = 'completada'
    expect((await (await llamar('estudios')).json()).estudios[0].estado).toBe('revisado')
  })
  it('se rechaza ANTES de acuñar: tipo, tamaño, cantidad y cuota mensual', async () => {
    expect((await llamar('credencial-estudio', { archivos: [{ nombre: 'x.dcm', contentType: 'application/dicom', bytes: 10 }] })).status).toBe(422)
    expect((await llamar('credencial-estudio', { archivos: [{ nombre: 'x.pdf', contentType: 'application/pdf', bytes: MAX_BYTES_POR_ARCHIVO + 1 }] })).status).toBe(422)
    expect((await llamar('credencial-estudio', { archivos: Array(6).fill({ nombre: 'x.pdf', contentType: 'application/pdf', bytes: 10 }) })).status).toBe(422)
    for (let i = 0; i < MAX_ARCHIVOS_POR_MES; i++) estudiosEscritos.set(`e${i}`, { subidoEn: new Date().toISOString(), ruta: `x${i}` })
    expect((await llamar('credencial-estudio', { archivos: [{ nombre: 'x.pdf', contentType: 'application/pdf', bytes: 10 }] })).status).toBe(422)
    expect(tokens).toHaveLength(0)
  })
  it('registrar sólo acepta la carpeta de ESTE paciente y un objeto que exista; sin alcance clínico, nada', async () => {
    expect((await llamar('registrar-estudio', { ruta: `${PREFIJO_ESTUDIOS}${C}/otro/x.pdf`, nombre: 'x' })).status).toBe(400)
    expect((await llamar('registrar-estudio', { ruta: rutaDeEstudio(C, P, 'nollego', 'application/pdf'), nombre: 'x' })).status).toBe(404)
    expect((await llamar('credencial-estudio', { archivos: [{ nombre: 'x.pdf', contentType: 'application/pdf', bytes: 10 }] }, 'agenda')).status).toBe(403)
    expect((await llamar('estudios', {}, 'agenda')).status).toBe(403)
    expect(estudiosEscritos.size).toBe(0)
  })
  it('reintentar el registro del mismo objeto no abre dos tareas ni avisa dos veces', async () => {
    const ruta = rutaDeEstudio(C, P, 'mismo', 'image/jpeg')
    objetos.set(ruta, { size: 500, contentType: 'image/jpeg' })
    await llamar('registrar-estudio', { ruta, nombre: 'foto.jpg' })
    await llamar('registrar-estudio', { ruta, nombre: 'foto.jpg' })
    expect(estudiosEscritos.size).toBe(1)
    expect(tareasEscritas.size).toBe(1)
    expect(avisarAlConsultorio).toHaveBeenCalledTimes(1)
  })
})
