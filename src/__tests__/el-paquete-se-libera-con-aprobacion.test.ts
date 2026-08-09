/**
 * EL PAQUETE SE COMPONE DE LO FIRMADO Y SÓLO SALE CON APROBACIÓN — V9 ·
 * `POSTVISIT-001` · REG-306.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * Dos defectos P1 de la auditoría `PATIENT-UX-TRUTH-001`, hermanos:
 *
 *  - `POSTVISIT-GATE-001` — «Lo que se lleva el paciente» se componía del
 *    borrador **en curso**. La consulta iba por la mitad, el médico llevaba
 *    dictados tres fármacos de los cinco, y la hoja ya estaba montada con
 *    forma de indicación impresa, con botón de imprimir al lado.
 *  - `POSTVISIT-ENTREGA-001` — y aun así **no llegaba nunca al paciente**:
 *    copiar e imprimir eran las dos únicas salidas.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Leyendo la pantalla de la consulta al inventariarla: `HojaParaElPaciente`
 * recibía `medicamentos` y `estudiosOrden` del **estado vivo** del formulario,
 * sin mirar `firmada` en ningún punto. Y `proximaCita` estaba fijo en
 * `undefined`, así que su cuarto bloque no podía renderizarse jamás — señal de
 * que nadie había recorrido la hoja entera con datos de verdad.
 *
 * ── LA CAUSA RAÍZ ───────────────────────────────────────────────────────────
 *
 * El motor de composición era correcto —determinista, y con el golden de
 * `como-se-lo-explico` impidiendo que aparezca una cifra que no esté en la
 * nota— así que **nada estaba mal en lo que se componía**. Lo que faltaba era
 * la pregunta anterior: **de qué** se compone. Un motor seguro alimentado con
 * un borrador produce un documento inseguro, y lo produce en verde.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * `patient-facing-ai.md` regla 4: firmar y liberar son **dos actos**. La
 * compuerta de firma (`puedeComponerse`) es necesaria y no suficiente; encima
 * va la aprobación explícita (`liberar`), y las dos las aplica el **servidor**.
 *
 * ── QUÉ **NO** CUBRE ────────────────────────────────────────────────────────
 *
 * - **No monta la ruta HTTP con Firestore.** Comprueba las funciones que la
 *   ruta usa y que la ruta las use, en su orden. Una petición real exige el
 *   emulador y vive en otra suite.
 * - **No se ha visto en un navegador.** Ni la pantalla del médico ni la del
 *   paciente. Sigue abierto `NAV-NAVEGADOR-001`.
 * - **No valida la redacción clínica** de lo compuesto: eso es el golden de
 *   `como-se-lo-explico`, que ya existe y sigue siendo quien impide que
 *   aparezca una cifra que no esté en la nota.
 * - **No cubre `documents` ni `unansweredQuestions`**, que siguen vacíos hasta
 *   `DOCUMENTS-001` y `PATIENT-AI-001`.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  componerPaquete, puedeComponerse, cambiosDeMedicacion, comoContactar,
  liberar, visibleParaElPaciente,
} from '@/lib/paciente/paquete-de-visita'

const RAIZ = process.cwd()
const leer = (...p: string[]) => readFileSync(join(RAIZ, ...p), 'utf8')
/** En este repositorio los comentarios CITAN el nombre del guardián a propósito. */
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')

const NOTA_FIRMADA = {
  id: 'nota-1',
  estado: 'firmada',
  tipo: 'consulta_externa',
  resumenEjecutivo: 'Faringitis aguda.',
  medicamentos: [{ nombre: 'Amoxicilina', dosis: '500 mg', via: 'oral', frecuencia: 'cada 8 horas', duracion: '7 días' }],
  estudiosOrden: ['Biometría hemática'],
}

describe('POSTVISIT-GATE-001 · la compuerta de firma', () => {
  it('una nota EN BORRADOR no puede dar un paquete', () => {
    const v = puedeComponerse({ ...NOTA_FIRMADA, estado: 'borrador' })
    expect(v.ok).toBe(false)
    expect(v.ok === false && v.motivo).toMatch(/firmada/i)
  })

  it('componer desde un borrador LANZA — no devuelve un paquete a medias', () => {
    expect(() => componerPaquete({ nota: { ...NOTA_FIRMADA, estado: 'borrador' } })).toThrow(/firmada/i)
  })

  it('una nota sin estado tampoco pasa: ausencia de dato no es dato de firma', () => {
    expect(puedeComponerse({ ...NOTA_FIRMADA, estado: undefined }).ok).toBe(false)
  })

  it('una nota de hospitalización no da paquete: el paciente no se va a casa hoy', () => {
    expect(puedeComponerse({ ...NOTA_FIRMADA, internamientoId: 'int-1' }).ok).toBe(false)
    expect(puedeComponerse({ ...NOTA_FIRMADA, tipo: 'evolucion_hospitalaria' }).ok).toBe(false)
  })

  it('una nota firmada de consulta sí pasa (el control de que lo anterior no pasa por vacío)', () => {
    expect(puedeComponerse(NOTA_FIRMADA)).toEqual({ ok: true })
  })
})

