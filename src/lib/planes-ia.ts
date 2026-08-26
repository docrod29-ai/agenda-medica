/**
 * PLANES por CRÉDITOS (modelo tipo Asclepius) — fuente ÚNICA de verdad.
 *
 * Idea: cada plan da N CRÉDITOS de IA de máximo nivel al mes. Cuando se acaban,
 * la IA NO se detiene: baja sola a un modo ECONÓMICO (nivel ⚡ Rápida, sin
 * separación de voces ni segunda revisión) que casi no cuesta al dueño. El médico
 * nunca se queda sin IA, y si quiere recuperar la máxima COMPRA más créditos o
 * sube de plan. Así el gasto del dueño se controla sin bloquear al médico con el
 * paciente enfrente.
 *
 * 1 crédito ≈ 1 consulta con IA de nivel ⭐ Estándar (voz + nota). Cambia los
 * números aquí y se reflejan en toda la app (tope, gates, página de precios).
 *
 * ── QUÉ ES PHYSICIAN-FACING EN ESTE ARCHIVO Y QUÉ NO ─────────────────────────
 *
 * Lo EXPORTADO como tipo o cadena de pantalla (`Motor`, `MOTORES`, `PLANES`) es
 * el contrato con el médico y NO nombra proveedores ni modelos. Los comentarios
 * de costo del dueño sí los nombran a propósito: son contabilidad interna, no
 * llegan a ninguna pantalla, y borrarlos volvería inauditable el margen.
 *
 * Costos aprox del dueño (USD) por acción — INTERNO, para calcular márgenes:
 *   voz(OpenAI)~$0.06 · diarización(AssemblyAI)~$0.15 · nota Sonnet~$0.08 ·
 *   nota Opus+thinking~$0.60 · verificación GPT-5~$0.04 · evidencia~$0.03
 */
import type { NivelIA } from './ai-keys'

export type ClavePlan = 'agenda' | 'clinica' | 'premium' | 'hospital'

export interface PlanCreditos {
  clave: ClavePlan
  nombre: string
  precioMXN: number
  /** Créditos de IA incluidos al mes (0 = plan sin IA). */
  creditos: number
  /** Nivel de IA para la nota: 'pro' o 'premium'. Lo traduce el router. */
  nivelIA: NivelIA
  /** Módulos/funciones incluidas (para la página de precios y los gates). */
  incluye: string[]
  /** Pacientes máximos (null = ilimitado). */
  pacientesMax: number | null
  destacado?: boolean
}

/**
 * NIVEL DE IA POR NOTA — el médico expresa INTENCIÓN CLÍNICA, nunca una marca.
 *
 * ── LA REGLA DE PRODUCTO (Board #296) ────────────────────────────────────────
 *
 * «El médico no elige modelos ni niveles. Router automático usa el modelo mínimo
 * suficiente para cada tarea y escala sólo cuando complejidad/riesgo lo exige.»
 *
 * Lo que el médico declara es QUÉ CASO TIENE ENFRENTE —rutinario, complejo,
 * difícil— y cuánto puede esperar. Quién lo atiende por dentro (proveedor,
 * modelo, cuántos verificadores) lo decide el router leyendo `perfil`, y eso NO
 * es contrato de esta interfaz: vive en `src/lib/ia/procedencia-motor.ts`, para
 * procedencia, auditoría, costos y depuración administrativa.
 *
 * ── POR QUÉ EL CAMPO `modelos` ERA EL DEFECTO, Y NO EL COPY ──────────────────
 *
 * Este bloque exportaba `modelos: 'Opus 4.8 + GPT-5 + 2ª opinión'` como campo del
 * TIPO. Mientras exista ese campo, toda pantalla que pinte un nivel pinta una
 * marca —lo hacían /precios y la tabla de niveles— y limpiar el texto de una
 * pantalla no arregla nada: la siguiente que lea `Motor` lo vuelve a traer. Por
 * eso el arreglo quita el campo, no la cadena.
 *
 * Y hay una razón clínica, no sólo de marca: una marca en pantalla convierte una
 * decisión clínica en una decisión de compra de cómputo. El médico no tiene por
 * qué saber qué modelo razona mejor un caso difícil, ni reaprenderlo cada vez que
 * el router mejore. El día que cambie el modelo detrás de 💎 Máxima, el contrato
 * con el médico no cambia: sigue siendo «caso clínico difícil».
 *
 * Cada nivel QUEMA créditos según su costo real, así que 1 crédito le cuesta al
 * dueño ~lo mismo (~$1.5 MXN) sea cual sea el nivel que elija el médico.
 *
 *   ⚡ Rápida   → 1 crédito   · nota rutinaria / seguimiento simple
 *   ⭐ Estándar → 3 créditos  · consulta compleja
 *   💎 Máxima   → 10 créditos · caso clínico difícil
 */
