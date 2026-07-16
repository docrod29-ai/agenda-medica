import type { CSSProperties } from 'react'

/** Estilos compartidos de los campos de Configuración (extraídos para reusarlos
 *  entre las secciones que se sacaron del monolito). */
export const cfgInput: CSSProperties = {
  width: '100%', padding: '8px 10px', borderRadius: 6,
  border: '1px solid var(--border)', background: 'var(--s2)', color: 'var(--text)',
  fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box',
}
export const cfgLabel: CSSProperties = {
  display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--text2)', marginBottom: 3,
}
