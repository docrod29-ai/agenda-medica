'use client'
/**
 * Hook de lectura de la firma médica aislada (REG-014).
 *
 * Devuelve la firma del subdocumento protegido `config/firma`, con respaldo en
 * el `config/main` legado mientras el consultorio no haya migrado — así el
 * cambio no le tira la firma a nadie de sus recetas.
 *
 * `cargando` importa: sin él, la receta se renderizaría un instante SIN firma y
 * el médico podría imprimir justo en ese hueco.
 */
import { useEffect, useState } from 'react'
import { leerFirma, type FirmaProtegida } from '@/lib/firma-protegida'

export function useFirmaProtegida(
  clinicId: string | null | undefined,
  legado?: FirmaProtegida,
): { firma: FirmaProtegida; cargando: boolean } {
  const [firma, setFirma] = useState<FirmaProtegida>({})
  const [cargando, setCargando] = useState(true)

  // Dependencias primitivas: `legado` es un objeto nuevo en cada render del
  // padre y dispararía el efecto en bucle.
  const legadoImg = legado?.firmaImagenDataUrl
  const legadoPorMedico = legado?.firmaPorMedico
  const claveLegado = legadoImg ? 'img' : '' + Object.keys(legadoPorMedico ?? {}).sort().join(',')

  useEffect(() => {
    let vivo = true
    if (!clinicId) { setFirma({}); setCargando(false); return }
    setCargando(true)
    leerFirma(clinicId, { firmaImagenDataUrl: legadoImg, firmaPorMedico: legadoPorMedico })
      .then(f => { if (vivo) setFirma(f) })
      .finally(() => { if (vivo) setCargando(false) })
    return () => { vivo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicId, claveLegado])

  return { firma, cargando }
}
