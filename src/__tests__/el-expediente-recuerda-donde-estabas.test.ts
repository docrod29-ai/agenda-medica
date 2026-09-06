/**
 * D-023 · PG-012/PI-022 (Panel de Lujo 2026-09, auditores D, PG y PI) — el
 * expediente olvidaba dónde estabas, y la invalidación de los enlaces del portal
 * no dejaba dicho por qué.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * · **D-023** — `filtro` y `expandida` vivían en `useState`, fuera de la URL
 *   (`expediente/[patientId]/page.tsx:96-97`). Abrir una nota, entrar a la
 *   consulta y volver te devolvía al filtro de fábrica con todo cerrado, y a
 *   buscar otra vez la nota que estabas leyendo. `/citas` ya lo había resuelto
 *   con `searchParams` (`:105`, `:124-125`); el expediente no. Era uno de los
 *   tres puntos que seguían vivos de NAVIGATION_STATE_AUDIT.
 * · **PG-012/PI-022** — invalidar los enlaces del portal subía
 *   `portalTokenVersion` y decía «Listo». El equipo rojo REFUTÓ media
 *   acusación del auditor —`updatePatient` sí emite `logAudit`, con evento,
 *   consultorio, paciente, campo, fecha y quién—, así que el asiento existía.
 *   Lo que NO quedaba era el MOTIVO: «rotación por precaución» y «el enlace
 *   acabó en manos de su expareja» dejaban exactamente la misma huella, y la
 *   segunda es la que hay que poder reconstruir seis meses después.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 * Auditor D recorriendo el estado de navegación línea por línea; PG y PI desde
 * el lado del paciente («reenvié mi enlace por WhatsApp y me arrepentí»). El
 * equipo rojo verificó los tres puntos de D-023 y corrigió a PG en lo del
 * asiento, dejando en pie sólo lo que aquí se repara.
 *
 * ── CAUSA RAÍZ ───────────────────────────────────────────────────────────────
 * Estado de pantalla guardado donde no sobrevive a una navegación. Y una
 * bitácora que registra el CAMPO que cambió pero no el ACTO que lo cambió: dos
 * hechos distintos que se estaban confundiendo.
 *
 * ── REGLA ────────────────────────────────────────────────────────────────────
 * `design-system.md`, principio CONTINUIDAD: «se comprueba que el estado
 * sobreviva». Y `data-privacy.md` en lo que la URL puede llevar: el `n` es el id
 * de una nota, nunca su contenido — PHI no va en la barra de direcciones.
 *
 * ── TIPO DE PRUEBA ───────────────────────────────────────────────────────────
 * CONTRATO TEXTUAL sobre `expediente/[patientId]/page.tsx`, declarado: la
 * pantalla necesita ClinicContext, Auth, Firestore y el router de Next para
 * montarse, y este repo corre vitest en `environment: 'node'` sin jsdom. Se
 * prueba al revés: hay casos que fijan lo que NO debe pasar (volver al
 * `useState`, apilar una entrada de historia por cada clic, invalidar sin
 * motivo).
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 * No monta la pantalla ni navega de verdad. No cubre los otros dos puntos de
 * D-023: la restauración de scroll y la pestaña «Agenda» de la asistente que se
 * ilumina en `/citas` y navega a `/calendario` (`BottomNav.tsx:65`, de
 * UI-CONFIG) — van en `handoff-EXPEDIENTES.md`. No cubre el botón que le falta
 * AL PACIENTE para invalidar su propio enlace desde `/mi` (PI-022): eso es
 * `src/app/mi/**` y `api/portal/**`, de la rebanada de PORTAL.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const fuente = readFileSync(resolve(process.cwd(), 'src/app/(dashboard)/expediente/[patientId]/page.tsx'), 'utf8')
const codigo = fuente.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('D-023 · el filtro y la nota abierta sobreviven a salir y volver', () => {
  it('los dos salen de la URL, no de un useState que se pierde', () => {
    expect(codigo).toMatch(/const searchParams = useSearchParams\(\)/)
    expect(codigo).toMatch(/searchParams\.get\('f'\)/)
    expect(codigo).toMatch(/searchParams\.get\('n'\)/)
    expect(codigo).not.toMatch(/useState<'todas' \| 'consulta' \| 'hospital'>/)
    expect(codigo).not.toMatch(/const \[expandida, setExpandida\] = useState/)
  })

  it('el estado se ESCRIBE sin apilar historia: volver sale del expediente', () => {
    // Con `push`, cada clic en un chip metería una entrada en el historial y el
    // botón «atrás» se convertiría en «deshacer filtro» veinte veces.
    expect(codigo).toMatch(/router\.replace\(/)
    expect(codigo).toMatch(/scroll: false/)
  })

  it('el valor de fábrica no ensucia la URL', () => {
    // `?f=consulta` es el estado por omisión: escribirlo haría que todo enlace
    // compartido llevara ruido y que la URL cambiara sin que nadie tocara nada.
    expect(codigo).toMatch(/f: v === 'consulta' \? null : v/)
  })

  it('en la URL sólo van identificadores, nunca contenido clínico', () => {
    // `n` es el id de una nota. Si alguna vez alguien pusiera ahí el motivo de
    // consulta o el diagnóstico, sería PHI en la barra de direcciones — y en el
    // historial del navegador, y en el `Referer`.
    expect(codigo).not.toMatch(/escribirEnLaUrl\(\{[^}]*(diagnostico|motivo:|nombre)/)
  })
})

describe('PG-012 · invalidar los enlaces deja dicho POR QUÉ', () => {
  it('se pide el motivo antes de invalidar, y sin él no se puede', () => {
    expect(codigo).toMatch(/¿Por qué los invalidas\?/)
    expect(codigo).toMatch(/disabled=\{!motivo\.trim\(\)\}/)
  })

  it('el motivo llega a la bitácora junto al acto, no sólo al campo', () => {
    expect(codigo).toMatch(/accion: 'invalidar-enlaces-del-portal'/)
    expect(codigo).toMatch(/motivo: motivo\.trim\(\)/)
  })

  it('usa un evento que el servidor acepta: uno nuevo se descartaría en silencio', () => {
    // La lista blanca vive en `api/auditoria/registrar` y `logAudit` se traga el
    // error a propósito para no romper la operación: un evento inventado dejaría
    // bitácora en el código y ninguna en la base (es lo que pasó con
    // `cobro_exento`).
    expect(codigo).toMatch(/evento: 'paciente_modificado'/)
    expect(codigo).not.toMatch(/evento: 'portal_enlace_invalidado'/)
  })

  it('hay motivos escritos y además texto libre: una lista cerrada obliga a mentir', () => {
    expect(codigo).toMatch(/El enlace se reenvió a alguien más/)
    expect(codigo).toMatch(/o escríbelo con tus palabras/)
  })
})
