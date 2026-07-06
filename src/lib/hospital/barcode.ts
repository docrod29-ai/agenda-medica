// ══════════════════════════════════════════════════════════════
// Código de barras CODE 39 → SVG, sin dependencias.
// Se usa en el brazalete del paciente (BCMA): un lector físico o la cámara
// (BarcodeDetector, formato 'code_39') lee el folio para verificar identidad.
// Code 39 codifica A-Z, 0-9, y - . $ / + % espacio; se delimita con '*'.
// ══════════════════════════════════════════════════════════════

// Cada símbolo = 9 elementos (5 barras + 4 espacios); '1'=ancho, '0'=angosto.
const CODE39: Record<string, string> = {
  '0': '000110100', '1': '100100001', '2': '001100001', '3': '101100000',
  '4': '000110001', '5': '100110000', '6': '001110000', '7': '000100101',
  '8': '100100100', '9': '001100100', 'A': '100001001', 'B': '001001001',
  'C': '101001000', 'D': '000011001', 'E': '100011000', 'F': '001011000',
  'G': '000001101', 'H': '100001100', 'I': '001001100', 'J': '000011100',
  'K': '100000011', 'L': '001000011', 'M': '101000010', 'N': '000010011',
  'O': '100010010', 'P': '001010010', 'Q': '000000111', 'R': '100000110',
  'S': '001000110', 'T': '000010110', 'U': '110000001', 'V': '011000001',
  'W': '111000000', 'X': '010010001', 'Y': '110010000', 'Z': '011010000',
  '-': '010000101', '.': '110000100', ' ': '011000100', '$': '010101000',
  '/': '010100010', '+': '010001010', '%': '000101010', '*': '010010100',
}

/** Devuelve un SVG (string) con el código de barras Code 39 del texto dado. */
export function code39Svg(texto: string, opts?: { height?: number; narrow?: number; conTexto?: boolean }): string {
  const height = opts?.height ?? 60
  const narrow = opts?.narrow ?? 2
  const wide = narrow * 3
  const gap = narrow            // separación entre símbolos (angosta)
  const conTexto = opts?.conTexto ?? true

  const limpio = (texto || '').toUpperCase().replace(/[^0-9A-Z\-. $/+%]/g, '')
  const secuencia = `*${limpio}*`

  const barras: { x: number; w: number }[] = []
  let x = 0
  for (let s = 0; s < secuencia.length; s++) {
    const patron = CODE39[secuencia[s]]
    if (!patron) continue
    for (let i = 0; i < 9; i++) {
      const ancho = patron[i] === '1' ? wide : narrow
      const esBarra = i % 2 === 0
      if (esBarra) barras.push({ x, w: ancho })
      x += ancho
    }
    x += gap
  }
  const totalW = x
  const textH = conTexto ? 16 : 0
  const rects = barras.map(b => `<rect x="${b.x}" y="0" width="${b.w}" height="${height}" fill="#000"/>`).join('')
  const label = conTexto
    ? `<text x="${totalW / 2}" y="${height + 13}" text-anchor="middle" font-family="monospace" font-size="12" fill="#000">${limpio}</text>`
    : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${height + textH}" viewBox="0 0 ${totalW} ${height + textH}">${rects}${label}</svg>`
}
