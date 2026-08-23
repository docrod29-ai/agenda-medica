/**
 * GOLDEN — REINTENTAR NO DUPLICA, Y LA DUDA NO SE FUNDE SOLA.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * El importador anterior (`migracion/page.tsx`, función `importar`) era un bucle
 * en el NAVEGADOR llamando `createPatient` fila a fila. `createPatient` hace
 * `addDoc`, que genera un id nuevo en cada llamada. Consecuencias, todas reales:
 *
 *  · Volver a pulsar «Importar» creaba el padrón entero otra vez.
 *  · Cerrar la pestaña a mitad dejaba media importación y ningún registro de por
 *    dónde iba: la única forma de continuar era volver a subir el archivo, y eso
 *    duplicaba lo ya escrito.
 *  · Un tiempo de espera agotado DESPUÉS de que la escritura entrara se veía
 *    como un fallo, se reintentaba, y quedaban dos.
 *
 * Y en la otra dirección: `clasificarFilas` marcaba «duplicado» y esas filas
 * simplemente NO SE IMPORTABAN. El informe decía «12 duplicados» con cara de
 * trabajo bien hecho — cuando lo que había pasado es que doce personas se
 * quedaron fuera del expediente sin que nadie las mirara.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Buscando la llave de idempotencia del importador. No había ninguna: ni un
 * `importJobId`, ni una huella de fila, ni un id determinista. La única
 * identidad era la que Firestore inventaba en cada `addDoc`.
 *
 * ── LA CAUSA RAÍZ ────────────────────────────────────────────────────────────
 *
 * La identidad del documento la ponía la BASE, no el CONTENIDO. Mientras el id
 * lo genere el destino, no hay forma de que dos escrituras del mismo dato caigan
 * en el mismo sitio, y por tanto no hay reintento seguro posible.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 *  · La llave es `importJobId + huella-del-contenido`, se usa como ID DE
 *    DOCUMENTO, y la escritura es `set`, no `add`. Repetir es sobrescribir con
 *    lo mismo.
 *  · `LIKELY_MATCH` y `AMBIGUOUS` **nunca** se funden solos: fundir a dos
 *    personas distintas no lo encuentra ningún barrido después.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 *
 *  · No prueba Firestore. Prueba que las LLAVES son estables y que el punto de
 *    control se comporta; que `set(id)` sea idempotente es una propiedad de
 *    Firestore, no de este código. La prueba contra el emulador está en el
 *    HANDOFF.
 *  · No prueba dos trabajadores escribiendo a la vez de verdad: prueba la
 *    política del arrendamiento, que es lo que decide quién puede.
 */
import { describe, it, expect } from 'vitest'
import {
  huellaDeFila, llaveIdempotente, idDeTrabajo, idDeLote,
  primeraAparicion, colisionesDeIdOrigen, huellaDeArchivo, serializarEstable,
} from '@/lib/migration/huella'
import {
  planificar, confirmarLote, nuevoPuntoDeControl, lotesPendientes, siguienteLote,
  trabajoTerminado, puedeEscribirLote, tomarRelevo, progreso, esperaMs,
  cuentaDeLotes, alCancelar, FILAS_POR_LOTE,
} from '@/lib/migration/lotes'
import { emparejar, IndicePacientes, puedeCrearse, requiereRevision } from '@/lib/migration/emparejamiento'
import { ensayar } from '@/lib/migration/ensayo'
import { ADAPTADOR_CSV } from '@/lib/migration/adaptadores'
import type { PacienteComparable } from '@/lib/pacientes/duplicados'

const HOY = '2026-08-23'
const O = { clinicId: 'c1', hoy: HOY }

/* ═══════════════ 7. REINTENTAR NO DUPLICA ═══════════════ */

