import type { ClinicalInput } from '@/lib/clinical-truth'

export type VoiceLanguage = 'es' | 'en' | 'spanglish'
export type TranscriptStatus = 'partial' | 'final'

export interface TranscriptAlternative { readonly text: string; readonly confidence?: number }
/** Revision lineage keeps what it replaced: text, the confidence that was supplied with it, and the competing hypotheses. */
export interface TranscriptRevision {
  readonly previousText: string; readonly revisedText: string; readonly revisedAt: string; readonly reason: 'provider_revision' | 'contextual_correction' | 'clinician_correction'
  readonly previousConfidence?: number; readonly previousAlternatives?: readonly TranscriptAlternative[]
}
/** The only auditable path out of an unresolved review: a named actor selecting among hypotheses that were actually heard. */
export interface TranscriptReviewResolution {
  readonly resolvedAt: string; readonly resolvedBy: string; readonly previousText: string; readonly resolvedText: string; readonly rationale: string
  readonly previousConfidence?: number; readonly previousAlternatives?: readonly TranscriptAlternative[]
}
export interface TranscriptSegment {
  readonly id: string; readonly sequence: number; readonly text: string; readonly status: TranscriptStatus; readonly receivedAt: string; readonly finalizedAt?: string
  readonly speaker?: string; readonly confidence?: number; readonly alternatives?: readonly TranscriptAlternative[]; readonly needsReview: boolean; readonly revisions: readonly TranscriptRevision[]
  readonly reviewResolutions?: readonly TranscriptReviewResolution[]
}
export interface VoiceSession {
  readonly id: string; readonly encounterId: string; readonly provider: string; readonly language: VoiceLanguage; readonly startedAt: string
  readonly firstPartialReceivedAt?: string; readonly segments: readonly TranscriptSegment[]
}
export interface VoiceMetrics { readonly timeToFirstPartialMs?: number; readonly timeToFinalMs?: number; readonly revisionCount: number; readonly unresolvedReviewCount: number }

export type VoiceBenchmarkTermKind = 'clinical_term'|'medication'|'dose'|'negation'|'numeric_lab'|'specialty_term'|'code_switching'
export interface VoiceBenchmarkCriticalTerm { readonly value: string; readonly kind: VoiceBenchmarkTermKind }
export interface VoiceBenchmarkCase {
  readonly id: string; readonly reference: string; readonly hypothesis: string; readonly criticalTerms: readonly VoiceBenchmarkCriticalTerm[]
  readonly timeToFirstPartialMs?: number; readonly timeToFinalMs?: number; readonly revisionCount: number; readonly unresolvedReviewCount: number; readonly forcedRepeatCount: number
  readonly clinicallySignificantReferenceCount?: number; readonly clinicallySignificantOmissionSubstitutionCount?: number; readonly hallucinatedContentCount?: number
  /** Denominator for forced repeats: physician utterances captured in this case. Without it the rate stays undefined. */
  readonly physicianUtteranceCount?: number
  /** Contextual correction / recovery quality: utterances the engine had a chance to repair from context, and how many it repaired correctly. */
  readonly contextualRecoveryOpportunityCount?: number; readonly contextualRecoveredCount?: number
  readonly physicianEditTimeMs?: number; readonly physicianSatisfactionScore?: number
}
export interface VoiceBenchmarkResult {
  readonly caseId: string; readonly wordErrorRate: number
  /**
   * Clinical error rates exist only where the corpus actually measured that dimension. A case with no
   * medication term did not achieve a perfect medication rate — it has none. Absence stays `undefined`.
   */
  readonly criticalTermErrorRate?: number; readonly medicationErrorRate?: number; readonly doseErrorRate?: number; readonly negationErrorRate?: number
  readonly numericLabErrorRate?: number; readonly specialtyTerminologyErrorRate?: number; readonly codeSwitchingErrorRate?: number
  readonly clinicallySignificantOmissionSubstitutionRate?: number; readonly hallucinatedContentRate?: number
  readonly timeToFirstPartialMs?: number; readonly timeToFinalMs?: number; readonly correctionBurden: number; readonly unresolvedReviewCount: number; readonly forcedRepeatCount: number
  readonly forcedRepeatRate?: number; readonly contextualRecoveryRate?: number
  readonly physicianEditTimeMs?: number; readonly physicianSatisfactionScore?: number
}

