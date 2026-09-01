/**
 * GOLDEN — R-09 Y R-13: EL DERECHO QUE UNA RESTAURACIÓN DESHACÍA, Y LA PÉRDIDA
 * QUE NADIE MIRABA.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * **R-09.** `/api/clinic/importar` aprendió a no confundir «sin pacientes» con
 * «consultorio vacío» (cinco señales, no dos). Pero eso sólo detiene la
 * restauración sobre un consultorio que tiene datos: con `sobrescribir=1` —que
 * existe, y se pide a propósito— un respaldo ANTERIOR a una supresión ARCO
 * volvía a escribir al paciente suprimido, sus notas, sus adendas, sus
 * laboratorios, sus fotografías y sus citas. Un derecho ejercido por el titular
 * (LFPDPPP Art. 25-26), ejecutado por el consultorio y asentado en la bitácora,
 * se deshacía como efecto colateral de una operación rutinaria. La entrada del
 * registro de riesgos lo decía con estas palabras: «el invariante que falta
 * —un paciente cuya supresión consta en el destino no vuelve— **no está
 * implementado**».
 *
 * **R-13.** La conciliación ya sabía comparar dos fotografías documento a
 * documento. Lo que no había era el paso siguiente: un veredicto de pérdida
 * clínica que un duplicado de identidad no pudiera esquivar —dos documentos con
 * identidades legítimas distintas y el mismo contenido no producen `FALTA` ni
 * tienen por qué producir `SOBRA`— y un aviso que alguien pudiera leer y
 * reenviar a las tres de la mañana sin sacar PHI del expediente.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * R-09 estaba declarado por escrito como residuo del arreglo anterior, en
 * `docs/recovery/REGISTRO-DE-RIESGOS.md` y en la sección «qué NO cubre» de la
 * entrada del ledger: se sabía y se dejó abierto porque faltaba decidir el
 * criterio de identidad. La directiva de reparación lo fija —ruta canónica del
 * paciente más los campos de referencia que ya existen— y con eso deja de ser
 * una decisión de producto pendiente.
 *
 * R-13 salió de leer `ensayoImpecable`: exigía `reconciliacion.limpia` y nunca
 * miraba `duplicadosPorContenido`, que vive en el mismo módulo y que el propio
 * catálogo de averías cita como detector de `documento-duplicado`. El detector
 * estaba escrito y sin conectar al veredicto.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * La supresión se comprueba en la ADMISIÓN —antes del aislamiento, antes de la
 * verdad firmada y antes de la frescura—, con el MISMO conjunto derivado en el
 * ensayo y en la restauración de verdad, y sin consultar `sobrescribir` en
 * ninguna rama. Lo que no se puede atar con seguridad a un paciente no se
 * adivina: se detiene. Y nada se repara solo: ni se borra el asiento de la
 * supresión, ni se elige entre dos duplicados, ni se decide si un expediente
 * cancelado puede reactivarse.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 *
 *  · **Nada de Firestore.** No hay emulador: se prueban los motores puros y se
 *    comprueba por LECTURA del archivo que la ruta los llama, y en qué orden.
 *    Que la consulta `where('evento','==','paciente_borrado')` devuelva lo que
 *    se espera contra un proyecto real no se puede probar aquí.
 *  · **La identidad del paciente más allá del identificador.** Si el mismo ser
 *    humano tiene dos expedientes con dos `patientId` y sólo uno se suprimió, el
 *    otro vuelve. Eso es identidad de paciente y es de #306.
 *  · **La reactivación.** Este arnés no dice si un expediente suprimido puede
 *    volver alguna vez: eso es NEEDS_LEGAL_REVIEW.
 *  · **RPO y RTO**, que siguen en `NOT_MEASURED` y no los toca esta reparación.
 *  · **Los objetos de Cloud Storage.** La compuerta detiene el METADATO de una
 *    fotografía clínica del paciente suprimido; el objeto sigue en el bucket,
 *    porque no viaja en el respaldo. Es el residuo de R-05.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { generarConsultorio, aRespaldoNdjson, inyectar, type LineaSintetica } from '@/lib/durability/fixtures'
import { correrEnsayo, ensayoImpecable, fotoDeLineas, DESTINO_VACIO } from '@/lib/durability/ensayo'
import {
  derivarSupresiones, evaluarSupresion, esSupresionArco, SIN_SUPRESIONES,
  MOTIVO_VIGENTE, MOTIVO_NO_ATRIBUIBLE, EXIGEN_ATRIBUCION,
  POR_QUE_SOBRESCRIBIR_NO_LO_SALTA, POR_QUE_NO_SE_DECIDE_LA_REACTIVACION,
  type AsientoDeBitacora,
} from '@/lib/durability/supresion-arco'
import {
  verificarRecuperacion, NO_SE_REPARA, QUE_SIGNIFICA, TOPE_DE_RUTAS,
} from '@/lib/durability/verificacion-recuperacion'
import { reconciliar } from '@/lib/durability/reconciliacion'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')
const rutaImportar = leer('src', 'app', 'api', 'clinic', 'importar', 'route.ts')
const DIR_DURABILIDAD = join(process.cwd(), 'src', 'lib', 'durability')

const CLINICA = 'clinica-arco-a'
const CUANDO = '2026-01-05T09:00:00.000Z'
const PEQUEÑO = { clinicId: CLINICA, pacientes: 3, notasPorPaciente: 2, citasPorPaciente: 1, semilla: 31 }

const P0 = `pac-${CLINICA}-00000`
const P1 = `pac-${CLINICA}-00001`
const P2 = `pac-${CLINICA}-00002`

/** El asiento que escribe `/api/arco/cancelar` cuando SUPRIME de verdad. */
function supresionDe(patientId: string): AsientoDeBitacora {
  return {
    evento: 'paciente_borrado', clinicId: CLINICA, patientId,
    medicoUid: 'med-sintetico', medicoEmail: 'sintetica@example.invalid',
    meta: { accion: 'supresion_arco', solicitudId: 'sol-1', notas: 2, citas: 1, identidadVerificadaPor: 'med-sintetico' },
    timestamp: CUANDO,
  }
}

