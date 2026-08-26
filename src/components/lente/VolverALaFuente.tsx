'use client'
/**
 * EL HILO DE VUELTA — §21, «return exactly where you were».
 *
 * Dos piezas que son la misma promesa vista desde cada extremo:
 *
 *  · `VolverALaFuente` — en la FUENTE (la consulta que originó el pendiente).
 *    Ofrece volver, y sólo si el contrato cuadra con el sitio en el que el
 *    navegador está de verdad.
 *  · `RestauradorDeRegreso` — en el shell. Al aterrizar en la pantalla de
 *    origen, repone el desplazamiento y el foco, una sola vez.
 *
 * ── POR QUÉ EL REGRESO NO ES UN `history.back()` ────────────────────────────
 *
 * Porque `back()` sólo acierta cuando el médico llegó a la fuente por ese
 * enlace y no tocó nada más. En cuanto abre la nota, cambia de pestaña dentro
 * de la consulta o recarga, el historial deja de apuntar a donde él cree. El
 * contrato dice la ruta EXACTA de origen, así que volver es determinista
 * venga de donde venga — y si el contrato no cuadra, no se ofrece nada.
 *
 * ── LO QUE NO HACE, Y ES LA PARTE IMPORTANTE ────────────────────────────────
 *
 * No repara un contrato que no cuadra. Un testigo de otro paciente, de otra
 * nota o caducado se DECLINA y se dice por qué (`MOTIVO_VISIBLE`). Restaurar a
 * medias sería devolver al médico a una lista afirmando que venía de un
 * encuentro en el que nunca estuvo, que es la familia «paciente equivocado».
 */
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import {
  MOTIVO_VISIBLE, PARAM_REGRESO, anunciarRegreso, deserializar, leerContrato,
  leerContratoSerializado, olvidarContrato, regresoEnCurso, veredictoDeRegreso,
  type DestinoReal,
} from '@/lib/ui/regreso-a-la-fuente'

/**
 * El control de vuelta, en la fuente.
 *
 * `destino` lo pasa la pantalla que lo monta con lo que ELLA sabe de sí misma
 * —el consultorio de la sesión, el paciente de su ruta, la nota que tiene
 * abierta—. No se deduce aquí: si esta pieza leyera la ruta por su cuenta
 * estaría comprobando el contrato contra otra lectura de lo mismo, y la
 * comprobación dejaría de significar «coincide con lo que el médico está
 * viendo».
 */
export function VolverALaFuente({ destino }: { destino: DestinoReal }) {
  const router = useRouter()
  const params = useSearchParams()
  const testigo = params.get(PARAM_REGRESO)

  /**
   * EL CONTRATO SE LEE COMO LO QUE ES: UN ALMACÉN FUERA DE REACT.
   *
   * `sessionStorage` no existe en el servidor, así que la primera versión lo
   * leía en un efecto y lo metía en estado. Funcionaba y el compilador de React
   * lo paró con razón («cascading renders»): además de un render de más, dejaba
   * un instante en el que el control no existe todavía y otro en el que
   * aparece de golpe.
   *
   * `useSyncExternalStore` es exactamente esta situación: instantánea en el
   * cliente, `null` en el servidor, sin estado intermedio. No hay suscripción
   * porque el contrato no cambia mientras esta pantalla vive — lo escribió la
   * pantalla anterior, antes de navegar.
   */
  const crudo = useSyncExternalStore(
    () => () => {},
    () => (testigo ? leerContratoSerializado(testigo) : null),
    () => null,
  )

  /* La hora se congela al montar, como el resto del producto (`TrialBanner`):
     `Date.now()` en el cuerpo del render es impuro y haría que el control
     pudiera desaparecer solo entre dos renders del mismo segundo. */
  const [ahora] = useState(() => Date.now())

  const veredicto = useMemo(
    () => (testigo ? veredictoDeRegreso(deserializar(crudo), destino, ahora) : null),
    [testigo, crudo, ahora, destino.clinicId, destino.patientId, destino.notaId],
  )

  if (!veredicto) return null

  if (!veredicto.puedeVolver) {
    const dice = MOTIVO_VISIBLE[veredicto.motivo]
    // `sin-contrato` no se anuncia: quien no pidió volver no necesita saber que
    // no se puede. Los otros sí — había hilo y se declinó a propósito.
    if (!dice) return null
    return <p className="nx-volver-declinado" role="status">{dice}</p>
  }

  const { contrato } = veredicto
  return (
    <button
      type="button"
      className="nx-volver"
      onClick={() => {
        anunciarRegreso(contrato.id)
        router.push(contrato.origen.ruta)
      }}
    >
      <ArrowLeft size={15} aria-hidden="true" />
      Volver a {contrato.origen.nombre}
    </button>
  )
}

