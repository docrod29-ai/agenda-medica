/**
 * LOS DOS ERRORES QUE PUEDE COMETER ESTE MOTOR, Y CUÁL DUELE MÁS.
 *
 *  - **No avisar de un duplicado real** parte el expediente en dos: las alergias
 *    quedan en uno y la prescripción se hace desde el otro.
 *  - **Avisar de algo que no lo es** enseña al médico a cerrar el aviso sin
 *    leerlo, y entonces el primero también pasa.
 *
 * La mitad de estas pruebas defiende cada lado. Las de «esto NO es un duplicado»
 * no son relleno: son las que impiden que el aviso se vuelva ruido.
 */
import { describe, it, expect } from 'vitest'
import {
  normalizarNombre, telefonoComparable, similitudNombre,
  compararPacientes, buscarPosiblesDuplicados, hayQuePreguntar,
  barrerDuplicados, elegirExpedienteParaCita, UMBRAL_NOMBRE,
} from '@/lib/pacientes/duplicados'

describe('normalizarNombre', () => {
  it('el ORDEN de los apellidos no cambia a la persona', () => {
    // El caso más común de todos: el mismo mostrador captura al mismo paciente
    // en dos órdenes distintos según quién lo escriba.
    expect(normalizarNombre('López García, María')).toBe(normalizarNombre('María López García'))
  })

  it('los acentos y la puntuación tampoco', () => {
    expect(normalizarNombre('María López')).toBe(normalizarNombre('Maria Lopez'))
    expect(normalizarNombre('J. Pérez-Ruiz')).toBe(normalizarNombre('perez j ruiz'))
  })

  it('las partículas se caen porque no distinguen a nadie', () => {
    expect(normalizarNombre('Juan de la Cruz')).toBe('cruz juan')
  })

  it('la ñ NO se aplana a n: «Peña» y «Pena» son apellidos distintos', () => {
    // En NFD la ñ es «n» + virgulilla; barrer acentos sin cuidado los fundía.
    expect(normalizarNombre('Muñoz')).toBe('muñoz')
    expect(normalizarNombre('Peña')).not.toBe(normalizarNombre('Pena'))
  })

  it('…y aun así, quien escribe «Munoz» sin teclado español sigue coincidiendo', () => {
    // Se recupera por el lado del dedazo, sin tener que aplanar la ñ para todos.
    expect(similitudNombre('Ana Muñoz Salas', 'Ana Munoz Salas')).toBeGreaterThanOrEqual(UMBRAL_NOMBRE)
  })
})

describe('telefonoComparable', () => {
  it('se queda con los últimos 10 dígitos', () => {
    expect(telefonoComparable('+52 664 123 4567')).toBe('6641234567')
    expect(telefonoComparable('6641234567')).toBe('6641234567')
  })

  it('lo que no llega a 10 dígitos no compara con nada', () => {
    // Un teléfono a medias haría coincidir a gente sin relación.
    expect(telefonoComparable('664123')).toBe('')
    expect(telefonoComparable(null)).toBe('')
  })
})

describe('similitudNombre', () => {
  it('el apellido que falta deja el nombre por encima del umbral', () => {
    // «María López» capturada una vez sin el segundo apellido: mismo paciente.
    expect(similitudNombre('María López', 'María López García')).toBeGreaterThanOrEqual(UMBRAL_NOMBRE)
  })

  it('un dedazo en un apellido largo no rompe el parecido', () => {
    expect(similitudNombre('Ana Rodríguez Luna', 'Ana Rodriquez Luna')).toBeGreaterThanOrEqual(UMBRAL_NOMBRE)
  })

  it('el nombre de pila SOLO no alcanza', () => {
    // Si bastara, media consulta sería «duplicado» de la otra media.
    expect(similitudNombre('María', 'María López García')).toBeLessThan(UMBRAL_NOMBRE)
  })

  it('dos hermanos no se parecen lo suficiente', () => {
    expect(similitudNombre('Juan Pérez López', 'Ana Pérez López')).toBeLessThan(UMBRAL_NOMBRE)
  })

  it('en palabras cortas un cambio ya es otra palabra', () => {
    expect(similitudNombre('Ana Ruiz', 'Eva Ruiz')).toBeLessThan(UMBRAL_NOMBRE)
  })
})

