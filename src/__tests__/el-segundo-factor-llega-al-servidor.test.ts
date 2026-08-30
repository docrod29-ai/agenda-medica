/**
 * GOLDEN — el token decía si hubo segundo factor, y el servidor lo tiraba.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * El producto tiene **TOTP implementado y funcionando**: enrolamiento en
 * Configuración (`secciones-seguridad.tsx`), resolución en el login
 * (`login/page.tsx`), sobre el multi-factor de Firebase.
 *
 * Y `auth-server.ts` decodificaba el ID-token y se quedaba **sólo con `uid` y
 * `email`**. Firebase pone en ese mismo token `firebase.sign_in_second_factor`
 * —cómo se inició la sesión— y se descartaba en la línea siguiente.
 *
 * Consecuencia: **ninguna ruta del servidor podía saber si la sesión que tenía
 * delante había usado el segundo factor.** Una sesión sin él tenía privilegios
 * idénticos. El dato llegaba y nadie lo leía, que es el patrón «el dato tiene que
 * LLEGAR» en la frontera de autenticación.
 *
 * ── Y EL PANEL DECÍA OTRA COSA ──────────────────────────────────────────────
 *
 * `security-controls.ts` declaraba MFA como `planned`, con el detalle «requiere
 * habilitar Identity Platform para implementarlo y probarlo». Era **falso**:
 * estaba implementado y cableado en dos pantallas. Un panel de cumplimiento que
 * se equivoca —aunque sea por defecto, declarando de menos— no se puede usar en
 * ninguna dirección: si miente hacia abajo hoy, nadie sabe si miente hacia arriba
 * mañana.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * **Si hay segundo factor enrolado, la sesión tiene que haberlo usado.**
 *
 * No «siempre»: exigirlo a secas dejaría al dueño fuera de su propia consola el
 * día que todavía no ha enrolado nada. La condición se ata a un hecho
 * comprobable de su cuenta —tiene factores enrolados— y no a una política que
 * este código no puede decidir.
 *
 * Cierra una ventana real: Firebase bloquea el **inicio de sesión** de un usuario
 * enrolado, pero un token emitido ANTES de enrolar sigue siendo válido hasta que
 * caduca. Quien enrola TOTP porque sospecha que le robaron la contraseña seguía
 * teniendo, durante esa ventana, una sesión abierta con todo.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **Sólo se exige en la consola del dueño.** El coste es una lectura de usuario
 *   por petición: en la consola —tráfico bajísimo— es irrelevante; en el camino
 *   clínico habría que pagarlo en cada nota. Extenderlo al resto de rutas
 *   privilegiadas es una decisión de política del dueño, no de este archivo.
 * · **No prueba el TOTP contra Firebase.** Prueba que el servidor lee la
 *   afirmación del token y actúa en consecuencia. Que Firebase emita bien esa
 *   afirmación es de Firebase.
 * · **No cubre códigos de recuperación**, que el diseño menciona y el producto
 *   todavía no tiene.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { SECURITY_CONTROLS } from '@/config/security-controls'

const leer = (p: string) => readFileSync(p, 'utf8')

const authServer = leer('src/lib/auth-server.ts')
const superadmin = leer('src/lib/superadmin.ts')

describe('el servidor deja de tirar la afirmación del token', () => {
  it('`verificarToken` lee `sign_in_second_factor`', () => {
    expect(authServer).toMatch(/sign_in_second_factor/)
    /* Y lo devuelve, que es la mitad que faltaba: leerlo y no propagarlo sería
       el mismo defecto con un paso más. */
    expect(authServer).toMatch(/segundoFactor:\s*Boolean\(decoded\.firebase\?\.sign_in_second_factor\)/)
  })

  it('y lo propaga a TODAS las puertas que devuelven un acceso', () => {
    /**
     * Propagarlo en una sola puerta sería peor que no propagarlo: una ruta que
     * pregunte `acceso.segundoFactor` recibiría `undefined` —falsy— y se
     * comportaría como si nadie hubiera usado su segundo factor. Un campo que
     * existe a veces es peor que uno que no existe nunca.
     */
    const retornos = [...authServer.matchAll(/return \{ ok: true,[^}]*\}/g)].map(m => m[0])
    expect(retornos.length, 'el lector de retornos dejó de encontrar puertas').toBeGreaterThanOrEqual(2)
    const sinCampo = retornos.filter(r => !r.includes('segundoFactor'))
    expect(sinCampo, 'puertas que devuelven acceso sin decir si hubo segundo factor').toEqual([])
  })

  it('el tipo del acceso lo declara', () => {
    expect(authServer).toMatch(/segundoFactor\?: boolean/)
  })
})