/**
 * EL RESTAURADOR — repone el sitio y el foco al aterrizar, UNA vez.
 *
 * Vive en el shell porque tiene que estar montado en la pantalla de DESTINO del
 * regreso, y ésa cambia según de dónde se saliera. Ponerlo en cada pantalla de
 * origen sería la familia `depende_de_recordar`: la próxima superficie que
 * quiera inspeccionar nacería sin restaurador y nadie se enteraría.
 *
 * ── POR QUÉ ESPERA EN VEZ DE RESTAURAR Y YA ─────────────────────────────────
 *
 * Al aterrizar, la lista todavía no ha llegado de Firestore: `<main>` mide unos
 * cientos de píxeles y pedirle un `scrollTop` de 900 lo deja en el máximo que
 * quepa, que no es donde estaba. Se espera por FOTOGRAMAS a que el contenido dé
 * de sí, con un tope: si el contenido nunca crece —la tarea se cerró y la lista
 * es más corta— se repone lo que se pueda y se deja de intentar. Un tope es lo
 * que separa «esperar» de «colgarse».
 *
 * ── EL MÉDICO MANDA SOBRE EL RESTAURADOR ────────────────────────────────────
 *
 * Mientras se esperaba ese contenido, el médico podía empezar a bajar con la
 * rueda o con el dedo. El restaurador seguía vivo hasta ~1 s y, cuando por fin
 * alcanzaba el alto esperado, lo devolvía a la posición antigua. En escritorio
 * se veía como un salto; en móvil, como un rebote hacia arriba. Una restauración
 * diferida deja de ser válida en cuanto existe intención manual de desplazarse.
 * Por eso rueda, gesto táctil o tecla de navegación cancelan el contrato antes
 * de que vuelva a escribir `scrollTop` o a mover el foco.
 */
export function RestauradorDeRegreso() {
  const pathname = usePathname()
  const yaHecho = useRef<string | null>(null)

  useEffect(() => {
    const testigo = regresoEnCurso()
    if (!testigo || yaHecho.current === testigo) return
    const contrato = leerContrato(testigo)
    if (!contrato) return

    /* Se restaura SÓLO en la ruta que el contrato nombra. Sin esto, cualquier
       pantalla por la que pasara el médico camino de vuelta recibiría el
       desplazamiento de otra. */
    if (pathname !== contrato.origen.ruta) return

    yaHecho.current = testigo
    let vivo = true
    let canceladoPorUsuario = false
    let intentos = 0
    const TOPE = 60   // ~1 s a 60 fps: suficiente para una lectura de Firestore
    const main = document.querySelector('main')

    const cancelarPorUsuario = () => {
      if (!vivo) return
      canceladoPorUsuario = true
      vivo = false
      // El médico ya tomó control de la pantalla. No dejar el contrato pendiente
      // para que otro render o regreso posterior intente moverlo de nuevo.
      olvidarContrato(contrato.id)
    }
    const teclaDesplaza = (event: KeyboardEvent) => {
      if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(event.key)) {
        cancelarPorUsuario()
      }
    }

    // Sólo señales inequívocas de intención de desplazamiento. Un click normal
    // dentro de la nota NO cancela nada; rueda, touch y teclas de navegación sí.
    main?.addEventListener('wheel', cancelarPorUsuario, { passive: true })
    main?.addEventListener('touchstart', cancelarPorUsuario, { passive: true })
    window.addEventListener('keydown', teclaDesplaza)

    const reponer = () => {
      if (!vivo || canceladoPorUsuario) return
      const objetivo = contrato.origen.scrollTop
      const alcanzable = main ? main.scrollHeight - main.clientHeight : 0

      if (main && (alcanzable >= objetivo || intentos >= TOPE)) {
        main.scrollTop = Math.min(objetivo, Math.max(0, alcanzable))
        /* El foco vuelve al control exacto que abrió la inspección. Si ya no
           está —la tarea se cerró, la lista cambió— no se fuerza nada: robarle
           el foco al cuerpo del documento es peor que dejarlo donde está. */
        if (contrato.origen.disparadorId) {
          document.getElementById(contrato.origen.disparadorId)?.focus?.()
        }
        olvidarContrato(contrato.id)
        return
      }
      intentos++
      requestAnimationFrame(reponer)
    }
    requestAnimationFrame(reponer)
    return () => {
      vivo = false
      main?.removeEventListener('wheel', cancelarPorUsuario)
      main?.removeEventListener('touchstart', cancelarPorUsuario)
      window.removeEventListener('keydown', teclaDesplaza)
    }
  }, [pathname])

  return null
}
