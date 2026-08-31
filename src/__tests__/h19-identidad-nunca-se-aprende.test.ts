/**
 * GOLDEN — H-19 · el aprendizaje del dictado NUNCA puede volver identidad en
 * vocabulario reutilizable.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * `esAprendible(par, excluir)` recibía las partes del nombre del paciente para
 * excluirlas. El parámetro tenía **valor por omisión `[]`**, y una lista vacía
 * se trataba como «no hay nada que proteger». Pero una lista vacía significa
 * dos cosas distintas y el código no podía distinguirlas:
 *
 *     a) este paciente no tiene nombre registrado
 *     b) NO SÉ quién es el paciente — todavía no cargó, o falló la lectura
 *
 * En el caso (b) el filtro trabajaba **sin contexto de identidad** y dejaba
 * pasar apellidos enteros. Eso es fail-OPEN en la única compuerta que separa el
 * expediente de un vocabulario COMPARTIDO POR CONSULTORIO.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Leyendo la ruta real, no la firma. En `consulta/[patientId]/page.tsx` el
 * paciente y las notas se piden en el MISMO efecto como dos promesas
 * independientes (deps `[clinicId, patientId]`). La derivación del aprendizaje
 * vive dentro del `.then` de `getNotas` y lee `patient?.nombre` **del closure
 * del render en que corrió el efecto** — donde `patient` todavía es `null`.
 * `setPatient` no vuelve a disparar el efecto, así que ese closure NUNCA ve el
 * nombre: `partesDelNombre(undefined)` → `[]` en cada carga.
 *
 * Resultado: el filtro corría siempre ciego, y al firmar la nota `acumular()`
 * escribía lo aprendido en `clinics/{clinicId}/asr_aprendizaje` — visible para
 * TODOS los pacientes de ese consultorio.
 *
 * ── LA CAUSA RAÍZ ────────────────────────────────────────────────────────────
 *
 * No es «faltaba un filtro»: el filtro estaba y era correcto **cuando le daban
 * el contexto**. La causa raíz es que la ausencia de contexto de identidad era
 * **irrepresentable**, y por omisión se leía como ausencia de identidad.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * Ausencia de dato no es dato de ausencia (regla 4 de seguridad clínica) — aquí
 * aplicada a la identidad. Si no se sabe quién es el paciente, NO se aprende
 * nada. Cero. Un vocabulario que no se aprendió cuesta una corrección más; un
 * apellido en el vocabulario del consultorio no se puede deshacer.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 *
 * NO detecta nombres propios por sí solo: sin la lista del paciente que está
 * enfrente, «González» y «gluconato» son dos cadenas y ninguna regla
 * determinista las separa (ver `LO_QUE_NO_DETECTA` en `minimizar-phi`). Por eso
 * la defensa es la lista + el fail-closed, no un detector.
 *
 * NO cubre el nombre de un TERCERO dictado en la nota (un familiar, otro
 * médico): eso no está en la lista del paciente y el filtro no lo ve. Se
 * declara aquí para que nadie lo dé por cubierto.
 *
 * NO cubre lo ya acumulado antes de este arreglo: el vocabulario existente en
 * Firestore no se audita desde aquí.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  esAprendible, paresDeUnaNota, loAprendido, partesDelNombre, fusionar,
  identidadDe, IDENTIDAD_DESCONOCIDA, POR_QUE_SIN_IDENTIDAD_NO_SE_APRENDE,
  type Aprendido,
} from '@/lib/asr/aprendizaje'
import { idDePalabra } from '@/lib/asr/aprendizaje-firestore'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')

/** Paciente SINTÉTICO. Cero pacientes reales (regla de datos y privacidad). */
const PACIENTE = { nombre: 'Mariana Guadalupe Betancourt Villalpando' }
const OTRO_PACIENTE = { nombre: 'Rogelio Fuenmayor Icaza' }

const yo = identidadDe(PACIENTE.nombre)
const otro = identidadDe(OTRO_PACIENTE.nombre)

