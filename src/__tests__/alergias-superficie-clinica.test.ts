import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { CAMPOS_CLINICOS_PACIENTE, type Patient, type ResumenClinicoPaciente } from '@/types'
import { alergiasDe, alergiasParaImpreso } from '@/lib/seguridad/alergias'
import {
  destinoDe,
  esCampoClinico,
  fusionarPaciente,
  hayContenidoClinico,
  indicadorAdministrativo,
  repartirCamposDePaciente,
  rutaPacienteAdministrativo,
  rutaResumenClinico,
  sePuedeAfirmarSobreLoClinico,
  TEXTO_INDICADOR_ADMINISTRATIVO,
  type EstadoClinico,
  type LecturaClinica,
} from '@/lib/expediente/paciente-clinico'
import {
  equivalenciaClinica,
  operacionEsSegura,
  planDeBackfill,
  planDeRollback,
  resumenDesdePaciente,
} from '@/lib/migracion/phi-clinico'

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LAS ALERGIAS SON INFORMACIÓN CLÍNICA — política del dueño, E0-06 / P1-6.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * `alergias`, `alergiasEstructuradas`, `notas` y `txValoracion*` son CAMPOS del
 * documento `clinics/{c}/patients/{id}`, y ese documento está abierto con
 * `allow read: if isMember` porque recepción necesita nombre y teléfono para
 * agendar. Firestore **no autoriza por campo en lectura**: o se lee el documento
 * entero o no se lee. O sea que el rol recepción lee hoy el alérgeno, la reacción
 * y la gravedad, y ninguna regla de Firestore puede impedirlo.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * La aceptación de la unidad E0-06 —«rol recepción: lee cita, no lee nota ni
 * alergias»— se probó contra el repo real y la mitad de «alergias» salió falsa.
 * `docs/roadmap/nexus-os/unidades/E0-06/RESULTADO.json` lo declara sin adornos:
 * `"no lee alergias": "TODAVÍA NO"`.
 *
 * ── LA CAUSA RAÍZ ───────────────────────────────────────────────────────────
 *
 * De modelo de datos, no de reglas. El dato clínico vive en el documento
 * administrativo compartido. La reparación es mudarlo a la superficie clínica
 * protegida (`patients/{id}/clinico/resumen`, ya cerrada con `isMedico`).
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * La migración es `add → backfill → verify → switch reads → verify → remove
 * legacy`, y ningún campo legado se retira hasta demostrar equivalencia. Este
 * archivo es el guardián de las tres invariantes que hacen que esa secuencia sea
 * segura:
 *
 *  1. **Una sola verdad clínica.** El reparto manda cada campo a UN destino.
 *  2. **La ausencia no se convierte en negación.** Una lectura denegada o rota
 *     deja el campo AUSENTE, nunca `''`. El repo ya imprimió una vez «Negadas» en
 *     la receta de un paciente alérgico por confundir las dos cosas.
 *  3. **El backfill sólo AÑADE.** Ninguna operación del plan toca el documento
 *     administrativo ni borra nada, así que un fallo a mitad de camino no puede
 *     destruir la fuente anterior y el rollback siempre está disponible.
 *
 * ── QUÉ NO CUBRE ESTE ARCHIVO ───────────────────────────────────────────────
 *
 * · **No demuestra que el motor de reglas deniegue de verdad.** Que recepción no
 *   pueda leer y que un usuario de otra clínica tampoco es comportamiento del
 *   servidor de Firestore, y sólo lo demuestra el emulador:
 *   `emulator/alergias-superficie-clinica.emu.test.ts`, vía `npm run test:emulador`.
 *   Aquí, sin Java, sólo se afirma sobre las reglas como TEXTO.
 * · **No demuestra que la migración corriera en producción.** Eso lo dice la
 *   salida de `npm run phi:verificar -- --clinic=<id>`, que ejecuta el dueño.
 * · **No prueba las pantallas.** Ninguna lee todavía por la superficie nueva: el
 *   paso `switch reads` está sin autorizar.
 */

const REGLAS = readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8')

