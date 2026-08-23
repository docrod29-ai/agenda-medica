/**
 * GOLDEN — LA MIGRACIÓN NO INVENTA NADA.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * El importador que había (`(dashboard)/migracion/page.tsx` + `csv-pacientes.ts`)
 * inventaba en cuatro sitios, los cuatro en silencio:
 *
 *  1. `fechaNacimiento` pasaba en crudo al expediente. Un archivo con `03/04/25`
 *     entraba como texto y `edadEnAnios` lo interpretaba a su manera, sin que
 *     nadie hubiera decidido si era abril o marzo.
 *  2. `sexo` sólo aceptaba las tres cadenas exactas del producto; un archivo con
 *     `M`/`F` perdía la columna entera y el campo quedaba `undefined`, que se
 *     lee como «no tiene», no como «no lo sé».
 *  3. `construirFilas` descartaba las filas sin nombre ANTES de clasificarlas
 *     (`.filter(f => f.nombre !== '')`), así que el estado `sin_nombre` de
 *     `clasificarFilas` era código muerto y esas filas desaparecían del conteo.
 *  4. Las columnas que no mapeaban a ningún campo conocido se tiraban sin dejar
 *     rastro de que existieron.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Leyendo el importador de arriba abajo antes de escribir el carril #311, con la
 * pregunta «¿qué le pasa a un dato que no entendemos?». Las cuatro respuestas
 * eran la misma: desaparece.
 *
 * ── LA CAUSA RAÍZ ────────────────────────────────────────────────────────────
 *
 * El importador sólo tenía dos cubos: entra o no entra. Sin un tercer estado
 * para «lo tengo pero no sé leerlo», toda duda tiene que resolverse a favor de
 * uno de los dos — y resolverla a favor de «entra» inventa, a favor de «no
 * entra» pierde.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * `Normalizado<T>` tiene CUATRO clases, y `ambiguo` es una de ellas. Una duda no
 * se puede colapsar a un valor ni a un error sin pasar por una decisión humana.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 *
 *  · No prueba la PANTALLA de migración: sigue usando el camino viejo. Está en
 *    el registro de riesgos como P0-1 y su arreglo es de #306.
 *  · No prueba escrituras reales a Firestore: estos módulos son puros y no
 *    escriben. La idempotencia contra la base de verdad está en el HANDOFF.
 *  · El vocabulario de `sexo` es VOCABULARIO, no criterio: que falte un término
 *    significa que ese valor va a cuarentena, no que se dé por bueno.
 */
import { describe, it, expect } from 'vitest'
import {
  normalizarFecha, normalizarSexo, normalizarTexto, normalizarTelefono,
  normalizarCurp, normalizarEmail, normalizarCantidad,
} from '@/lib/migration/normalizacion'
import { RAZONES, RAZON_TEXTO, DESTINOS, rechazada, transicionValida, puedeEscribir, ETAPAS } from '@/lib/migration/contrato'
import { ADAPTADOR_CSV, ADAPTADOR_XLSX, adaptadorPara } from '@/lib/migration/adaptadores'
import { mapear, faltaIdentidad, huellaDeMapeo } from '@/lib/migration/mapeo'
import { ensayar } from '@/lib/migration/ensayo'

const HOY = '2026-08-23'

/* ═══════════════ 4. LA FECHA AMBIGUA NO SE ADIVINA ═══════════════ */

