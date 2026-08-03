/**
 * GOLDEN — el respaldo se puede volver a meter, y se comprueba documento a
 * documento.
 *
 * ── POR QUÉ ESTA PRUEBA ES LA QUE IMPORTA ────────────────────────────────────
 *
 * v947 dejó el respaldo bien hecho. Pero **no había importador**, y un respaldo
 * que no se puede volver a meter no es un respaldo: es un archivo del que nadie
 * sabe si sirve.
 *
 * «Tenemos respaldos» sin una restauración probada es una **hipótesis**. El
 * propio `scripts/respaldos-verificar.mjs` termina diciéndolo: «falta una cosa
 * que esto no puede comprobar: haber RESTAURADO alguna vez».
 *
 * Esto lo comprueba: se siembra un consultorio sintético, se exporta con el
 * mismo constructor de líneas que usa la ruta, se importa con el mismo lector, y
 * se compara **documento a documento**.
 *
 * ── LO QUE ESTA PRUEBA NO DEMUESTRA, Y HAY QUE DECIRLO ───────────────────────
 *
 * No toca Firestore. Demuestra que el **formato no pierde nada** y que las rutas
 * se reconstruyen exactas — que es donde estaban los errores posibles—, no que
 * el emulador escriba bien. Eso último sigue esperando un ensayo de restauración
 * de verdad, con su RTO medido, que es del Dr.
 *
 * Decirlo importa: una prueba verde que se presenta como más de lo que es vuelve
 * a dejar «tenemos respaldos» en el terreno de la hipótesis, sólo que ahora con
 * una prueba al lado.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { COLECCIONES, EXCLUIDAS, indiceRespaldo, lineaDeDocumento } from '@/lib/clinica/respaldo'
import {
  leerLinea, reenraizar, admitir,
  POR_QUE_SOLO_A_CLINICA_VACIA, POR_QUE_UNA_LINEA_ROTA_NO_ABORTA,
} from '@/lib/clinica/restaurar'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')
const ruta = leer('src', 'app', 'api', 'clinic', 'importar', 'route.ts')

/* ══════════════════════════════════════════════════════════════════════════
   Un consultorio sintético. Nada de esto es de nadie.
   ══════════════════════════════════════════════════════════════════════════ */
const ORIGEN = 'clinica-origen'
const DESTINO = 'clinica-destino'

const SEMILLA: { coleccion: string; base: string; id: string; datos: Record<string, unknown> }[] = [
  { coleccion: 'patients', base: `clinics/${ORIGEN}/patients`, id: 'p1', datos: { nombre: 'Paciente Sintético Uno', edad: 40 } },
  { coleccion: 'patients.notas', base: `clinics/${ORIGEN}/patients/p1/notas`, id: 'n1', datos: { tipo: 'consulta', estado: 'firmada', texto: 'nota sintética' } },
  { coleccion: 'patients.laboratorios', base: `clinics/${ORIGEN}/patients/p1/laboratorios`, id: 'l1', datos: { fecha: '2026-08-01', analitos: [{ clave: 'hb', valor: 14 }] } },
  { coleccion: 'appointments', base: `clinics/${ORIGEN}/appointments`, id: 'c1', datos: { pacienteId: 'p1', fechaHora: '2026-08-10 09:00', duracion: 30 } },
  { coleccion: 'config', base: `clinics/${ORIGEN}/config`, id: 'main', datos: { nombreClinica: 'Consultorio de prueba', intervaloMinutos: 30 } },
  { coleccion: 'internamientos', base: `clinics/${ORIGEN}/internamientos`, id: 'i1', datos: { pacienteId: 'p1', servicio: 'Medicina Interna', cama: '304-A' } },
  { coleccion: 'internamientos.signos', base: `clinics/${ORIGEN}/internamientos/i1/signos`, id: 's1', datos: { fc: 78, fr: 16, anidado: { a: 1, b: [1, 2, 3] } } },
]

