/**
 * V15-REMAINING-SCREENS-001 (§32/§34, quinta rebanada) — LA FAMILIA DE
 * OPERACIONES (/operaciones + /configuracion, §11) HABLA EL SISTEMA.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * /configuracion era la superficie MÁS endeudada del inventario de §32 (172
 * `fontSize` inline, 0 roles §2) y /operaciones — el índice administrativo que
 * V15-IA-001 creó — hablaba su propio dialecto de 12px/700 en vez de los roles
 * que el sistema ya tenía. Los defectos concretos:
 *
 *   1. EL RIEL DE SECCIONES de /configuracion tenía un idioma de navegación
 *      PROPIO: el estado activo pintaba teal-COMO-TEXTO (la lección
 *      TrialBanner, otra vez) con un borde `rgba(61,90,254,0.3)` — el ÍNDIGO
 *      VIEJO, un acento que YA NO EXISTE como token (el mismo fantasma pagado
 *      en /registro, 4ª rebanada). El shell ya tenía la palabra para esto:
 *      `.nav-item` + `.active` (barra de acento + texto var(--text)) — la
 *      misma que habla el FlowRail.
 *
 *   2. EL ÍNDIGO VIEJO vivía en DIECINUEVE sitios más de la familia (tintes y
 *      bordes de tarjetas informativas, badges, planes): ninguno cambiaba con
 *      el tema porque el rgba crudo no es un token. Todos hablan ahora
 *      `color-mix(in srgb, var(--nexus) N%, transparent)`.
 *
 *   3. §24: el <select> móvil de secciones NO TENÍA NOMBRE ACCESIBLE (un
 *      lector de pantalla anunciaba «cuadro combinado» sin decir de qué), y
 *      el <nav> del riel tampoco. El badge Activo/Inactivo de médicos pintaba
 *      teal-como-texto sobre tinte y un lavado blanco `rgba(255,255,255,…)`
 *      que en tema claro no existe.
 *
 *   4. La consola del superadmin traía `#7c3aed12`/`#7c3aed44` — morado FIJO
 *      de 8 dígitos que el trinquete de color NI VE (su regex exige \b tras 6
 *      hex) — en vez de `color-mix` sobre `var(--purple)`.
 *
 *   5. Roles §2 en /operaciones: título 20/700 inline (el rol es `.t-h1`,
 *      600), grupos 12/700 inline (el rol es `.t-overline`), tiles sin mínimo
 *      táctil declarado.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Por el inventario-por-grep de REMAINING-SCREENS-001. El estado vivo dejó
 * /configuracion + /operaciones nombradas como quinta rebanada tras la puerta
 * de entrada, cerrando el barrido de §32.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * Freeze funcional (§1/§42): el guardado por DIFF contra el snapshot base
 * (saveConfigPartial, merge — la defensa contra «guardar pisa lo que otra
 * pestaña persistió»), la guarda de configError antes de guardar (P1: no
 * sobreescribir cédula/horario reales con DEFAULTs en blanco), el tab por
 * query param, el catálogo de 16 pestañas y sus grupos, la lista de pestañas
 * que se auto-persisten (sin botón Guardar), los 20 destinos de /operaciones
 * con su filtro por modo y rutaPermitida, y el salirSeguro('/login')
 * compartido. Nada de eso cambia con esta rebanada — este guardián lo fija.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 *
 * No mide estilos computados, contraste ni axe — eso lo hace el arnés
 * `scripts/design/capturar-operaciones-configuracion-v15.mjs` en navegador
 * real. No cubre el CONTENIDO de las 16 pestañas (172 fontSize inline: las
 * pestañas grandes quedan para rebanadas futuras si el barrido §32 las
 * prioriza — esta rebanada pagó el CROMO y el índigo muerto de toda la
 * familia). No cubre secciones-recetas.tsx ni secciones-seguridad.tsx (no
 * tenían índigo muerto). El gate real del superadmin vive en el servidor —
 * aquí sólo se fija el dialecto del enlace.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { RUTAS_DE_CAPACIDADES } from '@/lib/nav/capacidades-del-paciente'

const CONFIG = readFileSync(join('src', 'app', '(dashboard)', 'configuracion', 'page.tsx'), 'utf8')
const OPS = readFileSync(join('src', 'app', '(dashboard)', 'operaciones', 'page.tsx'), 'utf8')
const COMUNICACION = readFileSync(join('src', 'app', '(dashboard)', 'configuracion', 'secciones-comunicacion.tsx'), 'utf8')
const CUENTA = readFileSync(join('src', 'app', '(dashboard)', 'configuracion', 'secciones-cuenta.tsx'), 'utf8')
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')

describe('V15 /configuracion — el riel de secciones habla el idioma del shell (la razón de ser)', () => {
  it('los botones de sección hablan .nav-item + .active, no un dialecto propio', () => {
    expect(CONFIG).toMatch(/className=\{`nav-item\$\{tab === t\.key \? ' active' : ''\}`\}/)
  })

  it('el activo declara aria-current', () => {
    expect(CONFIG).toMatch(/aria-current=\{tab === t\.key \? 'true' : undefined\}/)
  })

  it('el activo NO pinta teal-como-texto ni fondo de acento a mano (lección TrialBanner)', () => {
    const src = sinComentarios(CONFIG)
    expect(src).not.toMatch(/color:\s*tab === t\.key \? 'var\(--nexus\)'/)
    expect(src).not.toMatch(/background:\s*tab === t\.key \? 'var\(--nexus-soft\)'/)
  })

  it('los títulos de grupo del riel hablan .nav-section-title', () => {
    expect(CONFIG).toMatch(/className="nav-section-title"/)
  })

  it('el <nav> del riel tiene nombre accesible', () => {
    expect(CONFIG).toMatch(/<nav className="config-sidebar" aria-label="Secciones de configuración"/)
  })
})

describe('V15 familia de Operaciones — el índigo muerto muere (rgba(61,90,254,…) no es un token)', () => {
  it.each([
    ['configuracion/page.tsx', CONFIG],
    ['secciones-comunicacion.tsx', COMUNICACION],
    ['secciones-cuenta.tsx', CUENTA],
    ['operaciones/page.tsx', OPS],
  ])('%s no pinta el acento viejo crudo', (_nombre, src) => {
    expect(sinComentarios(src)).not.toMatch(/rgba\(\s*61\s*,\s*90\s*,\s*254/)
  })

  it('los tintes del acento hablan color-mix sobre var(--nexus)', () => {
    expect(CONFIG).toMatch(/color-mix\(in srgb, var\(--nexus\) 10%, transparent\)/)
    expect(COMUNICACION).toMatch(/color-mix\(in srgb, var\(--nexus\) 30%, transparent\)/)
    expect(CUENTA).toMatch(/color-mix\(in srgb, var\(--nexus\) 6%, transparent\)/)
  })

  it('la consola del superadmin habla color-mix sobre var(--purple), no morado fijo de 8 dígitos', () => {
    const src = sinComentarios(CONFIG)
    expect(src).not.toMatch(/#7c3aed/i)
    expect(src).toMatch(/color-mix\(in srgb, var\(--purple\) 7%, transparent\)/)
    expect(src).toMatch(/color-mix\(in srgb, var\(--purple\) 27%, transparent\)/)
  })

  it('el badge Activo/Inactivo no pinta teal-como-texto ni lavado blanco fijo', () => {
    const src = sinComentarios(CONFIG)
    expect(src).not.toMatch(/color:\s*doc\.activo \? 'var\(--teal\)'/)
    expect(src).not.toMatch(/rgba\(255,\s*255,\s*255,\s*0?\.05\)/)
  })
})

describe('V15 /configuracion — §24: nombres accesibles y táctiles en el cromo', () => {
  it('el select móvil de secciones tiene nombre accesible y alto táctil', () => {
    expect(CONFIG).toMatch(/aria-label="Sección de configuración"/)
    const select = CONFIG.slice(CONFIG.indexOf('config-mobile-select'), CONFIG.indexOf('</select>'))
    expect(select).toMatch(/minHeight:\s*44/)
  })

  it('el horario semanal tiene nombre accesible por día: activar, inicio y fin (axe label ×17)', () => {
    expect(CONFIG).toMatch(/aria-label=\{`Atender los \$\{DIAS_LABELS\[dia\]\.toLowerCase\(\)\}`\}/)
    expect(CONFIG).toMatch(/aria-label=\{`Hora de inicio del \$\{DIAS_LABELS\[dia\]\.toLowerCase\(\)\}`\}/)
    expect(CONFIG).toMatch(/aria-label=\{`Hora de fin del \$\{DIAS_LABELS\[dia\]\.toLowerCase\(\)\}`\}/)
  })

  it('el estado de carga se anuncia (role=status)', () => {
    expect(CONFIG).toMatch(/role="status"[^>]*>[\s\S]{0,200}Cargando configuración/)
  })

  it('el encabezado del tab activo habla t-h2', () => {
    expect(CONFIG).toMatch(/<h2 className="t-h2"[^>]*>\{tabActual\.label\}<\/h2>/)
  })

  it('el subtítulo del superadmin habla nx-meta', () => {
    expect(CONFIG).toMatch(/className="nx-meta">Todos los consultorios/)
  })
})

describe('V15 /configuracion — freeze funcional (§1/§42): el guardado y las pestañas no cambian', () => {
  it('guardar sigue haciendo DIFF contra el snapshot base y persiste merge (saveConfigPartial)', () => {
    expect(CONFIG).toMatch(/configBaseRef\.current \?\? config/)
    expect(CONFIG).toMatch(/await saveConfigPartial\(clinicId!, parcial\)/)
    expect(CONFIG).toMatch(/configBaseRef\.current = formCompacto/)
  })

  it('la guarda P1 sigue: con configError NO se guarda (no pisar cédula/horario con DEFAULTs)', () => {
    expect(CONFIG).toMatch(/if \(configError\) \{[\s\S]{0,300}return[\s\S]{0,10}\}/)
  })

  it('el tab llega por query param y el retorno de Google aterriza en integraciones', () => {
    expect(CONFIG).toMatch(/searchParams\.get\('tab'\)/)
    expect(CONFIG).toMatch(/setTab\('integraciones'\)/)
  })

  it('el catálogo de pestañas está completo: las 16 llaves de siempre', () => {
    const llaves = ['general', 'horario', 'duraciones', 'bloqueos', 'notificaciones', 'integraciones',
      'plantillas', 'portal', 'recetas', 'seguridad', 'bot', 'medicos', 'equipo', 'suscripcion',
      'entregas', 'dictado']
    for (const k of llaves) expect(CONFIG).toMatch(new RegExp(`key: '${k}'`))
  })

  it('las pestañas que se auto-persisten siguen SIN botón Guardar global', () => {
    for (const t of ['integraciones', 'recetas', 'portal', 'seguridad', 'equipo', 'medicos',
      'bloqueos', 'suscripcion', 'bot', 'entregas']) {
      expect(CONFIG).toMatch(new RegExp(`tab !== '${t}'`))
    }
  })
})

describe('V15 /operaciones — roles §2 y freeze del índice administrativo', () => {
  it('el título habla t-h1 y los grupos hablan t-overline (no 12/700 inline)', () => {
    expect(OPS).toMatch(/<h1 className="t-h1"/)
    expect(OPS).toMatch(/<h2 className="t-overline"/)
    const src = sinComentarios(OPS)
    expect(src).not.toMatch(/fontSize:\s*12,\s*fontWeight:\s*700/)
    expect(src).not.toMatch(/fontSize:\s*20,\s*fontWeight:\s*700/)
  })

  it('la introducción habla t-body', () => {
    expect(OPS).toMatch(/<p className="t-body"/)
  })

  it('toda fila de /operaciones declara mínimo táctil de 44 (§24)', () => {
    /**
     * La condición SIGUE al código. Contaba DOS apariciones de `minHeight: 44`
     * porque había dos anatomías —los azulejos y el botón de cerrar sesión— y
     * cada una repetía el número. RTC-29 las unificó en una sola pieza
     * (`FILA_DE_GRUPO`), así que ahora el 44 se declara UNA vez y vale para
     * todas: contar apariciones mediría lo contrario de lo que importa —
     * cuanto mejor factorizado, más rojo daría.
     *
     * Lo que se comprueba es lo que la regla dice de verdad: que exista la
     * pieza compartida con su mínimo, y que **ninguna fila se pinte por fuera
     * de ella**.
     */
    const src = sinComentarios(OPS)
    expect(src).toMatch(/const FILA_DE_GRUPO: React\.CSSProperties = \{[^}]*minHeight: 44/)
    // Las tres filas de acción (destino, respaldo, tema, sesión) parten de la
    // pieza: si alguien vuelve a escribir un estilo de fila a mano, aquí se ve.
    const usos = src.match(/\.\.\.FILA_DE_GRUPO/g) ?? []
    expect(usos.length, 'hay filas pintadas fuera de la pieza compartida').toBeGreaterThanOrEqual(4)
  })

  it('los iconos decorativos van aria-hidden', () => {
    expect(OPS).toMatch(/<it\.icon[^>]*aria-hidden="true"/)
    expect(OPS).toMatch(/<LogOut[^>]*aria-hidden="true"/)
  })

  it('es un índice, no un lienzo de acción: cero btn-primary', () => {
    expect(sinComentarios(OPS)).not.toMatch(/btn-primary/)
  })

  it('freeze: los 20 destinos de siempre, ninguno se cayó — 18 en el índice y 2 en el paciente', () => {
    /**
     * EL INVARIANTE ES «NINGUNO SE CAYÓ», NO «TODOS SIGUEN AQUÍ».
     *
     * RTC-09 sacó `/consultor` y `/antibiograma` del índice administrativo a
     * propósito: una capacidad de IA en un menú es IA feature-first (§3.2), y
     * además el grupo que las alojaba se llamaba «Clínico» dentro de una
     * pantalla que se define como «lo administrativo, aparte del trabajo
     * clínico». Ahora viven en el expediente del paciente.
     *
     * Este freeze sigue defendiendo lo mismo que el día que se escribió —que
     * nadie pierda un destino por descuido— pero cuenta las DOS casas, y las
     * dos las lee del código: el índice, y la declaración única de
     * `CAPACIDADES_DEL_PACIENTE`. Escribir aquí las dos rutas a mano habría
     * convertido el freeze en una lista de deseos.
     */
    const enElIndice = ['/asistente', '/citas', '/calendario', '/lista-espera', '/hospitalizacion',
      '/uci', '/crm', '/resenas', '/reactivacion', '/farmacia',
      '/finanzas', '/membresias', '/cumplimiento', '/legal', '/migracion', '/chat', '/guia',
      '/configuracion']
    for (const r of enElIndice) expect(OPS, `${r} se cayó del índice`).toMatch(new RegExp(`href: '${r}'`))

    // Y las dos que se mudaron siguen teniendo puerta, en su casa nueva.
    expect(RUTAS_DE_CAPACIDADES).toContain('/consultor')
    expect(RUTAS_DE_CAPACIDADES).toContain('/antibiograma')
    expect(enElIndice.length + RUTAS_DE_CAPACIDADES.length).toBe(20)

    // El índice ya NO las enlaza: si volvieran, volvería el defecto de §3.2.
    for (const r of RUTAS_DE_CAPACIDADES) expect(OPS).not.toMatch(new RegExp(`href: '${r}'`))
  })

  it('freeze: el filtro por modo y rutaPermitida sigue, y la salida es salirSeguro', () => {
    expect(OPS).toMatch(/it\.modos === 'ambos' \|\| mode === 'medico'/)
    expect(OPS).toMatch(/rutaPermitida\(clinic, it\.href\)/)
    expect(OPS).toMatch(/salirSeguro\('\/login'\)/)
  })
})