async function respaldoLimpio() {
  const docs = await generarConsultorio(PEQUEÑO)
  return { docs, ndjson: await aRespaldoNdjson(docs, CLINICA, CUANDO) }
}

/** El destino, sembrado con los mismos documentos que el respaldo. */
function destinoCon(docs: readonly LineaSintetica[]) {
  const m = new Map<string, Record<string, unknown>>()
  for (const d of docs) {
    const { _ruta, _coleccion, ...datos } = d
    void _coleccion
    m.set(_ruta, datos)
  }
  return { documentos: m }
}

/** ¿Este documento del fixture es del paciente suprimido? */
function esDe(d: LineaSintetica, pid: string): boolean {
  return d._ruta.startsWith(`clinics/${CLINICA}/patients/${pid}`)
    || d.patientId === pid || d.pacienteId === pid
}

// ═════════════════════════════════════════════════════════════════════════════
// R-09 · una restauración no resucita un expediente cancelado
// ═════════════════════════════════════════════════════════════════════════════

describe('R-09 · 1 · la raíz del expediente suprimido no vuelve', () => {
  it('el documento del paciente se detiene con `supresion-arco-vigente` y NO se escribe', async () => {
    const { ndjson } = await respaldoLimpio()
    const r = await correrEnsayo(ndjson, {
      clinicIdDestino: CLINICA, destino: DESTINO_VACIO, bitacoraDelDestino: [supresionDe(P0)],
    })

    const raiz = `clinics/${CLINICA}/patients/${P0}`
    const detenido = r.supresionArco.find(s => s.ruta === raiz)
    expect(detenido, 'el expediente suprimido pasó la compuerta').toBeDefined()
    expect(detenido!.motivo).toBe(MOTIVO_VIGENTE)
    expect(detenido!.patientId).toBe(P0)
    expect(detenido!.porQue).toMatch(/supresión ARCO/i)

    // Y no aparece en la fotografía resultante: no se escribió.
    expect(r.fotoResultante.some(f => f.ruta === raiz)).toBe(false)
    expect(r.dictamen.veredicto).toBe('REVISION_HUMANA')
    expect(r.conteos.supresionesArcoVigentes).toBeGreaterThan(0)
    expect(r.dictamen.antesDeUsarlo.join(' ')).toMatch(/decisión legal/i)
  })

  it('AL REVÉS: el mismo archivo sin supresión vigente vuelve entero y COMPLETA', async () => {
    // Si esta mitad no pasara, la de arriba no probaría nada: probaría que el
    // fixture no se restaura.
    const { docs, ndjson } = await respaldoLimpio()
    const r = await correrEnsayo(ndjson, { clinicIdDestino: CLINICA, destino: DESTINO_VACIO })
    expect(r.supresionArco).toEqual([])
    expect(r.conteos.escritos).toBe(docs.length)
    expect(r.dictamen.veredicto).toBe('COMPLETA')
  })
})

