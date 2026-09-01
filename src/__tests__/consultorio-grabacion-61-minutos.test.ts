import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { LATIDO_MS } from '@/lib/seguridad/estoy-grabando'

const RAIZ = process.cwd()
const grabador = readFileSync(join(RAIZ, 'src/hooks/useGrabacionAudio.ts'), 'utf8')
const autoLogout = readFileSync(join(RAIZ, 'src/components/AutoLogout.tsx'), 'utf8')

/**
 * Golden Path Consultorio — continuidad de una consulta larga.
 *
 * Esta prueba no espera 61 minutos de reloj real. Congela las invariantes que
 * hacen que una captura pueda atravesarlos:
 * - el reloj del grabador deriva de tiempo transcurrido, sin clamp/timeout;
 * - el intervalo que actualiza duración no llama a detener();
 * - el audio largo cambia de transporte por tamaño, no termina la captura;
 * - mientras el micrófono está abierto existe un latido más frecuente que el
 *   cierre por inactividad y AutoLogout lo trata como actividad.
 *
 * Si alguien vuelve a introducir un máximo de 10/30/60 minutos o desconecta el
 * latido, este test debe ponerse rojo antes de llegar al médico.
 */
describe('Consultorio — grabación sintética de 61 minutos', () => {
  it('el reloj representa 10, 30 y 61 minutos sin truncar la duración', () => {
    const inicio = 1_700_000_000_000
    const segundos = (minutos: number) => Math.floor(((inicio + minutos * 60_000) - inicio - 0) / 1000)

    expect(segundos(10)).toBe(600)
    expect(segundos(30)).toBe(1800)
    expect(segundos(61)).toBe(3660)

    // La misma fórmula debe seguir siendo la que usa producción.
    expect(grabador).toContain('Date.now() - startRef.current - pausaTotalMsRef.current')
    expect(grabador).toContain('Math.floor(transcurrido / 1000)')
  })

  it('el temporizador de duración sólo mide: no contiene una orden de auto-detener', () => {
    const bloques = [...grabador.matchAll(/timerRef\.current = setInterval\(\(\) => \{([\s\S]*?)\}, 500\)/g)]
    expect(bloques.length).toBeGreaterThanOrEqual(1)
    for (const bloque of bloques) {
      expect(bloque[1]).toContain('transcurrido')
      expect(bloque[1]).not.toMatch(/\bdetener\s*\(/)
      expect(bloque[1]).not.toMatch(/\bstop\s*\(/)
    }
  })

  it('no existe un máximo de duración que corte la captura a 10, 30 o 60 minutos', () => {
    expect(grabador).not.toMatch(/DURACION_MAXIMA|DURACIÓN_MÁXIMA|MAX(?:IMA|_)?_?DURACION|MAX(?:IMUM)?_?DURATION/i)
    expect(grabador).not.toMatch(/duracion(?:Ref\.current)?\s*>?=\s*(?:600|1800|3600)\b/i)
    expect(grabador).not.toMatch(/transcurrido\s*>?=\s*(?:600000|1800000|3600000)\b/i)
  })

  it('una grabación grande cambia al camino de audio largo en vez de terminar la sesión', () => {
    expect(grabador).toContain('blob.size > LIMITE_CUERPO_BYTES')
    expect(grabador).toContain('intentarDiarizarLargo')
    expect(grabador).toContain('rec.start(TROZO_MS)')
  })

  it('el latido de grabación mantiene viva la sesión durante más de 60 minutos', () => {
    const inactividad = autoLogout.match(/const INACTIVIDAD_MIN = (\d+)/)
    expect(inactividad).not.toBeNull()
    const inactividadMs = Number(inactividad![1]) * 60_000

    expect(LATIDO_MS).toBeGreaterThan(0)
    expect(LATIDO_MS).toBeLessThan(inactividadMs)

    // 61 minutos contienen muchos latidos; ninguno depende de mouse/teclado.
    expect(Math.floor((61 * 60_000) / LATIDO_MS)).toBeGreaterThanOrEqual(2)
    expect(grabador).toContain('window.setInterval')
    expect(grabador).toContain('EVENTO_GRABANDO')
    expect(autoLogout).toContain('window.addEventListener(EVENTO_GRABANDO, onGrabando)')
    expect(autoLogout).toContain('const onGrabando = () => reiniciar()')
  })
})