export type ClaveMotor = 'rapida' | 'estandar' | 'maxima'

/**
 * PERFIL DE RUTEO — la metadata canónica que YA consume el router.
 *
 * `/api/expediente/procesar` traduce `perfil` a su cascada de modelos reales
 * (`CANDIDATOS`). Es el único puente intención→cómputo que existe y no se
 * duplica aquí: este archivo declara la intención, el router resuelve el modelo.
 */
export type PerfilRuteo = 'live' | 'pro' | 'premium'

export interface Motor {
  clave: ClaveMotor
  nombre: string
  emoji: string
  /**
   * QUÉ CAPACIDAD entrega el nivel, en términos clínicos y SIN marca.
   *
   * Ocupa el sitio donde vivía `modelos`. Dice qué gana el médico —cuántos pasos
   * de razonamiento, si hay separación de voces, si hay segunda revisión—, que es
   * lo que cambia su decisión; no dice quién lo ejecuta, que no la cambia.
   */
  capacidad: string
  /** Créditos que quema una nota con este nivel. */
  creditos: number
  /**
   * Perfil de ruteo que consume `procesar`. INTERNO: no se pinta al médico.
   *
   * Se queda en este tipo a propósito —es el puente al router existente— pero no
   * nombra proveedor ni modelo, así que no reintroduce el defecto.
   */
  perfil: PerfilRuteo
  /** La INTENCIÓN CLÍNICA que el médico sí expresa: qué caso tiene enfrente. */
  usoRecomendado: string
  /**
   * QUÉ CAMBIA CLÍNICAMENTE en cada nivel (no solo el precio). El usuario merece
   * saber qué gana con "Máxima": no es "más caro", es 2º verificador + evidencia +
   * revisión de seguridad. Esto se muestra en /precios y en el selector de nota.
   */
  incluye: string[]
  /** Latencia relativa (para gestionar expectativa). */
  latencia: string
}
export const MOTORES: Record<ClaveMotor, Motor> = {
  rapida:   { clave: 'rapida',   nombre: 'Rápida',   emoji: '⚡', capacidad: 'Un paso de IA, la menor latencia', creditos: 1,  perfil: 'live',
    usoRecomendado: 'Nota rutinaria / seguimiento simple',
    incluye: ['Estructuración de la nota', 'Resumen del caso', 'La menor latencia disponible'],
    latencia: 'Mínima' },
  estandar: { clave: 'estandar', nombre: 'Estándar', emoji: '⭐', capacidad: 'Razonamiento clínico + separación de voces', creditos: 3,  perfil: 'pro',
    usoRecomendado: 'Consulta compleja',
    incluye: ['Todo lo de Rápida', 'Separación de voces (médico/paciente)', 'Detección de omisiones', 'Revisión básica de seguridad', 'Escalas clínicas con código'],
    latencia: 'Media' },
  maxima:   { clave: 'maxima',   nombre: 'Máxima',   emoji: '💎', capacidad: 'Máximo razonamiento + segunda revisión independiente', creditos: 10, perfil: 'premium',
    usoRecomendado: 'Caso clínico difícil',
    incluye: ['Todo lo de Estándar', 'Máximo razonamiento clínico disponible', 'Segundo verificador independiente (2ª opinión)', 'Evidencia PubMed con PMID verificado', 'Revisión farmacológica (dosis · interacciones · función renal)', 'Mayor contexto clínico'],
    latencia: 'Mayor (razonamiento profundo)' },
}
export const motorPorClave = (c?: string): Motor => MOTORES[(c as ClaveMotor)] ?? MOTORES.estandar
/** Motor por defecto según el nivel del plan: Pro/Premium → Máxima; Clínica → Estándar. */
export const motorPorDefecto = (n: NivelIA): Motor => (n === 'premium' ? MOTORES.maxima : MOTORES.estandar)

/**
 * Qué modelos usa el Copilot de UCI en cada motor.
 *
 * La diferencia que se paga NO es «un modelo mejor»: es cuántos cerebros
 * razonan el caso. En Máxima son dos modelos distintos en paralelo y sus
 * desacuerdos se muestran; en Rápida es uno solo y rápido.
 */
