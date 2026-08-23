/**
 * GOLDEN — un incidente útil que no es una copia del expediente.
 *
 * ── QUÉ FALLABA, Y DÓNDE SE VIO ──────────────────────────────────────────────
 *
 * El producto ya sabía redactar (`security/sanitize.ts`) y ya sabía qué decirle
 * al médico cuando la IA se cae (`ia/fallo-proveedor.ts`, escrito tras la caída
 * del 31-jul-2026). Lo que no existía era la garantía de que un incidente de
 * CUALQUIER otra categoría —agenda, autoguardado, notificación, persistencia—
 * contestara las cuatro preguntas del médico y llegara a soporte sin PHI.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Leyendo `api/errores/route.ts`: guarda `mensaje` y `stack` del cliente pasados
 * por el redactor. El redactor caza CURP, RFC, correos, teléfonos y tokens —no
 * caza un nombre propio ni una frase clínica dentro de un mensaje de error. La
 * defensa no podía ser sólo redactar: tenía que ser que el campo no aceptara
 * texto libre.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * · La vista de soporte se CONSTRUYE campo a campo, no se filtra. Un campo nuevo
 *   en el origen no aparece hasta que alguien lo escriba aquí.
 * · `dataSafety` es un campo obligatorio, no una costumbre: es la pregunta que
 *   el médico se está haciendo de verdad.
 *
 * ── QUÉ NO CUBRE, DECLARADO ──────────────────────────────────────────────────
 *
 * · No detecta un nombre propio suelto. Ningún regex lo distingue de una palabra
 *   cualquiera; por eso la defensa es la forma del campo, no su contenido.
 * · No prueba la pantalla: no hay pantalla de soporte todavía. Prueba el
 *   CONTRATO que esa pantalla tendrá que respetar.
 * · No cubre Hospital ni UCI.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { agrupar } from '@/lib/incidents/agrupacion'
import { nuevoEstado, avanzar, iniciarIntento, cerrarIntento } from '@/lib/incidents/maquina'
import { evaluarUmbral } from '@/lib/incidents/umbrales'
import { proyectarParaSoporte, auditarVista } from '@/lib/incidents/consola-soporte'
import { estadoParaElMedico, categoriasConTexto } from '@/lib/incidents/contrato-medico'
import { CATEGORIAS, dimensionesDe, type EventoIncidente } from '@/lib/incidents/taxonomia'
import { runbookPara, incoherenciasDeRunbooks, categoriasSinRunbook } from '@/lib/incidents/runbooks'
import {
  conTelemetriaQueFallaAbierta, compuertaQueFallaCerrada,
  saludDeLaTelemetria, reiniciarSaludDeTelemetria,
} from '@/lib/incidents/telemetria'
import { candidatoDeRegresion, CLAVES_DE_FAMILIA, borradorDeLedger } from '@/lib/incidents/regresion'

const T0 = Date.parse('2026-08-23T09:00:00.000Z')
const ev = (i: number, over: Partial<EventoIncidente> = {}): EventoIncidente => ({
  categoria: 'persistence', subtipo: 'escritura_rechazada', feature: 'nota',
  ruta: '/consulta/[id]', codigoNormalizado: 'unavailable',
  appVersion: 'nexusmed-v1171',
  ocurridoEn: new Date(T0 + i * 1000).toISOString(),
  operationId: `op-${i}`, tenantRef: 'tref-abc12345', correlationId: 'c1d2e3f4g5h6',
  ...over,
})

function vistaDeEjemplo() {
  const { grupos } = agrupar(Array.from({ length: 30 }, (_, i) => ev(i)))
  const veredicto = evaluarUmbral(grupos[0])
  let estado = nuevoEstado(grupos[0].firma, grupos[0].firstSeen)
  estado = avanzar(estado, 'clasificado', grupos[0].lastSeen)
  estado = avanzar(estado, 'agrupado', grupos[0].lastSeen)
  estado = avanzar(estado, 'evaluando', grupos[0].lastSeen)
  estado = avanzar(estado, 'remediacion_elegible', grupos[0].lastSeen)
  const abierto = iniciarIntento(estado, 'reintento_idempotente', grupos[0].lastSeen)!
  estado = cerrarIntento(abierto.estado, 'recuperado', 'ok', grupos[0].lastSeen)
  return { grupo: grupos[0], estado, veredicto }
}

describe('La consola de soporte no lleva PHI', () => {
  it('la vista de un incidente real pasa la auditoría', () => {
    const v = proyectarParaSoporte({ ...vistaDeEjemplo(), buildSha: 'abc1234' })
    expect(auditarVista(v).limpia).toBe(true)
  })

  it('lleva lo que hace falta para repararlo', () => {
    const v = proyectarParaSoporte({ ...vistaDeEjemplo(), buildSha: 'abc1234' })
    expect(v.incidentId).toMatch(/^INC-/)
    expect(v.count).toBe(30)
    expect(v.appVersion).toBe('nexusmed-v1171')
    expect(v.buildSha).toBe('abc1234')
    expect(v.runbookId).toBe('RB-PERSISTENCIA')
    expect(v.remediationAttempts).toHaveLength(1)
    expect(v.correlationIds.length).toBeGreaterThan(0)
    expect(v.currentWorkaround.length).toBeGreaterThan(0)
  })

  it('NO lleva nombre, teléfono, correo, transcripción, diagnóstico, receta ni llave', () => {
    const v = proyectarParaSoporte({ ...vistaDeEjemplo(), buildSha: null })
    const texto = JSON.stringify(v).toLowerCase()
    for (const prohibido of ['nombre', 'paciente', 'transcrip', 'diagnostic', 'receta', 'apikey', 'authorization', 'prompt']) {
      expect(texto, `no debe contener «${prohibido}»`).not.toContain(prohibido)
    }
  })

  /** AL REVÉS: si alguien añadiera un campo «para depurar», la auditoría lo caza. */
  it.each([
    ['patientId', 'abc123'],
    ['transcripcion', 'el paciente refiere dolor'],
    ['authorization', 'Bearer sk-ant-0123456789abcdef'],
    ['diagnostico', 'neumonia adquirida en la comunidad'],
  ])('AL REVÉS: un campo «%s» de más se detecta', (clave, valor) => {
    const v = { ...proyectarParaSoporte({ ...vistaDeEjemplo(), buildSha: null }), [clave]: valor }
    const a = auditarVista(v)
    expect(a.limpia).toBe(false)
    expect(a.motivos.join(' ')).toContain(clave)
  })

  it('AL REVÉS: un CURP o un correo escondido en un campo válido se detecta', () => {
    const v = { ...proyectarParaSoporte({ ...vistaDeEjemplo(), buildSha: null }), currentWorkaround: 'avisar a ana.ruiz@correo.com' }
    expect(auditarVista(v).limpia).toBe(false)
  })

  it('el recorte de operaciones se declara: no se lee como el total', () => {
    const { grupos } = agrupar(Array.from({ length: 400 }, (_, i) => ev(i)))
    const veredicto = evaluarUmbral(grupos[0])
    const estado = nuevoEstado(grupos[0].firma, grupos[0].firstSeen)
    const v = proyectarParaSoporte({ grupo: grupos[0], estado, veredicto })
    expect(v.affectedOperationsTruncated).toBe(true)
  })
})