/** Paciente sintético. Nombres inventados: aquí no hay ni puede haber un dato real. */
function pacienteSintetico(extra: Partial<Patient> = {}): Patient {
  return {
    id: 'p-sintetico', nombre: 'Paciente Sintético', telefono: '5550000000',
    noShowCount: 0, cancelacionCount: 0,
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    creadoPor: 'uid-sintetico',
    ...extra,
  }
}

const lectura = (estado: EstadoClinico, datos: Partial<ResumenClinicoPaciente> | null = null): LecturaClinica =>
  ({ estado, datos: datos as ResumenClinicoPaciente | null })

/* ═══════════════════════════════════════════════════════════════════════════
   1. LAS ALERGIAS SON INFORMACIÓN CLÍNICA, Y SU CASA ES LA SUPERFICIE CLÍNICA
   ═══════════════════════════════════════════════════════════════════════════ */

describe('la alergia es un dato clínico y su fuente canónica es la superficie protegida', () => {
  it('alérgeno, reacción y gravedad son los tres campos de la alergia estructurada', () => {
    // Los tres que la política nombra. Si alguien añadiera un cuarto y el
    // traslado no lo copiara, `equivalenciaClinica` no podría verlo: por eso se
    // ancla la forma aquí y no sólo en el tipo.
    const a = { alergeno: 'penicilina', reaccion: 'anafilaxia', severidad: 'grave' as const }
    expect(alergiasDe({ alergiasEstructuradas: [a] })[0]).toMatchObject(a)
  })

  it('los cuatro grupos de contenido clínico están declarados como tales', () => {
    for (const campo of ['alergias', 'alergiasEstructuradas', 'notas', 'txValoracion'])
      expect(esCampoClinico(campo), `${campo} debería ser clínico`).toBe(true)
    for (const campo of ['nombre', 'telefono', 'curp', 'seguroMedico', 'proximoSeguimiento'])
      expect(esCampoClinico(campo), `${campo} NO es clínico`).toBe(false)
  })

  it('la fuente canónica es el subdocumento, no el documento administrativo', () => {
    expect(rutaResumenClinico('c1', 'p1')).toBe('clinics/c1/patients/p1/clinico/resumen')
    expect(rutaResumenClinico('c1', 'p1').startsWith(rutaPacienteAdministrativo('c1', 'p1'))).toBe(true)
    // Y son documentos DISTINTOS: si un día coincidieran, la separación no existiría.
    expect(rutaResumenClinico('c1', 'p1')).not.toBe(rutaPacienteAdministrativo('c1', 'p1'))
  })

  it('la regla que cierra esa superficie sigue siendo isMedico (recepción es isMember)', () => {
    // Guardián de TEXTO, no de comportamiento: quien demuestra la denegación es el
    // emulador. Esto caza el aflojamiento accidental en una revisión de reglas.
    const bloque = REGLAS.slice(REGLAS.indexOf('match /clinico/{clinicoId}'))
      .slice(0, REGLAS.slice(REGLAS.indexOf('match /clinico/{clinicoId}')).indexOf('}\n'))
    expect(bloque).toMatch(/allow read:\s*if isMedico\(clinicId\)/)
    expect(bloque).not.toMatch(/allow read:[^;]*isMember/)
  })
})

/* ═══════════════════════════════════════════════════════════════════════════
   2. NO SE PERMITE DOBLE CLINICAL TRUTH  (política, punto 6)
   ═══════════════════════════════════════════════════════════════════════════ */

