/**
 * QUÉ FUENTES NO SE CONSULTARON — dicho, no callado.
 *
 * ── POR QUÉ EXISTE (P1-9) ────────────────────────────────────────────────────
 *
 * `/api/expediente/evidencia` —la ruta de evidencia de la CONSULTA, la que el
 * médico usa con el paciente enfrente— consulta **sólo PubMed**, y su respuesta
 * nunca lo dice. El médico ve artículos y razonamiento, y no tiene forma de
 * saber que UpToDate, Cochrane, las guías y todo lo demás **ni se miraron**.
 *
 * Un consultor que sólo enseña lo que SÍ encontró se lee como si hubiera mirado
 * en todas partes, que es exactamente la conclusión contraria a la que este
 * módulo existe para dar. Es la regla 4 de seguridad clínica —ausencia de dato
 * no es dato de ausencia— aplicada a las fuentes.
 *
 * ── POR QUÉ NO SE ESCRIBE OTRA VEZ, SE REUSA ────────────────────────────────
 *
 * La maquinaria ya existe y está probada: `planDeConsulta` decide quién se
 * consulta y quién sólo se declara, los adaptadores no operativos producen su
 * sobre `not_configured` **sin salir a la red** —`adaptadorNoConfigurado` ni
 * siquiera conoce una URL— y `comoSeLeDiceAlMedico` la convierte en una frase.
 *
 * Lo usa `/api/consultor-evidencia` desde REG-345. Esta ruta no. Ese es el
 * defecto: no falta el dato ni la regla, falta el cable — la familia «escrito,
 * probado y sin conectar».
 *
 * ── LO QUE ESTE MÓDULO NO HACE ──────────────────────────────────────────────
 *
 * **No consulta nada.** Sólo declara. No cambia de dónde salen los artículos ni
 * añade fuentes: eso exige licencias que no existen (WS-08) y adaptadores que
 * están deliberadamente inertes. Lo único que arregla es el silencio.
 */
import { FABRICAS } from '@/lib/evidencia/recuperacion-consultor'
import { planDeConsulta } from '@/lib/evidence-integrations/seleccion'
import { comoSeLeDiceAlMedico, type AdaptadorDeEvidencia } from '@/lib/evidence-integrations/contrato'

export interface FuentesDeclaradas {
  /** Una frase por proveedor NO consultado, ya redactada para el médico. */
  readonly avisos: readonly string[]
  /** Los nombres de proveedor no consultados. Para pruebas y diagnóstico. */
  readonly noConsultados: readonly string[]
}

/**
 * Qué proveedores quedaron fuera de esta búsqueda, y por qué.
 *
 * `pregunta` sólo se usa para ordenar por intención clínica: la respuesta no
 * depende del texto, depende de qué está operativo.
 *
 * **Total**: no lanza. Si algo falla al construir un adaptador, se devuelve lo
 * que se pudo declarar en vez de tumbar la evidencia de una consulta — la
 * evidencia es opcional y su caída no puede bloquear al médico (#314).
 */
export async function declararFuentesNoConsultadas(
  pregunta: string,
  yaConsultados: readonly string[] = [],
): Promise<FuentesDeclaradas> {
  try {
    const adaptadores: readonly AdaptadorDeEvidencia[] = Object.values(FABRICAS).map(f => f())
    const plan = planDeConsulta(adaptadores, { pregunta, maximo: 1 })
    const porProveedor = new Map(adaptadores.map(a => [a.proveedor, a] as const))

    /**
     * `aDeclarar` son los NO operativos. Se añaden los operativos que esta ruta
     * tampoco consultó: que un adaptador funcione no significa que se haya
     * usado, y callar eso sería la misma mentira por otro camino.
     */
    const consultados = new Set(yaConsultados)
    const fuera = [
      ...plan.aDeclarar,
      ...plan.aConsultar.filter(p => !consultados.has(p)),
    ]

    const avisos: string[] = []
    for (const p of fuera) {
      const a = porProveedor.get(p)
      if (!a) continue
      // Ninguno sale a la red: el adaptador no configurado no conoce URL alguna.
      const sobre = await a.recuperar({ pregunta, maximo: 1 }, { ahora: new Date().toISOString(), correlacion: 'declaracion' })
      avisos.push(comoSeLeDiceAlMedico(sobre))
    }
    return { avisos, noConsultados: fuera }
  } catch {
    return { avisos: [], noConsultados: [] }
  }
}

export const POR_QUE_SE_DECLARA =
  'Un consultor que sólo enseña lo que SÍ encontró se lee como si hubiera ' +
  'mirado en todas partes. Con el paciente enfrente, eso convierte «no lo ' +
  'miramos» en «no existe», que es la conclusión contraria a la que este ' +
  'módulo existe para dar.'
