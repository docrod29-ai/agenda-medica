/**
 * LIBERAR LO DECIDE EL SERVIDOR — V9 `POSTVISIT-001`, REG-307.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * «Lo que se lleva el paciente» existía desde REG-242 y **no llegaba al
 * paciente**: dos botones —copiar e imprimir— y ni una ruta hacia `/mi/[token]`,
 * `/api/portal` o una plantilla de mensaje. El contenido estaba resuelto y el
 * producto no lo entregaba. «Escrito, probado y sin conectar» en su forma más
 * cara: la función existe, es buena, y el paciente no la ve.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Auditoría `PATIENT-UX-TRUTH-001`: se buscó el símbolo `HojaParaElPaciente` en
 * todo el repositorio y su único importador en producción era la consulta. Es el
 * procedimiento de «antes de dar algo por entregado, buscar el símbolo en
 * `app/`, `hooks/` y `components/`».
 *
 * ── LA CAUSA RAÍZ ────────────────────────────────────────────────────────────
 *
 * Faltaba el ACTO de liberar. Firmar mandaba la nota al expediente y nadie había
 * escrito el segundo gesto —«esto es lo que quiero que el paciente lea»—, así
 * que no había nada que enseñar en el portal aunque el portal ya estuviera.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * El cliente no aporta contenido: manda cuatro identificadores y el servidor
 * compone desde la nota firmada. Quién aprueba sale del token verificado y
 * cuándo, del reloj del servidor. Es la misma lección que la bitácora aprendió a
 * golpes: una aprobación que el aprobado puede escribir a discreción no acredita
 * nada.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 *
 * - **No se ha ejecutado contra Firestore.** Estas pruebas comprueban que las
 *   decisiones estén escritas donde tienen que estar y que las piezas puras
 *   hagan lo que dicen; la escritura real y la carrera entre dos pestañas siguen
 *   sin ejecutarse (no hay credenciales en esta máquina).
 * - No prueba la pantalla en un navegador: ni el estado de carga, ni el foco,
 *   ni cómo se ve en móvil.
 * - No comprueba que el paciente RECIBA un aviso de que hay algo nuevo. Hoy no
 *   se le manda ninguno: el paquete aparece en su portal y ya. El aviso es de
 *   `CLOSED-LOOP-PATIENT-001`.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { REGISTRO_RUTAS } from '@/lib/authz/registro-rutas'
import { rolesCon, ROLES_NO_CLINICOS } from '@/lib/authz/capabilities'
import { EVENTO_LABEL } from '@/lib/expediente/audit-eventos'

const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const RUTA = sinComentarios(leer('src/app/api/paciente/paquete/route.ts'))
const CONSULTA = leer('src/app/(dashboard)/consulta/[patientId]/page.tsx')
const PANEL = leer('src/components/LiberarAlPaciente.tsx')
const PORTAL = sinComentarios(leer('src/app/api/portal/route.ts'))

describe('la ruta está declarada y bajo la capacidad correcta', () => {
  it('existe en el registro de rutas', () => {
    expect(REGISTRO_RUTAS['paciente/paquete']).toBeDefined()
  })

  it('exige `clinico.escribir`: liberar es un acto clínico, no de mostrador', () => {
    const e = REGISTRO_RUTAS['paciente/paquete']
    expect(e).toMatchObject({ tipo: 'capacidad', capacidad: 'clinico.escribir' })
  })

  it('y esa capacidad NO alcanza a ningún rol no clínico', () => {
    /* La ruta lee diagnóstico y medicación de una nota firmada. Si la capacidad
       llegara a recepción o a facturación, sería una fuga de secreto médico. */
    const fuga = rolesCon('clinico.escribir').filter(r => ROLES_NO_CLINICOS.includes(r))
    expect(fuga).toEqual([])
  })

  it('la comprobación de capacidad está en el código, no sólo en el registro', () => {
    expect(RUTA).toMatch(/verificarCapacidad\(req,\s*clinicId,\s*'clinico\.escribir'\)/)
  })
})

describe('el cliente no aporta contenido, y menos aún la aprobación', () => {
  it('rechaza un cuerpo que traiga `estado` o `approvedBy`', () => {
    /**
     * Al revés del arreglo: sin esta lista, mandar `{estado:'RELEASED'}` sería
     * inofensivo hoy —el servidor recompone— pero el día que alguien haga un
     * `...body` en esta ruta, el agujero ya está abierto y nadie se entera.
     */
    expect(RUTA).toContain("'estado', 'approvedBy', 'approvedAt', 'version'")
    expect(RUTA).toMatch(/CAMPOS_PROHIBIDOS\.find/)
  })

  it('y también los campos de contenido clínico', () => {
    for (const campo of ['medicationInstructions', 'orders', 'followUp', 'encounterSummary', 'warningSigns']) {
      expect(RUTA).toContain(`'${campo}'`)
    }
  })

  it('lista blanca: cualquier llave que no sean los cuatro identificadores se rechaza', () => {
    expect(RUTA).toContain("const CAMPOS_ACEPTADOS = ['clinicId', 'patientId', 'notaId', 'accion'] as const")
    expect(RUTA).toMatch(/CAMPOS_ACEPTADOS as readonly string\[\]\)\.includes\(k\)/)
  })

  it('NUNCA hace un volcado del cuerpo al documento', () => {
    /* El defecto que esta prueba impide: `...body` en la escritura. */
    expect(RUTA).not.toMatch(/\.\.\.body/)
  })

  it('quién aprueba sale del token verificado, no del cuerpo', () => {
    expect(RUTA).toMatch(/const quien = acceso\.email \?\? acceso\.uid/)
    expect(RUTA).toMatch(/liberar\(\{ \.\.\.paquete, version \}, quien, cuando\)/)
  })

  it('y cuándo, del reloj del servidor', () => {
    expect(RUTA).toMatch(/const cuando = Date\.now\(\)/)
  })
})

