export interface AttackFeature {
  hasHalfWidthKana: boolean
  hasSystemTagSpoofing: boolean
  honorificLevel: 'none' | 'polite' | 'ultra_keigo'
  zeroWidthOrControlChars: boolean
  entropyScore: number // 0.0 - 1.0
}

export interface GateResult {
  gateId: 'L1_NORMALIZER' | 'L2_ATLAS_KNN' | 'L3_THINKING_VERIFY'
  name: string
  status: 'PASSED' | 'BLOCKED' | 'FLAGGED'
  latencyMs: number
  reason?: string
  nearestNeighbor?: {
    source: 'agentdojo-ja' | 'bipia-ja'
    category: string
    similarity: number
    sampleText: string
  }
}

export interface InspectionReport {
  prompt: string
  features: AttackFeature
  gates: GateResult[]
  finalVerdict: 'SAFE' | 'SUSPICIOUS' | 'CRITICAL_INJECTION'
  atlasCoordinate: [number, number] // -1.0 ~ 1.0
  thoughtTrace?: string
  agentAction?: {
    toolName: string
    parameters: Record<string, unknown>
    isPrevented: boolean
  }
}

export interface Sample {
  source: 'agentdojo-ja' | 'bipia-ja' | 'benign'
  category: string
  text: string
  label: 'attack' | 'safe'
  lang?: 'ja' | 'en'
}

export type Lang = 'ja' | 'en'

export interface AtlasPoint {
  x: number
  y: number
  label: 'attack' | 'safe'
  category: string
}
