/**
 * LA MARCA DE AUSCULTA, DIBUJADA UNA SOLA VEZ.
 *
 * ── QUÉ REEMPLAZA ───────────────────────────────────────────────────────────
 *
 * La «N» de NexusMED —dos verticales y una diagonal con un punto en medio—
 * estaba dibujada **a mano en seis componentes**: la barra lateral, la portada,
 * el acceso, el registro, la configuración inicial y la pantalla de unirse.
 *
 * Seis copias del mismo SVG. Es la forma de siempre en este repositorio:
 * cambiar la marca significaba acordarse de seis sitios, y el sexto se queda.
 *
 * ── QUÉ DIBUJA ──────────────────────────────────────────────────────────────
 *
 * La campana del estetoscopio vista de frente, con dos arcos de escucha que
 * abren a la derecha. El nombre dice lo que el producto hace —auscultar es
 * escuchar al paciente— y la marca lo dice sin explicarlo.
 *
 * ── POR QUÉ `currentColor` Y NO UN TOKEN ────────────────────────────────────
 *
 * La marca anterior llevaba clavado `#3D5AFE`: el azul que se retiró por no
 * pasar contraste y que sobrevivió en 41 sitios más (REG-307). Heredando el
 * color de quien la pinta, el día que cambie el acento no hay que volver aquí
 * — y quien la use sobre un fondo distinto puede decidirlo en su sitio.
 */

export function MarcaAusculta({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true"
         fill="none" stroke="currentColor" strokeLinecap="round">
      {/* El disco de la campana */}
      <circle cx="17" cy="24" r="8.5" strokeWidth="3.2" />
      <circle cx="17" cy="24" r="2.6" fill="currentColor" stroke="none" />
      {/* Lo que se oye: dos arcos, el segundo más abierto y más tenue */}
      <path d="M31 17.5a9 9 0 0 1 0 13" strokeWidth="3.2" />
      <path d="M37.5 12a17 17 0 0 1 0 24" strokeWidth="3.2" opacity={0.45} />
    </svg>
  )
}
