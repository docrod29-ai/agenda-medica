/**
 * GOLDEN — NADA SE PIERDE EN SILENCIO, NADA CRUZA DE CONSULTORIO,
 *          Y DESHACER NUNCA BORRA EL TRABAJO DEL MÉDICO.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * 1. **Las cuentas no cuadraban con nada.** El importador terminaba con
 *    `{ creados, duplicados, errores }` y ninguno de los tres se comparaba con
 *    cuántas filas traía el archivo. `construirFilas` filtraba las filas sin
 *    nombre ANTES de contarlas, así que esas filas no aparecían en ninguno de
 *    los tres números: se perdían y el informe seguía sumando bien consigo mismo.
 *
 * 2. **Una fila rota se llevaba por delante lo que venía detrás.** `parseCsv`
 *    descarta filas y no dice cuántas descartó.
 *
 * 3. **No había reversión.** Una importación con las columnas cambiadas se
 *    deshacía a mano, expediente por expediente.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Preguntándole al informe la única pregunta que importa: «¿la suma de tus
 * números da el número de filas del archivo?». No daba, y no podía dar, porque
 * el total del archivo no se guardaba en ninguna parte.
 *
 * ── LA CAUSA RAÍZ ────────────────────────────────────────────────────────────
 *
 * `sourceRecords` no existía como dato. Sin un total independiente contra el que
 * contrastar, cualquier conteo cuadra consigo mismo por construcción y la
 * verificación no verifica nada.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 *  · `sourceRecords = accepted + rejected + duplicate + ambiguous + quarantined`.
 *    Si no da, el estado es `PARTIAL` — no es un aviso, es un estado.
 *  · `sourceRecords` se pasa APARTE y no se deduce de los veredictos.
 *  · Una reversión sólo borra lo que puede demostrar que creó y que nadie tocó.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 *
 *  · El aislamiento se prueba a nivel de POLÍTICA (funciones puras). Que
 *    `firestore.rules` lo respalde es otra compuerta, y está en el HANDOFF: la
 *    colección de trabajos de importación todavía no está declarada en los tres
 *    sitios que exige `security-tenant.md`.
 *  · La reversión se prueba sobre metadatos, no contra la base.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { contar, reconciliar, informeJson, informeMarkdown, adjuntosCuadran, SIN_ADJUNTOS } from '@/lib/migration/reconciliacion'
import { aceptada, rechazada, textoDeRazon, DESTINOS } from '@/lib/migration/contrato'
import {
  trabajoAutorizado, rutaDentroDelConsultorio, escrituraAutorizada,
  soloDelConsultorio, clinicIdValido, raizDelConsultorio,
} from '@/lib/migration/aislamiento'
import { decidirReversion, planificarReversion, autorizadoABorrar } from '@/lib/migration/rollback'
import { ensayar, aprobable } from '@/lib/migration/ensayo'
import { ADAPTADOR_CSV } from '@/lib/migration/adaptadores'
import { procedenciaSobrevive } from '@/lib/migration/exportacion'
import { asientoDeAprobacion, llevaPhi, extensionSegura } from '@/lib/migration/auditoria'
import { verificarAdjunto, contarAdjuntos } from '@/lib/migration/adjuntos'
import { tieneIncertidumbre, camposInciertos, procedenciaDeCampo } from '@/lib/migration/procedencia'
import { normalizarFecha } from '@/lib/migration/normalizacion'

const HOY = '2026-08-23'
const O = { clinicId: 'c1', hoy: HOY }

/* ═══════════════ 11 y 12. LAS CUENTAS CUADRAN, Y UNA FILA MALA NO ABORTA ═══════════════ */