describe('lo que SÍ es un duplicado', () => {
  it('mismo nombre y misma fecha de nacimiento → seguro', () => {
    const r = compararPacientes(
      { nombre: 'María López García', fechaNacimiento: '1990-04-12' },
      { id: 'p1', nombre: 'Maria Lopez Garcia', fechaNacimiento: '1990-04-12' },
    )
    expect(r?.certeza).toBe('seguro')
  })

  it('el CURP manda por encima de todo lo demás', () => {
    const r = compararPacientes(
      { nombre: 'María L. García', curp: 'LOGM900412MBCPRR03' },
      { id: 'p1', nombre: 'GARCIA LOPEZ MARIA', curp: 'LOGM900412MBCPRR03' },
    )
    expect(r?.certeza).toBe('seguro')
    expect(r?.motivo).toMatch(/CURP/)
  })

  it('EL CASO DE LA TABLET Y LA LAPTOP', () => {
    /**
     * La asistente da de alta a «María López» en la tablet; en la laptop la lista
     * está cacheada y no aparece, así que el médico la captura otra vez y de
     * paso invierte los apellidos. Antes eran dos cadenas distintas y no se
     * comparaban por ningún lado.
     */
    const r = compararPacientes(
      { nombre: 'López, María', edad: 34, telefono: '664 123 4567' },
      { id: 'p1', nombre: 'María López', edad: 34, telefono: '6641234567' },
    )
    expect(r?.certeza).toBe('seguro')
  })

  it('EL TELÉFONO DE LA HIJA — el hueco que dejaba la regla vieja', () => {
    /**
     * La comprobación anterior sólo miraba el nombre cuando NO había teléfono.
     * Un segundo registro con el celular de un familiar entraba sin que nadie
     * comparara nada.
     */
    const r = compararPacientes(
      { nombre: 'Juan Pérez Ramírez', fechaNacimiento: '1955-01-30', telefono: '6649998888' },
      { id: 'p1', nombre: 'Juan Pérez Ramírez', fechaNacimiento: '1955-01-30', telefono: '6641112222' },
    )
    expect(r?.certeza).toBe('seguro')
  })

  it('mismo nombre sin ningún otro dato → probable, no seguro', () => {
    // Alcanza para ofrecer el atajo; no para frenar al médico.
    const r = compararPacientes(
      { nombre: 'Juan Pérez López' },
      { id: 'p1', nombre: 'Juan Pérez López' },
    )
    expect(r?.certeza).toBe('probable')
  })
})