describe('la consola del dueño lo exige a quien lo tiene enrolado', () => {
  it('si el token no trae segundo factor, se consulta si hay factores enrolados', () => {
    expect(superadmin).toMatch(/if \(!decoded\.firebase\?\.sign_in_second_factor\)/)
    expect(superadmin).toMatch(/multiFactor\?\.enrolledFactors/)
  })

  it('y se responde 403 con un mensaje que dice qué hacer', () => {
    /* «No autorizado» a secas manda a alguien a revisar permisos cuando lo que
       tiene que hacer es volver a entrar. */
    expect(superadmin).toMatch(/Cierra sesión y vuelve a entrar con tu código/)
    expect(superadmin).toMatch(/status: 403/)
  })

  it('NO se exige a quien no ha enrolado nada — o sería un candado sin llave', () => {
    /**
     * Este caso protege una decisión, no una línea. Si alguien «endurece» esto
     * quitando la comprobación de enrolamiento, el dueño se queda fuera de su
     * propia consola en cuanto caduque su sesión. La condición tiene que seguir
     * colgando de `enrolledFactors`.
     */
    const bloque = superadmin.slice(
      superadmin.indexOf('sign_in_second_factor'),
      superadmin.indexOf('return { ok: true, uid: decoded.uid'),
    )
    /* Se comprueba la INTENCIÓN, no la forma exacta de la expresión: el conteo
       de factores enrolados existe, y la negativa cuelga de que sea positivo. */
    expect(bloque).toMatch(/enrolledFactors/)
    expect(bloque).toMatch(/> 0/)
    expect(bloque.indexOf('enrolledFactors')).toBeLessThan(bloque.indexOf('status: 403'))
  })

  it('si no se puede COMPROBAR, no se deja pasar — y se dice que es eso', () => {
    /**
     * Dos formas de equivocarse aquí, y las dos estarían mal:
     *
     *  · seguir adelante convertiría un fallo de red en el modo de saltarse la
     *    comprobación;
     *  · responder «token inválido» mandaría al dueño a revisar su sesión cuando
     *    lo que pasa es que Firebase no contestó (familia `mensaje_miente`).
     *
     * Se falla cerrado, con 503 y con la causa dicha.
     */
    const bloque = superadmin.slice(
      superadmin.indexOf('sign_in_second_factor'),
      superadmin.indexOf('return { ok: true, uid: decoded.uid'),
    )
    expect(bloque).toMatch(/No se pudo comprobar tu segundo factor/)
    expect(bloque).toMatch(/status: 503/)
    /* Y el 503 sale de un `catch` propio, no del `catch` general que responde
       «token inválido»: es lo que separa «no se pudo comprobar» de «no eres tú». */
    expect(bloque).toMatch(/catch \{[\s\S]{0,400}status: 503/)
  })

  it('la comprobación va DESPUÉS de saber que es el dueño', () => {
    /* Preguntarle a Firebase por los factores de cualquier UID que llame sería
       un oráculo gratis para quien pruebe correos. Primero se comprueba quién es. */
    expect(superadmin.indexOf('esSuperadmin(decoded.email)'))
      .toBeLessThan(superadmin.indexOf('multiFactor?.enrolledFactors'))
  })
})

describe('el panel de seguridad deja de decir que MFA está sin hacer', () => {
  const mfa = SECURITY_CONTROLS.find(c => c.id === 'mfa')

  it('el control existe', () => {
    expect(mfa, 'desapareció el control de MFA del panel').toBeDefined()
  })

  it('ya no se declara `planned`', () => {
    /* Estaba implementado y cableado en dos pantallas, y el panel decía que
       requería «habilitar Identity Platform para implementarlo». */
    expect(mfa!.estado).not.toBe('planned')
    expect(mfa!.detalle).not.toMatch(/Requiere habilitar Identity Platform/)
  })

  it('tampoco se declara verificado, porque no lo está del todo', () => {
    /**
     * La tentación opuesta es igual de mala. Sólo se exige en la consola del
     * dueño; el resto de rutas privilegiadas sigue sin exigirlo, y eso es una
     * decisión de política. `implemented-pending-verification` es exactamente lo
     * que es.
     */
    expect(mfa!.estado).toBe('implemented-pending-verification')
    expect(mfa!.detalle).toMatch(/decisión de política del dueño/)
  })

  it('su evidencia nombra archivos que existen', () => {
    for (const archivo of ['src/lib/mfa.ts', 'src/lib/auth-server.ts', 'src/lib/superadmin.ts']) {
      expect(() => leer(archivo), `${archivo} citado como evidencia y no existe`).not.toThrow()
    }
    expect(mfa!.evidencia).toMatch(/sign_in_second_factor/)
  })

  it('y el TOTP que el panel dice tener está cableado en las dos pantallas', () => {
    /* Lo que hizo falso el estado anterior fue no mirar esto. */
    expect(leer('src/app/login/page.tsx')).toMatch(/resolverLoginTotp/)
    expect(leer('src/app/(dashboard)/configuracion/secciones-seguridad.tsx'))
      .toMatch(/iniciarEnrolamientoTotp/)
  })
})
