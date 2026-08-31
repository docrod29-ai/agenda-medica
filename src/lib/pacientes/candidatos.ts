/**
 * ¿QUIÉN PODRÍA SER ESTE PACIENTE? — se le pregunta al servidor.
 *
 * ── POR QUÉ EXISTE ESTE MÓDULO ───────────────────────────────────────────────
 *
 * REG-341 le puso techo a `getPatients`, y REG-347 descubrió la factura: quien
 * trataba «la lista» como el censo completo pasó a tratar un RECORTE como el
 * censo completo, sin que cambiara una línea de su código. En la pantalla de
 * buscar eso significaba decir «no está» de alguien que sí está.
 *
 * REG-347 lo cerró en `/pacientes` escribiendo dos sondeos indexados AHÍ MISMO.
 * Funcionó, y dejó nueve pantallas más haciendo lo mismo mal: un typeahead que
 * filtra en memoria, una comprobación antiduplicado sobre un recorte, un
 * importador que decide si un paciente «ya existe» mirando 500 de N.
 *
 * La reparación no puede ser copiar esos dos sondeos nueve veces. Se saca aquí
 * **una vez**, y las pantallas la llaman.
 *
 * ── LA CONSECUENCIA DE EQUIVOCARSE AQUÍ ──────────────────────────────────────
 *
 * No es una lista fea. Es un **expediente partido en dos**: la mitad de la
 * historia bajo un registro y la otra mitad bajo otro, cada uno con sus
 * alergias, sus diagnósticos y su medicación. Nadie ve el error — se ve como un
 * paciente nuevo.
 *
 * Por eso este módulo distingue tres cosas que se parecen y no son iguales:
 *
 *   · **no hay candidatos** — se preguntó y no hay nadie;
 *   · **hay candidatos y puede haber más** (`truncada`) — la ventana se llenó;
 *   · **no se pudo preguntar** (`sePudoPreguntar: false`) — falló la lectura.
 *
 * Las tres se pintan distinto. Tratar la tercera como la primera es exactamente
 * la regla 4 de seguridad clínica al revés: convertir «no lo sé» en «no hay».
 *
 * ── LO QUE NO ALCANZA, DECLARADO ─────────────────────────────────────────────
 *
 * La búsqueda subyacente es por **PREFIJO**. Un duplicado con el orden de los
 * nombres cambiado —«López María» frente a «María López»— y **sin teléfono en
 * común** no aparece. Es el hueco conocido de REG-347 (P1-17 del tablero): no se
 * cierra aquí, pero tampoco se agranda.
 */
import { buscarPacientes } from '@/lib/firestore'
import { buscarPosiblesDuplicados, type Coincidencia } from '@/lib/pacientes/duplicados'
import type { Patient } from '@/types'

/**
 * Con qué datos se busca a alguien.
 *
 * **`nombre` y `telefono` son lo que se BUSCA** —son las dos señales indexadas
 * por prefijo— y uno de los dos basta. El resto no se busca: **afina la
 * comparación**. Y no es un adorno: el motor de duplicados sólo dice `seguro`
 * con CURP, con la misma fecha de nacimiento o con la misma edad; sin esos
 * campos un duplicado real se queda en `probable` y **deja de frenar el alta**.
 *
 * Por eso el tipo los acepta todos: recortarlo a nombre y teléfono habría
 * debilitado en silencio la comprobación antiduplicado de quien ya la tenía
 * bien.
 */
export interface QuienSeBusca {
  nombre?: string | null
  telefono?: string | null
  whatsapp?: string | null
  curp?: string | null
  fechaNacimiento?: string | null
  edad?: number | null
}

export interface Candidatos {
  /** Los que el servidor devolvió, sin repetir, ordenados por nombre. */
  pacientes: Patient[]
  /** true = alguna ventana se llenó: PUEDE haber coincidencias no mostradas. */
  truncada: boolean
  /**
   * false = ninguna de las consultas llegó a contestar. **No es lo mismo que
   * «no hay»**, y quien lo reciba no puede pintarlo igual.
   */
  sePudoPreguntar: boolean
}

