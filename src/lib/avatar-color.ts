// Color de avatar derivado del nombre (determinista) — da vida a listas y cabeceras
// sin emojis ni datos inventados. Usado en Pacientes, Expediente, Dashboard, Citas.

export const AVATAR_COLORS = [
  // Pares temáticos ya medidos por el sistema. Un pastel fijo de texto
  // desaparecía en claro (REG-673); no debe reinterpretar el tema aquí.
  { bg: 'var(--badge-blue-b)', fg: 'var(--badge-blue-t)' },
  { bg: 'var(--badge-gris-b)', fg: 'var(--badge-gris-t)' },
  { bg: 'var(--badge-purple-b)', fg: 'var(--badge-purple-t)' },
  { bg: 'var(--badge-amber-b)', fg: 'var(--badge-amber-t)' },
  { bg: 'var(--badge-red-b)', fg: 'var(--badge-red-t)' },
  { bg: 'var(--badge-green-b)', fg: 'var(--badge-green-t)' },
] as const

export function avatarColor(name: string): { bg: string; fg: string } {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}
