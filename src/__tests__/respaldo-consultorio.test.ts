/**
 * GUARDIÁN + GOLDEN — el archivo que dice «respaldo» tiene que respaldar.
 *
 * ── EL FALLO ─────────────────────────────────────────────────────────────────
 *
 * «Respaldo COMPLETO» (`pacientes/page.tsx`) hacía esto **en el navegador**:
 *
 *     for (const p of patients) { const historial = await getNotas(clinicId, p.id) }
 *
 * Una lectura por paciente, **en serie**, con el médico esperando, sin progreso
 * y sin forma de reanudar. Con cientos de pacientes son cientos de idas y
 * vueltas antes del primer byte; en un móvil, la pestaña se queda sin memoria.
 *
 * Y lo que bajaba eran **pacientes + notas**. Nada más: fuera quedaban adendas,
 * laboratorios, fotografía clínica, antecedentes, citas, cobros, la
 * configuración —membrete, formato de receta, firma—, los bloqueos de agenda, la
 * farmacia, los internamientos y la bitácora.
 *
 * **Un archivo llamado «respaldo» que no respalda es peor que no tenerlo**: se
 * guarda, se duerme tranquilo, y el día que hace falta no está lo que se creía.
 *
 * ── LA TERCERA VEZ QUE UN GUARDIÁN TEXTUAL SE APAGA SOLO ─────────────────────
 *
 * El detector de PHI de `authz-rutas-declaradas` busca `collection('notas')`. El
 * respaldo recorre las subcolecciones con `collection(hija)` —dinámico, porque
 * la lista vive en el manifiesto—, así que la ruta que se lleva **todos los
 * expedientes del consultorio** no contaba como lectora de PHI. Se añadió la
 * segunda señal: la colección declarada como hija en un manifiesto.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  COLECCIONES, EXCLUIDAS, indiceRespaldo,
  POR_QUE_NDJSON, POR_QUE_SE_EXCLUYEN_LOS_SECRETOS,
} from '@/lib/clinica/respaldo'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')
const reglas = leer('firestore.rules')
const ruta = leer('src', 'app', 'api', 'clinic', 'exportar', 'route.ts')

/** Las colecciones de primer nivel bajo `clinics/{clinicId}` (8 espacios → 6). */
function coleccionesDelConsultorio(): string[] {
  const lineas = reglas.split('\n')
  const inicio = lineas.findIndex(l => /^ {4}match \/clinics\/\{clinicId\} \{/.test(l))
  expect(inicio, 'no se encontró el bloque de clinics en firestore.rules').toBeGreaterThan(-1)
  const out = new Set<string>()
  for (let i = inicio + 1; i < lineas.length; i++) {
    if (/^ {4}\}/.test(lineas[i])) break
    const m = /^ {6}match \/([A-Za-z_]+)\//.exec(lineas[i])
    if (m) out.add(m[1])
  }
  return [...out].sort()
}

describe('el manifiesto cubre TODO el consultorio', () => {
  it('el guardián lee las reglas de verdad (si no, pasaría vacío)', () => {
    expect(coleccionesDelConsultorio().length).toBeGreaterThan(20)
  })

  it('ninguna colección del consultorio se queda fuera sin declararlo', () => {
    /**
     * Si esto se pone rojo: o la añades a `COLECCIONES`, o la declaras en
     * `EXCLUIDAS` con su razón. Lo segundo es una decisión —estás diciendo que
     * ese dato no hace falta el día que se restaure—, no un trámite.
     */
    const enReglas = coleccionesDelConsultorio()
    const cubiertas = new Set([...COLECCIONES.map(c => c.ruta), ...Object.keys(EXCLUIDAS)])
    const olvidadas = enReglas.filter(r => !cubiertas.has(r))
    expect(olvidadas, `colecciones sin respaldar ni declarar: ${olvidadas.join(', ')}`).toEqual([])
  })

  it('y el manifiesto no inventa colecciones que no existen', () => {
    // Una entrada fantasma produce cero líneas y se lee como «no había nada».
    const enReglas = new Set(coleccionesDelConsultorio())
    const fantasmas = COLECCIONES.map(c => c.ruta).filter(r => !enReglas.has(r))
    expect(fantasmas, `rutas del manifiesto que no existen: ${fantasmas.join(', ')}`).toEqual([])
  })

  it('el expediente del paciente viaja con TODAS sus subcolecciones', () => {
    const pacientes = COLECCIONES.find(c => c.ruta === 'patients')!
    expect(pacientes.hijas?.sort()).toEqual(
      ['clinico', 'formularios_previos', 'fotos', 'laboratorios', 'notas'])
  })

  it('y el episodio hospitalario con las suyas', () => {
    const inter = COLECCIONES.find(c => c.ruta === 'internamientos')!
    expect(inter.hijas).toContain('signos')
    expect(inter.hijas).toContain('icu_stays')
  })

  it('cada colección dice qué es', () => {
    for (const c of COLECCIONES) expect(c.descripcion.length, c.ruta).toBeGreaterThan(10)
  })
})