export const COPILOT_UCI_POR_MOTOR: Record<ClaveMotor, {
  creditos: number; anthropic: boolean; openai: boolean; descripcion: string
}> = {
  rapida: { creditos: 1, anthropic: true, openai: false,
    descripcion: 'Un modelo veloz. Para el pase de rutina.' },
  estandar: { creditos: 3, anthropic: true, openai: false,
    descripcion: 'Un modelo de razonamiento. Para el paciente que se mueve.' },
  maxima: { creditos: 7, anthropic: true, openai: true,
    descripcion: 'Dos modelos en paralelo y sus desacuerdos a la vista. Para el caso difícil.' },
}

/**
 * COSTO EN CRÉDITOS de acciones que NO son la nota. El Consultor de evidencia
 * (doble cerebro Claude+GPT) es ligero; gasta del MISMO bote pero poco.
 */
export const COSTO_CREDITOS = {
  consultorPro: 0.5,     // pregunta al Consultor con IA Pro (Sonnet 5 + GPT-4o)
  consultorPremium: 4,   // pregunta al Consultor con IA Premium (Opus 4.8 + GPT-5): costo real ~$7.5
  // El Copilot de UCI llama a Opus + GPT EN PARALELO por turno (dual-model, ~$10):
  // es la acción más cara del sistema. NO puede valer 0 créditos (era la mayor fuga).
  copilotUci: 7,
  /**
   * El Copilot de UCI, POR MOTOR — el médico elige, igual que en la nota.
   *
   * Antes sólo existía un precio: 7 créditos, con Opus y GPT-5 en paralelo
   * SIEMPRE. Eso convertía la acción más cara del sistema en la única sin
   * alternativa: un pase de rutina pagaba lo mismo que el caso difícil, y con
   * 500 créditos daba para 59 pases si se usaba en todos.
   *
   * Ahora la síntesis rutinaria cuesta 1 y la de máximo razonamiento 7. La
   * diferencia real está en la SEGUNDA OPINIÓN: pedirle a dos modelos distintos
   * que razonen el mismo caso vale para el paciente complicado y sobra para
   * confirmar que un postoperatorio va bien.
   */
  copilotUciRapida: 1,
  copilotUciEstandar: 3,
  copilotUciMaxima: 7,
  // ── Acciones de IA que antes valían 0 créditos (fuga de dinero icu-007) ──
  // Cada llamada a un modelo/proveedor tiene costo real que corría con la llave del
  // dueño sin cobrarse. Ahora cada acción quema créditos (passthrough del gasto).
  correccionVoz: 0.2,        // corrector de dictado (LLM breve)
  extraerEntidades: 0.3,     // NER clínico
  atribuirRoles: 0.2,        // roles médico/paciente en diarización
  verificarNota: 0.5,        // verificación anti-alucinación de la nota
  laboratorioVision: 1,      // interpreta PDF/foto de laboratorio (visión)
  antibiogramaVision: 1,     // lee foto de antibiograma (visión)
  antibiogramaRazonar: 1,    // razona mecanismo de resistencia (LLM)
  evidencia: 1,              // Consultor de evidencia (LLM + PubMed)
  transcribir: 0.5,          // transcripción final (Whisper/gpt-4o-transcribe)
  transcribirChunk: 0.05,    // parcial en vivo (barato, pero no es gratis)
  transcribirDiarizado: 1,   // separación de voces (AssemblyAI)
  /**
   * DOS ACCIONES QUE LLAMABAN AL MODELO Y NUNCA MOVÍAN EL CONTADOR.
   *
   * El gate (`gateCreditos`/`creditosAgotados`) sólo mira `uso.{mes}.creditos`.
   * Estas dos rutas nunca lo incrementaban, así que el corte no podía dispararse
   * NUNCA: un consultorio que usara sólo estas pantallas tenía IA ilimitada
   * sobre la llave del dueño.
   *
   * Las cifras están puestas por analogía con lo que ya existe —redacción larga
   * ≈ `verificarNota`, visión ≈ `laboratorioVision`— y son AJUSTABLES: el precio
   * es del Dr., lo que no era discutible es que valieran cero.
   */
  inmunoRedactar: 0.5,       // redacta la nota infectológica (LLM largo)
  recetaVision: 1,           // detecta los campos del formato de receta (visión)
} as const

