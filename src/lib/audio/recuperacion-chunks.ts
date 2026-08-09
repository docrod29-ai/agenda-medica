/**
 * ALMACÉN DE TROZOS DE AUDIO PARA RECUPERACIÓN — IndexedDB.
 *
 * Vivía dentro de `useGrabacionAudio.ts`, privado del hook. Sale aquí porque
 * **no se podía probar**: el hook arrastra React, Firebase y el pipeline de ASR,
 * y la suite corre en `node`. Lo único que hay debajo de estas funciones son
 * APIs del navegador, así que aisladas se prueban contra un IndexedDB de verdad.
 *
 * No es una capa nueva: es el mismo código movido. La aritmética de rangos que
 * decide qué se borra es lo que costó una consulta entera (REG-271) y no puede
 * quedarse sin red debajo.
 */

const DB_NAME = 'nexusmed-recovery'
const STORE = 'audio_chunks'

export function abrirDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: ['recoveryKey', 'idx'] })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function guardarChunk(recoveryKey: string, idx: number, blob: Blob) {
  try {
    const db = await abrirDB()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put({ recoveryKey, idx, blob, ts: Date.now() })
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  } catch {
    // IndexedDB puede fallar en modo privado — no es bloqueante
  }
}

export async function leerChunks(recoveryKey: string): Promise<Blob[]> {
  try {
    const db = await abrirDB()
    const chunks: { idx: number; blob: Blob }[] = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const range = IDBKeyRange.bound([recoveryKey, 0], [recoveryKey, Number.MAX_SAFE_INTEGER])
      const req = tx.objectStore(STORE).getAll(range)
      req.onsuccess = () => resolve(req.result ?? [])
      req.onerror = () => reject(req.error)
    })
    db.close()
    return chunks.sort((a, b) => a.idx - b.idx).map(c => c.blob)
  } catch {
    return []
  }
}

/**
 * BORRA LOS TROZOS DE `recoveryKey` **DESDE `desde` EN ADELANTE**.
 *
 * ── POR QUÉ EL PARÁMETRO `desde` EXISTE (REG-271) ────────────────────────────
 *
 * Borraba siempre el rango COMPLETO (`0 … MAX_SAFE_INTEGER`). Y una misma llave
 * —`consulta-{patientId}`, estable para ese paciente— puede llevar encima audio
 * de MÁS de una sesión de grabación: si una grabación anterior quedó huérfana
 * (se navegó fuera y nadie llamó a `detener()`), la siguiente arranca su índice
 * DESPUÉS de ella para no pisarla (`recoveryBaseRef`).
 *
 * El caso real: grabar 22 min → tocar «Agenda» → volver → grabar 90 s →
 * detener. El blob que se transcribe lleva **sólo los 90 s** —son los únicos
 * trozos de esta sesión en memoria—, pero el borrado se llevaba también los
 * 22 min, que nunca pasaron por ningún transcriptor. Pérdida permanente de una
 * consulta entera, en silencio, y justo después de una transcripción exitosa.
 *
 * El autor ya había protegido al huérfano **al grabar**; lo que no se actualizó
 * fue el borrado. Media defensa protege la mitad de las veces.
 *
 * `desde = 0` sigue siendo el borrado completo, y es lo correcto para quien SÍ
 * leyó todo: el botón «Descartar audio guardado» y la recuperación manual, que
 * transcriben el rango entero.
 */
export async function borrarChunks(recoveryKey: string, desde = 0) {
  try {
    const db = await abrirDB()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      const range = IDBKeyRange.bound([recoveryKey, desde], [recoveryKey, Number.MAX_SAFE_INTEGER])
      tx.objectStore(STORE).delete(range)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  } catch { /* */ }
}
