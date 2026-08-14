import type { ReactNode } from 'react'

/**
 * ENCABEZADO DE PANTALLA — y por qué el subtítulo es OBLIGATORIO.
 *
 * ── RTC-31, la medición que lo pidió ────────────────────────────────────────
 *
 * La segunda pasada de §29 (14-ago-2026) dejó cinco superficies empatadas en
 * 2.0–2.5 con el MISMO residuo, y una sola en 1.0: `/pendientes`. Comparadas
 * lado a lado, la diferencia empieza aquí arriba. `/pendientes` no se presenta
 * con un título y un racimo de botones: dice **qué es y de dónde sale lo que
 * hay dentro** — «Estudios pedidos, resultados sin revisar y recetas sin
 * entregar. Salen solos al firmar la nota».
 *
 * Un título solo —«Pacientes»— no informa a nadie: la pantalla ya se anuncia
 * en el riel, así que repetir su nombre en 20px es decorar. La frase que
 * explica de dónde sale el contenido es lo que §15 pide («dónde estoy») y lo
 * que separa un producto de una plantilla con las secciones rellenadas.
 *
 * ── POR QUÉ EL TIPO, Y NO UNA RECOMENDACIÓN ─────────────────────────────────
 *
 * Ocho de las nueve pantallas con `PageHeader` ya traían subtítulo. La novena
 * era `/pacientes`, la más visitada del producto. Una regla que se cumple ocho
 * de nueve veces no es una regla: es una costumbre, y la excepción cae siempre
 * en la pantalla que más prisa tuvo. Poniéndolo en el tipo, el compilador se
 * encarga — y una pantalla que no puede decir en una línea qué es no ha
 * decidido todavía qué es.
 */
interface PageHeaderProps {
  title: ReactNode
  /**
   * Qué es esta pantalla y de dónde sale lo que hay dentro. **Obligatorio**
   * (RTC-31): ver arriba. No es un adorno ni un eslogan — si repite el título
   * con más palabras, sobra la frase y falta la decisión.
   */
  subtitle: ReactNode
  /** Acciones a la derecha (botones, filtros) */
  actions?: ReactNode
}

/** Encabezado de pantalla: título `.t-h1` + subtítulo + acciones. */
export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="page-header">
      <div>
        <h1 className="t-h1" style={{ margin: 0 }}>{title}</h1>
        <div className="page-header-sub">{subtitle}</div>
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </div>
  )
}