export interface VoiceClinicalSegmentProvenance {
  readonly id: string; readonly sequence: number; readonly receivedAt: string; readonly finalizedAt?: string; readonly speaker?: string; readonly confidence?: number
  readonly alternatives?: readonly TranscriptAlternative[]; readonly needsReview: boolean; readonly revisions: readonly TranscriptRevision[]
  readonly reviewResolutions?: readonly TranscriptReviewResolution[]
}
export interface VoiceClinicalInput extends ClinicalInput {
  readonly voiceProvenance: { readonly sessionId: string; readonly provider: string; readonly needsReview: boolean; readonly segments: readonly VoiceClinicalSegmentProvenance[] }
}

function assertTimestamp(value: string, field: string): number { const parsed=Date.parse(value); if(!value||Number.isNaN(parsed)) throw new Error(`${field} must be a valid timestamp`); return parsed }
function assertConfidence(value: number|undefined): void { if(value!==undefined&&(value<0||value>1)) throw new Error('confidence must be between 0 and 1') }
function assertNonNegative(value: number|undefined, field: string): void { if(value!==undefined&&(!Number.isFinite(value)||value<0)) throw new Error(`${field} must be non-negative`) }
function freezeAlternatives(values: readonly TranscriptAlternative[]|undefined): readonly TranscriptAlternative[]|undefined { return values ? Object.freeze(values.map(v=>Object.freeze({...v}))) : undefined }
function freezeRevisions(values: readonly TranscriptRevision[]): readonly TranscriptRevision[] { return Object.freeze(values.map(v=>Object.freeze({...v, previousAlternatives:freezeAlternatives(v.previousAlternatives)}))) }
function freezeResolutions(values: readonly TranscriptReviewResolution[]|undefined): readonly TranscriptReviewResolution[]|undefined { return values ? Object.freeze(values.map(v=>Object.freeze({...v, previousAlternatives:freezeAlternatives(v.previousAlternatives)}))) : undefined }
function freezeSegment(segment: TranscriptSegment): TranscriptSegment { return Object.freeze({...segment, alternatives:freezeAlternatives(segment.alternatives), revisions:freezeRevisions(segment.revisions), reviewResolutions:freezeResolutions(segment.reviewResolutions)}) }
function freezeSession(session: VoiceSession): VoiceSession { return Object.freeze({...session, segments:Object.freeze(session.segments.map(freezeSegment))}) }
function sortSegments(segments: readonly TranscriptSegment[]): TranscriptSegment[] { return [...segments].sort((a,b)=>a.sequence-b.sequence) }

/** Newest point already recorded on a segment's lineage: arrival, last revision, review resolution, finalization. */
function lineageHeadMs(segment: TranscriptSegment): number {
  let head=assertTimestamp(segment.receivedAt,'receivedAt')
  for(const revision of segment.revisions) head=Math.max(head,assertTimestamp(revision.revisedAt,'revisedAt'))
  for(const resolution of segment.reviewResolutions??[]) head=Math.max(head,assertTimestamp(resolution.resolvedAt,'resolvedAt'))
  if(segment.finalizedAt) head=Math.max(head,assertTimestamp(segment.finalizedAt,'finalizedAt'))
  return head
}
/** A transition dated before the target's own lineage head is a stale artifact being replayed over a newer transcript. */
function assertNotStale(segment: TranscriptSegment, atMs: number, field: string): void {
  if(atMs<lineageHeadMs(segment)) throw new Error(`Stale voice transition rejected: ${field} precedes the newest recorded state of transcript segment ${segment.id}`)
}
/**
 * A segment carries unresolved ambiguity while more than one distinct hypothesis is on the table for the same
 * audio. Competing hypotheses are a fact about what was heard, so they FORCE review; only an explicit
 * resolution may take them off the table.
 */
function hasCompetingAlternatives(text: string, alternatives: readonly TranscriptAlternative[]|undefined): boolean {
  if(!alternatives?.length) return false
  const distinct=new Set(alternatives.map(a=>a.text.trim().toLocaleLowerCase('es-MX')).filter(Boolean))
  distinct.add(text.trim().toLocaleLowerCase('es-MX'))
  return distinct.size>1
}
/**
 * Confidence survives a transition only while the text it scored survives it. A different hypothesis is a
 * different measurement: it is unknown until the provider or the clinician scores THAT text.
 */
