/**
 * R-06 / issue #350 — CAPACIDAD LIGADA del proxy del formato de receta.
 *
 * QUÉ FALLABA: `/api/receta/diseno?path=` llegaba a Firebase Storage por Admin
 * SDK —que ignora las reglas— tras comprobar sólo la forma del path y, cuando
 * venía, un HMAC sobre `path|exp`. Ese HMAC no decía QUIÉN ni DE QUÉ
 * CONSULTORIO: probaba que alguien de la instalación había acuñado ese path, no
 * que quien lo presentaba tuviera derecho. Y sin firma pasaba igual mientras
 * `RECETA_DISENO_FIRMA` no estuviera en 'obligatoria', que es el estado en el
 * que llevaba semanas.
 *
 * CÓMO SE DESCUBRIÓ: auditoría de seguridad del tablero de producto #296, lane
 * independiente R-06; ya estaba anotado como residual en REG-021.
 *
 * CAUSA RAÍZ: se confundió «ruta no enumerable» con «ruta autorizada». Un path
 * nunca es una autorización, y una URL se filtra (PDF compartido, historial,
 * WhatsApp).
 *
 * REGLA QUE LO HACE SEGURO: la capacidad es versionada y liga
 * `version + path + ownerUid + clinicId + exp`. Tocar cualquier campo rompe el
 * HMAC. Sin secreto no se acuña ni se verifica. Sin capacidad no se pasa salvo
 * bajo una compatibilidad explícita que además muere en producción.
 *
 * QUÉ NO CUBRE: nada del espacio de fotos clínicas (R-05 / #353), ni la ruta
 * HTTP —eso vive en `receta-diseno-ruta.test.ts`—, ni la reproducción del
 * membrete dentro del .doc de Word, que se sirve desde disco y por diseño no
 * puede presentar una capacidad caduca.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  CAPACIDAD_DISENO_VERSION,
  DISENO_TOKEN_TTL_S,
  acunarCapacidadDiseno,
  compatibilidadSinCapacidad,
  duenoDePath,
  esProduccionEquivalente,
  urlDeCapacidad,
  verificarCapacidadDiseno,
  type CapacidadDiseno,
  type ParametrosCapacidad,
} from '@/lib/receta-diseno-token'

const OWNER_A = 'uidAAAAAAAAAAAAAAAAAAAAAAAAA'
const OWNER_B = 'uidBBBBBBBBBBBBBBBBBBBBBBBBB'
const CLINICA_A = 'clinicA'
const CLINICA_B = 'clinicB'
const PATH_A = `receta-diseno/${OWNER_A}/membrete.png`
const PATH_B = `receta-diseno/${OWNER_B}/membrete.png`
const T0 = 1_800_000_000_000 // epoch ms fijo (determinista)

const env = process.env as Record<string, string | undefined>
const previo: Record<string, string | undefined> = {}
const CLAVES = ['RECETA_DISENO_SECRET', 'PORTAL_PACIENTE_SECRET', 'RECETA_DISENO_COMPAT_SIN_FIRMA', 'VERCEL_ENV', 'NODE_ENV']

beforeEach(() => {
  for (const k of CLAVES) previo[k] = env[k]
  env.RECETA_DISENO_SECRET = 'secreto-de-prueba'
  delete env.PORTAL_PACIENTE_SECRET
  delete env.RECETA_DISENO_COMPAT_SIN_FIRMA
  delete env.VERCEL_ENV
  env.NODE_ENV = 'test'   // explícito: la compatibilidad depende de NO ser producción
})
afterEach(() => {
  for (const k of CLAVES) { if (previo[k] === undefined) delete env[k]; else env[k] = previo[k] }
})

const cap = (over: Partial<CapacidadDiseno> = {}): CapacidadDiseno => ({
  ...acunarCapacidadDiseno({ path: PATH_A, ownerUid: OWNER_A, clinicId: CLINICA_A, ahoraMs: T0 })!,
  ...over,
})

/** Pasa una capacidad a los parámetros crudos que llegan por la URL. */
const params = (c: CapacidadDiseno): ParametrosCapacidad =>
  ({ v: c.v, own: c.ownerUid, cid: c.clinicId, exp: String(c.exp), sig: c.sig })

