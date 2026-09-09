import type { ReactNode } from 'react'
import styles from './consulta-workspace.module.css'
import { CONSULTA_WORKSPACE } from './consulta-workspace-textos'

/**
 * Una presentación del encuentro existente. Las regiones permanecen montadas:
 * cambiar de sección no reinicia el grabador, el editor ni el copiloto.
 * Las tres áreas se muestran juntas cuando hay espacio para leerlas.
 */
export function ConsultaWorkspace({ contexto, nota, asistente, firmada, children }: {
  contexto: ReactNode
  nota: ReactNode
  asistente: ReactNode
  firmada: boolean
  children?: ReactNode
}) {
  const t = CONSULTA_WORKSPACE
  return (
    <div className={styles.workspace}>
      <nav className={styles.navigation} aria-label={t.navegacion}>
        <a href="#consulta-contexto"><span aria-hidden="true">01</span>{t.resumen}</a>
        <a href="#consulta-nota"><span aria-hidden="true">02</span>{t.nota}</a>
        <a href="#consulta-asistente"><span aria-hidden="true">03</span>{t.asistente}</a>
      </nav>
      <div className={styles.grid}>
        <section id="consulta-contexto" tabIndex={-1} aria-labelledby="consulta-contexto-titulo" className={styles.contexto}>
          <header className={styles.regionHeader}>
            <span className={styles.eyebrow}>{t.contexto}</span>
            <h2 id="consulta-contexto-titulo">{t.resumenPaciente}</h2>
            <p>{t.continuidad}</p>
          </header>
          {contexto}
        </section>
        <section id="consulta-nota" tabIndex={-1} aria-labelledby="consulta-nota-titulo" className={styles.nota}>
          <header className={styles.noteHeader}>
            <div>
              <span className={styles.eyebrow}>{t.encuentro}</span>
              <h2 id="consulta-nota-titulo">{t.consultaNota}</h2>
            </div>
            <span className={styles.documentState} data-signed={firmada}>{firmada ? t.firmada : t.borrador}</span>
          </header>
          {nota}
        </section>
        <aside id="consulta-asistente" tabIndex={-1} aria-labelledby="consulta-asistente-titulo" className={styles.asistente}>
          <header className={styles.regionHeader}>
            <span className={styles.eyebrow}>{t.apoyo}</span>
            <h2 id="consulta-asistente-titulo">{t.asistenteClinico}</h2>
            <p>{t.revision}</p>
          </header>
          {asistente}
        </aside>
        <div className={styles.cierre}>{children}</div>
      </div>
    </div>
  )
}
