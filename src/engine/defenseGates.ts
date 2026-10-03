import type { GateResult, InspectionReport, Lang, Sample } from '../types/defense'
import { T } from './i18n'
import { analyzeText, normalizeJa } from './textAnalysis'
import { buildIndex, embed, nearest, project, type IndexedSample } from './atlas'

/** Spec threshold is 0.82 for ruri embeddings; the char-bigram proxy scores lower, so it is recalibrated. */
export const L2_THRESHOLD = 0.3
export const L2_THRESHOLD_SPEC = 0.82

const cache: Partial<Record<Lang, IndexedSample[]>> = {}

export async function loadIndex(lang: Lang): Promise<IndexedSample[]> {
  if (cache[lang]) return cache[lang]!
  const base = import.meta.env.BASE_URL
  const files = lang === 'ja' ? ['agentdojo_samples', 'bipia_samples'] : ['en_samples']
  const all = await Promise.all(files.map((f) => fetch(`${base}data/${f}.json`).then((r) => r.json() as Promise<Sample[]>)))
  return (cache[lang] = buildIndex(all.flat()))
}

export function runLayer1(prompt: string, lang: Lang): GateResult {
  const t0 = performance.now()
  const { features } = analyzeText(prompt)
  const normalized = normalizeJa(prompt)
  const reasons: string[] = []
  if (features.hasHalfWidthKana) reasons.push(T[lang].r_half)
  if (features.zeroWidthOrControlChars) reasons.push(T[lang].r_zw)
  if (features.hasSystemTagSpoofing) reasons.push(T[lang].r_tag)
  const status = features.hasSystemTagSpoofing ? 'BLOCKED' : reasons.length ? 'FLAGGED' : 'PASSED'
  return {
    gateId: 'L1_NORMALIZER',
    name: T[lang].g1,
    status,
    latencyMs: Math.max(1, Math.round(performance.now() - t0)),
    reason: reasons.length ? reasons.join(' / ') : normalized === prompt ? T[lang].r_ok : T[lang].r_norm,
  }
}

export function runLayer2(prompt: string, index: IndexedSample[], lang: Lang): GateResult {
  const t0 = performance.now()
  const vec = embed(normalizeJa(prompt))
  const [top] = nearest(vec, index, 1)
  const hit = top && top.s.label === 'attack' && top.sim > L2_THRESHOLD
  return {
    gateId: 'L2_ATLAS_KNN',
    name: T[lang].g2,
    status: hit ? 'BLOCKED' : top && top.s.label === 'attack' && top.sim > L2_THRESHOLD * 0.7 ? 'FLAGGED' : 'PASSED',
    latencyMs: Math.max(1, Math.round(performance.now() - t0)),
    reason: top ? `最近傍 cos=${top.sim.toFixed(2)} (${T[lang].r_thr} ${L2_THRESHOLD}, spec ${L2_THRESHOLD_SPEC}/ruri)` : T[lang].r_noref,
    nearestNeighbor: top && {
      source: top.s.source === 'benign' ? 'agentdojo-ja' : top.s.source,
      category: top.s.category,
      similarity: top.sim,
      sampleText: top.s.text,
    },
  }
}

/** Layer 3 verdict is decided from L1/L2 + features; thought text comes from mockInference. */
export function runLayer3(report: Pick<InspectionReport, 'features' | 'gates'>, lang: Lang): GateResult {
  const suspicious = report.gates.some((g) => g.status !== 'PASSED') || report.features.honorificLevel === 'ultra_keigo'
  return {
    gateId: 'L3_THINKING_VERIFY',
    name: T[lang].g3,
    status: suspicious ? 'BLOCKED' : 'PASSED',
    latencyMs: 180,
    reason: suspicious ? T[lang].r_l3_block : T[lang].r_l3_ok,
  }
}

export function inspect(prompt: string, index: IndexedSample[], lang: Lang): InspectionReport {
  const { features } = analyzeText(prompt)
  const l1 = runLayer1(prompt, lang)
  const l2 = runLayer2(prompt, index, lang)
  const l3 = runLayer3({ features, gates: [l1, l2] }, lang)
  const gates = [l1, l2, l3]
  const blocked = l1.status === 'BLOCKED' || l2.status === 'BLOCKED'
  const finalVerdict = blocked ? 'CRITICAL_INJECTION' : gates.some((g) => g.status !== 'PASSED') ? 'SUSPICIOUS' : 'SAFE'
  const prevented = finalVerdict !== 'SAFE'
  return {
    prompt,
    features,
    gates,
    finalVerdict,
    atlasCoordinate: prompt.trim() ? project(embed(normalizeJa(prompt)), index) : [0, 0],
    agentAction: {
      toolName: /振込|送金|transfer|send_money|IBAN/i.test(prompt) ? 'send_money' : /転送|送信|返信|forward|reply|send/i.test(prompt) ? 'send_email' : 'summarize_document',
      parameters: { source: 'external_data', normalized: normalizeJa(prompt).slice(0, 40) },
      isPrevented: prevented,
    },
  }
}
