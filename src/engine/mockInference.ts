import type { InspectionReport, Lang } from '../types/defense'
import { T } from './i18n'

/** Backend switch: replace `mock` with a WebGPU / API implementation of the same interface. */
export interface InferenceBackend {
  streamThought(report: InspectionReport, lang: Lang, onChunk: (text: string) => void, signal?: AbortSignal): Promise<void>
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((res, rej) => {
    const t = setTimeout(res, ms)
    signal?.addEventListener('abort', () => (clearTimeout(t), rej(new DOMException('aborted', 'AbortError'))))
  })

export function buildThought(r: InspectionReport, lang: Lang): string {
  const t = T[lang].th
  const tool = r.agentAction?.toolName ?? ''
  const lines: string[] = ['<thought>', t.start]
  if (r.features.hasSystemTagSpoofing) lines.push(t.tag)
  if (r.features.hasHalfWidthKana) lines.push(t.half)
  if (r.features.zeroWidthOrControlChars) lines.push(t.zw)
  if (r.features.honorificLevel === 'ultra_keigo') lines.push(t.keigo)
  const nn = r.gates[1]?.nearestNeighbor
  if (nn && r.gates[1].status !== 'PASSED') lines.push(t.nn(nn.source, nn.category, nn.similarity.toFixed(2)))
  if (r.finalVerdict === 'SAFE') lines.push(t.safe1, t.safe2(tool))
  else lines.push(t.bad1, t.bad2, t.bad3(tool))
  lines.push('</thought>')
  return lines.join('\n')
}

export const mockBackend: InferenceBackend = {
  async streamThought(report, lang, onChunk, signal) {
    const text = buildThought(report, lang)
    let acc = ''
    for (const ch of [...text]) {
      acc += ch
      onChunk(acc)
      await sleep(ch === '\n' ? 120 : 14, signal)
    }
  },
}