/** Cuántos créditos cuesta una pregunta al Consultor según el nivel de IA del plan. */
export const costoConsultor = (n: NivelIA): number =>
  n === 'premium' ? COSTO_CREDITOS.consultorPremium : COSTO_CREDITOS.consultorPro

export const PLANES: Record<ClavePlan, PlanCreditos> = {
  agenda: {
    clave: 'agenda', nombre: 'Agenda', precioMXN: 349, creditos: 0, nivelIA: 'pro',
    pacientesMax: null,
    incluye: [
      'Agenda y citas ilimitadas',
      'Recordatorios por WhatsApp',
      'Expediente básico de pacientes',
      'Portal del paciente',
      'Sin IA de voz/notas (se puede subir de plan)',
    ],
  },
  clinica: {
    clave: 'clinica', nombre: 'Clínica', precioMXN: 899, creditos: 200, nivelIA: 'pro',
    pacientesMax: null, destacado: true,
    incluye: [
      'Todo lo de Agenda',
      'Nota clínica con IA (voz → nota, orientada a los requisitos de la NOM-004)',
      'Separación médico-paciente automática',
      'Recetas y órdenes',
      'Consultor de evidencia (PubMed) con doble verificación de IA',
      'Elige el nivel de IA por nota según el caso: ⚡ rutinario · ⭐ complejo · 💎 difícil',
      '200 créditos/mes (~63 notas Estándar)',
      'Al agotarlos sigue en ⚡ Rápida sin costo hasta 120 notas más/mes; luego se pausa y recargas o subes de plan',
      'Incluye 1 médico · +$499/mes por médico adicional',
    ],
  },
  premium: {
    clave: 'premium', nombre: 'Pro', precioMXN: 1590, creditos: 450, nivelIA: 'premium',
    pacientesMax: null,
    incluye: [
      'Todo lo de Clínica',
      'IA de máximo razonamiento clínico por defecto 💎',
      '2ª opinión automática (segundo verificador independiente) en cada nota',
      'Revisión farmacológica automática: dosis · interacciones · función renal',
      'Interpretación de laboratorios por IA con tendencias por analito',
      'Valoración del inmunocomprometido con IA de máximo nivel',
      'Consultor de evidencia con IA de máximo nivel',
      '450 créditos/mes (~45 notas Máxima o ~150 Estándar)',
      'Al agotarlos sigue en ⚡ Rápida sin costo hasta 150 notas más/mes; luego se pausa y recargas o subes de plan',
      'Soporte prioritario',
      'Incluye 1 médico · +$999/mes por médico adicional',
    ],
  },
  // Plan APARTE: hospitalización. El producto estrella es el de consultorio
  // (Clínica); Hospital es para quien maneja internamiento y se cobra por su lado.
  hospital: {
    clave: 'hospital', nombre: 'Hospital + UCI', precioMXN: 3499, creditos: 500, nivelIA: 'premium',
    pacientesMax: null,
    incluye: [
      'Todo lo de Pro (consultorio con IA de máximo nivel)',
      'Módulo de Hospitalización completo',
      'Censo, tablero de camas de hospital y de UCI, traslados',
      'Indicaciones/MAR, signos y gráficas (NEWS2)',
      'Notas de ingreso, evolución, egreso, postop y anestesia',
      'Interconsultas y laboratorio',
      'Panel UCI: motores deterministas de ventilación, gasometría/ácido-base, SOFA/APACHE, POCUS/VExUS/PLR, neurocrítico (PPC/PIC), CKRT/PRISMA y ECMO',
      'Nota de evolución UCI por los 7 sistemas, dictada manos libres',
      'Copilot IA de UCI con doble razonamiento sobre los cálculos, y que aprende',
      'Todos los niveles de IA · 500 créditos/mes',
      'Al agotarlos sigue en ⚡ Rápida sin costo; luego se pausa y recargas o subes de plan',
    ],
  },
}

export const planPorClave = (c: ClavePlan): PlanCreditos => PLANES[c] ?? PLANES.clinica
export const planPorNivel = (n: NivelIA): PlanCreditos => (n === 'premium' ? PLANES.premium : PLANES.clinica)

/** Paquete de recarga de créditos (top-up) cuando se acaban. Te cuestan ~$150 → +$249 limpio. */
export const RECARGA = { creditos: 100, precioMXN: 399 }