describe('fecha ambigua', () => {
  it('03/04/25 sin formato declarado NO se resuelve: devuelve las dos lecturas', () => {
    const r = normalizarFecha('03/04/25', { hoy: HOY })
    expect(r.clase).toBe('ambiguo')
    if (r.clase !== 'ambiguo') throw new Error('debía ser ambigua')
    expect(r.razon).toBe('AMBIGUOUS_DATE')
    // 3 de abril y 4 de marzo. Las dos, sin preferir ninguna.
    expect(r.lecturas).toEqual(['2025-03-04', '2025-04-03'])
  })

  it('AL REVÉS: con el formato declarado por el médico, ya no es ambigua', () => {
    const dmy = normalizarFecha('03/04/25', { hoy: HOY, formato: 'dmy' })
    expect(dmy.clase).toBe('valor')
    if (dmy.clase === 'valor') expect(dmy.valor).toBe('2025-04-03')

    const mdy = normalizarFecha('03/04/25', { hoy: HOY, formato: 'mdy' })
    expect(mdy.clase).toBe('valor')
    if (mdy.clase === 'valor') expect(mdy.valor).toBe('2025-03-04')
  })

  it('se desambigua sola cuando el día pasa de 12: no hay dos lecturas posibles', () => {
    const r = normalizarFecha('25/12/1980', { hoy: HOY })
    expect(r.clase).toBe('valor')
    if (r.clase === 'valor') {
      expect(r.valor).toBe('1980-12-25')
      expect(r.aplicado).toContain('desambiguada-dia-mayor-12')
    }
  })

  it('el año de dos dígitos se expande CON constancia de que hubo una suposición', () => {
    const r = normalizarFecha('25/12/80', { hoy: HOY })
    expect(r.clase).toBe('valor')
    // La constancia es el punto: quien lea el informe ve que ahí se decidió algo.
    if (r.clase === 'valor') expect(r.aplicado).toContain('ano-2-digitos-pivote-30')
  })

  it('ISO nunca es ambigua', () => {
    const r = normalizarFecha('1980-12-25', { hoy: HOY })
    expect(r.clase).toBe('valor')
    if (r.clase === 'valor') expect(r.valor).toBe('1980-12-25')
  })

  it('rechaza lo imposible en vez de corregirlo: 31 de febrero, futuro, 200 años', () => {
    expect(normalizarFecha('31/02/1980', { hoy: HOY }).clase).toBe('invalido')
    const futuro = normalizarFecha('2030-01-01', { hoy: HOY })
    expect(futuro.clase === 'invalido' && futuro.razon).toBe('DATE_IN_FUTURE')
    const viejo = normalizarFecha('1800-01-01', { hoy: HOY })
    expect(viejo.clase === 'invalido' && viejo.razon).toBe('DATE_IMPLAUSIBLE')
  })
})

/* ═══════════════ 3. AUSENCIA DE DATO NO ES DATO DE AUSENCIA ═══════════════ */

describe('el valor que no se reconoce', () => {
  it('sexo: M, F, Male y Mujer se traducen', () => {
    for (const [entrada, esperado] of [['M', 'Masculino'], ['f', 'Femenino'], ['Male', 'Masculino'], ['MUJER', 'Femenino']] as const) {
      const r = normalizarSexo(entrada)
      expect(r.clase).toBe('valor')
      if (r.clase === 'valor') expect(r.valor).toBe(esperado)
    }
  })

  it('sexo: "1" NO se traduce — hay sistemas donde 1 es hombre y otros donde es mujer', () => {
    const r = normalizarSexo('1')
    expect(r.clase).toBe('invalido')
    if (r.clase === 'invalido') expect(r.razon).toBe('UNRECOGNIZED_ENUM')
    // Y el crudo se conserva: el dato del médico no se pierde por no entenderlo.
    expect(r.crudo).toBe('1')
  })

  it('una columna VACÍA no produce un valor, y tampoco un error', () => {
    const r = normalizarSexo('')
    expect(r.clase).toBe('vacio')
    // Lo que NO puede pasar: que un vacío se convierta en un dato.
    expect(r).not.toHaveProperty('valor')
  })

  it('la cantidad sin unidad NO se completa con mg', () => {
    const r = normalizarCantidad('500')
    expect(r.clase).toBe('invalido')
    if (r.clase === 'invalido') expect(r.razon).toBe('MISSING_UNIT')
    // Con unidad sí entra, y la unidad es la que vino.
    const c = normalizarCantidad('500 mcg')
    expect(c.clase === 'valor' && c.valor).toEqual({ numero: 500, unidad: 'mcg' })
  })
})

/* ═══════════════ 1. LECTURA DETERMINISTA DEL CSV ═══════════════ */

describe('lectura del CSV', () => {
  it('separa columnas respetando comillas y cuenta TODAS las filas de origen', () => {
    const csv = 'Nombre,Teléfono\n"Pérez, Juan",6641234567\nAna López,5551112222'
    const l = ADAPTADOR_CSV.leer(csv)
    expect(l.encabezados).toEqual(['Nombre', 'Teléfono'])
    expect(l.filas).toHaveLength(2)
    expect(l.filas[0].campos['Nombre']).toBe('Pérez, Juan')
    expect(l.sourceRecords).toBe(2)
  })

  it('una fila con MÁS columnas que el encabezado es una fila rota, no un desplazamiento', () => {
    // Sin comillas, «Pérez, Juan» son dos columnas: el apellido acabaría en el
    // campo del teléfono y el teléfono en el del correo.
    const csv = 'Nombre,Teléfono\nPérez, Juan,6641234567\nAna,5551112222'
    const l = ADAPTADOR_CSV.leer(csv)
    expect(l.rotas).toHaveLength(1)
    expect(l.rotas[0].razon).toBe('ROW_ARITY_MISMATCH')
    // Y SIGUE CONTANDO como fila de origen: es lo que hace que las cuentas cuadren.
    expect(l.sourceRecords).toBe(2)
    expect(l.filas).toHaveLength(1)
  })

  it('el BOM no deja el primer encabezado sin emparejar', () => {
    const l = ADAPTADOR_CSV.leer('﻿Nombre,Teléfono\nAna,5551112222')
    expect(l.encabezados[0]).toBe('Nombre')
  })

  it('una columna sin encabezado se conserva bajo un nombre posicional', () => {
    const l = ADAPTADOR_CSV.leer('Nombre,\nAna,algo')
    expect(l.filas[0].campos['columna_2']).toBe('algo')
  })
})

