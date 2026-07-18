/**
 * Fenotipos de resistencia a AMINOGLUCÓSIDOS:
 *  - 16S rRNA metiltransferasas (armA/rmtB/C/F, npmA): R de ALTO nivel a TODOS los
 *    aminoglucósidos (incl. plazomicina). 🚩 Co-portadas con carbapenemasas MBL (NDM)
 *    en >50% → marcador de alarma que obliga a buscar carbapenemasa.
 *  - Enzimas modificadoras (AME: AAC/ANT/APH): patrón PARCIAL que orienta a la enzima
 *    y a qué aminoglucósido puede seguir útil.
 * Fuente: Navarro 2010 (Tabla 3), Vila & Marco 2010 (Tabla 3), Doi & Arakawa CID 2007.
 */
import { type AporteModulo, aporteVacio, type ResultadoAntibiograma } from './tipos'
import { REF } from './referencias'
import { estado, ES_R, ES_S, NO_S, GENTAMICINA, AMIKACINA } from './util'

const TOBRAMICINA = ['tobramicina']
const PLAZOMICINA = ['plazomicina']

export function analizarAminoglucosidos(organismo: string, r: ResultadoAntibiograma[]): AporteModulo {
  const out = aporteVacio()
  const gen = estado(r, GENTAMICINA)
  const tob = estado(r, TOBRAMICINA)
  const ami = estado(r, AMIKACINA)
  const plazo = estado(r, PLAZOMICINA)
  // Necesitamos al menos genta+tobra+amika para razonar el patrón.
  const probados = [gen, tob, ami].filter(x => x !== null).length
  if (probados < 2) return out

  const todosR = ES_R(gen) && ES_R(tob) && ES_R(ami)

  // ── 16S rRNA metiltransferasa: pan-aminoglucósido R de alto nivel ─────────────
  if (todosR) {
    out.fenotipos.push({
      clave: '16S-RMTasa',
      nombre: 'Metiltransferasa del 16S rRNA (pan-aminoglucósido R)',
      confianza: NO_S(plazo) || plazo === null ? 'probable' : 'sospecha',
      base: `Gentamicina + tobramicina + amikacina TODAS R (alto nivel): metilación del sitio A del 16S rRNA (armA/rmtB/C). Inactiva TODOS los aminoglucósidos, incluida la plazomicina. ${REF.ENTEROBACT}`,
    })
    out.mecanismos.push({
      categoria: 'diana', nombre: '16S rRNA metiltransferasa (armA/rmtB/C, npmA)', confianza: 'probable',
      explicacion: 'Metila el sitio A del ARNr 16S → los aminoglucósidos no se unen al ribosoma. Confiere R de ALTO nivel a TODOS (gentamicina/tobramicina/amikacina) y también a plazomicina. Genes plasmídicos frecuentemente co-portados con carbapenemasas (sobre todo NDM).',
      referencia: REF.BLI,
    })
    out.alertas.push({ nivel: 'alta', mensaje: '🚩 Pan-aminoglucósido R (posible 16S-metiltransferasa): buscar ACTIVAMENTE carbapenemasa metalo (NDM) — se co-portan en >50%. Ningún aminoglucósido (ni plazomicina) es opción.' })
    out.advertencias.push('16S-RMTasa: no usar aminoglucósidos ni plazomicina; suele acompañar a NDM → confirmar carbapenemasa.')
    return out // el patrón pan-R domina; no seguir con AME parcial
  }

  // ── Enzimas modificadoras de aminoglucósidos (patrón parcial) ─────────────────
  const algunoR = ES_R(gen) || ES_R(tob) || ES_R(ami)
  if (algunoR) {
    // AAC(6')-I: tobramicina+amikacina R con gentamicina CONSERVADA (el patrón clásico).
    if (ES_R(tob) && (ES_R(ami) || NO_S(ami)) && ES_S(gen)) {
      out.fenotipos.push({ clave: 'AME', nombre: 'Enzima modificadora tipo AAC(6′)-I (tobra/amika R, genta S)', confianza: 'probable', base: `Acetiltransferasa AAC(6′)-I: afecta tobramicina, amikacina y netilmicina; RESPETA la gentamicina. ${REF.ENTEROBACT}` })
      out.mecanismos.push({ categoria: 'enzima modificadora', nombre: 'Acetiltransferasa AAC(6′)-I', confianza: 'probable', explicacion: 'Acetila el aminoglucósido en 6′. La gentamicina suele quedar activa; útil como alternativa si el sitio y la CMI lo permiten.', referencia: REF.ENTEROBACT })
      out.advertencias.push('AME AAC(6′)-I: la gentamicina puede seguir útil (respetada); evitar tobramicina/amikacina.')
    }
    // ANT(2'')-I / AAC(3): gentamicina+tobramicina R con amikacina CONSERVADA.
    else if (ES_R(gen) && ES_R(tob) && ES_S(ami)) {
      out.fenotipos.push({ clave: 'AME', nombre: 'Enzima modificadora tipo ANT(2″)/AAC(3) (genta/tobra R, amika S)', confianza: 'probable', base: `Nucleotidil/acetiltransferasa: afecta gentamicina y tobramicina; RESPETA la amikacina. ${REF.ENTEROBACT}` })
      out.mecanismos.push({ categoria: 'enzima modificadora', nombre: 'ANT(2″)-Ia / AAC(3)', confianza: 'probable', explicacion: 'Modifica gentamicina y tobramicina; la amikacina suele quedar activa → alternativa preferida en este patrón.', referencia: REF.ENTEROBACT })
      out.advertencias.push('AME ANT(2″)/AAC(3): la amikacina suele seguir útil; evitar gentamicina/tobramicina.')
    }
    else {
      out.fenotipos.push({ clave: 'AME', nombre: 'Resistencia a aminoglucósidos (enzima modificadora probable)', confianza: 'sospecha', base: `Patrón parcial de R a aminoglucósidos: enzima modificadora (AAC/ANT/APH). Elegir el aminoglucósido que conserve S por CMI. ${REF.ENTEROBACT}` })
    }
  }
  return out
}