/**
 * El precio, ya escrito para pantalla: `$1,590`.
 *
 * Existe porque el precio se pinta en varios sitios y en todos hacía falta el
 * mismo formateo — así que en varios sitios se acabó escribiendo el número a
 * mano al lado de un comentario que decía «fuente única: PLANES». Los valores
 * coincidían por casualidad; el día que se suba una tarifa, coincidir deja de
 * ser gratis y la divergencia no la ve nadie hasta que un médico compara la
 * pantalla con su recibo.
 *
 * `es-MX` pone el separador de miles donde va. Se declara el `minimumFractionDigits`
 * a 0 a propósito: los planes son cifras cerradas y «$1,590.00» en un botón
 * sobra.
 */
export const precioTexto = (p: PlanCreditos): string =>
  `$${p.precioMXN.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

/**
 * ORDEN COMERCIAL de los planes y qué módulos abre cada uno.
 *
 * Vive aquí, con los precios, porque el P0-2 de la auditoría fue exactamente
 * esto: un segundo catálogo quemado en `superadmin/page.tsx` que discrepaba de
 * `PLANES` en sus cuatro renglones. Un precio que depende de qué pantalla mires
 * no es un precio.
 *
 * Cambiar la oferta se hace AQUÍ, en un sitio.
 */
export const PLANES_ORDEN: readonly ClavePlan[] = ['agenda', 'clinica', 'premium', 'hospital']

export const MODULOS_POR_PLAN: Readonly<Record<ClavePlan, string[]>> = {
  agenda: ['agenda'],
  clinica: ['agenda', 'expediente'],
  premium: ['agenda', 'expediente', 'consultor'],
  hospital: ['agenda', 'expediente', 'consultor', 'hospitalizacion', 'uci'],
}

/**
 * TOPE del MODO ECONÓMICO (red de seguridad de costo). Tras agotar los créditos
 * premium, la IA sigue GRATIS en ⚡ Rápida (Haiku) pero SOLO hasta este número de
 * notas al mes; pasado eso se PAUSA y pide recarga/subir de plan. Así, aunque un
 * consultorio tenga varios médicos exprimiendo la IA, el costo del dueño queda
 * ACOTADO (nunca se dispara). Números fáciles de cambiar.
 */
export const TOPE_ECONOMICO: Record<NivelIA, number> = { pro: 120, premium: 150 }
export const topeEconomicoDe = (n: NivelIA): number => TOPE_ECONOMICO[n] ?? 120

/**
 * COBRO POR ASIENTO (por médico). El plan incluye 1 médico; cada médico ADICIONAL
 * cuesta esto al mes y trae SU propia bolsa de créditos + tope económico. Así el
 * ingreso sube junto con los médicos y el costo del dueño nunca se dispara.
 * Se cobra ~2× el costo peor caso del médico → margen ~50% garantizado.
 */
export const MEDICO_EXTRA: Record<NivelIA, { precioMXN: number; creditos: number; economico: number }> = {
  pro:     { precioMXN: 499, creditos: 80,  economico: 80 },   // Clínica
  premium: { precioMXN: 999, creditos: 200, economico: 150 },  // Pro
}

/** Plan ANUAL: 12 meses al precio de 10 (2 gratis = −17%). Asegura flujo y baja la cancelación. */
export const MESES_ANUAL = 10
export const precioAnual = (p: PlanCreditos): number => p.precioMXN * MESES_ANUAL
/** Ahorro anual vs pagar 12 meses sueltos. */
export const ahorroAnual = (p: PlanCreditos): number => p.precioMXN * 12 - precioAnual(p)

/** Estado de créditos para el tope de gasto. */
export interface EstadoCreditos {
  usados: number
  incluidos: number
  extra: number          // créditos comprados (top-up) disponibles
  restantes: number
  porcentaje: number
  alerta: 'ok' | 'cerca' | 'agotado'
}

export function estadoCreditos(usados: number, incluidos: number, extra = 0): EstadoCreditos {
  const total = incluidos + extra
  const restantes = Math.max(0, total - usados)
  const pct = total > 0 ? Math.round((usados / total) * 100) : 100
  return {
    usados, incluidos, extra, restantes, porcentaje: pct,
    alerta: restantes <= 0 ? 'agotado' : pct >= 80 ? 'cerca' : 'ok',
  }
}

// ── COMPAT con el modelo anterior (2 planes por nivelIA) ────────────────
// Mantiene funcionando procesar / superadmin / el banner de la consulta sin
// tocarlos mientras se migra al modelo de créditos.
export interface PlanIA {
  clave: 'basico' | 'premium'; nombre: string; nivelIA: NivelIA; precioMXN: number
  limiteConsultas: number; pacientesMax: number | null
  segundaOpinionAuto: boolean; evidencia: boolean; soportePrioritario: boolean
}
export const PLANES_IA: Record<NivelIA, PlanIA> = {
  pro: {
    clave: 'basico', nombre: PLANES.clinica.nombre, nivelIA: 'pro', precioMXN: PLANES.clinica.precioMXN,
    limiteConsultas: PLANES.clinica.creditos, pacientesMax: PLANES.clinica.pacientesMax,
    segundaOpinionAuto: false, evidencia: true, soportePrioritario: false,
  },
  premium: {
    clave: 'premium', nombre: PLANES.premium.nombre, nivelIA: 'premium', precioMXN: PLANES.premium.precioMXN,
    limiteConsultas: PLANES.premium.creditos, pacientesMax: PLANES.premium.pacientesMax,
    segundaOpinionAuto: true, evidencia: true, soportePrioritario: true,
  },
}
export const planDeNivel = (n: NivelIA): PlanIA => PLANES_IA[n] ?? PLANES_IA.pro

export interface EstadoUso { usadas: number; limite: number; restantes: number; porcentaje: number; alerta: 'ok' | 'cerca' | 'excedido' }
export function estadoUso(usadas: number, limite: number): EstadoUso {
  const pct = limite > 0 ? Math.round((usadas / limite) * 100) : 0
  return { usadas, limite, restantes: Math.max(0, limite - usadas), porcentaje: pct, alerta: pct >= 100 ? 'excedido' : pct >= 80 ? 'cerca' : 'ok' }
}

/* ════════════════════════════════════════════════════════════════════════════
   CUÁNTAS CONSULTAS, NO CUÁNTOS CRÉDITOS
   ════════════════════════════════════════════════════════════════════════════

   Un médico no compra créditos: compra consultas documentadas. «200 créditos de
   IA al mes» no le dice nada — no sabe si le alcanza para su semana o para su
   mes, y averiguarlo exige que aprenda cuánto cuesta cada motor. Nadie evalúa un
   producto haciendo esa cuenta: cierra la pestaña.

   El crédito NO desaparece: sigue siendo la unidad interna, y es la honesta,
   porque una nota Máxima cuesta diez veces una Rápida y cobrar igual las dos
   sería mentir en una dirección o en la otra. Lo que cambia es cuál se enseña
   PRIMERO: fuera el número comercial es la consulta; el crédito queda debajo,
   para quien quiera hacer la cuenta.

   Estas funciones son la traducción, y es una división: nada que decidir.
*/

/** Con cuántas notas de un motor alcanza un paquete de créditos. */
export function consultasCon(creditos: number, motor: ClaveMotor = 'estandar'): number {
  const costo = MOTORES[motor]?.creditos ?? MOTORES.estandar.creditos
  if (!(costo > 0) || !(creditos > 0)) return 0
  return Math.floor(creditos / costo)
}

/**
 * La frase comercial de un plan: «~66 consultas con IA Estándar al mes».
 *
 * Lleva la tilde de aproximación a propósito. Es una división exacta, pero el
 * número REAL depende de qué motor elija el médico en cada nota, y prometer una
 * cifra cerrada que luego no se cumple es peor que no dar ninguna — sobre todo
 * cuando la diferencia la nota él al final del mes.
 */
export function consultasIncluidasTexto(plan: PlanCreditos): string {
  if (plan.creditos <= 0) return 'Sin IA de voz ni notas'
  const motor: ClaveMotor = plan.nivelIA === 'premium' ? 'maxima' : 'estandar'
  const n = consultasCon(plan.creditos, motor)
  return `~${n} consultas con IA ${MOTORES[motor].nombre} al mes`
}

export const POR_QUE_NO_SE_VENDE_EN_CREDITOS =
  'Porque un médico no compra créditos: compra consultas documentadas. «200 ' +
  'créditos» no le dice si le alcanza para su semana o su mes, y averiguarlo ' +
  'exige aprender cuánto cuesta cada motor. Nadie evalúa un producto haciendo ' +
  'esa cuenta. El crédito sigue siendo la unidad interna —y la honesta, porque ' +
  'una nota Máxima cuesta diez veces una Rápida— pero deja de ser lo primero ' +
  'que se lee.'