/* ═══════════════ 2. MAPEO DE COLUMNAS ═══════════════ */

describe('mapeo de encabezados', () => {
  it('reutiliza los sinónimos que ya existen y conserva lo desconocido', () => {
    const m = mapear(['Nombre completo', 'Celular', 'Padecimiento actual'])
    expect(m.camposResueltos).toEqual(['nombre', 'telefono'])
    // La columna que no se entiende NO desaparece: se nombra.
    expect(m.desconocidas).toEqual(['Padecimiento actual'])
  })

  it('dos columnas al mismo campo son un CONFLICTO, no un ganador silencioso', () => {
    const m = mapear(['Nombre', 'Teléfono', 'Celular'])
    expect(m.hayConflictos).toBe(true)
    // Ninguna de las dos gana sola: `telefono` no queda resuelto.
    expect(m.camposResueltos).toEqual(['nombre'])
  })

  it('AL REVÉS: si el médico dice cuál es, el conflicto se resuelve', () => {
    const m = mapear(['Nombre', 'Teléfono', 'Celular'], { 1: 'telefono' })
    expect(m.hayConflictos).toBe(false)
    expect(m.camposResueltos).toEqual(['nombre', 'telefono'])
  })

  it('sin columna de nombre no se puede abrir un expediente', () => {
    expect(faltaIdentidad(mapear(['Teléfono', 'Correo']))).toBe(true)
    expect(faltaIdentidad(mapear(['Nombre', 'Correo']))).toBe(false)
  })

  it('la huella del mapeo distingue dos mapeos distintos', () => {
    const a = huellaDeMapeo(mapear(['Nombre', 'Celular']))
    const b = huellaDeMapeo(mapear(['Nombre', 'Celular'], { 1: 'whatsapp' }))
    expect(a).not.toBe(b)
    // Y es estable para el mismo mapeo: sin eso, el ensayo no se puede reproducir.
    expect(huellaDeMapeo(mapear(['Nombre', 'Celular']))).toBe(a)
  })
})

/* ═══════════════ 16. MISMO INSUMO → MISMO RESULTADO ═══════════════ */

