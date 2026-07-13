/**
 * Motivo de marca (red/nexo + pulso) para el fondo de las pantallas de entrada
 * (login/registro). Line-art cobalto vía currentColor → funciona en claro y
 * oscuro; transparente y muy tenue para no competir con el formulario.
 */
export function MarcaAuth({ style }: { style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 680 300" fill="none" aria-hidden="true"
      style={{ position: 'absolute', color: 'var(--nexus)', pointerEvents: 'none', ...style }}>
      <g stroke="currentColor" strokeWidth="0.6" opacity="0.5">
        <line x1="70" y1="90" x2="180" y2="120" /><line x1="180" y1="120" x2="140" y2="200" />
        <line x1="180" y1="120" x2="320" y2="130" /><line x1="210" y1="70" x2="320" y2="130" />
        <line x1="320" y1="130" x2="270" y2="185" /><line x1="320" y1="130" x2="410" y2="90" />
        <line x1="320" y1="130" x2="450" y2="160" /><line x1="410" y1="90" x2="500" y2="70" />
        <line x1="450" y1="160" x2="540" y2="180" /><line x1="540" y1="180" x2="610" y2="110" />
        <line x1="540" y1="180" x2="600" y2="230" /><line x1="450" y1="160" x2="410" y2="220" />
        <line x1="270" y1="185" x2="350" y2="235" /><line x1="140" y1="200" x2="270" y2="185" />
        <line x1="500" y1="70" x2="610" y2="110" />
      </g>
      <g fill="currentColor" opacity="0.7">
        <circle cx="70" cy="90" r="2.5" /><circle cx="210" cy="70" r="2" /><circle cx="140" cy="200" r="3" />
        <circle cx="320" cy="130" r="3.4" /><circle cx="410" cy="90" r="2.5" /><circle cx="500" cy="70" r="3" />
        <circle cx="540" cy="180" r="3" /><circle cx="610" cy="110" r="2.5" /><circle cx="450" cy="160" r="2.6" />
        <circle cx="350" cy="235" r="2.5" /><circle cx="270" cy="185" r="2.5" />
      </g>
      <polyline points="40,155 185,155 205,120 225,190 245,155 320,155 335,96 352,214 368,155 470,150 640,150"
        fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" opacity="0.8" />
    </svg>
  )
}
