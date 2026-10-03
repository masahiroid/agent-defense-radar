import type { AtlasPoint, Sample } from '../types/defense'

/**
 * Lightweight stand-in for ruri embeddings: hashed char-bigram vectors.
 * Swap `embed` for a real model (transformers.js / WebGPU) to get a real atlas.
 */
const DIM = 512

export function embed(text: string): Float32Array {
  const v = new Float32Array(DIM)
  const t = [...text.normalize('NFKC')]
  for (let i = 0; i < t.length - 1; i++) {
    const g = t[i] + t[i + 1]
    let h = 2166136261
    for (let k = 0; k < g.length; k++) h = Math.imul(h ^ g.charCodeAt(k), 16777619)
    v[(h >>> 0) % DIM] += 1
  }
  return v
}

export function cosine(a: Float32Array, b: Float32Array): number {
  let d = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) {
    d += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  return na && nb ? d / Math.sqrt(na * nb) : 0
}

const ANCHORS: Record<string, [number, number]> = {
  safe: [-0.55, -0.35],
  banking_ja: [0.6, 0.55],
  workspace_ja: [0.35, 0.75],
  slack_ja: [0.75, 0.2],
  travel_ja: [0.5, -0.1],
  polite_jailbreak: [0.1, 0.5],
  task_hijack: [0.2, 0.15],
  info_leak: [0.0, 0.7],
}

function hash01(s: string, salt: number): number {
  let h = 2166136261 ^ salt
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return ((h >>> 0) % 10000) / 10000
}

export interface IndexedSample extends Sample {
  vec: Float32Array
  point: AtlasPoint
}

export function buildIndex(samples: Sample[]): IndexedSample[] {
  return samples.map((s) => {
    const a = s.label === 'safe' ? ANCHORS.safe : (ANCHORS[s.category] ?? [0.5, 0.4])
    const x = a[0] + (hash01(s.text, 1) - 0.5) * 0.3
    const y = a[1] + (hash01(s.text, 2) - 0.5) * 0.3
    return { ...s, vec: embed(s.text), point: { x, y, label: s.label, category: s.category } }
  })
}

export function nearest(vec: Float32Array, index: IndexedSample[], k = 3) {
  return index
    .map((s) => ({ s, sim: cosine(vec, s.vec) }))
    .sort((a, b) => b.sim - a.sim)
    .slice(0, k)
}

/** Project to atlas: similarity-weighted centroid of the top-k neighbours. */
export function project(vec: Float32Array, index: IndexedSample[]): [number, number] {
  const top = nearest(vec, index, 4)
  const w = top.map((t) => Math.exp(t.sim * 6))
  const sum = w.reduce((a, b) => a + b, 0) || 1
  const x = top.reduce((a, t, i) => a + t.s.point.x * w[i], 0) / sum
  const y = top.reduce((a, t, i) => a + t.s.point.y * w[i], 0) / sum
  return [x, y]
}
