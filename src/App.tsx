import { useEffect, useMemo, useRef, useState } from 'react'
import { DefenseGatePipeline } from './components/DefenseGatePipeline'
import { MiniAtlas } from './components/MiniAtlas'
import { PromptDock } from './components/PromptDock'
import { ModelConnect } from './components/ModelConnect'
import { LiveModelPanel, type LiveResult } from './components/LiveModelPanel'
import { buildMessages, judge, streamChat, ConnectError, type ModelConfig } from './engine/liveModel'
import { ModelXRay } from './components/ModelXRay'
import { RadarHUD } from './components/RadarHUD'
import { ThinkingAccordion } from './components/ThinkingAccordion'
import { inspect, loadIndex } from './engine/defenseGates'
import { mockBackend } from './engine/mockInference'
import { analyzeText, classHistogram } from './engine/textAnalysis'
import { T } from './engine/i18n'
import type { Lang } from './types/defense'
import type { IndexedSample } from './engine/atlas'

const VERDICT_STYLE = {
  SAFE: 'text-cyan border-cyan',
  SUSPICIOUS: 'text-warn border-warn',
  CRITICAL_INJECTION: 'text-danger border-danger',
} as const

export default function App() {
  const [lang, setLang] = useState<Lang>('ja')
  const [index, setIndex] = useState<IndexedSample[]>([])
  const [pulseKey, setPulseKey] = useState(0)
  const tx = T[lang]
  const [model, setModel] = useState<ModelConfig | null>(null)
  const [showConnect, setShowConnect] = useState(false)
  const [live, setLive] = useState<LiveResult[]>([])
  const [liveBusy, setLiveBusy] = useState(false)
  const liveAbort = useRef<AbortController | null>(null)

  const runLive = async () => {
    if (!model || !prompt.trim()) return
    liveAbort.current?.abort()
    const ac = new AbortController()
    liveAbort.current = ac
    setLiveBusy(true)
    const results: LiveResult[] = [{ guard: false, reasoning: '', answer: '', status: 'running' }, { guard: true, reasoning: '', answer: '', status: 'running' }]
    setLive([results[0]])
    for (const guard of [false, true]) {
      const i = guard ? 1 : 0
      setLive(results.slice(0, i + 1).map((r) => ({ ...r })))
      try {
        const out = await streamChat(model, buildMessages(lang, prompt, guard), (d) => {
          results[i] = { ...results[i], ...d }
          setLive(results.slice(0, i + 1).map((r) => ({ ...r })))
        }, ac.signal)
        results[i] = { ...results[i], ...out, status: 'done', verdict: judge(out.answer) }
      } catch (e) {
        if ((e as Error).name === 'AbortError') return
        const ce = e as ConnectError
        results[i] = { ...results[i], status: 'error', error: ce.kind === 'network' ? 'Network/CORS error. Is the server running and CORS enabled?' : ce.message }
      }
      setLive(results.slice(0, i + 1).map((r) => ({ ...r })))
    }
    setLiveBusy(false)
  }
  const [prompt, setPrompt] = useState('')
  const [thought, setThought] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => { setIndex([]); loadIndex(lang).then(setIndex); setPrompt('') }, [lang])

  const analysis = useMemo(() => analyzeText(prompt), [prompt])
  const report = useMemo(() => (index.length && prompt.trim() ? inspect(prompt, index, lang) : null), [index, prompt, lang])
  const hist = useMemo(() => classHistogram(prompt), [prompt])

  const abortRef = useRef<AbortController | null>(null)
  useEffect(() => {
    abortRef.current?.abort()
    setThought('')
    if (!report) { setStreaming(false); return }
    const ac = new AbortController()
    abortRef.current = ac
    const timer = setTimeout(async () => {
      setStreaming(true)
      const t0 = performance.now()
      try {
        await mockBackend.streamThought(report, lang, setThought, ac.signal)
        setElapsed(Math.round(performance.now() - t0))
        setStreaming(false)
      } catch { /* aborted by newer input */ }
    }, 400)
    return () => { clearTimeout(timer); ac.abort() }
  }, [report])

  const verdict = report?.finalVerdict ?? 'SAFE'
  useEffect(() => { if (verdict === 'CRITICAL_INJECTION' && report) setPulseKey((k) => k + 1) }, [verdict, !!report]) // eslint-disable-line
  const gates = report && !streaming ? report.gates : report ? report.gates.slice(0, 2) : []

  return (
    <div className="min-h-full lg:h-screen lg:overflow-hidden flex flex-col p-3 gap-3">
      <header className="panel px-4 py-2 flex items-center justify-between">
        <h1 className="text-cyan font-semibold tracking-widest">{tx.title} <span className="text-blue/70 font-normal">{tx.subtitle}</span></h1>
        <div className="flex gap-2 items-center">
        <div className="flex border border-blue/40 rounded overflow-hidden text-xs">
          {(['ja', 'en'] as Lang[]).map((l) => (
            <button key={l} onClick={() => setLang(l)} className={`px-2 py-0.5 ${lang === l ? 'bg-cyan/20 text-cyan' : 'text-slate-400'}`}>{l.toUpperCase()}</button>
          ))}
        </div>
        <div className={`border rounded px-3 py-0.5 text-xs ${report ? VERDICT_STYLE[verdict] : 'text-slate-400 border-slate-600'}`}>
          {report ? verdict : 'STANDBY'} <span className="blink">●</span>
        </div>
        </div>
      </header>
      <main className="flex-1 flex flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)] lg:min-h-0">
        <div className="contents lg:flex lg:flex-col lg:gap-3 lg:min-h-0">
          <section className="panel p-3 lg:flex-1 lg:min-h-0 lg:overflow-auto">
            <div className="panel-title mb-2">{tx.xray} <span className="text-slate-400 normal-case tracking-normal">· {tx.xraySub}</span></div>
            <ModelXRay lang={lang} />
          </section>
        </div>
        <div className="contents lg:flex lg:flex-col lg:gap-3 lg:min-h-0">
          <section className="panel p-3">
            <div className="panel-title mb-2">{tx.radar} <span className="text-slate-500 normal-case tracking-normal">· {tx.radarNote}</span></div>
            <RadarHUD risk={analysis.stats.riskScore} entropy={analysis.features.entropyScore} halfWidthRatio={analysis.stats.halfWidthRatio} hist={hist} labels={tx.clsLabels} pulseKey={pulseKey} halfLabel={tx.half} />
          </section>
          <section className="panel p-3">
            <div className="panel-title mb-2">{tx.atlas}</div>
            <MiniAtlas points={index.map((s) => s.point)} target={report?.atlasCoordinate ?? [0, 0]} active={!!report} />
          </section>
        </div>
        <div className="contents lg:flex lg:flex-col lg:gap-3 lg:min-h-0">
          <section className="panel p-3 lg:flex-1 lg:min-h-0 lg:overflow-auto">
            <div className="panel-title mb-2">{tx.pipeline}</div>
            <DefenseGatePipeline gates={gates} pending={streaming} standby={tx.standby} />
          </section>
          <section className="panel p-3 lg:flex-1 lg:min-h-0 lg:overflow-auto">
            <div className="panel-title mb-2">{tx.live}</div>
            <LiveModelPanel lang={lang} results={live} modelName={model?.model} />
          </section>
          <section className="panel p-3 lg:min-h-0 lg:overflow-auto">
            <div className="panel-title mb-2">{tx.thinking}</div>
            {report ? (
              <ThinkingAccordion thought={thought} streaming={streaming} elapsedMs={elapsed} action={report.agentAction} lang={lang} />
            ) : <div className="opacity-50">{tx.standby}</div>}
          </section>
        </div>
      </main>
      <PromptDock lang={lang} value={prompt} onChange={setPrompt} modelName={model?.model} busy={liveBusy} onRun={runLive} onConnect={() => setShowConnect(true)} />
      {showConnect && <ModelConnect lang={lang} value={model} onSave={(c) => { setModel(c); setLive([]) }} onClose={() => setShowConnect(false)} />}
    </div>
  )
}
