/**
 * GOLDEN — el muro de pago no puede dejar al médico encerrado y en silencio.
 *
 * ── EL FALLO, DE LA AUDITORÍA DE LANZAMIENTO ─────────────────────────────────
 *
 * `AccesoGate` es la pantalla que **bloquea la aplicación entera** cuando no hay
 * suscripción activa. Su único botón llamaba a `/api/stripe/checkout` así:
 *
 *     const data = await res.json()
 *     if (data.url) { window.location.href = data.url; return }
 *     setCargando(null)          // ← y aquí se acababa todo
 *
 * Si el servidor contestaba un error —un precio anual sin configurar, una
 * clínica que no existe, Stripe caído— el botón volvía de «Abriendo…» a
 * «Empezar» y **no pasaba nada más**. Ni mensaje, ni motivo, ni a quién
 * preguntarle. El médico se queda fuera de su propio consultorio con la tarjeta
 * en la mano.
 *
 * El `catch { setCargando(null) }` hacía lo mismo con los fallos de red.
 *
 * Y la pantalla de Configuración **ya enseñaba el error de este mismo endpoint**:
 * la que más lo necesitaba era la única que no lo hacía.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const layout = readFileSync(
  join(process.cwd(), 'src', 'app', '(dashboard)', 'layout.tsx'), 'utf8')

describe('el fallo se dice', () => {
  it('el error del servidor se enseña, no se traga', () => {
    expect(layout).toContain('setError(String(data.error ||')
  })

  it('y si no hay ninguno, igual se dice algo accionable', () => {
    // «No pasó nada» no es un estado que el médico pueda interpretar.
    expect(layout).toMatch(/No se pudo abrir el pago\. Vuelve a intentarlo/)
  })

  it('el fallo de RED se distingue del fallo del servidor', () => {
    // Reintentar arregla uno y no el otro: decir cuál es ahorra la llamada.
    expect(layout).toContain('No se pudo conectar. Revisa tu conexión')
    expect(layout).not.toContain('} catch { setCargando(null) }')
  })

  it('un cuerpo que no es JSON tampoco revienta la pantalla', () => {
    expect(layout).toContain('await res.json().catch(() => ({}))')
  })
})

describe('y hay una salida', () => {
  it('se ofrece a quién escribirle', () => {
    // Un muro sin puerta ni timbre es peor que un muro: esta pantalla bloquea
    // la aplicación entera.
    expect(layout).toContain('CORREO_SOPORTE')
    expect(layout).toContain('con tu correo de acceso')
    /* Y el timbre no puede sonar en casa ajena: `nexusmed.mx` es de otro. */
    expect(layout).not.toContain('@nexusmed.mx')
  })

  it('el aviso es accesible y se lee como alerta', () => {
    expect(layout).toContain('role="alert"')
    expect(layout).toContain('No se pudo abrir el pago')
  })

  it('sólo aparece cuando de verdad falló', () => {
    expect(layout).toContain('{error && (')
  })
})