describe('reconciliación', () => {
  it('cuando la suma da el total del archivo, la importación está COMPLETA', () => {
    const c = contar(3, [aceptada(), rechazada('rejected', ['INVALID_DATE']), rechazada('duplicate', ['DUPLICATE_EXACT'])])
    const r = reconciliar(c)
    expect(r.estado).toBe('COMPLETED')
    expect(r.descuadre).toBe(0)
  })

  it('AL REVÉS: si falta una fila por clasificar, NO está completa', () => {
    // Éste es el guardián metido al revés: se le da un archivo de 3 filas con
    // sólo 2 clasificadas, que es exactamente lo que hacía el importador viejo
    // al filtrar las filas sin nombre antes de contarlas.
    const c = contar(3, [aceptada(), aceptada()])
    const r = reconciliar(c)
    expect(r.estado).toBe('PARTIAL')
    expect(r.descuadre).toBe(1)
    expect(r.problemas[0]).toMatch(/Faltan 1 filas/)
  })

  it('SOBRAR clasificaciones también rompe: alguna fila se procesó dos veces', () => {
    const r = reconciliar(contar(2, [aceptada(), aceptada(), aceptada()]))
    expect(r.estado).toBe('PARTIAL')
    expect(r.problemas[0]).toMatch(/Sobran 1/)
  })

  it('una fila ROTA no aborta las buenas, y sigue contando en el total', async () => {
    const csv = [
      'Nombre,Teléfono',
      'Ana Ruiz Soto,6641234567',
      'Pérez, Juan,5551112222',        // coma sin escapar → fila rota
      'Carlos Méndez Vega,5553334444',
    ].join('\n')
    const r = await ensayar(ADAPTADOR_CSV, csv, [], O)
    // Las dos buenas entran.
    expect(r.reconciliacion.cuentas.porDestino.accepted).toBe(2)
    expect(r.reconciliacion.cuentas.porDestino.rejected).toBe(1)
    // Y LAS CUENTAS SIGUEN CUADRANDO sobre las 3 filas reales del archivo.
    expect(r.reconciliacion.cuentas.sourceRecords).toBe(3)
    expect(r.reconciliacion.estado).toBe('COMPLETED')
  })

  it('una fila SIN NOMBRE se rechaza con razón, en vez de desaparecer', async () => {
    const csv = 'Nombre,Teléfono\nAna Ruiz Soto,6641234567\n,5551112222'
    const r = await ensayar(ADAPTADOR_CSV, csv, [], O)
    expect(r.reconciliacion.cuentas.sourceRecords).toBe(2)
    expect(r.reconciliacion.cuentas.porRazon['MISSING_REQUIRED_IDENTITY']).toBe(1)
    expect(r.reconciliacion.estado).toBe('COMPLETED')
  })

  it('los cinco destinos son exhaustivos: cada fila cae en uno y sólo en uno', async () => {
    const csv = [
      'Nombre,Teléfono,Fecha de nacimiento',
      'Ana Ruiz Soto,6641234567,1985-03-12',      // acepta
      ',5551112222,1990-01-01',                    // rechaza (sin nombre)
      'Ana Ruiz Soto,6641234567,1985-03-12',      // duplicado en origen
      'Carlos Méndez Vega,5553334444,03/04/25',   // cuarentena (fecha ambigua)
    ].join('\n')
    const r = await ensayar(ADAPTADOR_CSV, csv, [], O)
    const suma = DESTINOS.reduce((s, d) => s + r.reconciliacion.cuentas.porDestino[d], 0)
    expect(suma).toBe(r.reconciliacion.cuentas.sourceRecords)
    expect(r.reconciliacion.cuentas.porDestino.quarantined).toBe(1)
  })

  it('los adjuntos se cuentan APARTE y también tienen que cuadrar', () => {
    expect(adjuntosCuadran({ declarados: 10, subidos: 7, fallidos: 1, ausentes: 1, corruptos: 1 })).toBe(true)
    expect(adjuntosCuadran({ declarados: 10, subidos: 7, fallidos: 0, ausentes: 0, corruptos: 0 })).toBe(false)
    // Y un descuadre de documentos impide dar por completa la importación.
    const r = reconciliar(contar(1, [aceptada()]), { declarados: 3, subidos: 1, fallidos: 0, ausentes: 0, corruptos: 0 })
    expect(r.estado).toBe('PARTIAL')
  })

  it('el informe para personas ABRE con el veredicto y nombra lo que queda pendiente', () => {
    const c = contar(3, [aceptada(), rechazada('quarantined', ['AMBIGUOUS_DATE']), rechazada('ambiguous', ['DUPLICATE_AMBIGUOUS'])])
    const j = informeJson({
      importJobId: 'imp_1', clinicId: 'c1', sourceFileHash: 'abc',
      mappingVersion: 'v1', reconciliacion: reconciliar(c), generadoEn: '2026-08-23T10:00:00Z',
    })
    const md = informeMarkdown(j, textoDeRazon)
    expect(md).toMatch(/Importación completa/)
    // Lo que evita que «1 importado» se lea como «ya está»: las 2 pendientes.
    expect(md).toMatch(/2 filas esperando a que las mires/)
    expect(md).toContain('imp_1')
  })

  it('el informe dice PRIMERO que está incompleta, sin obligar a sumar la tabla', () => {
    const j = informeJson({
      importJobId: 'imp_1', clinicId: 'c1', sourceFileHash: 'abc', mappingVersion: 'v1',
      reconciliacion: reconciliar(contar(5, [aceptada()])), generadoEn: '2026-08-23T10:00:00Z',
    })
    const md = informeMarkdown(j, textoDeRazon)
    expect(md.indexOf('IMPORTACIÓN INCOMPLETA')).toBeLessThan(md.indexOf('| Desenlace |'))
  })
})