describe('POSTVISIT-001 · la composición sale de la nota y de nada más', () => {
  it('la instrucción del medicamento se compone, no se inventa', () => {
    const p = componerPaquete({ nota: NOTA_FIRMADA })
    expect(p.medicationInstructions).toEqual([{
      nombre: 'Amoxicilina',
      instruccion: 'Amoxicilina · 500 mg · por la boca · cada 8 horas (3 veces al día) · durante 7 días',
    }])
  })

  it('nace DRAFT aunque la nota esté firmada, y sin aprobador ni fecha', () => {
    const p = componerPaquete({ nota: NOTA_FIRMADA })
    expect(p.estado).toBe('DRAFT')
    expect(p.approvedBy).toBeNull()
    expect(p.approvedAt).toBeNull()
    expect(visibleParaElPaciente(p)).toBe(false)
  })

  it('los signos de alarma sólo llevan lo que ESCRIBIÓ el médico', () => {
    expect(componerPaquete({ nota: NOTA_FIRMADA }).warningSigns).toEqual([])
    expect(componerPaquete({ nota: NOTA_FIRMADA, signosDeAlarma: ['Fiebre de más de 38 °C'] }).warningSigns)
      .toEqual(['Fiebre de más de 38 °C'])
  })

  it('el material educativo y los documentos siguen vacíos: no hay de dónde sacarlos', () => {
    const p = componerPaquete({ nota: NOTA_FIRMADA })
    expect(p.educationalMaterial).toEqual([])
    expect(p.documents).toEqual([])
    expect(p.unansweredQuestions).toEqual([])
  })

  it('guarda el `notaId`: la fuente de verdad sigue siendo la nota', () => {
    expect(componerPaquete({ nota: NOTA_FIRMADA }).notaId).toBe('nota-1')
  })

  it('la vía de contacto dice a quién llamar y no sepulta la urgencia', () => {
    expect(comoContactar('55 1234 5678')).toContain('55 1234 5678')
    expect(comoContactar('')).toMatch(/urgencia/i)
  })
})

describe('POSTVISIT-001 · qué cambió, y qué NO se afirma sin saberlo', () => {
  it('SIN lista previa devuelve null — no «sin cambios»', () => {
    expect(cambiosDeMedicacion([{ nombre: 'Amoxicilina' }], undefined)).toBeNull()
    expect(componerPaquete({ nota: NOTA_FIRMADA }).medicationChanges).toBeNull()
  })

  it('una lista previa VACÍA sí es un dato: el paciente no tomaba nada', () => {
    expect(cambiosDeMedicacion([{ nombre: 'Amoxicilina' }], []))
      .toEqual([{ nombre: 'Amoxicilina', tipo: 'nuevo' }])
  })

  it('distingue nuevo, sin-cambio y suspendido', () => {
    const c = cambiosDeMedicacion(
      [{ nombre: 'Amoxicilina' }, { nombre: 'Losartán' }],
      [{ nombre: 'Losartán' }, { nombre: 'Metformina' }],
    )
    expect(c).toEqual([
      { nombre: 'Amoxicilina', tipo: 'nuevo' },
      { nombre: 'Losartán', tipo: 'sin-cambio' },
      { nombre: 'Metformina', tipo: 'suspendido' },
    ])
  })

  it('compara sin acentos ni mayúsculas: «Losartán» y «losartan» son el mismo fármaco', () => {
    expect(cambiosDeMedicacion([{ nombre: 'losartan' }], [{ nombre: 'Losartán' }]))
      .toEqual([{ nombre: 'losartan', tipo: 'sin-cambio' }])
  })
})

describe('POSTVISIT-001 · la aprobación es lo único que abre la puerta', () => {
  it('liberado con aprobador y fecha, ya es visible', () => {
    const p = liberar(componerPaquete({ nota: NOTA_FIRMADA }), 'dr@consultorio.mx', 1_754_000_000_000)
    expect(p.estado).toBe('RELEASED')
    expect(visibleParaElPaciente(p)).toBe(true)
  })

  it('no hay otra puerta: `componerPaquete` no puede devolver RELEASED', () => {
    /* Probado AL REVÉS: si alguien añadiera un atajo que compusiera ya
       liberado, este caso lo caza antes de que llegue a un paciente. */
    for (const v of [undefined, 1, 9]) {
      expect(componerPaquete({ nota: NOTA_FIRMADA, version: v }).estado).toBe('DRAFT')
    }
  })
})