describe('R-09 · 2 · lo que cuelga del expediente tampoco vuelve', () => {
  it('nota, adenda, fotografía y laboratorio del paciente suprimido se detienen', async () => {
    const { ndjson } = await respaldoLimpio()
    const r = await correrEnsayo(ndjson, {
      clinicIdDestino: CLINICA, destino: DESTINO_VACIO, bitacoraDelDestino: [supresionDe(P0)],
    })

    const bajo = `clinics/${CLINICA}/patients/${P0}/`
    for (const trozo of ['/notas/', '/adendas/', '/fotos/', '/laboratorios/', '/clinico/']) {
      expect(
        r.supresionArco.some(s => s.ruta.startsWith(bajo) && s.ruta.includes(trozo)),
        `no se detuvo nada bajo ${trozo}`,
      ).toBe(true)
    }
    // Ni uno solo llegó a la fotografía resultante.
    expect(r.fotoResultante.filter(f => f.ruta.startsWith(bajo))).toEqual([])
  })
})

describe('R-09 · 3 · los dependientes de primer nivel que NOMBRAN al paciente', () => {
  it('la cita y el cobro del paciente suprimido se detienen por su campo de referencia', async () => {
    const { ndjson } = await respaldoLimpio()
    const r = await correrEnsayo(ndjson, {
      clinicIdDestino: CLINICA, destino: DESTINO_VACIO, bitacoraDelDestino: [supresionDe(P0)],
    })

    const cita = r.supresionArco.find(s => s.coleccion === 'appointments' && s.patientId === P0)
    const cobro = r.supresionArco.find(s => s.coleccion === 'cobros' && s.patientId === P0)
    expect(cita, 'una cita del paciente suprimido se habría restaurado').toBeDefined()
    expect(cobro, 'un cobro del paciente suprimido se habría restaurado').toBeDefined()
    expect(cita!.motivo).toBe(MOTIVO_VIGENTE)
    expect(r.fotoResultante.some(f => f.ruta === cita!.ruta)).toBe(false)
  })

  it('un dependiente clínico que no se puede atar a UN paciente falla cerrado', () => {
    const s = derivarSupresiones([supresionDe(P0)])

    // Ni cuelga de un paciente ni nombra a ninguno.
    const huerfana = evaluarSupresion(`clinics/${CLINICA}/appointments/x`, 'appointments', { fecha: CUANDO }, s)
    expect(huerfana.admite).toBe(false)
    expect(huerfana).toMatchObject({ motivo: MOTIVO_NO_ATRIBUIBLE, patientId: null })

    // La ruta dice uno y el contenido dice otro: no se elige.
    const cruzada = evaluarSupresion(
      `clinics/${CLINICA}/patients/${P1}/notas/n1`, 'patients.notas', { pacienteId: P2 }, s,
    )
    expect(cruzada.admite).toBe(false)
    expect(cruzada).toMatchObject({ motivo: MOTIVO_NO_ATRIBUIBLE })
  })

  it('AL REVÉS: sin supresión vigente, esos mismos documentos pasan', () => {
    /**
     * Fallar cerrado por falta de atribución sólo tiene sentido habiendo algo
     * que proteger. Una cita sin `patientId` en un consultorio donde nadie
     * ejerció su cancelación es un dato pobre, no un riesgo de resurrección, y
     * detenerla ahí paralizaría restauraciones legítimas.
     */
    expect(evaluarSupresion(`clinics/${CLINICA}/appointments/x`, 'appointments', { fecha: CUANDO }, SIN_SUPRESIONES).admite).toBe(true)
    expect(evaluarSupresion(`clinics/${CLINICA}/patients/${P1}/notas/n1`, 'patients.notas', { pacienteId: P2 }, SIN_SUPRESIONES).admite).toBe(true)
  })

  it('la lista de colecciones que exigen atribución es vocabulario, y se declara', () => {
    // Regla 5 de seguridad clínica: que falte un término significa que ese caso
    // NO se vigila, no que se dé por bueno.
    expect(EXIGEN_ATRIBUCION).toContain('appointments')
    expect(EXIGEN_ATRIBUCION).toContain('internamientos')
    expect(EXIGEN_ATRIBUCION).toContain('cobros')
    expect(leer('src', 'lib', 'durability', 'supresion-arco.ts'))
      .toMatch(/vocabulario, no criterio/)
  })
})

describe('R-09 · 4 · el paciente que NO fue suprimido se restaura entero', () => {
  it('sólo se detiene lo del expediente cancelado; el resto vuelve', async () => {
    const { docs, ndjson } = await respaldoLimpio()
    const r = await correrEnsayo(ndjson, {
      clinicIdDestino: CLINICA, destino: DESTINO_VACIO, bitacoraDelDestino: [supresionDe(P0)],
    })

    const delSuprimido = docs.filter(d => esDe(d, P0))
    expect(delSuprimido.length).toBeGreaterThan(5)

    expect(r.supresionArco).toHaveLength(delSuprimido.length)
    expect(r.supresionArco.every(s => s.patientId === P0)).toBe(true)
    expect(r.conteos.escritos).toBe(docs.length - delSuprimido.length)

    // Los otros dos expedientes están completos en la fotografía resultante.
    for (const pid of [P1, P2]) {
      expect(r.fotoResultante.some(f => f.ruta === `clinics/${CLINICA}/patients/${pid}`)).toBe(true)
      expect(r.fotoResultante.filter(f => f.ruta.includes(`/patients/${pid}/`)).length).toBeGreaterThan(3)
    }
  })
})

