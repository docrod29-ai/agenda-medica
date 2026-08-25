#!/usr/bin/env bash
set -euo pipefail

git config user.name "ausculta-repair-bot"
git config user.email "actions@users.noreply.github.com"

# GP9 — port the validated idempotency commit onto current Consultorio.
if ! git cherry-pick 88d53eeda0cf1d12a917b15d8f66fb8bf3cadb6c; then
  mapfile -t conflicts < <(git diff --name-only --diff-filter=U)
  printf 'GP9 conflicts: %s\n' "${conflicts[*]}"
  for f in "${conflicts[@]}"; do
    case "$f" in
      src/lib/expediente/firestore.ts|docs/design/SCREEN_INVENTORY.md)
        git checkout --ours -- "$f"
        git add -- "$f"
        ;;
      *) echo "Unexpected GP9 conflict: $f" >&2; exit 31 ;;
    esac
  done
  python3 - <<'PY'
from pathlib import Path
p=Path('src/lib/expediente/firestore.ts')
s=p.read_text()
if 'runTransaction' not in s.split("from 'firebase/firestore'")[0]:
    s=s.replace('query, orderBy, where, writeBatch,', 'query, orderBy, where, writeBatch, runTransaction,', 1)
if "@/lib/idempotencia" not in s:
    s=s.replace("import { logAudit } from './audit-log'", "import { logAudit } from './audit-log'\nimport { idIdempotente } from '@/lib/idempotencia'", 1)
if 'export interface OpcionesCrearNota' not in s:
    marker='export async function createNota('
    assert marker in s
    s=s.replace(marker, "export interface OpcionesCrearNota {\n  /** Clave estable del encuentro para converger reintentos sobre un solo borrador. */\n  claveEncuentro?: string\n}\n\n"+marker, 1)
old="  data: Omit<NotaMedica, 'id'>,\n): Promise<string> {"
if 'opciones: OpcionesCrearNota = {}' not in s:
    assert old in s
    s=s.replace(old, "  data: Omit<NotaMedica, 'id'>,\n  opciones: OpcionesCrearNota = {},\n): Promise<string> {", 1)
if "idIdempotente(clinicId, 'nota', opciones.claveEncuentro)" not in s:
    marker='  const ref = await addDoc(notasCol(clinicId, patientId), payload)'
    assert marker in s
    block="""  // GP9: una intención lógica converge sobre un solo borrador.\n  if (opciones.claveEncuentro) {\n    const id = idIdempotente(clinicId, 'nota', opciones.claveEncuentro)\n    const ref = notaDoc(clinicId, patientId, id)\n    const yaFirmada = await runTransaction(db, async (tx) => {\n      const dentro = await tx.get(ref)\n      if (!dentro.exists()) { tx.set(ref, payload); return false }\n      return dentro.data()?.estado === 'firmada'\n    })\n    if (!yaFirmada) return id\n  }\n\n"""
    s=s.replace(marker, block+marker, 1)
p.write_text(s)
PY
  git add src/lib/expediente/firestore.ts
  GIT_EDITOR=true git cherry-pick --continue
fi

# GP12 — port physician-facing routing contract; keep current screen inventory.
if ! git cherry-pick 36ae93a1e46f488f455632a8667e2dec99a3e1ae; then
  mapfile -t conflicts < <(git diff --name-only --diff-filter=U)
  printf 'GP12 conflicts: %s\n' "${conflicts[*]}"
  for f in "${conflicts[@]}"; do
    case "$f" in
      'src/app/(dashboard)/consulta/[patientId]/page.tsx'|docs/design/SCREEN_INVENTORY.md)
        git checkout --ours -- "$f"; git add -- "$f" ;;
      *) echo "Unexpected GP12 conflict: $f" >&2; exit 32 ;;
    esac
  done
  python3 - <<'PY'