describe('El médico sabe si su trabajo está a salvo', () => {
  it('TODA categoría tiene una frase de seguridad del dato, y ninguna está vacía', () => {
    expect(new Set(categoriasConTexto())).toEqual(new Set(CATEGORIAS))
    for (const categoria of CATEGORIAS) {
      const e = estadoParaElMedico({ categoria, dimensiones: dimensionesDe({ categoria }) })
      expect(e.dataSafety.trim().length, categoria).toBeGreaterThan(10)
      expect(e.canContinue.trim().length, categoria).toBeGreaterThan(5)
      expect(e.whatFailed.trim().length, categoria).toBeGreaterThan(5)
    }
  })

  it('con la IA caída y llave de la PLATAFORMA no se le echa la culpa al médico', () => {
    const e = estadoParaElMedico({
      categoria: 'ai_provider',
      dimensiones: dimensionesDe({ categoria: 'ai_provider' }),
      ia: { clase: 'sin_saldo', quien: 'plataforma' },
      soporteAvisado: true,
    })
    expect(e.whatFailed).not.toMatch(/tu llave|recarga|saldo|paga/i)
    expect(e.dataSafety).toMatch(/dictado está guardado/i)
    expect(e.retryAvailable).toBe(false)      // sin saldo no se arregla reintentando
    expect(e.supportAlreadyNotified).toBe(true)
  })

  it('con llave DEL CONSULTORIO sí se le dice qué hacer: él puede arreglarlo', () => {
    const e = estadoParaElMedico({
      categoria: 'ai_provider',
      dimensiones: dimensionesDe({ categoria: 'ai_provider' }),
      ia: { clase: 'llave_invalida', quien: 'clinica' },
    })
    expect(e.whatFailed).toMatch(/Configuración/)
  })

  it('nunca se promete «ya avisamos a soporte» si el aviso no salió', () => {
    const e = estadoParaElMedico({
      categoria: 'ai_provider',
      dimensiones: dimensionesDe({ categoria: 'ai_provider' }),
      ia: { clase: 'sin_saldo', quien: 'plataforma' },
      soporteAvisado: false,
    })
    expect(e.supportAlreadyNotified).toBe(false)
  })

  it('la cita sobrevive al mensaje: falla la notificación y el dato sigue', () => {
    const e = estadoParaElMedico({ categoria: 'notification', dimensiones: dimensionesDe({ categoria: 'notification' }) })
    expect(e.dataSafety).toMatch(/cita sigue guardada/i)
    expect(e.interrumpeConsulta).toBe(false)   // no impide atender: espera a salir de la consulta
  })

  it('el AUTOGUARDADO es la excepción: se pone delante del médico', () => {
    const e = estadoParaElMedico({ categoria: 'autosave', dimensiones: dimensionesDe({ categoria: 'autosave' }) })
    expect(e.visibilidad).toBe('bloqueante')
    expect(e.interrumpeConsulta).toBe(true)
    expect(e.dataSafety).toMatch(/ATENCIÓN/)
  })

  it('una caída de evidencia NO interrumpe: la nota sigue editable', () => {
    const e = estadoParaElMedico({ categoria: 'evidence', dimensiones: dimensionesDe({ categoria: 'evidence' }) })
    expect(e.interrumpeConsulta).toBe(false)
    expect(e.dataSafety).toMatch(/nota sigue editable/i)
  })
})

