/**
 * POST /api/admin/migrate
 *
 * One-time migration: flat collections → clinics/{clinicId}/subcollections
 * Protected by ADMIN_MIGRATE_SECRET env var.
 *
 * Run once:
 *   curl -X POST https://agenda-medica-one.vercel.app/api/admin/migrate \
 *     -H "Content-Type: application/json" \
 *     -d '{"secret":"YOUR_SECRET","ownerEmail":"docrod29@gmail.com"}'
 *
 * DELETE THIS FILE after migration is complete.
 */

import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { getAuth } from 'firebase-admin/auth'

const MIGRATE_SECRET = process.env.ADMIN_MIGRATE_SECRET

export async function POST(req: NextRequest) {
  if (!MIGRATE_SECRET) {
    return NextResponse.json({ error: 'Migration not configured' }, { status: 403 })
  }

  try {
    const { secret, ownerEmail } = await req.json()

    if (secret !== MIGRATE_SECRET) {
      return NextResponse.json({ error: 'Invalid secret' }, { status: 401 })
    }

    if (!ownerEmail) {
      return NextResponse.json({ error: 'ownerEmail required' }, { status: 400 })
    }

    // ── Check if migration already ran ────────────────────────
    const existingClinics = await adminDb.collection('clinics').limit(1).get()
    if (!existingClinics.empty) {
      return NextResponse.json({
        skipped: true,
        message: 'Migration already ran — clinics collection exists',
        clinicId: existingClinics.docs[0].id,
      })
    }

    // ── Find owner UID ─────────────────────────────────────────
    let ownerUid: string
    try {
      const userRecord = await getAuth().getUserByEmail(ownerEmail)
      ownerUid = userRecord.uid
    } catch (err) {
      return NextResponse.json({ error: `User not found: ${ownerEmail}` }, { status: 404 })
    }

    // ── Read old config ────────────────────────────────────────
    const oldConfigSnap = await adminDb.collection('config').doc('main').get()
    const oldConfig = oldConfigSnap.exists ? oldConfigSnap.data()! : {}
    const nombreMedico  = oldConfig.nombreMedico  || 'Dr. David Rodríguez'
    const nombreClinica = oldConfig.nombreClinica || 'Consultorio Médico'
    const now = new Date().toISOString()

    // ── Create clinic ──────────────────────────────────────────
    const clinicRef = adminDb.collection('clinics').doc()
    const clinicId = clinicRef.id

    await clinicRef.set({
      nombreClinica,
      nombreMedico,
      plan: 'pro',
      status: 'active',
      ownerId: ownerUid,
      createdAt: now,
      updatedAt: now,
    })

    // ── Create owner membership ────────────────────────────────
    await adminDb.collection('clinic_members').doc(ownerUid).set({
      clinicId,
      role: 'admin',
      createdAt: now,
    })

    const results: Record<string, number> = {}

    // ── Copy config ────────────────────────────────────────────
    if (oldConfigSnap.exists) {
      await adminDb.collection('clinics').doc(clinicId).collection('config').doc('main').set(oldConfig)
    }

    // ── Copy appointments ──────────────────────────────────────
    const apptSnap = await adminDb.collection('appointments').get()
    for (const d of apptSnap.docs) {
      await adminDb.collection('clinics').doc(clinicId).collection('appointments').doc(d.id).set(d.data())
    }
    results.appointments = apptSnap.size

    // ── Copy patients ──────────────────────────────────────────
    const patientSnap = await adminDb.collection('patients').get()
    for (const d of patientSnap.docs) {
      await adminDb.collection('clinics').doc(clinicId).collection('patients').doc(d.id).set(d.data())
    }
    results.patients = patientSnap.size

    // ── Copy waitlist ──────────────────────────────────────────
    const waitlistSnap = await adminDb.collection('waitlist').get()
    for (const d of waitlistSnap.docs) {
      await adminDb.collection('clinics').doc(clinicId).collection('waitlist').doc(d.id).set(d.data())
    }
    results.waitlist = waitlistSnap.size

    // ── Copy doctors ───────────────────────────────────────────
    const doctorsSnap = await adminDb.collection('doctors').get()
    for (const d of doctorsSnap.docs) {
      await adminDb.collection('clinics').doc(clinicId).collection('doctors').doc(d.id).set(d.data())
    }
    results.doctors = doctorsSnap.size

    return NextResponse.json({
      ok: true,
      clinicId,
      ownerUid,
      nombreClinica,
      ...results,
      message: 'Migration complete! Old collections preserved — delete manually after verifying.',
    })
  } catch (err) {
    console.error('[Migrate] Error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