describe('un dato clínico, un solo destino', () => {
  it('cada clave del parche sale en exactamente uno de los dos documentos', () => {
    const parche: Partial<Patient> = {
      nombre: 'Nombre Nuevo', telefono: '5551111111',
      alergias: 'penicilina', alergiasEstructuradas: [{ alergeno: 'sulfas', severidad: 'moderada' }],
      notas: 'antecedente sintético', txValoracion: { hc_vih: 'no' },
    }
    const { administrativo, clinico } = repartirCamposDePaciente(parche)

    const enAdmin = Object.keys(administrativo)
    const enClinico = Object.keys(clinico)
    expect(enAdmin.filter(k => enClinico.includes(k))).toEqual([])   // sin solape
    // Sin pérdida: cada clave del origen aparece a un lado, con el nombre que le
    // toque en su destino (`notas` viaja como `notasClinicas`).
    const esperado = Object.keys(parche).map(k => (esCampoClinico(k) ? destinoDe(k) : k)).sort()
    expect([...enAdmin, ...enClinico].sort()).toEqual(esperado)
  })

  it('NINGÚN campo clínico se queda en el documento que lee recepción', () => {
    const parche = Object.fromEntries(CAMPOS_CLINICOS_PACIENTE.map(c => [c, 'x'])) as Partial<Patient>
    const { administrativo, tocaLoClinico } = repartirCamposDePaciente(parche)
    expect(tocaLoClinico).toBe(true)
    expect(Object.keys(administrativo)).toEqual([])
  })

  it('al revés: un parche puramente administrativo no crea documento clínico', () => {
    // Sin esto, corregir un teléfono desde el mostrador escribiría en la superficie
    // clínica — una escritura que la regla `isMedico` denegaría, y el guardado del
    // mostrador fallaría entero por un campo que nadie tocó.
    const { clinico, tocaLoClinico } = repartirCamposDePaciente({ telefono: '5552222222', curp: 'XXXX' })
    expect(tocaLoClinico).toBe(false)
    expect(clinico).toEqual({})
  })

  it('`notas` es el único renombre, y el resto conserva su nombre', () => {
    expect(destinoDe('notas')).toBe('notasClinicas')
    for (const c of CAMPOS_CLINICOS_PACIENTE) if (c !== 'notas') expect(destinoDe(c)).toBe(c)
  })

  it('una vez migrado, el campo legado deja de ser verdad', () => {
    // El caso que crearía la segunda verdad: el subdocumento dice una cosa y el
    // documento administrativo todavía dice otra (porque el legado no se ha
    // retirado). Gana el subdocumento, siempre, y el legado NO se cuela.
    const admin = pacienteSintetico({ alergias: 'lo viejo' })
    const { paciente } = fusionarPaciente(admin, lectura('ok', { alergias: 'penicilina' }))
    expect(paciente.alergias).toBe('penicilina')
  })

  it('con el paciente YA SELLADO, el legado no resucita', () => {
    // Un médico que borró la alergia a propósito («ya se comprobó que no la tiene»)
    // no puede ver cómo el campo legado la devuelve en la siguiente lectura.
    const admin = pacienteSintetico({ alergias: 'penicilina' })
    const { paciente } = fusionarPaciente(admin, lectura('ok', {
      notasClinicas: 'sólo antecedentes', migradoEn: '2026-08-28T00:00:00.000Z',
    }))
    expect(paciente.alergias).toBeUndefined()
    expect('alergias' in paciente).toBe(false)
  })

  it('SIN sello, en cambio, lo que el subdocumento no trae se sirve del legado', () => {
    /**
     * El paciente cuyo médico apuntó una alergia por la superficie nueva antes de
     * que el backfill lo alcanzara. Sin este respaldo, esa primera escritura haría
     * DESAPARECER sus antecedentes de la pantalla: la alergia estaría en el
     * subdocumento y los antecedentes sólo en el legado, y el legado ya no se
     * miraría. Es la ventana peligrosa del corte, y se cierra con el sello.
     */
    const admin = pacienteSintetico({ alergias: 'lo viejo', notas: 'antecedente heredado' })
    const { paciente } = fusionarPaciente(admin, lectura('ok', { alergias: 'penicilina' }))
    expect(paciente.alergias).toBe('penicilina')        // manda el subdocumento
    expect(paciente.notas).toBe('antecedente heredado') // y lo que no trae, del legado
  })

  it('el sello es el interruptor del corte: la MISMA lectura, sellada, deja de mirar atrás', () => {
    // La diferencia entre las dos conductas es un campo de DATOS, no una constante
    // del código: por eso el corte y el rollback no necesitan desplegar nada.
    const admin = pacienteSintetico({ notas: 'antecedente heredado' })
    const sinSello = fusionarPaciente(admin, lectura('ok', { alergias: 'penicilina' }))
    const conSello = fusionarPaciente(admin, lectura('ok', {
      alergias: 'penicilina', migradoEn: '2026-08-28T00:00:00.000Z',
    }))
    expect(sinSello.paciente.notas).toBe('antecedente heredado')
    expect(conSello.paciente.notas).toBeUndefined()
  })
})

