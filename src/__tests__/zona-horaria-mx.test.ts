/**
 * La zona horaria se adivina, y adivinar mal corre la agenda una hora.
 *
 * El defecto de origen: `DEFAULT_CONFIG` daba `America/Chihuahua` —la zona del
 * dueño— a todo consultorio nuevo. Nada falla de forma visible cuando está mal;
 * simplemente las citas, los recordatorios y el corte de caja quedan corridos.
 */
import { describe, it, expect } from 'vitest'
import { zonaMXDe, seReconocio, ZONA_POR_DEFECTO, ZONAS_MX } from '@/lib/zona-horaria-mx'

describe('zonaMXDe', () => {
  it('acepta tal cual las cinco zonas que el sistema maneja', () => {
    for (const z of ZONAS_MX) expect(zonaMXDe(z)).toBe(z)
  })

  it('traduce los nombres que la IANA retiró en 2022', () => {
    // Los navegadores viejos siguen devolviéndolos, y siguen siendo correctos.
    expect(zonaMXDe('America/Ciudad_Juarez')).toBe('America/Chihuahua')
    expect(zonaMXDe('America/Mazatlan')).toBe('America/Hermosillo')
    expect(zonaMXDe('America/Matamoros')).toBe('America/Monterrey')
  })

  it('cae a CDMX ante una zona de fuera de México', () => {
    // Un portátil mal configurado no puede propagar Europe/Madrid a la agenda,
    // los recordatorios y el corte de caja.
    expect(zonaMXDe('Europe/Madrid')).toBe(ZONA_POR_DEFECTO)
    expect(zonaMXDe('UTC')).toBe(ZONA_POR_DEFECTO)
  })

  it('nunca lanza ni devuelve vacío', () => {
    for (const v of [undefined, null, '', '   ', 'basura']) {
      expect(ZONAS_MX).toContain(zonaMXDe(v as string | null | undefined))
    }
  })

  it('el valor por defecto es CDMX, no la zona del dueño', () => {
    // Chihuahua era una razón del dueño y ninguna para nadie más; CDMX es donde
    // está la mayor parte del país, así que el peor caso afecta a menos gente.
    expect(ZONA_POR_DEFECTO).toBe('America/Mexico_City')
    expect(ZONA_POR_DEFECTO).not.toBe('America/Chihuahua')
  })
})

describe('seReconocio', () => {
  it('distingue «lo supe» de «me lo inventé»', () => {
    // Hace falta para poder avisar en Configuración: adivinar está bien,
    // adivinar y no decirlo no.
    expect(seReconocio('America/Mexico_City')).toBe(true)
    expect(seReconocio('America/Ciudad_Juarez')).toBe(true)
    expect(seReconocio('Europe/Madrid')).toBe(false)
    expect(seReconocio('')).toBe(false)
  })
})