describe('POSTVISIT-001 · la ruta del servidor es la única puerta, y aplica las dos compuertas', () => {
  const ruta = leer('src', 'app', 'api', 'paciente', 'paquete', 'route.ts')

  it('exige la capacidad de FIRMAR: liberar es aprobación clínica', () => {
    expect(ruta).toContain("verificarCapacidad(req, clinicId, 'firmar')")
  })

  it('comprueba la compuerta de firma ANTES de componer', () => {
    expect(ruta.indexOf('puedeComponerse(')).toBeGreaterThan(-1)
    expect(ruta.indexOf('puedeComponerse(')).toBeLessThan(ruta.indexOf('componerPaquete('))
  })

  it('quién aprueba sale de la SESIÓN, nunca del cuerpo de la petición', () => {
    expect(ruta).toMatch(/liberar\(paquete,\s*aprobadoPor/)
    expect(ruta).toContain('const aprobadoPor = acceso.email || acceso.uid')
    expect(ruta).not.toMatch(/body\??\.\s*aprobadoPor|body\??\.\s*approvedBy/)
  })

  it('el contenido NO llega del navegador: el cuerpo sólo trae a qué nota se refiere', () => {
    /* Lo único que viaja desde la pantalla es lo que escribe el médico. Si
       algún día se aceptara `body.medicationInstructions`, lo que el paciente
       lee dejaría de estar atado a lo firmado. */
    expect(ruta).not.toMatch(/body\??\.\s*(medicationInstructions|encounterSummary|orders|medicamentos)\b/)
    expect(ruta).toContain('body?.signosDeAlarma')
  })

  it('está declarada en el registro de rutas con esa misma capacidad', () => {
    const reg = leer('src', 'lib', 'authz', 'registro-rutas.ts')
    expect(reg).toMatch(/'paciente\/paquete':\s*\{\s*tipo:\s*'capacidad',\s*capacidad:\s*'firmar'\s*\}/)
  })
})

describe('POSTVISIT-GATE-001 · la hoja de la consulta ya no se compone del borrador', () => {
  const page = leer('src', 'app', '(dashboard)', 'consulta', '[patientId]', 'page.tsx')

  it('`HojaParaElPaciente` sólo se renderiza con la nota FIRMADA', () => {
    expect(page).toMatch(/\{!esNotaHospital && firmada && \(\s*\n\s*<HojaParaElPaciente/)
  })

  it('`proximaCita` ya no está fijo en `undefined` (su bloque no podía verse jamás)', () => {
    expect(page).not.toMatch(/proximaCita=\{undefined\}/)
  })
})

describe('POSTVISIT-ENTREGA-001 · el dato tiene que LLEGAR al paciente', () => {
  it('la consulta monta la pantalla de liberar, con la nota firmada', () => {
    const page = leer('src', 'app', '(dashboard)', 'consulta', '[patientId]', 'page.tsx')
    expect(page).toContain("import { LiberarAlPaciente } from '@/components/LiberarAlPaciente'")
    expect(page).toMatch(/firmada && clinicId && notaId && \(\s*\n\s*<LiberarAlPaciente/)
  })

  it('la pantalla del médico pide el paquete al SERVIDOR; no lo compone ella', () => {
    const comp = leer('src', 'components', 'LiberarAlPaciente.tsx')
    expect(comp).toContain("fetchAutenticado('/api/paciente/paquete'")
    expect(comp).not.toContain('componerPaquete')
  })

  it('el portal del paciente PIDE los paquetes y los pinta', () => {
    /* La lección de «el dato tiene que LLEGAR»: que exista la colección, la
       ruta y la compuerta no sirve de nada si la pantalla nunca los pide. */
    const mi = leer('src', 'app', 'mi', '[token]', 'page.tsx')
    expect(mi).toMatch(/action:\s*'paquetes'/)
    expect(mi).toContain('setPaquetes(')
    expect(mi).toContain('p.medicationInstructions')
  })

  it('la pantalla del paciente NO vuelve a decidir qué es visible', () => {
    /* La compuerta la aplica el servidor. Una segunda regla de visibilidad en
       el cliente es la que se olvida de actualizar el día que cambie.

       Se mira el CÓDIGO sin comentarios: la pantalla cita a `visibleParaElPaciente`
       por su nombre para explicar quién filtra, y una comprobación sobre el texto
       crudo confundiría la explicación con una segunda compuerta. */
    const mi = sinComentarios(leer('src', 'app', 'mi', '[token]', 'page.tsx'))
    expect(mi).not.toContain("=== 'RELEASED'")
    expect(mi).not.toContain('visibleParaElPaciente')
  })
})