describe('acuñar y verificar la capacidad', () => {
  it('el dueño autenticado de la misma clínica acuña y la capacidad verifica dentro de su vida', () => {
    const c = cap()
    expect(c.v).toBe(CAPACIDAD_DISENO_VERSION)
    expect(c.exp).toBe(Math.floor(T0 / 1000) + DISENO_TOKEN_TTL_S)
    expect(verificarCapacidadDiseno(PATH_A, params(c), T0 + 60_000)).toBe('valida')
  })

  it('la vida por defecto es de minutos, no de un día (una URL filtrada caduca pronto)', () => {
    expect(DISENO_TOKEN_TTL_S).toBeLessThanOrEqual(30 * 60)
  })

  it('vencida → vencida, nunca válida', () => {
    const c = cap()
    expect(verificarCapacidadDiseno(PATH_A, params(c), T0 + (DISENO_TOKEN_TTL_S + 10) * 1000)).toBe('vencida')
  })

  it('CRUCE DE CLÍNICA: la capacidad de la clínica A no vale presentándola como clínica B', () => {
    const c = cap()
    expect(verificarCapacidadDiseno(PATH_A, { ...params(c), cid: CLINICA_B }, T0)).toBe('invalida')
  })

  it('CRUCE DE CLÍNICA: una capacidad acuñada por la clínica B no abre el diseño del dueño A', () => {
    // Aunque la clínica B lograra acuñar algo con el path de A (no puede: la ruta
    // lo corta), la ligadura la delata en el proxy.
    const cB = acunarCapacidadDiseno({ path: PATH_A, ownerUid: OWNER_A, clinicId: CLINICA_B, ahoraMs: T0 })!
    expect(verificarCapacidadDiseno(PATH_A, { ...params(cB), cid: CLINICA_A }, T0)).toBe('invalida')
  })

  it('CRUCE DE DUEÑO: la capacidad del dueño A no sirve para el path legado del dueño B', () => {
    const c = cap()
    expect(verificarCapacidadDiseno(PATH_B, params(c), T0)).toBe('invalida')
    expect(verificarCapacidadDiseno(PATH_B, { ...params(c), own: OWNER_B }, T0)).toBe('invalida')
  })

  it('DEFENSA EN PROFUNDIDAD: una capacidad bien firmada pero con dueño ajeno al path se rechaza', () => {
    // Se firma a propósito una tupla incoherente (lo que produciría un acuñador
    // roto). La firma cuadra; la propiedad del path no. El proxy dice que no.
    const incoherente = acunarCapacidadDiseno({ path: PATH_B, ownerUid: OWNER_A, clinicId: CLINICA_A, ahoraMs: T0 })!
    expect(verificarCapacidadDiseno(PATH_B, params(incoherente), T0)).toBe('dueno_no_coincide')
  })

  it('manipular el exp no extiende la vida (el exp va dentro del HMAC)', () => {
    const c = cap()
    expect(verificarCapacidadDiseno(PATH_A, { ...params(c), exp: String(c.exp + 99_999) }, T0)).toBe('invalida')
  })

  it('manipular la firma, el path o la versión falla cerrado', () => {
    const c = cap()
    expect(verificarCapacidadDiseno(PATH_A, { ...params(c), sig: c.sig.replace(/.$/, x => (x === '0' ? '1' : '0')) }, T0)).toBe('invalida')
    expect(verificarCapacidadDiseno(`receta-diseno/${OWNER_A}/firma.png`, params(c), T0)).toBe('invalida')
    expect(verificarCapacidadDiseno(PATH_A, { ...params(c), v: 'v1' }, T0)).toBe('version_desconocida')
  })

  it('una capacidad v1 (path|exp, el formato viejo) NO se acepta: no se degrada a lo anterior', () => {
    const c = cap()
    expect(verificarCapacidadDiseno(PATH_A, { v: null, own: null, cid: null, exp: String(c.exp), sig: c.sig }, T0))
      .toBe('version_desconocida')
  })

  it('sig basura / exp no numérico → invalida, y nunca lanza', () => {
    const c = cap()
    expect(verificarCapacidadDiseno(PATH_A, { ...params(c), sig: 'zzzz' }, T0)).toBe('invalida')
    expect(verificarCapacidadDiseno(PATH_A, { ...params(c), sig: '' }, T0)).toBe('invalida')
    expect(verificarCapacidadDiseno(PATH_A, { ...params(c), exp: 'NaN' }, T0)).toBe('invalida')
    expect(verificarCapacidadDiseno(PATH_A, { ...params(c), exp: '1e400' }, T0)).toBe('invalida')
  })

  it('sin ningún parámetro → sin_capacidad (el proxy decide, y por defecto es 403)', () => {
    expect(verificarCapacidadDiseno(PATH_A, { v: null, own: null, cid: null, exp: null, sig: null }, T0)).toBe('sin_capacidad')
  })

  it('SIN SECRETO se falla cerrado: no se acuña, y una capacidad presentada no se verifica', () => {
    delete env.RECETA_DISENO_SECRET
    delete env.PORTAL_PACIENTE_SECRET
    expect(acunarCapacidadDiseno({ path: PATH_A, ownerUid: OWNER_A, clinicId: CLINICA_A, ahoraMs: T0 })).toBeNull()
    expect(verificarCapacidadDiseno(PATH_A, { v: 'v2', own: OWNER_A, cid: CLINICA_A, exp: '9999999999', sig: 'ab' }, T0))
      .toBe('sin_secreto')
  })

  it('sin ownerUid o sin clinicId no hay capacidad: la ligadura incompleta no se acuña', () => {
    expect(acunarCapacidadDiseno({ path: PATH_A, ownerUid: '', clinicId: CLINICA_A, ahoraMs: T0 })).toBeNull()
    expect(acunarCapacidadDiseno({ path: PATH_A, ownerUid: OWNER_A, clinicId: '', ahoraMs: T0 })).toBeNull()
    expect(acunarCapacidadDiseno({ path: '', ownerUid: OWNER_A, clinicId: CLINICA_A, ahoraMs: T0 })).toBeNull()
  })

  it('la URL acuñada empieza por ?path= (el cliente la reconoce) y lleva la ligadura completa', () => {
    const url = urlDeCapacidad(cap())
    expect(url.startsWith('/api/receta/diseno?path=')).toBe(true)
    const sp = new URL(url, 'https://app.test').searchParams
    expect(sp.get('v')).toBe(CAPACIDAD_DISENO_VERSION)
    expect(sp.get('own')).toBe(OWNER_A)
    expect(sp.get('cid')).toBe(CLINICA_A)
    expect(Number(sp.get('exp'))).toBeGreaterThan(0)
    expect(sp.get('sig')).toMatch(/^[0-9a-f]{64}$/)
    // Y el proxy la acepta tal cual sale de aquí: el circuito cierra.
    expect(verificarCapacidadDiseno(sp.get('path')!, {
      v: sp.get('v'), own: sp.get('own'), cid: sp.get('cid'), exp: sp.get('exp'), sig: sp.get('sig'),
    }, T0)).toBe('valida')
  })
})