from pathlib import Path
p=Path('src/app/(dashboard)/consulta/[patientId]/page.tsx')
s=p.read_text()
old="""// Menú de IA: motores que el médico elige por nota (⚡ barato → 💎 máximo).\nconst MOTORES_UI: { clave: ClaveMotor; emoji: string; nombre: string; creditos: number; desc: string }[] = [\n  { clave: 'rapida',   emoji: '⚡', nombre: 'Rápida',   creditos: MOTORES.rapida.creditos,   desc: 'Haiku · seguimiento simple' },\n  { clave: 'estandar', emoji: '⭐', nombre: 'Estándar', creditos: MOTORES.estandar.creditos, desc: 'Sonnet + voces · el día a día' },\n  { clave: 'maxima',   emoji: '💎', nombre: 'Máxima',   creditos: MOTORES.maxima.creditos,   desc: 'Opus + GPT-5 · caso complejo' },\n]"""
new="""// El médico elige intención clínica; proveedor/modelo queda en ruteo y procedencia interna.\nconst MOTORES_UI: { clave: ClaveMotor; emoji: string; nombre: string; creditos: number; desc: string }[] =\n  (['rapida', 'estandar', 'maxima'] as const).map(k => ({\n    clave: k, emoji: MOTORES[k].emoji, nombre: MOTORES[k].nombre,\n    creditos: MOTORES[k].creditos, desc: MOTORES[k].usoRecomendado,\n  }))"""
if old in s: s=s.replace(old,new,1)
s=s.replace('Motor de IA para esta nota','Nivel de IA para esta nota')
s=s.replace('Capta a los dos · separación de voces con AssemblyAI · vocabulario médico ampliado','Capta a los dos · separación de voces · vocabulario médico ampliado')
s=s.replace('(Sonnet 5 — muy buena) y sin separación de voces. <b>Nunca te quedas sin IA.</b> Para\n            recuperar la IA máxima (Opus 4.8 + GPT-5 + separación médico-paciente) compra más créditos.', '—redacta y estructura igual, pero sin separación de voces ni segunda revisión.\n            <b>Nunca te quedas sin IA.</b> Para recuperar la IA máxima (máximo razonamiento,\n            segunda revisión y separación médico-paciente) compra más créditos.')
p.write_text(s)
PY
  git add 'src/app/(dashboard)/consulta/[patientId]/page.tsx'
  GIT_EDITOR=true git cherry-pick --continue
fi

# GP6 — every AI reprojection/recovery crosses canonical diagnosis/medication boundaries.
python3 - <<'PY'
from pathlib import Path
p=Path('src/app/(dashboard)/consulta/[patientId]/page.tsx')
s=p.read_text()
repls=[
("""      if (tipoOverride) {\n        // RE-PROYECCIÓN a otra modalidad de nota: se parte de plantilla limpia a propósito.\n        setDiagnosticos(nuevosDx)\n        dxDeLaIaRef.current = nuevosDx\n      } else if (nuevosDx.length > 0) {""",
"""      if (tipoOverride) {\n        // GP6: re-proyección cruza la frontera canónica; sugerir no confirma ni codifica.\n        setDiagnosticos(fusionarDiagnosticos({ previos: [], nuevos: nuevosDx, deLaIaAnterior: [] }))\n        dxDeLaIaRef.current = nuevosDx\n      } else if (nuevosDx.length > 0) {"""),
("""      if (tipoOverride) {\n        setMedicamentos(nuevosMed)\n        medDeLaIaRef.current = nuevosMed\n      } else if (nuevosMed.length > 0) {""",
"""      if (tipoOverride) {\n        // GP6/GP5: re-proyectar no convierte extracción automática en prescripción.\n        setMedicamentos(fusionarMedicamentos({ previos: [], nuevos: nuevosMed, deLaIaAnterior: [] }))\n        medDeLaIaRef.current = nuevosMed\n      } else if (nuevosMed.length > 0) {"""),
("""    if (tipoOverride) setDiagnosticos(nuevosDx)   // re-proyección: plantilla limpia\n    else if (nuevosDx.length > 0) {""",
"""    if (tipoOverride) {\n      setDiagnosticos(fusionarDiagnosticos({ previos: [], nuevos: nuevosDx, deLaIaAnterior: [] }))\n      dxDeLaIaRef.current = nuevosDx\n    } else if (nuevosDx.length > 0) {"""),
("""    if (tipoOverride) { setMedicamentos(nuevosMed); medDeLaIaRef.current = nuevosMed }\n    else if (nuevosMed.length > 0) {""",
"""    if (tipoOverride) {\n      setMedicamentos(fusionarMedicamentos({ previos: [], nuevos: nuevosMed, deLaIaAnterior: [] }))\n      medDeLaIaRef.current = nuevosMed\n    } else if (nuevosMed.length > 0) {""")]
for old,new in repls:
    assert old in s, 'GP6 expected bypass shape changed'
    s=s.replace(old,new,1)