describe('la firma se comprueba en el servidor, no en la pantalla', () => {
  it('la ruta compone con el motor que exige firma', () => {
    expect(RUTA).toMatch(/componerPaquete\(notaParaElPaquete,/)
  })

  it('y traduce el motivo por TIPO, no leyendo el mensaje del error', () => {
    expect(RUTA).toMatch(/e instanceof PaqueteNoComponible/)
    expect(RUTA).toMatch(/ESTADO_HTTP\[e\.motivo\]/)
    expect(RUTA).toContain("'sin-firma': 409")
  })

  it('lee de la nota campo por campo, sin arrastrar el documento entero', () => {
    /* Un `...nota` mandaría la transcripción y el diálogo diarizado al
       navegador dentro de la respuesta de previsualización. */
    expect(RUTA).not.toMatch(/\.\.\.nota[,\s}]/)
    expect(RUTA).toMatch(/const notaParaElPaquete: NotaParaElPaquete = \{/)
  })

  it('no libera un paquete vacío', () => {
    expect(RUTA).toMatch(/if \(!tieneAlgoQueDecir\(paquete\)\)/)
  })
})

describe('ESTÁ CONECTADO — el dato tiene que llegar', () => {
  it('la consulta importa y monta el panel de liberación', () => {
    expect(CONSULTA).toContain("import { LiberarAlPaciente } from '@/components/LiberarAlPaciente'")
    expect(CONSULTA).toContain('<LiberarAlPaciente')
  })

  it('sólo con la nota FIRMADA y fuera del internamiento', () => {
    expect(CONSULTA).toMatch(/\{firmada && !esNotaHospital && clinicId && notaId && \(\s*\n\s*<LiberarAlPaciente/)
  })

  it('el panel llama de verdad a la ruta, y con las dos acciones', () => {
    expect(PANEL).toContain("fetchAutenticado('/api/paciente/paquete'")
    expect(PANEL).toMatch(/pedir\('previsualizar'\)/)
    expect(PANEL).toMatch(/pedir\('liberar'\)/)
  })

  it('el panel PINTA lo que devuelve el servidor; no compone su propia versión', () => {
    /**
     * Si compusiera la suya «para enseñarla», el médico aprobaría un texto y el
     * paciente leería otro. Por eso el componente no importa el motor.
     */
    expect(PANEL).not.toContain('componerPaquete')
    expect(PANEL).not.toContain('comoSeLoExplico')
  })

  it('y el otro extremo: el portal sirve la versión VIGENTE de cada consulta', () => {
    expect(PORTAL).toContain("import { vigentesPorNota } from '@/lib/paciente/liberacion'")
    expect(PORTAL).toMatch(/vigentesPorNota\(/)
    /* La compuerta de REG-304 sigue en su sitio: vigente no quiere decir visible. */
    expect(PORTAL).toMatch(/\.filter\(visibleParaElPaciente\)/)
  })

  it('el acto queda en la bitácora, con su etiqueta', () => {
    expect(RUTA).toContain("evento: 'paquete_liberado'")
    expect(EVENTO_LABEL.paquete_liberado).toBeTruthy()
  })

  it('y el asiento no puede tumbar la liberación', () => {
    /* Perder el asiento es malo; perder la liberación por el asiento es peor.
       El asiento se escribe DESPUÉS y su fallo sólo se registra. */
    const orden = RUTA.indexOf('audit_log')
    const escritura = RUTA.indexOf('.create({')
    expect(escritura).toBeGreaterThan(0)
    expect(orden).toBeGreaterThan(escritura)
  })
})

describe('la carrera entre dos pestañas no crea dos versiones vigentes', () => {
  it('se escribe con `create` sobre un id que lleva la versión dentro', () => {
    expect(RUTA).toMatch(/\.doc\(idDelPaquete\(notaId, version\)\)\.create\(/)
  })

  it('y el choque se reintenta una vez, en vez de sobrescribir', () => {
    expect(RUTA).toMatch(/codigo !== 6 && codigo !== 'already-exists'/)
    expect(RUTA).not.toMatch(/\.set\(\s*\{[\s\S]{0,200}approvedBy/)
  })
})
