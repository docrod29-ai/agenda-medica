/**
 * GUARDIÁN + GOLDEN — el archivo que dice «expediente» tiene que ser el
 * expediente.
 *
 * ── EL FALLO ─────────────────────────────────────────────────────────────────
 *
 * El único botón de exportación descargaba `expediente_<nombre>_FHIR_R4.json`
 * con el paciente y **sólo las notas firmadas**. Quedaban fuera, todas escritas
 * por la propia aplicación y todas declaradas en `firestore.rules`:
 *
 *   adendas · versiones · laboratorios · fotografía clínica · resumen clínico
 *   (alergias estructuradas y antecedentes) · formularios previos ·
 *   internamientos con sus signos · citas · bitácora de accesos
 *
 * Y los borradores se descartaban **en silencio**: contenido clínico sin firmar
 * desaparecía sin que nadie lo señalara.
 *
 * Un archivo llamado «expediente» que no lo es no falla: se entrega, se recibe,
 * y los dos lados creen que ahí está todo.
 *
 * ── POR QUÉ ESTE ARCHIVO ES UN GUARDIÁN Y NO SÓLO UNA PRUEBA ─────────────────
 *
 * Porque esto ya se olvidó una vez. La comprobación de abajo lee las rutas
 * `match /` que `firestore.rules` declara **bajo `patients/{docId}`** y exige
 * que cada una esté en el manifiesto: **añadir una subcolección al paciente y no
 * declararla en la exportación pone el CI en rojo.**
 *
 * Es la única forma de que la próxima subcolección no vuelva a quedarse fuera.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  SECCIONES, SECCIONES_POR_REFERENCIA, EXCLUIDAS, clavesEsperadas, indiceDeSecciones,
  POR_QUE_SE_DECLARA_LO_QUE_FALTA,
} from '@/lib/expediente/exportacion'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')
const reglas = leer('firestore.rules')

/**
 * Las subcolecciones de PRIMER nivel bajo `patients/{docId}`.
 *
 * Se recorta el bloque de reglas por indentación: `match /patients/{docId}` está
 * a 6 espacios, así que sus hijas directas están a 8. Las nietas (`versions`,
 * `adendas`) están a 10 y se comprueban aparte, dentro de su madre.
 */
function subcoleccionesDelPaciente(): string[] {
  const lineas = reglas.split('\n')
  const inicio = lineas.findIndex(l => /^ {6}match \/patients\/\{docId\} \{/.test(l))
  expect(inicio, 'no se encontró el bloque de patients en firestore.rules').toBeGreaterThan(-1)
  const out: string[] = []
  for (let i = inicio + 1; i < lineas.length; i++) {
    const l = lineas[i]
    if (/^ {6}\}/.test(l)) break                      // se cerró el bloque del paciente
    const m = /^ {8}match \/([A-Za-z_]+)\//.exec(l)
    if (m) out.push(m[1])
  }
  return out.sort()
}

describe('el manifiesto cubre TODO lo que cuelga del paciente', () => {
  it('el guardián lee las reglas de verdad (si no, pasaría vacío)', () => {
    expect(subcoleccionesDelPaciente().length).toBeGreaterThan(3)
  })

  it('ninguna subcolección del paciente se queda fuera de la exportación', () => {
    /**
     * Si esto se pone rojo: o la añades a `SECCIONES`, o la declaras en
     * `EXCLUIDAS` con su razón. Lo segundo es una decisión —estás diciendo que
     * ese dato no es del titular—, no un trámite.
     */
    const enReglas = subcoleccionesDelPaciente()
    const enManifiesto = new Set([...SECCIONES.map(s => s.ruta), ...Object.keys(EXCLUIDAS)])
    const olvidadas = enReglas.filter(r => !enManifiesto.has(r))
    expect(olvidadas, `subcolecciones del paciente sin exportar: ${olvidadas.join(', ')}`).toEqual([])
  })

  it('y el manifiesto no inventa colecciones que no existen', () => {
    // Una sección que apunta a una ruta inexistente produce un archivo con un
    // array vacío que se lee como «no hay nada», y no es verdad: es que no hay
    // esa colección.
    const enReglas = new Set(subcoleccionesDelPaciente())
    const fantasmas = SECCIONES.map(s => s.ruta).filter(r => !enReglas.has(r))
    expect(fantasmas, `rutas del manifiesto que no existen en las reglas: ${fantasmas.join(', ')}`).toEqual([])
  })

  it('las sub-subcolecciones de la nota viajan DENTRO de su nota', () => {
    // Una adenda suelta no dice a qué nota enmienda.
    const notas = SECCIONES.find(s => s.clave === 'notas')!
    expect(notas.hijas?.map(h => h.ruta).sort()).toEqual(['adendas', 'versions'])
  })

  it('cada sección dice qué es, en español, para quien abra el archivo', () => {
    for (const s of SECCIONES) expect(s.descripcion.length, s.clave).toBeGreaterThan(25)
    for (const r of SECCIONES_POR_REFERENCIA) expect(r.descripcion.length, r.clave).toBeGreaterThan(25)
  })

  it('cada exclusión dice POR QUÉ', () => {
    for (const [c, razon] of Object.entries(EXCLUIDAS)) {
      expect(razon.length, c).toBeGreaterThan(30)
    }
  })
})