describe('idempotencia', () => {
  it('la misma fila da la MISMA huella aunque cambien espacios y mayúsculas alrededor', async () => {
    const a = await huellaDeFila({ nombre: 'Ana Ruiz', telefono: '6641234567' })
    const b = await huellaDeFila({ telefono: '6641234567', nombre: 'Ana Ruiz' })
    // Orden de claves distinto, misma fila: si esto fallara, el mismo paciente
    // entraría dos veces sólo por cómo se construyó el objeto.
    expect(a).toBe(b)
  })

  it('un campo vacío y un campo ausente son la misma fila', async () => {
    const a = await huellaDeFila({ nombre: 'Ana Ruiz', email: '' })
    const b = await huellaDeFila({ nombre: 'Ana Ruiz' })
    expect(a).toBe(b)
  })

  it('AL REVÉS: dos personas distintas NO comparten huella', async () => {
    const a = await huellaDeFila({ nombre: 'Ana Ruiz', telefono: '6641234567' })
    const b = await huellaDeFila({ nombre: 'Ana Ruiz', telefono: '6641234568' })
    expect(a).not.toBe(b)
  })

  it('la serialización no confunde dos filas por concatenación', () => {
    // «ab|c» y «a|bc» tienen que ser distintas o dos pacientes colisionan.
    expect(serializarEstable({ a: 'x', b: 'y' })).not.toBe(serializarEstable({ a: 'xy', b: '' }))
  })

  it('la llave del documento es estable: reintentar escribe en el MISMO sitio', async () => {
    const h = await huellaDeFila({ nombre: 'Ana Ruiz' })
    expect(llaveIdempotente('imp_1', h)).toBe(llaveIdempotente('imp_1', h))
    // Y dos trabajos distintos NO se pisan entre sí.
    expect(llaveIdempotente('imp_1', h)).not.toBe(llaveIdempotente('imp_2', h))
  })

  it('el id del trabajo es DERIVADO: reintentar crearlo no abre un trabajo nuevo', async () => {
    const args = { clinicId: 'c1', huellaArchivo: 'aaa', huellaMapeo: 'm1', iniciadoEn: '2026-08-23T10:00:00Z' }
    expect(await idDeTrabajo(args)).toBe(await idDeTrabajo(args))
    // Cambiar el mapeo es otro trabajo: el mismo archivo leído de otra manera.
    expect(await idDeTrabajo(args)).not.toBe(await idDeTrabajo({ ...args, huellaMapeo: 'm2' }))
    // Y cambiar de consultorio también, aunque el archivo sea el mismo.
    expect(await idDeTrabajo(args)).not.toBe(await idDeTrabajo({ ...args, clinicId: 'c2' }))
  })

  it('el id del lote es derivado, no correlativo: al reanudar el lote 37 se sigue llamando igual', () => {
    expect(idDeLote('imp_1', 37)).toBe(idDeLote('imp_1', 37))
    expect(idDeLote('imp_1', 37)).not.toBe(idDeLote('imp_1', 38))
  })

  it('EL MISMO ARCHIVO SUBIDO DOS VECES no propone volver a crear a nadie', async () => {
    const csv = 'Nombre,Teléfono\nAna Ruiz Soto,6641234567\nBeto Lara Cruz,5551112222'
    const primera = await ensayar(ADAPTADOR_CSV, csv, [], O)
    expect(primera.reconciliacion.cuentas.porDestino.accepted).toBe(2)

    // Segunda vuelta: las huellas de la primera ya están registradas.
    const huellas = new Set(primera.filas.map(f => f.huella))
    const segunda = await ensayar(ADAPTADOR_CSV, csv, [], { ...O, huellasPrevias: huellas })
    expect(segunda.reconciliacion.cuentas.porDestino.accepted).toBe(0)
    expect(segunda.reconciliacion.cuentas.porDestino.duplicate).toBe(2)
    // Y con la razón exacta, no un «duplicado» genérico.
    expect(segunda.filas[0].veredicto.razones).toContain('ALREADY_IMPORTED')
  })

  it('una fila repetida DENTRO del archivo entra una vez y la otra dice cuál repite', async () => {
    const csv = [
      'Nombre,Teléfono',
      'Ana Ruiz Soto,6641234567',
      'Beto Lara Cruz,5551112222',
      'Ana Ruiz Soto,6641234567',
    ].join('\n')
    const r = await ensayar(ADAPTADOR_CSV, csv, [], O)
    expect(r.reconciliacion.cuentas.porDestino.accepted).toBe(2)
    expect(r.reconciliacion.cuentas.porDestino.duplicate).toBe(1)
    const dup = r.filas.find(f => f.veredicto.destino === 'duplicate')!
    expect(dup.veredicto.razones).toContain('DUPLICATE_IN_SOURCE')
    // Dice QUÉ fila repite: sin esto hay que buscar a mano en 50 000 filas.
    expect(dup.veredicto.detalle?.primeraFila).toBe(1)
  })

  it('dos filas con el mismo id de origen y contenido distinto van a cuarentena', () => {
    const c = colisionesDeIdOrigen([
      { sourceRecordId: 'A1', huella: 'h1' },
      { sourceRecordId: 'A1', huella: 'h2' },
      { sourceRecordId: 'A2', huella: 'h3' },
    ])
    expect([...c]).toEqual(['A1'])
  })

  it('primeraAparicion señala la primera y sólo la primera', () => {
    const p = primeraAparicion(['a', 'b', 'a', 'c', 'b'])
    expect(p.get('a')).toBe(0)
    expect(p.get('b')).toBe(1)
  })

  it('la huella del archivo distingue dos archivos', async () => {
    expect(await huellaDeArchivo('a,b\n1,2')).not.toBe(await huellaDeArchivo('a,b\n1,3'))
  })
})