/** El archivo tal como lo escribiría la ruta. */
function exportar(): string {
  const lineas: string[] = [
    JSON.stringify({ _tipo: 'cabecera', formato: 'nexusmed-respaldo-1', clinicId: ORIGEN, indice: indiceRespaldo(), excluidas: EXCLUIDAS }),
    ...SEMILLA.map(s => JSON.stringify(lineaDeDocumento(s.base, s.coleccion, s.id, s.datos))),
    JSON.stringify({ _tipo: 'pie', documentos: SEMILLA.length, problemas: [], completo: true }),
  ]
  return lineas.join('\n') + '\n'
}

/** Lo que la ruta escribiría, sin Firestore. */
function importar(archivo: string, clinicIdDestino: string) {
  const escritos: { ruta: string; datos: Record<string, unknown> }[] = []
  const rechazadas: string[] = []
  let origen: string | null = null
  let completo = false
  const conocidas = new Set<string>()
  for (const c of COLECCIONES) {
    conocidas.add(c.ruta)
    for (const h of c.hijas ?? []) conocidas.add(`${c.ruta}.${h}`)
  }
  for (const crudo of archivo.split('\n')) {
    const l = leerLinea(crudo)
    if (!l) continue
    if (l.clase === 'rechazada') { rechazadas.push(l.porQue); continue }
    if (l.clase === 'cabecera') { origen = String(l.datos.clinicId ?? ''); continue }
    if (l.clase === 'pie') { completo = true; continue }
    if (!conocidas.has(l.coleccion)) { rechazadas.push(`desconocida: ${l.coleccion}`); continue }
    const v = admitir(l.coleccion)
    if (!v.escribir) { rechazadas.push(v.porQue); continue }
    escritos.push({ ruta: reenraizar(l.ruta, clinicIdDestino), datos: l.datos })
  }
  return { escritos, rechazadas, origen, completo }
}

describe('IDA Y VUELTA: se exporta, se importa, y se compara documento a documento', () => {
  const archivo = exportar()
  const r = importar(archivo, DESTINO)

  it('vuelve el MISMO número de documentos', () => {
    expect(r.escritos.length).toBe(SEMILLA.length)
  })

  it('cada documento vuelve a su sitio, con la raíz del destino', () => {
    for (const s of SEMILLA) {
      const esperada = `${s.base}/${s.id}`.replace(`clinics/${ORIGEN}/`, `clinics/${DESTINO}/`)
      expect(r.escritos.some(e => e.ruta === esperada), esperada).toBe(true)
    }
  })

  it('y con SUS DATOS intactos, incluidos los anidados', () => {
    /**
     * Lo anidado es donde se pierde la información sin que se note: un objeto o
     * un arreglo que se aplana vuelve como otra cosa y la nota queda distinta.
     */
    for (const s of SEMILLA) {
      const esperada = `${s.base}/${s.id}`.replace(`clinics/${ORIGEN}/`, `clinics/${DESTINO}/`)
      const vuelta = r.escritos.find(e => e.ruta === esperada)!
      expect(vuelta.datos, esperada).toEqual(s.datos)
    }
  })

  it('los metadatos del transporte NO se escriben como campos', () => {
    // `_ruta` y `_coleccion` describen dónde va el documento; guardarlos dentro
    // ensuciaría cada documento del consultorio para siempre.
    for (const e of r.escritos) {
      expect(e.datos).not.toHaveProperty('_ruta')
      expect(e.datos).not.toHaveProperty('_coleccion')
    }
  })

  it('nada se rechaza en un archivo sano', () => {
    expect(r.rechazadas).toEqual([])
  })

  it('la cabecera dice de dónde salió y el pie que estaba completo', () => {
    expect(r.origen).toBe(ORIGEN)
    expect(r.completo).toBe(true)
  })
})