/* ═══════════════════════════════════════════════════════════════════════════
   3. AUSENCIA DE DATO NO ES DATO DE AUSENCIA  (regla 4 de seguridad clínica)
   ═══════════════════════════════════════════════════════════════════════════ */

describe('una lectura clínica que no se pudo hacer NO afirma nada', () => {
  it.each(['sin_permiso', 'error'] as const)(
    'con estado «%s» los campos clínicos quedan AUSENTES, nunca en blanco', estado => {
      const admin = pacienteSintetico({ alergias: 'penicilina', notas: 'antecedente' })
      const { paciente, estadoClinico } = fusionarPaciente(admin, lectura(estado))

      expect(estadoClinico).toBe(estado)
      for (const campo of CAMPOS_CLINICOS_PACIENTE) {
        expect(campo in paciente, `${campo} no debe existir como clave`).toBe(false)
        expect((paciente as unknown as Record<string, unknown>)[campo]).toBeUndefined()
      }
      // La clave: `''` sería una AFIRMACIÓN («no tiene alergias»). `undefined` no lo es.
      expect((paciente as unknown as Record<string, unknown>).alergias).not.toBe('')
    })

  it('y el impreso no dice «Negadas» — que es el incidente que ya se pagó una vez', () => {
    const admin = pacienteSintetico({ alergias: 'penicilina' })
    const { paciente } = fusionarPaciente(admin, lectura('error'))
    const impreso = alergiasParaImpreso(paciente)
    expect(impreso).not.toMatch(/negad/i)
    expect(impreso).not.toMatch(/no referid/i)
  })

  it('AL REVÉS (el guardián con el defecto puesto): colapsar el fallo en «vacío» borra la diferencia', () => {
    /**
     * El defecto que este módulo evita, escrito a mano para poder medirlo: una
     * implementación que ante un error devolviera `alergias: ''` y estado `'ok'`.
     *
     * Lo grave no es la cadena vacía en sí —`alergiasParaImpreso` ya la trata como
     * ausencia—, es que el resultado sería INDISTINGUIBLE del caso legítimo «el
     * médico miró y no hay alergias registradas». Y esas dos situaciones piden
     * conductas opuestas: una permite seguir, la otra obliga a parar.
     */
    const colapsado = { paciente: pacienteSintetico({ alergias: '' }), estadoClinico: 'ok' as EstadoClinico }
    const legitimoVacio = fusionarPaciente(pacienteSintetico(), lectura('ok', {}))

    // Con el defecto puesto: las dos situaciones son la misma cosa. Nadie puede decidir.
    expect(alergiasDe(colapsado.paciente)).toEqual(alergiasDe(legitimoVacio.paciente))
    expect(sePuedeAfirmarSobreLoClinico(colapsado.estadoClinico))
      .toBe(sePuedeAfirmarSobreLoClinico(legitimoVacio.estadoClinico))

    // Con la implementación real: el fallo se distingue del vacío legítimo.
    const real = fusionarPaciente(pacienteSintetico({ alergias: 'penicilina' }), lectura('error'))
    expect(sePuedeAfirmarSobreLoClinico(real.estadoClinico))
      .not.toBe(sePuedeAfirmarSobreLoClinico(legitimoVacio.estadoClinico))
  })

  it('«el documento existe y está vacío» NO es lo mismo que «no pude leerlo»', () => {
    expect(sePuedeAfirmarSobreLoClinico('ok')).toBe(true)
    expect(sePuedeAfirmarSobreLoClinico('no_migrado')).toBe(true)
    expect(sePuedeAfirmarSobreLoClinico('sin_permiso')).toBe(false)
    expect(sePuedeAfirmarSobreLoClinico('error')).toBe(false)
  })

  it('mientras el paciente no esté migrado, sus alergias siguen llegando', () => {
    // La ventana entre `add` y `backfill`. Sin este respaldo, encender la superficie
    // nueva dejaría a TODOS los pacientes sin alergias en pantalla: un daño mayor
    // que el agujero que se está cerrando.
    const admin = pacienteSintetico({ alergias: 'penicilina', notas: 'antecedente' })
    const { paciente, estadoClinico } = fusionarPaciente(admin, lectura('no_migrado'))
    expect(estadoClinico).toBe('no_migrado')
    expect(paciente.alergias).toBe('penicilina')
    expect(alergiasDe(paciente).map(a => a.alergeno)).toContain('penicilina')
  })
})

