import * as admin from 'firebase-admin'

if (!admin.apps.length) {
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY
    ? process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n')
    : undefined

  if (process.env.FIREBASE_ADMIN_CLIENT_EMAIL && privateKey) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey,
      }),
    })
  } else {
    // Dev: usar Application Default Credentials o sin auth (solo Firestore emulator)
    admin.initializeApp({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    })
  }
}

export const adminDb = admin.firestore()
// Blindaje global: Firestore Admin RECHAZA valores undefined ("Unsupported
// field value"). Esto los ignora en TODA escritura del servidor, igual que
// sinUndefined() hace en el cliente. Evita que un solo campo undefined
// (email vacío, medicoId ausente, etc.) aborte una operación completa.
try { adminDb.settings({ ignoreUndefinedProperties: true }) } catch { /* ya configurado */ }
export default admin
