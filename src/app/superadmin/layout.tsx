'use client'
/**
 * LA PUERTA DE LA CONSOLA DEL DUEÑO.
 *
 * ── LO QUE HABÍA ────────────────────────────────────────────────────────────
 *
 * `/superadmin` y sus nueve sub-rutas —costos, planes, contabilidad, csp,
 * errores, onboarding, simulador, soporte— **no tenían ninguna puerta**. No hay
 * `middleware.ts` en el proyecto, y esta carpeta cuelga fuera de `(dashboard)`,
 * que es donde vive el único guardián de sesión que existe. Sólo `costos` traía
 * su propia comprobación, copiada a mano.
 *
 * Cualquiera que escribiera la dirección abría la consola del dueño de la
 * plataforma sin haber iniciado sesión.
 *
 * ── QUÉ SE FILTRABA DE VERDAD, Y QUÉ NO ─────────────────────────────────────
 *
 * Los DATOS estaban bien: las diez rutas `/api/superadmin/*` verifican el
 * token contra `verificarSuperadmin` (`src/lib/superadmin.ts`). Sin sesión las
 * pantallas salían vacías o con «denegado».
 *
 * Lo que se filtraba era el MAPA: los nombres de las pantallas, las columnas de
 * la contabilidad, la estructura de la consola de un producto que se está
 * vendiendo. Eso no es una fuga de expedientes, y no hay que exagerarlo — pero
 * es reconocimiento gratis para quien quiera atacar, y es la primera cosa que
 * mira cualquiera que audite esto antes de comprarlo.
 *
 * ── POR QUÉ AQUÍ Y NO DIEZ VECES ────────────────────────────────────────────
 *
 * Un `layout.tsx` envuelve la carpeta entera, incluidas las rutas que aún no
 * existen. Repetir la comprobación en cada página es exactamente cómo nació el
 * agujero: nueve de diez se olvidaron.
 *
 * ── LO QUE ESTA PUERTA NO ES ────────────────────────────────────────────────
 *
 * Es de CLIENTE. No sustituye a `verificarSuperadmin` en el servidor, que es
 * lo único que de verdad protege el dato — y que ya estaba. Esto quita la
 * pantalla de en medio; la cerradura sigue siendo la del servidor.
 */
import { useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { esSuperadminCliente } from '@/lib/superadmin-client'

export default function SuperadminLayout({ children }: { children: React.ReactNode }) {
  /** `null` = todavía no se sabe. No decidir con la respuesta a medias. */
  const [permitido, setPermitido] = useState<boolean | null>(null)

  useEffect(() => onAuthStateChanged(auth, u => {
    setPermitido(esSuperadminCliente(u?.email ?? null))
  }), [])

  if (permitido === null) {
    return (
      <div style={{ padding: 40, fontSize: 15, color: 'var(--text3)' }}>
        Comprobando…
      </div>
    )
  }

  if (!permitido) {
    return (
      <div style={{ padding: 40, maxWidth: 520 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', margin: '0 0 8px' }}>
          Esta consola es sólo para el dueño de la plataforma
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.6, margin: '0 0 16px' }}>
          Si es tu consola, inicia sesión con la cuenta del dueño.
        </p>
        <a href="/login" className="btn btn-primary" style={{ textDecoration: 'none' }}>
          Iniciar sesión
        </a>
      </div>
    )
  }

  return <>{children}</>
}