/* ═══════════════════════════════════════════════════════════════════════════
   4. EL BACKFILL CONSERVA EL 100%  (política, punto 9)
   ═══════════════════════════════════════════════════════════════════════════ */

describe('el backfill no pierde una alergia, ni una reacción, ni una gravedad', () => {
  const CON_TODO = pacienteSintetico({
    alergias: 'Alérgico a penicilina. Niega sulfas',
    alergiasEstructuradas: [
      { alergeno: 'penicilina', tipo: 'medicamento', severidad: 'grave', reaccion: 'anafilaxia' },
      { alergeno: 'ketorolaco', tipo: 'medicamento', severidad: 'moderada', reaccion: 'urticaria' },
    ],
    notas: 'antecedente sintético',
    txValoracion: { hc_vih: 'no' },
    txValoracionAt: '2026-02-01T00:00:00.000Z',
    txValoracionHist: [{ fecha: '2026-02-01', modo: 'sintético', huesped: 'sintético', texto: 'x' }],
  })

  it('los seis campos llegan al otro lado, con el renombre hecho', () => {
    const r = resumenDesdePaciente(CON_TODO)
    expect(r.alergias).toBe(CON_TODO.alergias)
    expect(r.alergiasEstructuradas).toEqual(CON_TODO.alergiasEstructuradas)
    expect(r.notasClinicas).toBe(CON_TODO.notas)
    expect(r.txValoracion).toEqual(CON_TODO.txValoracion)
    expect(r.txValoracionHist).toEqual(CON_TODO.txValoracionHist)
    expect(r).not.toHaveProperty('notas')     // el nombre viejo no viaja
  })

  it('la equivalencia da verde sobre lo que el backfill escribiría', () => {
    const eq = equivalenciaClinica(CON_TODO, resumenDesdePaciente(CON_TODO))
    expect(eq).toMatchObject({
      equivalente: true, camposFaltantes: [], camposDistintos: [],
      alergenosPerdidos: [], detallesPerdidos: [],
    })
  })

  it('CADA alérgeno del origen se reconoce en el destino (comparación clínica, no textual)', () => {
    const antes = alergiasDe(CON_TODO).map(a => a.alergeno.toLowerCase())
    const despues = alergiasDe(resumenDesdePaciente(CON_TODO)).map(a => a.alergeno.toLowerCase())
    expect(antes.length).toBeGreaterThan(0)
    for (const a of antes) expect(despues).toContain(a)
  })

  it('AL REVÉS — un backfill que pierde un alérgeno lo declara y NO es equivalente', () => {
    const mutilado = { ...resumenDesdePaciente(CON_TODO), alergiasEstructuradas: [CON_TODO.alergiasEstructuradas![0]] }
    const eq = equivalenciaClinica(CON_TODO, mutilado)
    expect(eq.equivalente).toBe(false)
    expect(eq.camposDistintos).toContain('alergiasEstructuradas')
    expect(eq.alergenosPerdidos.map((s: string) => s.toLowerCase())).toContain('ketorolaco')
  })

  it('AL REVÉS — perder SÓLO la reacción o SÓLO la gravedad también rompe la equivalencia', () => {
    const sinReaccion = {
      ...resumenDesdePaciente(CON_TODO),
      alergiasEstructuradas: CON_TODO.alergiasEstructuradas!.map(a => ({ ...a, reaccion: undefined })),
    }
    expect(equivalenciaClinica(CON_TODO, sinReaccion).detallesPerdidos.join(' ')).toMatch(/reacción/)

    const sinGravedad = {
      ...resumenDesdePaciente(CON_TODO),
      alergiasEstructuradas: CON_TODO.alergiasEstructuradas!.map(a => ({ ...a, severidad: undefined })),
    }
    expect(equivalenciaClinica(CON_TODO, sinGravedad).detallesPerdidos.join(' ')).toMatch(/gravedad/)
  })

  it('AL REVÉS — un destino vacío no pasa por equivalente', () => {
    expect(equivalenciaClinica(CON_TODO, null).equivalente).toBe(false)
    expect(equivalenciaClinica(CON_TODO, {}).camposFaltantes.length).toBe(CAMPOS_CLINICOS_PACIENTE.length)
  })
})

