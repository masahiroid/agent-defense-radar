import type { GateResult } from '../types/defense'

const STYLE: Record<GateResult['status'], string> = {
  PASSED: 'border-cyan/50 text-cyan',
  FLAGGED: 'border-warn/70 text-warn',
  BLOCKED: 'border-danger/80 text-danger',
}

export function DefenseGatePipeline({ gates, pending, standby }: { gates: GateResult[]; pending: boolean; standby: string }) {
  if (!gates.length) return <div className="opacity-50">{standby}</div>
  return (
    <div className="flex flex-col gap-2">
      {gates.map((g, i) => (
        <div key={g.gateId} className={`border rounded p-2 bg-black/20 ${STYLE[g.status]} ${pending && g.gateId === 'L3_THINKING_VERIFY' ? 'blink' : ''}`}>
          <div className="flex justify-between">
            <span className="font-semibold">GATE {i + 1} · {g.name}</span>
            <span>{g.status} · {g.latencyMs}ms</span>
          </div>
          <div className="text-[12px] text-slate-300 mt-1">{g.reason}</div>
          {g.nearestNeighbor && (
            <div className="text-[11px] text-slate-400 mt-1 truncate" title={g.nearestNeighbor.sampleText}>
              ↳ {g.nearestNeighbor.source}/{g.nearestNeighbor.category} cos={g.nearestNeighbor.similarity.toFixed(2)}: {g.nearestNeighbor.sampleText}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