describe('dueño del path — no se adivina', () => {
  it('el espacio legado receta-diseno/{uid}/… sí tiene dueño', () => {
    expect(duenoDePath(PATH_A)).toBe(OWNER_A)
    expect(duenoDePath(`receta-diseno/${OWNER_A}/sub/firma.jpg`)).toBe(OWNER_A)
  })

  it('rutas opacas, fuera de carpeta, con traversal o sin archivo → null (falla cerrado)', () => {
    for (const malo of [
      'otra-carpeta/x/y.png',
      `receta-diseno/${OWNER_A}`,
      `receta-diseno/${OWNER_A}/`,
      'receta-diseno//y.png',
      'receta-diseno/../secreto.png',
      `receta-diseno/${OWNER_A}/../${OWNER_B}/membrete.png`,
      'receta-diseno/ab/y.png',       // uid demasiado corto para ser un uid
      '',
    ]) expect(duenoDePath(malo), malo).toBeNull()
  })
})

describe('compatibilidad sin capacidad — explícita, acotada y muerta en producción', () => {
  it('por defecto está APAGADA (el silencio no abre el proxy)', () => {
    expect(compatibilidadSinCapacidad()).toBe(false)
  })

  it('se enciende sólo con la variable explícita', () => {
    env.RECETA_DISENO_COMPAT_SIN_FIRMA = '1'
    expect(compatibilidadSinCapacidad()).toBe(true)
    env.RECETA_DISENO_COMPAT_SIN_FIRMA = 'true'
    expect(compatibilidadSinCapacidad()).toBe(false)
  })

  it('EN PRODUCCIÓN-EQUIVALENTE no se puede encender ni pidiéndolo', () => {
    env.RECETA_DISENO_COMPAT_SIN_FIRMA = '1'
    env.VERCEL_ENV = 'production'
    expect(esProduccionEquivalente()).toBe(true)
    expect(compatibilidadSinCapacidad()).toBe(false)

    delete env.VERCEL_ENV
    env.NODE_ENV = 'production'
    expect(esProduccionEquivalente()).toBe(true)
    expect(compatibilidadSinCapacidad()).toBe(false)
  })

  it('un preview de Vercel también cuenta como producción-equivalente', () => {
    env.RECETA_DISENO_COMPAT_SIN_FIRMA = '1'
    env.VERCEL_ENV = 'preview'
    expect(compatibilidadSinCapacidad()).toBe(false)
  })
})
