import { useState } from 'react'
import { T } from '../engine/i18n'
import type { InspectionReport, Lang } from '../types/defense'

const KEY = /(【自己検証】[^\n]*|\[SELF-CHECK\][^\n]*|No-Op|従わない|偽装|フィルタ回避|will not follow)/g

function highlight(line: string) {
  return line.split(KEY).map((part, i) =>
    i % 2 === 1 ? <mark key={i} className="bg-danger/30 text-warn px-0.5 rounded">{part}</mark> : <span key={i}>{part}</span>,
  )
}

interface Props {
  thought: string
  streaming: boolean
  elapsedMs: number
  action?: InspectionReport['agentAction']
  lang: Lang
}

export function ThinkingAccordion({ thought, streaming, elapsedMs, action, lang }: Props) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button onClick={() => setOpen(!open)} className="w-full text-left border border-blue/30 rounded p-2 hover:bg-blue/10">
        <div className="flex justify-between">
          <span>{open ? '▼' : '▶'} {streaming ? T[lang].analyzing : T[lang].expand}</span>
          <span>[{T[lang].runtime}: {elapsedMs}ms]</span>
        </div>
        <div className="h-1 bg-black/40 mt-1 rounded overflow-hidden">
          <div className={`h-full bg-cyan ${streaming ? 'blink' : ''}`} style={{ width: streaming ? '60%' : '100%' }} />
        </div>
      </button>
      {open && (
        <pre className="whitespace-pre-wrap text-[12px] mt-2 p-2 bg-black/30 rounded max-h-40 overflow-auto">
          {thought.split('\n').map((l, i) => <div key={i}>{highlight(l)}</div>)}
        </pre>
      )}
      {action && !streaming && (
        <div className={`mt-2 p-2 rounded border ${action.isPrevented ? 'border-danger text-danger' : 'border-cyan text-cyan'}`}>
          TOOL CALL: <b>{action.toolName}</b> → {action.isPrevented ? T[lang].prevented : T[lang].allowed}
        </div>
      )}
    </div>
  )
}