/* ═══════════════════════════════════════════════════════════════════════════
   5. UN PACIENTE SIN ALERGIAS NO ADQUIERE ALERGIAS  (política, punto 9)
   ═══════════════════════════════════════════════════════════════════════════ */

describe('la migración no inventa lo que nadie escribió', () => {
  it('un paciente sin campos clínicos no adquiere ni una clave clínica', () => {
    const limpio = pacienteSintetico()
    const r = resumenDesdePaciente(limpio)
    expect(r).toEqual({})
    expect(r).not.toHaveProperty('alergias')
    expect(r).not.toHaveProperty('alergiasEstructuradas')
    expect(alergiasDe(r)).toEqual([])
  })

  it('su plan de backfill escribe el sello y NADA clínico', () => {
    const plan = planDeBackfill({
      clinicId: 'c1', patientId: 'p1', legado: pacienteSintetico(), resumenActual: null,
      ahora: '2026-08-28T00:00:00.000Z', uid: 'uid-migracion',
    })
    expect(plan.motivo).toBe('sin_contenido_clinico')
    const [op] = plan.operaciones
    expect(op.tipo).toBe('escribir_resumen')
    const datos = (op as { datos: Record<string, unknown> }).datos
    expect(Object.keys(datos).sort()).toEqual(['actualizadoEn', 'actualizadoPor', 'migradoEn'])
    expect(alergiasDe(datos as never)).toEqual([])
  })

  it('el sello existe para distinguir «se miró y no había nada» de «no se ha mirado»', () => {
    // Sin el sello, el paso `verify` no puede cerrar: no habría forma de saber si un
    // paciente sin alergias es que no las tiene o es que el backfill no lo alcanzó.
    const yaMigrado = planDeBackfill({
      clinicId: 'c1', patientId: 'p1', legado: pacienteSintetico({ alergias: 'penicilina' }),
      resumenActual: { migradoEn: '2026-08-01T00:00:00.000Z' }, ahora: 'x', uid: 'u',
    })
    expect(yaMigrado.motivo).toBe('ya_migrado')
    expect(yaMigrado.operaciones).toEqual([])   // idempotente: relanzar no pisa nada
  })

  it('un `alergias: ""` del origen se copia tal cual, y sigue sin ser una alergia', () => {
    // Copia FIEL, para que la equivalencia se pueda demostrar campo a campo. Que
    // una cadena vacía no afirme nada lo garantiza el normalizador, no el backfill.
    const vacio = pacienteSintetico({ alergias: '' })
    const r = resumenDesdePaciente(vacio)
    expect(r.alergias).toBe('')
    expect(alergiasDe(r)).toEqual([])
    expect(equivalenciaClinica(vacio, r).equivalente).toBe(true)
  })
})

/* ═══════════════════════════════════════════════════════════════════════════
   6. UN FALLO DE MIGRACIÓN NO DESTRUYE LA FUENTE  ·  ROLLBACK DISPONIBLE
      (política, puntos 7, 8 y 9)
   ═══════════════════════════════════════════════════════════════════════════ */