describe('lo que NO es un duplicado', () => {
  it('LA FAMILIA QUE COMPARTE CELULAR', () => {
    /**
     * En México el celular es de la casa. La madre registra a sus tres hijos con
     * su número y la regla vieja disparaba la alerta en cada alta. El teléfono
     * es un dato de CONTACTO, no de identidad: aquí sólo refuerza un parecido de
     * nombre que ya existe, nunca lo crea.
     */
    expect(compararPacientes(
      { nombre: 'Sofía Hernández Cruz', telefono: '6645551234' },
      { id: 'p1', nombre: 'Diego Hernández Cruz', telefono: '6645551234' },
    )).toBeNull()
  })

  it('mismo nombre, distinta fecha de nacimiento → dos personas', () => {
    // El padre y el hijo con el mismo nombre completo es lo normal, no la excepción.
    expect(compararPacientes(
      { nombre: 'José Martínez Soto', fechaNacimiento: '1962-08-01' },
      { id: 'p1', nombre: 'José Martínez Soto', fechaNacimiento: '1990-08-01' },
    )).toBeNull()
  })

  it('mismo nombre y 30 años de diferencia → dos personas', () => {
    expect(compararPacientes(
      { nombre: 'José Martínez Soto', edad: 64 },
      { id: 'p1', nombre: 'José Martínez Soto', edad: 34 },
    )).toBeNull()
  })

  it('DOS AÑOS DE DIFERENCIA NO DESCARTAN: la edad guardada envejece mal', () => {
    /**
     * `edad` es una foto del día del alta —un niño registrado a los 6 sigue
     * diciendo 6 al año siguiente—, así que una diferencia pequeña es lo que se
     * espera de un duplicado viejo, no una prueba de que sean distintos.
     */
    const r = compararPacientes(
      { nombre: 'Luis Ángel Torres', edad: 8 },
      { id: 'p1', nombre: 'Luis Angel Torres', edad: 6 },
    )
    expect(r).not.toBeNull()
  })

  it('dos CURP distintos son dos personas, aunque el nombre sea idéntico', () => {
    expect(compararPacientes(
      { nombre: 'José Martínez Soto', curp: 'MASJ620801HBCRTS01' },
      { id: 'p1', nombre: 'José Martínez Soto', curp: 'MASJ900801HBCRTS09' },
    )).toBeNull()
  })

  it('un CURP a medias no se toma por CURP', () => {
    // Sólo 18 caracteres cuentan; un campo mal capturado no puede identificar ni descartar.
    const r = compararPacientes(
      { nombre: 'Ana Ruiz Peña', curp: 'RUPA95', fechaNacimiento: '1995-03-03' },
      { id: 'p1', nombre: 'Ana Ruiz Peña', curp: 'OTRO12', fechaNacimiento: '1995-03-03' },
    )
    expect(r?.certeza).toBe('seguro')   // decidió por nombre + fecha, ignorando los CURP inválidos
  })

  it('un nombre vacío no coincide con nadie', () => {
    expect(compararPacientes({ nombre: '' }, { id: 'p1', nombre: 'Ana Ruiz' })).toBeNull()
    expect(compararPacientes({ nombre: 'Ana Ruiz' }, { id: 'p1', nombre: null })).toBeNull()
  })
})

describe('buscarPosiblesDuplicados', () => {
  const lista = [
    { id: 'p1', nombre: 'María López García', fechaNacimiento: '1990-04-12' },
    { id: 'p2', nombre: 'María López', edad: 34 },
    { id: 'p3', nombre: 'Roberto Sánchez', edad: 50 },
  ]

  it('ordena lo más seguro primero', () => {
    const r = buscarPosiblesDuplicados({ nombre: 'Maria Lopez Garcia', fechaNacimiento: '1990-04-12' }, lista)
    expect(r[0].paciente.id).toBe('p1')
    expect(r[0].certeza).toBe('seguro')
  })

  it('al EDITAR, un paciente no es duplicado de sí mismo', () => {
    const r = buscarPosiblesDuplicados({ id: 'p1', nombre: 'María López García', fechaNacimiento: '1990-04-12' }, lista)
    expect(r.find(x => x.paciente.id === 'p1')).toBeUndefined()
  })

  it('recorta: esto alimenta un aviso, no un reporte', () => {
    const muchos = Array.from({ length: 10 }, (_, i) => ({ id: `x${i}`, nombre: 'Ana Ruiz Peña' }))
    expect(buscarPosiblesDuplicados({ nombre: 'Ana Ruiz Peña' }, muchos).length).toBeLessThanOrEqual(3)
  })

  it('sin coincidencias devuelve lista vacía, no null', () => {
    expect(buscarPosiblesDuplicados({ nombre: 'Fernanda Quiroz Ibarra' }, lista)).toEqual([])
  })

  it('sólo se frena cuando hay una SEGURA', () => {
    expect(hayQuePreguntar(buscarPosiblesDuplicados({ nombre: 'Maria Lopez Garcia', fechaNacimiento: '1990-04-12' }, lista))).toBe(true)
    expect(hayQuePreguntar(buscarPosiblesDuplicados({ nombre: 'María López' }, lista))).toBe(false)
  })
})

