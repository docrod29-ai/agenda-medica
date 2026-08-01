/**
 * Fuente ÚNICA de verdad de la zona autenticada (unidad Nexus OS E0-10).
 *
 * POR QUÉ EXISTE: la lista vivía incrustada en un regex dentro de `next.config.ts`
 * y se desincronizó de `src/app/(dashboard)/`. Medido contra producción, estas
 * pantallas NO devolvían ninguna cabecera anti-clickjacking:
 *
 *     /uci  /hospitalizacion  /superadmin  /receta  /orden  /corte-caja  …
 *
 * `/uci`, `/hospitalizacion` y `/receta` renderizan PHI y `/superadmin` es la
 * consola del dueño: cualquier sitio podía embeberlas en un iframe invisible y
 * hacer clickjacking sobre la sesión del médico. Al vivir la lista en un módulo
 * propio, `src/__tests__/csp-guard.test.ts` puede cruzarla contra el árbol de
 * rutas real y tumbar el CI cuando alguien añada una pantalla del dashboard sin
 * protección (o deje aquí una ruta que ya no existe).
 *
 * No contiene lógica clínica ni de negocio: sólo nombres de ruta.
 */

/**
 * Primer segmento de cada ruta de la zona autenticada. Debe corresponder 1:1 con
 * un directorio real bajo `src/app/(dashboard)/` o `src/app/`.
 *
 * NO se incluyen a propósito:
 *  - `teleconsulta`: la abre el PACIENTE desde un enlace; además embebe un iframe
 *    de Daily y no queremos tocar su comportamiento de encuadre.
 *  - `mi`, `resena`, `verificar`, `pago`, `unirse`, `reservar`, `dr`, `demo`:
 *    superficie pública/paciente (algunas se embeben a propósito).
 */
export const RUTAS_PRIVADAS = [
  // NO va 'agenda': no existe ninguna página en /agenda. La pantalla que el menú
  // rotula «Agenda» vive en /calendario (BottomNav.tsx:26). Estaba aquí como ruta
  // fantasma — el mismo defecto que esta lista vino a arreglar — y el CI lo cazó
  // porque en un checkout limpio la carpeta vacía de mi disco no existe.
  'antibiograma',
  'asistente',
  'calendario',
  'chat',
  'citas',
  'configuracion',
  'consulta',
  'consultor',
  'corte-caja',
  'crm',
  'cumplimiento',
  'dashboard',
  'expediente',
  'expedientes',
  'farmacia',
  'finanzas',
  'guia',
  'hospitalizacion',
  'legal',
  'lista-espera',
  // `login` NO es zona autenticada, pero es la PANTALLA DE CREDENCIALES: embebida en
  // un iframe invisible es el blanco clásico de clickjacking (el usuario cree teclear
  // en otro sitio y entrega usuario/contraseña). Entró aquí en la pasada de cierre de
  // E0-10 tras el hallazgo V-7a de la verificación adversarial. Único consumidor de
  // iframes hacia dentro de la app en todo el código: el snippet de /reservar que el
  // consultorio pega en SU web (configuracion/page.tsx) — no toca /login.
  'login',
  'membresias',
  'migracion',
  'nota',
  'orden',
  'pacientes',
  'reactivacion',
  'receta',
  'referencia',
  'resenas',
  'setup',
  'superadmin',
  'uci',
  // NO va 'waitlist': la página real es 'lista-espera' (ya está arriba).
  // /api/whatsapp/waitlist-notify es una ruta de API, no una pantalla, y su
  // protección es la de autenticación del endpoint, no cabeceras anti-iframe.
] as const

/**
 * `source` de Next para el bloque de cabeceras de la zona autenticada.
 * Forma idéntica a la que ya había (`/(a|b|c)(.*)`), sólo que derivada del array.
 */
export const RE_RUTAS_PRIVADAS = `/(${RUTAS_PRIVADAS.join('|')})(.*)`

/**
 * RUTAS DEL PACIENTE CON PHI — protegidas igual que la zona del médico.
 *
 * ── EL HUECO (PRACTICE-GA-003, medido contra producción) ─────────────────────
 *
 * Estas rutas quedaron fuera de `RUTAS_PRIVADAS` por estar catalogadas como
 * «superficie pública/paciente». Pero pública no es lo mismo que inofensiva:
 *
 *   · `/mi/[token]`   — el portal del paciente. Enseña SUS recetas y SUS citas, y
 *                       trae botones de reagendar y cancelar. Embebido en un
 *                       iframe invisible, un clic del paciente en otra cosa le
 *                       cancela una consulta.
 *   · `/resena/[token]`     — su nombre y su cita, con un formulario que publica.
 *   · `/verificar/[token]`  — verificación del sello de una nota concreta.
 *   · `/teleconsulta/[id]`  — la sala de video de una consulta real.
 *
 * Medido en producción: las cuatro viajaban sin `X-Frame-Options` y sin
 * `frame-ancestors`. Su bloque de cabeceras existía —pone `noindex` y
 * `no-referrer` para que el token de la URL no se filtre— pero no incluía nada
 * anti-encuadre.
 *
 * ── POR QUÉ `teleconsulta` YA NO ESTÁ EXCLUIDA ───────────────────────────────
 *
 * La razón anotada era «embebe un iframe de Daily y no queremos tocar su
 * comportamiento de encuadre». Es un malentendido de la directiva:
 * `frame-ancestors` dice **quién puede embebernos a nosotros**; lo que nosotros
 * metemos dentro lo gobierna `frame-src`, que sigue permitiendo `*.daily.co`.
 * Proteger la teleconsulta no toca la sala de video.
 *
 * `reservar`, `privacidad`, `dr` y `demo` siguen fuera **a propósito**: se
 * embeben de verdad en la web del consultorio, o son datos sintéticos.
 */
export const RUTAS_PACIENTE_CON_PHI = ['mi', 'resena', 'verificar', 'teleconsulta'] as const

/** `source` de Next para ese bloque. */
export const RE_RUTAS_PACIENTE = `/(${RUTAS_PACIENTE_CON_PHI.join('|')})/:path*`

export const POR_QUE_EL_PORTAL_DEL_PACIENTE_TAMBIEN_SE_PROTEGE =
  'Porque «público» describe cómo se entra, no qué se ve. Al portal se entra con ' +
  'un enlace mágico y dentro están las recetas del paciente y los botones de ' +
  'cancelar su cita: encuadrarlo en un iframe invisible convierte un clic ' +
  'cualquiera en una cancelación. La protección va por lo que la pantalla ' +
  'muestra y puede hacer, no por si exige contraseña.'

/** Ruta absoluta de prueba para una entrada de la lista (E2E y guardián). */
export function rutaDePrueba(segmento: string): string {
  return `/${segmento}`
}
