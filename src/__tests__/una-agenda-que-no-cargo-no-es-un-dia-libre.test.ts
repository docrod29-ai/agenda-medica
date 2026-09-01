/**
 * GOLDEN — una agenda vacía porque falló no puede verse como un día sin pacientes.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * `/calendario` pintaba la rejilla entera de la semana —«Lun 24 · Mar 25 · Mié
 * 26…»— completamente vacía, sin un solo aviso, cuando la consulta de citas
 * fallaba. Ni siquiera saltaba la frontera de error genérica.
 *
 * El aviso «Cargando la agenda…» existía, pero cuelga de `loading`, y al fallar
 * la consulta `loading` baja igual que si hubiera cargado bien. El caso de al
 * lado quedó descubierto.
 *
 * Es la regla 4 de seguridad clínica —ausencia de dato no es dato de ausencia—
 * en la pantalla donde el médico decide si tiene la tarde libre.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Persiguiendo la columna «error» de la matriz, que estaba medida en 5 rutas de
 * 23. Al completarla salió que las 23 comparten UNA pantalla global —«No pudimos
 * cargar tu consultorio»— y que el escenario de al lado, el PARCIAL (el
 * consultorio carga y falla una consulta suelta), no lo medía nadie.
 *
 * De las nueve llamadas a `useAppointments`, sólo DOS recogían `error`.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * Quien pinte citas como «la agenda» tiene que recoger `error` del hook Y
 * usarlo. Recogerlo y no usarlo es el defecto de siempre —«escrito y sin
 * conectar»— con una variable de más para disimularlo.
 *
 * ── PROBADO AL REVÉS ────────────────────────────────────────────────────────
 *
 * Quitando el aviso del calendario y volviendo a compilar, con el permiso de
 * lectura negado en el emulador, la rejilla se pintó entera y vacía y
 * `npm run arnes:caida-parcial` marcó FALLA. Con el aviso puesto, lo dice. Los
 * casos de aquí abajo caen si se quita el `error:` de cualquiera de los tres.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No prueba que el aviso se PINTE**: eso es del arnés, con navegador, y está
 *   medido para `/calendario`. Para el modal de agendar quedó NOT_PROVEN, y el
 *   guion dice por qué: con el permiso negado no hay cita que abrir.
 * · **Las otras seis llamadas a `useAppointments` siguen sin recoger `error`**:
 *   `PanelPendientes`, `/asistente`, `useNotificacionesCitas` y las de dentro
 *   del propio hook. No se tocan aquí porque no se han medido; que no estén en
 *   esta lista significa que NO se vigilan, no que estén bien.
 * · No dice nada del texto del aviso ni de su contraste.
 * · No cubre el fallo de RED: por esa vía Firestore sirve caché en silencio y
 *   `error` no se enciende. Las causas que lo encienden son de servidor —permiso
 *   denegado, índice que falta—.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/** Sin comentarios: un caso que se satisface con su propia prosa no prueba nada. */
const sinComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\/.*/g, '')

/** Las pantallas que presentan citas COMO la agenda del médico. */
const QUIENES_PINTAN_LA_AGENDA = [
  ['el calendario', join('src', 'app', '(dashboard)', 'calendario', 'page.tsx')],
  ['la lista de citas', join('src', 'app', '(dashboard)', 'citas', 'page.tsx')],
  ['el modal de agendar', join('src', 'components', 'AppointmentModal.tsx')],
] as const

describe('una agenda que no cargó no es un día libre', () => {
  it('el hook SIGUE ofreciendo `error` — sin eso no hay nada que recoger', () => {
    const hook = sinComentarios(readFileSync(join('src', 'hooks', 'useAppointments.ts'), 'utf8'))
    expect(hook, '`useAppointments` dejó de exponer `error`').toMatch(/return\s*\{[^}]*\berror\b/)
    expect(hook, 'el callback de error dejó de guardar nada').toMatch(/setError\(/)
  })

  QUIENES_PINTAN_LA_AGENDA.forEach(([nombre, ruta]) => {
    it(`${nombre} recoge \`error\` del hook Y lo usa`, () => {
      const src = sinComentarios(readFileSync(ruta, 'utf8'))
      const llamada = src.match(/const\s*\{([^}]*)\}\s*=\s*useAppointments\(/)
      expect(llamada, `${nombre} dejó de llamar a useAppointments`).not.toBeNull()

      // Se recoge, con el alias que sea.
      const desestructurado = llamada![1]
      const alias = desestructurado.match(/\berror\s*:\s*(\w+)/)?.[1]
        ?? (/\berror\b/.test(desestructurado) ? 'error' : null)
      expect(alias, `${nombre} vuelve a tirar \`error\`: una consulta caída se pintaría como un día sin pacientes`).not.toBeNull()

      /*
       * Y SE USA. Recogerlo y no leerlo deja el defecto intacto con una variable
       * de más — que es justo lo que hacía `/calendario`: recogía `loading` y no
       * `error`. Se cuenta fuera de la propia desestructuración.
       */
      const fuera = src.replace(llamada![0], '')
      const veces = (fuera.match(new RegExp(`\\b${alias}\\b`, 'g')) || []).length
      expect(veces, `${nombre} recoge \`${alias}\` y no lo lee en ninguna parte`).toBeGreaterThan(0)
    })
  })
})
