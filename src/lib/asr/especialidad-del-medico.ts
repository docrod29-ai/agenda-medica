/**
 * DE LA ESPECIALIDAD QUE EL MÉDICO ESCRIBIÓ, AL VOCABULARIO QUE HAY QUE CARGAR.
 *
 * ── EL HUECO ─────────────────────────────────────────────────────────────────
 *
 * `ContextoDictado.especialidades` existe desde que se escribió el léxico, viaja
 * por cuatro capas —opciones del hook → `FormData` → ruta → `construir()`— y
 * **ninguna pantalla lo llenaba nunca**. El comentario del propio léxico dice lo
 * que se perdía: «si él dijo *esto es nefrología*, el módulo no tiene por qué
 * llevarle la contraria». Nadie se lo decía.
 *
 * Sin esto, el vocabulario salía **sólo** del módulo (consulta, hospital, UCI) y
 * de los contextos por defecto. Un infectólogo dictando en su consultorio no
 * cargaba «Antimicrobianos» ni «Microbiología y PROA»: justo los términos que
 * más se le escriben mal.
 *
 * ── POR QUÉ HACE FALTA UNA TABLA ─────────────────────────────────────────────
 *
 * La configuración guarda la especialidad como **texto libre** —«Infectología»,
 * «Medicina Interna», «Med. Interna e Infectología»—, y el mapa del Dr. usa
 * nombres de vocabulario, no de especialidad médica: «Antimicrobianos»,
 * «Renal y electrolitos», «Sepsis y choque». No hay forma de derivar unos de
 * otros: hay que escribirla.
 *
 * Esta tabla **la escribo yo**, igual que `CONTEXTOS_POR_MODULO`. No inventa
 * vocabulario ni cifras: sólo dice qué cajones del mapa del Dr. abrir para cada
 * especialidad. Toda entrada apunta a claves que existen —hay una prueba que lo
 * comprueba— y el orden de cada fila es de más específico a más general.
 *
 * ── LO QUE NO HACE ───────────────────────────────────────────────────────────
 *
 * Si el texto no coincide con nada, **devuelve vacío**. No adivina por parecido
 * ni escoge «la más cercana»: cargar el vocabulario de otra especialidad sesga
 * al reconocedor hacia palabras que nadie va a decir, y eso no se ve — se lee
 * como una transcripción normal con un término cambiado.
 *
 * Módulo PURO.
 */

const norm = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

/**
 * Texto libre de la configuración → claves del mapa de especialidades del Dr.
 *
 * La llave es la forma **normalizada** (sin acentos, en minúsculas) que se busca
 * DENTRO del texto que escribió el médico, para que «Med. Interna e
 * Infectología» active las dos.
 */
export const EQUIVALENCIAS: Readonly<Record<string, readonly string[]>> = {
  // Medicina interna y sus ramas
  'medicina interna': ['Medicina interna ambulatoria', 'Medicina hospitalaria'],
  // Abreviadas: en la configuración se escribe a mano y «Med. Interna» es
  // tan común como el nombre completo.
  'med. interna': ['Medicina interna ambulatoria', 'Medicina hospitalaria'],
  'med interna': ['Medicina interna ambulatoria', 'Medicina hospitalaria'],
  'm. interna': ['Medicina interna ambulatoria', 'Medicina hospitalaria'],
  'infectolog': ['Enfermedades infecciosas', 'Antimicrobianos', 'Microbiología y PROA'],
  'enfermedades infecciosas': ['Enfermedades infecciosas', 'Antimicrobianos'],
  'cardiolog': ['Cardiología'],
  'nefrolog': ['Nefrología', 'Renal y electrolitos'],
  'neumolog': ['Neumología'],
  'endocrinolog': ['Endocrinología', 'Endocrino y metabólico'],
  'gastroenterolog': ['Gastroenterología y hepatología'],
  'hematolog': ['Hematología', 'Hematología y coagulación'],
  'oncolog': ['Oncología'],
  'reumatolog': ['Reumatología'],
  'alergolog': ['Alergia e inmunología'],
  'inmunolog': ['Alergia e inmunología'],
  'geriatr': ['Geriatría y paliativos'],
  'nutric': ['Nutrición clínica'],

  // Cuidados críticos y urgencias
  'terapia intensiva': ['Sepsis y choque', 'Ventilación mecánica', 'Hemodinámica avanzada'],
  'medicina critica': ['Sepsis y choque', 'Ventilación mecánica', 'Hemodinámica avanzada'],
  'intensivista': ['Sepsis y choque', 'Ventilación mecánica', 'Hemodinámica avanzada'],
  'urgencias': ['Emergencias y códigos', 'Escalas y scores'],
  'emergenc': ['Emergencias y códigos', 'Escalas y scores'],

  // Quirúrgicas
  'anestesiolog': ['Anestesiología y preoperatorio', 'Sedación y analgesia'],
  'cirugia general': ['Cirugía general'],
  'cirugia': ['Cirugía general', 'Cirugía especializada'],
  'ortopedia': ['Ortopedia y traumatología'],
  'traumatolog': ['Ortopedia y traumatología', 'Trauma y quemados'],
  'urolog': ['Urología'],
  'otorrino': ['Otorrinolaringología'],
  'oftalmolog': ['Oftalmología'],

  // Neurociencias y salud mental
  'neurolog': ['Neurología'],
  'neurocirug': ['Neuro-UCI', 'Cirugía especializada'],
  'psiquiatr': ['Psiquiatría'],

  // Materno-infantil
  'ginecolog': ['Ginecología', 'Obstetricia'],
  'obstetric': ['Obstetricia', 'Ginecología'],
  'pediatr': ['Pediatría'],
  'neonatolog': ['Neonatología', 'Pediatría'],

  // Diagnóstico y soporte
  'dermatolog': ['Dermatología'],
  'radiolog': ['Radiología', 'Imagenología'],
  'imagenolog': ['Imagenología', 'Radiología'],
  'patolog': ['Patología y laboratorio'],
  'medicina familiar': ['Medicina preventiva y familiar'],
  'farmac': ['Farmacología clínica y farmacia'],
}

/**
 * Qué cajones del mapa abrir para la especialidad que el médico tenga escrita.
 *
 * Sin coincidencia devuelve `[]`, y entonces el vocabulario sale del módulo y de
 * los contextos por defecto — exactamente como hasta ahora. Es decir: esto sólo
 * puede añadir, nunca quitar.
 */
export function especialidadesDelMedico(texto: string | undefined | null): string[] {
  const t = norm(texto ?? '')
  if (!t) return []
  const out: string[] = []
  for (const [clave, destinos] of Object.entries(EQUIVALENCIAS)) {
    if (!t.includes(clave)) continue
    for (const d of destinos) if (!out.includes(d)) out.push(d)
  }
  return out
}

export const POR_QUE_NO_SE_ADIVINA =
  'Sin coincidencia se devuelve vacío. Escoger «la especialidad más parecida» ' +
  'sesgaría el reconocedor hacia palabras que nadie va a decir en esa consulta, ' +
  'y eso no se ve: se lee como una transcripción normal con un término cambiado.'

export const POR_QUE_LA_TABLA_ES_MIA =
  'La configuración guarda la especialidad como texto libre y el mapa del Dr. ' +
  'usa nombres de VOCABULARIO, no de especialidad médica. No hay forma de ' +
  'derivar unos de otros: hay que escribirla, igual que CONTEXTOS_POR_MODULO.'