/**
 * BARRIDO DE LO QUE YA ESTÁ DENTRO.
 *
 * El motor de arriba evita duplicados NUEVOS. Estos son los que ya llevan meses
 * acumulados — y son los que de verdad tienen el historial partido: las alergias
 * en un expediente y las notas recientes en el otro.
 *
 * La prueba que manda de este bloque es la del TIEMPO. Comparar todos contra
 * todos es cuadrático: con mil pacientes son medio millón de comparaciones con
 * distancia de edición dentro, y eso congela el navegador del médico. Si alguien
 * quita el bloqueo, esa prueba se cae — no se queda «un poco más lenta».
 */
describe('barrer los duplicados que ya existen', () => {
  it('encuentra el par, una sola vez', () => {
    const r = barrerDuplicados([
      { id: 'p1', nombre: 'María López García', fechaNacimiento: '1990-04-12' },
      { id: 'p2', nombre: 'Lopez Garcia, Maria', fechaNacimiento: '1990-04-12' },
      { id: 'p3', nombre: 'Roberto Sánchez', edad: 50 },
    ])
    expect(r.pares).toHaveLength(1)
    expect(r.pares[0].certeza).toBe('seguro')
    expect(r.revisados).toBe(3)
  })

  it('UN PAR NO SE REPITE aunque coincida por varias señales', () => {
    // Comparten teléfono Y fecha Y apellido: cae en tres bloques. Si saliera una
    // vez por bloque, la pantalla diría que hay tres duplicados donde hay uno.
    const r = barrerDuplicados([
      { id: 'p1', nombre: 'Ana Ruiz Peña', telefono: '6641112233', fechaNacimiento: '1985-02-02' },
      { id: 'p2', nombre: 'Ana Ruiz Peña', telefono: '6641112233', fechaNacimiento: '1985-02-02' },
    ])
    expect(r.pares).toHaveLength(1)
  })

  it('lo más seguro primero: es el orden en que hay que mirarlos', () => {
    const r = barrerDuplicados([
      { id: 'a1', nombre: 'Juan Pérez López' },
      { id: 'a2', nombre: 'Juan Pérez López' },                                   // probable
      { id: 'b1', nombre: 'Sofía Ramírez Cruz', fechaNacimiento: '1979-09-09' },
      { id: 'b2', nombre: 'Sofia Ramirez Cruz', fechaNacimiento: '1979-09-09' },  // seguro
    ])
    expect(r.pares[0].certeza).toBe('seguro')
  })

  it('la familia que comparte celular NO sale como duplicado', () => {
    const r = barrerDuplicados([
      { id: 'm', nombre: 'Rosa Hernández Cruz', telefono: '6645551234' },
      { id: 'h1', nombre: 'Diego Hernández Cruz', telefono: '6645551234' },
      { id: 'h2', nombre: 'Sofía Hernández Cruz', telefono: '6645551234' },
    ])
    expect(r.pares).toEqual([])
  })

  it('un padre y un hijo con el mismo nombre tampoco', () => {
    const r = barrerDuplicados([
      { id: 'p', nombre: 'José Martínez Soto', fechaNacimiento: '1962-08-01' },
      { id: 'h', nombre: 'José Martínez Soto', fechaNacimiento: '1990-08-01' },
    ])
    expect(r.pares).toEqual([])
  })

  it('una lista sin duplicados devuelve vacío, no ruido', () => {
    const r = barrerDuplicados([
      { id: '1', nombre: 'Ana Ruiz Peña' },
      { id: '2', nombre: 'Fernanda Quiroz Ibarra' },
      { id: '3', nombre: 'Roberto Sánchez Melo' },
    ])
    expect(r.pares).toEqual([])
  })

  it('sin id no se compara: no habría expediente que abrir', () => {
    const r = barrerDuplicados([
      { nombre: 'Ana Ruiz Peña' },
      { nombre: 'Ana Ruiz Peña' },
    ])
    expect(r.pares).toEqual([])
  })

  it('EL BLOQUEO ES LO QUE LO HACE VIABLE — 3000 pacientes en menos de 2 s', () => {
    /**
     * Sin bloquear, 3000 pacientes son 4.5 millones de comparaciones con
     * distancia de edición dentro: el navegador se queda colgado y el médico
     * cierra la aplicación. Esta prueba es el techo que impide que alguien
     * «simplifique» quitando los bloques.
     */
    const muchos = Array.from({ length: 3000 }, (_, i) => ({
      id: `p${i}`,
      nombre: `Nombre${i} Apellido${i % 97} Segundo${i % 89}`,
      telefono: `66400${String(i).padStart(5, '0')}`,
    }))
    // Dos que SÍ son el mismo, escondidos entre los tres mil.
    muchos.push({ id: 'x1', nombre: 'Guadalupe Villaseñor Ochoa', telefono: '6649990000' })
    muchos.push({ id: 'x2', nombre: 'Villasenor Ochoa, Guadalupe', telefono: '6649990000' })

    const t0 = Date.now()
    const r = barrerDuplicados(muchos)
    const ms = Date.now() - t0

    expect(ms).toBeLessThan(2000)
    expect(r.pares.some(p => (p.a.id === 'x1' && p.b.id === 'x2') || (p.a.id === 'x2' && p.b.id === 'x1'))).toBe(true)
  })

  it('un bloque gigante se salta, y SE DICE', () => {
    /**
     * Doscientos pacientes con el mismo apellido no son doscientos duplicados:
     * es un bloque inútil que devolvería el coste cuadrático. Se descarta
     * entero — pero se declara en `bloquesIgnorados`, porque un recorte
     * silencioso se lee como «no había nada».
     */
    const muchos = Array.from({ length: 200 }, (_, i) => ({
      id: `g${i}`, nombre: `Nombre${i} Garcia Lopez`,
    }))
    const r = barrerDuplicados(muchos)
    expect(r.bloquesIgnorados.length).toBeGreaterThan(0)
  })
})