describe('H-19 · identidad del paciente NUNCA se vuelve vocabulario', () => {
  it('1 · el nombre completo no se aprende', () => {
    for (const parte of ['mariana', 'guadalupe', 'betancourt', 'villalpando']) {
      expect(esAprendible({ oido: `${parte}x`, corregido: parte }, yo), parte).toBe(false)
      expect(esAprendible({ oido: parte, corregido: `${parte}x` }, yo), parte).toBe(false)
    }
  })

  it('2 · el apellido no se aprende, ni siquiera dentro de una nota entera', () => {
    const r = paresDeUnaNota(
      'la paciente betancur refiere tos seca',
      'la paciente Betancourt refiere tos seca',
      yo,
    )
    expect(r).toEqual([])
  })

  it('3 · un FRAGMENTO identificable no se aprende', () => {
    // «betanc» no es igual a ninguna parte del nombre: la igualdad exacta lo
    // dejaba pasar. Un fragmento de apellido sigue identificando.
    for (const frag of ['betanc', 'betancou', 'villalpan', 'guadalup']) {
      expect(esAprendible({ oido: 'betanco', corregido: frag }, yo), frag).toBe(false)
      expect(esAprendible({ oido: frag, corregido: 'betanco' }, yo), frag).toBe(false)
    }
  })

  it('4 · el nombre MAL ESCRITO no se aprende', () => {
    // Es el caso que más importa: el motor oye mal el apellido y el médico lo
    // corrige. Ninguno de los dos lados tiene por qué coincidir LETRA A LETRA
    // con el expediente, y la igualdad exacta fallaba justo ahí.
    for (const mal of ['betancurt', 'betancour', 'vetancourt', 'villalpanda', 'mariama']) {
      expect(esAprendible({ oido: mal, corregido: 'consulta' }, yo), mal).toBe(false)
      expect(esAprendible({ oido: 'consulta', corregido: mal }, yo), mal).toBe(false)
    }
  })

  it('5 · un término médico legítimo CONSERVA el flujo permitido', () => {
    // El filtro es quirúrgico: quita la identidad, no la consulta entera.
    expect(paresDeUnaNota('le doy sefriaxona hoy', 'le doy ceftriaxona hoy', yo))
      .toEqual([{ oido: 'sefriaxona', corregido: 'ceftriaxona' }])
    expect(esAprendible({ oido: 'lebofloxacino', corregido: 'levofloxacino' }, yo)).toBe(true)
  })

  it('6 · lo derivado de un paciente no contamina al siguiente', () => {
    const deMi = loAprendido(
      paresDeUnaNota(
        'betancur toma sefriaxona y sefriaxona',
        'Betancourt toma ceftriaxona y ceftriaxona',
        yo,
      ),
      2, yo,
    )
    const plano = JSON.stringify(deMi).toLowerCase()
    for (const parte of partesDelNombre(PACIENTE.nombre)) {
      expect(plano, parte).not.toContain(parte.toLowerCase().slice(0, 5))
    }
    // Y al fusionarlo con lo del consultorio para OTRO paciente, sigue limpio.
    const delConsultorio: Aprendido[] = deMi
    const enLaConsultaDeOtro = fusionar(
      loAprendido(paresDeUnaNota('tomo metfromina', 'tomo metformina', otro), 1, otro),
      delConsultorio,
    )
    const plano2 = JSON.stringify(enLaConsultaDeOtro).toLowerCase()
    for (const parte of [...partesDelNombre(PACIENTE.nombre), ...partesDelNombre(OTRO_PACIENTE.nombre)]) {
      expect(plano2, parte).not.toContain(parte.toLowerCase().slice(0, 5))
    }
  })

  it('7 · el vocabulario vive bajo el consultorio, no cruza de tenant', () => {
    const fs = leer('firestore.rules')
    expect(fs).toMatch(/match \/asr_aprendizaje\/\{palabra\}/)
    // Leer y escribir exigen ser médico DE ESE consultorio.
    const bloque = fs.slice(fs.indexOf('match /asr_aprendizaje/{palabra}'))
      .slice(0, 500)
    expect(bloque).toMatch(/isMedico\(clinicId\)/)
    // La ruta del cliente se deriva del clinicId: una sola definición.
    const src = leer('src/lib/asr/aprendizaje-firestore.ts')
    expect(src).toMatch(/collection\(db, 'clinics', clinicId, 'asr_aprendizaje'\)/)
  })

  it('8 · nada identificable llega a lo que se escribe ni a lo que se registra', () => {
    // `acumular` escribe EXACTAMENTE palabra/veces/oidoComo. Si la identidad no
    // entra en `Aprendido`, no puede salir por ahí.
    const deMi = loAprendido(
      paresDeUnaNota(
        'betancur con sefriaxona, betancur con sefriaxona',
        'Betancourt con ceftriaxona, Betancourt con ceftriaxona',
        yo,
      ),
      2, yo,
    )
    for (const a of deMi) {
      expect(idDePalabra(a.palabra)).not.toMatch(/betanc|villalp|mariana|guadalup/)
      for (const o of a.oidoComo) expect(o).not.toMatch(/betanc|villalp|mariana|guadalup/)
    }
    // El aprendizaje jamás registra el nombre: el módulo no lo recibe entero.
    const lib = leer('src/lib/asr/aprendizaje-firestore.ts')
    expect(lib).not.toMatch(/console\.(log|error|warn)/)
  })

  it('9 · FAIL SAFE — sin identidad conocida NO se aprende NADA', () => {
    // Una lista vacía significaba «no hay nada que proteger». Significa «no sé
    // quién es el paciente», y entonces no se aprende.
    expect(esAprendible({ oido: 'sefriaxona', corregido: 'ceftriaxona' }, IDENTIDAD_DESCONOCIDA)).toBe(false)
    expect(esAprendible({ oido: 'betancur', corregido: 'betancourt' }, IDENTIDAD_DESCONOCIDA)).toBe(false)
    expect(paresDeUnaNota('le doy sefriaxona', 'le doy ceftriaxona', IDENTIDAD_DESCONOCIDA)).toEqual([])
    expect(loAprendido([{ oido: 'sefriaxona', corregido: 'ceftriaxona' }], 1, IDENTIDAD_DESCONOCIDA)).toEqual([])
    // Un paciente cuyo nombre no se pudo leer es identidad DESCONOCIDA, no
    // identidad vacía.
    expect(identidadDe(undefined)).toEqual(IDENTIDAD_DESCONOCIDA)
    expect(identidadDe('')).toEqual(IDENTIDAD_DESCONOCIDA)
    expect(identidadDe('  ')).toEqual(IDENTIDAD_DESCONOCIDA)
    // Y un nombre que sólo trae partículas cortas tampoco protege a nadie.
    expect(identidadDe('de la')).toEqual(IDENTIDAD_DESCONOCIDA)
    expect(POR_QUE_SIN_IDENTIDAD_NO_SE_APRENDE).toMatch(/no se aprende/i)
  })

  it('los identificadores con forma propia tampoco se aprenden', () => {
    // Se reutiliza `redactarIdentificadores`, que ya conoce CURP, RFC, correo,
    // teléfono y folios. No se escribe un criterio nuevo.
    const identificadores = [
      'BEVM850312MDFTLR09',            // CURP sintético
      'correo.paciente@ejemplo.mx',    // correo
      'expediente-0004821',            // folio
      '5512345678',                    // teléfono
    ]
    for (const id of identificadores) {
      expect(esAprendible({ oido: id, corregido: 'ceftriaxona' }, yo), id).toBe(false)
      expect(esAprendible({ oido: 'ceftriaxona', corregido: id }, yo), id).toBe(false)
    }
  })
})

