/**
 * REG-660 — una corrección vacía retira lo automático, no la decisión humana.
 *
 * Origen: auditoría del flujo de consulta solicitado por el dueño. `length > 0`
 * ignoraba [] explícito en primer plano y recuperación. Además el updater leía
 * una ref ya adelantada y los motores confundían identidad con autoría: una
 * dosis editada o un CIE escrito por el médico podían perderse.
 *
 * Ejecuta los bloques REALES de la página con los motores reales y una cola de
 * setters diferidos; no copia su lógica en el arnés. La referencia debe guardar
 * el lote normalizado/deduplicado, y cada updater debe capturar el lote previo.
 * Todos los datos y marcadores son sintéticos; no expresan criterios clínicos.
 *
 * NO cubre navegador, Firestore, cambios de paciente, nota firmada, reproyección
 * de texto libre ni alucinaciones del proveedor. REG-670 añade identidad de
 * captura persistida: una coincidencia de contenido no cambia la autoría.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import type { Diagnostico, Medicamento } from '@/types/expediente'
import { fusionarDiagnosticos } from '@/lib/expediente/fusionar-diagnosticos'
import { fusionarMedicamentos } from '@/lib/expediente/que-va-en-la-receta'

const pagina = readFileSync('src/app/(dashboard)/consulta/[patientId]/page.tsx', 'utf8')
const dx = (descripcion: string, extra: Partial<Diagnostico> = {}): Diagnostico => ({
  descripcion, tipo: 'presuntivo', estado: 'activo', tipoOrigen: 'extraccion', ...extra,
})
const med = (nombre: string, extra: Partial<Medicamento> = {}): Medicamento => ({
  nombre, dosis: 'DOSIS_IA', via: 'oral', frecuencia: '', duracion: '', ...extra,
})
const inicial = {
  diagnosticos: [dx('Hallazgo sintético alfa', { codigoCIE10: 'SINTETICO-A' })],
  medicamentos: [med('Fármaco sintético alfa')],
}
const manualDx = dx('Hallazgo sintético manual', { tipoOrigen: 'medico', codigoCIE10: 'SINTETICO-M' })
const manualMed = med('Fármaco sintético manual', { dosis: 'DOSIS_MEDICO' })
const vacio = { diagnosticos: [], medicamentos: [] }
type Actualizador<T> = T[] | ((previos: T[]) => T[])

function crearArnes(via: 'primer plano' | 'recuperación') {
  const ancla = via === 'primer plano' ? 'const procesarIA = useCallback(' : 'const r = tareaProc?.resultado'
  const inicio = pagina.indexOf('const nuevosDx =', pagina.indexOf(ancla))
  const fin = pagina.indexOf('if (data.signosVitales)', inicio)
  if (pagina.indexOf(ancla) < 0 || inicio < 0 || fin < 0) throw new Error('Falta la integración real de listas')
  const js = ts.transpileModule(pagina.slice(inicio, fin), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None },
  }).outputText
  const ejecutar = new Function(
    'data', 'tipoOverride', 'setDiagnosticos', 'setMedicamentos',
    'dxDeLaIaRef', 'medDeLaIaRef', 'fusionarDiagnosticos', 'fusionarMedicamentos', js,
  )
  const estado = { diagnosticos: [] as Diagnostico[], medicamentos: [] as Medicamento[] }
  const dxRef = { current: [] as Diagnostico[] }, medRef = { current: [] as Medicamento[] }
  const colaDx: Actualizador<Diagnostico>[] = [], colaMed: Actualizador<Medicamento>[] = []
  return {
    estado, dxRef, medRef,
    aplicar(data: Record<string, unknown>, tipoOverride = false) {
      ejecutar(data, tipoOverride,
        (v: Actualizador<Diagnostico>) => colaDx.push(v),
        (v: Actualizador<Medicamento>) => colaMed.push(v),
        dxRef, medRef, fusionarDiagnosticos, fusionarMedicamentos)
    },
    renderizar() {
      for (const v of colaDx.splice(0)) estado.diagnosticos = typeof v === 'function' ? v(estado.diagnosticos) : v
      for (const v of colaMed.splice(0)) estado.medicamentos = typeof v === 'function' ? v(estado.medicamentos) : v
    },
    agregarManuales() {
      estado.diagnosticos.push({ ...manualDx })
      estado.medicamentos.push({ ...manualMed })
    },
  }
}

describe.each(['primer plano', 'recuperación'] as const)('regeneración en %s', via => {
  it('[] explícito retira el lote IA y conserva las entradas manuales', () => {
    const h = crearArnes(via)
    h.aplicar(inicial); h.renderizar(); h.agregarManuales()
    h.aplicar(vacio); h.renderizar()
    expect(h.estado.diagnosticos).toEqual([manualDx])
    expect(h.estado.medicamentos).toEqual([manualMed])
    expect(h.dxRef.current).toEqual([])
    expect(h.medRef.current).toEqual([])
  })

  it('captura el lote anterior antes de adelantar la ref y ejecutar el updater', () => {
    const h = crearArnes(via)
    h.aplicar(inicial); h.renderizar(); h.agregarManuales()
    // La IA menciona ahora lo que el médico YA había escrito: debe ganar él.
    h.aplicar({
      diagnosticos: [dx(manualDx.descripcion)],
      medicamentos: [med(manualMed.nombre)],
    })
    h.renderizar()
    expect(h.estado.diagnosticos).toEqual([manualDx])
    expect(h.estado.medicamentos).toEqual([manualMed])
  })

  it('dos respuestas encoladas retiran su propio lote previo, incluido el último vacío', () => {
    const h = crearArnes(via)
    h.agregarManuales()
    h.aplicar(inicial)
    h.aplicar(vacio)
    h.renderizar()
    expect(h.estado.diagnosticos).toEqual([manualDx])
    expect(h.estado.medicamentos).toEqual([manualMed])
  })

  it.each([undefined, null, 'respuesta incompleta'])('un campo inválido u omitido (%s) conserva datos y procedencia', valor => {
    const h = crearArnes(via)
    h.aplicar(inicial); h.renderizar()
    const anterior = structuredClone(h.estado)
    const dxAnterior = h.dxRef.current, medAnterior = h.medRef.current
    h.aplicar(valor === undefined ? {} : { diagnosticos: valor, medicamentos: valor })
    h.renderizar()
    expect(h.estado).toEqual(anterior)
    expect(h.dxRef.current).toBe(dxAnterior)
    expect(h.medRef.current).toBe(medAnterior)
    h.aplicar(vacio); h.renderizar()
    expect(h.estado).toEqual(vacio)
  })

  it('retira únicamente el campo devuelto explícitamente, conservando el omitido', () => {
    const h = crearArnes(via)
    h.aplicar(inicial); h.renderizar()
    const meds = structuredClone(h.estado.medicamentos), medAnterior = h.medRef.current
    h.aplicar({ diagnosticos: [] }); h.renderizar()
    expect(h.estado.diagnosticos).toEqual([])
    expect(h.estado.medicamentos).toEqual(meds)
    expect(h.medRef.current).toBe(medAnterior)
  })

  it.each([
    { valor: [null] },
    { valor: [{}] },
    { valor: [{ descripcion: '   ', nombre: '   ' }] },
    { valor: [{ descripcion: 'Hallazgo sintético beta', nombre: 'Fármaco sintético beta' }, null] },
  ])('un lote con entradas inválidas no se convierte en retirada: $valor', ({ valor }) => {
    const h = crearArnes(via)
    h.aplicar(inicial); h.renderizar()
    const anterior = structuredClone(h.estado), dxAnterior = h.dxRef.current, medAnterior = h.medRef.current
    h.aplicar({ diagnosticos: valor, medicamentos: valor }); h.renderizar()
    expect(h.estado).toEqual(anterior)
    expect(h.dxRef.current).toBe(dxAnterior)
    expect(h.medRef.current).toBe(medAnterior)
  })

  it('conserva la dosis editada y el diagnóstico decidido por el médico', () => {
    const h = crearArnes(via)
    h.aplicar(inicial); h.renderizar()
    h.estado.diagnosticos[0] = { ...h.estado.diagnosticos[0], tipo: 'descartado', tipoOrigen: 'medico' }
    h.estado.medicamentos[0] = { ...h.estado.medicamentos[0], dosis: 'DOSIS_CORREGIDA', estado: 'suspendida', motivoEstado: 'Decisión sintética' }
    const decisiones = structuredClone(h.estado)
    h.aplicar(vacio); h.renderizar()
    expect(h.estado).toEqual(decisiones)
  })

  it('confirmar el CIE propuesto por IA cuenta como una edición humana (D-051)', () => {
    /**
     * Hasta el 10-sep-2026 el CIE de la IA se borraba en la frontera y este
     * caso lo «reintroducía» a mano. Con D-051 el código entra marcado como
     * sugerido (`codigoOrigen:'extraccion'`) y la edición humana es CONFIRMARLO:
     * el renglón deja de ser idéntico al lote de la IA y una corrección vacía
     * ya no puede retirarlo.
     */
    const h = crearArnes(via)
    h.aplicar(inicial); h.renderizar()
    expect(h.estado.diagnosticos[0]).toMatchObject({ codigoCIE10: 'SINTETICO-A', codigoOrigen: 'extraccion' })
    h.estado.diagnosticos[0] = { ...h.estado.diagnosticos[0], codigoOrigen: 'medico' }
    const codificado = structuredClone(h.estado.diagnosticos)
    h.aplicar(vacio); h.renderizar()
    expect(h.estado.diagnosticos).toEqual(codificado)
    expect(h.estado.medicamentos).toEqual([])
  })

  it('la IA no revierte una decisión humana aunque vuelva a proponer ese mismo renglón', () => {
    const h = crearArnes(via)
    h.aplicar(inicial); h.renderizar()
    h.estado.diagnosticos[0] = { ...h.estado.diagnosticos[0], tipo: 'definitivo', tipoOrigen: 'medico' }
    h.estado.medicamentos[0] = { ...h.estado.medicamentos[0], dosis: 'DOSIS_CORREGIDA' }
    const decisiones = structuredClone(h.estado)
    h.aplicar(inicial); h.renderizar()
    expect(h.estado).toEqual(decisiones)
  })

  it('una dosis editada sigue siendo humana aunque la IA la repita antes de retirarla', () => {
    const h = crearArnes(via)
    h.aplicar(inicial); h.renderizar()
    // Simula la edición y su viaje JSON por el borrador persistido.
    h.estado.medicamentos[0] = JSON.parse(JSON.stringify({
      ...h.estado.medicamentos[0], dosis: 'DOSIS_MEDICO', origenCaptura: 'medico',
    }))
    const decision = structuredClone(h.estado.medicamentos)
    h.aplicar({ medicamentos: decision }); h.renderizar()
    h.aplicar({ medicamentos: [] }); h.renderizar()
    expect(h.estado.medicamentos).toEqual(decision)
  })

  it('la IA no puede atribuirse autoría médica para impedir retirar su propuesta', () => {
    const h = crearArnes(via)
    h.aplicar({ medicamentos: [med('Fármaco sintético alfa', { origenCaptura: 'medico' })] })
    h.renderizar()
    expect(h.estado.medicamentos[0].origenCaptura).toBe('ia')
    h.aplicar({ medicamentos: [] }); h.renderizar()
    expect(h.estado.medicamentos).toEqual([])
  })

  it('reproyectar conserva una captura humana incluso si está suspendida', () => {
    const h = crearArnes(via)
    const decision = med('Fármaco sintético manual', {
      origenCaptura: 'medico', estado: 'suspendida', motivoEstado: 'Decisión sintética',
    })
    h.estado.medicamentos = [decision]
    h.aplicar({ medicamentos: [] }, true); h.renderizar()
    expect(h.estado.medicamentos).toEqual([decision])
  })

  it('recuerda la salida deduplicada completa, incluido un medicamento compuesto', () => {
    const h = crearArnes(via)
    h.aplicar({
      diagnosticos: [
        dx('Hallazgo sintético alfa', { codigoCIE10: 'SINTETICO-A' }),
        dx('Hallazgo sintético alfa específico', { codigoCIE10: 'SINTETICO-A' }),
      ],
      medicamentos: [med('Fármaco sintético alfa', { dosis: '' }), med('Fármaco sintético alfa', { frecuencia: 'FRECUENCIA_IA' })],
    })
    h.renderizar()
    expect(h.estado.diagnosticos).toHaveLength(1)
    expect(h.estado.medicamentos).toHaveLength(1)
    expect(h.dxRef.current).toEqual(h.estado.diagnosticos)
    expect(h.medRef.current).toEqual(h.estado.medicamentos)
    expect(h.estado.medicamentos[0]).toMatchObject({ dosis: 'DOSIS_IA', frecuencia: 'FRECUENCIA_IA', estado: 'borrador' })
    // Releer desde almacenamiento puede reordenar claves; no cambia autoría.
    h.estado.diagnosticos = h.estado.diagnosticos.map(d => Object.fromEntries(Object.entries(d).reverse()) as unknown as Diagnostico)
    h.estado.medicamentos = h.estado.medicamentos.map(m => Object.fromEntries(Object.entries(m).reverse()) as unknown as Medicamento)
    h.aplicar(vacio); h.renderizar()
    expect(h.estado).toEqual(vacio)
  })

  it('una respuesta local degradada vacía no demuestra una retirada clínica', () => {
    const h = crearArnes(via)
    h.aplicar(inicial); h.renderizar()
    const anterior = structuredClone(h.estado), dxAnterior = h.dxRef.current, medAnterior = h.medRef.current
    h.aplicar({ ...vacio, fallbackLocal: true }); h.renderizar()
    expect(h.estado).toEqual(anterior)
    expect(h.dxRef.current).toBe(dxAnterior)
    expect(h.medRef.current).toBe(medAnterior)
  })

  it('reproyectar conserva su reemplazo explícito y las fronteras de sugerencia', () => {
    const h = crearArnes(via)
    h.agregarManuales()
    h.aplicar({ diagnosticos: [dx('Hallazgo sintético beta', { tipo: 'definitivo', codigoCIE10: 'SINTETICO-B' })], medicamentos: [med('Fármaco sintético beta')] }, true)
    h.renderizar()
    expect(h.estado.diagnosticos).toHaveLength(1)
    // D-051: el CIE sobrevive a la frontera, pero como sugerido; la certeza sigue bajando a presuntivo.
    expect(h.estado.diagnosticos[0]).toMatchObject({ tipo: 'presuntivo', codigoCIE10: 'SINTETICO-B', codigoOrigen: 'extraccion' })
    expect(h.estado.medicamentos).toHaveLength(1)
    expect(h.estado.medicamentos[0].estado).toBe('borrador')
    h.aplicar(vacio, true); h.renderizar()
    expect(h.estado).toEqual(vacio)
  })
})