describe('lo que NO entra, aunque venga en el archivo', () => {
  it('las llaves de API', () => {
    /**
     * El respaldo las excluye, pero un archivo editado a mano podría traerlas —
     * y escribir credenciales desde un archivo subido es exactamente la puerta
     * que no se deja abierta. `EXCLUIDAS` se consulta en los DOS sentidos.
     */
    expect(admitir('secretos').escribir).toBe(false)
    expect(admitir('secretos').porQue).toMatch(/filtración de credenciales/i)
  })

  it('y una colección que el manifiesto no conoce', () => {
    const manipulado = exportar() + JSON.stringify({
      _ruta: `clinics/${ORIGEN}/coleccion_inventada/x1`, _coleccion: 'coleccion_inventada', algo: 1,
    }) + '\n'
    const r = importar(manipulado, DESTINO)
    expect(r.escritos.length).toBe(SEMILLA.length)
    expect(r.rechazadas.join(' ')).toMatch(/desconocida/)
  })
})

describe('una línea rota no tumba la restauración', () => {
  it('se rechaza con su razón y las demás entran', () => {
    const roto = exportar().replace(
      JSON.stringify(lineaDeDocumento(SEMILLA[1].base, SEMILLA[1].coleccion, SEMILLA[1].id, SEMILLA[1].datos)),
      '{ esto no es json',
    )
    const r = importar(roto, DESTINO)
    expect(r.escritos.length).toBe(SEMILLA.length - 1)
    expect(r.rechazadas.join(' ')).toMatch(/no es JSON válido/)
  })

  it('una ruta con forma inesperada tampoco se adivina', () => {
    // Adivinar dónde va un documento es peor que dejarlo fuera: lo deja mal
    // puesto y nadie se entera.
    expect(leerLinea(JSON.stringify({ _ruta: 'patients/p1', _coleccion: 'patients' }))).toMatchObject({ clase: 'rechazada' })
    expect(leerLinea(JSON.stringify({ _ruta: `clinics/${ORIGEN}/patients`, _coleccion: 'patients' }))).toMatchObject({ clase: 'rechazada' })
  })

  it('y una línea sin `_ruta` no se escribe en ninguna parte', () => {
    expect(leerLinea(JSON.stringify({ nombre: 'x' }))).toMatchObject({ clase: 'rechazada' })
  })

  it('está escrito por qué no aborta', () => {
    expect(POR_QUE_UNA_LINEA_ROTA_NO_ABORTA).toMatch(/otras diez mil/i)
  })
})

describe('los candados de la ruta', () => {
  it('sólo a consultorio VACÍO, salvo que se pida lo contrario', () => {
    expect(ruta).toContain("clinicRef.collection('patients').limit(1).get()")
    expect(ruta).toContain('mezclaría dos historias clínicas')
    expect(POR_QUE_SOLO_A_CLINICA_VACIA).toMatch(/consultorio vacío/i)
  })

  it('tiene modo ENSAYO que no escribe nada', () => {
    expect(ruta).toContain("const simular = req.nextUrl.searchParams.get('simular') === '1'")
    expect(ruta).toContain('if (!simular) await lote.commit()')
    expect(ruta).toContain('if (!simular) lote.set(')
  })

  it('escribe por lotes, no documento a documento', () => {
    expect(ruta).toContain('const LOTE = 400')
    expect(ruta).toContain('adminDb.batch()')
  })

  it('la raíz se reescribe SIEMPRE al destino del parámetro', () => {
    // Aunque el origen coincida: el destino es el que pide quien restaura, no el
    // que venga escrito en un archivo que pudo tocar cualquiera.
    expect(ruta).toContain('reenraizar(l.ruta, clinicId)')
  })

  it('un archivo SIN pie se acepta, pero se avisa', () => {
    /**
     * Restaurar medio respaldo creyendo que era entero es la peor forma de
     * perder datos: se cree que están.
     */
    expect(ruta).toContain('puede estar cortado')
    expect(ruta).toContain('NO lo des por completo')
  })

  it('va bajo `administrar`', () => {
    expect(ruta).toContain("verificarCapacidad(req, clinicId, 'administrar')")
  })

  it('y deja asiento en la bitácora', () => {
    expect(ruta).toContain("accion: 'restauracion'")
  })
})