/* ═══════════════ 5 y 6. DUPLICADOS: EXACTO SÍ, DUDOSO A REVISIÓN ═══════════════ */

const px = (o: Partial<PacienteComparable>): PacienteComparable => ({ id: 'x', nombre: 'N', ...o })

describe('emparejamiento', () => {
  it('mismo CURP = EXACT_MATCH, y no se vuelve a crear', () => {
    const i = new IndicePacientes([px({ id: 'p1', nombre: 'Ana Ruiz Soto', curp: 'RUSA850312MDFXXX09' })])
    const e = emparejar(px({ nombre: 'ANA RUIZ SOTO', curp: 'RUSA850312MDFXXX09' }), i)
    expect(e.clase).toBe('EXACT_MATCH')
    expect(puedeCrearse(e.clase)).toBe(false)
    expect(e.porQue).toContain('CURP_IGUAL')
  })

  it('mismo nombre y misma fecha de nacimiento = EXACT_MATCH', () => {
    const i = new IndicePacientes([px({ id: 'p1', nombre: 'Ana Ruiz Soto', fechaNacimiento: '1985-03-12' })])
    const e = emparejar(px({ nombre: 'Ana Ruiz Soto', fechaNacimiento: '1985-03-12' }), i)
    expect(e.clase).toBe('EXACT_MATCH')
    expect(e.porQue).toContain('FECHA_NACIMIENTO_IGUAL')
  })

  it('SÓLO nombre parecido = LIKELY_MATCH, que NO se funde solo', () => {
    const i = new IndicePacientes([px({ id: 'p1', nombre: 'Ana Ruiz Soto' })])
    const e = emparejar(px({ nombre: 'Ana Ruiz Soto' }), i)
    expect(e.clase).toBe('LIKELY_MATCH')
    // Lo importante de esta prueba: ni se crea ni se funde. Va a que alguien mire.
    expect(puedeCrearse(e.clase)).toBe(false)
    expect(requiereRevision(e.clase)).toBe(true)
  })

  it('DOS candidatos igual de buenos = AMBIGUOUS: no se echa a cara o cruz', () => {
    const i = new IndicePacientes([
      px({ id: 'p1', nombre: 'Ana Ruiz Soto', fechaNacimiento: '1985-03-12' }),
      px({ id: 'p2', nombre: 'Ana Ruiz Soto', fechaNacimiento: '1985-03-12' }),
    ])
    const e = emparejar(px({ nombre: 'Ana Ruiz Soto', fechaNacimiento: '1985-03-12' }), i)
    expect(e.clase).toBe('AMBIGUOUS')
    expect(e.porQue).toContain('VARIOS_CANDIDATOS')
    expect(requiereRevision(e.clase)).toBe(true)
  })

  it('LA FAMILIA QUE COMPARTE CELULAR ENTRA ENTERA — el teléfono nunca basta solo', () => {
    // En México el celular es de la casa. La regla vieja (teléfono a solas)
    // perdía a los tres hijos en silencio y el informe decía «3 duplicados».
    const i = new IndicePacientes([px({ id: 'madre', nombre: 'Rosa Hernández Cruz', telefono: '6641234567' })])
    for (const hijo of ['Diego Hernández Cruz', 'Sofía Hernández Cruz', 'Iván Hernández Cruz']) {
      const e = emparejar(px({ nombre: hijo, telefono: '6641234567' }), i)
      expect(e.clase, `${hijo} tiene que poder entrar`).toBe('NEW_RECORD')
    }
  })

  it('nadie parecido = NEW_RECORD', () => {
    const i = new IndicePacientes([px({ id: 'p1', nombre: 'Ana Ruiz Soto' })])
    expect(emparejar(px({ nombre: 'Carlos Méndez Vega' }), i).clase).toBe('NEW_RECORD')
  })

  it('el índice CRECE con lo aceptado: la misma persona dos veces en el archivo no entra dos veces', async () => {
    // Mismo humano, escrito distinto: la huella no los empata, el emparejamiento sí.
    const csv = [
      'Nombre,Fecha de nacimiento',
      'Ana Ruiz Soto,1985-03-12',
      'ANA RUIZ SOTO,1985-03-12',
    ].join('\n')
    const r = await ensayar(ADAPTADOR_CSV, csv, [], O)
    expect(r.reconciliacion.cuentas.porDestino.accepted).toBe(1)
    expect(r.reconciliacion.cuentas.porDestino.duplicate).toBe(1)
  })

  it('AL REVÉS: sin índice creciente, las dos entrarían', () => {
    // Prueba del guardián al revés — se le mete el defecto (índice que no crece)
    // y se comprueba que efectivamente produce el duplicado que evitamos.
    const i = new IndicePacientes<PacienteComparable>([])
    const a = px({ nombre: 'Ana Ruiz Soto', fechaNacimiento: '1985-03-12' })
    expect(emparejar(a, i).clase).toBe('NEW_RECORD')
    // Sin `i.agregar(a)`, la segunda también sale nueva:
    expect(emparejar(a, i).clase).toBe('NEW_RECORD')
    // Con el agregado, ya no:
    i.agregar(a)
    expect(emparejar(a, i).clase).toBe('EXACT_MATCH')
  })
})