/* ═══════════════ 13. EL ENSAYO NO ESCRIBE — POR CONSTRUCCIÓN ═══════════════ */

describe('el ensayo no puede escribir', () => {
  /**
   * Se comprueba MIRANDO LOS IMPORTS del módulo entero, no llamándolo con un
   * espía. Un espía sólo demuestra que ESA llamada no escribió; esto demuestra
   * que el módulo no tiene con qué escribir en ninguna llamada posible.
   *
   * Se recorre todo `src/lib/migration/`: basta con que un módulo del carril
   * arrastre Firestore para que el ensayo lo arrastre también.
   */
  const PROHIBIDOS = [
    'firebase', 'firebase-admin', '@/lib/firestore', 'firebase/firestore',
    '@/lib/firebase', 'node:fs', 'node-fetch',
  ]

  it('ningún módulo de migración importa Firestore, red ni disco', () => {
    const dir = join(process.cwd(), 'src/lib/migration')
    const culpables: string[] = []
    for (const f of readdirSync(dir).filter(n => n.endsWith('.ts'))) {
      const src = readFileSync(join(dir, f), 'utf8')
      for (const m of src.matchAll(/^\s*import\s[^'"]*['"]([^'"]+)['"]/gm)) {
        const dep = m[1]
        if (PROHIBIDOS.some(p => dep === p || dep.startsWith(`${p}/`))) culpables.push(`${f} → ${dep}`)
      }
    }
    expect(culpables, 'un módulo de migración adquirió una puerta de escritura').toEqual([])
  })

  it('tampoco usa el reloj ni el azar: el determinismo depende de eso', () => {
    const dir = join(process.cwd(), 'src/lib/migration')
    const culpables: string[] = []
    for (const f of readdirSync(dir).filter(n => n.endsWith('.ts'))) {
      const src = readFileSync(join(dir, f), 'utf8')
        // Los comentarios explican estas mismas trampas por su nombre.
        .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
      if (/\bDate\.now\(|\bMath\.random\(|new Date\(\s*\)/.test(src)) culpables.push(f)
    }
    expect(culpables, 'un módulo de migración empezó a depender del reloj o del azar').toEqual([])
  })

  it('un ensayo con bloqueos NO es aprobable', async () => {
    const r = await ensayar(ADAPTADOR_CSV, 'Teléfono,Correo\n6641234567,a@b.mx', [], O)
    expect(r.bloqueos.length).toBeGreaterThan(0)
    expect(aprobable(r)).toBe(false)
  })

  it('el ensayo dice cuántos lotes haría falta escribir, antes de escribir ninguno', async () => {
    const filas = Array.from({ length: 900 }, (_, i) => `Paciente Sintetico ${i},555${String(i).padStart(7, '0')}`)
    const r = await ensayar(ADAPTADOR_CSV, ['Nombre,Teléfono', ...filas].join('\n'), [], O)
    expect(r.lotesEstimados).toBe(3)
  })
})

/* ═══════════════ 10. AISLAMIENTO ENTRE CONSULTORIOS ═══════════════ */

describe('aislamiento', () => {
  it('un trabajo del consultorio A no puede escribir con una sesión de B', () => {
    expect(trabajoAutorizado('cA', 'cA').ok).toBe(true)
    const f = trabajoAutorizado('cB', 'cA')
    expect(f.ok).toBe(false)
    if (!f.ok) expect(f.razon).toBe('TENANT_MISMATCH')
  })

  it('EL FALLO DE PREFIJO: clinics/abc NO da por buena una ruta de clinics/abcdef', () => {
    // Sin la barra final, un consultorio cuyo id empieza igual que otro podría
    // recibir su padrón entero.
    expect(rutaDentroDelConsultorio('clinics/abcdef/patients/x', 'abc')).toBe(false)
    expect(rutaDentroDelConsultorio('clinics/abc/patients/x', 'abc')).toBe(true)
  })

  it('una ruta fuera del consultorio del trabajo se corta aunque la sesión sea válida', () => {
    const r = escrituraAutorizada({ clinicIdSesion: 'cA', clinicIdTrabajo: 'cA', ruta: 'clinics/cB/patients/x' })
    expect(r.ok).toBe(false)
  })

  it('la reversión no puede alcanzar expedientes de otro consultorio, y DICE cuántos descartó', () => {
    const { dentro, fuera } = soloDelConsultorio(
      [{ ruta: 'clinics/cA/patients/1' }, { ruta: 'clinics/cB/patients/2' }, { ruta: 'clinics/cA/patients/3' }],
      'cA',
    )
    expect(dentro).toHaveLength(2)
    // El descarte silencioso sería el fallo peor: la reversión creería haber terminado.
    expect(fuera).toBe(1)
  })

  it('un clinicId con truco no construye ruta', () => {
    for (const malo of ['../otro', 'a/b', '', '.', '..']) expect(clinicIdValido(malo)).toBe(false)
    expect(() => raizDelConsultorio('../otro')).toThrow()
  })
})

/* ═══════════════ 14. DESHACER NO BORRA EL TRABAJO DEL MÉDICO ═══════════════ */

describe('reversión acotada', () => {
  const IMPORTADO = '2026-08-23T10:00:00.000Z'

  it('un expediente intacto de este trabajo SÍ se puede deshacer', () => {
    const d = decidirReversion(
      { patientId: 'p1', importJobId: 'imp_1', importedAt: IMPORTADO, updatedAt: IMPORTADO },
      'imp_1',
    )
    expect(d.clase).toBe('revertible')
  })

  it('EL CASO QUE IMPORTA: si el médico lo editó después, NO se borra', () => {
    const d = decidirReversion(
      { patientId: 'p1', importJobId: 'imp_1', importedAt: IMPORTADO, updatedAt: '2026-08-24T09:00:00.000Z' },
      'imp_1',
    )
    expect(d.clase).toBe('requiere-revision')
    if (d.clase === 'requiere-revision') expect(d.porQue).toBe('MODIFICADO_DESPUES_DE_IMPORTAR')
  })

  it('si cuelgan notas o recetas, tampoco: quedarían huérfanas', () => {
    const d = decidirReversion(
      { patientId: 'p1', importJobId: 'imp_1', importedAt: IMPORTADO, updatedAt: IMPORTADO, tieneDescendencia: true },
      'imp_1',
    )
    expect(d.clase === 'requiere-revision' && d.porQue).toBe('TIENE_TRABAJO_CLINICO_ENCIMA')
  })

  it('un expediente de OTRO trabajo no se toca', () => {
    expect(decidirReversion({ patientId: 'p1', importJobId: 'imp_9', importedAt: IMPORTADO }, 'imp_1').clase).toBe('ajeno')
  })

  it('sin sello de importación no se borra: no se puede demostrar quién lo creó', () => {
    const d = decidirReversion({ patientId: 'p1', importJobId: 'imp_1' }, 'imp_1')
    expect(d.clase === 'requiere-revision' && d.porQue).toBe('SIN_SELLO_DE_IMPORTACION')
  })

  it('el margen de un segundo evita mandar a revisión el 100% por milisegundos de createPatient', () => {
    const d = decidirReversion(
      { patientId: 'p1', importJobId: 'imp_1', importedAt: IMPORTADO, updatedAt: '2026-08-23T10:00:00.400Z' },
      'imp_1',
    )
    expect(d.clase).toBe('revertible')
  })

  it('el plan se calcula ENTERO antes de borrar, y una reversión parcial se declara', () => {
    const p = planificarReversion([
      { patientId: 'p1', importJobId: 'imp_1', importedAt: IMPORTADO, updatedAt: IMPORTADO },
      { patientId: 'p2', importJobId: 'imp_1', importedAt: IMPORTADO, updatedAt: '2026-08-24T09:00:00.000Z' },
      { patientId: 'p3', importJobId: 'otro', importedAt: IMPORTADO },
    ], 'imp_1')
    expect(p.aBorrar).toEqual(['p1'])
    expect(p.aRevisar).toHaveLength(1)
    expect(p.ajenos).toBe(1)
    expect(p.completa).toBe(false)
  })

  it('la compuerta se vuelve a comprobar con el dato FRESCO en el momento de borrar', () => {
    const fresco = { patientId: 'p1', importJobId: 'imp_1', importedAt: IMPORTADO, updatedAt: '2026-08-24T09:00:00.000Z' }
    // Estaba en el plan, pero el médico lo abrió mientras tanto.
    expect(autorizadoABorrar(fresco, 'imp_1')).toBe(false)
  })
})

/* ═══════════════ 15 y 18. LA PROCEDENCIA SE CONSERVA Y SOBREVIVE AL EXPORT ═══════════════ */

describe('procedencia', () => {
  it('cada campo guarda su encabezado ORIGINAL y su valor crudo', async () => {
    const csv = 'Nombre completo,DOB\nAna Ruiz Soto,1985-03-12'
    const r = await ensayar(ADAPTADOR_CSV, csv, [], O)
    const p = r.filas[0].procedencia
    // El encabezado que se guarda es el DEL ARCHIVO, no el nombre interno del
    // campo: es lo que permite volver al archivo y señalar la columna.
    expect(p['nombre'].originalFieldName).toBe('Nombre completo')
    expect(p['fechaNacimiento'].originalFieldName).toBe('DOB')
    expect(p['fechaNacimiento'].valorOriginal).toBe('1985-03-12')
  })

  it('un encabezado que la tabla de sinónimos NO conoce se conserva y se puede forzar', async () => {
    /**
     * `NOMBRE DEL PACIENTE` y `F. NAC.` son encabezados corrientes en exports
     * mexicanos y la tabla de `csv-pacientes.ts` no los tiene. Esta prueba fija
     * el comportamiento que hace que eso NO sea una pérdida de datos: la columna
     * queda declarada como desconocida —no desaparece— y el médico la asigna.
     *
     * Ampliar la tabla de sinónimos es de quien la posee; está en el registro de
     * riesgos como P2. Lo que este carril garantiza es que, mientras tanto, el
     * dato no se pierde en silencio.
     */
    const csv = 'NOMBRE DEL PACIENTE,F. NAC.\nAna Ruiz Soto,1985-03-12'
    const sinForzar = await ensayar(ADAPTADOR_CSV, csv, [], O)
    expect(sinForzar.columnasDesconocidas).toEqual(['NOMBRE DEL PACIENTE', 'F. NAC.'])
    // Sin columna de nombre no se puede seguir, y se dice en vez de importar vacío.
    expect(aprobable(sinForzar)).toBe(false)
    // Y el dato sigue ahí, esperando: no se tiró.
    expect(sinForzar.filas[0].noMapeados['NOMBRE DEL PACIENTE']).toBe('Ana Ruiz Soto')

    const forzado = await ensayar(ADAPTADOR_CSV, csv, [], {
      ...O, forzado: { 0: 'nombre', 1: 'fechaNacimiento' },
    })
    expect(aprobable(forzado)).toBe(true)
    expect(forzado.filas[0].procedencia['fechaNacimiento'].originalFieldName).toBe('F. NAC.')
  })

  it('LA COLUMNA QUE NO ENTENDEMOS NO SE PIERDE: se conserva tal cual', async () => {
    const csv = 'Nombre,Padecimiento actual\nAna Ruiz Soto,cefalea tensional de 3 meses'
    const r = await ensayar(ADAPTADOR_CSV, csv, [], O)
    expect(r.filas[0].noMapeados['Padecimiento actual']).toBe('cefalea tensional de 3 meses')
    expect(r.columnasDesconocidas).toContain('Padecimiento actual')
  })

  it('una columna presente y vacía se distingue de una columna que no existía', () => {
    const p = procedenciaDeCampo('Alergias', { clase: 'vacio', crudo: '' })
    // «Ausencia de dato no es dato de ausencia»: se sabe que se preguntó.
    expect(p.normalizationApplied).toContain('columna-presente-vacia')
    expect(p.incertidumbre).toBeUndefined()
  })

  it('una fecha ambigua conserva las DOS lecturas dentro de la procedencia', () => {
    const p = procedenciaDeCampo('F. NAC.', normalizarFecha('03/04/25', { hoy: HOY }))
    expect(p.incertidumbre?.clase).toBe('ambiguo')
    expect(p.incertidumbre?.lecturas).toEqual(['2025-03-04', '2025-04-03'])
  })

  it('un sello con dudas se puede detectar y nombrar', () => {
    const sello = {
      procedencia: {} as never,
      campos: {
        nombre: procedenciaDeCampo('Nombre', { clase: 'valor', valor: 'Ana', crudo: 'Ana', aplicado: [] }),
        fechaNacimiento: procedenciaDeCampo('F', normalizarFecha('03/04/25', { hoy: HOY })),
      },
      camposNoMapeados: {},
    }
    expect(tieneIncertidumbre(sello)).toBe(true)
    expect(camposInciertos(sello)).toEqual(['fechaNacimiento'])
  })

  it('EL FALLO MÁS CARO DEL EXPORT: una duda que se convierte en certeza al salir', () => {
    const entro = {
      campos: {
        fechaNacimiento: procedenciaDeCampo('F', normalizarFecha('03/04/25', { hoy: HOY })),
      },
    }
    const salioMal = {
      campos: {
        fechaNacimiento: { originalFieldName: 'F', valorOriginal: '03/04/25', normalizationApplied: [] },
      },
    }
    const perdido = procedenciaSobrevive(entro, salioMal)
    expect(perdido.some(p => /incertidumbre/.test(p))).toBe(true)
    // AL REVÉS: si sale igual, no se pierde nada.
    expect(procedenciaSobrevive(entro, entro)).toEqual([])
  })

  it('una columna sin mapear que no vuelve en el export es un dato del médico perdido', () => {
    const entro = { camposNoMapeados: { 'Padecimiento actual': 'cefalea' } }
    expect(procedenciaSobrevive(entro, { camposNoMapeados: {} })[0]).toMatch(/Padecimiento actual/)
  })
})

/* ═══════════════ LA BITÁCORA NO LLEVA PHI ═══════════════ */

describe('bitácora', () => {
  it('el asiento de aprobación NO contiene nombres, teléfonos ni el nombre del archivo', async () => {
    const csv = 'Nombre,Teléfono\nAna Ruiz Soto,6641234567'
    const r = await ensayar(ADAPTADOR_CSV, csv, [], O)
    const a = asientoDeAprobacion({
      importJobId: 'imp_1', sourceFileHash: 'abc123', nombreArchivo: 'expediente_ramirez.csv',
      bytes: 4096, mappingVersion: 'v1', adaptador: 'csv',
      iniciadoEn: '2026-08-23T10:00:00Z', aprobadoEn: '2026-08-23T10:05:00Z', aprobadoPor: 'uid_medico',
      informe: informeJson({
        importJobId: 'imp_1', clinicId: 'c1', sourceFileHash: 'abc123', mappingVersion: 'v1',
        reconciliacion: r.reconciliacion, generadoEn: '2026-08-23T10:05:00Z',
      }),
    })
    // Ni el paciente, ni su teléfono, ni el nombre del archivo (que también es PHI).
    expect(llevaPhi(a, ['Ana Ruiz Soto', '6641234567', 'expediente_ramirez'])).toEqual([])
    // Y aun así el asiento sirve: trae conteos, huella y quién aprobó.
    expect(a.conteos?.sourceRecords).toBe(1)
    expect(a.sourceFileHash).toBe('abc123')
    expect(a.aprobadoPor).toBe('uid_medico')
    expect(a.archivo.extension).toBe('.csv')
  })

  it('AL REVÉS: el guardián de PHI encuentra una fuga si la hay', () => {
    const conFuga = { accion: 'migracion', notas: 'Ana Ruiz Soto' } as never
    expect(llevaPhi(conFuga, ['Ana Ruiz Soto'])).toEqual(['ana ruiz soto'])
  })

  it('una extensión desconocida no arrastra el nombre del archivo', () => {
    expect(extensionSegura('expediente_ramirez.raro')).toBe('otro')
  })
})

/* ═══════════════ ADJUNTOS ═══════════════ */

describe('adjuntos', () => {
  const base = { id: 'a1', sourceRecordId: 'r1', rutaEnPaquete: 'docs/a1.pdf', mime: 'application/pdf', bytes: 1024, checksum: 'h1' }

  it('un checksum que no coincide se trata como corrupto, no como bueno', () => {
    expect(verificarAdjunto(base, true, 'otro').estado).toBe('corrupto')
    expect(verificarAdjunto(base, true, 'h1').estado).toBe('pendiente')
  })

  it('SIN checksum comprobado se trata como corrupto: «no pude comprobarlo» no es «está bien»', () => {
    expect(verificarAdjunto(base, true, undefined).estado).toBe('corrupto')
  })

  it('un tipo fuera de la lista blanca no entra', () => {
    expect(verificarAdjunto({ ...base, mime: 'image/svg+xml' }, true, 'h1').estado).toBe('rechazado')
  })

  it('un documento del que no se sabe de quién es queda HUÉRFANO, no colgado del más probable', () => {
    const { sourceRecordId: _omitido, ...sinDueno } = base
    void _omitido
    expect(verificarAdjunto(sinDueno, true, 'h1').estado).toBe('huerfano')
  })

  it('los declarados que no venían se cuentan como ausentes', () => {
    const c = contarAdjuntos([
      verificarAdjunto(base, false),
      verificarAdjunto({ ...base, id: 'a2' }, true, 'h1'),
    ])
    expect(c).toMatchObject({ declarados: 2, ausentes: 1 })
    expect(adjuntosCuadran({ ...c })).toBe(true)
  })

  it('sin adjuntos declarados, la cuenta de documentos cuadra sola', () => {
    expect(adjuntosCuadran(SIN_ADJUNTOS)).toBe(true)
  })
})