describe('lo que NO se respalda, y por qué', () => {
  it('las llaves de API se quedan fuera', () => {
    /**
     * Un respaldo se descarga, se manda por correo y se deja en un escritorio.
     * Meter ahí las llaves lo convertiría en una filtración de credenciales — y
     * se vuelven a pegar en Configuración en un minuto. Lo que no se puede
     * volver a teclear es el expediente.
     */
    expect(EXCLUIDAS).toHaveProperty('secretos')
    expect(POR_QUE_SE_EXCLUYEN_LOS_SECRETOS).toMatch(/filtración de credenciales/i)
  })

  it('y `secretos` NO está entre lo que se lleva', () => {
    expect(COLECCIONES.map(c => c.ruta)).not.toContain('secretos')
  })

  it('cada exclusión trae su razón escrita', () => {
    for (const [c, razon] of Object.entries(EXCLUIDAS)) {
      expect(razon.length, c).toBeGreaterThan(40)
    }
  })
})

describe('la ruta: servidor, streaming y paginada', () => {
  it('el armado ya NO vive en el navegador', () => {
    const pacientes = leer('src', 'app', '(dashboard)', 'pacientes', 'page.tsx')
    expect(pacientes).not.toContain('const historial = await getNotas(clinicId, p.id)')
    expect(pacientes).toContain('/api/clinic/exportar')
  })

  it('devuelve un flujo, no un JSON armado en memoria', () => {
    expect(ruta).toContain('new ReadableStream')
    expect(ruta).toContain('application/x-ndjson')
    expect(POR_QUE_NDJSON).toMatch(/una línea corrupta no invalida el archivo entero/i)
  })

  it('lee por páginas con cursor, no la colección entera de golpe', () => {
    expect(ruta).toContain("orderBy('__name__').limit(PAGINA)")
    expect(ruta).toContain('startAfter(cursor)')
  })

  it('cada línea trae su RUTA completa, para poder volver a escribirla', () => {
    /**
     * Sin la ruta, el archivo es un montón de documentos sin sitio al que
     * volver. La construcción vive en la librería desde v948 para que la prueba
     * de IDA Y VUELTA pueda ejercitarla sin Firestore.
     */
    const lib = leer('src', 'lib', 'clinica', 'respaldo.ts')
    expect(lib).toContain('_ruta: `${rutaBase}/${id}`')
    expect(ruta).toContain('lineaDeDocumento(rutaBase, coleccion, d.id, d.data())')
  })

  it('va bajo `administrar`: se lleva el consultorio entero', () => {
    expect(ruta).toContain("verificarCapacidad(req, clinicId, 'administrar')")
  })
})

describe('el archivo dice qué trae y qué le falta', () => {
  it('la cabecera va primera, con el índice y lo excluido', () => {
    // Un respaldo del que no se sabe qué falta no sirve para decidir si alcanza,
    // y ésa es la única pregunta que importa el día que hace falta.
    const i = ruta.indexOf("_tipo: 'cabecera'")
    expect(i).toBeGreaterThan(0)
    expect(ruta).toContain('excluidas: EXCLUIDAS')
    expect(Object.keys(indiceRespaldo()).length).toBe(COLECCIONES.length)
  })

  it('el pie cierra el archivo y declara los problemas', () => {
    // Sin pie, no hay forma de saber si la descarga se cortó a la mitad.
    expect(ruta).toContain("_tipo: 'pie'")
    expect(ruta).toContain('completo: problemas.length === 0')
  })

  it('una colección ilegible se declara y el respaldo sigue', () => {
    // Reventar entero deja al médico sin nada; declararlo le deja el resto y la
    // lista de lo que le falta.
    expect(ruta).toContain('problemas.push(c.ruta)')
  })

  it('y queda asiento en la bitácora, del lado del servidor', () => {
    expect(ruta).toContain("evento: 'export_datos'")
  })
})

describe('el detector de PHI ve la ruta del respaldo', () => {
  const guardian = leer('src', '__tests__', 'authz-rutas-declaradas.test.ts')

  it('tiene una segunda señal: la colección declarada en un manifiesto', () => {
    /**
     * El respaldo recorre las subcolecciones con `collection(hija)` —dinámico—,
     * así que con la señal literal la ruta que se lleva TODOS los expedientes
     * del consultorio no contaba como lectora de PHI.
     */
    expect(guardian).toContain('function leePhiClinico')
    expect(guardian).toContain('hijas:')
  })

  it('y `clinic/exportar` está en la lista congelada', () => {
    expect(guardian).toContain("'clinic/exportar'")
  })
})