/* ═══════════════ 8 y 9. LOTES, PUNTO DE CONTROL Y REANUDAR ═══════════════ */

describe('lotes y punto de control', () => {
  const T0 = '2026-08-23T10:00:00.000Z'

  it('el troceado es determinista y no pierde ni repite filas', () => {
    const lotes = planificar(1000, 'imp_1', 400)
    expect(lotes).toHaveLength(3)
    expect(lotes[0]).toMatchObject({ numero: 0, desde: 0, hasta: 399, filas: 400 })
    expect(lotes[2]).toMatchObject({ numero: 2, desde: 800, hasta: 999, filas: 200 })
    // La suma tiene que dar el total exacto: un lote de más o de menos aquí
    // significa filas escritas dos veces o filas nunca escritas.
    expect(lotes.reduce((s, l) => s + l.filas, 0)).toBe(1000)
    expect(JSON.stringify(planificar(1000, 'imp_1', 400))).toBe(JSON.stringify(lotes))
  })

  it('cuentaDeLotes coincide con el troceado real', () => {
    for (const n of [0, 1, 399, 400, 401, 10_000, 50_000]) {
      expect(cuentaDeLotes(n, FILAS_POR_LOTE)).toBe(planificar(n, 'imp_1', FILAS_POR_LOTE).length)
    }
  })

  it('REANUDAR continúa desde el punto de control, sin repetir lo confirmado', () => {
    const lotes = planificar(1000, 'imp_1', 400)
    let p = nuevoPuntoDeControl('imp_1', 'w1', T0)
    expect(siguienteLote(p)).toBe(0)

    p = confirmarLote(p, lotes[0], T0)
    p = confirmarLote(p, lotes[1], T0)
    expect(p.filasEscritas).toBe(800)

    // Aquí se cae el proceso. Otro toma el relevo con el punto de control guardado.
    const pendientes = lotesPendientes(lotes, p)
    expect(pendientes).toHaveLength(1)
    expect(pendientes[0].numero).toBe(2)
    expect(trabajoTerminado(lotes, p)).toBe(false)

    p = confirmarLote(p, lotes[2], T0)
    expect(trabajoTerminado(lotes, p)).toBe(true)
    expect(p.filasEscritas).toBe(1000)
  })

  it('confirmar un lote FUERA DE ORDEN revienta en vez de saltarse filas en silencio', () => {
    const lotes = planificar(1000, 'imp_1', 400)
    const p = nuevoPuntoDeControl('imp_1', 'w1', T0)
    // Si esto se tolerara, el punto de control apuntaría al 2 sin haber escrito
    // el 0 ni el 1, y esas 800 filas no las volvería a mirar nadie.
    expect(() => confirmarLote(p, lotes[2], T0)).toThrow(/saltaría filas/)
  })

  it('UN LOTE ENVIADO SIN RESPUESTA no se marca: se prefiere repetir a saltar', () => {
    const lotes = planificar(800, 'imp_1', 400)
    const p = nuevoPuntoDeControl('imp_1', 'w1', T0)
    // El lote 0 se envió y no volvió la respuesta. No se confirma.
    expect(siguienteLote(p)).toBe(0)
    expect(lotesPendientes(lotes, p)).toHaveLength(2)
    // Repetirlo es barato: la llave idempotente lo hace inocuo. Saltarlo, no.
  })

  it('el TRABAJADOR ZOMBI no puede escribir mientras el arrendamiento es de otro', () => {
    const p = nuevoPuntoDeControl('imp_1', 'w1', T0)
    expect(puedeEscribirLote(p, 'w1', T0)).toBe(true)
    expect(puedeEscribirLote(p, 'w2', T0)).toBe(false)
    expect(() => tomarRelevo(p, 'w2', T0)).toThrow(/arrendamiento vigente/)
  })

  it('un arrendamiento caducado NO deja el trabajo bloqueado para siempre', () => {
    const p = nuevoPuntoDeControl('imp_1', 'w1', T0)
    const tarde = '2026-08-23T10:06:00.000Z'   // pasados los 5 minutos
    expect(puedeEscribirLote(p, 'w2', tarde)).toBe(true)
    const p2 = tomarRelevo(p, 'w2', tarde)
    expect(p2.trabajador).toBe('w2')
    // El relevo conserva el avance: no se vuelve a empezar.
    expect(p2.ultimoLoteConfirmado).toBe(p.ultimoLoteConfirmado)
  })

  it('la espera crece y se dispersa, para no reintentar todos a la vez', () => {
    expect(esperaMs(0, 0)).toBeLessThan(esperaMs(3, 0))
    expect(esperaMs(0, 0)).not.toBe(esperaMs(0, 1))
    expect(esperaMs(20, 1)).toBeLessThanOrEqual(30_000)
  })

  it('CANCELAR no borra lo ya escrito: deja el trabajo PARTIAL', () => {
    const lotes = planificar(1000, 'imp_1', 400)
    let p = nuevoPuntoDeControl('imp_1', 'w1', T0)
    p = confirmarLote(p, lotes[0], T0)
    const c = alCancelar(p)
    // Borrar al cancelar significaría tirar 400 expedientes que entraron bien.
    expect(c.conservar).toBe(400)
    expect(c.estado).toBe('PARTIAL')
  })

  it('el progreso se cuenta sobre lotes y refleja lo confirmado', () => {
    const lotes = planificar(1000, 'imp_1', 400)
    let p = nuevoPuntoDeControl('imp_1', 'w1', T0)
    expect(progreso(lotes, p).fraccion).toBe(0)
    p = confirmarLote(p, lotes[0], T0)
    expect(progreso(lotes, p)).toMatchObject({ lotesHechos: 1, lotesTotales: 3, filasEscritas: 400 })
  })
})
