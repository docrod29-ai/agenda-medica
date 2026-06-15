// Color de avatar derivado del nombre (determinista) — da vida a listas y cabeceras
// sin emojis ni datos inventados. Usado en Pacientes, Expediente, Dashboard, Citas.

export const AVATAR_COLORS = [
  { bg: 'rgba(61,90,254,0.16)', fg: '#9FB0FF' },   // cobalto
  { bg: 'rgba(16,158,129,0.16)', fg: '#5DCAA5' },  // teal
  { bg: 'rgba(124,58,237,0.16)', fg: '#C4B5FD' },  // violeta
  { bg: 'rgba(217,119,6,0.16)', fg: '#FBBF77' },   // ámbar
  { bg: 'rgba(225,29,72,0.16)', fg: '#FDA4AF' },   // rosa
  { bg: 'rgba(21,128,61,0.20)', fg: '#86EFAC' },   // verde
] as const

export function avatarColor(name: string): { bg: string; fg: string } {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}