function confidenceCarriesOver(previousText: string, nextText: string): boolean { return previousText.trim()===nextText.trim() }
/** An unresolved review may only be cleared through `resolveTranscriptReview`, never as a side effect of a transition. */
function assertReviewNotSilentlyCleared(segment: TranscriptSegment, requested: boolean|undefined, transition: string): void {
  if(segment.needsReview&&requested===false) throw new Error(`Unresolved transcript review cannot be cleared by ${transition}: resolve segment ${segment.id} through resolveTranscriptReview with an auditable clinician resolution`)
}

const DANGLING_TRANSCRIPT_TAIL=/(?:\.{3}|…|[,;:+&(-])$/u
/**
 * Structural completeness gate for text that may become final ClinicalInput truth.
 *
 * Structural only: it rejects text that carries no content (blank, punctuation/symbol only) or that
 * ends on a dangling connector — the shape of a dictation stream cut mid-utterance. It does NOT and
 * must not judge clinical completeness: whether a complete-looking utterance says enough clinically
 * stays with the clinician and with `needsReview`.
 */
export function isFinalizableTranscriptText(text: string): boolean {
  const trimmed=text.trim()
  if(!trimmed) return false
  if(!/[\p{L}\p{N}]/u.test(trimmed)) return false
  return !DANGLING_TRANSCRIPT_TAIL.test(trimmed)
}

export function createVoiceSession(input: Omit<VoiceSession,'segments'|'firstPartialReceivedAt'>): VoiceSession {
  assertTimestamp(input.startedAt,'startedAt'); if(!input.id.trim()||!input.encounterId.trim()||!input.provider.trim()) throw new Error('Voice session identity, encounter, and provider are required')
  return freezeSession({...input,segments:[]})
}

export function appendTranscriptSegment(session: VoiceSession, segment: Omit<TranscriptSegment,'revisions'|'reviewResolutions'>): VoiceSession {
  const receivedAtMs=assertTimestamp(segment.receivedAt,'receivedAt'); if(segment.finalizedAt) assertTimestamp(segment.finalizedAt,'finalizedAt'); assertConfidence(segment.confidence); segment.alternatives?.forEach(a=>assertConfidence(a.confidence))
  if(!segment.id.trim()||!segment.text.trim()) throw new Error('Transcript segment id and text are required'); if(segment.sequence<0||!Number.isInteger(segment.sequence)) throw new Error('Transcript sequence must be a non-negative integer')
  if(session.segments.some(e=>e.id===segment.id)) throw new Error(`Transcript segment already exists: ${segment.id}`); if(session.segments.some(e=>e.sequence===segment.sequence)) throw new Error(`Transcript sequence already exists: ${segment.sequence}`)
  // Audio cannot arrive before its own session opened: impossible chronology fails closed instead of being clamped later.
  if(receivedAtMs<assertTimestamp(session.startedAt,'startedAt')) throw new Error(`Impossible voice chronology rejected: receivedAt precedes session startedAt for transcript segment ${segment.id}`)
  if(segment.status==='final'&&!segment.finalizedAt) throw new Error('Final transcript segment requires finalizedAt')
  // A final timestamp may only exist after a valid transition to `final`. A partial segment carrying one is a
  // provider contradiction, not a fast segment: it would let a still-revisable hypothesis report time-to-final.
  if(segment.status==='partial'&&segment.finalizedAt) throw new Error(`Partial transcript segment cannot carry finalizedAt: promote transcript segment ${segment.id} through finalizeTranscriptSegment`)
  if(segment.status==='final'){
    if(assertTimestamp(segment.finalizedAt as string,'finalizedAt')<receivedAtMs) throw new Error('Stale voice transition rejected: finalizedAt precedes receivedAt')
    if(!isFinalizableTranscriptText(segment.text)) throw new Error('Structurally incomplete transcript text cannot be appended as final')
  }
  const needsReview=segment.needsReview||hasCompetingAlternatives(segment.text,segment.alternatives)
  const firstPartialReceivedAt=session.firstPartialReceivedAt ?? (segment.status==='partial'?segment.receivedAt:undefined)
  return freezeSession({...session,firstPartialReceivedAt,segments:sortSegments([...session.segments,{...segment,needsReview,revisions:[]}])})
}

export function reviseTranscriptSegment(input:{session:VoiceSession;segmentId:string;revisedText:string;revisedAt:string;reason:TranscriptRevision['reason'];needsReview?:boolean;confidence?:number;alternatives?:readonly TranscriptAlternative[]}):VoiceSession{
  const revisedAtMs=assertTimestamp(input.revisedAt,'revisedAt');assertConfidence(input.confidence);input.alternatives?.forEach(a=>assertConfidence(a.confidence));if(!input.revisedText.trim())throw new Error('Revised transcript text is required')
  const target=input.session.segments.find(s=>s.id===input.segmentId);if(!target)throw new Error(`Unknown transcript segment: ${input.segmentId}`);if(target.status==='final'&&input.reason!=='clinician_correction')throw new Error('Final transcript cannot be silently replaced; use clinician correction lineage')
  assertNotStale(target,revisedAtMs,'revisedAt')
  assertReviewNotSilentlyCleared(target,input.needsReview,'a revision')
  // Being final before the revision does not make the revised text safe to keep final: revalidate the text itself.
  const finalizable=isFinalizableTranscriptText(input.revisedText)
  if(target.status==='final'&&!finalizable)throw new Error('Structurally incomplete revised text cannot remain final; supply complete text or revise the segment while it is still partial')
  const alternatives=input.alternatives??target.alternatives
  const needsReview=target.needsReview||!finalizable||hasCompetingAlternatives(input.revisedText,alternatives)||(input.needsReview??false)
  // Confidence belongs to a hypothesis, not to a segment slot: replacement text may not inherit the score the
  // previous text earned. Unless the caller supplies confidence for the NEW text, it stays unknown; the prior
  // score is not lost, it moves onto the revision lineage as `previousConfidence`.
  const confidence=input.confidence??(confidenceCarriesOver(target.text,input.revisedText)?target.confidence:undefined)
  // What the revision replaces stays recoverable: prior text, the confidence it carried, and the hypotheses it competed with.
  const revision:TranscriptRevision={previousText:target.text,revisedText:input.revisedText,revisedAt:input.revisedAt,reason:input.reason,previousConfidence:target.confidence,previousAlternatives:target.alternatives}
  return freezeSession({...input.session,segments:input.session.segments.map(s=>s.id===input.segmentId?{...s,text:input.revisedText,confidence,alternatives,needsReview,revisions:[...s.revisions,revision]}:s)})
}

export function finalizeTranscriptSegment(input:{session:VoiceSession;segmentId:string;finalizedAt:string;needsReview?:boolean}):VoiceSession{
  const finalizedAtMs=assertTimestamp(input.finalizedAt,'finalizedAt');const target=input.session.segments.find(s=>s.id===input.segmentId);if(!target)throw new Error(`Unknown transcript segment: ${input.segmentId}`);if(target.status==='final')throw new Error('Transcript segment is already final')
  assertNotStale(target,finalizedAtMs,'finalizedAt')
  assertReviewNotSilentlyCleared(target,input.needsReview,'finalization')
  if(!isFinalizableTranscriptText(target.text))throw new Error(`Structurally incomplete transcript segment cannot be promoted to final: ${target.id}`)
  // Finalizing is a transcript-state transition, not a resolution of clinical ambiguity: review can only be raised here.
  const needsReview=target.needsReview||hasCompetingAlternatives(target.text,target.alternatives)||(input.needsReview??false)
  return freezeSession({...input.session,segments:input.session.segments.map(s=>s.id===input.segmentId?{...s,status:'final' as const,finalizedAt:input.finalizedAt,needsReview}:s)})
}

/**
 * The one auditable way an unresolved review is cleared.
 *
 * `resolvedText` must be text that was actually heard — the segment's current text or one of its recorded
 * alternatives — so resolving ambiguity selects among hypotheses and never authors a new one. The replaced
 * hypotheses and confidence stay on the resolution record; the segment stops carrying competing alternatives.
 * On a segment that is already final, resolution may only confirm the current text: switching a final
 * transcript to a different hypothesis stays with `reviseTranscriptSegment`'s clinician-correction lineage.
 * It does not finalize and does not judge clinical completeness.
 */
export function resolveTranscriptReview(input:{session:VoiceSession;segmentId:string;resolvedText:string;resolvedAt:string;resolvedBy:string;rationale:string}):VoiceSession{
  const resolvedAtMs=assertTimestamp(input.resolvedAt,'resolvedAt');const target=input.session.segments.find(s=>s.id===input.segmentId);if(!target)throw new Error(`Unknown transcript segment: ${input.segmentId}`)
  if(!input.resolvedBy.trim()||!input.rationale.trim())throw new Error('Transcript review resolution requires an identified resolver and a rationale')
  if(!target.needsReview)throw new Error(`Transcript segment has no unresolved review to resolve: ${target.id}`)
  assertNotStale(target,resolvedAtMs,'resolvedAt')
  const heard=[target.text,...(target.alternatives??[]).map(a=>a.text)].map(t=>t.trim())
  if(!heard.includes(input.resolvedText.trim()))throw new Error(`Transcript review resolution must select recorded transcript text, not new text: ${target.id}`)
  if(target.status==='final'&&input.resolvedText.trim()!==target.text.trim())throw new Error('Final transcript cannot be silently replaced by a review resolution; use clinician correction lineage')
  if(!isFinalizableTranscriptText(input.resolvedText))throw new Error(`Structurally incomplete text cannot resolve a transcript review: ${target.id}`)
  // Selecting a rival hypothesis does not transfer the discarded hypothesis's confidence to it. The chosen
  // alternative keeps only the confidence that was recorded for THAT text; if none was, confidence stays
  // unknown. The discarded score survives on the resolution record, not on the segment.
  const selected=(target.alternatives??[]).find(a=>a.text.trim()===input.resolvedText.trim())
  const confidence=confidenceCarriesOver(target.text,input.resolvedText)?target.confidence:selected?.confidence
  const resolution:TranscriptReviewResolution={resolvedAt:input.resolvedAt,resolvedBy:input.resolvedBy,previousText:target.text,resolvedText:input.resolvedText,rationale:input.rationale,previousConfidence:target.confidence,previousAlternatives:target.alternatives}
  return freezeSession({...input.session,segments:input.session.segments.map(s=>s.id===input.segmentId?{...s,text:input.resolvedText,confidence,alternatives:undefined,needsReview:false,reviewResolutions:[...(s.reviewResolutions??[]),resolution]}:s)})
}

export function voiceSessionToClinicalInput(session:VoiceSession,capturedAt:string):VoiceClinicalInput{
  assertTimestamp(capturedAt,'capturedAt');const finalSegments=sortSegments(session.segments.filter(s=>s.status==='final'));if(!finalSegments.length)throw new Error('Voice session has no final transcript segments')
  const segments=Object.freeze(finalSegments.map(s=>Object.freeze({id:s.id,sequence:s.sequence,receivedAt:s.receivedAt,finalizedAt:s.finalizedAt,speaker:s.speaker,confidence:s.confidence,alternatives:freezeAlternatives(s.alternatives),needsReview:s.needsReview,revisions:freezeRevisions(s.revisions),reviewResolutions:freezeResolutions(s.reviewResolutions)})))
  return Object.freeze({modality:'dictation',raw:finalSegments.map(s=>s.text).join('\n'),language:session.language,capturedAt,encounterId:session.encounterId,voiceProvenance:Object.freeze({sessionId:session.id,provider:session.provider,needsReview:finalSegments.some(s=>s.needsReview),segments})})
}

/**
 * Deterministic latency from supplied timestamps only.
 *
 * Impossible chronology is refused, never clamped: a `Math.max(0, …)` would report a segment that precedes its
 * own session as a flawless 0 ms, turning a broken provider clock into the best latency number in the corpus.
 */
function assertMeasurableLatency(value:number,field:string):number{
  if(value<0)throw new Error(`Impossible voice chronology rejected: ${field} precedes session startedAt`)
  return value
}
export function measureVoiceSession(session:VoiceSession):VoiceMetrics{
  const started=assertTimestamp(session.startedAt,'startedAt')
  for(const segment of session.segments){
    assertMeasurableLatency(assertTimestamp(segment.receivedAt,'receivedAt')-started,`receivedAt of transcript segment ${segment.id}`)
    // Fail closed rather than measure: a partial hypothesis that carries a final timestamp has no final latency
    // to report, and silently ignoring it would hide the contradiction behind a plausible number.
    if(segment.status!=='final'&&segment.finalizedAt) throw new Error(`Impossible voice state rejected: partial transcript segment ${segment.id} carries finalizedAt; time-to-final cannot be measured from a segment that is not final`)
  }
  const finalTimes=session.segments.filter(s=>s.status==='final').map(s=>assertTimestamp(s.finalizedAt as string,'finalizedAt'))
  return {timeToFirstPartialMs:session.firstPartialReceivedAt?assertMeasurableLatency(assertTimestamp(session.firstPartialReceivedAt,'firstPartialReceivedAt')-started,'firstPartialReceivedAt'):undefined,timeToFinalMs:finalTimes.length?assertMeasurableLatency(Math.max(...finalTimes)-started,'finalizedAt'):undefined,revisionCount:session.segments.reduce((n,s)=>n+s.revisions.length,0),unresolvedReviewCount:session.segments.filter(s=>s.needsReview).length}
}

function benchmarkTokens(value:string):string[]{return value.normalize('NFKC').toLocaleLowerCase('es-MX').replace(/[^\p{L}\p{N}%./+-]+/gu,' ').trim().split(/\s+/).filter(Boolean)}
function levenshtein(a:readonly string[],b:readonly string[]):number{const p=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){const c=[i];for(let j=1;j<=b.length;j++)c[j]=Math.min(c[j-1]+1,p[j]+1,p[j-1]+(a[i-1]===b[j-1]?0:1));p.splice(0,p.length,...c)}return p[b.length]}
function containsPhrase(tokens:readonly string[],phrase:string):boolean{const e=benchmarkTokens(phrase);if(!e.length)return false;for(let i=0;i<=tokens.length-e.length;i++)if(e.every((t,o)=>tokens[i+o]===t))return true;return false}
function rateForKind(terms:readonly VoiceBenchmarkCriticalTerm[],tokens:readonly string[],kind:VoiceBenchmarkTermKind):number|undefined{const k=terms.filter(t=>t.kind===kind);return k.length?k.filter(t=>!containsPhrase(tokens,t.value)).length/k.length:undefined}