describe('Los runbooks son coherentes con lo que el motor permite', () => {
  it('ningún runbook cita una acción que no existe', () => {
    expect(incoherenciasDeRunbooks()).toEqual([])
  })

  it('toda categoría tiene runbook', () => {
    expect(categoriasSinRunbook(CATEGORIAS)).toEqual([])
  })

  it('el de saldo NO autoriza nada automático y NO permite reintentar', () => {
    const rb = runbookPara('ai_provider', 'sin_saldo')
    expect(rb.accionesAutomaticas).toEqual([])
    expect(rb.permiteReintento).toBe(false)
    expect(rb.accionDelDueno).toMatch(/GASTO/)
  })

  it('el de sobrecarga SÍ autoriza remediación acotada', () => {
    const rb = runbookPara('ai_provider', 'sobrecarga')
    expect(rb.accionesAutomaticas).toContain('reintento_idempotente')
    expect(rb.permiteReintento).toBe(true)
  })

  it('el de notificación prohíbe deshacer la reserva', () => {
    expect(runbookPara('notification').accionesProhibidas).toContain('borrar_encuentro')
  })

  it('el de aislamiento no autoriza NADA automático', () => {
    expect(runbookPara('tenant_isolation').accionesAutomaticas).toEqual([])
  })

  it('todos declaran cómo se verifica que se arregló', () => {
    for (const c of CATEGORIAS) expect(runbookPara(c).verificacion.length, c).toBeGreaterThan(20)
  })
})