describe('R-09 · 5 · `sobrescribir=1` no puede saltarse la compuerta', () => {
  it('con el destino ya poblado —el caso de sobrescribir— sigue sin admitirse', async () => {
    /**
     * Sobrescribir lleva la restauración por la rama que MIRA el destino y
     * compara. Si la compuerta viviera ahí, un documento idéntico saldría por
     * `omitir-identico` y se contaría como restaurado. Vive en la admisión, así
     * que ni se compara.
     */
    const { docs, ndjson } = await respaldoLimpio()
    const r = await correrEnsayo(ndjson, {
      clinicIdDestino: CLINICA, destino: destinoCon(docs), bitacoraDelDestino: [supresionDe(P0)],
    })

    const delSuprimido = docs.filter(d => esDe(d, P0))
    expect(r.supresionArco).toHaveLength(delSuprimido.length)
    expect(r.conteos.escritos).toBe(0)
    expect(r.conteos.yaEstaban).toBe(docs.length - delSuprimido.length)
    expect(r.dictamen.veredicto).toBe('REVISION_HUMANA')
  })

  it('la pasada de ADMISIÓN de la ruta no consulta la bandera en ninguna parte', () => {
    const desde = rutaImportar.indexOf('for (const crudo of texto.split(')
    const hasta = rutaImportar.indexOf('const observado: ObservadoAlReleer')
    expect(desde).toBeGreaterThan(-1)
    expect(hasta).toBeGreaterThan(desde)
    expect(rutaImportar.slice(desde, hasta)).not.toContain('sobrescribir')
    expect(POR_QUE_SOBRESCRIBIR_NO_LO_SALTA).toMatch(/derecho de un tercero/)
  })

  it('la compuerta corre ANTES de la verdad firmada y de la frescura', () => {
    // «Escrito y sin conectar»: el módulo puede ser perfecto y correr tarde.
    const iCarga = rutaImportar.indexOf("where('evento', '==', 'paciente_borrado')")
    const iGate = rutaImportar.indexOf('evaluarSupresion(')
    const iAdmitidos = rutaImportar.indexOf('admitidos.push(')
    const iFirmada = rutaImportar.indexOf('compararNotaFirmada(')
    const iFrescura = rutaImportar.indexOf('decidirEscritura(')

    for (const [n, i] of Object.entries({ iCarga, iGate, iAdmitidos, iFirmada, iFrescura })) {
      expect(i, `no se encontró ${n} en la ruta`).toBeGreaterThan(-1)
    }
    expect(iCarga).toBeLessThan(iGate)
    expect(iGate).toBeLessThan(iAdmitidos)
    expect(iGate).toBeLessThan(iFirmada)
    expect(iGate).toBeLessThan(iFrescura)
    expect(rutaImportar).toContain('conteos.supresionesArcoVigentes++')
  })

  it('la bitácora del destino se lee TAMBIÉN en modo ensayo', () => {
    /**
     * Un ensayo que no aplicara la compuerta prometería que el expediente
     * cancelado vuelve. Y quien lea esa promesa pulsará el botón.
     */
    const iCarga = rutaImportar.indexOf("where('evento', '==', 'paciente_borrado')")
    const iRamaSimular = rutaImportar.indexOf('let consultorioVacio')
    expect(iCarga).toBeLessThan(iRamaSimular)
  })
})