export function evaluateVoiceBenchmarkCase(input:VoiceBenchmarkCase):VoiceBenchmarkResult{
  if(!input.id.trim()||!input.reference.trim()||!input.hypothesis.trim())throw new Error('benchmark id, reference and hypothesis are required')
  for(const v of [input.revisionCount,input.unresolvedReviewCount,input.forcedRepeatCount,input.clinicallySignificantReferenceCount,input.clinicallySignificantOmissionSubstitutionCount,input.hallucinatedContentCount,input.physicianUtteranceCount,input.contextualRecoveryOpportunityCount,input.contextualRecoveredCount]) if(v!==undefined&&(!Number.isInteger(v)||v<0))throw new Error('benchmark counts must be non-negative integers')
  for(const [v,f] of [[input.timeToFirstPartialMs,'timeToFirstPartialMs'],[input.timeToFinalMs,'timeToFinalMs'],[input.physicianEditTimeMs,'physicianEditTimeMs']] as const) assertNonNegative(v,f)
  if(input.physicianSatisfactionScore!==undefined&&(input.physicianSatisfactionScore<1||input.physicianSatisfactionScore>5))throw new Error('physicianSatisfactionScore must be between 1 and 5')
  if(input.clinicallySignificantOmissionSubstitutionCount!==undefined&&!input.clinicallySignificantReferenceCount)throw new Error('clinically significant error count requires a positive reference count')
  // A rate needs a real denominator. Absent denominators leave the rate undefined; impossible ones are refused, not rescaled.
  if(input.contextualRecoveredCount!==undefined&&!input.contextualRecoveryOpportunityCount)throw new Error('contextual recovery count requires a positive contextual recovery opportunity count')
  if(input.contextualRecoveredCount!==undefined&&input.contextualRecoveredCount>(input.contextualRecoveryOpportunityCount as number))throw new Error('contextual recovery count cannot exceed its opportunity count')
  if(input.physicianUtteranceCount!==undefined&&input.forcedRepeatCount>input.physicianUtteranceCount)throw new Error('forced repeat count cannot exceed the physician utterance count')
  const r=benchmarkTokens(input.reference),h=benchmarkTokens(input.hypothesis)
  // An unmeasured dimension has no denominator, so it has no rate. The former `?? 0` / `Math.max(1, …)` turned
  // "this corpus never tested medications" into "this engine never missed a medication" — an empty corpus read
  // as clinically perfect. Absence is reported as absence and excluded from every summary.
  const critical=input.criticalTerms.length?input.criticalTerms.filter(t=>!containsPhrase(h,t.value)).length/input.criticalTerms.length:undefined
  const med=rateForKind(input.criticalTerms,h,'medication'),dose=rateForKind(input.criticalTerms,h,'dose'),neg=rateForKind(input.criticalTerms,h,'negation')
  return {caseId:input.id,wordErrorRate:levenshtein(r,h)/Math.max(1,r.length),criticalTermErrorRate:critical,medicationErrorRate:med,doseErrorRate:dose,negationErrorRate:neg,numericLabErrorRate:rateForKind(input.criticalTerms,h,'numeric_lab'),specialtyTerminologyErrorRate:rateForKind(input.criticalTerms,h,'specialty_term'),codeSwitchingErrorRate:rateForKind(input.criticalTerms,h,'code_switching'),clinicallySignificantOmissionSubstitutionRate:input.clinicallySignificantOmissionSubstitutionCount===undefined?undefined:input.clinicallySignificantOmissionSubstitutionCount/(input.clinicallySignificantReferenceCount as number),hallucinatedContentRate:input.hallucinatedContentCount===undefined?undefined:input.hallucinatedContentCount/Math.max(1,h.length),timeToFirstPartialMs:input.timeToFirstPartialMs,timeToFinalMs:input.timeToFinalMs,correctionBurden:input.revisionCount,unresolvedReviewCount:input.unresolvedReviewCount,forcedRepeatCount:input.forcedRepeatCount,forcedRepeatRate:input.physicianUtteranceCount?input.forcedRepeatCount/input.physicianUtteranceCount:undefined,contextualRecoveryRate:input.contextualRecoveryOpportunityCount&&input.contextualRecoveredCount!==undefined?input.contextualRecoveredCount/input.contextualRecoveryOpportunityCount:undefined,physicianEditTimeMs:input.physicianEditTimeMs,physicianSatisfactionScore:input.physicianSatisfactionScore}
}