describe('lo que es suyo aunque no cuelgue de él', () => {
  it('citas, internamientos y bitácora se filtran por su identificador', () => {
    const claves = SECCIONES_POR_REFERENCIA.map(r => r.clave).sort()
    expect(claves).toEqual(['bitacora', 'citas', 'internamientos'])
  })

  it('cada una declara por QUÉ campo se filtra', () => {
    // Filtrar por el campo equivocado entrega el expediente de otro.
    for (const r of SECCIONES_POR_REFERENCIA) {
      expect(['pacienteId', 'patientId'], r.clave).toContain(r.campo)
    }
  })
})

describe('la ruta arma el expediente y declara lo que falta', () => {
  const ruta = leer('src', 'app', 'api', 'expediente', 'exportar', '[patientId]', 'route.ts')

  it('es del SERVIDOR, con el Admin SDK', () => {
    expect(ruta).toContain("from '@/lib/firebase-admin'")
  })

  it('exige el permiso del MÉDICO, no el del mostrador', () => {
    // Baja diagnósticos, medicamentos y alergias: NOM-004 los reserva al médico.
    expect(ruta).toContain("verificarCapacidad(req, clinicId, 'clinico.escribir')")
  })

  it('recorre el manifiesto, no una lista escrita a mano', () => {
    expect(ruta).toContain('for (const s of SECCIONES)')
    expect(ruta).toContain('for (const r of SECCIONES_POR_REFERENCIA)')
  })

  it('una sección ilegible se DECLARA y no tumba el archivo', () => {
    /**
     * Un expediente al 90 % que dice qué le falta es útil; uno que revienta
     * entero no le sirve a nadie.
     */
    expect(ruta).toContain("anotar(s.clave, 'No se pudo leer esta sección.')")
    expect(ruta).toContain('faltantes')
  })

  it('el recorte por tope también se declara', () => {
    // Un recorte que nadie ve se lee como «eso era todo».
    expect(ruta).toContain('Se alcanzó el tope de ${TOPE} documentos')
  })

  it('el asiento de auditoría lo escribe el SERVIDOR', () => {
    /**
     * Antes lo escribía el navegador que ejecutaba la descarga — el mismo
     * código que podría saltárselo. Una salida masiva de PHI tiene que quedar
     * registrada del lado que el usuario no controla.
     */
    const i = ruta.indexOf("evento: 'export_datos'")
    expect(i).toBeGreaterThan(0)
    expect(ruta.slice(i - 400, i)).toContain("collection('audit_log')")
  })

  it('los signos del episodio viajan con su episodio', () => {
    // Sin ellos, un internamiento es una fecha de ingreso y poco más.
    expect(ruta).toContain("collection('signos')")
  })

  it('NO promete empaquetar binarios', () => {
    // De las fotos entrega la ficha y la referencia. Prometer un ZIP que no
    // existe sería peor que declararlo.
    expect(ruta).toContain('No empaqueta binarios')
    expect(ruta).not.toContain('jszip')
  })
})

describe('la pantalla lo ofrece, y ya no calla los borradores', () => {
  const pag = leer('src', 'app', '(dashboard)', 'expediente', '[patientId]', 'page.tsx')

  it('hay un botón de expediente COMPLETO que llama a la ruta', () => {
    expect(pag).toContain('/api/expediente/exportar/')
    expect(pag).toContain('Expediente completo')
  })

  it('y enseña lo que no se pudo leer en vez de tragárselo', () => {
    expect(pag).toContain('no se pudieron leer')
  })

  it('el botón de FHIR DICE cuántas notas en borrador deja fuera', () => {
    /**
     * FHIR sólo lleva las firmadas y antes las descartaba en silencio: un
     * archivo con huecos que nadie señala se entrega creyendo que está
     * completo.
     */
    expect(pag).toContain("const borradores = notas.filter(n => n.estado !== 'firmada').length")
    expect(pag).toContain('en borrador NO van en FHIR')
  })
})

describe('el archivo se explica a sí mismo', () => {
  it('trae un índice legible de cada sección', () => {
    const indice = indiceDeSecciones()
    expect(Object.keys(indice)).toContain('notas.adendas')
    expect(indice['notas.adendas']).toMatch(/NOM-004/)
  })

  it('las claves esperadas son las del manifiesto, sin duplicados', () => {
    const claves = clavesEsperadas()
    expect(new Set(claves).size).toBe(claves.length)
    expect(claves).toContain('laboratorios')
    expect(claves).toContain('fotos')
    expect(claves).toContain('bitacora')
  })

  it('está escrito por qué `faltantes` viaja siempre', () => {
    expect(POR_QUE_SE_DECLARA_LO_QUE_FALTA).toMatch(/peor que no entregarlo/i)
  })
})
