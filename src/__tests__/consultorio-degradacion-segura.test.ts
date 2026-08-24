import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const RAIZ = process.cwd()
const consulta = readFileSync(join(RAIZ, 'src/app/(dashboard)/consulta/[patientId]/page.tsx'), 'utf8')

describe('Consultorio Golden Path 8 — degradación segura sin perder el encuentro', () => {
  it('si IA devuelve una respuesta ilegible, declara que la nota no se modificó y conserva el borrador', () => {
    expect(consulta).toContain("toast('La IA no respondió correctamente. Tu nota NO se modificó; intenta de nuevo.', 'error')")
    expect(consulta).toContain('setTareaProc({ ejecutando: false })')

    // El fallo termina únicamente el trabajo secundario. No existe una rama de
    // error que vacíe el contenido clínico para “volver a empezar”.
    const inicio = consulta.indexOf("const data = await res.json().catch(() => null)")
    const fin = consulta.indexOf("if (!enVivo) {\n        setSinCreditos(null)", inicio)
    const ramaFallo = consulta.slice(inicio, fin)
    expect(ramaFallo).not.toContain('setSecciones([])')
    expect(ramaFallo).not.toContain('setDiagnosticos([])')
    expect(ramaFallo).not.toContain('setMedicamentos([])')
    expect(ramaFallo).not.toContain("setTranscripcion('')")
  })

  it('un fallo de red de IA deja de procesar, pero no convierte la consulta en un bloqueo de firma', () => {
    expect(consulta).toContain("catch {\n      if (!enVivo) { toast('Error al conectar con la IA', 'error'); setTareaProc({ ejecutando: false }) }")
    expect(consulta).toContain('else setProcesando(false)')

    // La firma vive en su propio flujo clínico y no exige que el trabajo IA siga
    // activo o haya producido resultado. Los bloqueos de firma son los motivos
    // clínicos/medicolegalmente explícitos del módulo canónico.
    expect(consulta).toContain('motivosParaNoFirmar')
    expect(consulta).toContain('porQueNoSePuedeFirmar')
    expect(consulta).not.toMatch(/(?:procesando|tareaProc)[^\n]{0,120}(?:motivosParaNoFirmar|porQueNoSePuedeFirmar)/)
  })

  it('si evidencia falla, sólo degrada ese análisis: no borra nota, diagnósticos ni tratamiento', () => {
    const marca = "console.error('[evidencia] fallo'"
    expect(consulta).toContain(marca)
    expect(consulta).toContain("toast(data?.error || `No se pudo analizar (HTTP ${res.status})`, 'error')")
    expect(consulta).toContain("toast(`Error de red al analizar (${String(e).slice(0, 60)})`, 'error')")
    expect(consulta).toContain('finally { setAnalizandoEv(false) }')

    const inicio = consulta.indexOf(marca)
    const fin = consulta.indexOf('finally { setAnalizandoEv(false) }', inicio) + 'finally { setAnalizandoEv(false) }'.length
    const degradacion = consulta.slice(inicio, fin)
    expect(degradacion).not.toContain('setSecciones(')
    expect(degradacion).not.toContain('setDiagnosticos(')
    expect(degradacion).not.toContain('setMedicamentos(')
    expect(degradacion).not.toContain('router.push(')
  })

  it('si el proveedor opcional de comandos de voz no carga, cae al modo estándar sin interrumpir la consulta', () => {
    expect(consulta).toContain(".catch(() => { /* sin config → modo estándar */ })")
    expect(consulta).toContain("fetchAutenticado(`/api/voz/comandos-config?clinicId=${clinicId}`)")
  })

  it('el respaldo del encuentro no depende del éxito de IA/evidencia/provider', () => {
    expect(consulta).toContain('localStorage.setItem(respaldoKey')
    expect(consulta).toContain('transcripcion: e.transcripcion')
    expect(consulta).toContain('diagnosticos: e.diagnosticos')
    expect(consulta).toContain('medicamentos: e.medicamentos')
    expect(consulta).toContain("window.addEventListener('pagehide', flushRespaldo)")
    expect(consulta).toContain("document.addEventListener('visibilitychange', onHide)")
  })
})
