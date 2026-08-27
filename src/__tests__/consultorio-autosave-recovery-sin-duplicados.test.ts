import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { queHacerConElRespaldoLocal } from '@/lib/mobile/local-drafts'
import { decidirAdopcionDeNotaPrevia } from '@/lib/expediente/recuperacion-consulta'

const RAIZ = process.cwd()
const consulta = readFileSync(join(RAIZ, 'src/app/(dashboard)/consulta/[patientId]/page.tsx'), 'utf8')

describe('Consultorio Golden Path 2 — autosave y recovery sin duplicados', () => {
  it('un respaldo del mismo encuentro se ofrece al reabrir; otro encuentro o una nota firmada no', () => {
    expect(queHacerConElRespaldoLocal({
      hayRespaldo: true,
      respaldoNotaId: 'nota-1',
      notaAbierta: 'nota-1',
      notaFirmada: false,
      formularioVacio: false,
    })).toBe('OFRECER')

    expect(queHacerConElRespaldoLocal({
      hayRespaldo: true,
      respaldoNotaId: 'nota-1',
      notaAbierta: 'nota-2',
      notaFirmada: false,
      formularioVacio: false,
    })).toBe('CALLAR')

    expect(queHacerConElRespaldoLocal({
      hayRespaldo: true,
      respaldoNotaId: 'nota-1',
      notaAbierta: 'nota-1',
      notaFirmada: true,
      formularioVacio: false,
    })).toBe('CALLAR')
  })

  it('un encuentro nuevo vacío repone el snapshot completo, no crea una segunda copia', () => {
    expect(queHacerConElRespaldoLocal({
      hayRespaldo: true,
      respaldoNotaId: null,
      notaAbierta: null,
      notaFirmada: false,
      formularioVacio: true,
    })).toBe('APLICAR_SOLO')

    // La restauración reemplaza cada colección con el snapshot saneado. No usa
    // append/concat/fusión: refrescar dos veces no duplica diagnósticos,
    // medicamentos ni secciones.
    expect(consulta).toContain('setSecciones(seccionesSanas(b.secciones))')
    expect(consulta).toContain('setDiagnosticos(diagnosticosSanos(b.diagnosticos))')
    expect(consulta).toContain('setMedicamentos(medicamentosSanos(b.medicamentos))')
    expect(consulta).toContain('voz.setTranscripcion(b.transcripcion)')
    expect(consulta).not.toMatch(/setDiagnosticos\([^\n]*(?:concat|\.\.\.diagnosticos)/)
    expect(consulta).not.toMatch(/setMedicamentos\([^\n]*(?:concat|\.\.\.medicamentos)/)
  })

  it('el autosave local serializa un snapshot único con identidad de nota y transcript', () => {
    expect(consulta).toContain('localStorage.setItem(respaldoKey')
    expect(consulta).toContain('notaId: notaIdRef.current')
    expect(consulta).toContain('transcripcion: e.transcripcion')
    expect(consulta).toContain('diagnosticos: e.diagnosticos')
    expect(consulta).toContain('medicamentos: e.medicamentos')
    expect(consulta).toContain('ts: Date.now()')
  })

  it('pagehide, background y unmount fuerzan flush inmediato; refresh/crash no dependen del debounce', () => {
    expect(consulta).toContain("window.addEventListener('pagehide', flushRespaldo)")
    expect(consulta).toContain("document.addEventListener('visibilitychange', onHide)")
    expect(consulta).toContain('flushRespaldo()  // ← al desmontar')
  })

  it('si la nota del respaldo ya fue firmada, conserva el contenido pero no reutiliza el id inmutable', () => {
    /**
     * MIGRADO EN H-06 (REG-330): la comprobación escrita a mano tenía dentro un
     * `catch(() => null)` que confundía «no pude leer» con «no existe», así que
     * un fallo de red volvía a adoptar el id de una posible firmada. Ahora la
     * decisión es explícita y con los cuatro estados separados; el
     * comportamiento sellado aquí no cambia.
     */
    expect(decidirAdopcionDeNotaPrevia({ estado: 'firmada' }).adoptar).toBe(false)
    expect(consulta).toContain('const decision = decidirAdopcionDeNotaPrevia(')
    // El aviso se mudó al módulo junto con la decisión: decir «se guardará como
    // una nota NUEVA» y decidir si se adopta el id son la misma frase.
    expect(decidirAdopcionDeNotaPrevia({ estado: 'firmada' }).aviso)
      .toContain('Lo recuperado se guardará como una nota NUEVA')
    expect(consulta).toContain("toast(decision.aviso, 'info')")
    // La adopción del id sólo ocurre en la rama no firmada.
    expect(consulta).toContain('notaIdRef.current = id')
    expect(consulta).toContain('setNotaId(id)')
  })
})