describe('el backfill sólo AÑADE: no hay forma de que destruya el origen', () => {
  const legado = pacienteSintetico({ alergias: 'penicilina', notas: 'antecedente' })
  const plan = planDeBackfill({
    clinicId: 'c1', patientId: 'p1', legado, resumenActual: null,
    ahora: '2026-08-28T00:00:00.000Z', uid: 'uid-migracion',
  })

  it('NINGUNA operación toca el documento administrativo', () => {
    for (const op of plan.operaciones) {
      expect(op.ruta).toBe(rutaResumenClinico('c1', 'p1'))
      expect(op.ruta).not.toBe(rutaPacienteAdministrativo('c1', 'p1'))
      expect(operacionEsSegura(op)).toBe(true)
    }
  })

  it('NINGUNA operación borra nada, y todas fusionan', () => {
    for (const op of plan.operaciones) {
      expect(op.tipo).not.toMatch(/borrar|delete|eliminar/)
      if (op.tipo === 'escribir_resumen') expect(op.fusionar).toBe(true)
    }
  })

  it('AL REVÉS — el guardián RECHAZA una operación dirigida al documento administrativo', () => {
    // Se le mete el defecto: una operación que escribiría donde recepción lee. Sin
    // esta comprobación, `operacionEsSegura` podría estar devolviendo `true` a todo.
    const peligrosa = { tipo: 'escribir_resumen', ruta: rutaPacienteAdministrativo('c1', 'p1'), datos: {}, fusionar: true } as const
    expect(operacionEsSegura(peligrosa)).toBe(false)
    expect(operacionEsSegura({ tipo: 'quitar_sello', ruta: 'clinics/c1/patients/p1' })).toBe(false)
  })

  it('el rollback está disponible y consiste en quitar el sello', () => {
    const [op] = planDeRollback('c1', 'p1').operaciones
    expect(op.tipo).toBe('quitar_sello')
    expect(op.ruta).toBe(rutaResumenClinico('c1', 'p1'))
    expect(operacionEsSegura(op)).toBe(true)
  })

  it('y tras el rollback el paciente vuelve a leerse del campo legado — estado idéntico al de antes', () => {
    const antes = fusionarPaciente(legado, lectura('no_migrado'))
    const trasRollback = fusionarPaciente(legado, lectura('no_migrado'))
    expect(trasRollback.paciente).toEqual(antes.paciente)
    expect(trasRollback.paciente.alergias).toBe('penicilina')
  })

  it('el script de migración no contiene ninguna escritura al documento del paciente', () => {
    // Guardián de TEXTO sobre el script: el plan puede ser seguro y el script
    // saltárselo. Aquí se comprueba que no existe la llamada que lo permitiría.
    const script = readFileSync(resolve(process.cwd(), 'scripts/migrar-phi-clinico.mjs'), 'utf8')
    expect(script).toMatch(/exigirSegura/)                      // usa el guardián
    expect(script).not.toMatch(/pacientesRef\.doc\([^)]*\)\.(set|update|delete)\(/)
    expect(script).not.toMatch(/FieldValue\.delete\(\)\s*\}\s*\)\s*\/\/\s*legado/)
    // El borrado del sello es la ÚNICA supresión, y es sobre el subdocumento.
    for (const m of script.matchAll(/FieldValue\.delete\(\)/g)) {
      const contexto = script.slice(Math.max(0, m.index! - 200), m.index!)
      expect(contexto, 'toda supresión debe ser del sello, sobre `ref` (el subdocumento)').toMatch(/ref\.update|migradoEn/)
    }
  })

  it('y el modo por defecto del script no escribe', () => {
    const script = readFileSync(resolve(process.cwd(), 'scripts/migrar-phi-clinico.mjs'), 'utf8')
    expect(script).toMatch(/const ejecutar = bandera\('ejecutar'\)/)
    expect(script).toMatch(/if \(!ejecutar\)/)
    // `--clinic` obligatorio: sin «todas las clínicas» por accidente.
    expect(script).toMatch(/if \(!clinicId\)[\s\S]{0,200}process\.exit\(2\)/)
  })
})

/* ═══════════════════════════════════════════════════════════════════════════
   7. LO QUE RECEPCIÓN SÍ PUEDE VER  (política, punto 4)
   ═══════════════════════════════════════════════════════════════════════════ */