describe('H-19 · REACHABILITY — la ruta real, no la firma', () => {
  const page = leer('src/app/(dashboard)/consulta/[patientId]/page.tsx')

  it('la consulta deriva el aprendizaje con la identidad YA CARGADA', () => {
    // El defecto era el closure: el efecto que derivaba corría con `patient`
    // en `null` y no se volvía a disparar. La derivación tiene que depender
    // del paciente cargado.
    expect(page).toMatch(/const identidad = useMemo\(\(\) => identidadDe\(patient\?\.nombre\), \[patient\?\.nombre\]\)/)
    expect(page).toMatch(/identidad\.conocida/)
    expect(page).not.toMatch(/partesDelNombre\(patient\?\.nombre\)/)
  })

  it('dictado → corrección → filtro → aprendizaje → reutilización', () => {
    // La cadena completa, con el mismo contrato que usa la pantalla.
    const notasFirmadas = [
      { motor: 'la paciente betancur toma sefriaxona', crudo: 'la paciente Betancourt toma ceftriaxona' },
      { motor: 'betancur sigue con sefriaxona', crudo: 'Betancourt sigue con ceftriaxona' },
    ]
    const pares = notasFirmadas.flatMap(n => paresDeUnaNota(n.motor, n.crudo, yo))
    const aprendido = loAprendido(pares, undefined, yo)
    // Lo que se reutiliza: sólo el fármaco.
    expect(aprendido.map(a => a.palabra)).toEqual(['ceftriaxona'])
    expect(aprendido[0].veces).toBe(2)
    expect(aprendido[0].oidoComo).toEqual(['sefriaxona'])
  })

  it('si el paciente no cargó, la pantalla no acumula nada', () => {
    // Mismo escenario, identidad desconocida: la cadena entera devuelve vacío y
    // `acumular` no llega a llamarse (la pantalla la guarda tras `length > 0`).
    const pares = paresDeUnaNota('betancur toma sefriaxona', 'Betancourt toma ceftriaxona', IDENTIDAD_DESCONOCIDA)
    expect(loAprendido(pares, undefined, IDENTIDAD_DESCONOCIDA)).toEqual([])
    expect(page).toMatch(/if \(deEstePaciente\.length > 0\)/)
    expect(page).toMatch(/identidad\.conocida\s*$/m)
  })
})