export function summarizeVoiceBenchmark(results:readonly VoiceBenchmarkResult[]){if(!results.length)throw new Error('at least one benchmark result is required');const mean=(v:number[])=>v.reduce((a,b)=>a+b,0)/v.length;const present=(v:Array<number|undefined>)=>v.filter((x):x is number=>x!==undefined);const opt=(v:Array<number|undefined>)=>{const p=present(v);return p.length?mean(p):undefined};return {cases:results.length,meanWordErrorRate:mean(results.map(r=>r.wordErrorRate)),meanCriticalTermErrorRate:opt(results.map(r=>r.criticalTermErrorRate)),meanMedicationErrorRate:opt(results.map(r=>r.medicationErrorRate)),meanDoseErrorRate:opt(results.map(r=>r.doseErrorRate)),meanNegationErrorRate:opt(results.map(r=>r.negationErrorRate)),meanNumericLabErrorRate:opt(results.map(r=>r.numericLabErrorRate)),meanSpecialtyTerminologyErrorRate:opt(results.map(r=>r.specialtyTerminologyErrorRate)),meanCodeSwitchingErrorRate:opt(results.map(r=>r.codeSwitchingErrorRate)),meanClinicallySignificantOmissionSubstitutionRate:opt(results.map(r=>r.clinicallySignificantOmissionSubstitutionRate)),meanHallucinatedContentRate:opt(results.map(r=>r.hallucinatedContentRate)),meanTimeToFirstPartialMs:opt(results.map(r=>r.timeToFirstPartialMs)),meanTimeToFinalMs:opt(results.map(r=>r.timeToFinalMs)),meanCorrectionBurden:mean(results.map(r=>r.correctionBurden)),meanUnresolvedReviewCount:mean(results.map(r=>r.unresolvedReviewCount)),meanForcedRepeatCount:mean(results.map(r=>r.forcedRepeatCount)),meanForcedRepeatRate:opt(results.map(r=>r.forcedRepeatRate)),meanContextualRecoveryRate:opt(results.map(r=>r.contextualRecoveryRate)),meanPhysicianEditTimeMs:opt(results.map(r=>r.physicianEditTimeMs)),meanPhysicianSatisfactionScore:opt(results.map(r=>r.physicianSatisfactionScore))}}