describe('Que se caiga el vigilante no puede costar una consulta', () => {
  beforeEach(() => reiniciarSaludDeTelemetria())

  it('si no se puede anotar el incidente, la operación del médico sigue', () => {
    const r = conTelemetriaQueFallaAbierta('nota-guardada', () => { throw new Error('firestore caído') }, '2026-08-23T09:00:00.000Z')
    expect(r.valor).toBe('nota-guardada')
    expect(r.telemetriaFallo).toBe(true)
  })

  it('pero no se calla: cinco fallos seguidos y el vigilante se declara ciego', () => {
    for (let i = 0; i < 5; i += 1) {
      conTelemetriaQueFallaAbierta(null, () => { throw new Error('x') }, '2026-08-23T09:00:00.000Z')
    }
    const s = saludDeLaTelemetria()
    expect(s.ciega).toBe(true)
    expect(s.fallosSeguidos).toBe(5)
    expect(s.desde).toBe('2026-08-23T09:00:00.000Z')
  })

  it('una anotación buena borra el contador', () => {
    conTelemetriaQueFallaAbierta(null, () => { throw new Error('x') }, '2026-08-23T09:00:00.000Z')
    conTelemetriaQueFallaAbierta(null, () => { /* ok */ }, '2026-08-23T09:00:01.000Z')
    expect(saludDeLaTelemetria().fallosSeguidos).toBe(0)
  })

  /** LA OTRA MITAD: lo de seguridad falla CERRADO. */
  it('si no se puede comprobar el aislamiento, se DENIEGA', () => {
    const r = compuertaQueFallaCerrada(() => { throw new Error('no se pudo leer la regla') })
    expect(r.permitido).toBe(false)
    expect(r.porQue).toMatch(/se deniega/)
  })

  it('AL REVÉS: la compuerta de seguridad no acepta usarse para telemetría', () => {
    expect(() => compuertaQueFallaCerrada(() => true, 'telemetria')).toThrow(/sólo para invariantes de seguridad/)
  })

  it('un incidente de aislamiento nunca se suprime: la compuerta no tiene modo permisivo', () => {
    expect(compuertaQueFallaCerrada(() => false).permitido).toBe(false)
    expect(compuertaQueFallaCerrada(() => undefined as unknown as boolean).permitido).toBe(false)
  })
})

describe('Un incidente resuelto puede convertirse en prueba de regresión', () => {
  function resuelto() {
    const v = vistaDeEjemplo()
    let estado = v.estado
    estado = avanzar(estado, 'resuelto', '2026-08-23T10:00:00.000Z')
    return { grupo: v.grupo, estado }
  }

  it('emite un candidato compatible con el ledger y las familias que ya existen', () => {
    const { grupo, estado } = resuelto()
    const r = candidatoDeRegresion({
      grupo, estado,
      claseDeCausaRaiz: 'no_conectado',
      reproduccionMinima: [
        'la escritura de la nota devuelve `unavailable` tres veces seguidas',
        'el cliente reintenta sin clave de idempotencia',
      ],
      invarianteEsperado: 'un reintento de guardado nunca crea un segundo documento de nota para el mismo encuentro',
      duenoDeLaPrueba: '#306 Consultorio',
      versionArreglada: 'nexusmed-v1172',
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(CLAVES_DE_FAMILIA).toContain(r.candidato.claseDeCausaRaiz)
    expect(r.candidato.rutaDePruebaTODO).toMatch(/^TODO:/)
    expect(borradorDeLedger(r.candidato)).toMatch(/Qué NO cubre/)
  })

  it('AL REVÉS: se NIEGA a emitir un candidato sin reproducción', () => {
    const { grupo, estado } = resuelto()
    const r = candidatoDeRegresion({
      grupo, estado, claseDeCausaRaiz: 'no_conectado',
      reproduccionMinima: [],
      invarianteEsperado: 'un reintento de guardado nunca crea un segundo documento de nota',
      duenoDeLaPrueba: '#306',
    })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.motivos).toContain('sin_reproduccion')
  })

  it('AL REVÉS: un invariante que es un deseo se rechaza', () => {
    const { grupo, estado } = resuelto()
    const r = candidatoDeRegresion({
      grupo, estado, claseDeCausaRaiz: 'no_conectado',
      reproduccionMinima: ['pasos'],
      invarianteEsperado: 'no debe fallar',
      duenoDeLaPrueba: '#306',
    })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.motivos).toContain('invariante_trivial')
  })

  it('AL REVÉS: un incidente todavía abierto no produce candidato', () => {
    const v = vistaDeEjemplo()
    const r = candidatoDeRegresion({
      grupo: v.grupo, estado: v.estado, claseDeCausaRaiz: 'no_conectado',
      reproduccionMinima: ['pasos'],
      invarianteEsperado: 'un reintento de guardado nunca crea un segundo documento de nota',
      duenoDeLaPrueba: '#306',
    })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.motivos).toContain('no_resuelto')
  })

  it('AL REVÉS: una familia de causa raíz inventada se rechaza', () => {
    const { grupo, estado } = resuelto()
    const r = candidatoDeRegresion({
      grupo, estado, claseDeCausaRaiz: 'familia_que_no_existe',
      reproduccionMinima: ['pasos'],
      invarianteEsperado: 'un reintento de guardado nunca crea un segundo documento de nota',
      duenoDeLaPrueba: '#306',
    })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.motivos).toContain('familia_inexistente')
  })
})
