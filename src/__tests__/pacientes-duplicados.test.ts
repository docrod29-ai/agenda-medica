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
  UMBRAL_NOMBRE,
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
