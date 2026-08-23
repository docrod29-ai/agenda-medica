/**
 * POST /api/clinic/importar?clinicId=…[&simular=1][&sobrescribir=1]
 *
 * EL CAMINO DE VUELTA. Cuerpo: el NDJSON tal cual salió de `clinic/exportar`.
 *
 * ── POR QUÉ EXISTE ───────────────────────────────────────────────────────────
 *
 * v947 dejó el respaldo bien: servidor, NDJSON, paginado, con cabecera y pie.
 * Pero **no había importador**, y un respaldo que no se puede volver a meter no
 * es un respaldo: es un archivo del que nadie sabe si sirve.
 *
 * «Tenemos respaldos» sin una restauración probada es una hipótesis. El propio
 * `scripts/respaldos-verificar.mjs` termina diciéndolo: «falta una cosa que esto
 * no puede comprobar: haber RESTAURADO alguna vez».
 *
 * ── LOS CANDADOS ─────────────────────────────────────────────────────────────
 *
 *  · **Sólo a consultorio vacío**, salvo que se pida `sobrescribir` a propósito.
 *    Restaurar encima de datos mezcla dos historias clínicas sin que nadie pueda
 *    distinguirlas después.
 *  · **Modo ensayo** (`simular=1`): dice qué escribiría, sin escribir nada.
 *  · **Las llaves de API no entran nunca**, aunque el archivo las traiga.
 *  · **Una línea rota no aborta la restauración**: se rechaza con su razón y
 *    aparece en el informe.
 *
 * ── LOS CANDADOS QUE FALTABAN (#312) ─────────────────────────────────────────
 *
 * Este módulo escribe con el **SDK admin**, que **ignora las reglas de
 * Firestore**. La regla que hace inmutable una nota firmada (NOM-024) no se
 * evalúa por este camino: ni una vez. Así que ésta es, por construcción, la
 * única puerta de la aplicación por la que se puede reescribir un documento
 * medicolegal — y la cruzaba con `set(ref, datos, { merge: true })`, que es
 * peor que una sobrescritura limpia porque deja una MEZCLA de dos versiones
 * que nunca existió.
 *
 *  0. **Supresión ARCO vigente.** Un respaldo anterior a una cancelación
 *     ejercida por un paciente resucita su expediente entero. Se cruza contra
 *     los asientos `paciente_borrado` + `meta.accion: 'supresion_arco'` del
 *     destino, en la ADMISIÓN, y `sobrescribir=1` no lo salta.
 *  1. **Procedencia.** La cabecera dice de qué consultorio es el archivo. Una
 *     línea cuya ruta venga de otro se re-enraizaría igual y aterrizaría aquí
 *     como si fuera nuestra. Se detiene.
 *  2. **Aislamiento por dentro.** Re-enraizar la RUTA no reescribe el
 *     CONTENIDO: un documento puede quedar guardado aquí declarando pertenecer
 *     al consultorio de origen. Se detiene.
 *  3. **Verdad firmada.** Si el destino ya tiene la nota firmada y difiere, no
 *     se escribe: lo decide una persona.
 *  4. **Frescura.** Un respaldo de ayer sobre un consultorio que lleva
 *     trabajando media mañana NO pisa lo de la mañana.
 *
 * Y el resultado deja de ser `ok: true`: es COMPLETA, PARCIAL,
 * REVISION_HUMANA o FALLIDA. Ver `src/lib/durability/veredicto.ts`.
 */
import { NextRequest, NextResponse } from 'next/server'
import { safeLog } from '@/lib/security/sanitize'
import { adminDb } from '@/lib/firebase-admin'
import { verificarCapacidad } from '@/lib/authz/verificar'
import { COLECCIONES, rutasDelArbol } from '@/lib/clinica/respaldo'
import { leerLinea, reenraizar, admitir, type InformeRestauracion } from '@/lib/clinica/restaurar'
import { evaluarCompletitud, type ObservadoAlReleer } from '@/lib/durability/manifiesto'
import { huellaDeEntrada, huellaDeDocumento, acumuladorDeConjunto, huellaDelArchivo, huellaDeTrabajo } from '@/lib/durability/huellas'
import { referenciasForasteras, evaluarAislamiento } from '@/lib/durability/aislamiento'
import { compararNotaFirmada, estaFirmada } from '@/lib/durability/verdad-firmada'
import { derivarSupresiones, evaluarSupresion } from '@/lib/durability/supresion-arco'
import { decidirEscritura } from '@/lib/durability/idempotencia'
import { esColeccionInmutable, fechaDelDocumento } from '@/lib/durability/ensayo'
import { dictaminar, CONTEOS_EN_CERO, type ConteosDeRestauracion } from '@/lib/durability/veredicto'
import { generarHashIntegridad } from '@/lib/expediente/integrity'
import type { NotaMedica } from '@/types/expediente'