describe('determinismo', () => {
  const CSV = [
    'Nombre,Teléfono,Fecha de nacimiento,Sexo,Padecimiento',
    'Ana Ruiz Soto,6641234567,1985-03-12,F,cefalea',
    'Beto Lara Cruz,5551112222,03/04/25,M,tos',
    ',5553334444,1990-01-01,F,nada',
  ].join('\n')

  it('dos ensayos del mismo archivo con el mismo mapeo dan el MISMO resultado', async () => {
    const o = { clinicId: 'c1', hoy: HOY }
    const a = await ensayar(ADAPTADOR_CSV, CSV, [], o)
    const b = await ensayar(ADAPTADOR_CSV, CSV, [], o)
    // Se compara el objeto entero, no un resumen: un resumen igual con detalles
    // distintos sería exactamente el fallo que esta prueba busca.
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('el ensayo no depende del reloj: cambiar "hoy" es lo ÚNICO que mueve una fecha', async () => {
    const a = await ensayar(ADAPTADOR_CSV, CSV, [], { clinicId: 'c1', hoy: HOY })
    const b = await ensayar(ADAPTADOR_CSV, CSV, [], { clinicId: 'c1', hoy: '2026-08-24' })
    expect(a.reconciliacion.cuentas.porDestino).toEqual(b.reconciliacion.cuentas.porDestino)
  })
})

/* ═══════════════ EL CONTRATO ═══════════════ */

describe('contrato del pipeline', () => {
  it('toda razón tiene texto en español: un rechazo sin explicación no es revisable', () => {
    for (const r of RAZONES) {
      expect(RAZON_TEXTO[r], `falta el texto de ${r}`).toBeTruthy()
      expect(RAZON_TEXTO[r].length).toBeGreaterThan(20)
    }
  })

  it('un destino que no es "accepted" SIN razón revienta: es un dato perdido en silencio', () => {
    expect(() => rechazada('quarantined', [])).toThrow(/sin razón/)
    expect(() => rechazada('rejected', ['INVALID_DATE'])).not.toThrow()
  })

  it('NINGUNA etapa anterior al ensayo y a la aprobación puede escribir', () => {
    const antesDeAprobar = ETAPAS.filter(e =>
      ['UPLOAD', 'DETECT_SCHEMA', 'MAP_FIELDS', 'NORMALIZE', 'VALIDATE',
        'MATCH_DEDUPE', 'QUARANTINE_AMBIGUOUS', 'DRY_RUN', 'HUMAN_APPROVAL'].includes(e))
    for (const e of antesDeAprobar) {
      expect(puedeEscribir(e), `${e} no puede escribir`).toBe(false)
    }
    expect(puedeEscribir('CHUNKED_IMPORT')).toBe(true)
  })

  it('no se puede saltar del ensayo directo a escribir sin pasar por la aprobación', () => {
    expect(transicionValida('DRY_RUN', 'CHUNKED_IMPORT')).toBe(false)
    expect(transicionValida('DRY_RUN', 'HUMAN_APPROVAL')).toBe(true)
    expect(transicionValida('HUMAN_APPROVAL', 'CHUNKED_IMPORT')).toBe(true)
  })

  it('de un estado terminal no se sale', () => {
    for (const e of ['COMPLETED', 'ROLLED_BACK', 'CANCELLED', 'FAILED'] as const) {
      for (const d of DESTINOS) void d
      expect(transicionValida(e, 'CHUNKED_IMPORT')).toBe(false)
    }
  })
})

/* ═══════════════ XLSX: EL HUECO ESTÁ DECLARADO, NO DISIMULADO ═══════════════ */

describe('adaptadores', () => {
  it('XLSX se reconoce, se declara NO disponible y dice qué hacer', () => {
    const a = adaptadorPara('pacientes.xlsx')
    expect(a?.id).toBe('xlsx')
    expect(a?.disponible).toBe(false)
    // El médico tiene que poder resolverlo solo: «guárdalo como CSV».
    expect(a?.porQueNo).toMatch(/CSV/i)
  })

  it('el ensayo se niega a correr con un adaptador no disponible, en vez de dar cero filas', async () => {
    await expect(ensayar(ADAPTADOR_XLSX, 'lo que sea', [], { clinicId: 'c1', hoy: HOY }))
      .rejects.toThrow(/no está disponible/)
  })
})

/* ═══════════════ NORMALIZADORES SUELTOS ═══════════════ */

describe('normalizadores', () => {
  it('el teléfono se queda en dígitos y NO se le inventa lada de país', () => {
    const r = normalizarTelefono('+52 (664) 123-4567')
    expect(r.clase === 'valor' && r.valor).toBe('526641234567')
    expect(normalizarTelefono('123').clase).toBe('invalido')
  })

  it('el apóstrofo que puso nuestra propia exportación se quita al volver a entrar', () => {
    // `csv-seguro.ts` escribe `'=cmd` al exportar. Sin esto, cada ida y vuelta
    // le añadiría uno más al nombre del paciente.
    const r = normalizarTexto("'=SUMA(A1)")
    expect(r.clase === 'valor' && r.valor).toBe('=SUMA(A1)')
    if (r.clase === 'valor') expect(r.aplicado).toContain('quitar-escape-formula')
  })

  it('un archivo mal decodificado se detecta en vez de importarse con la basura dentro', () => {
    const r = normalizarTexto('Jos� Ram�rez')
    expect(r.clase === 'invalido' && r.razon).toBe('INVALID_ENCODING')
  })

  it('los acentos y la ñ SOBREVIVEN: no se normalizan a ASCII', () => {
    const r = normalizarTexto('  José  Muñoz   Peña ')
    expect(r.clase === 'valor' && r.valor).toBe('José Muñoz Peña')
  })

  it('CURP y correo se validan por forma, no por adivinanza', () => {
    expect(normalizarCurp('RUSA850312MDFXXX09').clase).toBe('valor')
    expect(normalizarCurp('RUSA850312').clase).toBe('invalido')
    expect(normalizarEmail('ANA@Ejemplo.MX').clase === 'valor').toBe(true)
    expect(normalizarEmail('ana@@x').clase).toBe('invalido')
  })
})