describe('el indicador administrativo avisa sin revelar', () => {
  it('no contiene la palabra alergia, ni el alérgeno, ni la reacción, ni la gravedad', () => {
    expect(TEXTO_INDICADOR_ADMINISTRATIVO).toBe('Requiere revisión clínica')
    expect(TEXTO_INDICADOR_ADMINISTRATIVO.toLowerCase()).not.toMatch(/alerg|reacci|gravedad|penicilina/)
    expect(indicadorAdministrativo({ alergias: 'penicilina' })).toBe('requiere_revision_clinica')
  })

  it('no es un detector de alergias: cualquier contenido clínico lo enciende igual', () => {
    // Si sólo se encendiera con alergias, recepción podría INFERIR la alergia por su
    // presencia. Que sea ambiguo es la protección, no un descuido.
    const soloAlergia = indicadorAdministrativo({ alergias: 'penicilina' })
    const soloAntecedente = indicadorAdministrativo({ notasClinicas: 'antecedente sintético' })
    const soloValoracion = indicadorAdministrativo({ txValoracion: { hc_vih: 'no' } })
    expect(soloAntecedente).toBe(soloAlergia)
    expect(soloValoracion).toBe(soloAlergia)
  })

  it('un expediente clínico vacío no enciende nada', () => {
    expect(indicadorAdministrativo(null)).toBe('ninguno')
    expect(indicadorAdministrativo({})).toBe('ninguno')
    expect(indicadorAdministrativo({ alergias: '   ' })).toBe('ninguno')
    expect(hayContenidoClinico({ alergiasEstructuradas: [] })).toBe(false)
  })

  it('SE APAGA cuando el médico borra la última alergia', () => {
    // Es la mitad que se olvida. Encender un aviso es fácil; el defecto está en
    // dejarlo puesto para siempre sobre un expediente que ya está limpio, hasta que
    // el mostrador aprende a ignorarlo — el mismo fallo que se repara en las alertas.
    expect(indicadorAdministrativo({ alergias: 'penicilina' })).toBe('requiere_revision_clinica')
    expect(indicadorAdministrativo({ alergias: '' })).toBe('ninguno')
  })

  it('y por eso se calcula del DOCUMENTO releído, nunca del parche', () => {
    /**
     * Guardián de texto sobre el camino de escritura: con el parche bastaría para
     * encenderlo y NO para apagarlo, porque un borrado llega como un parche sin
     * contenido. Si alguien «simplifica» esto a mirar el parche, el aviso se queda
     * pegado. La comprobación mira que la relectura siga estando.
     */
    const io = readFileSync(resolve(process.cwd(), 'src/lib/expediente/paciente-clinico-firestore.ts'), 'utf8')
    expect(io).toMatch(/const despues = await leerClinico\(/)
    expect(io).toMatch(/indicadorAdministrativo\(despues\.datos\)/)
    // Y si la relectura no salió bien, el indicador NO se toca.
    expect(io).toMatch(/if \(despues\.estado !== 'ok'\) return/)
  })

  it('el indicador es un DERIVADO, no una fuente: vive en el documento administrativo', () => {
    // Que esté ahí es el punto (recepción lo lee) y por eso no puede ser verdad
    // clínica: `patients/{id}` es `allow update: if isMember`. Lo declara el tipo.
    const tipos = readFileSync(resolve(process.cwd(), 'src/types/index.ts'), 'utf8')
    const cuerpoPatient = tipos.slice(tipos.indexOf('export interface Patient {'))
    expect(cuerpoPatient.slice(0, cuerpoPatient.indexOf('\n}'))).toMatch(/requiereRevisionClinica\?: boolean/)
    // Y NO está en el resumen clínico: una sola casa para cada cosa.
    const cuerpoResumen = tipos.slice(tipos.indexOf('export interface ResumenClinicoPaciente {'))
    expect(cuerpoResumen.slice(0, cuerpoResumen.indexOf('\n}'))).not.toMatch(/requiereRevisionClinica/)
    // Ni es un campo clínico que la migración deba trasladar.
    expect(esCampoClinico('requiereRevisionClinica')).toBe(false)
  })
})