export const maxDuration = 300

/** Documentos por lote. Firestore admite 500; se deja margen. */
const LOTE = 400
/** Tope de líneas rechazadas que se detallan. El resto sólo se cuenta. */
const TOPE_RECHAZADAS = 50
/** Tope de documentos detenidos que se detallan. El resto sólo se cuenta. */
const TOPE_DETENIDOS = 50

interface Detenido {
  ruta: string
  motivo: string
  porQue: string
}

export async function POST(req: NextRequest) {
  const clinicId = req.nextUrl.searchParams.get('clinicId')
  if (!clinicId) return NextResponse.json({ ok: false, error: 'clinicId requerido' }, { status: 400 })
  const simular = req.nextUrl.searchParams.get('simular') === '1'
  const sobrescribir = req.nextUrl.searchParams.get('sobrescribir') === '1'

  /**
   * `administrar`: esto reescribe el consultorio entero. Es la operación más
   * destructiva de la aplicación después de la supresión ARCO.
   */
  const acc = await verificarCapacidad(req, clinicId, 'administrar')
  if (!acc.ok) return acc.response

  const clinicRef = adminDb.collection('clinics').doc(clinicId)

  try {
    /**
     * ── CANDADO 0 — LAS SUPRESIONES ARCO DEL DESTINO (#312 · R-09) ──────────
     *
     * Se leen ANTES que nada: antes de mirar si el consultorio está vacío,
     * antes de leer el archivo y antes de admitir una sola línea. Y se leen
     * igual en modo ensayo, porque un ensayo que no aplique esta compuerta
     * prometería que un expediente cancelado vuelve — y quien lea esa promesa
     * pulsará el botón.
     *
     * `sobrescribir=1` NO aparece en esta consulta ni en la compuerta que la
     * consume: es permiso para pisar datos propios del consultorio, no para
     * deshacer el derecho de un tercero. Ver
     * `POR_QUE_SOBRESCRIBIR_NO_LO_SALTA`.
     */
    const asientosDeBorrado = await clinicRef.collection('audit_log')
      .where('evento', '==', 'paciente_borrado').get()
    const supresiones = derivarSupresiones(asientosDeBorrado.docs.map(d => d.data() as Record<string, unknown>))

    /**
     * ¿ESTÁ VACÍO?
     *
     * Basta con encontrar UN documento de cualquiera de las señales: no hace
     * falta contar. Se mira antes de leer el archivo, para no hacer esperar a
     * nadie por un rechazo.
     *
     * ── POR QUÉ YA NO BASTA CON PACIENTES Y CITAS (#312) ────────────────────
     *
     * Miraba sólo `patients` y `appointments`. Un consultorio con cobros, con
     * bitácora de accesos o con internamientos —pero sin pacientes, porque una
     * supresión ARCO se los llevó— pasaba por «vacío», y encima de eso se
     * restauraba un respaldo anterior a la supresión: el derecho ejercido por
     * el paciente se deshacía sin que nadie lo pidiera.
     */
    let consultorioVacio = true
    if (!simular) {
      /**
       * Las cinco señales van escritas UNA A UNA, no recorriendo una lista.
       *
       * No es estilo: el detector de rutas que leen identidad de paciente
       * (`authz-rutas-declaradas`) busca `collection('patients')` en el texto.
       * Recorriendo un arreglo, esta ruta —la que reescribe el consultorio
       * entero— dejaba de contar como lectora de PHI y el guardián pasaba en
       * verde sin ella. Es la CUARTA vez que un guardián textual se apaga solo
       * en este repositorio; escribirlas es más barato que volver a caer.
       */
      const señales = await Promise.all([
        clinicRef.collection('patients').limit(1).get(),
        clinicRef.collection('appointments').limit(1).get(),
        clinicRef.collection('cobros').limit(1).get(),
        clinicRef.collection('audit_log').limit(1).get(),
        clinicRef.collection('internamientos').limit(1).get(),
      ])
      const NOMBRES = ['patients', 'appointments', 'cobros', 'audit_log', 'internamientos']
      consultorioVacio = señales.every(s => s.empty)
      if (!sobrescribir && !consultorioVacio) {
        const cuales = NOMBRES.filter((_, i) => !señales[i].empty)
        return NextResponse.json({
          ok: false,
          veredicto: 'FALLIDA',
          error: `Este consultorio ya tiene datos (${cuales.join(', ')}). Restaurar encima mezclaría dos historias clínicas sin poder distinguirlas después. Usa un consultorio vacío, o pídelo con \`sobrescribir=1\` a sabiendas.`,
        }, { status: 409 })
      }
    }

    const texto = await req.text()
    if (!texto.trim()) {
      return NextResponse.json({ ok: false, veredicto: 'FALLIDA', error: 'El archivo llegó vacío' }, { status: 400 })
    }

    const informe: InformeRestauracion = {
      escritos: 0, porColeccion: {}, rechazadas: [],
      archivoCompleto: false, origen: null, reenraizado: false,
    }
    const conteos: ConteosDeRestauracion = { ...CONTEOS_EN_CERO }
    const detenidos: Detenido[] = []
    let detenidosTotal = 0
    let rechazadasTotal = 0

    const rechazar = (porQue: string, crudo: string) => {
      rechazadasTotal++
      if (informe.rechazadas.length < TOPE_RECHAZADAS) informe.rechazadas.push({ porQue, crudo })
    }
    const detener = (ruta: string, motivo: string, porQue: string) => {
      detenidosTotal++
      conteos.enRevisionHumana++
      if (detenidos.length < TOPE_DETENIDOS) detenidos.push({ ruta, motivo, porQue })
    }

    /**
     * Las colecciones que el manifiesto conoce; una desconocida no se escribe.
     *
     * ── REGRESIÓN PROPIA, v1037 → v1043 ───────────────────────────────────
     *
     * Esto recorría `c.hijas` interpolando cada elemento en una plantilla. Al
     * convertir `hijas` en un ÁRBOL —para que el respaldo se llevara también las
     * adendas y las versiones de cada nota— los elementos dejaron de ser cadenas
     * y pasaron a ser objetos, así que la plantilla producía
     * `patients.[object Object]`.
     *
     * Consecuencia: `patients.notas` ya no figuraba entre las conocidas y **toda
     * nota se rechazaba al restaurar** con «colección desconocida». El respaldo
     * se exportaba completo y no se podía volver a meter — que es justo el
     * momento en que un respaldo importa.
     *
     * `rutasDelArbol` aplana el árbol entero, así que las dos mitades quedan
     * atadas a la misma fuente y no pueden volver a separarse.
     */
    const conocidas = new Set<string>()
    for (const c of COLECCIONES) for (const r of rutasDelArbol(c)) conocidas.add(r)

    /**
     * ── PRIMERA PASADA: SE LEE EL ARCHIVO ENTERO ANTES DE ESCRIBIR NADA ─────
     *
     * Escribir mientras se lee dejaba medio consultorio dentro antes de
     * descubrir que el archivo estaba cortado, mezclado o alterado. El cuerpo
     * ya venía entero en memoria (`req.text()`), así que juzgarlo antes no
     * cuesta nada y cambia el orden de los hechos: primero se decide si el
     * archivo sirve, y sólo entonces se toca la base.
     */
    let cabecera: Record<string, unknown> | null = null
    let pie: Record<string, unknown> | null = null
    const admitidos: { ruta: string; rutaOriginal: string; coleccion: string; datos: Record<string, unknown> }[] = []
    const conteosObservados: Record<string, number> = {}
    const conjunto = acumuladorDeConjunto()
    let observados = 0

    for (const crudo of texto.split(String.fromCharCode(10))) {
      const l = leerLinea(crudo)
      if (!l) continue
      if (l.clase === 'rechazada') { rechazar(l.porQue, l.crudo); continue }
      if (l.clase === 'cabecera') {
        cabecera = l.datos
        informe.origen = typeof l.datos.clinicId === 'string' ? l.datos.clinicId : null
        informe.reenraizado = !!informe.origen && informe.origen !== clinicId
        continue
      }
      if (l.clase === 'pie') { pie = l.datos; informe.archivoCompleto = true; continue }

      observados++
      conteosObservados[l.coleccion] = (conteosObservados[l.coleccion] ?? 0) + 1
      conjunto.añadir(await huellaDeEntrada(l.ruta, l.datos))

      /**
       * `admitir` va PRIMERO. `secretos` no está entre las conocidas —está en
       * `EXCLUIDAS`— así que preguntando antes por las conocidas se rechazaba
       * con «colección desconocida»: fail-closed, sí, y con la razón
       * equivocada. Quien lea el informe tiene que ver que las llaves de API
       * quedaron fuera A PROPÓSITO, no que el archivo traía basura.
       */
      const v = admitir(l.coleccion)
      if (!v.escribir) { rechazar(v.porQue, l.ruta); conteos.excluidosPorPolitica++; continue }
      if (!conocidas.has(l.coleccion)) { rechazar(`colección desconocida: ${l.coleccion}`, l.ruta); continue }

      /**
       * CANDADO 1 — PROCEDENCIA. La cabecera dice de qué consultorio es este
       * archivo. Una línea que venga de otro se re-enraizaría igual y
       * aterrizaría aquí como si fuera nuestra: el archivo llevaría dos
       * historias clínicas y sólo se vería una.
       */
      const raizOriginal = l.ruta.split('/')[1]
      if (informe.origen && raizOriginal && raizOriginal !== informe.origen) {
        conteos.esperados++
        conteos.contaminacionEntreConsultorios++
        detener(l.ruta, 'procedencia-mezclada',
          `la cabecera declara el consultorio «${informe.origen}» y esta línea viene de «${raizOriginal}». El archivo lleva más de una historia clínica.`)
        continue
      }

      conteos.esperados++

      /**
       * CANDADO 0 (continuación) — LA SUPRESIÓN ARCO DECIDE LA ADMISIÓN.
       *
       * Aquí, en la primera pasada, y no junto a los otros candados: los tres
       * de abajo eligen entre versiones de un documento que SÍ puede volver.
       * Éste decide si el documento entra siquiera en la lista de admitidos —
       * así no llega a compararse con el destino, no se cuenta como escrito y
       * no puede colarse por ninguna rama posterior, tampoco por la de
       * restaurar encima de un consultorio con datos.
       */
      const arco = evaluarSupresion(l.ruta, l.coleccion, l.datos, supresiones)
      if (!arco.admite) {
        conteos.supresionesArcoVigentes++
        detener(l.ruta, arco.motivo, arco.porQue)
        continue
      }

      admitidos.push({
        ruta: reenraizar(l.ruta, clinicId), rutaOriginal: l.ruta,
        coleccion: l.coleccion, datos: l.datos,
      })
    }

    const observado: ObservadoAlReleer = {
      documentos: observados, conteos: conteosObservados, huella: conjunto.valor(),
    }
    const completitud = evaluarCompletitud(cabecera, pie, observado)

    if (completitud.estado === 'invalido') {
      return NextResponse.json({
        ok: false, veredicto: 'FALLIDA', simulado: simular,
        completitud, error: 'El archivo no es un respaldo legible de este producto: no se escribió nada.',
      }, { status: 400 })
    }

    /**
     * ── SEGUNDA PASADA: LOTE A LOTE, MIRANDO PRIMERO QUÉ HAY EN EL DESTINO ──
     *
     * Se leen los documentos del destino que corresponden al lote, de golpe
     * (`getAll`), y con eso se decide cada escritura. Sobre un consultorio
     * VACÍO esa lectura se salta entera: no hay nada con lo que comparar y
     * gastar N lecturas para confirmarlo sería caro y no cambiaría ninguna
     * decisión.
     */
    const hayQueMirarElDestino = simular ? false : (!consultorioVacio || sobrescribir)

    let lote = adminDb.batch()
    let enLote = 0
    const vaciar = async () => {
      if (enLote === 0) return
      if (!simular) await lote.commit()
      lote = adminDb.batch()
      enLote = 0
    }

    for (let i = 0; i < admitidos.length; i += LOTE) {
      const tanda = admitidos.slice(i, i + LOTE)
      let existentes: (Record<string, unknown> | null)[] = tanda.map(() => null)
      if (hayQueMirarElDestino) {
        const snaps = await adminDb.getAll(...tanda.map(t => adminDb.doc(t.ruta)))
        existentes = snaps.map(s => (s.exists ? (s.data() as Record<string, unknown>) : null))
      }

      for (let j = 0; j < tanda.length; j++) {
        const d = tanda[j]
        const enDestino = existentes[j]
        const inmutable = esColeccionInmutable(d.coleccion, d.datos)

        /**
         * CANDADO 2 — AISLAMIENTO POR DENTRO. `reenraizar` arregla la ruta y no
         * toca el contenido: el documento puede quedar guardado aquí
         * declarando pertenecer al consultorio de origen, y la siguiente
         * consulta que filtre por ese campo verá lo que no debe.
         */
        const hallazgos = referenciasForasteras(d.ruta, d.datos, clinicId)
        const ev = evaluarAislamiento(hallazgos, inmutable)
        if (ev.veredicto === 'contaminado' || ev.veredicto === 'revision-humana') {
          conteos.contaminacionEntreConsultorios++
          detener(d.ruta, 'referencia-a-otro-consultorio', ev.porQue)
          continue
        }

        /**
         * CANDADO 3 — VERDAD FIRMADA. El SDK admin no evalúa las reglas de
         * Firestore: si la restauración no se detiene aquí, no se detiene en
         * ninguna parte.
         */
        if (d.coleccion === 'patients.notas' && (estaFirmada(d.datos) || (enDestino && estaFirmada(enDestino)))) {
          const cmp = await compararNotaFirmada(
            d.datos, enDestino,
            (n, ver) => generarHashIntegridad(n as unknown as NotaMedica, ver as 2 | 3),
          )
          if (cmp.veredicto === 'revision-humana' || cmp.veredicto === 'archivo-alterado' || cmp.veredicto === 'sin-sello-no-juzgable') {
            conteos.verdadFirmadaEnConflicto++
            detener(d.ruta, `verdad-firmada:${cmp.veredicto}`, cmp.porQue)
            continue
          }
          if (cmp.veredicto === 'ya-esta') {
            conteos.yaEstaban++
            informe.porColeccion[d.coleccion] = (informe.porColeccion[d.coleccion] ?? 0) + 1
            continue
          }
        }

        /**
         * CANDADO 4 — FRESCURA E IDEMPOTENCIA. Un respaldo de ayer sobre un
         * consultorio que lleva media mañana trabajando no pisa la mañana; y
         * un documento que ya está idéntico no se vuelve a escribir, que es lo
         * que hace inocuo el reintento tras un tiempo de espera agotado.
         */
        const decision = decidirEscritura({
          huellaDelArchivo: await huellaDeDocumento(d.datos),
          huellaDelDestino: enDestino ? await huellaDeDocumento(enDestino) : null,
          esInmutable: inmutable,
          fechaDelArchivo: fechaDelDocumento(d.datos),
          fechaDelDestino: enDestino ? fechaDelDocumento(enDestino) : null,
        })

        if (decision.decision === 'omitir-identico') {
          conteos.yaEstaban++
          informe.porColeccion[d.coleccion] = (informe.porColeccion[d.coleccion] ?? 0) + 1
          continue
        }
        if (decision.decision === 'revision-humana' || decision.decision === 'no-pisar-lo-mas-nuevo') {
          detener(d.ruta, decision.decision, decision.porQue)
          continue
        }

        if (!simular) lote.set(adminDb.doc(d.ruta), d.datos, { merge: true })
        informe.escritos++
        conteos.escritos++
        informe.porColeccion[d.coleccion] = (informe.porColeccion[d.coleccion] ?? 0) + 1
        enLote++
        if (enLote >= LOTE) await vaciar()
      }
      await vaciar()
    }
    await vaciar()

    conteos.rechazadas = rechazadasTotal
    const dictamen = dictaminar(conteos, informe.archivoCompleto, completitud.estado)

    /**
     * La identidad del trabajo viaja en la respuesta para que un reintento se
     * pueda reconocer desde fuera. NO se persiste: guardarla exigiría una
     * colección nueva bajo `clinics/{id}`, y toda colección nueva se declara en
     * `firestore.rules`, en la matriz de acceso y en el manifiesto del
     * respaldo — y publicar reglas necesita autorización del dueño. Mientras
     * tanto, la idempotencia se sostiene en la comparación de contenido, que no
     * necesita estado: un documento idéntico no se reescribe.
     */
    const huellaArchivo = await huellaDelArchivo(texto)
    const trabajoId = await huellaDeTrabajo(informe.origen ?? '', clinicId, huellaArchivo)

    if (!simular) {
      void clinicRef.collection('audit_log').add({
        evento: 'export_datos', clinicId,
        medicoUid: acc.uid, medicoEmail: acc.email ?? '',
        meta: {
          accion: 'restauracion', origen: informe.origen ?? '',
          trabajoId, veredicto: dictamen.veredicto,
          escritos: informe.escritos, yaEstaban: conteos.yaEstaban,
          detenidos: detenidosTotal, rechazadas: rechazadasTotal,
          supresionesArco: conteos.supresionesArcoVigentes,
          archivoCompleto: informe.archivoCompleto,
          completitud: completitud.estado,
        },
        timestamp: new Date().toISOString(),
      }).catch(() => { /* la bitácora no puede tumbar una restauración ya aplicada */ })
    }

    /**
     * ── `ok: true` YA NO SIGNIFICA «SALIÓ BIEN» ────────────────────────────
     *
     * Significa «la petición se procesó». Lo que salió es el VEREDICTO, y
     * viene primero en el objeto porque es lo único que hay que leer cuando se
     * está esperando de pie a que termine.
     */
    return NextResponse.json({
      ok: dictamen.veredicto !== 'FALLIDA',
      veredicto: dictamen.veredicto,
      porQue: dictamen.porQue,
      antesDeUsarlo: dictamen.antesDeUsarlo,
      trabajoId,
      simulado: simular,
      completitud,
      ...informe,
      conteos,
      detenidos,
      detenidosTotal,
      rechazadasTotal,
      /**
       * Lo que la compuerta ARCO vio, sin nombres: cuántos expedientes tienen
       * supresión vigente, cuántos documentos se detuvieron por ello, y qué
       * asientos de borrado se descartaron por NO ser una supresión ARCO. Lo
       * último importa tanto como lo primero: un borrado ordinario no puede
       * producir una disposición sobre el expediente de nadie, y la única forma
       * de comprobar que no la produjo es poder leer por qué se descartó.
       */
      supresionArco: {
        expedientesSuprimidos: supresiones.pacientes.size,
        documentosDetenidos: conteos.supresionesArcoVigentes,
        asientosDescartados: supresiones.descartados,
      },
      /**
       * Los objetos de Cloud Storage NO viajan en el respaldo: se dice aquí,
       * en el mismo sitio donde alguien lee cuántos documentos volvieron, y no
       * en un documento que nadie abrirá el día del incidente.
       */
      noVuelve: [
        'Las IMÁGENES de la fotografía clínica, el membrete y la firma. El respaldo lleva su ficha y su enlace, nunca los bytes: viven en Cloud Storage.',
        'El audio de las consultas, que es efímero por diseño. Lo que sí vuelve, dentro de cada nota, es la transcripción del motor y la de trabajo.',
        'Las cuentas de acceso: los identificadores de médico de las notas apuntan a cuentas que hay que volver a dar de alta.',
      ],
      aviso: informe.archivoCompleto ? null
        : 'El archivo no traía la línea de cierre: puede estar cortado. Lo escrito sirve, pero NO lo des por completo.',
    })
  } catch (e) {
    safeLog.error('[clinic/importar]', e)
    return NextResponse.json({ ok: false, veredicto: 'FALLIDA', error: 'No se pudo restaurar el respaldo' }, { status: 500 })
  }
}