/**
 * FUNDIR CON QUIEN NO ES — el error que ningún barrido puede encontrar después.
 *
 * Cuando alguien agenda desde el asistente no hay nadie a quien preguntar: hay
 * que decidir solo si es un paciente que ya existe o uno nuevo. Y los dos
 * errores posibles NO son comparables:
 *
 *  · Crear un duplicado parte el historial. Es malo y es RECUPERABLE.
 *  · Fundir con quien no es cuelga la cita —y después la nota y la receta— del
 *    expediente de OTRA PERSONA. No se ve como un error: se ve como un paciente
 *    que vino a consulta.
 *
 * Todo este bloque existe para que, ante la duda, se cree.
 */
describe('elegir expediente para una cita del asistente', () => {
  it('EL HIJO QUE AGENDA CON EL CELULAR DE SU MADRE', () => {
    /**
     * Éste era el fallo, y es el peor de toda la serie. La regla vieja fundía por
     * TELÉFONO A SOLAS, sin mirar el nombre: con la madre registrada con el
     * número de la casa, la cita del hijo se colgaba del expediente de ella. Todo
     * lo que se escribiera después —diagnóstico, alergias, prescripción— quedaba
     * en la persona equivocada, con la firma del médico encima.
     */
    const existentes = [{ id: 'madre', nombre: 'Rosa Hernández Cruz', telefono: '6645551234' }]
    const r = elegirExpedienteParaCita(
      { nombre: 'Diego Hernández Cruz', telefono: '6645551234' },
      existentes,
    )
    expect(r).toBeNull()
  })

  it('el paciente que vuelve SÍ se reconoce, aunque escriba distinto su nombre', () => {
    const existentes = [{ id: 'p1', nombre: 'María López García', telefono: '6641234567' }]
    const r = elegirExpedienteParaCita(
      { nombre: 'Lopez Garcia, Maria', telefono: '664 123 4567' },
      existentes,
    )
    expect(r?.id).toBe('p1')
  })

  it('mismo nombre pero teléfonos que se contradicen → se crea uno nuevo', () => {
    /**
     * Aquí se acepta a propósito crear un duplicado del mismo paciente —el que
     * llamó desde otro número—. Sin nadie a quien preguntar, dos homónimos con
     * números distintos son dos personas: el duplicado se arregla después, y
     * escribir en el paciente equivocado no.
     */
    const existentes = [{ id: 'p1', nombre: 'Juan Pérez López', telefono: '6641112222' }]
    const r = elegirExpedienteParaCita(
      { nombre: 'Juan Pérez López', telefono: '6649998888' },
      existentes,
    )
    expect(r).toBeNull()
  })

  it('si al existente le falta el teléfono y hay una SEGUNDA señal, se funde', () => {
    /**
     * RT-001 (Panel de Lujo 2026-09) — ESTE CASO SE REESCRIBIÓ, no se borró.
     *
     * Decía «si al existente le falta el teléfono, no hay contradicción: se
     * funde», con el nombre como única señal. La lectura que quería fijar —el
     * paciente que vuelve y ahora sí da su número— es cierta y sigue aquí; lo
     * que era falso es que el NOMBRE A SECAS bastara para sostenerla: con esa
     * regla, «Juan Pérez Ramírez» de 68 años sin teléfono se quedaba con la
     * cita de su hijo homónimo. Ahora la identidad la sostiene la fecha de
     * nacimiento y el teléfono sólo confirma. El caso sin segunda señal —que
     * hoy devuelve `null`— vive en
     * `un-homonimo-no-se-cuelga-del-expediente-sin-telefono.test.ts`.
     */
    const existentes = [{ id: 'p1', nombre: 'Ana Ruiz Peña', telefono: '', fechaNacimiento: '1980-03-15' }]
    const r = elegirExpedienteParaCita(
      { nombre: 'Ana Ruiz Peña', telefono: '6647778899', fechaNacimiento: '1980-03-15' },
      existentes,
    )
    expect(r?.id).toBe('p1')
  })

  it('DOS CANDIDATOS IGUAL DE BUENOS → se crea uno nuevo', () => {
    // Elegir «el primero» entre dos expedientes indistinguibles es echarlo a
    // cara o cruz con el expediente de alguien.
    const existentes = [
      { id: 'a', nombre: 'Juan Pérez López' },
      { id: 'b', nombre: 'Juan Pérez López' },
    ]
    expect(elegirExpedienteParaCita({ nombre: 'Juan Pérez López' }, existentes)).toBeNull()
  })

  it('un homónimo con distinta fecha de nacimiento tampoco se funde', () => {
    const existentes = [{ id: 'padre', nombre: 'José Martínez Soto', fechaNacimiento: '1962-08-01' }]
    const r = elegirExpedienteParaCita(
      { nombre: 'José Martínez Soto', fechaNacimiento: '1990-08-01' },
      existentes,
    )
    expect(r).toBeNull()
  })

  it('sin nada parecido, se crea', () => {
    const existentes = [{ id: 'p1', nombre: 'Ana Ruiz Peña', telefono: '6641112233' }]
    expect(elegirExpedienteParaCita({ nombre: 'Fernanda Quiroz Ibarra', telefono: '6641112233' }, existentes)).toBeNull()
  })

  it('lista vacía: no hay con qué fundir', () => {
    expect(elegirExpedienteParaCita({ nombre: 'Ana Ruiz Peña' }, [])).toBeNull()
  })
})