p.write_text(s)
PY

cat > src/__tests__/gp6-reproyeccion-cruza-fronteras.test.ts <<'EOF'
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fusionarDiagnosticos } from '@/lib/expediente/fusionar-diagnosticos'
import { fusionarMedicamentos, loQueSeReceta } from '@/lib/expediente/que-va-en-la-receta'

describe('GP6: re-proyección y recuperación cruzan las fronteras clínicas', () => {
  it('IA definitiva/CIE entra no confirmada y sin CIE', () => {
    const [d] = fusionarDiagnosticos({ previos: [], deLaIaAnterior: [], nuevos: [
      { descripcion: 'Neumonía adquirida en comunidad', tipo: 'definitivo', estado: 'activo', codigoCIE10: 'J18.9' },
    ] })
    expect(d.tipo).toBe('presuntivo')
    expect(d.codigoCIE10).toBeUndefined()
  })
  it('medicamento IA sin intención explícita no cruza a receta', () => {
    const meds = fusionarMedicamentos({ previos: [], deLaIaAnterior: [], nuevos: [
      { nombre: 'Amoxicilina', dosis: '500 mg', via: 'oral', frecuencia: 'cada 8 horas', duracion: '7 días' },
    ] })
    expect(meds[0].estado).toBe('borrador')
    expect(loQueSeReceta(meds)).toHaveLength(0)
  })
  it('no quedan setters directos en los caminos tipoOverride', () => {
    const src=readFileSync(resolve(process.cwd(),'src/app/(dashboard)/consulta/[patientId]/page.tsx'),'utf8')
    expect(src).not.toContain('setDiagnosticos(nuevosDx)\n        dxDeLaIaRef.current = nuevosDx')
    expect(src).not.toContain('setMedicamentos(nuevosMed); medDeLaIaRef.current = nuevosMed')
    expect((src.match(/fusionarDiagnosticos\(\{ previos: \[\], nuevos: nuevosDx/g) ?? []).length).toBeGreaterThanOrEqual(2)
    expect((src.match(/fusionarMedicamentos\(\{ previos: \[\], nuevos: nuevosMed/g) ?? []).length).toBeGreaterThanOrEqual(2)
  })
})
EOF

git add 'src/app/(dashboard)/consulta/[patientId]/page.tsx' src/__tests__/gp6-reproyeccion-cruza-fronteras.test.ts
git commit -m 'fix(consultorio): close GP6 reprojection bypasses'

npm ci
npx vitest run \
  src/__tests__/gp6-reproyeccion-cruza-fronteras.test.ts \
  src/__tests__/gp9-idempotencia-de-la-intencion.test.ts \
  src/__tests__/gp9-alta-de-cita-no-duplica.test.ts \
  src/__tests__/cita-reintento-no-duplica.test.ts \
  src/__tests__/el-medico-no-elige-marca.test.ts
npx tsc --noEmit

git push origin HEAD:product/consultorio-core-001
