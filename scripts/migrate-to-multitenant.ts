/**
 * Migration script: flat collections → clinics/{clinicId}/subcollections
 *
 * Run ONCE with:
 *   npx ts-node --project tsconfig.node.json scripts/migrate-to-multitenant.ts
 *
 * What it does:
 *   1. Reads old flat collections (appointments, patients, waitlist, config, doctors)
 *   2. Creates a clinic document for the existing owner
 *   3. Creates clinic_members entry for the owner
 *   4. Copies all documents to clinics/{clinicId}/subcollection
 *   5. Does NOT delete old data (safe, manual cleanup after verifying)
 */

import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const serviceAccount = {
  projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
  clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
}

initializeApp({ credential: cert(serviceAccount as any) })
const db = getFirestore()

const OWNER_UID   = process.env.MIGRATION_OWNER_UID!   // Firebase UID of Dr. David
const OWNER_EMAIL = process.env.MIGRATION_OWNER_EMAIL! // docrod29@gmail.com

async function migrate() {
  if (!OWNER_UID || !OWNER_EMAIL) {
    console.error('Set MIGRATION_OWNER_UID and MIGRATION_OWNER_EMAIL in .env.local')
    process.exit(1)
  }

  console.log('🚀 Starting multi-tenant migration...')

  // ── 1. Read old config ─────────────────────────────────────
  const oldConfigSnap = await db.collection('config').doc('main').get()
  const oldConfig = oldConfigSnap.exists ? oldConfigSnap.data()! : {}
  const nombreMedico  = oldConfig.nombreMedico  || 'Dr. David Rodríguez'
  const nombreClinica = oldConfig.nombreClinica || 'Consultorio de Infectología'

  console.log(`📋 Clinic: ${nombreClinica} / ${nombreMedico}`)

  // ── 2. Create clinic ───────────────────────────────────────
  const now = new Date().toISOString()
  const clinicRef = db.collection('clinics').doc() // auto-ID
  const clinicId = clinicRef.id

  await clinicRef.set({
    nombreClinica,
    nombreMedico,
    plan: 'pro',
    status: 'active',
    ownerId: OWNER_UID,
    createdAt: now,
    updatedAt: now,
  })
  console.log(`✅ Created clinic: ${clinicId}`)

  // ── 3. Create clinic_member for owner ─────────────────────
  await db.collection('clinic_members').doc(OWNER_UID).set({
    clinicId,
    role: 'admin',
    createdAt: now,
  })
  console.log(`✅ Created membership for ${OWNER_EMAIL}`)

  // ── 4. Copy config ─────────────────────────────────────────
  if (oldConfigSnap.exists) {
    await db.collection('clinics').doc(clinicId).collection('config').doc('main').set(oldConfig)
    console.log('✅ Copied config')
  }

  // ── 5. Copy appointments ───────────────────────────────────
  const apptSnap = await db.collection('appointments').get()
  let count = 0
  for (const doc of apptSnap.docs) {
    await db.collection('clinics').doc(clinicId).collection('appointments').doc(doc.id).set(doc.data())
    count++
  }
  console.log(`✅ Copied ${count} appointments`)

  // ── 6. Copy patients ───────────────────────────────────────
  const patientSnap = await db.collection('patients').get()
  count = 0
  for (const doc of patientSnap.docs) {
    await db.collection('clinics').doc(clinicId).collection('patients').doc(doc.id).set(doc.data())
    count++
  }
  console.log(`✅ Copied ${count} patients`)

  // ── 7. Copy waitlist ───────────────────────────────────────
  const waitlistSnap = await db.collection('waitlist').get()
  count = 0
  for (const doc of waitlistSnap.docs) {
    await db.collection('clinics').doc(clinicId).collection('waitlist').doc(doc.id).set(doc.data())
    count++
  }
  console.log(`✅ Copied ${count} waitlist entries`)

  // ── 8. Copy doctors ────────────────────────────────────────
  const doctorsSnap = await db.collection('doctors').get()
  count = 0
  for (const doc of doctorsSnap.docs) {
    await db.collection('clinics').doc(clinicId).collection('doctors').doc(doc.id).set(doc.data())
    count++
  }
  console.log(`✅ Copied ${count} doctors`)

  // ── Done ───────────────────────────────────────────────────
  console.log('')
  console.log('🎉 Migration complete!')
  console.log(`   Clinic ID: ${clinicId}`)
  console.log('')
  console.log('Next steps:')
  console.log('  1. Add to .env.local: MIGRATION_CLINIC_ID=' + clinicId)
  console.log('  2. Test the app — verify data appears correctly')
  console.log('  3. After verifying, delete old flat collections manually in Firebase Console')
  console.log('     (appointments, patients, waitlist, config, doctors)')
}

migrate().catch(err => {
  console.error('Migration failed:', err)
  process.exit(1)
})