/**
 * Sondea el directorio por las dos señales fuertes de identidad: **teléfono** y
 * **nombre**. El coste depende de la ventana de búsqueda, nunca del tamaño del
 * consultorio.
 *
 * Se lanzan las dos y se funden: un duplicado puede compartir teléfono y tener
 * el nombre escrito de otro modo, o al revés.
 */
export async function candidatosDePaciente(
  clinicId: string,
  quien: QuienSeBusca,
): Promise<Candidatos> {
  const nombre = (quien.nombre ?? '').trim()
  const telefono = (quien.telefono ?? '').trim()
  if (!nombre && !telefono) {
    // No se preguntó nada, así que tampoco se falló: es un vacío honesto.
    return { pacientes: [], truncada: false, sePudoPreguntar: true }
  }

  /**
   * Se lanzan SÓLO las señales que hay. Y `sePudoPreguntar` cuenta las que se
   * lanzaron de verdad: una sonda que no se llegó a hacer —porque no había
   * teléfono— no es prueba de que la lectura funcione. Contarla como tal decía
   * «se preguntó y no hay» después de un fallo, y de ahí sale un expediente
   * duplicado.
   */
  const lanzadas = [
    ...(telefono ? [buscarPacientes(clinicId, telefono)] : []),
    ...(nombre ? [buscarPacientes(clinicId, nombre)] : []),
  ]
  const sondas = await Promise.allSettled(lanzadas)

  const encontrados = new Map<string, Patient>()
  let truncada = false
  let alguna = false
  for (const s of sondas) {
    if (s.status !== 'fulfilled') continue
    alguna = true
    if (s.value.truncada) truncada = true
    for (const p of s.value.pacientes) if (p.id) encontrados.set(p.id, p)
  }

  return {
    pacientes: [...encontrados.values()].sort((a, b) =>
      String(a.nombre ?? '').localeCompare(String(b.nombre ?? ''), 'es') || String(a.id).localeCompare(String(b.id))),
    truncada,
    sePudoPreguntar: alguna,
  }
}

/**
 * ¿ESTE PACIENTE YA EXISTE? — la comprobación antiduplicado, con la misma regla
 * en todas las puertas por donde se da de alta a alguien.
 *
 * Devuelve las coincidencias que `duplicados.ts` clasifica como **`seguro`**
 * (las `probable` son para sugerir, no para frenar) y arrastra `truncada` y
 * `sePudoPreguntar`, porque un «no hay duplicado» dicho sin haber podido
 * preguntar no vale como «no hay duplicado».
 *
 * `descartados` respeta el «es otra persona» que alguien ya dijo en la pantalla:
 * volver a preguntarlo al guardar entrena a decir que sí sin leer.
 */
export async function duplicadosProbablesDe(
  clinicId: string,
  quien: QuienSeBusca,
  descartados: ReadonlySet<string> = new Set(),
): Promise<{ seguros: Coincidencia<Patient>[]; truncada: boolean; sePudoPreguntar: boolean }> {
  const c = await candidatosDePaciente(clinicId, quien)
  const seguros = buscarPosiblesDuplicados(
    {
      nombre: quien.nombre ?? '',
      telefono: quien.telefono ?? undefined,
      whatsapp: quien.whatsapp ?? undefined,
      curp: quien.curp ?? undefined,
      fechaNacimiento: quien.fechaNacimiento ?? undefined,
      edad: quien.edad ?? undefined,
    },
    c.pacientes.filter(p => !descartados.has(String(p.id))),
  ).filter(x => x.certeza === 'seguro')
  return { seguros, truncada: c.truncada, sePudoPreguntar: c.sePudoPreguntar }
}