describe('R-09 · 6 · el ensayo predice la negativa y no escribe nada', () => {
  it('el ensayo dice exactamente qué se va a detener, sin tocar la base', async () => {
    const { docs, ndjson } = await respaldoLimpio()
    const r = await correrEnsayo(ndjson, {
      clinicIdDestino: CLINICA, destino: DESTINO_VACIO, bitacoraDelDestino: [supresionDe(P1)],
    })

    const esperados = docs.filter(d => esDe(d, P1)).map(d => d._ruta).sort()
    expect(r.supresionArco.map(s => s.ruta).sort()).toEqual(esperados)
    // Ni una de esas rutas se cuenta como escrita ni como ya presente.
    expect(r.conteos.escritos + r.conteos.yaEstaban).toBe(docs.length - esperados.length)
    expect(ensayoImpecable(r)).toBe(false)
  })

  it('el módulo del ensayo no sabe escribir en ninguna parte', () => {
    for (const m of ['supresion-arco', 'verificacion-recuperacion']) {
      const src = leer('src', 'lib', 'durability', `${m}.ts`)
      expect(src, `${m} importa firebase`).not.toMatch(/firebase/)
      expect(src, `${m} usa fetch`).not.toMatch(/\bfetch\(/)
      expect(src, `${m} lee disco`).not.toMatch(/from 'node:fs'/)
    }
  })
})

describe('R-09 · 7 · un borrado que NO es una supresión ARCO no dispone de nada', () => {
  it('las tres condiciones son necesarias, y lo descartado se declara', () => {
    const eventos: AsientoDeBitacora[] = [
      { evento: 'paciente_borrado', patientId: P0 },                                       // sin `meta`
      { evento: 'paciente_borrado', patientId: P0, meta: { accion: 'borrado_manual' } },   // otra acción
      { evento: 'paciente_borrado', meta: { accion: 'supresion_arco' } },                  // sin `patientId`
      { evento: 'paciente_borrado', patientId: '   ', meta: { accion: 'supresion_arco' } },// vacío
      { evento: 'arco_solicitud_resuelta', patientId: P0, meta: { accion: 'bloqueo' } },   // BLOQUEO: no suprime
      { evento: 'expediente_lectura', patientId: P0 },
      null as unknown as AsientoDeBitacora,
    ]
    const s = derivarSupresiones(eventos)

    expect(s.pacientes.size).toBe(0)
    expect(s.descartados).toHaveLength(eventos.length)
    expect(s.descartados.map(d => d.porQue).join(' ')).toMatch(/bloqueo|no suprime|borrado ordinario/i)
    expect(esSupresionArco(eventos[0])).toBe(false)
    expect(esSupresionArco(supresionDe(P0))).toBe(true)
  })

  it('y con esa bitácora la restauración sale COMPLETA, sin disposición falsa', async () => {
    const { docs, ndjson } = await respaldoLimpio()
    const r = await correrEnsayo(ndjson, {
      clinicIdDestino: CLINICA,
      destino: DESTINO_VACIO,
      bitacoraDelDestino: [
        { evento: 'paciente_borrado', patientId: P0, meta: { accion: 'borrado_manual' } },
        { evento: 'arco_solicitud_resuelta', patientId: P1, meta: { accion: 'bloqueo' } },
      ],
    })
    expect(r.supresionArco).toEqual([])
    expect(r.conteos.supresionesArcoVigentes).toBe(0)
    expect(r.conteos.escritos).toBe(docs.length)
    expect(r.dictamen.veredicto).toBe('COMPLETA')
  })

  it('el BLOQUEO conserva el expediente a propósito: confundirlo perdería datos', () => {
    /**
     * La otra rama de la cancelación —hay nota firmada, la ley obliga a
     * conservar— no borra nada. Tratarla como supresión dejaría de restaurar
     * expedientes que SÍ deben volver, que es la otra forma de perder datos
     * clínicos.
     */
    const s = derivarSupresiones([{ evento: 'paciente_borrado', patientId: P0, meta: { accion: 'bloqueo' } }])
    expect(s.pacientes.has(P0)).toBe(false)
    expect(evaluarSupresion(`clinics/${CLINICA}/patients/${P0}`, 'patients', {}, s).admite).toBe(true)
  })
})

describe('R-09 · 8 · el asiento de la supresión no se toca', () => {
  it('el propio asiento se restaura: es la prueba de que el derecho se atendió', () => {
    const s = derivarSupresiones([supresionDe(P0)])
    const v = evaluarSupresion(`clinics/${CLINICA}/audit_log/aud-1`, 'audit_log', supresionDe(P0), s)
    expect(v.admite).toBe(true)
  })

  it('pero cualquier OTRO asiento del expediente suprimido sí se detiene', () => {
    const s = derivarSupresiones([supresionDe(P0)])
    const v = evaluarSupresion(
      `clinics/${CLINICA}/audit_log/aud-2`, 'audit_log', { evento: 'expediente_lectura', patientId: P0 }, s,
    )
    expect(v.admite).toBe(false)
    expect(v).toMatchObject({ motivo: MOTIVO_VIGENTE })
  })

  it('derivar no muta la bitácora que recibe', () => {
    const eventos = [supresionDe(P0), { evento: 'paciente_borrado', patientId: P1 }]
    const antes = JSON.stringify(eventos)
    derivarSupresiones(eventos)
    expect(JSON.stringify(eventos)).toBe(antes)
  })

  it('el módulo no exporta nada que borre, escriba o reactive', () => {
    // La ausencia ES el control: una función de reactivación acaba conectada a
    // un botón, y esa decisión es legal, no técnica.
    const src = leer('src', 'lib', 'durability', 'supresion-arco.ts')
    expect(src).not.toMatch(/export (async )?function (borrar|eliminar|reactivar|restaurarPaciente|suprimir)/)
    expect(POR_QUE_NO_SE_DECIDE_LA_REACTIVACION).toMatch(/NEEDS_LEGAL_REVIEW/)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// R-13 · detectar la pérdida clínica después de recuperar
// ═════════════════════════════════════════════════════════════════════════════

describe('R-13 · 1 · lo que no volvió: nota firmada y adenda', () => {
  it('una nota FIRMADA que no volvió es un defecto P0 y la recuperación NO es limpia', async () => {
    const { docs, ndjson } = await respaldoLimpio()
    const base = await fotoDeLineas(docs)
    // `adenda-sin-nota` quita la nota firmada padre del archivo.
    const { ndjson: roto } = inyectar(ndjson, 'adenda-sin-nota')
    const r = await correrEnsayo(roto, { clinicIdDestino: CLINICA, destino: DESTINO_VACIO, base })

    const v = r.verificacion!
    expect(v.veredicto).toBe('NO_LIMPIA')
    const falta = v.incidente!.defectos.find(d => d.clase === 'FALTA')
    expect(falta, 'la nota firmada ausente no produjo defecto').toBeDefined()
    expect(falta!.severidad).toBe('P0')
    expect(falta!.rutas.some(x => x.includes('/notas/'))).toBe(true)
    expect(v.severidadMaxima).toBe('P0')
    expect(ensayoImpecable(r)).toBe(false)
  })

  it('una ADENDA que no volvió también es P0: es la única corrección sobre lo firmado', async () => {
    const docs = await generarConsultorio(PEQUEÑO)
    const base = await fotoDeLineas(docs)
    const adenda = docs.find(d => d._coleccion === 'patients.notas.adendas')!
    const ndjson = await aRespaldoNdjson(docs.filter(d => d._ruta !== adenda._ruta), CLINICA, CUANDO)
    const r = await correrEnsayo(ndjson, { clinicIdDestino: CLINICA, destino: DESTINO_VACIO, base })

    const falta = r.verificacion!.incidente!.defectos.find(d => d.clase === 'FALTA')!
    expect(falta.severidad).toBe('P0')
    expect(falta.rutas).toContain(adenda._ruta)
  })
})

describe('R-13 · 2 · la recuperación que retrocede un documento', () => {
  it('escribir una versión ANTERIOR sobre una posterior sale como RANCIO', async () => {
    const docs = await generarConsultorio(PEQUEÑO)
    const borrador = docs.find(d => d._coleccion === 'patients.notas' && d.estado === 'borrador')!
    /**
     * La línea base —lo que había justo antes del incidente— tiene el borrador
     * de junio. El respaldo es de enero. Restaurarlo en un consultorio vacío
     * escribe enero encima de junio: no es una pérdida del incidente, la causó
     * la recuperación.
     */
    const base = await fotoDeLineas(
      docs.map(d => (d._ruta === borrador._ruta ? { ...d, updatedAt: '2026-06-01T00:00:00.000Z' } : d)),
    )
    const ndjson = await aRespaldoNdjson(docs, CLINICA, CUANDO)
    const r = await correrEnsayo(ndjson, { clinicIdDestino: CLINICA, destino: DESTINO_VACIO, base })

    const v = r.verificacion!
    expect(v.porClase.RANCIO).toBeGreaterThan(0)
    expect(v.veredicto).toBe('NO_LIMPIA')
    const rancio = v.incidente!.defectos.find(d => d.clase === 'RANCIO')!
    expect(rancio.rutas).toContain(borrador._ruta)
    expect(v.incidente!.queHacer.join(' ')).toMatch(/retrocedió/)
  })
})

describe('R-13 · 3 · duplicado de identidad clínica', () => {
  it('dos documentos con identidades distintas y el mismo contenido tumban el veredicto', async () => {
    /**
     * ── POR QUÉ ESTE CASO NECESITABA SU PROPIO DETECTOR ─────────────────────
     *
     * Aquí el duplicado está en la línea base Y en el resultado, así que la
     * conciliación sale LIMPIA: no falta nada, no sobra nada, nada difiere.
     * El total cuadra, la comparación identidad por identidad cuadra, y la
     * agenda tiene la misma cita dos veces. Es el modo en que un reintento
     * duplica una cita, y era invisible.
     */
    const docs = await generarConsultorio(PEQUEÑO)
    const cita = docs.find(d => d._coleccion === 'appointments')!
    const conDuplicado = [...docs, { ...cita, _ruta: `${cita._ruta}-reintento` }]
    const base = await fotoDeLineas(conDuplicado)
    const ndjson = await aRespaldoNdjson(conDuplicado, CLINICA, CUANDO)
    const r = await correrEnsayo(ndjson, { clinicIdDestino: CLINICA, destino: DESTINO_VACIO, base })

    expect(r.reconciliacion!.limpia, 'la conciliación sí veía el duplicado').toBe(true)
    expect(r.verificacion!.veredicto).toBe('NO_LIMPIA')
    const dup = r.verificacion!.incidente!.defectos.find(d => d.clase === 'DUPLICADO_DE_IDENTIDAD')!
    expect(dup.cuantos).toBe(2)
    expect(dup.rutas).toContain(`${cita._ruta}-reintento`)
    expect(dup.huellas.length).toBe(1)
    expect(ensayoImpecable(r), 'un duplicado de cita pasaba por impecable').toBe(false)
  })

  it('AL REVÉS: sin el duplicado, el mismo consultorio sale LIMPIA e impecable', async () => {
    const { docs, ndjson } = await respaldoLimpio()
    const base = await fotoDeLineas(docs)
    const r = await correrEnsayo(ndjson, { clinicIdDestino: CLINICA, destino: DESTINO_VACIO, base })

    expect(r.verificacion!.veredicto).toBe('LIMPIA')
    expect(r.verificacion!.incidente).toBeNull()
    expect(r.verificacion!.severidadMaxima).toBeNull()
    expect(ensayoImpecable(r)).toBe(true)
  })
})

describe('R-13 · 4 · referencia a otro consultorio', () => {
  it('un documento con referencias forasteras es un defecto P0 de la recuperación', async () => {
    const { docs, ndjson } = await respaldoLimpio()
    const base = await fotoDeLineas(docs)
    const { ndjson: roto } = inyectar(ndjson, 'referencia-interna-forastera')
    const r = await correrEnsayo(roto, { clinicIdDestino: CLINICA, destino: DESTINO_VACIO, base })

    const v = r.verificacion!
    expect(v.porClase.FORASTERO).toBeGreaterThan(0)
    const forastero = v.incidente!.defectos.find(d => d.clase === 'FORASTERO')!
    expect(forastero.severidad).toBe('P0')
    expect(v.severidadMaxima).toBe('P0')
    expect(v.incidente!.queHacer.join(' ')).toMatch(/otro consultorio/)
  })
})

describe('R-13 · 5 · el recuento que cuadra y el expediente que está roto', () => {
  it('un documento de menos y uno de más: el total cuadra y la recuperación NO es limpia', async () => {
    const { docs, ndjson } = await respaldoLimpio()
    const base = await fotoDeLineas(docs)
    const conMenos = inyectar(ndjson, 'documento-ausente').ndjson
    const conMenosYMas = inyectar(conMenos, 'documento-duplicado').ndjson
    const r = await correrEnsayo(conMenosYMas, { clinicIdDestino: CLINICA, destino: DESTINO_VACIO, base })

    const v = r.verificacion!
    expect(v.conteosCuadran).toBe(true)          // el TOTAL cuadra
    expect(v.veredicto).toBe('NO_LIMPIA')        // y aun así está roto
    expect(v.porClase.FALTA).toBeGreaterThan(0)
    expect(v.porClase.SOBRA).toBeGreaterThan(0)
    expect(v.incidente!.queHacer.join(' ')).toMatch(/CUADRA/)
    expect(v.porQueLosConteosNoBastan).toMatch(/identidad por identidad/)
  })

  it('un total que cuadra no es, por sí solo, prueba de nada', () => {
    // La afirmación vive en el código, no sólo en un documento que nadie abre.
    const rec = reconciliar(
      [{ ruta: 'clinics/a/appointments/c1', huella: 'H1', coleccion: 'appointments', fecha: null, esInmutable: false }],
      [{ ruta: 'clinics/a/appointments/c2', huella: 'H1', coleccion: 'appointments', fecha: null, esInmutable: false }],
    )
    const v = verificarRecuperacion(rec, [], { clinicId: 'a', trabajoId: 't' })
    expect(rec.base).toBe(rec.despues)
    expect(v.conteosCuadran).toBe(true)
    expect(v.limpia).toBe(false)
  })
})

describe('R-13 · 6 · el aviso se puede reenviar: no lleva PHI', () => {
  it('el resumen sólo lleva identidad opaca, clase, severidad, recuentos, huellas y rutas', async () => {
    const { docs, ndjson } = await respaldoLimpio()
    const base = await fotoDeLineas(docs)
    const conMenos = inyectar(ndjson, 'documento-ausente').ndjson
    const r = await correrEnsayo(inyectar(conMenos, 'documento-duplicado').ndjson, {
      clinicIdDestino: CLINICA, destino: DESTINO_VACIO, base, trabajoId: 'trabajo-opaco-1',
    })

    const texto = JSON.stringify(r.verificacion!.incidente)
    expect(r.verificacion!.incidente!.clinicId).toBe(CLINICA)
    expect(r.verificacion!.incidente!.trabajoId).toBe('trabajo-opaco-1')
    expect(r.verificacion!.incidente!.phiSafe).toBe(true)

    // Nada del CONTENIDO de ningún documento del fixture.
    for (const trozo of [
      'Consulta sintética', 'transcripción', 'Fármaco-', 'Diagnóstico sintético',
      'Aclaración sintética', 'Estudio sintético', 'Imagen sintética', 'CED-SINTETICA',
    ]) {
      expect(texto, `el aviso llevaba «${trozo}»`).not.toContain(trozo)
    }
    for (const p of docs.filter(d => d._coleccion === 'patients')) {
      expect(texto, 'el aviso llevaba el nombre de un paciente').not.toContain(String(p.nombre))
    }
  })

  it('el texto de cada clase es FIJO: no se interpola ni un campo del documento', () => {
    const src = leer('src', 'lib', 'durability', 'verificacion-recuperacion.ts')
    for (const [clase, frase] of Object.entries(QUE_SIGNIFICA)) {
      expect(frase.length, clase).toBeGreaterThan(40)
      expect(src, `${clase} se construye con plantilla`).toContain(frase)
    }
  })

  it('un recorte de rutas NUNCA es silencioso', async () => {
    // Un tope que no se declara se lee como «eso es todo lo que había».
    const base = Array.from({ length: TOPE_DE_RUTAS + 7 }, (_, i) => ({
      ruta: `clinics/a/appointments/c${i}`, huella: `H${i}`,
      coleccion: 'appointments', fecha: null, esInmutable: false,
    }))
    const v = verificarRecuperacion(reconciliar(base, []), [], { clinicId: 'a', trabajoId: 't' })
    const falta = v.incidente!.defectos.find(d => d.clase === 'FALTA')!
    expect(falta.cuantos).toBe(TOPE_DE_RUTAS + 7)
    expect(falta.rutas).toHaveLength(TOPE_DE_RUTAS)
    expect(falta.rutasOmitidas).toBe(7)
  })
})

describe('R-13 · 7 · detectar no es reparar, y hay UN solo reconciliador', () => {
  it('la verificación no muta la conciliación que recibe', () => {
    const rec = reconciliar(
      [{ ruta: 'clinics/a/patients/p1', huella: 'A', coleccion: 'patients', fecha: null, esInmutable: false }],
      [],
    )
    const antes = JSON.stringify(rec)
    verificarRecuperacion(rec, [], { clinicId: 'a', trabajoId: 't' })
    expect(JSON.stringify(rec)).toBe(antes)
  })

  it('el módulo no exporta nada que escriba, borre o elija entre duplicados', () => {
    const src = leer('src', 'lib', 'durability', 'verificacion-recuperacion.ts')
    expect(src).not.toMatch(/export (async )?function (reparar|arreglar|borrar|escribir|corregir|deduplicar|resolver)/)
    expect(NO_SE_REPARA).toMatch(/DETECTA/)
    expect(NO_SE_REPARA).toMatch(/decide una persona/)
  })

  it('nadie más implementa una conciliación: `reconciliacion.ts` es la única', () => {
    /**
     * Dos reconciliadores son dos opiniones sobre si un expediente volvió
     * entero, y la que se consulte el día malo será la que esté conectada, no
     * la que esté bien.
     */
    for (const f of readdirSync(DIR_DURABILIDAD).filter(x => x.endsWith('.ts') && x !== 'reconciliacion.ts')) {
      expect(leer('src', 'lib', 'durability', f), `${f} declara su propio reconciliador`)
        .not.toMatch(/export function reconciliar\b/)
    }
    expect(leer('src', 'lib', 'durability', 'verificacion-recuperacion.ts'))
      .toContain("from '@/lib/durability/reconciliacion'")
  })

  it('el ensayo verifica sobre la conciliación canónica, no sobre otra cosa', () => {
    // «Escrito y sin conectar», otra vez: el veredicto tiene que salir de la
    // conciliación que de verdad se calculó.
    expect(leer('src', 'lib', 'durability', 'ensayo.ts')).toContain('verificarRecuperacion(reconciliacion,')
  })

  it('sin línea base no se finge un veredicto limpio', async () => {
    // No hay dos fotografías: no hay nada que verificar, y decirlo es más
    // honesto que devolver «limpia».
    const { ndjson } = await respaldoLimpio()
    const r = await correrEnsayo(ndjson, { clinicIdDestino: CLINICA, destino: DESTINO_VACIO })
    expect(r.reconciliacion).toBeNull()
    expect(r.verificacion).toBeNull()
  })
})
